import "server-only";
import type { AuthorityAssessment, ConfidenceLevel } from "@/lib/diagnostics/authority";
import { generateGeminiJson } from "@/lib/ai/geminiClient";
import { ptBrEditorialInstruction, reviewPortugueseCopy, reviewPortugueseList, silentEditorialReviewInstruction } from "@/lib/copy/editorial";
import {
  assertAuthorityContentQuality,
  buildContentQualityPromptSection,
  buildHookVariants,
  type CirculationPotential,
  type HookIntelligence,
  type HookType,
} from "@/lib/social-selling/contentQualityGate";
import { buildInterestGraphStrategy, buildLinkedInAlgorithmPromptSection, type InterestGraphStrategy } from "@/lib/social-selling/linkedinAlgorithmStrategy";
import { buildNextBestSocialSellingAction, buildSocialSellingPromptSection, buildStrategicComment, type SocialSellingAction } from "@/lib/social-selling/socialSellingStrategy";

export type AuthorityContentBrief = {
  objective: "Autoridade" | "Conversa" | "Provocação" | "Valor prático" | "Storytelling" | "Relacionamento" | "Ativação da BU";
  bridgeId?: string;
  humanContext?: string;
  strategy: "Recomendada" | "Autoridade" | "Mais pessoal" | "Mais provocativo" | "Mais prático" | "Mais conversacional";
};

export type AuthorityContentDraft = {
  title: string;
  post: string;
  objective: string;
  persona: string;
  territory: string;
  bridge: string;
  timing: string;
  expertReading: string;
  thesis: string;
  expertTips: string[];
  primaryStepps: string[];
  secondaryStepps: string[];
  whyThisWorks: string[];
  naturality: "Alta" | "Média" | "Baixa";
  naturalityRationale: string;
  strategicDecision: {
    action: SocialSellingAction;
    label: string;
    rationale: string;
  };
  hook: HookIntelligence;
  interestGraph: InterestGraphStrategy;
  commentStrategy: {
    where: string;
    suggestion: string;
  };
  circulationPotential: CirculationPotential;
  trend?: { label: string; source?: string; confidence: ConfidenceLevel } | null;
  generationMode: "gemini";
};

export async function createAuthorityContentDraftWithProvider(
  assessment: AuthorityAssessment,
  brief: AuthorityContentBrief,
): Promise<AuthorityContentDraft> {
  const generated = await generateGeminiJson<Partial<AuthorityContentDraft>>({
    capability: "ai.generateContentPlan",
    prompt: buildPrompt(assessment, brief),
    temperature: 0.7,
  });
  return normalizeDraft(generated, assessment, brief);
}

function contextOf(assessment: AuthorityAssessment, brief: AuthorityContentBrief) {
  const guidance = assessment.input.businessUnitContext;
  const bridge = assessment.bridgeOpportunities?.find((item) => item.id === brief.bridgeId) ?? assessment.bridgeOpportunities?.[0];
  return {
    guidance,
    bridge,
    persona: guidance?.personas?.[0] ?? guidance?.icps?.[0] ?? "decisores do ICP",
    territory: guidance?.territories?.[0] ?? assessment.input.businessUnitName,
  };
}

