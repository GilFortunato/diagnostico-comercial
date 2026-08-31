import { z } from "zod";
import { buildBusinessUnitGuidance } from "@/lib/business-units/dna";
import {
  extractMeasurableResults,
  normalizedLinkedInSnapshotSchema,
  type NormalizedLinkedInSnapshot,
} from "@/lib/connectors/linkedinNormalization";
import { reviewPortugueseCopy, reviewPortugueseList } from "@/lib/copy/editorial";

export const confidenceLevels = ["confirmed", "likely", "inference", "unverified"] as const;
export type ConfidenceLevel = (typeof confidenceLevels)[number];
export type EvaluationStatus = "evaluated" | "not_evaluated";

export const authorityInputSchema = z.object({
  businessUnitId: z.string().min(1),
  businessUnitName: z.string().min(1),
  businessUnitContext: z.object({
    name: z.string(), products: z.array(z.string()), icps: z.array(z.string()), personas: z.array(z.string()),
    territories: z.array(z.string()), recommendedTerms: z.array(z.string()), avoidedTerms: z.array(z.string()),
    proofPoints: z.array(z.string()), authorityWeightFocus: z.array(z.string()).optional().default([]), contentTone: z.string(),
    recommendedCtas: z.array(z.string()), forbiddenClaims: z.array(z.string()),
  }).optional(),
  profileUrl: z.string().url().optional().or(z.literal("")),
  objective: z.string().min(10),
  headline: z.string().optional().default(""), about: z.string().optional().default(""), themes: z.string().optional().default(""),
  proofPoints: z.string().optional().default(""), recentContent: z.string().optional().default(""), interactionSignals: z.string().optional().default(""),
  linkedinSnapshot: normalizedLinkedInSnapshotSchema.optional(),
});

export type AuthorityInput = z.infer<typeof authorityInputSchema>;

export type AuthorityDimension = { key: string; label: string; weight: number; capabilityHints: string[] };
export type AuthorityDimensionScore = AuthorityDimension & {
  score: number | null;
  status: EvaluationStatus;
  rationale: string;
  evidence: string[];
};
export type ResearchSource = { title: string; url?: string; confidence: ConfidenceLevel; notes: string };
export type DataOrigin = "USER_PROFILE_DATA" | "USER_DECLARED_DATA" | "BU_CONTEXT_DATA" | "AI_INFERENCE" | "PUBLIC_RESEARCH";
export type ProfileReviewItem = {
  field: "headline" | "about" | "experiences" | "education" | "skills" | "certifications" | "posts" | "proofPoints" | "interactionSignals";
  label: string; value: string; origin: DataOrigin; sourceLabel: string; confidence: ConfidenceLevel; evaluationStatus?: EvaluationStatus;
};
export type ThemeAlignment = { theme: string; personSignal: "Alta" | "Média" | "Baixa"; businessUnitSignal: "Alta" | "Média" | "Baixa"; affinity: number; gap: string };

export type BridgeOpportunity = {
  id: string; title: string; description: string; territory: string; evidence: string[]; persona: string; personaProblem: string;
  legitimacy: string; thesis: string; bestActivation: string; publicityRisk: string; nextAction: string;
  personAffinity: number; businessUnitAffinity: number; personaAffinity: number; marketRelevance: number;
  naturality: "Alta" | "Média" | "Baixa"; advertisingRisk: "Baixo" | "Médio" | "Alto"; conversationPotential: "Alto" | "Médio" | "Baixo";
  confidence: ConfidenceLevel;
  whyItWorks: { personalAuthority: string; businessUnitConnection: string; personaInterest: string; marketMoment: string; risk: string };
  nextActions: string[];
};

export type AuthorityMapItem = {
  territory: string; evidence: string[]; currentStrength: "Alta" | "Média" | "Baixa"; credibility: ConfidenceLevel;
  publicVisibility: "Alta" | "Média" | "Baixa"; potential: "Alto" | "Médio" | "Baixo";
};
export type CommercialExposureItem = {
  evidence: string; classification: "PROVA_COMERCIAL" | "SINAL_AUTORIDADE" | "DETALHE_OPERACIONAL" | "EXPOSICAO_COMPETITIVA";
  clientValue: "Alto" | "Médio" | "Baixo"; competitorExposure: "Alta" | "Média" | "Baixa";
  recommendation: "EXPLORAR" | "REFORMULAR" | "REDUZIR" | "SECUNDARIO"; rationale: string;
};
export type StrategicGap = {
  title: string; diagnosis: string; evidence: string[]; expertReading: string; authorityImpact: string; commercialImpact: string;
  competitiveExposure: string | null; recommendation: string; nextBestAction: string; priority: "Alta" | "Média" | "Baixa";
  confidence: ConfidenceLevel | "not_evaluated";
};
export type AuthorityAgendaItem = { title: string; evidence: string[]; reading: string; implication: string; action: string; impact: string; priority: "Alta" | "Média" | "Baixa"; horizon: string };

