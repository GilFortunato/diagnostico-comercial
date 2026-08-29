import type { AuthorityAssessment, ConfidenceLevel } from "@/lib/diagnostics/authority";
import { resolveProviderForCapability } from "@/lib/ai/providers";
import { ptBrEditorialInstruction, reviewPortugueseCopy, reviewPortugueseList, silentEditorialReviewInstruction } from "@/lib/copy/editorial";

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
  primaryStepps: string[];
  secondaryStepps: string[];
  whyThisWorks: string[];
  naturality: "Alta" | "Média" | "Baixa";
  naturalityRationale: string;
  trend?: { label: string; source?: string; confidence: ConfidenceLevel } | null;
};

const geminiModel = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";

export async function createAuthorityContentDraftWithProvider(
  assessment: AuthorityAssessment,
  brief: AuthorityContentBrief,
  userGeminiApiKey?: string | null,
): Promise<AuthorityContentDraft> {
  const fallback = createFallbackDraft(assessment, brief);
  const provider = resolveProviderForCapability("ai.generateContentPlan", process.env.DEFAULT_AI_PROVIDER);
  const apiKey = userGeminiApiKey || process.env.GEMINI_API_KEY;
  if (provider?.key !== "gemini" || !apiKey) return fallback;

  try {
    const generated = await callGemini(assessment, brief, apiKey);
    return normalizeDraft(generated, fallback);
  } catch {
    return fallback;
  }
}

async function callGemini(assessment: AuthorityAssessment, brief: AuthorityContentBrief, apiKey: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      generationConfig: { temperature: 0.72, response_mime_type: "application/json" },
      contents: [{ role: "user", parts: [{ text: buildPrompt(assessment, brief) }] }],
    }),
  });
  if (!response.ok) throw new Error("Falha ao gerar conteúdo.");
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") throw new Error("Resposta inválida.");
  return JSON.parse(text) as Partial<AuthorityContentDraft>;
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
Você é estrategista editorial sênior de Personal Branding, Social Selling, LinkedIn e autoridade comercial B2B.
Crie UMA publicação completa para LinkedIn em português brasileiro natural, específica e humana.
${ptBrEditorialInstruction}
${silentEditorialReviewInstruction}

REGRAS
- Entregue o post pronto, sem rótulos "Gancho", "Corpo" ou "CTA" no texto final.
- Não invente experiência, reunião, cliente, case, número, resultado, notícia ou tendência.
- Se houver contexto humano, use somente o que foi informado, sem ampliar fatos.
- Se não houver contexto humano, não finja experiência pessoal: use tese, observação, pergunta específica, contraste ou valor prático.
- A BU é contexto estratégico, não propaganda.
- Evite pitch cedo demais, clichês de LinkedIn, excesso de hashtags, emojis, bullets e a fórmula "não é sobre X, é sobre Y".
- CTA é opcional; não encerre automaticamente com "E você, o que acha?".
- Não há Trend Intelligence verificada nesta chamada. Não afirme que algo está em alta. Use timing evergreen/contextual.
- STEPPS é estratégia: escolha 1-2 pilares principais e no máximo 2 secundários entre Social Currency, Triggers, Emotion, Public, Practical Value e Stories.
- Preserve a marca pessoal e crie uma ponte legítima com a BU.
- Revise silenciosamente português, fluidez, naturalidade e especificidade antes de responder.
- Responda somente JSON válido.

PESSOA
Objetivo: ${assessment.input.objective}
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
Persona: ${persona}
Território: ${territory}
Ponte: ${JSON.stringify(bridge ?? null)}

BRIEF
Objetivo editorial: ${brief.objective}
Estratégia: ${brief.strategy}
Contexto humano: ${brief.humanContext?.trim() || "nenhum"}