function buildPrompt(assessment: AuthorityAssessment, brief: AuthorityContentBrief) {
  const { guidance, bridge, persona, territory } = contextOf(assessment, brief);
  return `
Você é um conselho editorial sênior composto por especialistas em Personal Branding, Social Selling, LinkedIn, posicionamento B2B, estratégia comercial e escrita humana.
Sua tarefa NÃO é simplesmente reescrever o contexto do usuário. Primeiro interprete, encontre uma ideia intelectualmente relevante e só então escreva.
${ptBrEditorialInstruction}
${silentEditorialReviewInstruction}
${buildLinkedInAlgorithmPromptSection()}
${buildSocialSellingPromptSection()}
${buildContentQualityPromptSection()}

PIPELINE OBRIGATÓRIO — execute silenciosamente nesta ordem:
1. LEITURA DO ESPECIALISTA: identifique o que há de realmente interessante, contraditório, útil ou revelador no contexto da pessoa.
2. TESE: transforme essa leitura em uma ideia central específica que a pessoa possa defender e que acrescente algo além do que ela já escreveu.
3. PONTE: valide se a tese cria conexão legítima entre a marca pessoal, a persona e a BU sem virar propaganda.
4. ESTRATÉGIA: selecione os pilares STEPPS que realmente ajudam; não tente usar todos.
5. ESCRITA: produza o post completo em voz natural, com repertório e especificidade.
6. GANCHO: compare três caminhos, selecione um e confirme qual entrega do corpo paga a promessa criada.
7. CRÍTICA: avalie o próprio texto com as perguntas abaixo e reescreva antes de responder se qualquer resposta importante for negativa.

QUALITY GATE OBRIGATÓRIO:
- O texto trouxe uma ideia nova ou apenas parafraseou o usuário?
- Existe uma tese clara que possa ser resumida em uma frase?
- O texto poderia ser publicado por qualquer profissional sem mudar quase nada? Se sim, REESCREVA.
- A experiência/opinião da pessoa realmente alterou o raciocínio do post?
- Há valor prático, critério, consequência ou insight de especialista?
- O texto evita transformar a BU em propaganda?
- O texto evita clichês reconhecíveis de IA e LinkedIn?
- O conselho final ajuda a pessoa a melhorar o conteúdo, e não apenas elogia o rascunho?

REGRAS FACTUAIS:
- Não invente experiência, reunião, cliente, case, número, resultado, notícia ou tendência.
- Se houver contexto humano, use apenas os fatos informados. Você pode INTERPRETAR o significado deles, mas não ampliar a história.
- Se não houver contexto humano, não finja experiência pessoal: use tese, observação, pergunta específica, contraste ou valor prático.
- Não romantize excesso de trabalho, privação de sono ou sobrecarga. Se isso aparecer no contexto, procure a ideia profissional por trás (por exemplo: ownership, atenção à qualidade, curiosidade, senso crítico) sem glorificar jornadas excessivas.
- A BU é contexto estratégico, nunca identidade artificial da pessoa.
- Não faça pitch comercial precoce.
- Não use "Gancho", "Corpo" ou "CTA" como rótulos dentro do post.
- CTA é opcional; não termine automaticamente com "E você, o que acha?".
- Evite "no mundo cada vez mais", "mais do que nunca", "você já parou para pensar", "em um cenário em constante transformação" e fórmulas equivalentes.
- Evite excesso de hashtags, emojis, bullets e a fórmula "não é sobre X, é sobre Y".
- Não há Trend Intelligence verificada nesta chamada. Não diga que algo está em alta. Use timing Evergreen ou Contextual.
- STEPPS disponíveis: Social Currency, Triggers, Emotion, Public, Practical Value, Stories. Escolha 1-2 principais e no máximo 2 secundários.
- Revise silenciosamente ortografia, acentuação, concordância, regência, pontuação, ritmo, clareza e naturalidade.
- Responda SOMENTE JSON válido.

PESSOA
Objetivo comercial: ${assessment.input.objective}
Headline: ${assessment.input.headline}
Sobre: ${assessment.input.about}
Temas: ${assessment.input.themes}
Provas disponíveis: ${assessment.input.proofPoints}
Conteúdos recentes: ${assessment.input.recentContent}
Interações: ${assessment.input.interactionSignals}
Authority Selling Score: ${assessment.authoritySellingScore}
Aderência à BU: ${assessment.buAffinityScore}
Potencial de ativação: ${assessment.activationPotentialScore}
Lacunas: ${JSON.stringify(assessment.gaps)}
Pontos fortes: ${JSON.stringify(assessment.strengths)}

BU
Nome: ${assessment.input.businessUnitName}
DNA: ${JSON.stringify(guidance ?? {})}
Persona prioritária: ${persona}
Território: ${territory}
Ponte selecionada: ${JSON.stringify(bridge ?? null)}

BRIEF
Objetivo editorial: ${brief.objective}
Estratégia: ${brief.strategy}
Contexto humano fornecido: ${brief.humanContext?.trim() || "nenhum"}

FORMATO EXATO
{
  "title":"título interno curto",
  "expertReading":"2 a 4 frases explicando o que um especialista enxerga de relevante no contexto, sem apenas repeti-lo",
  "thesis":"uma frase com a ideia central defendida pelo post",
  "post":"publicação completa, pronta para a pessoa revisar e copiar para o LinkedIn",
  "objective":"",
  "persona":"",
  "territory":"",
  "bridge":"",
  "timing":"Evergreen ou Contextual",
  "hook": {
    "variants": [
      { "type": "CONTRADICTION_TENSION", "text": "" },
      { "type": "SPECIFIC_PERSONAL", "text": "" },
      { "type": "INSIGHT_QUESTION", "text": "" }
    ],
    "selectedType": "CONTRADICTION_TENSION | SPECIFIC_PERSONAL | INSIGHT_QUESTION",
    "selected": "primeira frase exata do post",
    "payoff": "como o corpo entrega a expectativa do gancho"
  },
  "circulationPotential": {
    "level": "Baixo ou Médio ou Alto",
    "rationale": "leitura qualitativa baseada em especificidade, utilidade, identificação, tensão, história e conversa"
  },
  "primaryStepps":[""],
  "secondaryStepps":[""],
  "whyThisWorks":["3 a 5 razões específicas"],
  "expertTips":["2 a 4 recomendações concretas para tornar o conteúdo ainda mais forte ou mais pessoal"],
  "naturality":"Alta ou Média ou Baixa",
  "naturalityRationale":"",
  "trend":null
}
`;
}

