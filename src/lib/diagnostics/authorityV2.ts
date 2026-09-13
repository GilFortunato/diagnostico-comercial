import type { AuthorityAssessment, AuthorityDimensionScore, StrategicGap } from "@/lib/diagnostics/authority";

const V2_PREFIX = "v2_";

const pillarDefinitions = [
  { key: "v2_positioning", label: "Posicionamento", weight: 20, sourceKeys: ["positioning", "headline_clarity", "about_clarity", "cta"] },
  { key: "v2_linkedin_authority", label: "Autoridade comprovável no LinkedIn", weight: 20, sourceKeys: ["authority_proof", "cases_results", "trajectory_depth", "measurable_results", "profile_completeness", "credibility"] },
  { key: "v2_buyer_alignment", label: "Buyer Alignment", weight: 15, sourceKeys: [] },
  { key: "v2_discoverability", label: "Search & Discoverability", weight: 15, sourceKeys: [] },
  { key: "v2_thought_leadership", label: "Thought Leadership", weight: 20, sourceKeys: ["published_content", "theme_consistency", "frequency", "non_advertising_experience"] },
  { key: "v2_activation_relationship", label: "Ativação & Relacionamento", weight: 10, sourceKeys: ["comments_quality", "received_interactions", "strategic_network", "relevant_conversations", "reference_potential"] },
] as const;

/**
 * Camada V2 LinkedIn-first.
 *
 * O motor original continua responsável por extrair evidências. Esta camada reorganiza
 * a leitura em seis pilares auditáveis, não transforma ausência de dados em nota zero e
 * evita tratar "percepção" como fato quando só existem sinais públicos do perfil.
 */
