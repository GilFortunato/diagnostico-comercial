import { createHash } from "node:crypto";
import { getBrandContext } from "./brands";
import type { BrandId, Trend } from "./types";
import { scoutAnalysisSchema, type ContentOpportunity, type ScoutAnalysis, type VisualDirection } from "./analysisTypes";

export const EDITORIAL_VERSION = "mkt-v1";
export function evidenceFingerprint(trend: Trend, brandId: BrandId) {
  return createHash("sha256").update(JSON.stringify({
    version: EDITORIAL_VERSION, brand: getBrandContext(brandId),
    signals: trend.signals.map(({ id, title, url, publishedAt, rawMetrics, evidence }) => ({ id, title, url, publishedAt, rawMetrics, evidence })),
  })).digest("hex");
}

const FORMATS = [
  { id: "linkedin", channel: "LinkedIn", format: "Post", goal: "Abrir uma conversa qualificada", shape: ["Contextualizar o sinal e citar a fonte", "Separar o fato da leitura da marca", "Apontar uma decisão prática", "Convidar experiências do público"], why: "Permite discutir uma implicação profissional com contexto e fonte, sem exigir uma produção longa." },
  { id: "carousel", channel: "Instagram", format: "Carrossel", goal: "Explicar o tema de forma salvável", shape: ["Capa com a pergunta central", "O que a fonte realmente informa", "O que ainda não sabemos", "Como avaliar o impacto no cotidiano", "Resumo e fontes"], why: "A sequência separa evidência, limites e aplicação em unidades fáceis de consultar." },
  { id: "reels", channel: "Instagram", format: "Reels", goal: "Despertar interesse com uma explicação breve", shape: ["Pergunta em até três segundos", "Uma evidência com identificação da fonte", "Uma implicação possível", "Convite para ler a fonte completa"], why: "Uma única evidência pode ser apresentada em vídeo curto sem transformar a hipótese em conclusão." },
  { id: "article", channel: "Blog", format: "Artigo", goal: "Dar profundidade e orientar uma decisão", shape: ["Contexto e recorte temporal", "Evidências com links", "Limites da base coletada", "Implicações e alternativas", "Perguntas para investigar"], why: "O espaço maior acomoda ressalvas, fontes e explicações que não cabem em um post curto." },
  { id: "leadership", channel: "LinkedIn", format: "Thought leadership", goal: "Construir um ponto de vista responsável", shape: ["Uma posição formulada como hipótese", "Evidência que motivou a reflexão", "Uma objeção relevante", "Consequências práticas", "Pergunta aberta à comunidade"], why: "Conecta a notícia a uma decisão de liderança, deixando explícito onde começa a interpretação." },
  { id: "newsletter", channel: "E-mail", format: "Newsletter", goal: "Atualizar um público recorrente", shape: ["O sinal desta edição", "Por que acompanhar", "O que observar a seguir", "Links para aprofundar"], why: "Funciona como acompanhamento editorial; não pressupõe que todos os leitores já conheçam o tema." },
  { id: "quick", channel: "LinkedIn", format: "Post rápido", goal: "Compartilhar uma observação verificável", shape: ["Sinal e fonte em uma frase", "Uma pergunta sobre a implicação", "Link de leitura"], why: "É adequado quando há pouca evidência: compartilha o sinal sem inflar a interpretação." },
  { id: "short", channel: "YouTube", format: "Vídeo curto", goal: "Explicar uma dúvida específica", shape: ["Dúvida do público", "Explicação do sinal com fonte", "Limite ou contraponto", "Próxima pergunta a investigar"], why: "Permite uma explicação falada com fonte na descrição e um recorte único." },
] as const;

/** Content Strategist: editorial proposals are hypotheses, never additional evidence. */
export function contentStrategist(trend: Trend, brandId: BrandId): ContentOpportunity[] {
  const brand = getBrandContext(brandId);
  const focus = brand.editorialFocus;
  return FORMATS.map((format) => ({
    id: format.id, channel: format.channel, format: format.format,
    title: format.format + ": " + trend.title,
    angle: trend.brandRelevance.label === "Baixa"
      ? "Antes de associar “" + trend.title + "” à " + brand.name + ", testar se existe ligação concreta com " + focus + ". Se não existir, não entrar no assunto."
      : "Usar “" + trend.title + "” como ponto de partida para discutir " + focus + ", distinguindo o relato da fonte da posição de " + brand.name + ".",
    audience: brand.audience, objective: format.goal,
    hook: "“" + trend.title + "”: o que esse sinal permite perguntar sobre " + focus + "?",
    structure: [...format.shape], cta: "Qual pergunta sobre esse tema merece ser investigada antes de decidir?",
    rationale: format.why,
  }));
}

