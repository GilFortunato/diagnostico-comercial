import { z } from "zod";
import { buildBusinessUnitGuidance } from "@/lib/business-units/dna";
import { reviewPortugueseCopy, reviewPortugueseList } from "@/lib/copy/editorial";

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

export type DataOrigin = "USER_PROFILE_DATA" | "USER_DECLARED_DATA" | "BU_CONTEXT_DATA" | "AI_INFERENCE" | "PUBLIC_RESEARCH";

export type ProfileReviewItem = {
  field: "headline" | "about" | "experiences" | "education" | "skills" | "certifications" | "posts" | "proofPoints" | "interactionSignals";
  label: string;
  value: string;
  origin: DataOrigin;
  sourceLabel: string;
  confidence: ConfidenceLevel;
};

export type ThemeAlignment = {
  theme: string;
  personSignal: "Alta" | "Média" | "Baixa";
  businessUnitSignal: "Alta" | "Média" | "Baixa";
  affinity: number;
  gap: string;
};

export type BridgeOpportunity = {
  id: string;
  title: string;
  description: string;
  personAffinity: number;
  businessUnitAffinity: number;
  personaAffinity: number;
  marketRelevance: number;
  naturality: "Alta" | "Média" | "Baixa";
  advertisingRisk: "Baixo" | "Médio" | "Alto";
  conversationPotential: "Alto" | "Médio" | "Baixo";
  confidence: ConfidenceLevel;
  whyItWorks: {
    personalAuthority: string;
    businessUnitConnection: string;
    personaInterest: string;
    marketMoment: string;
    risk: string;
  };
  nextActions: string[];
};

export type AuthorityAssessment = {
  id: string;
  createdAt: string;
  adapter: "demo-local" | "gemini" | "database";
  input: AuthorityInput;
  overallScore: number;
  authoritySellingScore: number;
  buAffinityScore: number;
  activationPotentialScore: number;
  currentFocus: {
    businessUnitName: string;
    objective: string;
    periodLabel: string;
  };
  summary: string;
  dimensions: AuthorityDimensionScore[];
  profileReview: ProfileReviewItem[];
  themeAlignment: ThemeAlignment[];
  bridgeOpportunities: BridgeOpportunity[];
  strengths: string[];
  gaps: string[];
  risks: string[];
  opportunities: string[];
  recommendations: string[];
  personalAuthorityPlan: {
    cycleLabel: string;
    priority: string;
    progressLabel: string;
    actions: string[];
  };
  businessUnitActivationPlan: {
    title: string;
    objective: string;
    horizon: string;
    actions: Array<{ day: string; focus: string; action: string; module: string }>;
  };
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
  { key: "icp_relevance", label: "Relevância para o ICP", weight: 6, capabilityHints: ["brand.context", "profile.evaluate"] },
  { key: "authority_proof", label: "Provas de autoridade", weight: 6, capabilityHints: ["evidence.extract"] },
  { key: "cases_results", label: "Cases e resultados", weight: 5, capabilityHints: ["evidence.extract"] },
  { key: "published_content", label: "Conteúdo publicado", weight: 5, capabilityHints: ["content.analyze"] },
  { key: "theme_consistency", label: "Consistência temática", weight: 5, capabilityHints: ["content.analyze"] },
  { key: "frequency", label: "Frequência", weight: 4, capabilityHints: ["activity.measure"] },
  { key: "comments_quality", label: "Qualidade dos comentários", weight: 4, capabilityHints: ["activity.evaluate"] },
  { key: "received_interactions", label: "Interações recebidas", weight: 4, capabilityHints: ["activity.evaluate"] },
  { key: "strategic_network", label: "Networking estratégico", weight: 5, capabilityHints: ["network.evaluate"] },
  { key: "relevant_conversations", label: "Presença em conversas relevantes", weight: 5, capabilityHints: ["network.evaluate"] },
  { key: "credibility", label: "Credibilidade percebida", weight: 6, capabilityHints: ["profile.evaluate"] },
  { key: "about_clarity", label: "Clareza do Sobre", weight: 5, capabilityHints: ["text.evaluate"] },
  { key: "headline_clarity", label: "Clareza do headline", weight: 5, capabilityHints: ["text.evaluate"] },
  { key: "cta", label: "Uso de CTA", weight: 4, capabilityHints: ["text.evaluate"] },
  { key: "bu_themes", label: "Associação com temas da BU", weight: 5, capabilityHints: ["brand.context"] },
  { key: "personal_institutional", label: "Equilíbrio entre marca pessoal e institucional", weight: 4, capabilityHints: ["brand.context"] },
  { key: "non_advertising_experience", label: "Experiência sem publicidade constante", weight: 4, capabilityHints: ["content.analyze"] },
  { key: "reference_potential", label: "Potencial de ser lembrado como referência", weight: 4, capabilityHints: ["profile.evaluate"] },
];

