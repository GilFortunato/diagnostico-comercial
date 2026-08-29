import { z } from "zod";
import { buildBusinessUnitGuidance } from "@/lib/business-units/dna";

export const confidenceLevels = ["confirmed", "likely", "inference", "unverified"] as const;

export type ConfidenceLevel = (typeof confidenceLevels)[number];

export const authorityInputSchema = z.object({
  businessUnitId: z.string().min(1),
  businessUnitName: z.string().min(1),
  businessUnitContext: z
    .object({
      name: z.string(),
      products: z.array(z.string()),
      icps: z.array(z.string()),
      personas: z.array(z.string()),
      territories: z.array(z.string()),
      recommendedTerms: z.array(z.string()),
      avoidedTerms: z.array(z.string()),
      proofPoints: z.array(z.string()),
      authorityWeightFocus: z.array(z.string()).optional().default([]),
      contentTone: z.string(),
      recommendedCtas: z.array(z.string()),
      forbiddenClaims: z.array(z.string()),
    })
    .optional(),
  profileUrl: z.string().url().optional().or(z.literal("")),
  objective: z.string().min(10),
  headline: z.string().optional().default(""),
  about: z.string().optional().default(""),
  themes: z.string().optional().default(""),
  proofPoints: z.string().optional().default(""),
  recentContent: z.string().optional().default(""),
  interactionSignals: z.string().optional().default(""),
});

export type AuthorityInput = z.infer<typeof authorityInputSchema>;

export type AuthorityDimension = {
  key: string;
  label: string;
  weight: number;
  capabilityHints: string[];
};

export type AuthorityDimensionScore = AuthorityDimension & {
  score: number;
  rationale: string;
  evidence: string[];
};

export type ResearchSource = {
  title: string;
  url?: string;
  confidence: ConfidenceLevel;
  notes: string;
};

export type AuthorityAssessment = {
  id: string;
  createdAt: string;
  adapter: "demo-local" | "gemini" | "database";
  input: AuthorityInput;
  overallScore: number;
  summary: string;
  dimensions: AuthorityDimensionScore[];
  strengths: string[];
  gaps: string[];
  risks: string[];
  opportunities: string[];
  recommendations: string[];
  plan30Days: Array<{
    week: number;
    objective: string;
    actions: Array<{ action: string; effort: "low" | "medium" | "high"; impact: "medium" | "high" }>;
  }>;
  sources: ResearchSource[];
  nextActions: string[];
};

export const authorityDimensions: AuthorityDimension[] = [
  { key: "positioning", label: "Clareza de posicionamento", weight: 7, capabilityHints: ["profile.read", "text.evaluate"] },
  { key: "expertise", label: "Especialidade percebida", weight: 7, capabilityHints: ["text.evaluate", "evidence.extract"] },
  { key: "icp_relevance", label: "Relevancia para o ICP", weight: 6, capabilityHints: ["brand.context", "profile.evaluate"] },
  { key: "authority_proof", label: "Provas de autoridade", weight: 6, capabilityHints: ["evidence.extract"] },
  { key: "cases_results", label: "Cases e resultados", weight: 5, capabilityHints: ["evidence.extract"] },
  { key: "published_content", label: "Conteudo publicado", weight: 5, capabilityHints: ["content.analyze"] },
  { key: "theme_consistency", label: "Consistencia tematica", weight: 5, capabilityHints: ["content.analyze"] },
  { key: "frequency", label: "Frequencia", weight: 4, capabilityHints: ["activity.measure"] },
  { key: "comments_quality", label: "Qualidade dos comentarios", weight: 4, capabilityHints: ["activity.evaluate"] },
  { key: "received_interactions", label: "Interacoes recebidas", weight: 4, capabilityHints: ["activity.evaluate"] },
  { key: "strategic_network", label: "Networking estrategico", weight: 5, capabilityHints: ["network.evaluate"] },
  { key: "relevant_conversations", label: "Presenca em conversas relevantes", weight: 5, capabilityHints: ["network.evaluate"] },
  { key: "credibility", label: "Credibilidade percebida", weight: 6, capabilityHints: ["profile.evaluate"] },
  { key: "about_clarity", label: "Clareza do Sobre", weight: 5, capabilityHints: ["text.evaluate"] },
  { key: "headline_clarity", label: "Clareza do headline", weight: 5, capabilityHints: ["text.evaluate"] },
  { key: "cta", label: "Uso de CTA", weight: 4, capabilityHints: ["text.evaluate"] },
  { key: "bu_themes", label: "Associacao com temas da BU", weight: 5, capabilityHints: ["brand.context"] },
  { key: "personal_institutional", label: "Equilibrio marca pessoal/institucional", weight: 4, capabilityHints: ["brand.context"] },
  { key: "non_advertising_experience", label: "Experiencia sem publicidade constante", weight: 4, capabilityHints: ["content.analyze"] },
  { key: "reference_potential", label: "Potencial de ser lembrado como referencia", weight: 4, capabilityHints: ["profile.evaluate"] },
];

