import { createAuthorityAssessment, type AuthorityAssessment, type AuthorityInput, type ResearchSource } from "@/lib/diagnostics/authority";
import { createStructuredAuthorityThirtyDayPlan, normalizeAuthorityThirtyDayPlan, type AuthorityPlanContext, type AuthorityThirtyDayPlan } from "@/lib/diagnostics/authorityPlan";
import { generateGeminiJson } from "@/lib/ai/geminiClient";
import { generateManusJson } from "@/lib/ai/manusStructuredClient";
import { ptBrEditorialInstruction, reviewPortugueseCopy, reviewPortugueseList, silentEditorialReviewInstruction } from "@/lib/copy/editorial";
import { buildLinkedInAlgorithmPlanPromptSection, buildLinkedInAlgorithmPromptSection } from "@/lib/social-selling/linkedinAlgorithmStrategy";
import { buildSocialSellingPromptSection } from "@/lib/social-selling/socialSellingStrategy";
import { PlatformResourceUnavailableError } from "@/lib/connectors/errors";

type ExpertGapDraft = {
  title?: string;
  diagnosis?: string;
  expertReading?: string;
  authorityImpact?: string;
  commercialImpact?: string;
  recommendation?: string;
  nextBestAction?: string;
};

type AuthorityAiPayload = {
  summary?: string;
  strengths?: string[];
  gaps?: string[];
  risks?: string[];
  opportunities?: string[];
  recommendations?: string[];
  strategicGaps?: ExpertGapDraft[];
  nextBestAction?: {
    title?: string;
    reason?: string;
    actions?: string[];
  };
};

type AuthorityPlanAiPayload = Partial<AuthorityThirtyDayPlan>;
type AuthorityEngine = "manus" | "gemini";

export async function createAuthorityAssessmentWithProvider(input: AuthorityInput, extraSources: ResearchSource[] = []): Promise<AuthorityAssessment> {
  const methodology = createAuthorityAssessment(input, extraSources);
  const generated = await generateAssessmentWithFallback(input, methodology);
  if (!generated) return methodology;

  const { payload, provider } = generated;
  const strategicGaps = methodology.strategicGaps.map((gap, index) => {
    const draft = Array.isArray(payload.strategicGaps) ? payload.strategicGaps[index] : undefined;
    if (!draft) return gap;
    return {
      ...gap,
      title: cleanText(draft.title, gap.title),
      diagnosis: cleanText(draft.diagnosis, gap.diagnosis),
      expertReading: cleanText(draft.expertReading, gap.expertReading),
      authorityImpact: cleanText(draft.authorityImpact, gap.authorityImpact),
      commercialImpact: cleanText(draft.commercialImpact, gap.commercialImpact),
      recommendation: cleanText(draft.recommendation, gap.recommendation),
      nextBestAction: cleanText(draft.nextBestAction, gap.nextBestAction),
    };
  });

  const nextBestAction = payload.nextBestAction
    ? {
        ...methodology.nextBestAction,
        title: cleanText(payload.nextBestAction.title, methodology.nextBestAction.title),
        reason: cleanText(payload.nextBestAction.reason, methodology.nextBestAction.reason),
        actions: selectList(payload.nextBestAction.actions, methodology.nextBestAction.actions, 6),
      }
    : methodology.nextBestAction;

  return {
    ...methodology,
    // The persisted schema predates Manus. Keep the legacy adapter value for snapshot compatibility;
    // the actual engine is recorded explicitly in the research source below.
    adapter: provider === "gemini" ? "gemini" : methodology.adapter,
    summary: reviewPortugueseCopy(payload.summary ?? methodology.summary),
    strategicGaps,
    nextBestAction,
    strengths: reviewPortugueseList(selectList(payload.strengths, methodology.strengths, 6)),
    gaps: reviewPortugueseList(selectList(payload.gaps, methodology.gaps, 6)),
    risks: reviewPortugueseList(selectList(payload.risks, methodology.risks, 6)),
    opportunities: reviewPortugueseList(selectList(payload.opportunities, methodology.opportunities, 6)),
    recommendations: reviewPortugueseList(selectList(payload.recommendations, methodology.recommendations, 6)),
    sources: [
      ...methodology.sources.filter((source) => source.title !== "Avaliação local"),
      {
        title: provider === "manus" ? "Leitura especialista pelo Manus" : "Leitura especialista de redundância pelo Gemini",
        confidence: "inference",
        notes: "A leitura especialista usou somente o diagnóstico estruturado e os dados informados ou recuperados pelas fontes autorizadas; nenhum dado ausente foi inventado.",
      },
    ],
  };
}

