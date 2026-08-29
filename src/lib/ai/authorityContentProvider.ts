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
  expertReading: string;
  thesis: string;
  expertTips: string[];
  primaryStepps: string[];
  secondaryStepps: string[];
  whyThisWorks: string[];
  naturality: "Alta" | "Média" | "Baixa";
  naturalityRationale: string;
  trend?: { label: string; source?: string; confidence: ConfidenceLevel } | null;
  generationMode: "gemini";
};

const geminiModel = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

export async function createAuthorityContentDraftWithProvider(
  assessment: AuthorityAssessment,
  brief: AuthorityContentBrief,
): Promise<AuthorityContentDraft> {
  const provider = resolveProviderForCapability("ai.generateContentPlan", process.env.DEFAULT_AI_PROVIDER);
  const apiKey = process.env.GEMINI_API_KEY;

  if (provider?.key !== "gemini" || !apiKey) {
    throw new Error("A inteligência de conteúdo está indisponível. Conecte o Gemini da plataforma antes de gerar conteúdo.");
  }

  const generated = await callGemini(assessment, brief, apiKey);
  return normalizeDraft(generated, assessment, brief);
}

async function callGemini(assessment: AuthorityAssessment, brief: AuthorityContentBrief, apiKey: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      generationConfig: { temperature: 0.7, response_mime_type: "application/json" },
      contents: [{ role: "user", parts: [{ text: buildPrompt(assessment, brief) }] }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Gemini indisponível (${response.status}). ${body.slice(0, 240)}`.trim());
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") throw new Error("O Gemini não retornou uma análise editorial válida.");
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
Você é um conselho editorial sênior composto por especialistas em Personal Branding, Social Selling, LinkedIn, posicionamento B2B, estratégia comercial e escrita humana.
Sua tarefa NÃO é simplesmente reescrever o contexto do usuário. Primeiro interprete, encontre uma ideia intelectualmente relevante e só então escreva.
${ptBrEditorialInstruction}
${silentEditorialReviewInstruction}

PIPELINE OBRIGATÓRIO — execute silenciosamente nesta ordem:
1. LEITURA DO ESPECIALISTA: identifique o que há de realmente interessante, contraditório, útil ou revelador no contexto da pessoa.
2. TESE: transforme essa leitura em uma ideia central específica que a pessoa possa defender e que acrescente algo além do que ela já escreveu.
3. PONTE: valide se a tese cria conexão legítima entre a marca pessoal, a persona e a BU sem virar propaganda.
4. ESTRATÉGIA: selecione os pilares STEPPS que realmente ajudam; não tente usar todos.
5. ESCRITA: produza o post completo em voz natural, com repertório e especificidade.
6. CRÍTICA: avalie o próprio texto com as perguntas abaixo e reescreva antes de responder se qualquer resposta importante for negativa.

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
  const whyThisWorks = cleanList(value.whyThisWorks, 5);

  if (expertTips.length < 2 || whyThisWorks.length < 2) {
    throw new Error("O Gemini não entregou profundidade editorial suficiente. Tente gerar novamente.");
  }

  const naturality = value.naturality === "Alta" || value.naturality === "Média" || value.naturality === "Baixa" ? value.naturality : "Média";

  return {
    title: reviewPortugueseCopy(optionalString(value.title) || `Ponte editorial: ${bridge?.title ?? territory}`),
    post: reviewPortugueseCopy(post),
    expertReading: reviewPortugueseCopy(expertReading),
    thesis: reviewPortugueseCopy(thesis),
    expertTips: reviewPortugueseList(expertTips),
    objective: reviewPortugueseCopy(optionalString(value.objective) || brief.objective),
    persona: reviewPortugueseCopy(optionalString(value.persona) || persona),
    territory: reviewPortugueseCopy(optionalString(value.territory) || territory),
    bridge: reviewPortugueseCopy(optionalString(value.bridge) || bridge?.title || `${territory} + ${persona}`),
    timing: reviewPortugueseCopy(optionalString(value.timing) || "Contextual"),
    primaryStepps: filteredStepps(value.primaryStepps),
    secondaryStepps: filteredStepps(value.secondaryStepps),
    whyThisWorks: reviewPortugueseList(whyThisWorks),
    naturality,
    naturalityRationale: reviewPortugueseCopy(requiredString(value.naturalityRationale, "justificativa de naturalidade")),
    trend: null,
    generationMode: "gemini",
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
