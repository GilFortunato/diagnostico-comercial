import { prosperContext } from "@/lib/tenancy/prosper";

export type BusinessUnitStatus = "draft" | "published" | "inactive";

export type BusinessUnitProduct = {
  name: string;
  description: string;
  problems: string[];
  audiences: string[];
  benefits: string[];
  proofPoints: string[];
  objections: string[];
  cta: string;
  keywords: string[];
};

export type BusinessUnitIcp = {
  name: string;
  sectors: string[];
  companySize: string;
  regions: string[];
  maturity: string;
  problems: string[];
  positiveSignals: string[];
  negativeSignals: string[];
  buyingAreas: string[];
  decisionMakers: string[];
  influencers: string[];
  champions: string[];
};

export type BusinessUnitPersona = {
  name: string;
  responsibilities: string[];
  kpis: string[];
  pains: string[];
  objectives: string[];
  objections: string[];
  language: string[];
  conversationTriggers: string[];
  relatedProducts: string[];
};

export type AuthorityTerritory = {
  name: string;
  description: string;
  importance: "high" | "medium" | "low";
  keywords: string[];
  subthemes: string[];
  evidenceTypes: string[];
};

export type ContentDna = {
  tone: string;
  formality: "low" | "medium" | "high";
  personality: string[];
  argumentStyle: string[];
  preferredStructures: string[];
  recommendedTerms: string[];
  forbiddenTerms: string[];
  recommendedCtas: string[];
  forbiddenCtas: string[];
  prioritySubjects: string[];
  sensitiveSubjects: string[];
  approvedClaims: Array<{ claim: string; source: string }>;
  forbiddenClaims: string[];
};

export type BusinessUnitDna = {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  status: BusinessUnitStatus;
  description: string;
  tagline: string;
  site?: string;
  brandPack: {
    primary: string;
    secondary?: string;
    accent: string;
    surface: string;
    voice: string;
    context?: unknown;
  };
  positioning: {
    whatWeAre: string;
    whatWeAreNot: string;
    problem: string;
    transformation: string;
    whyExist: string;
    differentiators: string[];
    proofPoints: string[];
    competitors: string[];
    recommendedTerms: string[];
    avoidedTerms: string[];
  };
  products: BusinessUnitProduct[];
  icps: BusinessUnitIcp[];
  personas: BusinessUnitPersona[];
  authorityTerritories: AuthorityTerritory[];
  authorityWeightFocus: string[];
  contentDna: ContentDna;
  documents: Array<{ title: string; kind: string; status: "missing" | "available"; tags: string[] }>;
  updatedAt: string;
};

