export type BusinessUnitStatus = "draft" | "published" | "inactive";
export type BusinessContextType = "business" | "personal";

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
  contextType: BusinessContextType;
  systemContext?: boolean;
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

const shareBrand = {
  primary: "#00563a",
  accent: "#9cff00",
  surface: "#eef8eb",
  voice: "claro, objetivo, estratégico, consultivo e orientado a impacto",
};

const sharePeopleHubDna: BusinessUnitDna = {
  id: "bu_share",
  name: "Share People Hub",
  shortName: "Share People Hub",
  slug: "share-people-hub",
  contextType: "business",
  status: "published",
  description: "Talentos, recrutamento e estratégia de pessoas ao longo da jornada de atração e contratação.",
  tagline: "Talentos e decisões de pessoas com precisão, contexto e inteligência.",
  brandPack: shareBrand,
  positioning: {
    whatWeAre: "Um hub de soluções em Pessoas com atuação consultiva em atração, seleção, executive search, recruiting tech e estratégia de talentos.",
    whatWeAreNot: "Não somos apenas uma agência de vagas nem um banco genérico de currículos.",
    problem: "Empresas precisam contratar melhor, aumentar previsibilidade e tomar decisões de talentos com mais contexto, velocidade e precisão.",
    transformation: "Conectar necessidades de negócio, cultura e mercado para encontrar e estruturar os talentos certos.",
    whyExist: "Transformar resultados das organizações por meio de pessoas e decisões de talento mais qualificadas.",
    differentiators: ["hunting direcionado", "visão consultiva", "entendimento de cultura", "gestão de indicadores", "atuação nacional"],
    proofPoints: ["Atuação em recrutamento, executive search, tecnologia e projetos de Talent Acquisition.", "Experiência em diferentes segmentos e níveis de senioridade."],
    competitors: ["consultorias de recrutamento", "executive search", "RPOs e parceiros de Talent Acquisition"],
    recommendedTerms: ["talentos", "hunting", "recrutamento estratégico", "Talent Acquisition", "mercado de talentos", "carreira", "remuneração"],
    avoidedTerms: ["currículo perfeito", "candidato ideal sem evidência", "garantia de contratação"],
  },
  products: [
    product("Professional & Executive Search", "Busca ativa e seleção para posições profissionais, de gestão e alta liderança.", ["vagas críticas", "dificuldade de acesso a talentos", "necessidade de maior assertividade"], ["RH", "Talent Acquisition", "lideranças", "C-level"], ["hunting direcionado", "mapeamento de mercado", "shortlist qualificada"]),
    product("Tech Recruiting", "Recrutamento especializado para posições de tecnologia e transformação digital.", ["vagas tech complexas", "baixa disponibilidade de talentos", "time interno sem profundidade técnica"], ["Talent Acquisition", "Tecnologia", "RH"], ["especialização", "velocidade", "aderência técnica"]),
    product("Talent Acquisition Partners", "Especialistas dedicados ou compartilhados que ampliam a capacidade do time interno.", ["sobrecarga de RH", "picos de volume", "ausência de estrutura interna"], ["RH", "Talent Acquisition"], ["capacidade adicional", "previsibilidade", "indicadores de R&S"]),
    product("Rewards, Carreira & Remuneração", "Estruturação de remuneração, carreira, benefícios, cargos e salários.", ["falta de referências salariais", "carreiras pouco claras", "remuneração desconectada da estratégia"], ["RH", "Compensation & Benefits", "lideranças"], ["decisões mais seguras", "arquitetura de carreira", "visão integrada de remuneração"]),
  ],
  icps: [{
    name: "Organizações com desafios de atração e estratégia de talentos",
    sectors: ["todos os segmentos"], companySize: "Empresas médias e grandes", regions: ["Brasil"], maturity: "RH estruturado ou em expansão",
    problems: ["vagas críticas", "alto volume", "time interno sobrecarregado", "necessidade de maior assertividade"],
    positiveSignals: ["crescimento", "transformação", "novas posições", "revisão de estrutura de talentos"], negativeSignals: ["busca sem briefing mínimo"],
    buyingAreas: ["RH", "People", "Talent Acquisition", "Compensation & Benefits"], decisionMakers: ["CHRO", "Diretor de RH", "Head de Talent Acquisition", "Head de People"], influencers: ["Gerente de RH", "HRBP", "Recruiting Lead"], champions: ["Talent Acquisition", "HRBP"],
  }],
  personas: [persona("Head de Talent Acquisition", ["garantir capacidade de contratação", "reduzir tempo e aumentar qualidade"], ["cycle time", "qualidade da shortlist", "previsibilidade"], ["sobrecarga do time", "vagas difíceis"], ["aumentar capacidade e assertividade"], ["custo", "integração com processo interno"], ["qualidade", "velocidade", "mercado"], ["picos de contratação", "vagas críticas"], ["Professional & Executive Search", "Tech Recruiting", "Talent Acquisition Partners"])],
  authorityTerritories: [
    territory("Mercado de talentos", "Leituras sobre atração, seleção, disponibilidade de profissionais e decisões de contratação.", ["talentos", "hunting", "recrutamento"], ["mapeamento de mercado", "Talent Acquisition"], ["cases", "dados de processo", "aprendizados de projetos"]),
    territory("Estratégia de pessoas", "Conexão entre estrutura, carreira, remuneração e prioridades de negócio.", ["carreira", "remuneração", "people strategy"], ["rewards", "estrutura", "retenção"], ["metodologias", "projetos", "dados documentados"]),
  ],
  authorityWeightFocus: ["credibility", "authority_proof", "strategic_network", "icp_relevance", "non_advertising_experience"],
  contentDna: contentDna("consultivo, objetivo e orientado a decisões de pessoas", ["talentos", "mercado", "qualidade da decisão", "cultura"], ["recrutamento", "Talent Acquisition", "mercado de talentos", "carreira"]),
  documents: [{ title: "Apresentação Comercial Share 2026", kind: "presentation", status: "available", tags: ["institucional", "talentos", "serviços"] }],
  updatedAt: "2026-09-02T00:00:00.000Z",
};