const normalize = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const hasAny = (text: string, terms: string[]) =>
  terms.some((term) => text.toLocaleLowerCase("pt-BR").includes(term.toLocaleLowerCase("pt-BR")));

function scoreDimension(dimension: AuthorityDimension, input: AuthorityInput): AuthorityDimensionScore {
  const combined = `${input.headline} ${input.about} ${input.themes} ${input.proofPoints} ${input.recentContent} ${input.interactionSignals}`;
  let score = 42;
  const evidence: string[] = [];

  if (input.headline.length > 50) {
    score += 9;
    evidence.push("Headline traz contexto suficiente para posicionamento inicial.");
  }
  if (input.about.length > 180) {
    score += 10;
    evidence.push("A seção Sobre oferece repertório para avaliar autoridade.");
  }
  if (input.themes.split(",").length >= 3) {
    score += 8;
    evidence.push("Há temas declarados para formar território de autoridade.");
  }
  if (hasAny(input.proofPoints, ["case", "resultado", "%", "cliente", "projeto", "depoimento"])) {
    score += 14;
    evidence.push("Foram informadas provas, cases ou resultados.");
  }
  if (hasAny(input.recentContent, ["post", "artigo", "comentario", "publica", "insight"])) {
    score += 9;
    evidence.push("Há sinais de conteúdo ou participação recente.");
  }
  if (hasAny(input.interactionSignals, ["decisor", "cliente", "diretor", "rh", "ceo", "gestor"])) {
    score += 8;
    evidence.push("As interações citam um público comercialmente relevante.");
  }

  if (["authority_proof", "cases_results"].includes(dimension.key) && input.proofPoints.length < 30) score -= 22;
  if (["published_content", "frequency", "theme_consistency"].includes(dimension.key) && input.recentContent.length < 30) score -= 18;
  if (["comments_quality", "strategic_network", "relevant_conversations"].includes(dimension.key) && input.interactionSignals.length < 30) score -= 16;
  if (dimension.key === "cta" && !hasAny(combined, ["conversa", "contato", "fale", "agenda", "diagnóstico"])) score -= 12;
  if (dimension.key === "icp_relevance" && !hasAny(combined, ["cliente", "empresa", "b2b", "rh", "lider", "gestor", "comercial"])) score -= 10;

  return {
    ...dimension,
    score: normalize(score),
    rationale: buildRationale(dimension.label, normalize(score)),
    evidence: evidence.length ? reviewPortugueseList(evidence) : ["Sem evidência suficiente; a classificação depende de informações fornecidas pelo usuário."],
  };
}

function buildRationale(label: string, score: number) {
  if (score >= 75) return `${label} está forte para gerar confiança comercial.`;
  if (score >= 55) return `${label} existe, mas precisa de mais prova e consistência.`;
  return `${label} ainda não sustenta autoridade comercial de forma clara.`;
}

