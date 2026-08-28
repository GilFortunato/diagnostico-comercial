export type AiCapability =
  | "ai.generateStructuredAssessment"
  | "ai.generateContentPlan"
  | "ai.summarizeSources"
  | "ai.extractEvidence";

export type AiProvider = {
  key: string;
  label: string;
  capabilities: AiCapability[];
  requiresUserCredential: boolean;
};

export const aiProviders: AiProvider[] = [
  {
    key: "gemini",
    label: "Google Gemini",
    capabilities: ["ai.generateStructuredAssessment", "ai.generateContentPlan", "ai.summarizeSources", "ai.extractEvidence"],
    requiresUserCredential: true,
  },
];

export function resolveProviderForCapability(capability: AiCapability, preferredKey?: string) {
  const preferred = aiProviders.find((provider) => provider.key === preferredKey && provider.capabilities.includes(capability));
  return preferred ?? aiProviders.find((provider) => provider.capabilities.includes(capability));
}