export function upgradeAuthorityAssessmentV2(assessment: AuthorityAssessment): AuthorityAssessment {
  if (assessment.dimensions?.length && assessment.dimensions.every((item) => item.key.startsWith(V2_PREFIX))) return assessment;

  const sourceDimensions = assessment.dimensions ?? [];
  const keywordCoverage = buildKeywordCoverage(assessment);
  const contentReading = buildContentReading(assessment);
  const caseMaturity = buildCaseMaturity(assessment);

  const pillars = pillarDefinitions.map((definition) => {
    if (definition.key === "v2_buyer_alignment") return buyerAlignmentDimension(assessment, definition.weight);
    if (definition.key === "v2_discoverability") return discoverabilityDimension(keywordCoverage, definition.weight);
    if (definition.key === "v2_thought_leadership") {
      return groupedDimension(definition.key, definition.label, definition.weight, definition.sourceKeys, sourceDimensions, {
        supplementalScore: contentReading.score,
        supplementalEvidence: contentReading.evidence,
        supplementalRationale: contentReading.rationale,
      });
    }
    if (definition.key === "v2_linkedin_authority") {
      return groupedDimension(definition.key, definition.label, definition.weight, definition.sourceKeys, sourceDimensions, {
        supplementalEvidence: caseMaturity.evidence,
        supplementalRationale: caseMaturity.rationale,
      });
    }
    return groupedDimension(definition.key, definition.label, definition.weight, definition.sourceKeys, sourceDimensions);
  });

  const evaluated = pillars.filter((item): item is AuthorityDimensionScore & { score: number } => item.status === "evaluated" && item.score !== null);
  const totalWeight = evaluated.reduce((sum, item) => sum + item.weight, 0);
  const authorityScore = totalWeight
    ? clamp(Math.round(evaluated.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight))
    : null;
  const scoreCoverage = Math.round((evaluated.length / pillarDefinitions.length) * 100);
  const confidence = coverageConfidence(scoreCoverage);
  const positioningGap = buildPositioningGap(assessment, keywordCoverage);
  const strategicGaps = positioningGap ? prependUniqueGap(positioningGap, assessment.strategicGaps ?? []) : assessment.strategicGaps;
  const strongest = [...evaluated].sort((a, b) => b.score - a.score).slice(0, 3).map((item) => item.label);

  const publicVisibility = (assessment.authorityMap ?? []).map((item) => item.publicVisibility);
  const signaledLevel = levelFromVisibility(publicVisibility);
  const builtLevel = assessment.authorityPerception?.builtLevel ?? levelFromScore(authorityScore);
  const signaledText = publicVisibility.length
    ? `O perfil sinaliza publicamente ${publicVisibility.filter((item) => item === "Alta").length} território(s) com visibilidade alta e ${publicVisibility.filter((item) => item === "Média").length} com visibilidade média. Isto mede sinais do perfil, não percepção declarada da audiência.`
    : "Ainda não há sinais públicos suficientes para estimar quanto da autoridade construída está visível no LinkedIn.";

  return {
    ...assessment,
    overallScore: authorityScore,
    authoritySellingScore: authorityScore,
    scoreCoverage,
    authorityClassification: classifyAuthority(authorityScore, scoreCoverage),
    scoreExplanations: {
      ...assessment.scoreExplanations,
      authority: authorityScore === null
        ? "Ainda não há dados suficientes para pontuar a autoridade. Dimensões sem evidência permanecem não avaliadas."
        : `Pontuação calculada sobre ${evaluated.length} de ${pillarDefinitions.length} pilares LinkedIn-first. Cobertura ${scoreCoverage}% · confiança ${confidence}. Cada pilar pode ser rastreado até critérios e evidências do perfil.`,
      businessUnitAffinity: assessment.buAffinityScore === null
        ? "Buyer Alignment ainda não pôde ser avaliado com segurança."
        : "Buyer Alignment cruza os sinais do perfil com personas, problemas e territórios informados para o contexto comercial. Não mede opinião real de compradores.",
      activationPotential: assessment.activationPotentialScore === null
        ? "Ativação depende de sinais observáveis de conteúdo, rede ou conversas. Ausência de dados não é convertida em nota zero."
        : "Potencial de ativação indica capacidade de transformar sinais já existentes em conversas. Não representa probabilidade de venda.",
    },
    summary: authorityScore === null
      ? `Diagnóstico LinkedIn V2 com ${scoreCoverage}% de cobertura. Ainda não há evidência suficiente para uma pontuação consolidada.`
      : `Autoridade LinkedIn ${authorityScore}/100, com ${scoreCoverage}% de cobertura e confiança ${confidence}. ${positioningGap ? positioningGap.expertReading : "O posicionamento está coerente com os sinais recuperados, sem dispensar validação por comportamento futuro."}`,
    dimensions: pillars,
    authorityPerception: {
      builtAuthority: assessment.authorityPerception?.builtAuthority ?? "A autoridade construída é estimada a partir de trajetória, provas e resultados disponíveis no LinkedIn.",
      perceivedAuthority: signaledText,
      expressionGap: positioningGap?.diagnosis ?? assessment.authorityPerception?.expressionGap ?? "Sem gap relevante confirmado com os dados disponíveis.",
      builtLevel,
      perceivedLevel: signaledLevel,
    },
    strategicGaps,
    strengths: strongest.length ? strongest : assessment.strengths,
    gaps: strategicGaps?.slice(0, 5).map((item) => item.title) ?? assessment.gaps,
  };
}

function groupedDimension(
  key: string,
  label: string,
  weight: number,
  sourceKeys: readonly string[],
  dimensions: AuthorityDimensionScore[],
  supplemental?: { supplementalScore?: number | null; supplementalEvidence?: string[]; supplementalRationale?: string },
): AuthorityDimensionScore {
  const items = sourceKeys.map((sourceKey) => dimensions.find((item) => item.key === sourceKey)).filter(Boolean) as AuthorityDimensionScore[];
  const evaluated = items.filter((item): item is AuthorityDimensionScore & { score: number } => item.status === "evaluated" && item.score !== null);
  const scores = evaluated.map((item) => item.score);
  if (supplemental?.supplementalScore !== undefined && supplemental.supplementalScore !== null) scores.push(supplemental.supplementalScore);
  const evidence = unique([...evaluated.flatMap((item) => item.evidence ?? []), ...(supplemental?.supplementalEvidence ?? [])]).slice(0, 5);
  if (!scores.length) {
    return {
      key, label, weight, capabilityHints: sourceKeys.map((item) => `source:${item}`), score: null, status: "not_evaluated",
      rationale: `Dados insuficientes para avaliar ${label.toLocaleLowerCase("pt-BR")}. A ausência de dados não reduz a nota.`, evidence: [],
    };
  }
  const score = clamp(Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length));
  const baseRationale = `${evaluated.length} critério(s) com evidência foram considerados; ${items.length - evaluated.length} ficaram não avaliados.`;
  return {
    key, label, weight, capabilityHints: sourceKeys.map((item) => `source:${item}`), score, status: "evaluated",
    rationale: [baseRationale, supplemental?.supplementalRationale].filter(Boolean).join(" "), evidence,
  };
}

