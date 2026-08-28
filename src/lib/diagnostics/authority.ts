import { z } from "zod";

export const confidenceLevels = ["confirmed", "likely", "inference", "unverified"] as const;

export type ConfidenceLevel = (typeof confidenceLevels)[number];

export const authorityInputSchema = z.object({
  businessUnitId: z.string().min(1),
  businessUnitName: z.string().min(1),
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
  terms.some((term) => text.toLocaleLowerCase("pt-BR").includes(term));

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

  if (["authority_proof", "cases_results"].includes(dimension.key) && input.proofPoints.length < 30) score -= 22;
  if (["published_content", "frequency", "theme_consistency"].includes(dimension.key) && input.recentContent.length < 30) score -= 18;
  if (["comments_quality", "strategic_network", "relevant_conversations"].includes(dimension.key) && input.interactionSignals.length < 30) score -= 16;
  if (dimension.key === "cta" && !hasAny(combined, ["conversa", "contato", "fale", "agenda", "diagnostico"])) score -= 12;
  if (dimension.key === "icp_relevance" && !hasAny(combined, ["cliente", "empresa", "b2b", "rh", "lider", "gestor", "comercial"])) score -= 10;

  return {
    ...dimension,
    score: normalize(score),
    rationale: buildRationale(dimension.label, normalize(score)),
    evidence: evidence.length ? evidence : ["Sem evidencia suficiente; classificacao depende de informacoes fornecidas pelo usuario."],
  };
}

function buildRationale(label: string, score: number) {
  if (score >= 75) return `${label} esta forte para gerar confianca comercial.`;
  if (score >= 55) return `${label} existe, mas precisa de mais prova e consistencia.`;
  return `${label} ainda nao sustenta autoridade comercial de forma clara.`;
}

export function createAuthorityAssessment(input: AuthorityInput, extraSources: ResearchSource[] = []): AuthorityAssessment {
  const parsed = authorityInputSchema.parse(input);
  const dimensions = authorityDimensions.map((dimension) => scoreDimension(dimension, parsed));
  const weighted = dimensions.reduce((sum, item) => sum + item.score * item.weight, 0);
  const totalWeight = dimensions.reduce((sum, item) => sum + item.weight, 0);
  const overallScore = normalize(weighted / totalWeight);
  const weak = dimensions.filter((item) => item.score < 55).slice(0, 4);
  const strong = dimensions.filter((item) => item.score >= 72).slice(0, 4);

  const prosperMode = parsed.businessUnitId === "bu_prosper";
  const opportunities = prosperMode
    ? [
        "Transformar Inic.IA, AI for Business e AI Builders em uma narrativa de maturidade: entender, aplicar e construir.",
        "Usar Prosper Sprints como prova de escala, mensuracao e acompanhamento, nao apenas como plataforma.",
        "Conectar autoridade em IA a dores reais de RH, lideranca, operacoes e transformacao digital.",
        "Evidenciar impacto em diversidade, equidade, inclusao e empregabilidade quando houver fonte segura.",
      ]
    : [
        `Transformar temas de ${parsed.businessUnitName} em uma narrativa recorrente.`,
        "Adicionar provas objetivas, aprendizados de campo e exemplos comerciais.",
        "Criar uma rotina de comentarios em conversas onde o ICP ja participa.",
      ];
  const recommendations = prosperMode
    ? [
        "Reescrever headline com tres sinais: habilidades digitais, IA aplicada e impacto de negocio.",
        "Organizar o Sobre pela jornada Prosper: entender IA, aplicar no dia a dia e construir solucoes reais.",
        "Publicar uma serie sobre maturidade em IA com exemplos de RH, lideranca e operacoes.",
        "Usar provas de clientes, programas e resultados sem expor dados sensiveis ou prometer ROI sem fonte.",
        "Criar comentarios consultivos em posts de decisores sobre futuro do trabalho, produtividade, DEI e transformacao.",
      ]
    : [
        "Reescrever headline com problema resolvido, publico e territorio de autoridade.",
        "Reorganizar o Sobre para combinar contexto, prova, oferta e CTA.",
        "Publicar uma sequencia de 4 posts com ponto de vista, case, aprendizado e convite.",
        "Comentar semanalmente em posts de decisores e especialistas do ICP.",
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
            action: prosperMode ? "Ajustar headline para conectar habilidades digitais, IA aplicada e valor real." : "Ajustar headline com ICP, problema e promessa realista.",
            effort: "low",
            impact: "high",
          },
          {
            action: prosperMode ? "Atualizar Sobre com a jornada entender, aplicar e construir IA." : "Atualizar Sobre com prova, contexto da BU e CTA de conversa.",
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
            action: prosperMode ? "Publicar insight sobre baixa aplicacao pratica de IA nas areas de negocio." : "Publicar insight sobre uma dor concreta do ICP.",
            effort: "medium",
            impact: "high",
          },
          {
            action: prosperMode ? "Registrar aprendizado de programa, sprint ou mentoria sem expor dados sensiveis." : "Registrar um case ou aprendizado sem expor dados sensiveis.",
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