export async function createAuthorityThirtyDayPlanWithProvider(context: AuthorityPlanContext): Promise<AuthorityThirtyDayPlan> {
  const structure = createStructuredAuthorityThirtyDayPlan(context);
  const prompt = buildPlanPrompt(context);

  try {
    const generated = await generateManusJson<AuthorityPlanAiPayload>({
      title: "Share AI · Plano de autoridade LinkedIn em 30 dias",
      prompt,
      schema: authorityPlanSchema,
    });
    return markPlanGeneration(normalizeAuthorityThirtyDayPlan(generated, structure), "manus");
  } catch (error) {
    if (!(error instanceof PlatformResourceUnavailableError)) console.warn("[authority-plan] Manus failed; using Gemini redundancy.", error);
  }

  try {
    const generated = await generateGeminiJson<AuthorityPlanAiPayload>({
      capability: "ai.generateContentPlan",
      prompt,
    });
    return markPlanGeneration(normalizeAuthorityThirtyDayPlan(generated, structure), "gemini");
  } catch (error) {
    if (!(error instanceof PlatformResourceUnavailableError)) throw error;
    return structure;
  }
}

async function generateAssessmentWithFallback(input: AuthorityInput, methodology: AuthorityAssessment): Promise<{ payload: AuthorityAiPayload; provider: AuthorityEngine } | null> {
  const prompt = buildAssessmentPrompt(input, methodology);
  try {
    const payload = await generateManusJson<AuthorityAiPayload>({
      title: "Share AI · Diagnóstico especialista de autoridade LinkedIn",
      prompt,
      schema: authorityAssessmentSchema,
    });
    return { payload, provider: "manus" };
  } catch (error) {
    if (!(error instanceof PlatformResourceUnavailableError)) console.warn("[authority-assessment] Manus failed; using Gemini redundancy.", error);
  }

  try {
    const payload = await generateGeminiJson<AuthorityAiPayload>({
      capability: "ai.generateStructuredAssessment",
      prompt,
    });
    return { payload, provider: "gemini" };
  } catch (error) {
    if (error instanceof PlatformResourceUnavailableError) return null;
    throw error;
  }
}