function buyerAlignmentDimension(assessment: AuthorityAssessment, weight: number): AuthorityDimensionScore {
  const score = assessment.buAffinityScore;
  if (score === null || score === undefined) {
    return { key: "v2_buyer_alignment", label: "Buyer Alignment", weight, capabilityHints: ["buyer.context", "profile.compare"], score: null, status: "not_evaluated", rationale: "Não há contexto suficiente de buyer, problema e território para avaliar aderência.", evidence: [] };
  }
  const personas = assessment.input.businessUnitContext?.personas ?? [];
  const alignedThemes = (assessment.themeAlignment ?? []).filter((item) => item.affinity >= 55).map((item) => `${item.theme} (${item.affinity}/100)`);
  const bridges = (assessment.bridgeOpportunities ?? []).slice(0, 2).map((item) => `${item.territory} → ${item.persona}`);
  return {
    key: "v2_buyer_alignment", label: "Buyer Alignment", weight, capabilityHints: ["buyer.context", "profile.compare"], score: clamp(score), status: "evaluated",
    rationale: `Cruza perfil, territórios e contexto comercial informado${personas.length ? ` para personas como ${personas.slice(0, 2).join(" e ")}` : ""}. Não representa pesquisa de percepção com compradores.`,
    evidence: unique([...alignedThemes, ...bridges]).slice(0, 5),
  };
}

function discoverabilityDimension(coverage: ReturnType<typeof buildKeywordCoverage>, weight: number): AuthorityDimensionScore {
  if (coverage.score === null) {
    return { key: "v2_discoverability", label: "Search & Discoverability", weight, capabilityHints: ["profile.keywords"], score: null, status: "not_evaluated", rationale: coverage.rationale, evidence: [] };
  }
  return {
    key: "v2_discoverability", label: "Search & Discoverability", weight, capabilityHints: ["profile.keywords"], score: coverage.score, status: "evaluated",
    rationale: `${coverage.rationale} Esta é cobertura semântica inferida do perfil e não equivale aos dados reais de Search Appearances do LinkedIn.`,
    evidence: coverage.evidence,
  };
}

function buildKeywordCoverage(assessment: AuthorityAssessment) {
  const context = assessment.input.businessUnitContext;
  const targetTerms = unique([...(context?.recommendedTerms ?? []), ...(context?.territories ?? [])].map(cleanTerm).filter((item) => item.length >= 2)).slice(0, 16);
  const snapshot = assessment.input.linkedinSnapshot;
  const headline = normalize(snapshot?.headline || assessment.input.headline || "");
  const about = normalize(snapshot?.about || assessment.input.about || "");
  const experiences = normalize((snapshot?.experiences ?? []).map((item) => `${item.role} ${item.company} ${item.description ?? ""} ${item.skills.join(" ")}`).join(" "));
  const skills = normalize((snapshot?.skills ?? []).join(" "));
  const posts = normalize((snapshot?.posts ?? []).map((item) => item.text).join(" "));
  const allText = [headline, about, experiences, skills, posts].join(" ").trim();
  if (!targetTerms.length || !allText) return { score: null as number | null, rationale: "Não há termos estratégicos ou texto suficiente para estimar discoverability.", evidence: [] as string[], headlineCoverage: 0 };

  const scored = targetTerms.map((term) => {
    const normalizedTerm = normalize(term);
    const headlineHit = semanticHit(headline, normalizedTerm);
    const aboutHit = semanticHit(about, normalizedTerm);
    const experienceHit = semanticHit(experiences, normalizedTerm);
    const skillsHit = semanticHit(skills, normalizedTerm);
    const postHit = semanticHit(posts, normalizedTerm);
    const points = (headlineHit ? 4 : 0) + (aboutHit ? 2 : 0) + (experienceHit ? 2 : 0) + (skillsHit ? 1 : 0) + (postHit ? 1 : 0);
    return { term, points, headlineHit };
  });
  const score = clamp(Math.round((scored.reduce((sum, item) => sum + Math.min(item.points, 6), 0) / (scored.length * 6)) * 100));
  const found = scored.filter((item) => item.points > 0);
  const missing = scored.filter((item) => item.points === 0);
  return {
    score,
    headlineCoverage: Math.round((scored.filter((item) => item.headlineHit).length / scored.length) * 100),
    rationale: `${found.length} de ${scored.length} termo(s)/território(s) estratégicos têm sinal no perfil; ${missing.length} não aparecem de forma reconhecível.`,
    evidence: [
      found.length ? `Encontrados: ${found.slice(0, 6).map((item) => item.term).join(", ")}` : "Nenhum termo prioritário foi encontrado.",
      missing.length ? `Ausentes ou fracos: ${missing.slice(0, 6).map((item) => item.term).join(", ")}` : "Os principais termos estão representados.",
    ],
  };
}