export type AuthorityAssessment = {
  id: string; createdAt: string; schemaVersion: 2; adapter: "structured-engine" | "demo-local" | "gemini" | "database"; input: AuthorityInput;
  overallScore: number; authoritySellingScore: number; buAffinityScore: number; activationPotentialScore: number; scoreCoverage: number;
  authorityClassification: string; scoreExplanations: { authority: string; businessUnitAffinity: string; activationPotential: string };
  currentFocus: { businessUnitName: string; objective: string; periodLabel: string };
  summary: string; dimensions: AuthorityDimensionScore[]; profileReview: ProfileReviewItem[]; themeAlignment: ThemeAlignment[];
  authorityMap: AuthorityMapItem[];
  authorityPerception: { builtAuthority: string; perceivedAuthority: string; expressionGap: string; builtLevel: "Alta" | "Média" | "Baixa"; perceivedLevel: "Alta" | "Média" | "Baixa" };
  evidencePortfolio: { measurableResults: string[]; authorityProofs: string[]; relevantExperience: string[]; relevantEducation: string[] };
  commercialExposure: CommercialExposureItem[];
  bridgeOpportunities: BridgeOpportunity[]; strategicGaps: StrategicGap[];
  authorityAgenda: { builtAuthority: AuthorityAgendaItem[]; expressionGaps: AuthorityAgendaItem[]; leverageOpportunities: AuthorityAgendaItem[]; strategicPriorities: AuthorityAgendaItem[] };
  strengths: string[]; gaps: string[]; risks: string[]; opportunities: string[]; recommendations: string[];
  nextBestAction: { action: string; title: string; reason: string; actions: string[] };
  personalAuthorityPlan: { cycleLabel: string; priority: string; progressLabel: string; actions: string[] };
  businessUnitActivationPlan: { title: string; objective: string; horizon: string; actions: Array<{ day: string; focus: string; action: string; module: string }> };
  sources: ResearchSource[]; nextActions: string[];
};

export const authorityDimensions: AuthorityDimension[] = [
  dimension("positioning", "Clareza de posicionamento", 7, "profile.read", "text.evaluate"),
  dimension("expertise", "Especialidade percebida", 7, "text.evaluate", "evidence.extract"),
  dimension("authority_proof", "Provas de autoridade", 6, "evidence.extract"),
  dimension("cases_results", "Cases e resultados", 6, "evidence.extract"),
  dimension("published_content", "Conteúdo publicado", 5, "content.analyze"),
  dimension("theme_consistency", "Consistência temática", 5, "content.analyze"),
  dimension("frequency", "Frequência", 4, "activity.measure"),
  dimension("comments_quality", "Qualidade dos comentários", 4, "activity.evaluate"),
  dimension("received_interactions", "Interações recebidas", 4, "activity.evaluate"),
  dimension("strategic_network", "Networking estratégico", 5, "network.evaluate"),
  dimension("relevant_conversations", "Presença em conversas relevantes", 5, "network.evaluate"),
  dimension("credibility", "Credibilidade percebida", 6, "profile.evaluate"),
  dimension("about_clarity", "Clareza do Sobre", 5, "text.evaluate"),
  dimension("headline_clarity", "Clareza da headline", 5, "text.evaluate"),
  dimension("cta", "Direção de conversa", 3, "text.evaluate"),
  dimension("non_advertising_experience", "Autoridade sem publicidade constante", 4, "content.analyze"),
  dimension("reference_potential", "Potencial de ser lembrado como referência", 5, "profile.evaluate"),
  dimension("trajectory_depth", "Profundidade da trajetória", 5, "evidence.extract"),
  dimension("measurable_results", "Resultados mensuráveis", 5, "evidence.extract"),
  dimension("profile_completeness", "Completude estratégica do perfil", 4, "profile.evaluate"),
];