export const prosperDna: BusinessUnitDna = {
  id: "bu_prosper",
  name: "Prosper Digital Skills",
  shortName: "Prosper",
  slug: "prosper",
  status: "published",
  description: "Habilidades digitais, aplicação de IA, talentos e transformação com impacto real de negócio.",
  tagline: "Do entendimento da IA a aplicação prática no negócio.",
  brandPack: {
    primary: "#ff0048",
    secondary: "#5b19ef",
    accent: "#2ef2ce",
    surface: "#fff1f7",
    voice: "prático, acessível, transformador, conectado a negócio",
    context: prosperContext,
  },
  positioning: {
    whatWeAre: "Uma BU Share para desenvolvimento de habilidades digitais, IA aplicada e novas formas de trabalho.",
    whatWeAreNot: "Não somos uma biblioteca genérica de cursos nem uma consultoria que fala de IA sem aplicação prática.",
    problem: "Empresas entendem que IA e habilidades digitais importam, mas ainda tem dificuldade de transformar isso em prática, autonomia e resultado.",
    transformation: "Ajudar pessoas e áreas de negócio a entender, aplicar e construir soluções com IA e competências digitais.",
    whyExist: "Conectar talentos, empresas e sociedade a impacto real de negócio por meio de aprendizagem aplicada.",
    differentiators: prosperContext.differentiators,
    proofPoints: ["Programas Inic.IA, AI for Business, AI Builders, Potenc.IA e Prosper Sprints.", "Jornadas com grandes empresas citadas nos materiais institucionais."],
    competitors: ["consultorias de treinamento corporativo", "edtechs generalistas", "programas internos sem acompanhamento"],
    recommendedTerms: ["IA aplicada", "habilidades digitais", "Educação corporativa", "upskilling", "futuro do trabalho", "transformação com resultado"],
    avoidedTerms: ["curso genérico", "viralizar", "promessa de ROI sem fonte", "substituir pessoas por IA"],
  },
  products: [
    {
      name: "Inic.IA",
      description: "Sensibilização e letramento em IA para públicos não técnicos.",
      problems: ["Baixa clareza sobre IA", "Uso superficial de ferramentas", "Medo ou resistência à mudança"],
      audiences: ["RH", "T&D", "lideranças", "áreas de negócio"],
      benefits: ["Alinhamento conceitual", "Primeiros usos práticos", "Confiança para explorar IA com critério"],
      proofPoints: ["Jornada aplicada ao contexto real da organização."],
      objections: ["Meu time não é técnico", "Não sabemos por onde começar"],
      cta: "Conversar sobre uma primeira jornada de sensibilização em IA.",
      keywords: ["sensibilização em IA", "letramento em IA", "IA para negócios"],
    },
    {
      name: "AI for Business",
      description: "Aplicação prática de IA no dia a dia das áreas de negócio.",
      problems: ["Dificuldade de identificar casos de uso", "Baixa produtividade", "IA distante dos desafios reais"],
      audiences: ["lideranças de negócio", "operações", "RH", "marketing", "comercial"],
      benefits: ["Casos de uso práticos", "Autonomia das equipes", "Conexão com indicadores de negócio"],
      proofPoints: ["Metodologia orientada a problemas reais das áreas."],
      objections: ["Já temos ferramentas", "Falta tempo para aplicar"],
      cta: "Mapear oportunidades de IA em uma área de negócio.",
      keywords: ["IA aplicada a negócios", "produtividade", "casos de uso"],
    },
    {
      name: "AI Builders",
      description: "Construção de soluções e protótipos com IA, dados e automação.",
      problems: ["Dependência de fornecedores", "Ideias que não viram protótipo", "Baixa fluência em construção"],
      audiences: ["times digitais", "inovação", "operações", "lideranças técnicas"],
      benefits: ["Prototipagem", "Vibe coding", "Aprendizagem por projeto"],
      proofPoints: ["Project-based learning com desafios reais."],
      objections: ["Não temos desenvolvedores suficientes", "A área não sabe programar"],
      cta: "Transformar um desafio real em sprint de construção.",
      keywords: ["AI Builders", "vibe coding", "prototipagem com IA"],
    },
    {
      name: "Potenc.IA",
      description: "Programa de formação em IA com impacto em talentos, empresas e sociedade.",
      problems: ["Acesso desigual a formação", "Baixa empregabilidade digital", "Dificuldade de conectar diversidade e futuro do trabalho"],
      audiences: ["empresas", "instituições", "áreas de impacto social", "DEI"],
      benefits: ["Formação aplicada", "Impacto social", "Desenvolvimento de talentos"],
      proofPoints: ["Conexão entre aprendizagem, diversidade, tecnologia e negócio."],
      objections: ["Como medir impacto", "Como garantir aplicabilidade"],
      cta: "Desenhar uma jornada de impacto em IA.",
      keywords: ["Potenc.IA", "empregabilidade", "DEI", "futuro do trabalho"],
    },
  ],
  icps: [
    {
      name: "Grandes empresas em transformação",
      sectors: ["serviços", "indústria", "varejo", "tecnologia", "financeiro"],
      companySize: "Grandes empresas com times distribuídos e necessidade de escala.",
      regions: ["Brasil"],
      maturity: "Reconhecem IA como prioridade, mas ainda precisam converter interesse em prática.",
      problems: ["Baixa aplicação de IA no dia a dia", "Lacuna de habilidades digitais", "Dificuldade de escalar aprendizagem"],
      positiveSignals: ["programas de transformação", "iniciativas de upskilling", "agenda de IA", "áreas de T&D estruturadas"],
      negativeSignals: ["busca apenas por palestra pontual", "sem patrocinador interno", "sem abertura para medir evolução"],
      buyingAreas: ["RH", "T&D", "People", "Learning", "Transformação Digital", "Inovação"],
      decisionMakers: ["CHRO", "Diretor de RH", "Head de T&D", "Head de Learning", "Diretor de transformação"],
      influencers: ["Gerente de T&D", "Gerente de DO", "HRBP", "lideranças de áreas de negócio"],
      champions: ["especialistas de aprendizagem", "lideranças com projetos de IA", "pessoas de inovação"],
    },
  ],
  personas: [
    {
      name: "Head de T&D",
      responsibilities: ["desenvolver capacidades", "priorizar programas", "medir impacto de aprendizagem"],
      kpis: ["adesão", "aplicabilidade", "impacto percebido", "escala"],
      pains: ["muitos temas urgentes", "pressão por IA", "dificuldade de provar resultado"],
      objectives: ["capacitar com relevância", "conectar aprendizagem ao negócio", "ganhar patrocínio executivo"],
      objections: ["orçamento", "tempo das áreas", "risco de programa genérico"],
      language: ["prática", "aplicabilidade", "jornada", "negócio", "mensuração"],
      conversationTriggers: ["agenda de IA", "futuro do trabalho", "produtividade", "upskilling"],
      relatedProducts: ["Inic.IA", "AI for Business", "Prosper Sprints"],
    },
  ],
  authorityTerritories: [
    {
      name: "IA aplicada ao trabalho",
      description: "Uso prático e responsável de IA para melhorar rotinas, decisões e produtividade.",
      importance: "high",
      keywords: ["IA aplicada", "produtividade", "automação", "casos de uso"],
      subthemes: ["IA para RH", "IA para lideranças", "IA no dia a dia"],
      evidenceTypes: ["cases", "aprendizados de sprint", "exemplos de aplicação"],
    },
    {
      name: "Educação corporativa",
      description: "Aprendizagem conectada a problemas reais, escala e impacto.",
      importance: "high",
      keywords: ["Educação corporativa", "learning", "T&D", "upskilling"],
      subthemes: ["mensuração", "experiências de aprendizagem", "jornadas"],
      evidenceTypes: ["programas", "metodologias", "resultados documentados"],
    },
  ],
  authorityWeightFocus: ["icp_relevance", "bu_themes", "theme_consistency", "published_content", "reference_potential"],
  contentDna: {
    tone: "consultivo, prático e humano",
    formality: "medium",
    personality: ["claro", "estratégico", "acessível", "orientado a negócio"],
    argumentStyle: ["problema concreto", "visão", "exemplo prático", "convite para conversa"],
    preferredStructures: ["Problema -> visão -> aplicação -> pergunta", "Insight -> exemplo -> implicação para RH/T&D"],
    recommendedTerms: ["IA aplicada", "habilidades digitais", "aprendizagem aplicada", "impacto real"],
    forbiddenTerms: ["viralizar", "garantia de resultado", "substituir pessoas"],
    recommendedCtas: ["vamos conversar sobre aplicação prática", "qual desafio sua área está tentando resolver?"],
    forbiddenCtas: ["compre agora", "garantia de ROI"],
    prioritySubjects: ["IA aplicada a negócios", "Educação corporativa", "futuro do trabalho", "upskilling"],
    sensitiveSubjects: ["dados pessoais", "saúde", "política", "religião", "inferências sobre renda"],
    approvedClaims: [{ claim: "Prosper atua com jornadas de habilidades digitais e IA aplicada.", source: "Apresentação institucional Prosper" }],
    forbiddenClaims: ["Números de profissionais capacitados sem fonte validada.", "ROI financeiro sem documento de apoio."],
  },
  documents: [
    { title: "Institucional Prosper", kind: "presentation", status: "available", tags: ["brand", "contexto", "produtos"] },
    { title: "Cases Prosper", kind: "case", status: "missing", tags: ["provas", "clientes"] },
  ],
  updatedAt: "2026-08-28T00:00:00.000Z",
};