function normalizeDraft(value: Partial<AuthorityContentDraft>, assessment: AuthorityAssessment, brief: AuthorityContentBrief): AuthorityContentDraft {
  const { bridge, persona, territory } = contextOf(assessment, brief);
  const allowed = new Set(["Social Currency", "Triggers", "Emotion", "Public", "Practical Value", "Stories"]);
  const filteredStepps = (input: unknown) => Array.isArray(input)
    ? input.filter((item): item is string => typeof item === "string" && allowed.has(item)).slice(0, 2)
    : [];
  const cleanList = (input: unknown, max: number) => Array.isArray(input)
    ? input.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, max)
    : [];

  const post = requiredString(value.post, "post");
  const expertReading = requiredString(value.expertReading, "leitura do especialista");
  const thesis = requiredString(value.thesis, "tese");
  const expertTips = cleanList(value.expertTips, 4);
  const strategicReasons = cleanList(value.whyThisWorks, 5);

  if (expertTips.length < 2 || strategicReasons.length < 2) {
    throw new Error("O Gemini não entregou profundidade editorial suficiente. Tente gerar novamente.");
  }

  const naturality = value.naturality === "Alta" || value.naturality === "Média" || value.naturality === "Baixa" ? value.naturality : "Média";
  const reviewedPost = reviewPortugueseCopy(post);
  const reviewedThesis = reviewPortugueseCopy(thesis);
  const primaryStepps = filteredStepps(value.primaryStepps);
  const hook = normalizeHook(value.hook, reviewedThesis, brief.humanContext, territory);
  const decision = buildNextBestSocialSellingAction(assessment);
  const interestGraph = buildInterestGraphStrategy({
    personalThemes: assessment.input.themes.split(",").map((item) => item.trim()).filter(Boolean),
    territory,
    persona,
    businessUnit: assessment.input.businessUnitName,
  });
  const comment = buildStrategicComment({ territory, persona, thesis: reviewedThesis });
  const circulationPotential = normalizeCirculationPotential(value.circulationPotential);
  const visibleExpertReading = [
    `Leitura do especialista: ${expertReading}`,
    `Tese recomendada: ${thesis}`,
    ...expertTips.map((tip) => `Dica do especialista: ${tip}`),
    ...strategicReasons,
  ].slice(0, 10);

  const draft: AuthorityContentDraft = {
    title: reviewPortugueseCopy(optionalString(value.title) || `Ponte editorial: ${bridge?.title ?? territory}`),
    post: reviewedPost,
    expertReading: reviewPortugueseCopy(expertReading),
    thesis: reviewedThesis,
    expertTips: reviewPortugueseList(expertTips),
    objective: reviewPortugueseCopy(optionalString(value.objective) || brief.objective),
    persona: reviewPortugueseCopy(optionalString(value.persona) || persona),
    territory: reviewPortugueseCopy(optionalString(value.territory) || territory),
    bridge: reviewPortugueseCopy(optionalString(value.bridge) || bridge?.title || `${territory} + ${persona}`),
    timing: reviewPortugueseCopy(optionalString(value.timing) || "Contextual"),
    primaryStepps,
    secondaryStepps: filteredStepps(value.secondaryStepps),
    whyThisWorks: reviewPortugueseList(visibleExpertReading),
    naturality,
    naturalityRationale: reviewPortugueseCopy(requiredString(value.naturalityRationale, "justificativa de naturalidade")),
    strategicDecision: {
      action: decision.action,
      label: decision.title,
      rationale: decision.reason,
    },
    hook,
    interestGraph,
    commentStrategy: {
      where: comment.where,
      suggestion: comment.comment,
    },
    circulationPotential,
    trend: null,
    generationMode: "gemini",
  };

  assertAuthorityContentQuality({
    post: draft.post,
    expertReading: draft.expertReading,
    thesis: draft.thesis,
    hook: draft.hook,
    humanContext: brief.humanContext,
    businessUnitName: assessment.input.businessUnitName,
    primaryStepps: draft.primaryStepps,
  });

  return draft;
}

