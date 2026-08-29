export type ConnectorCapability =
  | "profile.read"
  | "research.publicBusinessProfile"
  | "content.analyze"
  | "network.evaluate"
  | "posts.read"
  | "company.read"
  | "decisionMakers.find"
  | "calendar.read"
  | "message.preview"
  | "externalAction.requestApproval"
  | "ai.generateStructuredAssessment";

export type ConnectorDefinition = {
  key: string;
  name: string;
  kind: "ai_provider" | "data_source" | "communication" | "crm" | "browser_automation";
  status: "disconnected" | "connected" | "needs_attention";
  capabilities: ConnectorCapability[];
  requiresSeparateConsent: boolean;
};

export const connectorCatalog: ConnectorDefinition[] = [
  {
    key: "google-login",
    name: "Google Login",
    kind: "communication",
    status: "needs_attention",
    capabilities: [],
    requiresSeparateConsent: false,
  },
  {
    key: "google-gemini",
    name: "Conectar IA Google / Gemini",
    kind: "ai_provider",
    status: "disconnected",
    capabilities: ["ai.generateStructuredAssessment"],
    requiresSeparateConsent: true,
  },
  {
    key: "linkedin-account",
    name: "Conectar LinkedIn",
    kind: "data_source",
    status: "disconnected",
    capabilities: ["profile.read", "content.analyze", "network.evaluate"],
    requiresSeparateConsent: true,
  },
  {
    key: "apify-linkedin-profile",
    name: "Apify LinkedIn Profile",
    kind: "data_source",
    status: "disconnected",
    capabilities: ["profile.read"],
    requiresSeparateConsent: true,
  },
  {
    key: "apify-linkedin-profile-posts",
    name: "Apify LinkedIn Profile Posts",
    kind: "data_source",
    status: "disconnected",
    capabilities: ["posts.read", "content.analyze"],
    requiresSeparateConsent: true,
  },
  {
    key: "apify-linkedin-company",
    name: "Apify LinkedIn Company",
    kind: "data_source",
    status: "disconnected",
    capabilities: ["company.read"],
    requiresSeparateConsent: true,
  },
  {
    key: "apify-linkedin-company-employees",
    name: "Apify LinkedIn Company Employees",
    kind: "data_source",
    status: "disconnected",
    capabilities: ["decisionMakers.find", "network.evaluate"],
    requiresSeparateConsent: true,
  },
  {
    key: "public-web-research",
    name: "Pesquisa pública permitida",
    kind: "data_source",
    status: "disconnected",
    capabilities: ["research.publicBusinessProfile"],
    requiresSeparateConsent: true,
  },
];