const humanShipDna: BusinessUnitDna = {
  id: "bu_human_ship",
  name: "Human Ship",
  shortName: "Human Ship",
  slug: "human-ship",
  contextType: "business",
  status: "published",
  description: "Cultura, liderança, desenvolvimento e performance conectados à estratégia do negócio.",
  tagline: "Transformação humana que vira comportamento, performance e resultado.",
  brandPack: { ...shareBrand, accent: "#ef5aa1", surface: "#fff4f8", voice: "humano, estratégico, provocador e aplicável" },
  positioning: {
    whatWeAre: "Um contexto de soluções para cultura, liderança, desenvolvimento humano, aprendizagem e gestão de performance.",
    whatWeAreNot: "Não somos treinamento de prateleira nem consultoria desconectada da realidade da organização.",
    problem: "Estratégias de pessoas falham quando cultura, liderança, competências e rituais não se transformam em comportamento observável.",
    transformation: "Traduzir estratégia e cultura em práticas, capacidades e rotinas que melhoram a experiência e a performance das equipes.",
    whyExist: "Ajudar organizações a navegar transformações humanas com método, profundidade e aplicabilidade.",
    differentiators: ["alta customização", "conexão com cultura", "aprendizagem aplicada", "métodos de performance", "acompanhamento pós-intervenção"],
    proofPoints: ["Atuação em cultura e clima, liderança, DHO, competências e gestão de desempenho."],
    competitors: ["consultorias de RH", "consultorias de cultura", "empresas de treinamento corporativo"],
    recommendedTerms: ["cultura", "liderança", "performance", "desenvolvimento", "competências", "aprendizagem contínua"],
    avoidedTerms: ["treinamento genérico", "mudança instantânea", "fórmula pronta"],
  },
  products: [
    product("Cultura & Clima", "Diagnósticos e jornadas que conectam cultura, clima, pessoas e estratégia.", ["cultura pouco clara", "baixo engajamento", "transformações organizacionais"], ["RH", "People", "lideranças"], ["diagnóstico", "prioridades claras", "planos de ação"]),
    product("Liderança & Desenvolvimento", "Programas, workshops e jornadas de aprendizagem personalizadas para líderes e equipes.", ["lideranças em transição", "gaps de competências", "mudança de contexto"], ["T&D", "RH", "lideranças"], ["aplicabilidade", "soft skills conectadas ao negócio", "aprendizagem contínua"]),
    product("Gestão de Desempenho & DHO", "Modelos de competências, avaliações, rituais e práticas de performance aderentes à cultura.", ["avaliações pouco úteis", "competências desconectadas da estratégia", "rituais sem adesão"], ["RH", "DHO", "People"], ["clareza", "modelos aplicáveis", "suporte à implantação"]),
  ],
  icps: [{
    name: "Empresas em transformação cultural e de performance", sectors: ["todos os segmentos"], companySize: "Empresas médias e grandes", regions: ["Brasil"], maturity: "RH estruturado com agenda de cultura, liderança ou performance",
    problems: ["mudança cultural", "desenvolvimento de liderança", "baixa aderência em performance"], positiveSignals: ["transformação organizacional", "nova estratégia", "revisão de competências"], negativeSignals: ["busca por conteúdo genérico sem contexto"],
    buyingAreas: ["RH", "People", "DHO", "T&D", "Learning"], decisionMakers: ["CHRO", "Diretor de RH", "Head de People", "Head de DHO"], influencers: ["Gerente de T&D", "Gerente de DHO", "HRBP"], champions: ["Learning", "DHO", "HRBP"],
  }],
  personas: [persona("Head de DHO", ["desenvolver capacidades", "conectar cultura e performance"], ["adesão", "desenvolvimento", "performance"], ["programas pouco aplicáveis", "mudança cultural complexa"], ["aumentar aplicabilidade e impacto"], ["orçamento", "tempo das lideranças"], ["cultura", "comportamento", "performance"], ["transformação", "nova liderança"], ["Cultura & Clima", "Liderança & Desenvolvimento", "Gestão de Desempenho & DHO"])],
  authorityTerritories: [
    territory("Cultura e liderança", "Como cultura, liderança e comportamento moldam decisões e performance.", ["cultura", "liderança", "comportamento"], ["clima", "mudança", "engajamento"], ["diagnósticos", "cases", "frameworks"]),
    territory("Performance e aprendizagem", "Desenvolvimento de competências e sistemas de performance conectados ao contexto real.", ["performance", "competências", "aprendizagem"], ["DHO", "feedback", "rituais"], ["metodologias", "jornadas", "planos de ação"]),
  ],
  authorityWeightFocus: ["credibility", "authority_proof", "theme_consistency", "icp_relevance", "published_content"],
  contentDna: contentDna("humano, consultivo e conectado ao negócio", ["cultura", "liderança", "performance", "aprendizagem"], ["cultura", "liderança", "DHO", "desenvolvimento"]),
  documents: [{ title: "Apresentação Comercial Share 2026", kind: "presentation", status: "available", tags: ["advisory", "performance", "education"] }],
  updatedAt: "2026-09-02T00:00:00.000Z",
};