function buildContentReading(assessment: AuthorityAssessment) {
  const posts = assessment.input.linkedinSnapshot?.posts ?? [];
  if (!posts.length) return { score: null as number | null, rationale: "Publicações recentes não foram recuperadas; Thought Leadership permanece parcialmente não avaliado.", evidence: [] as string[] };
  const counts = { authority: 0, proof: 0, pov: 0, human: 0 };
  let strategicPoints = 0;
  for (const post of posts) {
    const text = normalize(post.text);
    const hasResult = /\b\d+[\d.,]*\s*(?:%|horas?|dias?|pontos?|x)?\b/.test(text) || /resultado|reduz|aument|econom|impacto/.test(text);
    const hasUtility = /\bcomo\b|passo|guia|checklist|aprendi|dica|o que fazer|erro|evitar/.test(text);
    const hasPov = /acredito|na minha visão|minha experiência|discordo|não basta|por que|o problema é|defendo/.test(text);
    const hasHuman = /meu|minha|eu |alun|bastidor|história|hoje|orgulho|aprendi/.test(text);
    if (hasUtility) counts.authority += 1;
    if (hasResult) counts.proof += 1;
    if (hasPov) counts.pov += 1;
    if (hasHuman) counts.human += 1;
    strategicPoints += [hasResult, hasUtility, hasPov].filter(Boolean).length;
  }
  const score = clamp(Math.round(45 + (strategicPoints / Math.max(posts.length * 3, 1)) * 55));
  return {
    score,
    rationale: `Foram analisadas ${posts.length} publicações por sinais de utilidade, prova, ponto de vista e humanização. O arquétipo não é julgamento de qualidade; ele mostra a função estratégica do mix.`,
    evidence: [`Mix detectado: Autoridade ${counts.authority} · Prova ${counts.proof} · Ponto de vista ${counts.pov} · Humanização ${counts.human}.`],
  };
}

function buildCaseMaturity(assessment: AuthorityAssessment) {
  const results = assessment.evidencePortfolio?.measurableResults ?? [];
  if (!results.length) return { rationale: "Nenhum resultado mensurável suficientemente explícito foi recuperado no LinkedIn.", evidence: [] as string[] };
  const levels = results.map((text) => caseMaturityLevel(text));
  const max = Math.max(...levels);
  const avg = levels.reduce((sum, value) => sum + value, 0) / levels.length;
  return {
    rationale: `Maturidade dos cases: média ${avg.toFixed(1)}/4; melhor evidência ${max}/4. Números isolados não são tratados automaticamente como case completo.`,
    evidence: [`${results.length} resultado(s) mensurável(is) recuperado(s); maturidade máxima ${max}/4.`],
  };
}