function uniqueList(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function createAuthorityAssessment(input: AuthorityInput, extraSources: ResearchSource[] = []): AuthorityAssessment {
  const parsed = authorityInputSchema.parse(input);
  const dimensions = authorityDimensions.map((dimension) => scoreDimension(dimension, parsed));
  const weighted = dimensions.reduce((sum, item) => sum + item.score * item.weight, 0);
  const totalWeight = dimensions.reduce((sum, item) => sum + item.weight, 0);
  const authoritySellingScore = normalize(weighted / totalWeight);
  const weak = dimensions.filter((item) => item.score < 55).slice(0, 4);
  const strong = dimensions.filter((item) => item.score >= 72).slice(0, 4);
  const guidance = parsed.businessUnitContext ?? buildBusinessUnitGuidance(parsed.businessUnitId);
  const buAffinityScore = calculateBuAffinity(parsed);
  const activationPotentialScore = calculateActivationPotential(parsed, buAffinityScore);
  const themeAlignment = buildThemeAlignment(parsed);
  const bridgeOpportunities = buildBridgeOpportunities(parsed, themeAlignment);
  const profileReview = buildProfileReview(parsed, extraSources);
  const primaryTerritory = guidance.territories[0] ?? parsed.businessUnitName;
  const primaryProduct = guidance.products[0] ?? parsed.businessUnitName;
  const primaryIcp = guidance.icps[0] ?? "decisores do ICP";
  const opportunities = [
    `Transformar ${primaryProduct} em narrativa de autoridade conectada a ${primaryTerritory}.`,
    `Conectar temas da BU a dores reais de ${primaryIcp}, sem depender de discurso institucional genérico.`,
    "Evidenciar aprendizados de campo, provas e exemplos concretos antes de pedir conversa comercial.",
    guidance.proofPoints.length
      ? `Usar provas disponíveis com fonte: ${guidance.proofPoints.slice(0, 2).join("; ")}.`
      : "Mapear provas institucionais antes de afirmar resultados, clientes ou números.",
  ];
  const recommendations = [
    `Reescrever a headline com três sinais: ${primaryTerritory}, público e impacto comercial.`,
    `Organizar o Sobre conectando problema, visão, experiência, prova e CTA para ${primaryIcp}.`,
    `Publicar uma série consultiva no tom ${guidance.contentTone}, sem transformar a pessoa em outdoor da BU.`,
    `Usar termos estratégicos como ${guidance.recommendedTerms.slice(0, 4).join(", ") || parsed.businessUnitName}.`,
    guidance.forbiddenClaims.length
      ? `Evitar afirmações sem fonte, especialmente: ${guidance.forbiddenClaims[0]}.`
      : "Não criar afirmações, cases ou números sem evidência confirmada.",
  ];

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    adapter: "demo-local",
    input: parsed,
    overallScore: authoritySellingScore,
    authoritySellingScore,
    buAffinityScore,
    activationPotentialScore,
    currentFocus: {
      businessUnitName: parsed.businessUnitName,
      objective: parsed.objective,
      periodLabel: "Ciclo atual",
    },
    summary: reviewPortugueseCopy(
      `O perfil apresenta pontuação ${authoritySellingScore}/100 em autoridade comercial geral. A aderência atual à ${parsed.businessUnitName} é ${buAffinityScore}/100, com potencial de ativação ${activationPotentialScore}/100.`,
    ),
    dimensions,
    profileReview,
    themeAlignment,
    bridgeOpportunities,
    strengths: strong.length ? strong.map((item) => item.label) : ["Há base inicial para posicionamento, mas ela precisa ser evidenciada com mais clareza."],
    gaps: weak.map((item) => item.label),
    risks: [
      "Parecer institucional demais e pouco pessoal se não houver experiência aplicada.",
      "Gerar conteúdo sem prova pode reduzir credibilidade com decisores.",
      "Usar dados externos sem fonte reduz confiança e exige revisão humana.",
    ],
    opportunities: reviewPortugueseList(opportunities),
    recommendations: reviewPortugueseList(recommendations),
    personalAuthorityPlan: {
      cycleLabel: "Ciclo de 30 dias",
      priority: weak[0]?.label ? `Fortalecer ${weak[0].label.toLocaleLowerCase("pt-BR")}.` : "Transformar repertório em provas claras de autoridade.",
      progressLabel: `${strong.length}/${Math.min(8, dimensions.length)} sinais fortes mapeados`,
      actions: [
        "Revisar headline e Sobre sem transformar o perfil em vitrine de todas as BUs.",
        "Selecionar duas experiências reais e transformá-las em provas de autoridade.",
        "Consolidar dois territórios pessoais que possam sustentar conversas comerciais.",
        "Refazer o diagnóstico ao final do ciclo para medir evolução da pessoa.",
      ],
    },
    businessUnitActivationPlan: {
      title: `Sprint ${parsed.businessUnitName}`,
      objective: `Movimentar ${primaryTerritory} com ${primaryIcp} sem parecer publicidade.`,
      horizon: "Sprint semanal",
      actions: [
        { day: "Dia 1", focus: "Inteligência", action: `Pesquisar conversas e dores recentes de ${primaryIcp}.`, module: "Mapa de decisores" },
        { day: "Dia 2", focus: "Conteúdo", action: `Escolher uma ponte e criar uma publicação consultiva sobre ${primaryTerritory}.`, module: "Inteligência de conteúdo" },
        { day: "Dia 3", focus: "Networking", action: "Comentar em três conversas relevantes antes de abordar novos contatos.", module: "Social selling" },
        { day: "Dia 4", focus: "Hunting", action: "Selecionar decisores com maior aderência ao contexto da BU.", module: "Mapa de decisores" },
        { day: "Dia 5", focus: "Rapport", action: "Preparar abordagem individual com base na ponte mais natural.", module: "Rapport" },
      ],
    },
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
            action: `Atualizar Sobre com problema, experiência, prova e CTA: ${guidance.recommendedCtas[0] ?? "convite para conversa"}.`,
            effort: "medium",
            impact: "high",
          },
        ],
      },
      {
        week: 2,
        objective: "Evidenciar repertório",
        actions: [
          {
            action: `Publicar insight sobre uma dor concreta de ${primaryIcp}.`,
            effort: "medium",
            impact: "high",
          },
          {
            action: `Registrar um aprendizado associado a ${primaryProduct}, sem expor dados sensíveis.`,
            effort: "medium",
            impact: "high",
          },
        ],
      },
      {
        week: 3,
        objective: "Entrar nas conversas certas",
        actions: [
          { action: "Comentar em 10 conversas de decisores com contribuição substantiva.", effort: "medium", impact: "medium" },
          { action: "Conectar-se com perfis estratégicos com mensagem personalizada.", effort: "medium", impact: "medium" },
        ],
      },
      {
        week: 4,
        objective: "Consolidar memória e comparação",
        actions: [
          { action: "Refazer diagnóstico e comparar evolução por dimensão.", effort: "low", impact: "high" },
          { action: "Gerar próximas pautas a partir das lacunas remanescentes.", effort: "low", impact: "medium" },
        ],
      },
    ],
    sources: buildSources(parsed, extraSources),
    nextActions: [
      "Refazer diagnóstico",
      "Comparar evolução",
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
      title: "Dados informados pelo usuário",
      confidence: "confirmed",
      notes: "Entradas declaradas no formulário do diagnóstico.",
    },
    {
      title: `Régua da BU ${input.businessUnitName}`,
      confidence: "confirmed",
      notes: "Pontuação ponderada por territórios, ICP, termos recomendados, termos evitados, chamadas para ação e provas da unidade selecionada.",
    },
  ];

  sources.push(...extraSources);

  if (input.profileUrl && !extraSources.some((source) => source.url === input.profileUrl)) {
    sources.push({
      title: "URL pública do LinkedIn informada",
      url: input.profileUrl,
      confidence: "unverified",
      notes: "A URL é usada como referência. O conteúdo precisa vir de conexão autorizada ou informação fornecida pelo usuário.",
    });
  }

  sources.push({
    title: "Avaliação local",
    confidence: "inference",
    notes: "Estimativa usada quando a IA não está configurada ou não retorna uma avaliação válida.",
  });

  return sources;
}