export const prosperDna: BusinessUnitDna = {
  id: "bu_prosper",
  name: "Prosper Digital Skills",
  shortName: "Prosper",
  slug: "prosper",
  contextType: "business",
  status: "published",
  description: "IA, habilidades digitais, inclusão produtiva e desenvolvimento para o futuro do trabalho.",
  tagline: "Do entendimento da IA à aplicação prática no negócio.",
  brandPack: { primary: "#ff0048", secondary: "#5b19ef", accent: "#2ef2ce", surface: "#fff1f7", voice: "prático, acessível, transformador e conectado a negócio" },
  positioning: {
    whatWeAre: "A frente de desenvolvimento de habilidades digitais e IA aplicada para o futuro do trabalho.",
    whatWeAreNot: "Não somos uma biblioteca genérica de cursos nem uma consultoria que fala de IA sem aplicação prática.",
    problem: "Empresas entendem que IA e habilidades digitais importam, mas ainda têm dificuldade de transformar interesse em prática, autonomia e resultado.",
    transformation: "Desenvolver pessoas e equipes para entender, aplicar e construir soluções com IA e competências digitais.",
    whyExist: "Conectar talentos, empresas e sociedade ao futuro do trabalho por meio de aprendizagem aplicada.",
    differentiators: ["aprendizagem por projeto", "IA aplicada ao negócio", "educação e recrutamento conectados", "inclusão produtiva"],
    proofPoints: ["Education Recruiting, letramento digital/IA, projetos de IA e VibeCoding e programas de jovens talentos."],
    competitors: ["edtechs corporativas", "consultorias de treinamento", "bootcamps generalistas"],
    recommendedTerms: ["IA aplicada", "habilidades digitais", "Educação corporativa", "upskilling", "futuro do trabalho", "VibeCoding"],
    avoidedTerms: ["curso genérico", "viralizar", "promessa de ROI sem fonte", "substituir pessoas por IA"],
  },
  products: [
    product("Letramento em IA & Habilidades Digitais", "Desenvolvimento de fluência digital e IA para áreas não técnicas e programas de formação profissional.", ["baixa fluência digital", "uso superficial de IA", "funções de entrada pouco preparadas"], ["RH", "T&D", "áreas de negócio", "programas de impacto"], ["produtividade", "autonomia", "preparação para o futuro do trabalho"]),
    product("Education Recruiting", "Recrutamento e qualificação integrados para acelerar pessoas candidatas até os requisitos técnicos da vaga.", ["escassez de talentos", "gaps técnicos", "necessidade de inclusão produtiva"], ["Talent Acquisition", "Tecnologia", "RH"], ["seleção e desenvolvimento conectados", "observação ao longo da formação", "qualificação aderente à vaga"]),
    product("Projetos de IA & VibeCoding", "Aprendizagem por projeto com embasamento e mentoria para implantar soluções de IA e VibeCoding.", ["ideias que não viram projeto", "baixa autonomia com IA", "dificuldade de aplicar conhecimento"], ["inovação", "transformação", "áreas de negócio"], ["projetos práticos", "aprendizagem aplicada", "impacto no negócio"]),
    product("Jovens Talentos", "Atração, seleção e desenvolvimento de estagiários, trainees e jovens profissionais para o futuro do trabalho.", ["programas de entrada pouco diferenciados", "marca empregadora", "desenvolvimento inicial"], ["RH", "Talent Acquisition", "Employer Branding"], ["marca empregadora", "seleção aderente", "habilidades para o futuro do trabalho"]),
    product("Potenc.IA", "Programa de formação em IA com impacto em carreiras, diversidade e empregabilidade.", ["acesso desigual à formação", "baixa empregabilidade digital"], ["empresas", "áreas de impacto", "DEI"], ["formação aplicada", "impacto social", "desenvolvimento de talentos"]),
  ],
  icps: [{
    name: "Grandes empresas em transformação digital", sectors: ["serviços", "indústria", "varejo", "tecnologia", "financeiro"], companySize: "Grandes empresas", regions: ["Brasil"], maturity: "Reconhecem IA e habilidades digitais como prioridade",
    problems: ["baixa aplicação de IA", "lacuna de habilidades digitais", "dificuldade de escalar aprendizagem"], positiveSignals: ["agenda de IA", "upskilling", "transformação digital", "programas de jovens talentos"], negativeSignals: ["busca apenas por palestra pontual"],
    buyingAreas: ["RH", "T&D", "People", "Learning", "Transformação Digital", "Inovação"], decisionMakers: ["CHRO", "Diretor de RH", "Head de T&D", "Head de Learning", "Diretor de Transformação"], influencers: ["Gerente de T&D", "Gerente de DHO", "HRBP", "Head de Inovação"], champions: ["Learning", "Inovação", "lideranças com projetos de IA"],
  }],
  personas: [persona("Head de T&D", ["desenvolver capacidades", "priorizar programas", "medir impacto"], ["adesão", "aplicabilidade", "escala"], ["pressão por IA", "dificuldade de provar resultado"], ["conectar aprendizagem ao negócio"], ["orçamento", "tempo", "programa genérico"], ["prática", "jornada", "negócio"], ["agenda de IA", "upskilling"], ["Letramento em IA & Habilidades Digitais", "Projetos de IA & VibeCoding"])],
  authorityTerritories: [
    territory("IA aplicada ao trabalho", "Uso prático e responsável de IA para rotinas, decisões e produtividade.", ["IA aplicada", "produtividade", "automação"], ["IA para RH", "IA para áreas de negócio", "VibeCoding"], ["cases", "projetos", "aprendizados de sprint"]),
    territory("Habilidades para o futuro do trabalho", "Aprendizagem, empregabilidade e desenvolvimento digital conectados ao negócio.", ["habilidades digitais", "upskilling", "empregabilidade"], ["Education Recruiting", "jovens talentos", "inclusão produtiva"], ["programas", "metodologias", "resultados documentados"]),
  ],
  authorityWeightFocus: ["icp_relevance", "bu_themes", "theme_consistency", "published_content", "reference_potential"],
  contentDna: contentDna("consultivo, prático e humano", ["IA aplicada", "habilidades digitais", "aprendizagem aplicada", "impacto real"], ["IA aplicada a negócios", "futuro do trabalho", "upskilling", "Educação corporativa"]),
  documents: [{ title: "Apresentação Comercial Share 2026", kind: "presentation", status: "available", tags: ["Prosper", "produtos", "habilidades digitais"] }],
  updatedAt: "2026-09-02T00:00:00.000Z",
};

