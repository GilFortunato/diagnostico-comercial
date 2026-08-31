import type { AuthorityAssessment, AuthorityInput, ResearchSource } from "@/lib/diagnostics/authority";
import type { NormalizedLinkedInSnapshot } from "@/lib/connectors/linkedinNormalization";
import { PlatformResourceUnavailableError } from "@/lib/connectors/errors";

type LinkedInExtraction = {
  input: Partial<AuthorityInput>;
  sources?: ResearchSource[];
  source?: ResearchSource;
  snapshot?: NormalizedLinkedInSnapshot;
} | null;

export class InsufficientPublicProfileDataError extends Error {
  constructor() {
    super("Não foi possível recuperar dados públicos suficientes deste perfil.");
    this.name = "InsufficientPublicProfileDataError";
  }
}

export async function executeAuthorityPipeline(
  input: AuthorityInput,
  dependencies: {
    extractProfile: (profileUrl: string) => Promise<LinkedInExtraction>;
    createAssessment: (input: AuthorityInput, sources: ResearchSource[]) => Promise<AuthorityAssessment>;
  },
) {
  let extraction: LinkedInExtraction = null;
  if (input.profileUrl) {
    try {
      extraction = await dependencies.extractProfile(input.profileUrl);
    } catch (error) {
      if (!(error instanceof PlatformResourceUnavailableError) || !hasManualProfileEvidence(input)) throw error;
    }
  }

  if (input.profileUrl && !extraction && !hasManualProfileEvidence(input)) {
    throw new InsufficientPublicProfileDataError();
  }

  const enrichedInput = {
    ...input,
    headline: extraction?.input.headline || input.headline,
    about: extraction?.input.about || input.about,
    themes: extraction?.input.themes || input.themes,
    proofPoints: extraction?.input.proofPoints || input.proofPoints,
    recentContent: extraction?.input.recentContent || input.recentContent,
    interactionSignals: extraction?.input.interactionSignals || input.interactionSignals,
    linkedinSnapshot: extraction?.snapshot ?? input.linkedinSnapshot,
  };
  const sources = extraction?.sources ?? (extraction?.source ? [extraction.source] : []);
  return dependencies.createAssessment(enrichedInput, sources);
}

function hasManualProfileEvidence(input: AuthorityInput) {
  return [input.headline, input.about, input.themes, input.proofPoints, input.recentContent, input.interactionSignals]
    .some((value) => value.trim().length >= 8);
}