const normalize = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const hasAny = (text: string, terms: string[]) =>
  terms.some((term) => text.toLocaleLowerCase("pt-BR").includes(term.toLocaleLowerCase("pt-BR")));

function scoreDimension(dimension: AuthorityDimension, input: AuthorityInput): AuthorityDimensionScore {
  const guidance = input.businessUnitContext ?? buildBusinessUnitGuidance(input.businessUnitId);
  const combined = `${input.headline} ${input.about} ${input.themes} ${input.proofPoints} ${input.recentContent} ${input.interactionSignals}`;
  const combinedLower = combined.toLocaleLowerCase("pt-BR");
  const priorityTerms = uniqueList([
    ...guidance.territories,
    ...guidance.products,
    ...guidance.icps,
    ...guidance.personas,
    ...guidance.recommendedTerms,
  ]);
  const matchedPriorityTerms = priorityTerms.filter((term) => combinedLower.includes(term.toLocaleLowerCase("pt-BR")));
  const avoidedTerms = guidance.avoidedTerms.filter((term) => combinedLower.includes(term.toLocaleLowerCase("pt-BR")));
  const proofTerms = guidance.proofPoints.filter((term) => combinedLower.includes(term.toLocaleLowerCase("pt-BR")));
  let score = 42;
  const evidence: string[] = [];

  if (input.headline.length > 50) {
    score += 9;
    evidence.push("Headline traz contexto suficiente para posicionamento inicial.");
  }
  if (input.about.length > 180) {
    score += 10;
    evidence.push("Secao Sobre oferece repertorio para avaliar autoridade.");
  }
  if (input.themes.split(",").length >= 3) {
    score += 8;
    evidence.push("Ha temas declarados para formar territorio de autoridade.");
  }
  if (hasAny(input.proofPoints, ["case", "resultado", "%", "cliente", "projeto", "depoimento"])) {
    score += 14;
    evidence.push("Foram informadas provas, cases ou resultados.");
  }
  if (hasAny(input.recentContent, ["post", "artigo", "comentario", "publica", "insight"])) {
    score += 9;
    evidence.push("Ha sinais de conteudo ou participacao recente.");
  }
  if (hasAny(input.interactionSignals, ["decisor", "cliente", "diretor", "rh", "ceo", "gestor"])) {
    score += 8;
    evidence.push("Interacoes citam publico comercialmente relevante.");
  }
  if (matchedPriorityTerms.length) {
    const bonus = Math.min(8, matchedPriorityTerms.length * 2);
    score += bonus;
    evidence.push(`Aderencia a BU: ${matchedPriorityTerms.slice(0, 4).join(", ")}.`);
  }
  if (proofTerms.length) {
    score += 4;
    evidence.push(`Usa provas reconhecidas pela BU: ${proofTerms.slice(0, 2).join(", ")}.`);
  }
  if (avoidedTerms.length) {
    score -= Math.min(24, avoidedTerms.length * 8);
    evidence.push(`Termos desalinhados com a BU: ${avoidedTerms.slice(0, 3).join(", ")}.`);
  }

  if (["authority_proof", "cases_results"].includes(dimension.key) && input.proofPoints.length < 30) score -= 22;
  if (["published_content", "frequency", "theme_consistency"].includes(dimension.key) && input.recentContent.length < 30) score -= 18;
  if (["comments_quality", "strategic_network", "relevant_conversations"].includes(dimension.key) && input.interactionSignals.length < 30) score -= 16;
  if (dimension.key === "cta" && !hasAny(combined, ["conversa", "contato", "fale", "agenda", "diagnostico"])) score -= 12;
  if (dimension.key === "icp_relevance" && !hasAny(combined, ["cliente", "empresa", "b2b", "rh", "lider", "gestor", "comercial"])) score -= 10;
  if (["bu_themes", "icp_relevance", "theme_consistency", "reference_potential"].includes(dimension.key)) {
    score += matchedPriorityTerms.length ? Math.min(14, matchedPriorityTerms.length * 4) : -18;
  }
  if (["personal_institutional", "non_advertising_experience"].includes(dimension.key) && avoidedTerms.length) {
    score -= 10;
  }
  if (["headline_clarity", "about_clarity", "cta"].includes(dimension.key) && guidance.recommendedCtas.length && !hasAny(combined, guidance.recommendedCtas)) {
    score -= 6;
  }

  return {
    ...applyBusinessUnitWeight(dimension, guidance.authorityWeightFocus ?? []),
    score: normalize(score),
    rationale: buildRationale(dimension.label, normalize(score)),
    evidence: evidence.length ? evidence : ["Sem evidencia suficiente; classificacao depende de informacoes fornecidas pelo usuario."],
  };
}