const personalDna: BusinessUnitDna = {
  id: "bu_personal",
  name: "Perfil pessoal / Visitante",
  shortName: "Perfil pessoal",
  slug: "perfil-pessoal",
  contextType: "personal",
  systemContext: true,
  status: "published",
  description: "Para profissionais que não pertencem a uma Unidade de Negócio e querem analisar o próprio posicionamento.",
  tagline: "Sua autoridade profissional, sem precisar caber em uma BU.",
  brandPack: { ...shareBrand, accent: "#2ef2ce", surface: "#f5fbf8", voice: "claro, respeitoso, profissional e orientado ao mercado da própria pessoa" },
  positioning: {
    whatWeAre: "Um contexto neutro de diagnóstico para profissionais independentes, autônomos, especialistas, executivos ou visitantes.",
    whatWeAreNot: "Não é uma BU comercial e não tenta encaixar a pessoa em produtos da Share.",
    problem: "Profissionais de qualquer área precisam comunicar experiência, confiança, diferenciação e oferta de forma compreensível para seu mercado.",
    transformation: "Tornar mais claro o que a pessoa sabe fazer, para quem gera valor e quais evidências sustentam sua reputação profissional.",
    whyExist: "Permitir que o diagnóstico de autoridade seja útil para qualquer profissão, sem impor contexto corporativo inadequado.",
    differentiators: ["contexto neutro", "foco em evidência", "objetivo definido pela própria pessoa", "linguagem adaptada à profissão"],
    proofPoints: [], competitors: [], recommendedTerms: ["experiência", "especialidade", "confiança", "reputação", "prova", "objetivo profissional"], avoidedTerms: ["BU", "ICP corporativo", "produto Share como destino obrigatório"],
  },
  products: [],
  icps: [],
  personas: [],
  authorityTerritories: [
    territory("Clareza profissional", "Capacidade de explicar o que faz, para quem e com qual diferencial.", ["especialidade", "serviço", "experiência"], ["posicionamento", "oferta", "público"], ["descrição do perfil", "portfólio", "experiências"]),
    territory("Confiança e prova", "Evidências que ajudam clientes, pares ou contratantes a confiar no trabalho apresentado.", ["prova", "reputação", "cases"], ["depoimentos", "resultados", "portfólio"], ["cases", "recomendações", "projetos", "resultados fornecidos"]),
  ],
  authorityWeightFocus: ["positioning", "credibility", "authority_proof", "about_clarity", "non_advertising_experience"],
  contentDna: contentDna("claro, profissional e natural", ["experiência", "prova", "utilidade", "confiança"], ["especialidade", "mercado", "aprendizados", "projetos"]),
  documents: [],
  updatedAt: "2026-09-02T00:00:00.000Z",
};

