import { createAuthorityAssessment, type AuthorityAssessment, type AuthorityInput, type ResearchSource } from "@/lib/diagnostics/authority";
import { createStructuredAuthorityThirtyDayPlan, normalizeAuthorityThirtyDayPlan, type AuthorityPlanContext, type AuthorityThirtyDayPlan } from "@/lib/diagnostics/authorityPlan";
import { generateGeminiJson } from "@/lib/ai/geminiClient";
import { ptBrEditorialInstruction, reviewPortugueseCopy, reviewPortugueseList, silentEditorialReviewInstruction } from "@/lib/copy/editorial";

type GeminiAuthorityPayload = {
  overallScore?: number;
  summary?: string;
  strengths?: string[];
  gaps?: string[];
  risks?: string[];
  opportunities?: string[];
  recommendations?: string[];
};

type GeminiAuthorityPlanPayload = Partial<AuthorityThirtyDayPlan>;

export async function createAuthorityAssessmentWithProvider(input: AuthorityInput, extraSources: ResearchSource[] = []): Promise<AuthorityAssessment> {
  const methodology = createAuthorityAssessment(input, extraSources);
  const geminiResult = await generateGeminiJson<GeminiAuthorityPayload>({
    capability: "ai.generateStructuredAssessment",
    prompt: buildPrompt(input),
  });
  const authoritySellingScore = normalizeScore(geminiResult.overallScore, methodology.authoritySellingScore);

  return {
    ...methodology,
    adapter: "gemini",
    overallScore: authoritySellingScore,
    authoritySellingScore,
    summary: reviewPortugueseCopy(geminiResult.summary ?? methodology.summary),
    strengths: reviewPortugueseList(selectList(geminiResult.strengths, methodology.strengths)),
    gaps: reviewPortugueseList(selectList(geminiResult.gaps, methodology.gaps)),
    risks: reviewPortugueseList(selectList(geminiResult.risks, methodology.risks)),
    opportunities: reviewPortugueseList(selectList(geminiResult.opportunities, methodology.opportunities)),
    recommendations: reviewPortugueseList(selectList(geminiResult.recommendations, methodology.recommendations)),
    sources: [
      ...methodology.sources.filter((source) => source.title !== "Avaliação local"),
      {
        title: "Análise estruturada pela inteligência da Share AI",
        confidence: "inference",
        notes: "A análise considerou somente os dados informados ou recuperados pelas fontes autorizadas.",
      },
    ],
  };
}

export async function createAuthorityThirtyDayPlanWithProvider(context: AuthorityPlanContext): Promise<AuthorityThirtyDayPlan> {
  const structure = createStructuredAuthorityThirtyDayPlan(context);
  const generated = await generateGeminiJson<GeminiAuthorityPlanPayload>({
    capability: "ai.generateContentPlan",
    prompt: buildPlanPrompt(context),
  });
  return normalizeAuthorityThirtyDayPlan(generated, structure);
}

function buildPrompt(input: AuthorityInput) {
  return `
Você é um avaliador sênior de autoridade comercial B2B. Avalie o perfil com foco em percepção de cliente, reputação e potencial de gerar conversa comercial.
${ptBrEditorialInstruction}
${silentEditorialReviewInstruction}

Regras:
- Não invente dados externos.
- Não afirme que acessou ou raspou LinkedIn.
- Use apenas as informações abaixo.
- Separe autoridade pessoal permanente de aderência temporária à BU.
- Não use DNA da BU como se fosse informação encontrada no perfil da pessoa.
- Aponte lacunas com critério de especialista, não apenas presença ou ausência de palavras-chave.
- Responda somente JSON válido.

Entrada:
BU: ${input.businessUnitName}
URL de referência: ${input.profileUrl || "não informada"}
Objetivo comercial: ${input.objective}
Headline: ${input.headline}
Sobre: ${input.about}
Temas: ${input.themes}
Provas e resultados: ${input.proofPoints}
Conteúdos recentes: ${input.recentContent}
Interações e networking: ${input.interactionSignals}
DNA da BU: ${JSON.stringify(input.businessUnitContext ?? {}, null, 2)}

Formato:
{
  "overallScore": 0,
  "summary": "",
  "strengths": [],
  "gaps": [],
  "risks": [],
  "opportunities": [],
  "recommendations": []
}
`;
}

function buildPlanPrompt({ assessment, history = [] }: AuthorityPlanContext) {
  const guidance = assessment.input.businessUnitContext ?? {};
  return `
Você é especialista sênior em personal branding, social selling, LinkedIn, autoridade comercial, estratégia de conteúdo, networking e ativação comercial B2B.
Crie um plano estratégico novo de 30 dias. Não reescreva planos existentes e não agrupe a resposta apenas por semanas.
${ptBrEditorialInstruction}
${silentEditorialReviewInstruction}

Regras obrigatórias:
- Use somente os dados do diagnóstico e do contexto abaixo.
- Não invente tendências, cases, resultados, dados externos ou informações do perfil.
- Separe ações PESSOAIS de ações de BUSINESS_UNIT. Marca pessoal não é a mesma coisa que ativação da BU.
- Priorize lacunas reais: prova, posicionamento, conteúdo, networking, aderência à BU e pontes comerciais.
- Se Authority Selling estiver alto e BU Affinity estiver baixo, priorize Bridge Opportunities e ativação da BU.
- Inclua exatamente 30 ações, uma para cada dia de 1 a 30.
- Nem todo dia deve ser publicação; use ações de perfil, autoridade, conteúdo, networking, engajamento, pesquisa, relacionamento, ativação da BU, medição e revisão.
- A Share AI não publica nem envia mensagens. Quando sugerir conteúdo ou abordagem, trate como atividade que a pessoa executará fora da plataforma.
- Responda somente JSON válido, sem markdown.

Diagnóstico atual:
${JSON.stringify({
  assessmentId: assessment.id,
  profile: assessment.input,
  authoritySellingScore: assessment.authoritySellingScore,
  buAffinityScore: assessment.buAffinityScore,
  activationPotentialScore: assessment.activationPotentialScore,
  dimensions: assessment.dimensions.map((dimension) => ({ label: dimension.label, score: dimension.score, rationale: dimension.rationale })),
  gaps: assessment.gaps,
  strengths: assessment.strengths,
  bridgeOpportunities: assessment.bridgeOpportunities,
  personalAuthorityPlan: assessment.personalAuthorityPlan,
  businessUnitActivationPlan: assessment.businessUnitActivationPlan,
  buDna: guidance,
  historicalAssessments: history.slice(0, 5).map((item) => ({ createdAt: item.createdAt, authoritySellingScore: item.authoritySellingScore ?? item.overallScore, buAffinityScore: item.buAffinityScore })),
}, null, 2)}

Formato exigido:
{
  "title": "",
  "summary": "",
  "actions": [
    {
      "day": 1,
      "type": "PROFILE | AUTHORITY | CONTENT | NETWORKING | ENGAGEMENT | RESEARCH | RELATIONSHIP | BU_ACTIVATION | MEASUREMENT | REVIEW",
      "scope": "PERSONAL | BUSINESS_UNIT",
      "title": "",
      "action": "",
      "reason": "",
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

function normalizeScore(score: unknown, fallback: number) {
  if (typeof score !== "number" || Number.isNaN(score)) return fallback;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function selectList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const clean = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return clean.length ? clean.slice(0, 6) : fallback;
}
