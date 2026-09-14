import type { AuthorityAssessment, AuthorityInput, ResearchSource } from "@/lib/diagnostics/authority";
import { buildAuthorityInputFromLinkedIn, type NormalizedLinkedInSnapshot } from "@/lib/connectors/linkedinNormalization";
import { mergeLinkedInSnapshots } from "@/lib/connectors/linkedinSnapshotMerge";
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

  const mergedSnapshot = mergeLinkedInSnapshots(input.linkedinSnapshot, extraction?.snapshot);
  const mergedFromSnapshot = mergedSnapshot ? buildAuthorityInputFromLinkedIn(mergedSnapshot) : null;
  const enrichedInput = {
    ...input,
    headline: mergedFromSnapshot?.headline || extraction?.input.headline || input.headline,
    about: mergedFromSnapshot?.about || extraction?.input.about || input.about,
    themes: mergedFromSnapshot?.themes || extraction?.input.themes || input.themes,
    proofPoints: mergedFromSnapshot?.proofPoints || extraction?.input.proofPoints || input.proofPoints,
    recentContent: mergedFromSnapshot?.recentContent || extraction?.input.recentContent || input.recentContent,
    interactionSignals: mergedFromSnapshot?.interactionSignals || extraction?.input.interactionSignals || input.interactionSignals,
    linkedinSnapshot: mergedSnapshot ?? extraction?.snapshot ?? input.linkedinSnapshot,
  };

  const extractionSources = extraction?.sources ?? (extraction?.source ? [extraction.source] : []);
  const importedSource: ResearchSource[] = input.linkedinSnapshot ? [{
    title: "Arquivo oficial do LinkedIn fornecido pelo usuário",
    confidence: "confirmed",
    notes: "Dados importados do arquivo de portabilidade solicitado pelo próprio titular da conta. O arquivo bruto não é armazenado pela Share AI.",
  }] : [];
  const sources = [...importedSource, ...extractionSources];
  return dependencies.createAssessment(enrichedInput, sources);
}

function hasManualProfileEvidence(input: AuthorityInput) {
  return [input.headline, input.about, input.themes, input.proofPoints, input.recentContent, input.interactionSignals]
    .some((value) => value.trim().length >= 8);
}