export const businessUnitCatalog: BusinessUnitDna[] = [sharePeopleHubDna, humanShipDna, prosperDna, personalDna];
export const businessContextCatalog = businessUnitCatalog;
export const defaultBusinessUnitId = prosperDna.id;

const legacyAliases: Record<string, string> = {
  bu_education_recruit: "bu_prosper",
};

export function getBusinessUnitDna(id: string) {
  const resolvedId = legacyAliases[id] ?? id;
  return businessUnitCatalog.find((unit) => unit.id === resolvedId) ?? businessUnitCatalog[0];
}

export function isPersonalBusinessContext(id: string) {
  return getBusinessUnitDna(id).contextType === "personal";
}

export function getBusinessUnitStarterInput(id: string) {
  const unit = getBusinessUnitDna(id);
  if (unit.contextType === "personal") {
    return {
      profileUrl: "",
      objective: "Fortalecer meu posicionamento profissional para ser reconhecido pelo valor que entrego no meu mercado.",
      headline: "", about: "", themes: "", proofPoints: "", recentContent: "", interactionSignals: "",
    };
  }
  const primaryIcp = unit.icps[0];
  const territories = unit.authorityTerritories.map((territory) => territory.name).join(", ");
  return {
    profileUrl: "",
    objective: primaryIcp
      ? `Ser reconhecido por ${primaryIcp.buyingAreas.join(", ")} como referência em ${territories || unit.name}.`
      : `Ser reconhecido por decisores relevantes como referência em ${unit.name}.`,
    headline: "", about: "", themes: "", proofPoints: "", recentContent: "", interactionSignals: "",
  };
}

