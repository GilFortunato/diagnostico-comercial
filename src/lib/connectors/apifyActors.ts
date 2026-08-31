export type ApifyActorKey =
  | "linkedinProfile"
  | "linkedinProfilePosts"
  | "linkedinCompanyEmployees"
  | "linkedinCompanyDetails"
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
  linkedinCompanyEmployees: {
    key: "linkedinCompanyEmployees",
    actorId: "harvestapi/linkedin-company-employees",
    label: "Funcionários da empresa",
    purpose: "Mapear colaboradores e filtrar possíveis decisores para a etapa de rapport.",
    stage: "decision_maker",
    defaultInput: {
      companies: [],
      maxItems: 25,
      profileScraperMode: "Basic ($3 per 1k)",
      companyBatchMode: "all_at_once",
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
  leadDiscovery: {
    key: "leadDiscovery",
    actorId: "peakydev/leads-scraper-ppe",
    label: "Descoberta ampla de empresas e pessoas",
    purpose: "Descobrir empresas ou profissionais por filtros públicos de mercado, cargo e senioridade.",
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