function buildAssessmentPrompt(input: AuthorityInput, methodology: AuthorityAssessment) {
  return `
Você é um consultor sênior de LinkedIn, personal branding, social selling, reputação executiva, conteúdo e posicionamento comercial B2B.
Sua função NÃO é elogiar o perfil. Sua função é produzir uma leitura diagnóstica que um especialista cobraria para entregar: específica, pedagógica, exigente e executável.
${ptBrEditorialInstruction}
${silentEditorialReviewInstruction}
${buildLinkedInAlgorithmPromptSection()}
${buildSocialSellingPromptSection()}

PRINCÍPIO PEDAGÓGICO — ENSINE O B + A = BA:
- Assuma que a pessoa pode estar começando hoje no LinkedIn.
- Não diga apenas "melhore a headline", "gere autoridade", "faça networking" ou "publique conteúdo".
- Explique O QUE está acontecendo, POR QUE isso reduz a percepção de autoridade, O QUE precisa mudar e COMO executar a mudança.
- Quando recomendar algo, dê uma estrutura ou exemplo aplicável sem inventar experiência, resultado, número ou case da pessoa.
- Todo jargão de LinkedIn/social selling deve ser explicado em linguagem comum na primeira vez em que aparecer.
- Diferencie claramente sintoma, causa provável, impacto em autoridade, impacto comercial e ação corretiva.
- Priorize poucas decisões importantes em vez de listas genéricas.

REGRAS DE EVIDÊNCIA:
- Não invente dados externos, métricas, tendências, cases, resultados ou experiências.
- Não afirme que acessou ou raspou LinkedIn; trabalhe somente com o material fornecido.
- Dados ausentes significam "não avaliado", não desempenho ruim.
- Separe autoridade pessoal permanente de aderência temporária à BU.
- Não use DNA da BU como se fosse evidência encontrada no perfil.
- Preserve as evidências e a prioridade do diagnóstico estruturado. A IA aprofunda a leitura; não altera fatos nem cria prova.
- Responda somente JSON válido, sem markdown.

CONTEXTO DO PERFIL:
BU/foco: ${input.businessUnitName}
URL de referência: ${input.profileUrl || "não informada"}
Objetivo: ${input.objective}
Headline: ${input.headline}
Sobre: ${input.about}
Temas: ${input.themes}
Provas e resultados: ${input.proofPoints}
Conteúdos recentes: ${input.recentContent}
Interações e networking: ${input.interactionSignals}
DNA da BU/foco: ${JSON.stringify(input.businessUnitContext ?? {}, null, 2)}

DIAGNÓSTICO ESTRUTURADO QUE DEVE SER APROFUNDADO:
${JSON.stringify({
  classification: methodology.authorityClassification,
  scores: {
    authority: methodology.authoritySellingScore,
    affinity: methodology.buAffinityScore,
    activation: methodology.activationPotentialScore,
    coverage: methodology.scoreCoverage,
  },
  dimensions: methodology.dimensions.map((item) => ({ label: item.label, score: item.score, status: item.status, rationale: item.rationale, evidence: item.evidence })),
  perception: methodology.authorityPerception,
  evidencePortfolio: methodology.evidencePortfolio,
  strategicGaps: methodology.strategicGaps,
  nextBestAction: methodology.nextBestAction,
}, null, 2)}

QUALIDADE MÍNIMA DA RESPOSTA:
- summary: 1 leitura executiva clara com diagnóstico, causa central e prioridade; evite frases genéricas.
- strengths: forças sustentadas por evidência, explicando por que ajudam a autoridade.
- gaps: lacunas em linguagem concreta, não nomes abstratos de dimensões.
- recommendations: instruções acionáveis. Uma pessoa iniciante deve saber qual é o próximo movimento.
- strategicGaps: devolva os mesmos gaps principais, na mesma ordem, aprofundando cada um.
  * diagnosis = o que está acontecendo no perfil.
  * expertReading = por que um especialista considera isso relevante e como um decisor tende a interpretar o sinal.
  * authorityImpact = efeito na percepção de especialidade/confiança.
  * commercialImpact = efeito em descoberta, conversa ou oportunidade.
  * recommendation = correção concreta com estrutura e, quando útil, exemplo genérico adaptável.
  * nextBestAction = primeiro passo pequeno e executável.
- nextBestAction.actions: 3 a 6 passos em ordem, escritos para alguém que nunca estruturou o LinkedIn estrategicamente.

Formato:
{
  "summary": "",
  "strengths": [],
  "gaps": [],
  "risks": [],
  "opportunities": [],
  "recommendations": [],
  "strategicGaps": [
    {
      "title": "",
      "diagnosis": "",
      "expertReading": "",
      "authorityImpact": "",
      "commercialImpact": "",
      "recommendation": "",
      "nextBestAction": ""
    }
  ],
  "nextBestAction": {
    "title": "",
    "reason": "",
    "actions": []
  }
}
`;
}