export function createAuthorityAssessment(input: AuthorityInput, extraSources: ResearchSource[] = []): AuthorityAssessment {
  const parsed = authorityInputSchema.parse(input);
  const dimensions = authorityDimensions.map((item) => evaluateDimension(item, parsed));
  const evaluated = dimensions.filter((item): item is AuthorityDimensionScore & { score: number } => item.status === "evaluated" && item.score !== null);
  const totalWeight = evaluated.reduce((sum, item) => sum + item.weight, 0);
  const authoritySellingScore = totalWeight ? normalize(evaluated.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight) : 0;
  const scoreCoverage = Math.round((evaluated.length / dimensions.length) * 100);
  const strong = evaluated.filter((item) => item.score >= 72).sort((a, b) => b.score - a.score).slice(0, 4);
  const guidance = parsed.businessUnitContext ?? buildBusinessUnitGuidance(parsed.businessUnitId);
  const buAffinityScore = calculateBuAffinity(parsed);
  const activationPotentialScore = calculateActivationPotential(parsed, authoritySellingScore, buAffinityScore);
  const themeAlignment = buildThemeAlignment(parsed);
  const authorityMap = buildAuthorityMap(parsed, themeAlignment, extraSources);
  const evidencePortfolio = buildEvidencePortfolio(parsed);
  const commercialExposure = buildCommercialExposure(parsed, evidencePortfolio);
  const bridgeOpportunities = buildBridgeOpportunities(parsed, themeAlignment, authorityMap);
  const profileReview = buildProfileReview(parsed, extraSources, evidencePortfolio);
  const authorityPerception = buildAuthorityPerception(parsed, evidencePortfolio, authoritySellingScore);
  const strategicGaps = buildStrategicGaps(dimensions, parsed, commercialExposure);
  const authorityAgenda = buildAuthorityAgenda(strong, strategicGaps, bridgeOpportunities, authorityPerception);
  const primaryTerritory = guidance.territories[0] ?? parsed.businessUnitName;
  const primaryIcp = guidance.icps[0] ?? guidance.personas[0] ?? "decisores do ICP";
  const nextBestAction = buildAssessmentNextBestAction(strategicGaps, bridgeOpportunities, parsed);
  const authorityClassification = classifyAuthority(authoritySellingScore, scoreCoverage);

  return {
    id: crypto.randomUUID(), createdAt: new Date().toISOString(), schemaVersion: 2, adapter: "structured-engine", input: parsed,
    overallScore: authoritySellingScore, authoritySellingScore, buAffinityScore, activationPotentialScore, scoreCoverage, authorityClassification,
    scoreExplanations: {
      authority: `Mede a força da autoridade pessoal com base em ${evaluated.length} de ${dimensions.length} dimensões com evidência compatível; não depende da BU.`,
      businessUnitAffinity: `Mede quanto o posicionamento atual conversa com territórios, personas e problemas da ${parsed.businessUnitName}.`,
      activationPotential: "Estima quanto da autoridade já construída pode ser conectada à BU com naturalidade. Não representa ausência de espaço para melhoria.",
    },
    currentFocus: { businessUnitName: parsed.businessUnitName, objective: parsed.objective, periodLabel: "Ciclo atual" },
    summary: reviewPortugueseCopy(`${authorityClassification}. A autoridade pessoal foi avaliada em ${authoritySellingScore}/100, com cobertura de evidências de ${scoreCoverage}%. A aderência atual à ${parsed.businessUnitName} é ${buAffinityScore}/100 e o potencial de ativação é ${activationPotentialScore}/100.`),
    dimensions, profileReview, themeAlignment, authorityMap, authorityPerception, evidencePortfolio, commercialExposure,
    bridgeOpportunities, strategicGaps, authorityAgenda,
    strengths: strong.length ? strong.map((item) => item.label) : ["A trajetória precisa de mais evidências visíveis antes de sustentar uma classificação forte."],
    gaps: strategicGaps.slice(0, 5).map((item) => item.title),
    risks: reviewPortugueseList([
      "Confundir trajetória profissional com prova comercial pode enfraquecer a leitura do buyer.",
      commercialExposure.some((item) => item.classification === "EXPOSICAO_COMPETITIVA") ? "Detalhes operacionais públicos podem revelar mais do método do que o cliente precisa para confiar." : "Conteúdo sem evidência pode reduzir credibilidade com decisores.",
      "Dados ausentes permanecem não avaliados e não devem ser convertidos em conclusões.",
    ]),
    opportunities: reviewPortugueseList(bridgeOpportunities.map((item) => item.description).slice(0, 4)),
    recommendations: reviewPortugueseList(strategicGaps.slice(0, 4).map((item) => item.recommendation)),
    nextBestAction,
    personalAuthorityPlan: {
      cycleLabel: "Plano permanente", priority: nextBestAction.title,
      progressLabel: `${strong.length} sinais fortes · ${dimensions.length - evaluated.length} dimensões não avaliadas`,
      actions: [nextBestAction.reason, ...nextBestAction.actions],
    },
    businessUnitActivationPlan: {
      title: `Sprint ${parsed.businessUnitName}`, objective: `Movimentar ${primaryTerritory} com ${primaryIcp} sem transformar a marca pessoal em propaganda.`, horizon: "Sprint semanal",
      actions: [
        { day: "Dia 1", focus: "Inteligência", action: `Pesquisar conversas e dores recentes de ${primaryIcp}.`, module: "Mapa de decisores" },
        { day: "Dia 2", focus: "Conversa", action: `Contribuir em uma conversa sobre ${primaryTerritory} sem pitch.`, module: "Social Selling" },
        { day: "Dia 3", focus: "Decisão", action: "Publicar somente se houver tese e evidência; caso contrário, priorizar perfil, resposta ou comentário.", module: "Inteligência de conteúdo" },
        { day: "Dia 4", focus: "Relacionamento", action: `Selecionar pessoas com aderência real a ${primaryTerritory}.`, module: "Mapa de decisores" },
        { day: "Dia 5", focus: "Rapport", action: "Construir familiaridade e contexto antes de qualquer abordagem.", module: "Rapport" },
      ],
    },
    sources: buildSources(parsed, extraSources),
    nextActions: ["Refazer diagnóstico", "Comparar evolução", "Gerar plano de 30 dias", "Criar post agora", "Melhorar headline"],
  };
}