export function buildBusinessUnitGuidance(id: string) {
  const unit = getBusinessUnitDna(id);
  return {
    contextType: unit.contextType,
    isPersonalContext: unit.contextType === "personal",
    name: unit.name,
    positioning: unit.positioning,
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

function product(name: string, description: string, problems: string[], audiences: string[], benefits: string[]): BusinessUnitProduct {
  return { name, description, problems, audiences, benefits, proofPoints: [], objections: [], cta: `Conversar sobre ${name}.`, keywords: [name] };
}

function persona(name: string, responsibilities: string[], kpis: string[], pains: string[], objectives: string[], objections: string[], language: string[], conversationTriggers: string[], relatedProducts: string[]): BusinessUnitPersona {
  return { name, responsibilities, kpis, pains, objectives, objections, language, conversationTriggers, relatedProducts };
}

function territory(name: string, description: string, keywords: string[], subthemes: string[], evidenceTypes: string[]): AuthorityTerritory {
  return { name, description, importance: "high", keywords, subthemes, evidenceTypes };
}

function contentDna(tone: string, recommendedTerms: string[], prioritySubjects: string[]): ContentDna {
  return {
    tone,
    formality: "medium",
    personality: ["claro", "consultivo", "confiável"],
    argumentStyle: ["problema concreto", "leitura especialista", "evidência", "próxima ação"],
    preferredStructures: ["Contexto -> leitura -> evidência -> ação"],
    recommendedTerms,
    forbiddenTerms: ["viralizar", "garantia de resultado", "promessa sem fonte"],
    recommendedCtas: ["abrir uma conversa", "aprofundar o contexto"],
    forbiddenCtas: ["compre agora", "garantia de ROI"],
    prioritySubjects,
    sensitiveSubjects: ["dados pessoais", "saúde", "política", "religião", "atributos protegidos"],
    approvedClaims: [],
    forbiddenClaims: ["números sem fonte", "resultados inventados", "atributos pessoais inferidos"],
  };
}