function buildPlanPrompt({ assessment, history = [] }: AuthorityPlanContext) {
  const guidance = assessment.input.businessUnitContext ?? {};
  return `
Você é especialista sênior em personal branding, LinkedIn, social selling, autoridade comercial, estratégia de conteúdo, networking e ativação comercial B2B.
Crie um plano NOVO de 30 dias que funcione ao mesmo tempo como estratégia e como tutorial operacional para uma pessoa iniciante.
${ptBrEditorialInstruction}
${silentEditorialReviewInstruction}
${buildLinkedInAlgorithmPlanPromptSection()}

REGRA CENTRAL — ENSINE O B + A = BA:
A pessoa não pode receber "otimize seu perfil", "comente em posts", "faça networking" ou "publique uma tese" e ter que descobrir sozinha como fazer.
Para CADA dia, o campo action deve ensinar a execução em linguagem simples, contendo:
1) onde ou em que contexto a pessoa deve agir;
2) o que fazer primeiro;
3) o que escrever, procurar, revisar ou decidir;
4) um exemplo de estrutura/frase quando a tarefa envolver texto;
5) como saber que terminou aquela tarefa.
Não presuma que a pessoa conhece termos como headline, CTA, rapport, ICP, prova de autoridade, tese, hook ou social selling. Quando aparecerem, explique em linguagem comum.

EXEMPLOS DO NÍVEL DE DETALHE ESPERADO:
- Ruim: "Melhore sua headline."
- Bom: "Abra a área de apresentação do perfil e revise a frase abaixo do seu nome (headline). Monte-a em três blocos: [o que você faz] + [para quem/qual problema] + [evidência ou especialidade que pode comprovar]. Exemplo de estrutura: 'Liderança de Projetos | Transformo X em Y | experiência em Z'. Não copie o exemplo se os fatos não existirem no seu perfil. Conclua quando uma pessoa de fora da sua empresa conseguir entender em poucos segundos o que você faz e por que conversar com você."
- Ruim: "Comente em posts relevantes."
- Bom: "Escolha uma publicação de alguém que converse com seu território. Leia antes de comentar. Escreva 2 a 5 linhas seguindo: ponto que chamou atenção + sua leitura/experiência real + uma consequência ou pergunta. Exemplo de estrutura: 'Esse ponto sobre X é importante porque ____. No meu contexto, observo ____. Você percebe o mesmo quando ____?'. Sem pitch e sem elogio vazio."

REGRAS ESTRATÉGICAS:
- Use somente dados do diagnóstico e contexto abaixo. Não invente tendências, cases, resultados, dados externos ou informações do perfil.
- Separe ações PESSOAIS de BUSINESS_UNIT. Marca pessoal não é propaganda da BU.
- Priorize lacunas reais: clareza, prova, posicionamento, conteúdo, networking, relacionamento e pontes comerciais.
- Inclua exatamente 30 ações, uma para cada dia de 1 a 30.
- Não exija publicação diária. Pode recomendar não publicar, revisar perfil, pesquisar, comentar, responder, organizar prova, construir relacionamento ou analisar.
- Não permita OUTREACH antes de descoberta, relevância, interação, familiaridade e rapport. Se não houver contexto suficiente, mantenha relacionamento em vez de abordagem.
- reason deve explicar o "porquê" em linguagem didática; whyNow deve ligar a ação ao diagnóstico atual.
- signalToObserve deve funcionar como critério de conclusão/checagem e nunca inventar métrica.
- Quando sugerir um post, ensine a estrutura do post e o raciocínio; não invente a história ou o resultado da pessoa.
- Quando sugerir uma mensagem, dê um molde preenchível, não uma alegação falsa.
- A Share AI não publica nem envia mensagens automaticamente.
- Responda somente JSON válido, sem markdown.

Diagnóstico atual:
${JSON.stringify({
  assessmentId: assessment.id,
  profile: assessment.input,
  authoritySellingScore: assessment.authoritySellingScore,
  buAffinityScore: assessment.buAffinityScore,
  activationPotentialScore: assessment.activationPotentialScore,
  dimensions: assessment.dimensions.map((dimension) => ({ label: dimension.label, score: dimension.score, status: dimension.status, rationale: dimension.rationale, evidence: dimension.evidence })),
  strategicGaps: assessment.strategicGaps,
  gaps: assessment.gaps,
  strengths: assessment.strengths,
  bridgeOpportunities: assessment.bridgeOpportunities,
  nextBestAction: assessment.nextBestAction,
  personalAuthorityPlan: assessment.personalAuthorityPlan,
  businessUnitActivationPlan: assessment.businessUnitActivationPlan,
  buDna: guidance,
  historicalAssessments: history.slice(0, 5).map((item) => ({ createdAt: item.createdAt, authoritySellingScore: item.authoritySellingScore ?? item.overallScore, buAffinityScore: item.buAffinityScore })),
}, null, 2)}

Formato exigido:
{
  "title": "",
  "summary": "",
  "objective": "",
  "currentState": "",
  "desiredState": "",
  "strategicPriorities": [],
  "whyNow": "",
  "evidence": [],
  "risks": [],
  "indicators": [],
  "actions": [
    {
      "day": 1,
      "type": "PROFILE | AUTHORITY | CONTENT | NETWORKING | ENGAGEMENT | RESEARCH | RELATIONSHIP | BU_ACTIVATION | MEASUREMENT | REVIEW",
      "socialSellingAction": "POST | COMMENT | REPLY | PROFILE | INTELLIGENCE | RAPPORT | OUTREACH | RELATIONSHIP | ANALYSIS | NO_PUBLISH",
      "strategicObjective": "AUTHORITY | EXPANSION | RELATIONSHIP | CONVERSION | BU_ACTIVATION",
      "scope": "PERSONAL | BUSINESS_UNIT",
      "title": "",
      "action": "passo a passo completo, com exemplo adaptável e critério de conclusão",
      "reason": "",
      "whyNow": "",
      "signalToObserve": "",
      "expectedImpact": "Baixo | Médio | Alto",
      "effort": "Baixo | Médio | Alto",
      "estimatedTime": "",
      "authorityTerritory": "",
      "businessUnit": "",
      "persona": "",
      "relatedModule": ""
    }
  ]
}
`;
}

