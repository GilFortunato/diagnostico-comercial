export type HookType =
  | "CONTRADICTION_TENSION"
  | "SPECIFIC_PERSONAL"
  | "INSIGHT_QUESTION";

export type HookVariant = {
  type: HookType;
  text: string;
};

export type HookIntelligence = {
  variants: HookVariant[];
  selectedType: HookType;
  selected: string;
  payoff: string;
};

export type CirculationPotential = {
  level: "Baixo" | "Médio" | "Alto";
  rationale: string;
  disclaimer: "Avaliação editorial qualitativa; não é previsão de alcance ou viralidade.";
};

export type ContentQualityInput = {
  post: string;
  expertReading: string;
  thesis: string;
  hook: HookIntelligence;
  humanContext?: string;
  businessUnitName: string;
  primaryStepps: string[];
};

export type ContentQualityReview = {
  valid: boolean;
  issues: string[];
};

const genericOpenings = [
  "você já parou para pensar",
  "em um mundo cada vez mais",
  "em um cenário em constante transformação",
  "mais do que nunca",
  "excelente conteúdo",
  "concordo totalmente",
  "ótima reflexão",
  "muito relevante",
];

const unsupportedOutcomePatterns = [
  /(?:resultados?|desempenho|retenção|engajamento)\s+(?:melhorou|melhoraram|aumentou|aumentaram|caiu|caíram)/i,
  /(?:testes?|dados?)\s+(?:mostraram|comprovaram|revelaram)/i,
  /a resistência (?:desapareceu|caiu|diminuiu)/i,
  /(?:clientes?|alunos?|participantes?)\s+(?:adoraram|aprovaram|preferiram)/i,
];

export function buildHookVariants(input: { humanContext?: string; thesis: string; territory: string }): HookVariant[] {
  const factualOpening = firstSentence(input.humanContext) || `Há uma escolha pouco discutida em ${input.territory}.`;
  const thesis = trimSentence(input.thesis, 150);
  return [
    { type: "CONTRADICTION_TENSION", text: thesis },
    { type: "SPECIFIC_PERSONAL", text: trimSentence(factualOpening, 150) },
    { type: "INSIGHT_QUESTION", text: `O que muda quando olhamos para ${input.territory} a partir do contexto real?` },
  ];
}

export function reviewAuthorityContent(input: ContentQualityInput): ContentQualityReview {
  const issues: string[] = [];
  const post = input.post.trim();
  const lowerPost = post.toLocaleLowerCase("pt-BR");
  const humanContext = input.humanContext?.toLocaleLowerCase("pt-BR") ?? "";

  if (input.expertReading.trim().length < 24) issues.push("A leitura do especialista está superficial.");
  if (input.thesis.trim().length < 24) issues.push("O conteúdo não possui uma tese específica suficiente.");
  if (!input.primaryStepps.length || input.primaryStepps.length > 2) issues.push("A seleção principal de STEPPS deve conter um ou dois elementos.");
  if (input.hook.variants.length !== 3) issues.push("A inteligência de gancho precisa comparar exatamente três caminhos.");
  if (!input.hook.selected.trim() || !normalize(post).startsWith(normalize(input.hook.selected))) issues.push("O post não começa com o gancho selecionado.");
  if (input.hook.payoff.trim().length < 24 || post.length < input.hook.selected.length + 100) issues.push("O corpo não demonstra entrega suficiente da promessa do gancho.");
  if (genericOpenings.some((opening) => lowerPost.startsWith(opening))) issues.push("A abertura usa uma fórmula genérica ou desgastada.");
  if (/viral score|chance de viralizar|pontos? do algoritmo|coment[aá]rio vale|save vale/i.test(post)) issues.push("O texto cria uma previsão ou peso de algoritmo sem base confiável.");

  for (const pattern of unsupportedOutcomePatterns) {
    const claim = post.match(pattern)?.[0]?.toLocaleLowerCase("pt-BR");
    if (claim && !humanContext.includes(claim)) {
      issues.push("O texto converteu uma interpretação em resultado factual não fornecido.");
      break;
    }
  }

  if (lowerPost.includes(input.businessUnitName.toLocaleLowerCase("pt-BR"))) {
    const mentions = lowerPost.split(input.businessUnitName.toLocaleLowerCase("pt-BR")).length - 1;
    if (mentions > 2) issues.push("A BU ocupa espaço excessivo e corre o risco de virar propaganda.");
  }

  return { valid: issues.length === 0, issues };
}

export function assertAuthorityContentQuality(input: ContentQualityInput) {
  const review = reviewAuthorityContent(input);
  if (!review.valid) throw new Error(`O conteúdo não passou pela revisão estratégica: ${review.issues.join(" ")}`);
}

export function isGenericComment(comment: string) {
  const normalized = normalize(comment);
  return normalized.length < 45 || genericOpenings.some((opening) => normalized === normalize(opening) || normalized.startsWith(`${normalize(opening)}.`));
}

export function buildContentQualityPromptSection() {
  return `
HOOK E QUALITY GATES:
- Gere internamente três ganchos: A) contraste ou tensão; B) específico e pessoal; C) insight ou pergunta específica. Selecione o mais coerente com os fatos.
- Gancho forte é permitido; promessa falsa, clickbait enganoso e curiosidade artificial são proibidos.
- O corpo precisa entregar exatamente a expectativa criada pelo gancho. Se não entregar, reescreva.
- Antes de responder, verifique silenciosamente: por que alguém pararia, continuaria, levaria algo consigo, comentaria, salvaria ou enviaria; se a tese fortalece autoridade; se a BU é contexto e não propaganda; e se o texto parece humano.
- Não use fórmulas por padrão, como listas arbitrárias, conclusão redonda, CTA genérico ou pergunta automática no final.
- Preserve distância factual: fato fornecido pode ser afirmado; interpretação deve aparecer como tese ou hipótese; informação ausente não pode virar memória, case, reação, resultado ou métrica.
- Uma avaliação de circulação só pode ser qualitativa e deve declarar que não prevê alcance nem viralidade.
`;
}

function firstSentence(value?: string) {
  if (!value?.trim()) return "";
  return value.trim().split(/(?<=[.!?])\s+/)[0] ?? "";
}

function trimSentence(value: string, max: number) {
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}.`;
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}
