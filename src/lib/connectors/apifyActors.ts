export type ApifyActorKey =
  | "linkedinProfile"
  | "linkedinProfilePosts"
  | "linkedinProfileSearch"
  | "linkedinCompanyEmployees"
  | "linkedinCompanyEmployeesFallback"
  | "linkedinCompanyDetails"
  | "linkedinCompanySearch"
  | "leadDiscovery";

export type ApifyActorDefinition = {
  key: ApifyActorKey;
  actorId: string;
  label: string;
  purpose: string;
  stage: "authority" | "rapport" | "decision_maker";
  defaultInput: Record<string, unknown>;
};

export const apifyActors: Record<ApifyActorKey, ApifyActorDefinition> = {
  linkedinProfile: {
    key: "linkedinProfile",
    actorId: "unseenuser/linkedin-profile",
    label: "Perfil pessoal",
    purpose: "Extrair headline, sobre, experiências, educação, habilidades e certificações do perfil público.",
    stage: "authority",
    defaultInput: { urls: [] },
  },
  linkedinProfilePosts: {
    key: "linkedinProfilePosts",
    actorId: "harvestapi/linkedin-profile-posts",
    label: "Posts do perfil",
    purpose: "Coletar posts públicos, engajamento, comentários e mídia para avaliar consistência de autoridade.",
    stage: "authority",
    defaultInput: {
      targetUrls: [],
      maxPosts: 5,
      includeQuotePosts: true,
      includeReposts: true,
    },
  },
  linkedinProfileSearch: {
    key: "linkedinProfileSearch",
    actorId: "dami_studio/linkedin-profile-search-scraper",
    label: "Busca pública de profissionais",
    purpose: "Buscar profissionais públicos por cargo, localização e empresa sem depender de login, cookie ou trial do Harvest.",
    stage: "decision_maker",
    defaultInput: {
      maxItems: 25,
    },
  },
  linkedinCompanyEmployees: {
    key: "linkedinCompanyEmployees",
    actorId: "dami_studio/linkedin-company-employees-scraper",
    label: "Funcionários públicos da empresa",
    purpose: "Mapear colaboradores públicos por empresa, cargo e localização sem depender do Actor Harvest limitado por trial.",
    stage: "decision_maker",
    defaultInput: {
      companies: [],
      resultsLimit: 25,
      jobTitles: [],
      locations: [],
      includeMentions: false,
    },
  },
  linkedinCompanyEmployeesFallback: {
    key: "linkedinCompanyEmployeesFallback",
    actorId: "apt_marble/linkedin-company-employees-scraper",
    label: "Funcionários públicos da empresa · fallback",
    purpose: "Segunda fonte pública de funcionários por empresa quando o Actor principal não responder ou não retornar cobertura.",
    stage: "decision_maker",
    defaultInput: {
      companyUrls: [],
      proMode: false,
      maxEmployees: 50,
    },
  },
  linkedinCompanyDetails: {
    key: "linkedinCompanyDetails",
    actorId: "harvestapi/linkedin-company",
    label: "Dados da empresa",
    purpose: "Coletar dados públicos da página da empresa para contexto comercial e personalização.",
    stage: "rapport",
    defaultInput: {
      companies: [],
    },
  },
  linkedinCompanySearch: {
    key: "linkedinCompanySearch",
    actorId: "harvestapi/linkedin-company-search",
    label: "Busca pública de empresas",
    purpose: "Buscar páginas públicas de empresas por termos e localização usando filtros suportados pelo Harvest.",
    stage: "decision_maker",
    defaultInput: {
      scraperMode: "short",
      maxItems: 25,
    },
  },
  leadDiscovery: {
    key: "leadDiscovery",
    actorId: "peakydev/leads-scraper-ppe",
    label: "Descoberta ampla alternativa",
    purpose: "Fonte alternativa de descoberta ampla; não deve ser o caminho crítico enquanto o Actor estiver instável.",
    stage: "decision_maker",
    defaultInput: {
      totalResults: 100,
      employeePerCompany: ["4"],
    },
  },
};

export function getApifyActor(actorKey: ApifyActorKey) {
  return apifyActors[actorKey];
}