function markPlanGeneration(plan: AuthorityThirtyDayPlan, provider: AuthorityEngine): AuthorityThirtyDayPlan {
  const marked = {
    ...plan,
    // Legacy plan snapshots typed this field before Manus became the primary engine.
    generation: provider,
    generationNote: provider === "manus"
      ? "Plano desenvolvido pelo Manus como motor principal da Share AI; o Gemini atua como redundância quando necessário."
      : "Plano desenvolvido pelo Gemini como redundância porque o Manus não estava disponível nesta execução.",
  };
  return marked as unknown as AuthorityThirtyDayPlan;
}

function cleanText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? reviewPortugueseCopy(value.trim()) : fallback;
}

function selectList(value: unknown, fallback: string[], limit: number) {
  if (!Array.isArray(value)) return fallback;
  const clean = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => reviewPortugueseCopy(item));
  return clean.length ? clean.slice(0, limit) : fallback;
}

const stringArraySchema = { type: "array", items: { type: "string" } } as const;

const authorityAssessmentSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    summary: { type: "string" },
    strengths: stringArraySchema,
    gaps: stringArraySchema,
    risks: stringArraySchema,
    opportunities: stringArraySchema,
    recommendations: stringArraySchema,
    strategicGaps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          diagnosis: { type: "string" },
          expertReading: { type: "string" },
          authorityImpact: { type: "string" },
          commercialImpact: { type: "string" },
          recommendation: { type: "string" },
          nextBestAction: { type: "string" },
        },
        required: ["title", "diagnosis", "expertReading", "authorityImpact", "commercialImpact", "recommendation", "nextBestAction"],
      },
    },
    nextBestAction: {
      type: "object",
      properties: {
        title: { type: "string" },
        reason: { type: "string" },
        actions: stringArraySchema,
      },
      required: ["title", "reason", "actions"],
    },
  },
  required: ["summary", "strengths", "gaps", "risks", "opportunities", "recommendations", "strategicGaps", "nextBestAction"],
};

const authorityPlanSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    objective: { type: "string" },
    currentState: { type: "string" },
    desiredState: { type: "string" },
    strategicPriorities: stringArraySchema,
    whyNow: { type: "string" },
    evidence: stringArraySchema,
    risks: stringArraySchema,
    indicators: stringArraySchema,
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          day: { type: "number" },
          type: { type: "string", enum: ["PROFILE", "AUTHORITY", "CONTENT", "NETWORKING", "ENGAGEMENT", "RESEARCH", "RELATIONSHIP", "BU_ACTIVATION", "MEASUREMENT", "REVIEW"] },
          socialSellingAction: { type: "string", enum: ["POST", "COMMENT", "REPLY", "PROFILE", "INTELLIGENCE", "RAPPORT", "OUTREACH", "RELATIONSHIP", "ANALYSIS", "NO_PUBLISH"] },
          strategicObjective: { type: "string", enum: ["AUTHORITY", "EXPANSION", "RELATIONSHIP", "CONVERSION", "BU_ACTIVATION"] },
          scope: { type: "string", enum: ["PERSONAL", "BUSINESS_UNIT"] },
          title: { type: "string" },
          action: { type: "string" },
          reason: { type: "string" },
          whyNow: { type: "string" },
          signalToObserve: { type: "string" },
          expectedImpact: { type: "string", enum: ["Baixo", "Médio", "Alto"] },
          effort: { type: "string", enum: ["Baixo", "Médio", "Alto"] },
          estimatedTime: { type: "string" },
          authorityTerritory: { type: "string" },
          businessUnit: { type: "string" },
          persona: { type: "string" },
          relatedModule: { type: "string" },
        },
        required: ["day", "type", "socialSellingAction", "strategicObjective", "scope", "title", "action", "reason", "whyNow", "signalToObserve", "expectedImpact", "effort", "estimatedTime", "authorityTerritory", "businessUnit", "persona", "relatedModule"],
      },
    },
  },
  required: ["title", "summary", "objective", "currentState", "desiredState", "strategicPriorities", "whyNow", "evidence", "risks", "indicators", "actions"],
};
