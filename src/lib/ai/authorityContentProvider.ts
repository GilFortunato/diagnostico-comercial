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
  const geminiApiKey = userGeminiApiKey || process.env.GEMINI_API_KEY;

  if (provider?.key !== "gemini" || !geminiApiKey) return fallback;

  try {
    const generated = await generateWithGemini(assessment, brief, geminiApiKey);
    return normalizeDraft(generated, fallback);
  } catch {
    return fallback;
  }
}

async function generateWithGemini(assessment: AuthorityAssessment, brief: AuthorityContentBrief, apiKey: string) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      generationConfig: { temperature: 0.72, response_mime_type: "application/json" },
      contents: [{ role: "user", parts: [{ text: buildContentPrompt(assessment, brief) }] }],
    }),
  });

  if (!response.ok) throw new Error("Não foi possível criar o conteúdo com a IA.");
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") throw new Error("A IA não retornou conteúdo válido.");
  return JSON.parse(text) as Partial<AuthorityContentDraft>;
}

function buildContentPrompt(assessment: AuthorityAssessment, brief: AuthorityContentBrief) {
  const guidance = assessment.input.businessUnitContext ?? {};
  const bridge = assessment.bridgeOpportunities?.find((item) => item.id === brief.bridgeId) ?? assessment.bridgeOpportunities?.[0];
  const persona = guidance.personas?.[0] ?? guidance.icps?.[0] ?? "decisores do ICP";
  const territory = bridge?.title ?? guidance.territories?.[0] ?? assessment.input.businessUnitName;

  return `
Você é estrategista editorial sênior especializado em Personal Branding, Social Selling, LinkedIn, autoridade comercial B2B e escrita natural em português brasileiro.
Sua tarefa é criar UMA publicação completa para LinkedIn. O texto final deve parecer escrito por uma pessoa real com repertório, e não por um gerador de conteúdo.
${ptBrEditorialInstruction}
${silentEditorialReviewInstruction}

PRINCÍPIOS OBRIGATÓRIOS
- Escreva o POST COMPLETO. Não devolva campos "Gancho", "Corpo" ou "CTA" dentro do texto.
- Não invente experiência pessoal, reunião, cliente, case, número, resultado, notícia ou tendência.
- Se o usuário forneceu contexto humano, ele pode ser incorporado sem aumentar ou alterar os fatos.
- Se não houver contexto humano, NÃO finja que algo aconteceu com a pessoa. Use observação, tese, pergunta específica, contraste ou valor prático.
- Não transforme a BU em propaganda. O conteúdo deve partir de uma questão que interessa à persona e usar a BU apenas como contexto estratégico.
- Não faça pitch comercial precoce.
- Não use clichês como "no mundo cada vez mais", "mais do que nunca", "você já parou para pensar", "em um cenário em constante transformação".
- Evite excesso de emojis, hashtags, bullets e fórmulas de LinkedIn.
- Evite "não é sobre X, é sobre Y" como fórmula automática.
- CTA é opcional. Não termine automaticamente com "E você, o que acha?".
- Não use dados de tendência porque nenhuma fonte de Trend Intelligence foi fornecida nesta chamada. Classifique o timing como evergreen/contextual.
- Use STEPPS como ferramenta de estratégia, não como checklist. Selecione 1 ou 2 pilares principais e, no máximo, 2 secundários.
- STEPPS disponíveis: Social Currency, Triggers, Emotion, Public, Practical Value, Stories.
- O texto deve preservar marca pessoal e construir uma ponte legítima com a BU.
- Revise silenciosamente ortografia, acentuação, concordância, regência, pontuação, fluidez e naturalidade antes de responder.
- Responda SOMENTE JSON válido.

CONTEXTO DA PESSOA
Objetivo comercial: ${assessment.input.objective}
Headline: ${assessment.input.headline}
Sobre: ${assessment.input.about}
Temas declarados: ${assessment.input.themes}
Provas reais disponíveis: ${assessment.input.proofPoints}
Conteúdos recentes disponíveis: ${assessment.input.recentContent}
Sinais de interação disponíveis: ${assessment.input.interactionSignals}
Authority Selling Score: ${assessment.authoritySellingScore}
Aderência à BU: ${assessment.buAffinityScore}
Potencial de ativação: ${assessment.activationPotentialScore}
Lacunas: ${JSON.stringify(assessment.gaps)}
Pontos fortes: ${JSON.stringify(assessment.strengths)}

CONTEXTO DA BU
BU: ${assessment.input.businessUnitName}
DNA: ${JSON.stringify(guidance)}
Persona prioritária: ${persona}
Ponte escolhida: ${JSON.stringify(bridge ?? null)}
Território: ${territory}

BRIEF
Objetivo do conteúdo: ${brief.objective}
Estratégia: ${brief.strategy}
Contexto humano informado pelo usuário: ${brief.humanContext?.trim() || "nenhum"}

FORMATO EXATO
{
  "title": "título interno curto, não precisa aparecer dentro do post",
  "post": "texto completo pronto para revisão, com quebras de linha naturais",
  "objective": "",
  "persona": "",
  "territory": "",
  "bridge": "",
  "timing": "Evergreen | Contextual",
  "primaryStepps": [""],
  "secondaryStepps": [""],
  "whyThisWorks": ["3 a 5 explicações específicas"],
  "naturality": "Alta | Média | Baixa",
  "naturalityRationale": "",
  "trend": null
}
`;
}