function evaluateDimension(item: AuthorityDimension, input: AuthorityInput): AuthorityDimensionScore {
  const snapshot = input.linkedinSnapshot;
  const headline = input.headline.trim(); const about = input.about.trim(); const proofs = input.proofPoints.trim();
  const posts = snapshot?.posts ?? []; const recentContent = input.recentContent.trim(); const interactions = input.interactionSignals.trim();
  const measurableResults = extractMeasurableResults(snapshot);
  const experienceCount = snapshot?.experiences.length ?? (proofs ? 1 : 0);
  const hasPosts = posts.length > 0 || recentContent.length >= 20;
  const hasUserComments = Boolean(snapshot?.userCommentsAvailable) || (!snapshot && interactions.length >= 20);
  const result = (score: number, rationale: string, evidence: string[]) => ({ ...item, score: normalize(score), status: "evaluated" as const, rationale, evidence: cleanEvidence(evidence) });
  const unavailable = (reason: string) => ({ ...item, score: null, status: "not_evaluated" as const, rationale: reason, evidence: [] });

  switch (item.key) {
    case "headline_clarity": return headline ? result(35 + (headline.length >= 45 ? 25 : 10) + (hasAny(headline, ["para", "ajudo", "especialista", "lider", "negócio", "resultado"]) ? 20 : 5), "A headline foi avaliada apenas por clareza, especialidade e impacto percebido.", [headline]) : unavailable("Headline não recuperada.");
    case "positioning": return headline || about ? result(35 + (headline.length > 35 ? 20 : 8) + (about.length > 180 ? 20 : 8), "Posicionamento avaliado pela combinação entre headline e Sobre.", [headline, excerpt(about)]) : unavailable("Headline e Sobre não foram recuperados.");
    case "expertise": return headline || about || input.themes ? result(38 + Math.min(38, splitThemes(input.themes).length * 8) + (experienceCount ? 12 : 0), "Especialidade avaliada por temas explícitos e trajetória compatível.", [headline, input.themes]) : unavailable("Não há temas ou trajetória suficientes.");
    case "about_clarity": return about ? result(35 + (about.length >= 180 ? 25 : 10) + (hasAny(about, ["resultado", "impacto", "ajudo", "experiência", "projeto"]) ? 20 : 5), "O Sobre foi avaliado por clareza, repertório e orientação de valor.", [excerpt(about)]) : unavailable("A seção Sobre não foi recuperada.");
    case "authority_proof": return proofs || experienceCount ? result(40 + Math.min(30, experienceCount * 6) + (measurableResults.length ? 20 : 5), "Provas avaliadas por projetos, liderança, formação, certificações e evidências verificáveis.", [measurableResults[0], excerpt(proofs)]) : unavailable("Não há provas de autoridade compatíveis.");
    case "cases_results": return measurableResults.length ? result(68 + Math.min(22, measurableResults.length * 6), "Resultados mensuráveis foram identificados na trajetória.", measurableResults) : proofs ? result(46, "Há experiência relevante, mas nenhum resultado mensurável foi identificado.", [excerpt(proofs)]) : unavailable("Não há cases ou resultados recuperados.");
    case "measurable_results": return measurableResults.length ? result(72 + Math.min(18, measurableResults.length * 6), "Números e impactos foram extraídos apenas de textos públicos disponíveis.", measurableResults) : unavailable("Nenhum resultado mensurável foi encontrado.");
    case "trajectory_depth": return experienceCount ? result(42 + Math.min(42, experienceCount * 8), "Profundidade avaliada pelas experiências relevantes recuperadas.", (snapshot?.experiences ?? []).slice(0, 3).map((entry) => [entry.role, entry.company].filter(Boolean).join(" · "))) : unavailable("Experiências profissionais não foram recuperadas.");
    case "published_content": return hasPosts ? result(48 + Math.min(36, Math.max(posts.length, recentContent.split("\n\n").length) * 6), "Conteúdo avaliado por existência, substância e relação com territórios de autoridade.", posts.slice(0, 2).map((post) => excerpt(post.text))) : unavailable("Publicações recentes não foram recuperadas.");
    case "theme_consistency": return hasPosts ? result(45 + Math.min(35, recurringThemeCount(posts.map((post) => post.text), input.themes) * 9), "Consistência avaliada pela recorrência temática, sem exigir monotema.", posts.slice(0, 3).map((post) => excerpt(post.text))) : unavailable("Publicações recentes não foram recuperadas.");
    case "frequency": return posts.length ? result(scorePostCadence(posts), "Cadência avaliada pelas datas disponíveis das publicações, sem recomendar postagem diária.", posts.map((post) => post.publishedAt ?? "").filter(Boolean).slice(0, 5)) : unavailable("Datas de publicações não foram recuperadas.");
    case "received_interactions": return posts.length && posts.some((post) => post.reactions !== null || post.comments !== null || post.reposts !== null) ? result(scoreReceivedInteractions(posts), "Interações recebidas foram avaliadas apenas com métricas públicas recuperadas.", [interactions]) : unavailable("Métricas de interação não foram recuperadas.");
    case "comments_quality": return hasUserComments ? result(58 + (interactions.length > 100 ? 12 : 0), "Qualidade avaliada pelas contribuições informadas, não por comentários recebidos nos próprios posts.", [excerpt(interactions)]) : unavailable("Comentários feitos pela pessoa não foram recuperados.");
    case "strategic_network": return hasUserComments ? result(55 + (hasAny(interactions, ["decisor", "cliente", "diretor", "chro", "lider"]) ? 18 : 0), "Networking avaliado pela proximidade com pessoas e conversas relevantes, não por quantidade de conexões.", [excerpt(interactions)]) : unavailable("Relações e interações estratégicas não foram recuperadas.");
    case "relevant_conversations": return hasUserComments ? result(54 + (input.themes && hasAny(interactions, splitThemes(input.themes)) ? 18 : 0), "Presença avaliada pela contribuição em conversas coerentes com os territórios profissionais.", [excerpt(interactions)]) : unavailable("Participação em conversas externas não foi recuperada.");
    case "cta": return about ? result(hasAny(about, ["conversa", "contato", "fale", "mensagem", "agenda"]) ? 76 : 48, "A direção de conversa foi avaliada no Sobre; CTA não é obrigatório em todo conteúdo.", [excerpt(about)]) : unavailable("A seção Sobre não foi recuperada.");
    case "non_advertising_experience": return hasPosts ? result(hasAny(recentContent, ["compre", "contrate", "oferta", "promoção"]) ? 42 : 78, "O conteúdo foi observado quanto ao equilíbrio entre repertório e promoção.", posts.slice(0, 2).map((post) => excerpt(post.text))) : unavailable("Publicações recentes não foram recuperadas.");
    case "credibility": return proofs || experienceCount ? result(48 + Math.min(28, experienceCount * 5) + (measurableResults.length ? 15 : 0), "Credibilidade avaliada por trajetória, provas e resultados compatíveis.", [measurableResults[0], excerpt(proofs)]) : unavailable("Não há trajetória ou prova suficiente.");
    case "reference_potential": return headline || input.themes || hasPosts ? result(42 + (headline ? 12 : 0) + Math.min(24, splitThemes(input.themes).length * 6) + (hasPosts ? 12 : 0), "Potencial avaliado pela clareza e recorrência de territórios reconhecíveis.", [headline, input.themes]) : unavailable("Não há sinais públicos suficientes para avaliar associação temática.");
    case "profile_completeness": {
      const fields = [headline, about, proofs, input.themes, recentContent].filter((value) => value.length >= 12).length;
      return fields ? result(28 + fields * 13, "Completude avaliada pelos campos estratégicos disponíveis, sem premiar volume de texto bruto.", [headline, excerpt(about)]) : unavailable("O perfil não trouxe campos suficientes.");
    }
    default: return unavailable("Não há evidência semanticamente compatível.");
  }
}

