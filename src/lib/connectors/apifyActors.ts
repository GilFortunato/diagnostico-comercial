export type ApifyActorKey = "linkedinProfile" | "linkedinProfilePosts" | "linkedinCompanyEmployees" | "linkedinCompanyDetails";

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
    label: "Funcionarios da empresa",
    purpose: "Mapear colaboradores e filtrar possíveis decisores para a etapa de rapport.",
    stage: "decision_maker",
    defaultInput: {
      companies: [],
      maxProfiles: 25,
      profileScraperMode: "Full",
    },
  },
  linkedinCompanyDetails: {
    key: "linkedinCompanyDetails",
    actorId: "harvestapi/linkedin-company",
    label: "Dados da empresa",
    purpose: "Coletar dados públicos da página da empresa para contexto comercial e personalização.",
    stage: "rapport",
    defaultInput: {
      companyLinkedinUrls: [],
    },
  },
};

export function getApifyActor(actorKey: ApifyActorKey) {
  return apifyActors[actorKey];
}