function applyBusinessUnitWeight(dimension: AuthorityDimension, focus: string[]): AuthorityDimension {
  return {
    ...dimension,
    weight: focus.includes(dimension.key) ? dimension.weight + 3 : dimension.weight,
  };
}

function buildRationale(label: string, score: number) {
  if (score >= 75) return `${label} esta forte para gerar confianca comercial.`;
  if (score >= 55) return `${label} existe, mas precisa de mais prova e consistencia.`;
  return `${label} ainda nao sustenta autoridade comercial de forma clara.`;
}

function uniqueList(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function createAuthorityAssessment(input: AuthorityInput, extraSources: ResearchSource[] = []): AuthorityAssessment {
  const parsed = authorityInputSchema.parse(input);
  const dimensions = authorityDimensions.map((dimension) => scoreDimension(dimension, parsed));
  const weighted = dimensions.reduce((sum, item) => sum + item.score * item.weight, 0);
  const totalWeight = dimensions.reduce((sum, item) => sum + item.weight, 0);
  const overallScore = normalize(weighted / totalWeight);
  const weak = dimensions.filter((item) => item.score < 55).slice(0, 4);
  const strong = dimensions.filter((item) => item.score >= 72).slice(0, 4);
  const guidance = parsed.businessUnitContext ?? buildBusinessUnitGuidance(parsed.businessUnitId);
  const primaryTerritory = guidance.territories[0] ?? parsed.businessUnitName;
  const primaryProduct = guidance.products[0] ?? parsed.businessUnitName;
  const primaryIcp = guidance.icps[0] ?? "decisores do ICP";
  const opportunities = [
    `Transformar ${primaryProduct} em narrativa de autoridade conectada a ${primaryTerritory}.`,
    `Conectar temas da BU a dores reais de ${primaryIcp}, sem depender de discurso institucional generico.`,
    "Evidenciar aprendizados de campo, provas e exemplos concretos antes de pedir conversa comercial.",
    guidance.proofPoints.length
      ? `Usar provas disponiveis com fonte: ${guidance.proofPoints.slice(0, 2).join("; ")}.`
      : "Mapear provas institucionais antes de afirmar resultados, clientes ou numeros.",
  ];
  const recommendations = [
    `Reescrever headline com tres sinais: ${primaryTerritory}, publico e impacto comercial.`,
    `Organizar o Sobre conectando problema, visao, experiencia, prova e CTA para ${primaryIcp}.`,
    `Publicar uma serie consultiva no tom ${guidance.contentTone}, sem transformar a pessoa em outdoor da BU.`,
    `Usar termos estrategicos como ${guidance.recommendedTerms.slice(0, 4).join(", ") || parsed.businessUnitName}.`,
    guidance.forbiddenClaims.length
      ? `Evitar claims sem fonte, especialmente: ${guidance.forbiddenClaims[0]}.`
      : "Nao criar claims, cases ou numeros sem evidencia confirmada.",
  ];

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    adapter: "demo-local",
    input: parsed,
    overallScore,
    summary: `O perfil apresenta score ${overallScore}/100 para autoridade comercial em ${parsed.businessUnitName}. A leitura prioriza percepcao de cliente, nao empregabilidade.`,
    dimensions,
    strengths: strong.length ? strong.map((item) => item.label) : ["Ha base inicial para posicionamento, mas ela precisa ser evidenciada com mais clareza."],
    gaps: weak.map((item) => item.label),
    risks: [
      "Parecer institucional demais e pouco pessoal se nao houver experiencia aplicada.",
      "Gerar conteudo sem prova pode reduzir credibilidade com decisores.",
      "Usar dados externos sem fonte reduz confianca e exige revisao humana.",
    ],
    opportunities,
    recommendations,
    plan30Days: [
      {
        week: 1,
        objective: "Reposicionar perfil",
        actions: [
          {
            action: `Ajustar headline para conectar ${primaryTerritory}, ICP e impacto real.`,
            effort: "low",
            impact: "high",
          },
          {
            action: `Atualizar Sobre com problema, experiencia, prova e CTA: ${guidance.recommendedCtas[0] ?? "convite para conversa"}.`,
            effort: "medium",
            impact: "high",
          },
        ],
      },
      {
        week: 2,
        objective: "Evidenciar repertorio",
        actions: [
          {
            action: `Publicar insight sobre uma dor concreta de ${primaryIcp}.`,
            effort: "medium",
            impact: "high",
          },
          {
            action: `Registrar um aprendizado associado a ${primaryProduct}, sem expor dados sensiveis.`,
            effort: "medium",
            impact: "high",
          },
        ],
      },
      {
        week: 3,
        objective: "Entrar nas conversas certas",
        actions: [
          { action: "Comentar em 10 conversas de decisores com contribuicao substantiva.", effort: "medium", impact: "medium" },
          { action: "Conectar-se com perfis estrategicos com mensagem personalizada.", effort: "medium", impact: "medium" },
        ],
      },
      {
        week: 4,
        objective: "Consolidar memoria e comparacao",
        actions: [
          { action: "Refazer diagnostico e comparar evolucao por dimensao.", effort: "low", impact: "high" },
          { action: "Gerar proximas pautas a partir das lacunas remanescentes.", effort: "low", impact: "medium" },
        ],
      },
    ],
    sources: buildSources(parsed, extraSources),
    nextActions: [
      "Refazer diagnostico",
      "Comparar evolucao",
      "Gerar plano de 30 dias",
      "Criar post agora",
      "Melhorar headline",
      "O que devo fazer agora?",
    ],
  };
}