function buildAuthorityMap(input: AuthorityInput, alignment: ThemeAlignment[], sources: ResearchSource[]): AuthorityMapItem[] {
  const snapshot = input.linkedinSnapshot;
  const sourceConfidence: ConfidenceLevel = sources.some((source) => source.confidence === "likely") ? "likely" : "confirmed";
  const candidates = clusterThemes([...splitThemes(input.themes), ...alignment.map((item) => item.theme), ...(snapshot?.skills ?? [])]).slice(0, 5);
  return candidates.map((territory) => {
    const evidence = cleanEvidence([
      input.headline.toLocaleLowerCase("pt-BR").includes(keyTerm(territory)) ? input.headline : "",
      ...(snapshot?.experiences.filter((item) => evidenceText(item).includes(keyTerm(territory))).slice(0, 2).map((item) => [item.role, item.company].filter(Boolean).join(" · ")) ?? []),
      ...(snapshot?.posts.filter((post) => post.text.toLocaleLowerCase("pt-BR").includes(keyTerm(territory))).slice(0, 2).map((post) => excerpt(post.text)) ?? []),
    ]);
    const visibilityCount = (snapshot?.posts ?? []).filter((post) => post.text.toLocaleLowerCase("pt-BR").includes(keyTerm(territory))).length + (input.headline.toLocaleLowerCase("pt-BR").includes(keyTerm(territory)) ? 2 : 0);
    const aligned = alignment.find((item) => canonicalTheme(item.theme) === canonicalTheme(territory));
    return { territory, evidence, currentStrength: evidence.length >= 3 ? "Alta" : evidence.length ? "Média" : "Baixa", credibility: evidence.length ? sourceConfidence : "inference", publicVisibility: visibilityCount >= 3 ? "Alta" : visibilityCount ? "Média" : "Baixa", potential: (aligned?.affinity ?? 0) >= 55 ? "Alto" : evidence.length ? "Médio" : "Baixo" };
  });
}

function buildAuthorityPerception(input: AuthorityInput, portfolio: AuthorityAssessment["evidencePortfolio"], score: number): AuthorityAssessment["authorityPerception"] {
  const builtSignals = portfolio.relevantExperience.length + portfolio.authorityProofs.length + portfolio.measurableResults.length;
  const perceivedSignals = [input.headline, input.about, input.recentContent].filter((value) => value.trim().length >= 30).length;
  const builtLevel = levelFromCount(builtSignals, 5, 2); const perceivedLevel = levelFromCount(perceivedSignals, 3, 2);
  return {
    builtAuthority: builtSignals ? `A trajetória reúne ${builtSignals} sinais de experiência, prova ou resultado que sustentam autoridade profissional.` : "Ainda não há evidências suficientes para afirmar autoridade construída.",
    perceivedAuthority: perceivedSignals ? `O perfil torna visíveis ${perceivedSignals} frentes relevantes de posicionamento.` : "O perfil ainda comunica pouca evidência pública de autoridade.",
    expressionGap: builtSignals > perceivedSignals * 2 ? "A trajetória sustenta mais autoridade do que o perfil consegue tornar visível hoje." : score >= 65 ? "A percepção pública está relativamente próxima da autoridade sustentada pela trajetória." : "O principal desafio é transformar repertório em sinais públicos mais claros e comprováveis.",
    builtLevel, perceivedLevel,
  };
}

function buildEvidencePortfolio(input: AuthorityInput): AuthorityAssessment["evidencePortfolio"] {
  const snapshot = input.linkedinSnapshot;
  return {
    measurableResults: extractMeasurableResults(snapshot),
    authorityProofs: cleanEvidence([...(snapshot?.certifications.map((item) => [item.name, item.institution].filter(Boolean).join(" · ")) ?? []), ...(snapshot?.experiences.filter((item) => hasAny(`${item.role} ${item.description}`, ["lider", "professor", "mentor", "fundador", "head", "diretor"])).map((item) => [item.role, item.company].filter(Boolean).join(" · ")) ?? [])]).slice(0, 8),
    relevantExperience: cleanEvidence(snapshot?.experiences.map((item) => [item.role, item.company, item.description ? excerpt(item.description) : ""].filter(Boolean).join(" · ")) ?? (input.proofPoints ? [excerpt(input.proofPoints)] : [])).slice(0, 8),
    relevantEducation: cleanEvidence(snapshot?.education.map((item) => [item.degree, item.field, item.institution].filter(Boolean).join(" · ")) ?? []).slice(0, 6),
  };
}

function buildCommercialExposure(input: AuthorityInput, portfolio: AuthorityAssessment["evidencePortfolio"]): CommercialExposureItem[] {
  const technicalPattern = /\b(api|arquitetura|stack|framework|pipeline|modelo|integração|banco de dados|automação|código|python|javascript|react|aws|azure)\b/i;
  const texts = cleanEvidence([input.about, ...(input.linkedinSnapshot?.experiences.map((item) => item.description ?? "") ?? [])]);
  const results = portfolio.measurableResults.map((evidence) => ({ evidence, classification: "PROVA_COMERCIAL" as const, clientValue: "Alto" as const, competitorExposure: "Baixa" as const, recommendation: "EXPLORAR" as const, rationale: "O resultado ajuda o buyer a entender impacto sem exigir exposição do mecanismo." }));
  const technical = texts.filter((text) => technicalPattern.test(text)).slice(0, 4).map((evidence) => {
    const highExposure = evidence.length > 260 || (evidence.match(technicalPattern) ?? []).length > 2;
    return { evidence: excerpt(evidence), classification: highExposure ? "EXPOSICAO_COMPETITIVA" as const : "DETALHE_OPERACIONAL" as const, clientValue: hasAny(evidence, ["resultado", "redu", "aument", "econom", "impacto"]) ? "Alto" as const : "Baixo" as const, competitorExposure: highExposure ? "Alta" as const : "Média" as const, recommendation: highExposure ? "REFORMULAR" as const : "SECUNDARIO" as const, rationale: highExposure ? "Demonstre problema, decisão e impacto sem publicar toda a arquitetura ou o método." : "Mantenha o detalhe técnico apenas quando ele ajudar o buyer a tomar uma decisão." };
  });
  return [...results, ...technical].slice(0, 8);
}