/** Visual Director: a production brief, independent of stock-image credentials. */
export function visualDirector(trend: Trend, brandId: BrandId): VisualDirection {
  const brand = getBrandContext(brandId);
  const tech = /intelig|\bai\b|\bia\b|tecnolog|automat|openai|chatgpt/i.test(trend.title);
  return {
    concept: "Leitura humana de “" + trend.title + "” pela perspectiva de " + brand.name + ".",
    composition: "Plano principal com uma pessoa observando ou discutindo um material relacionado ao assunto; um segundo elemento contextual discreto. Identificar a peça como ilustração editorial, sem simular o evento relatado.",
    mood: brandId === "ache" ? "Calmo, cuidadoso e documental; evitar dramatização clínica." : "Próximo, sóbrio e curioso; luz natural e contraste moderado.",
    medium: "Fotografia editorial produzida ou ilustração conceitual; não apresentar imagem de banco como registro do fato.",
    palette: ["Verde profundo", "Branco quente", "Verde suave", "Lime apenas em pequenos detalhes"],
    framing: "Enquadramento médio, sujeito fora do centro; permitir recorte sem cortar rosto ou gesto.",
    negativeSpace: "Reservar o terço superior direito para a composição gráfica posterior; manter a imagem limpa.",
    include: ["Contexto reconhecível relacionado a " + trend.title, "Diversidade de pessoas sem estereótipos", "Uma hierarquia visual clara"],
    avoid: [...brand.avoid, "Recriar pessoas ou eventos reais como se fosse fotografia documental", ...(tech ? ["Robôs humanoides", "Cérebros neon", "Código Matrix", "Mãos apertando hologramas"] : ["Metáforas genéricas desconectadas do sinal", "Expressões encenadas de choque"])],
    noText: ["Não gerar letras, headlines ou legendas dentro da imagem", "Não inserir estatísticas ou logotipos", "Aplicar eventual copy depois, no layout"],
    channels: [
      { channel: "LinkedIn", format: "4:5", guidance: "Assunto no centro inferior e respiro superior; copy curta aplicada na edição." },
      { channel: "Instagram carrossel", format: "4:5", guidance: "Manter o mesmo enquadramento e paleta entre lâminas, com espaço para títulos acessíveis." },
      { channel: "Reels / vídeo curto", format: "9:16", guidance: "Sujeito na área central; deixar margens livres para legendas e controles do aplicativo." },
      { channel: "Artigo / newsletter", format: "16:9", guidance: "Composição horizontal com contexto lateral; adicionar texto alternativo descritivo." },
    ],
    searchTerms: [trend.title.slice(0, 100), brandId === "ache" ? "cuidado ciência pessoas" : tech ? "pessoas tecnologia trabalho" : "pessoas cotidiano editorial"],
  };
}

export function createEditorialAnalysis(trend: Trend, brandId: BrandId, now = new Date()): ScoutAnalysis {
  const brand = getBrandContext(brandId);
  return scoutAnalysisSchema.parse({
    id: evidenceFingerprint(trend, brandId), trendId: trend.id, brandId, generatedAt: now.toISOString(), mode: "editorial",
    whatHappened: "O sinal central é “" + trend.title + "”. " + trend.summary + " Registros: " + trend.signals.slice(0, 3).map((signal) => (signal.publisher ?? signal.source) + " publicou ou listou “" + signal.title + "”").join("; ") + ".",
    whyNow: trend.growthExplanation,
    brandInterpretation: trend.brandRelevance.reason + " Leitura editorial para " + brand.audience + " Contexto inicial: " + brand.description,
    risks: [
      "As manchetes e os indicadores são sinais de atenção; ler as fontes antes de fazer afirmações sobre o fato.",
      "A presença em várias fontes não demonstra causalidade nem crescimento por si só.",
      ...(trend.brandRelevance.label === "Baixa" ? ["A afinidade com a marca é baixa; não forçar uma associação apenas para aproveitar o assunto."] : []),
      ...brand.avoid,
    ],
    opportunities: contentStrategist(trend, brandId), visual: visualDirector(trend, brandId),
    evidenceIds: trend.signals.map((signal) => signal.id),
  });
}

export function editorialCopy(trend: Trend, brandId: BrandId, opportunity: ContentOpportunity) {
  const brand = getBrandContext(brandId);
  const evidence = trend.signals.slice(0, 3).map((signal) =>
    "• " + signal.title + " (" + (signal.publisher ?? signal.source) + (signal.publishedAt ? ", " + signal.publishedAt.slice(0, 10) : ", detectado em " + signal.detectedAt.slice(0, 10)) + ").",
  ).join("\n");
  const reading = "Na perspectiva de " + brand.name + ", a pergunta é como esse assunto se conecta a " + brand.description.toLowerCase() + " Essa conexão é uma hipótese editorial, não uma conclusão da fonte.";
  const body = opportunity.id === "carousel"
    ? ["Lâmina 1 — " + opportunity.hook, "Lâmina 2 — O sinal observado\n" + evidence, "Lâmina 3 — A leitura da marca\n" + reading, "Lâmina 4 — O limite\n" + trend.growthExplanation, "Lâmina 5 — Para pensar\n" + opportunity.cta].join("\n\n")
    : ["reels", "short"].includes(opportunity.id)
      ? ["ABERTURA\n" + opportunity.hook, "CONTEXTO NA TELA\n" + evidence, "FALA\n" + reading, "RESSALVA\n" + trend.growthExplanation, "ENCERRAMENTO\n" + opportunity.cta].join("\n\n")
      : [opportunity.hook, "O que foi observado\n" + evidence, "Uma leitura possível\n" + reading, "O que ainda precisa ser validado\n" + trend.growthExplanation, opportunity.cta].join("\n\n");
  return { title: opportunity.title, body, evidenceIds: trend.signals.slice(0, 3).map((signal) => signal.id) };
}