function calculateBuAffinity(input: AuthorityInput) {
  const guidance = input.businessUnitContext ?? buildBusinessUnitGuidance(input.businessUnitId);
  const personText = personEvidenceText(input);
  const priorityTerms = uniqueList([...guidance.territories, ...guidance.products, ...guidance.icps, ...guidance.personas, ...guidance.recommendedTerms]);
  const matches = priorityTerms.filter((term) => includesTerm(personText, term));
  const avoided = guidance.avoidedTerms.filter((term) => includesTerm(personText, term));
  const base = personText.length > 120 ? 28 : 18;
  return normalize(base + Math.min(52, matches.length * 8) - Math.min(24, avoided.length * 8));
}

function calculateActivationPotential(input: AuthorityInput, affinityScore: number) {
  const guidance = input.businessUnitContext ?? buildBusinessUnitGuidance(input.businessUnitId);
  const personText = personEvidenceText(input);
  const broadSignals = ["ia", "tecnologia", "pessoas", "rh", "educação", "talentos", "vendas", "negócio", "liderança", "transformação"];
  const signalCount = broadSignals.filter((term) => includesTerm(personText, term)).length;
  const objectiveMatches = [...guidance.territories, ...guidance.icps, ...guidance.personas].filter((term) => includesTerm(input.objective, term)).length;
  return normalize(Math.max(affinityScore + 8, 34 + signalCount * 7 + objectiveMatches * 6));
}