function buildStrategicGaps(dimensions: AuthorityDimensionScore[], input: AuthorityInput, exposure: CommercialExposureItem[]): StrategicGap[] {
  const candidates = dimensions.filter((item) => item.status === "not_evaluated" || (item.score ?? 100) < 58).slice(0, 6);
  const gaps = candidates.map((item, index): StrategicGap => {
    const notEvaluated = item.status === "not_evaluated";
    return {
      title: item.label, diagnosis: notEvaluated ? `A dimensão ${item.label.toLocaleLowerCase("pt-BR")} não pôde ser avaliada.` : item.rationale,
      evidence: item.evidence, expertReading: notEvaluated ? "Ausência de dado não é fraqueza. É um limite metodológico que orienta a próxima coleta." : `A dimensão reduz a clareza com que a autoridade é percebida no momento atual.`,
      authorityImpact: notEvaluated ? "Sem evidência, não é possível afirmar força ou fragilidade." : "A percepção de autoridade perde consistência neste ponto.",
      commercialImpact: item.key.includes("headline") || item.key === "positioning" ? "O buyer pode não entender rapidamente por que iniciar uma conversa." : "O buyer encontra menos sinais para confiar e avançar.",
      competitiveExposure: index === 0 && exposure.some((entry) => entry.classification === "EXPOSICAO_COMPETITIVA") ? "Há detalhe operacional que pode ser reformulado para proteger o método." : null,
      recommendation: recommendationForDimension(item.key, input), nextBestAction: actionForDimension(item.key), priority: index < 2 ? "Alta" : index < 4 ? "Média" : "Baixa",
      confidence: notEvaluated ? "not_evaluated" : "inference",
    };
  });
  return gaps;
}

function buildAuthorityAgenda(strong: AuthorityDimensionScore[], gaps: StrategicGap[], bridges: BridgeOpportunity[], perception: AuthorityAssessment["authorityPerception"]): AuthorityAssessment["authorityAgenda"] {
  const agenda = (title: string, evidence: string[], reading: string, action: string, priority: "Alta" | "Média" | "Baixa", horizon: string): AuthorityAgendaItem => ({ title, evidence, reading, implication: reading, action, impact: priority === "Alta" ? "Melhora clareza e confiança comercial." : "Amplia consistência de posicionamento.", priority, horizon });
  return {
    builtAuthority: strong.slice(0, 3).map((item) => agenda(item.label, item.evidence, item.rationale, "Preservar e tornar esta evidência mais visível.", "Média", "Contínuo")),
    expressionGaps: gaps.slice(0, 3).map((item) => agenda(item.title, item.evidence, item.expertReading, item.recommendation, item.priority, item.priority === "Alta" ? "7 dias" : "30 dias")),
    leverageOpportunities: bridges.slice(0, 3).map((item) => agenda(item.title, item.evidence, item.legitimacy, item.nextAction, "Média", "30 dias")),
    strategicPriorities: [agenda("Autoridade construída × percebida", [], perception.expressionGap, gaps[0]?.recommendation ?? "Consolidar evidências no perfil.", "Alta", "Primeiro ciclo")],
  };
}

function buildBridgeOpportunities(input: AuthorityInput, alignment: ThemeAlignment[], authorityMap: AuthorityMapItem[]): BridgeOpportunity[] {
  const guidance = input.businessUnitContext ?? buildBusinessUnitGuidance(input.businessUnitId);
  const personas = unique([...guidance.personas, ...guidance.icps]).length ? unique([...guidance.personas, ...guidance.icps]) : ["decisores da BU"];
  const candidates = clusterThemes(alignment.map((item) => item.theme)).slice(0, 5);
  const actions = ["Comentar em uma conversa relevante", "Construir rapport", "Pesquisar decisores", "Melhorar o perfil", "Publicar uma tese apoiada em evidência"];
  return candidates.map((territory, index) => {
    const alignmentItem = alignment.find((item) => canonicalTheme(item.theme) === canonicalTheme(territory));
    const mapItem = authorityMap.find((item) => canonicalTheme(item.territory) === canonicalTheme(territory));
    const personAffinity = alignmentItem?.affinity ?? 28; const persona = personas[index % personas.length]; const naturality = personAffinity >= 75 ? "Alta" : personAffinity >= 45 ? "Média" : "Baixa";
    const nextAction = naturality === "Baixa" ? "Melhorar o perfil antes de ampliar exposição" : actions[index % actions.length];
    return {
      id: `bridge-${index + 1}`, title: `${territory} para ${persona}`,
      description: `Território de conversa que aproxima a autoridade pessoal em ${territory} das prioridades de ${persona}, sem transformar o perfil em publicidade da BU.`,
      territory, evidence: mapItem?.evidence ?? [], persona,
      personaProblem: `Decidir como avançar em ${territory} com critério, impacto e aderência ao negócio.`,
      legitimacy: mapItem?.evidence.length ? "A trajetória oferece sinais que tornam esta conversa legítima." : "A conexão é adjacente e precisa de prova antes de ganhar exposição.",
      thesis: `A conversa sobre ${territory} ganha valor quando começa pelo problema e pela decisão, não pela solução da BU.`, bestActivation: nextAction,
      publicityRisk: naturality === "Baixa" ? "Evitar associação promocional antes de construir evidência pessoal." : "Manter a BU como contexto e a marca pessoal como origem da conversa.", nextAction,
      personAffinity, businessUnitAffinity: 88, personaAffinity: naturality === "Alta" ? 82 : 64, marketRelevance: 72,
      naturality, advertisingRisk: naturality === "Baixa" ? "Alto" : naturality === "Média" ? "Médio" : "Baixo", conversationPotential: naturality === "Baixa" ? "Médio" : "Alto", confidence: mapItem?.evidence.length ? mapItem.credibility : "inference",
      whyItWorks: { personalAuthority: mapItem?.evidence.length ? mapItem.evidence[0] : "Ainda faltam provas pessoais visíveis.", businessUnitConnection: `${territory} integra o contexto estratégico da ${input.businessUnitName}.`, personaInterest: `${persona} precisa conectar esse tema a decisões e impacto.`, marketMoment: "A ativação deve usar apenas sinais de mercado com fonte.", risk: naturality === "Baixa" ? "Não abordar ainda." : "Evitar pitch disfarçado." },
      nextActions: unique([nextAction, "Observar respostas e conversas", naturality === "Baixa" ? "Não abordar ainda" : "Preparar rapport"]),
    };
  });
}