function buildSources(input: AuthorityInput, extraSources: ResearchSource[] = []): ResearchSource[] {
  const sources: ResearchSource[] = [
    {
      title: "Dados informados pelo usuario",
      confidence: "confirmed",
      notes: "Entradas declaradas no formulario do diagnostico.",
    },
    {
      title: `Regua da BU ${input.businessUnitName}`,
      confidence: "confirmed",
      notes: "Score ponderado por territorios, ICP, termos recomendados, termos evitados, CTAs e provas da unidade selecionada.",
    },
  ];

  sources.push(...extraSources);

  if (input.profileUrl && !extraSources.some((source) => source.url === input.profileUrl)) {
    sources.push({
      title: "URL publica do LinkedIn informada",
      url: input.profileUrl,
      confidence: "unverified",
      notes: "A URL e usada como referencia. O conteudo precisa vir de conexao autorizada ou informacao fornecida pelo usuario.",
    });
  }

  sources.push({
    title: "Avaliacao heuristica local",
    confidence: "inference",
    notes: "Fallback usado quando o provider de IA nao esta configurado ou nao retorna uma avaliacao valida.",
  });

  return sources;
}

export function compareAuthorityAssessments(items: AuthorityAssessment[]) {
  const sorted = [...items].sort((a, b) => {
    const byDate = a.createdAt.localeCompare(b.createdAt);
    return byDate === 0 ? a.id.localeCompare(b.id) : byDate;
  });
  const first = sorted.at(0);
  const latest = sorted.at(-1);

  if (!first || !latest) {
    return { available: false, delta: 0, message: "Ainda nao ha diagnosticos suficientes para comparar evolucao." };
  }

  return {
    available: sorted.length > 1,
    delta: latest.overallScore - first.overallScore,
    firstScore: first.overallScore,
    latestScore: latest.overallScore,
    message:
      sorted.length > 1
        ? `Evolucao de ${latest.overallScore - first.overallScore} pontos desde o primeiro diagnostico.`
        : "Crie um segundo diagnostico para comparar evolucao.",
  };
}