function buildThemeAlignment(input: AuthorityInput): ThemeAlignment[] {
  const guidance = input.businessUnitContext ?? buildBusinessUnitGuidance(input.businessUnitId);
  const personText = personEvidenceText(input);
  const terms = uniqueList([...guidance.territories, ...guidance.recommendedTerms, ...guidance.products]).slice(0, 7);

  return terms.map((theme) => {
    const hasTheme = includesTerm(personText, theme);
    const hasAdjacent = theme
      .split(/\s+/)
      .filter((part) => part.length > 3)
      .some((part) => includesTerm(personText, part));
    const affinity = hasTheme ? 86 : hasAdjacent ? 58 : 28;
    const personSignal = affinity >= 75 ? "Alta" : affinity >= 45 ? "Média" : "Baixa";
    return {
      theme,
      personSignal,
      businessUnitSignal: "Alta",
      affinity,
      gap:
        personSignal === "Alta"
          ? "Já existe ponte visível entre o perfil e a BU."
          : personSignal === "Média"
            ? "Existe proximidade, mas faltam exemplos e provas."
            : "A BU ainda aparece pouco no repertório visível da pessoa.",
    };
  });
}

function buildBridgeOpportunities(input: AuthorityInput, alignment: ThemeAlignment[]): BridgeOpportunity[] {
  const guidance = input.businessUnitContext ?? buildBusinessUnitGuidance(input.businessUnitId);
  const persona = guidance.personas[0] ?? guidance.icps[0] ?? "decisores da BU";
  const territory = guidance.territories[0] ?? guidance.recommendedTerms[0] ?? input.businessUnitName;
  const candidates = alignment.length ? alignment : [{ theme: territory, affinity: calculateBuAffinity(input) }] as ThemeAlignment[];

  return candidates.slice(0, 5).map((item, index) => {
    const personAffinity = normalize(item.affinity);
    const businessUnitAffinity = index === 0 ? 92 : 84;
    const personaAffinity = normalize(58 + (personAffinity / 4));
    const marketRelevance = normalize(64 + (businessUnitAffinity / 5));
    const advertisingRisk = personAffinity < 45 ? "Médio" : "Baixo";
    return {
      id: `bridge-${index + 1}`,
      title: `${item.theme} + ${persona}`,
      description: `Usar ${item.theme} como conversa consultiva com ${persona}, conectando repertório pessoal e foco comercial da ${input.businessUnitName}.`,
      personAffinity,
      businessUnitAffinity,
      personaAffinity,
      marketRelevance,
      naturality: personAffinity >= 75 ? "Alta" : personAffinity >= 45 ? "Média" : "Baixa",
      advertisingRisk,
      conversationPotential: personAffinity >= 45 ? "Alto" : "Médio",
      confidence: "inference",
      whyItWorks: {
        personalAuthority: personAffinity >= 45 ? "Há sinais no perfil que permitem abrir essa conversa." : "A ponte é possível, mas ainda precisa de provas pessoais antes de ganhar força.",
        businessUnitConnection: `${item.theme} faz parte do contexto comercial da ${input.businessUnitName}.`,
        personaInterest: `${persona} tende a se interessar por implicações práticas, riscos e critérios de decisão nesse tema.`,
        marketMoment: "Use apenas tendências pesquisadas ou fontes autorizadas antes de afirmar movimentos de mercado.",
        risk: advertisingRisk === "Baixo" ? "Baixo risco de parecer propaganda se o conteúdo começar por problema real." : "Evite mencionar solução cedo demais; comece por pergunta, aprendizado ou evidência.",
      },
      nextActions: ["Criar post", "Encontrar decisores", "Pesquisar tendência", "Preparar rapport"],
    };
  });
}