function buildProfileReview(input: AuthorityInput, sources: ResearchSource[], portfolio: AuthorityAssessment["evidencePortfolio"]): ProfileReviewItem[] {
  const publicData = sources.some((source) => source.confidence === "likely"); const origin: DataOrigin = publicData ? "PUBLIC_RESEARCH" : "USER_DECLARED_DATA"; const sourceLabel = publicData ? "LinkedIn público" : "Informado pela pessoa";
  const snapshot = input.linkedinSnapshot;
  const item = (field: ProfileReviewItem["field"], label: string, value: string): ProfileReviewItem => ({ field, label, value, origin, sourceLabel, confidence: value ? (publicData ? "likely" : "confirmed") : "unverified", evaluationStatus: value ? "evaluated" : "not_evaluated" });
  return [
    item("headline", "Headline", input.headline), item("about", "Sobre", excerpt(input.about, 420)),
    item("experiences", "Experiências relevantes", portfolio.relevantExperience.join("\n")), item("education", "Formação relevante", portfolio.relevantEducation.join("\n")),
    item("skills", "Competências", (snapshot?.skills ?? splitThemes(input.themes)).join(", ")), item("certifications", "Certificações", (snapshot?.certifications.map((entry) => [entry.name, entry.institution].filter(Boolean).join(" · ")) ?? []).join("\n")),
    item("proofPoints", "Provas e resultados", [...portfolio.measurableResults, ...portfolio.authorityProofs].join("\n")), item("posts", "Conteúdos recentes", snapshot?.posts.map((post) => excerpt(post.text)).join("\n") ?? excerpt(input.recentContent, 500)),
    item("interactionSignals", "Interações recebidas", input.interactionSignals),
  ];
}

function buildThemeAlignment(input: AuthorityInput): ThemeAlignment[] {
  const guidance = input.businessUnitContext ?? buildBusinessUnitGuidance(input.businessUnitId); const text = personEvidenceText(input);
  return clusterThemes([...guidance.territories, ...guidance.recommendedTerms, ...guidance.products]).slice(0, 7).map((theme) => {
    const exact = includesTerm(text, theme); const adjacent = theme.split(/\s+/).filter((part) => part.length > 3).some((part) => includesTerm(text, part));
    const affinity = exact ? 86 : adjacent ? 58 : 24; const personSignal = affinity >= 75 ? "Alta" : affinity >= 45 ? "Média" : "Baixa";
    return { theme, personSignal, businessUnitSignal: "Alta", affinity, gap: personSignal === "Alta" ? "A ponte já é visível." : personSignal === "Média" ? "Existe proximidade, mas faltam exemplos e provas." : "O tema ainda aparece pouco no repertório visível." };
  });
}

function calculateBuAffinity(input: AuthorityInput) {
  const guidance = input.businessUnitContext ?? buildBusinessUnitGuidance(input.businessUnitId); const text = personEvidenceText(input);
  if (text.trim().length < 30) return 0;
  const terms = unique([...guidance.territories, ...guidance.products, ...guidance.icps, ...guidance.personas, ...guidance.recommendedTerms]).filter((item) => item.length > 2);
  if (!terms.length) return 0;
  const matches = terms.filter((term) => includesTerm(text, term)); const avoided = guidance.avoidedTerms.filter((term) => includesTerm(text, term));
  return Math.min(92, normalize(15 + (matches.length / Math.min(10, terms.length)) * 72 - Math.min(18, avoided.length * 6)));
}

function calculateActivationPotential(input: AuthorityInput, authority: number, affinity: number) {
  if (!personEvidenceText(input).trim()) return 0;
  const bridgeSignals = input.linkedinSnapshot?.experiences.length ?? (input.proofPoints ? 1 : 0);
  return Math.min(92, normalize(authority * 0.45 + Math.max(affinity, 25) * 0.35 + Math.min(20, bridgeSignals * 4)));
}

function buildAssessmentNextBestAction(gaps: StrategicGap[], bridges: BridgeOpportunity[], input: AuthorityInput) {
  const first = gaps.find((gap) => gap.priority === "Alta");
  if (first) return { action: first.nextBestAction, title: first.nextBestAction, reason: first.expertReading, actions: [first.recommendation, `Observe o efeito no objetivo: ${input.objective}`] };
  const bridge = bridges[0];
  return bridge ? { action: bridge.nextAction, title: bridge.nextAction, reason: bridge.legitimacy, actions: bridge.nextActions } : { action: "ANALYSIS", title: "Revisar evidências", reason: "O próximo movimento depende de ampliar a base factual.", actions: ["Atualizar o perfil e refazer o diagnóstico."] };
}