function createFallbackDraft(assessment: AuthorityAssessment, brief: AuthorityContentBrief): AuthorityContentDraft {
  const guidance = assessment.input.businessUnitContext ?? {};
  const bridge = assessment.bridgeOpportunities?.find((item) => item.id === brief.bridgeId) ?? assessment.bridgeOpportunities?.[0];
  const persona = guidance.personas?.[0] ?? guidance.icps?.[0] ?? "decisores do ICP";
  const territory = guidance.territories?.[0] ?? assessment.input.businessUnitName;
  const bridgeTitle = bridge?.title ?? `${territory} + ${persona}`;
  const context = brief.humanContext?.trim();
  const opening = context
    ? `${context}\n\nO ponto que mais me interessa nessa situação é o critério por trás da decisão.`
    : `Existe uma pergunta que vale mais do que começar pela solução: qual problema realmente precisa ser resolvido antes de decidir como agir?`;
  const practical = assessment.buAffinityScore < 55
    ? `Quando a marca pessoal ainda tem pouca associação com ${assessment.input.businessUnitName}, tentar acelerar a venda costuma produzir o efeito contrário. Antes da abordagem, faz mais sentido construir repertório público no território de ${territory}: participar de conversas, trazer uma leitura própria e mostrar critérios de decisão.`
    : `Quando já existe repertório visível, o passo seguinte não é falar mais da empresa. É tornar esse repertório útil para ${persona}: explicar critérios, mostrar implicações práticas e participar das conversas em que a decisão está sendo formada.`;
  const close = brief.objective === "Conversa" || brief.objective === "Relacionamento"
    ? `Uma boa conversa comercial começa muito antes da mensagem direta. Começa quando a outra pessoa já consegue reconhecer por que sua visão sobre o problema pode ser útil.`
    : `Autoridade comercial não é frequência de postagem. É a capacidade de ser associado a uma leitura útil quando o problema aparece.`;

  return {
    title: `Ponte editorial: ${bridgeTitle}`,
    post: reviewPortugueseCopy(`${opening}\n\n${practical}\n\n${close}`),
    objective: brief.objective,
    persona,
    territory,
    bridge: bridgeTitle,
    timing: "Evergreen",
    primaryStepps: ["Practical Value"],
    secondaryStepps: brief.humanContext?.trim() ? ["Stories"] : ["Social Currency"],
    whyThisWorks: reviewPortugueseList([
      `Parte de uma questão relevante para ${persona}, e não de uma apresentação institucional da BU.`,
      `Conecta ${territory} à autoridade da pessoa sem transformar o perfil em vitrine de todas as BUs.`,
      "Entrega um critério de decisão aplicável, reforçando valor prático em vez de publicidade.",
      brief.humanContext?.trim() ? "Usa contexto fornecido pela própria pessoa, sem inventar experiências adicionais." : "Não inventa experiência pessoal quando o usuário não forneceu contexto.",
    ]),
    naturality: brief.humanContext?.trim() ? "Alta" : "Média",
    naturalityRationale: brief.humanContext?.trim()
      ? "O texto incorpora contexto real fornecido pelo usuário e evita fórmulas genéricas de LinkedIn."
      : "O texto evita clichês e histórias inventadas, mas pode ganhar mais identidade quando o usuário acrescentar uma experiência ou opinião própria.",
    trend: null,
  };
}

function normalizeDraft(value: Partial<AuthorityContentDraft>, fallback: AuthorityContentDraft): AuthorityContentDraft {
  const stepps = new Set(["Social Currency", "Triggers", "Emotion", "Public", "Practical Value", "Stories"]);
  const primary = Array.isArray(value.primaryStepps) ? value.primaryStepps.filter((item): item is string => typeof item === "string" && stepps.has(item)).slice(0, 2) : fallback.primaryStepps;
  const secondary = Array.isArray(value.secondaryStepps) ? value.secondaryStepps.filter((item): item is string => typeof item === "string" && stepps.has(item)).slice(0, 2) : fallback.secondaryStepps;
  const naturality = value.naturality === "Alta" || value.naturality === "Média" || value.naturality === "Baixa" ? value.naturality : fallback.naturality;

  return {
    title: reviewPortugueseCopy(typeof value.title === "string" && value.title.trim() ? value.title : fallback.title),
    post: reviewPortugueseCopy(typeof value.post === "string" && value.post.trim() ? value.post : fallback.post),
    objective: reviewPortugueseCopy(typeof value.objective === "string" && value.objective.trim() ? value.objective : fallback.objective),
    persona: reviewPortugueseCopy(typeof value.persona === "string" && value.persona.trim() ? value.persona : fallback.persona),
    territory: reviewPortugueseCopy(typeof value.territory === "string" && value.territory.trim() ? value.territory : fallback.territory),
    bridge: reviewPortugueseCopy(typeof value.bridge === "string" && value.bridge.trim() ? value.bridge : fallback.bridge),
    timing: reviewPortugueseCopy(typeof value.timing === "string" && value.timing.trim() ? value.timing : fallback.timing),
    primaryStepps: primary.length ? primary : fallback.primaryStepps,
    secondaryStepps: secondary,
    whyThisWorks: reviewPortugueseList(Array.isArray(value.whyThisWorks) ? value.whyThisWorks.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 5) : fallback.whyThisWorks),
    naturality,
    naturalityRationale: reviewPortugueseCopy(typeof value.naturalityRationale === "string" && value.naturalityRationale.trim() ? value.naturalityRationale : fallback.naturalityRationale),
    trend: null,
  };
}
