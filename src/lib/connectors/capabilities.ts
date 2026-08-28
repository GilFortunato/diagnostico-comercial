export type ConnectorCapability =
  | "profile.read"
  | "research.publicBusinessProfile"
  | "content.analyze"
  | "network.evaluate"
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
    key: "public-web-research",
    name: "Pesquisa publica permitida",
    kind: "data_source",
    status: "disconnected",
    capabilities: ["research.publicBusinessProfile"],
    requiresSeparateConsent: true,
  },
];