function buildSources(input: AuthorityInput, extra: ResearchSource[]) {
  const sources: ResearchSource[] = [{ title: "Dados informados pela pessoa", confidence: "confirmed", notes: "Informações declaradas no diagnóstico." }, { title: `Contexto estratégico da Business Unit ${input.businessUnitName}`, confidence: "confirmed", notes: "Territórios, personas, ICP e regras editoriais da unidade selecionada." }, ...extra];
  if (input.profileUrl && !extra.some((source) => source.url === input.profileUrl)) sources.push({ title: "URL pública do LinkedIn informada", url: input.profileUrl, confidence: "unverified", notes: "A URL, isoladamente, não confirma o conteúdo do perfil." });
  sources.push({ title: "Metodologia Share AI", confidence: "inference", notes: "Leitura estratégica baseada somente nas evidências disponíveis no snapshot." });
  return sources;
}

export function compareAuthorityAssessments(items: AuthorityAssessment[]) {
  const sorted = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)); const first = sorted.at(0); const latest = sorted.at(-1);
  if (!first || !latest) return { available: false, delta: 0, message: "Ainda não há diagnósticos suficientes para comparar evolução." };
  const delta = latest.overallScore - first.overallScore;
  return { available: sorted.length > 1, delta, firstScore: first.overallScore, latestScore: latest.overallScore, message: sorted.length > 1 ? `Evolução de ${delta} pontos desde o primeiro diagnóstico.` : "Crie um segundo diagnóstico para comparar evolução." };
}

function dimension(key: string, label: string, weight: number, ...capabilityHints: string[]): AuthorityDimension { return { key, label, weight, capabilityHints }; }
function normalize(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }
function hasAny(text: string, terms: string[]) { const value = text.toLocaleLowerCase("pt-BR"); return terms.some((term) => term && value.includes(term.toLocaleLowerCase("pt-BR"))); }
function includesTerm(text: string, term: string) { return text.toLocaleLowerCase("pt-BR").includes(term.toLocaleLowerCase("pt-BR")); }
function personEvidenceText(input: AuthorityInput) { return `${input.headline} ${input.about} ${input.themes} ${input.proofPoints} ${input.recentContent} ${input.interactionSignals}`.toLocaleLowerCase("pt-BR"); }
function excerpt(value: string, max = 220) { const text = value.replace(/\s+/g, " ").trim(); return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text; }
function cleanEvidence(values: Array<string | null | undefined>) { return unique(values.map((value) => typeof value === "string" ? excerpt(value) : "").filter(Boolean)); }
function splitThemes(value: string) { return unique(value.split(/[,;|\n]/).map((item) => item.trim()).filter((item) => item.length >= 3)); }
function unique<T>(values: T[]) { return [...new Set(values)]; }
function evidenceText(item: { role: string; company: string; description: string | null }) { return `${item.role} ${item.company} ${item.description ?? ""}`.toLocaleLowerCase("pt-BR"); }
function keyTerm(value: string) { return value.toLocaleLowerCase("pt-BR").split(/\s+/).find((item) => item.length > 3) ?? value.toLocaleLowerCase("pt-BR"); }
function canonicalTheme(value: string) { const text = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR"); if (/\b(ia|inteligencia artificial)\b/.test(text)) return "inteligencia artificial aplicada"; if (/\b(upskilling|future skills|habilidades digitais|competencias)\b/.test(text)) return "desenvolvimento de competencias"; return text.replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim(); }
function clusterThemes(values: string[]) { const map = new Map<string, string>(); values.filter(Boolean).forEach((value) => { const key = canonicalTheme(value); if (key && !map.has(key)) map.set(key, value.trim()); }); return [...map.values()]; }
function recurringThemeCount(posts: string[], themes: string) { const candidates = splitThemes(themes); return candidates.filter((theme) => posts.filter((post) => hasAny(post, [theme, keyTerm(theme)])).length >= 2).length; }
function scorePostCadence(posts: NormalizedLinkedInSnapshot["posts"]) { const dated = posts.map((post) => post.publishedAt).filter(Boolean); if (!dated.length) return 50; return Math.min(82, 48 + dated.length * 5); }
function scoreReceivedInteractions(posts: NormalizedLinkedInSnapshot["posts"]) { const active = posts.filter((post) => (post.reactions ?? 0) + (post.comments ?? 0) + (post.reposts ?? 0) > 0).length; return Math.min(86, 44 + active * 7); }
function levelFromCount(count: number, high: number, medium: number): "Alta" | "Média" | "Baixa" { return count >= high ? "Alta" : count >= medium ? "Média" : "Baixa"; }
function classifyAuthority(score: number, coverage: number) { if (coverage < 25) return "Dados insuficientes para classificar a autoridade"; if (score >= 80) return "Autoridade consolidada"; if (score >= 65) return "Autoridade em expansão"; if (score >= 48) return "Autoridade emergente"; return "Autoridade em construção"; }
function recommendationForDimension(key: string, input: AuthorityInput) { if (key === "headline_clarity" || key === "positioning") return "Reescrever a primeira leitura do perfil com especialidade, público e impacto sustentados por evidência."; if (["published_content", "theme_consistency", "frequency"].includes(key)) return "Analisar publicações reais antes de definir cadência e consolidar dois ou três territórios recorrentes."; if (["comments_quality", "strategic_network", "relevant_conversations"].includes(key)) return "Entrar em conversas relevantes com contribuições substantivas e observar respostas antes de abordar."; if (["cases_results", "measurable_results", "authority_proof"].includes(key)) return "Transformar experiências reais em provas com contexto, contribuição e impacto verificável."; return `Reforçar esta dimensão com evidências relacionadas ao objetivo: ${input.objective}`; }
function actionForDimension(key: string) { if (key.includes("headline") || key === "positioning" || key === "about_clarity") return "Melhorar o perfil"; if (["comments_quality", "strategic_network", "relevant_conversations"].includes(key)) return "Comentar antes de abordar"; if (["published_content", "theme_consistency", "frequency"].includes(key)) return "Analisar conteúdo antes de publicar"; if (["cases_results", "measurable_results", "authority_proof"].includes(key)) return "Organizar provas de autoridade"; return "Pesquisar e validar evidências"; }