JSON
{
  "title":"",
  "post":"",
  "objective":"",
  "persona":"",
  "territory":"",
  "bridge":"",
  "timing":"Evergreen ou Contextual",
  "primaryStepps":[""],
  "secondaryStepps":[""],
  "whyThisWorks":[""],
  "naturality":"Alta ou Média ou Baixa",
  "naturalityRationale":"",
  "trend":null
}
`;
}

function createFallbackDraft(assessment: AuthorityAssessment, brief: AuthorityContentBrief): AuthorityContentDraft {
  const { bridge, persona, territory } = contextOf(assessment, brief);
  const bridgeTitle = bridge?.title ?? `${territory} + ${persona}`;
  const human = brief.humanContext?.trim();
  const opening = human
    ? `${human}\n\nO ponto mais interessante aqui é o critério por trás da decisão.`
    : "Antes de escolher uma solução, existe uma pergunta mais útil: qual problema realmente precisa ser resolvido e qual evidência mostraria que estamos avançando?";
  const middle = assessment.buAffinityScore < 55
    ? `Quando a marca pessoal ainda tem pouca associação com ${assessment.input.businessUnitName}, acelerar a venda tende a soar institucional. Faz mais sentido construir repertório em ${territory}: participar de conversas, explicar critérios e mostrar uma leitura própria antes da abordagem.`
    : `Quando já existe repertório visível, o próximo passo é torná-lo útil para ${persona}: explicar critérios, consequências práticas e decisões que normalmente ficam escondidas atrás de uma solução.`;
  const ending = brief.objective === "Conversa" || brief.objective === "Relacionamento"
    ? "Uma boa conversa comercial costuma começar antes da mensagem direta: começa quando a outra pessoa já reconhece por que sua leitura daquele problema pode ser útil."
    : "Autoridade comercial não é postar mais. É ser lembrado por uma leitura útil quando o problema aparece.";

  return {
    title: `Ponte editorial: ${bridgeTitle}`,
    post: reviewPortugueseCopy(`${opening}\n\n${middle}\n\n${ending}`),
    objective: brief.objective,
    persona,
    territory,
    bridge: bridgeTitle,
    timing: "Evergreen",
    primaryStepps: ["Practical Value"],
    secondaryStepps: human ? ["Stories"] : ["Social Currency"],
    whyThisWorks: reviewPortugueseList([
      `Parte de uma questão relevante para ${persona}, não de uma apresentação da BU.`,
      `Conecta ${territory} à autoridade da pessoa sem transformar o perfil em vitrine institucional.`,
      "Entrega um critério de decisão aplicável em vez de publicidade.",
      human ? "Usa contexto real fornecido pelo usuário sem inventar experiências adicionais." : "Não inventa experiência pessoal quando o usuário não fornece contexto.",
    ]),
    naturality: human ? "Alta" : "Média",
    naturalityRationale: human
      ? "O rascunho incorpora contexto real fornecido pelo usuário e evita fórmulas genéricas."
      : "O rascunho evita histórias inventadas e clichês, mas pode ganhar mais personalidade com uma opinião ou experiência real do usuário.",
    trend: null,
  };
}

function normalizeDraft(value: Partial<AuthorityContentDraft>, fallback: AuthorityContentDraft): AuthorityContentDraft {
  const allowed = new Set(["Social Currency", "Triggers", "Emotion", "Public", "Practical Value", "Stories"]);
  const list = (input: unknown, fallbackValue: string[]) => Array.isArray(input)
    ? input.filter((item): item is string => typeof item === "string" && allowed.has(item)).slice(0, 2)
    : fallbackValue;
  const naturality = value.naturality === "Alta" || value.naturality === "Média" || value.naturality === "Baixa" ? value.naturality : fallback.naturality;
  const why = Array.isArray(value.whyThisWorks)
    ? value.whyThisWorks.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 5)
    : fallback.whyThisWorks;

  return {
    title: reviewPortugueseCopy(valid(value.title, fallback.title)),
    post: reviewPortugueseCopy(valid(value.post, fallback.post)),
    objective: reviewPortugueseCopy(valid(value.objective, fallback.objective)),
    persona: reviewPortugueseCopy(valid(value.persona, fallback.persona)),
    territory: reviewPortugueseCopy(valid(value.territory, fallback.territory)),
    bridge: reviewPortugueseCopy(valid(value.bridge, fallback.bridge)),
    timing: reviewPortugueseCopy(valid(value.timing, fallback.timing)),
    primaryStepps: list(value.primaryStepps, fallback.primaryStepps),
    secondaryStepps: list(value.secondaryStepps, fallback.secondaryStepps),
    whyThisWorks: reviewPortugueseList(why.length ? why : fallback.whyThisWorks),
    naturality,
    naturalityRationale: reviewPortugueseCopy(valid(value.naturalityRationale, fallback.naturalityRationale)),
    trend: null,
  };
}

function valid(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}