function buildProfileReview(input: AuthorityInput, extraSources: ResearchSource[]): ProfileReviewItem[] {
  const hasPublicResearch = extraSources.some((source) => source.confidence === "likely" || source.confidence === "confirmed");
  const origin: DataOrigin = hasPublicResearch ? "PUBLIC_RESEARCH" : "USER_DECLARED_DATA";
  const sourceLabel = hasPublicResearch ? "LinkedIn público" : "Informado pela pessoa";

  return [
    { field: "headline", label: "Headline", value: input.headline, origin, sourceLabel, confidence: input.headline ? (hasPublicResearch ? "likely" : "confirmed") : "unverified" },
    { field: "about", label: "Sobre", value: input.about, origin, sourceLabel, confidence: input.about ? (hasPublicResearch ? "likely" : "confirmed") : "unverified" },
    { field: "proofPoints", label: "Provas e resultados", value: input.proofPoints, origin, sourceLabel, confidence: input.proofPoints ? (hasPublicResearch ? "likely" : "confirmed") : "unverified" },
    { field: "posts", label: "Conteúdos recentes", value: input.recentContent, origin, sourceLabel, confidence: input.recentContent ? (hasPublicResearch ? "likely" : "confirmed") : "unverified" },
    { field: "interactionSignals", label: "Interações e networking", value: input.interactionSignals, origin, sourceLabel, confidence: input.interactionSignals ? (hasPublicResearch ? "likely" : "confirmed") : "unverified" },
  ];
}

function personEvidenceText(input: AuthorityInput) {
  return `${input.headline} ${input.about} ${input.themes} ${input.proofPoints} ${input.recentContent} ${input.interactionSignals}`.toLocaleLowerCase("pt-BR");
}

function includesTerm(text: string, term: string) {
  return text.toLocaleLowerCase("pt-BR").includes(term.toLocaleLowerCase("pt-BR"));
}

export function compareAuthorityAssessments(items: AuthorityAssessment[]) {
  const sorted = [...items].sort((a, b) => {
    const byDate = a.createdAt.localeCompare(b.createdAt);
    return byDate === 0 ? a.id.localeCompare(b.id) : byDate;
  });
  const first = sorted.at(0);
  const latest = sorted.at(-1);

  if (!first || !latest) {
    return { available: false, delta: 0, message: "Ainda não há diagnósticos suficientes para comparar evolução." };
  }

  return {
    available: sorted.length > 1,
    delta: latest.overallScore - first.overallScore,
    firstScore: first.overallScore,
    latestScore: latest.overallScore,
    message:
      sorted.length > 1
        ? `Evolução de ${latest.overallScore - first.overallScore} pontos desde o primeiro diagnóstico.`
        : "Crie um segundo diagnóstico para comparar evolução.",
  };
}