export const businessUnitCatalog: BusinessUnitDna[] = [
  {
    id: "bu_share",
    name: "Share",
    shortName: "Share",
    slug: "share",
    status: "published",
    description: "Marca principal e contexto institucional da plataforma.",
    tagline: "Inteligência comercial orientada a contexto.",
    brandPack: {
      primary: "#00563a",
      accent: "#9cff00",
      surface: "#eef8eb",
      voice: "corporativo, claro, consultivo",
    },
    positioning: {
      whatWeAre: "A marca-mãe da plataforma de inteligência comercial.",
      whatWeAreNot: "Não é uma BU operacional específica.",
      problem: "Organizar contexto, dados e recursos para orientar execução comercial.",
      transformation: "Transformar objetivo comercial em ação guiada.",
      whyExist: "Dar clareza e qualidade consultiva a fluxos comerciais com IA.",
      differentiators: ["contexto corporativo", "governança", "execução orientada a objetivo"],
      proofPoints: ["Arquitetura multi-BU", "conectores protegidos", "aprovação humana"],
      competitors: [],
      recommendedTerms: ["Share AI", "inteligência comercial", "social selling"],
      avoidedTerms: ["chatbot genérico", "biblioteca de prompts"],
    },
    products: [],
    icps: [],
    personas: [],
    authorityTerritories: [],
    authorityWeightFocus: ["positioning", "cta", "non_advertising_experience", "credibility", "personal_institutional"],
    contentDna: {
      tone: "consultivo e objetivo",
      formality: "medium",
      personality: ["confiável", "claro"],
      argumentStyle: ["contexto", "critério", "próxima ação"],
      preferredStructures: ["Diagnóstico -> recomendação -> ação"],
      recommendedTerms: ["inteligência comercial", "autoridade", "relacionamento"],
      forbiddenTerms: ["spam", "automação irrestrita"],
      recommendedCtas: ["ver próxima melhor ação"],
      forbiddenCtas: ["enviar automaticamente"],
      prioritySubjects: ["social selling", "autoridade comercial"],
      sensitiveSubjects: ["dados sensíveis"],
      approvedClaims: [],
      forbiddenClaims: ["qualquer número sem fonte"],
    },
    documents: [],
    updatedAt: "2026-08-28T00:00:00.000Z",
  },
  prosperDna,
  {
    id: "bu_education_recruit",
    name: "Education Recruit",
    shortName: "Education Recruit",
    slug: "education-recruit",
    status: "draft",
    description: "Recrutamento e soluções para educação.",
    tagline: "Talentos certos para contextos educacionais.",
    brandPack: {
      primary: "#00563a",
      accent: "#00d4c7",
      surface: "#eefcfa",
      voice: "especialista, objetivo, cuidadoso",
    },
    positioning: {
      whatWeAre: "BU voltada a recrutamento e inteligência de talentos para educação.",
      whatWeAreNot: "Não é um ATS genérico.",
      problem: "Instituições educacionais precisam selecionar melhor em contextos específicos.",
      transformation: "Apoiar decisão de recrutamento com critério e contexto.",
      whyExist: "Conectar talentos a instituições com mais assertividade.",
      differentiators: ["contexto educacional", "critério de perfil", "mapeamento especializado"],
      proofPoints: [],
      competitors: [],
      recommendedTerms: ["recrutamento educacional", "gestão escolar", "talentos"],
      avoidedTerms: ["seleção genérica"],
    },
    products: [],
    icps: [],
    personas: [],
    authorityTerritories: [],
    authorityWeightFocus: ["credibility", "authority_proof", "strategic_network", "about_clarity", "personal_institutional"],
    contentDna: {
      tone: "especialista e cuidadoso",
      formality: "medium",
      personality: ["criterioso", "humano", "objetivo"],
      argumentStyle: ["contexto", "critério", "qualidade da decisão"],
      preferredStructures: ["Desafio -> critério -> caminho"],
      recommendedTerms: ["talentos", "educação", "gestão escolar"],
      forbiddenTerms: ["atalho fácil"],
      recommendedCtas: ["avaliar contexto da instituição"],
      forbiddenCtas: ["prometer preenchimento imediato"],
      prioritySubjects: ["recrutamento educacional"],
      sensitiveSubjects: ["dados sensíveis de candidatos"],
      approvedClaims: [],
      forbiddenClaims: ["resultados sem fonte"],
    },
    documents: [],
    updatedAt: "2026-08-28T00:00:00.000Z",
  },
];

