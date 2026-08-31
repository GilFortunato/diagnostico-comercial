import "server-only";
import type { AuthorityInput, ResearchSource } from "@/lib/diagnostics/authority";
import { apifyActors } from "@/lib/connectors/apifyActors";
import { runApifyActor } from "@/lib/connectors/apifyClient";
import {
  buildAuthorityInputFromLinkedIn,
  normalizeLinkedInPayload,
  type NormalizedLinkedInSnapshot,
} from "@/lib/connectors/linkedinNormalization";

export type LinkedInAuthorityExtraction = {
  input: Partial<AuthorityInput>;
  sources: ResearchSource[];
  snapshot: NormalizedLinkedInSnapshot;
};

export async function extractLinkedInAuthorityWithApify(profileUrl: string): Promise<LinkedInAuthorityExtraction | null> {
  const profileItems = await runApifyActor("linkedinProfile", {
    ...apifyActors.linkedinProfile.defaultInput,
    urls: [profileUrl],
    queries: [profileUrl],
  });
  const profile = profileItems.find(isRecord) ?? null;
  if (!profile) return null;

  let postItems: unknown[] = [];
  try {
    postItems = await runApifyActor("linkedinProfilePosts", {
      ...apifyActors.linkedinProfilePosts.defaultInput,
      targetUrls: [profileUrl],
      maxPosts: 8,
    });
  } catch {
    // Profile evidence remains useful when the optional posts source is temporarily unavailable.
  }

  const snapshot = normalizeLinkedInPayload({ profileUrl, profile, posts: postItems });
  const input = buildAuthorityInputFromLinkedIn(snapshot);
  if (!hasExtractedProfileEvidence(input)) return null;

  const sources: ResearchSource[] = [{
    title: "Perfil público do LinkedIn",
    url: profileUrl,
    confidence: "likely",
    notes: "Dados públicos normalizados semanticamente a partir da fonte autorizada.",
  }];
  if (snapshot.postsAvailable) {
    sources.push({
      title: "Publicações públicas recentes",
      url: profileUrl,
      confidence: "likely",
      notes: `${snapshot.posts.length} publicações recentes foram preservadas no snapshot deste diagnóstico.`,
    });
  }

  return { input, sources, snapshot };
}

export async function extractLinkedInProfileWithApify(profileUrl: string) {
  const extraction = await extractLinkedInAuthorityWithApify(profileUrl);
  if (!extraction) return null;
  return { input: extraction.input, source: extraction.sources[0] };
}

function hasExtractedProfileEvidence(input: Partial<AuthorityInput>) {
  return [input.headline, input.about, input.themes, input.proofPoints, input.recentContent]
    .some((value) => typeof value === "string" && value.trim().length >= 3);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