function caseMaturityLevel(text: string) {
  const normalized = normalize(text);
  if (!normalized) return 0;
  const quantified = /\d/.test(normalized);
  if (!quantified) return 1;
  const contextual = /lead time|atendimento|processo|projeto|time|cliente|squad|operação|produto|vendas|horas|dias/.test(normalized);
  const intervention = /implem|lider|automat|redesenh|cria|estrutur|migra|aplica|desenvolv/.test(normalized);
  if (contextual && intervention) return 4;
  if (contextual) return 3;
  return 2;
}

function buildPositioningGap(assessment: AuthorityAssessment, coverage: ReturnType<typeof buildKeywordCoverage>): StrategicGap | null {
  if (coverage.score === null) return null;
  const headline = normalize(assessment.input.linkedinSnapshot?.headline || assessment.input.headline || "");
  if (!headline) return {
    title: "Gap de posicionamento",
    diagnosis: "A headline não pôde ser recuperada, impedindo validar a primeira impressão do perfil.", evidence: [],
    expertReading: "Sem headline observável, o diagnóstico não deve presumir que o buyer reconhece a especialidade desejada.", authorityImpact: "Alto", commercialImpact: "A primeira impressão fica sem direção verificável.", competitiveExposure: null,
    recommendation: "Confirmar a headline atual e explicitar especialidade, problema e público prioritário.", nextBestAction: "Revisar headline", priority: "Alta", confidence: "not_evaluated",
  };
  if (coverage.headlineCoverage >= 35 || coverage.score >= 72) return null;
  const priority = coverage.score < 40 ? "Alta" : "Média";
  return {
    title: "Gap de posicionamento",
    diagnosis: `A cobertura semântica do perfil é ${coverage.score}/100 e apenas ${coverage.headlineCoverage}% dos territórios/termos prioritários aparecem na headline.`,
    evidence: coverage.evidence,
    expertReading: "A trajetória pode sustentar uma autoridade diferente daquela que a vitrine do LinkedIn sinaliza de imediato. Isto é um gap de expressão, não uma prova de baixa competência.",
    authorityImpact: "A associação entre perfil e território desejado fica mais difícil.", commercialImpact: "Buyers podem compreender o perfil por um território diferente do objetivo comercial.", competitiveExposure: null,
    recommendation: "Reescrever headline e abertura do Sobre priorizando o território desejado, o problema resolvido e provas que já existem no LinkedIn.",
    nextBestAction: "Corrigir a vitrine antes de ampliar exposição", priority, confidence: "likely",
  };
}

function prependUniqueGap(gap: StrategicGap, existing: StrategicGap[]) {
  return [gap, ...existing.filter((item) => normalize(item.title) !== normalize(gap.title))];
}

function levelFromVisibility(values: Array<"Alta" | "Média" | "Baixa">): "Alta" | "Média" | "Baixa" {
  if (!values.length) return "Baixa";
  const points = values.reduce((sum, value) => sum + (value === "Alta" ? 3 : value === "Média" ? 2 : 1), 0) / values.length;
  return points >= 2.5 ? "Alta" : points >= 1.6 ? "Média" : "Baixa";
}

function levelFromScore(score: number | null): "Alta" | "Média" | "Baixa" {
  if (score === null) return "Baixa";
  return score >= 75 ? "Alta" : score >= 50 ? "Média" : "Baixa";
}

function classifyAuthority(score: number | null, coverage: number) {
  if (score === null || coverage < 34) return "Dados insuficientes para classificação";
  if (score >= 82) return "Autoridade consolidada";
  if (score >= 65) return "Autoridade em expansão";
  if (score >= 45) return "Autoridade em construção";
  return "Posicionamento ainda pouco sinalizado";
}

function coverageConfidence(coverage: number) {
  return coverage >= 84 ? "alta" : coverage >= 67 ? "média-alta" : coverage >= 50 ? "média" : "baixa";
}

function semanticHit(text: string, term: string) {
  if (!text || !term) return false;
  if (text.includes(term)) return true;
  const tokens = term.split(/\s+/).filter((token) => token.length >= 3);
  if (!tokens.length) return false;
  const hit = tokens.filter((token) => text.includes(token)).length;
  return hit / tokens.length >= 0.7;
}

function cleanTerm(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9%]+/g, " ").replace(/\s+/g, " ").trim();
}

function unique(values: string[]) {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