function normalizeHook(value: unknown, thesis: string, humanContext: string | undefined, territory: string): HookIntelligence {
  const fallback = buildHookVariants({ humanContext, thesis, territory });
  const candidate = value && typeof value === "object" ? value as Partial<HookIntelligence> : {};
  const allowedTypes = new Set<HookType>(["CONTRADICTION_TENSION", "SPECIFIC_PERSONAL", "INSIGHT_QUESTION"]);
  const variants = Array.isArray(candidate.variants)
    ? candidate.variants
      .filter((item) => item && allowedTypes.has(item.type) && typeof item.text === "string" && item.text.trim().length >= 12)
      .map((item) => ({ type: item.type, text: reviewPortugueseCopy(item.text.trim()) }))
      .slice(0, 3)
    : [];
  const completeVariants = variants.length === 3 ? variants : fallback;
  const selectedType = allowedTypes.has(candidate.selectedType as HookType) ? candidate.selectedType as HookType : completeVariants[0].type;
  return {
    variants: completeVariants,
    selectedType,
    selected: reviewPortugueseCopy(requiredString(candidate.selected, "gancho selecionado")),
    payoff: reviewPortugueseCopy(requiredString(candidate.payoff, "entrega do gancho")),
  };
}

function normalizeCirculationPotential(value: unknown): CirculationPotential {
  const candidate = value && typeof value === "object" ? value as Partial<CirculationPotential> : {};
  const level = candidate.level === "Baixo" || candidate.level === "Médio" || candidate.level === "Alto" ? candidate.level : "Médio";
  return {
    level,
    rationale: reviewPortugueseCopy(requiredString(candidate.rationale, "justificativa do potencial de circulação")),
    disclaimer: "Avaliação editorial qualitativa; não é previsão de alcance ou viralidade.",
  };
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length < 12) {
    throw new Error(`O Gemini não retornou ${field} com qualidade suficiente.`);
  }
  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}
