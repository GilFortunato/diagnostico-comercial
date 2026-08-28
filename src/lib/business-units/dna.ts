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
  description: "Habilidades digitais, aplicacao de IA, talentos e transformacao com impacto real de negocio.",
  tagline: "Do entendimento da IA a aplicacao pratica no negocio.",
  brandPack: {
    primary: "#ff0048",
    secondary: "#5b19ef",
    accent: "#2ef2ce",
    surface: "#fff1f7",
    voice: "pratico, acessivel, transformador, conectado a negocio",
    context: prosperContext,
  },
  positioning: {
    whatWeAre: "Uma BU Share para desenvolvimento de habilidades digitais, IA aplicada e novas formas de trabalho.",
    whatWeAreNot: "Nao somos uma biblioteca generica de cursos nem uma consultoria que fala de IA sem aplicacao pratica.",
    problem: "Empresas entendem que IA e habilidades digitais importam, mas ainda tem dificuldade de transformar isso em pratica, autonomia e resultado.",
    transformation: "Ajudar pessoas e areas de negocio a entender, aplicar e construir solucoes com IA e competencias digitais.",
    whyExist: "Conectar talentos, empresas e sociedade a impacto real de negocio por meio de aprendizagem aplicada.",
    differentiators: prosperContext.differentiators,
    proofPoints: ["Programas Inic.IA, AI for Business, AI Builders, Potenc.IA e Prosper Sprints.", "Jornadas com grandes empresas citadas nos materiais institucionais."],
    competitors: ["consultorias de treinamento corporativo", "edtechs generalistas", "programas internos sem acompanhamento"],
    recommendedTerms: ["IA aplicada", "habilidades digitais", "educacao corporativa", "upskilling", "futuro do trabalho", "transformacao com resultado"],
    avoidedTerms: ["curso generico", "viralizar", "promessa de ROI sem fonte", "substituir pessoas por IA"],
  },
  products: [
    {
      name: "Inic.IA",
      description: "Sensibilizacao e letramento em IA para publicos nao tecnicos.",
      problems: ["Baixa clareza sobre IA", "Uso superficial de ferramentas", "Medo ou resistencia a mudanca"],
      audiences: ["RH", "T&D", "liderancas", "areas de negocio"],
      benefits: ["Alinhamento conceitual", "Primeiros usos praticos", "Confianca para explorar IA com criterio"],
      proofPoints: ["Jornada aplicada ao contexto real da organizacao."],
      objections: ["Meu time nao e tecnico", "Nao sabemos por onde comecar"],
      cta: "Conversar sobre uma primeira jornada de sensibilizacao em IA.",
      keywords: ["sensibilizacao em IA", "letramento em IA", "IA para negocios"],
    },
    {
      name: "AI for Business",
      description: "Aplicacao pratica de IA no dia a dia das areas de negocio.",
      problems: ["Dificuldade de identificar casos de uso", "Baixa produtividade", "IA distante dos desafios reais"],
      audiences: ["liderancas de negocio", "operacoes", "RH", "marketing", "comercial"],
      benefits: ["Casos de uso práticos", "Autonomia das equipes", "Conexao com indicadores de negocio"],
      proofPoints: ["Metodologia orientada a problemas reais das areas."],
      objections: ["Ja temos ferramentas", "Falta tempo para aplicar"],
      cta: "Mapear oportunidades de IA em uma area de negocio.",
      keywords: ["IA aplicada a negocios", "produtividade", "casos de uso"],
    },
    {
      name: "AI Builders",
      description: "Construcao de solucoes e prototipos com IA, dados e automacao.",
      problems: ["Dependencia de fornecedores", "Ideias que nao viram prototipo", "Baixa fluencia em construcao"],
      audiences: ["times digitais", "inovacao", "operacoes", "liderancas tecnicas"],
      benefits: ["Prototipagem", "Vibe coding", "Aprendizagem por projeto"],
      proofPoints: ["Project-based learning com desafios reais."],
      objections: ["Nao temos desenvolvedores suficientes", "A area nao sabe programar"],
      cta: "Transformar um desafio real em sprint de construcao.",
      keywords: ["AI Builders", "vibe coding", "prototipagem com IA"],
    },
    {
      name: "Potenc.IA",
      description: "Programa de formacao em IA com impacto em talentos, empresas e sociedade.",
      problems: ["Acesso desigual a formacao", "Baixa empregabilidade digital", "Dificuldade de conectar diversidade e futuro do trabalho"],
      audiences: ["empresas", "instituicoes", "areas de impacto social", "DEI"],
      benefits: ["Formacao aplicada", "Impacto social", "Desenvolvimento de talentos"],
      proofPoints: ["Conexao entre aprendizagem, diversidade, tecnologia e negocio."],
      objections: ["Como medir impacto", "Como garantir aplicabilidade"],
      cta: "Desenhar uma jornada de impacto em IA.",
      keywords: ["Potenc.IA", "empregabilidade", "DEI", "futuro do trabalho"],
    },
  ],
  icps: [
    {
      name: "Grandes empresas em transformacao",
      sectors: ["servicos", "industria", "varejo", "tecnologia", "financeiro"],
      companySize: "Grandes empresas com times distribuidos e necessidade de escala.",
      regions: ["Brasil"],
      maturity: "Reconhecem IA como prioridade, mas ainda precisam converter interesse em pratica.",
      problems: ["Baixa aplicacao de IA no dia a dia", "lacuna de habilidades digitais", "dificuldade de escalar aprendizagem"],
      positiveSignals: ["programas de transformacao", "iniciativas de upskilling", "agenda de IA", "areas de T&D estruturadas"],
      negativeSignals: ["busca apenas por palestra pontual", "sem patrocinador interno", "sem abertura para medir evolucao"],
      buyingAreas: ["RH", "T&D", "People", "Learning", "Transformacao Digital", "Inovacao"],
      decisionMakers: ["CHRO", "Diretor de RH", "Head de T&D", "Head de Learning", "Diretor de Transformacao"],
      influencers: ["Gerente de T&D", "Gerente de DO", "HRBP", "liderancas de areas de negocio"],
      champions: ["especialistas de aprendizagem", "liderancas com projetos de IA", "pessoas de inovacao"],
    },
  ],
  personas: [
    {
      name: "Head de T&D",
      responsibilities: ["desenvolver capacidades", "priorizar programas", "medir impacto de aprendizagem"],
      kpis: ["adesao", "aplicabilidade", "impacto percebido", "escala"],
      pains: ["muitos temas urgentes", "pressao por IA", "dificuldade de provar resultado"],
      objectives: ["capacitar com relevancia", "conectar aprendizagem ao negocio", "ganhar patrocinio executivo"],
      objections: ["orcamento", "tempo das areas", "risco de programa generico"],
      language: ["pratica", "aplicabilidade", "jornada", "negocio", "mensuracao"],
      conversationTriggers: ["agenda de IA", "futuro do trabalho", "produtividade", "upskilling"],
      relatedProducts: ["Inic.IA", "AI for Business", "Prosper Sprints"],
    },
  ],
  authorityTerritories: [
    {
      name: "IA aplicada ao trabalho",
      description: "Uso pratico e responsavel de IA para melhorar rotinas, decisoes e produtividade.",
      importance: "high",
      keywords: ["IA aplicada", "produtividade", "automacao", "casos de uso"],
      subthemes: ["IA para RH", "IA para liderancas", "IA no dia a dia"],
      evidenceTypes: ["cases", "aprendizados de sprint", "exemplos de aplicacao"],
    },
    {
      name: "Educacao corporativa",
      description: "Aprendizagem conectada a problemas reais, escala e impacto.",
      importance: "high",
      keywords: ["educacao corporativa", "learning", "T&D", "upskilling"],
      subthemes: ["mensuracao", "experiencias de aprendizagem", "jornadas"],
      evidenceTypes: ["programas", "metodologias", "resultados documentados"],
    },
  ],
  contentDna: {
    tone: "consultivo, pratico e humano",
    formality: "medium",
    personality: ["claro", "estrategico", "acessivel", "orientado a negocio"],
    argumentStyle: ["problema concreto", "visao", "exemplo pratico", "convite para conversa"],
    preferredStructures: ["Problema -> visao -> aplicacao -> pergunta", "Insight -> exemplo -> implicacao para RH/T&D"],
    recommendedTerms: ["IA aplicada", "habilidades digitais", "aprendizagem aplicada", "impacto real"],
    forbiddenTerms: ["viralizar", "garantia de resultado", "substituir pessoas"],
    recommendedCtas: ["vamos conversar sobre aplicacao pratica", "qual desafio sua area esta tentando resolver?"],
    forbiddenCtas: ["compre agora", "garantia de ROI"],
    prioritySubjects: ["IA aplicada a negocios", "educacao corporativa", "futuro do trabalho", "upskilling"],
    sensitiveSubjects: ["dados pessoais", "saude", "politica", "religiao", "inferencias sobre renda"],
    approvedClaims: [{ claim: "Prosper atua com jornadas de habilidades digitais e IA aplicada.", source: "Apresentacao institucional Prosper" }],
    forbiddenClaims: ["Numeros de profissionais capacitados sem fonte validada.", "ROI financeiro sem documento de apoio."],
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
    tagline: "Inteligencia comercial orientada a contexto.",
    brandPack: {
      primary: "#00563a",
      accent: "#9cff00",
      surface: "#eef8eb",
      voice: "corporativo, claro, consultivo",
    },
    positioning: {
      whatWeAre: "A marca-mae da plataforma de inteligencia comercial.",
      whatWeAreNot: "Nao e uma BU operacional especifica.",
      problem: "Organizar contexto, dados e skills para orientar execucao comercial.",
      transformation: "Transformar objetivo comercial em acao guiada.",
      whyExist: "Dar clareza e qualidade consultiva a fluxos comerciais com IA.",
      differentiators: ["contexto corporativo", "governanca", "execucao orientada a objetivo"],
      proofPoints: ["Arquitetura multi-BU", "conectores protegidos", "aprovacao humana"],
      competitors: [],
      recommendedTerms: ["Share AI", "inteligencia comercial", "social selling"],
      avoidedTerms: ["chatbot generico", "biblioteca de prompts"],
    },
    products: [],
    icps: [],
    personas: [],
    authorityTerritories: [],
    contentDna: {
      tone: "consultivo e objetivo",
      formality: "medium",
      personality: ["confiavel", "claro"],
      argumentStyle: ["contexto", "criterio", "proxima acao"],
      preferredStructures: ["Diagnostico -> recomendacao -> acao"],
      recommendedTerms: ["inteligencia comercial", "autoridade", "relacionamento"],
      forbiddenTerms: ["spam", "automacao irrestrita"],
      recommendedCtas: ["ver proxima melhor acao"],
      forbiddenCtas: ["enviar automaticamente"],
      prioritySubjects: ["social selling", "autoridade comercial"],
      sensitiveSubjects: ["dados sensiveis"],
      approvedClaims: [],
      forbiddenClaims: ["qualquer numero sem fonte"],
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
    description: "Recrutamento e solucoes para educacao.",
    tagline: "Talentos certos para contextos educacionais.",
    brandPack: {
      primary: "#00563a",
      accent: "#00d4c7",
      surface: "#eefcfa",
      voice: "especialista, objetivo, cuidadoso",
    },
    positioning: {
      whatWeAre: "BU voltada a recrutamento e inteligencia de talentos para educacao.",
      whatWeAreNot: "Nao e um ATS generico.",
      problem: "Instituicoes educacionais precisam selecionar melhor em contextos especificos.",
      transformation: "Apoiar decisao de recrutamento com criterio e contexto.",
      whyExist: "Conectar talentos a instituicoes com mais assertividade.",
      differentiators: ["contexto educacional", "criterio de perfil", "mapeamento especializado"],
      proofPoints: [],
      competitors: [],
      recommendedTerms: ["recrutamento educacional", "gestao escolar", "talentos"],
      avoidedTerms: ["selecao generica"],
    },
    products: [],
    icps: [],
    personas: [],
    authorityTerritories: [],
    contentDna: {
      tone: "especialista e cuidadoso",
      formality: "medium",
      personality: ["criterioso", "humano", "objetivo"],
      argumentStyle: ["contexto", "criterio", "qualidade da decisao"],
      preferredStructures: ["Desafio -> criterio -> caminho"],
      recommendedTerms: ["talentos", "educacao", "gestao escolar"],
      forbiddenTerms: ["atalho facil"],
      recommendedCtas: ["avaliar contexto da instituicao"],
      forbiddenCtas: ["prometer preenchimento imediato"],
      prioritySubjects: ["recrutamento educacional"],
      sensitiveSubjects: ["dados sensiveis de candidatos"],
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
      ? `Ser reconhecido por ${primaryIcp.buyingAreas.join(", ")} como referencia em ${territories || unit.name}.`
      : `Ser reconhecido por decisores B2B como referencia em ${unit.name}.`,
    headline: unit.authorityTerritories[0]
      ? `${unit.authorityTerritories[0].name} para empresas que precisam gerar impacto real`
      : `${unit.name}: autoridade comercial e posicionamento B2B`,
    about: `${unit.positioning.whatWeAre} ${unit.positioning.transformation}`,
    themes: territories || unit.positioning.recommendedTerms.join(", "),
    proofPoints: unit.positioning.proofPoints.join("; "),
    recentContent: unit.contentDna.prioritySubjects.join(", "),
    interactionSignals: primaryIcp ? primaryIcp.buyingAreas.concat(primaryIcp.decisionMakers).join(", ") : "",
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
    contentTone: unit.contentDna.tone,
    recommendedCtas: unit.contentDna.recommendedCtas,
    forbiddenClaims: unit.contentDna.forbiddenClaims,
  };
}