export const defaultBusinessUnitId = prosperDna.id;

export function getBusinessUnitDna(id: string) {
  return businessUnitCatalog.find((unit) => unit.id === id) ?? businessUnitCatalog[0];
}

export function getBusinessUnitStarterInput(id: string) {
  const unit = getBusinessUnitDna(id);
  const primaryIcp = unit.icps[0];
  const territories = unit.authorityTerritories.map((territory) => territory.name).join(", ");

  return {
    profileUrl: "",
    objective: primaryIcp
      ? `Ser reconhecido por ${primaryIcp.buyingAreas.join(", ")} como referência em ${territories || unit.name}.`
      : `Ser reconhecido por decisores B2B como referência em ${unit.name}.`,
    headline: "",
    about: "",
    themes: "",
    proofPoints: "",
    recentContent: "",
    interactionSignals: "",
  };
}

export function buildBusinessUnitGuidance(id: string) {
  const unit = getBusinessUnitDna(id);
  return {
    name: unit.name,
    products: unit.products.map((product) => product.name),
    icps: unit.icps.map((icp) => icp.name),
    personas: unit.personas.map((persona) => persona.name),
    territories: unit.authorityTerritories.map((territory) => territory.name),
    recommendedTerms: unit.positioning.recommendedTerms,
    avoidedTerms: unit.positioning.avoidedTerms,
    proofPoints: unit.positioning.proofPoints,
    authorityWeightFocus: unit.authorityWeightFocus,
    contentTone: unit.contentDna.tone,
    recommendedCtas: unit.contentDna.recommendedCtas,
    forbiddenClaims: unit.contentDna.forbiddenClaims,
  };
}
