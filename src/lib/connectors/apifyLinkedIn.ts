import "server-only";
import type { AuthorityInput, ResearchSource } from "@/lib/diagnostics/authority";
import { apifyActors, type ApifyActorKey } from "@/lib/connectors/apifyActors";
import { classifyValidationFailure } from "@/lib/connectors/credentialValidation";
import { PlatformResourceUnavailableError } from "@/lib/connectors/errors";
import { recordPlatformCredentialFailure } from "@/lib/connectors/platformCredentialService";
import { resolveApifyCredential } from "@/lib/connectors/platformCredentials";
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
  const resolution = await resolveApifyCredential();
  if (!resolution.available || !resolution.credential) throw new PlatformResourceUnavailableError();

  const profileItems = await runActor({
    actorKey: "linkedinProfile",
    credential: resolution.credential,
    credentialSource: resolution.source,
    input: { ...apifyActors.linkedinProfile.defaultInput, urls: [profileUrl], queries: [profileUrl] },
  });
  const profile = profileItems.find(isRecord) ?? null;
  if (!profile) return null;

  let postItems: unknown[] = [];
  try {
    postItems = await runActor({
      actorKey: "linkedinProfilePosts",
      credential: resolution.credential,
      credentialSource: resolution.source,
      input: { ...apifyActors.linkedinProfilePosts.defaultInput, targetUrls: [profileUrl], maxPosts: 8 },
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

async function runActor({ actorKey, credential, credentialSource, input }: {
  actorKey: ApifyActorKey;
  credential: string;
  credentialSource: "managed" | "environment" | null;
  input: Record<string, unknown>;
}) {
  const configuredId = actorKey === "linkedinProfile"
    ? process.env.APIFY_LINKEDIN_ACTOR_ID
    : actorKey === "linkedinProfilePosts"
      ? process.env.APIFY_LINKEDIN_POSTS_ACTOR_ID
      : undefined;
  const actorId = encodeActorId(configuredId ?? apifyActors[actorKey].actorId);
  const endpoint = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?timeout=120`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(130_000),
    });
  } catch {
    throw new PlatformResourceUnavailableError();
  }

  if (!response.ok) {
    if ([401, 402, 403, 429].includes(response.status) || response.status >= 500) {
      await recordPlatformCredentialFailure("apify", credentialSource, classifyValidationFailure(response.status));
    }
    throw new PlatformResourceUnavailableError();
  }

  const items = (await response.json()) as unknown;
  return Array.isArray(items) ? items : [];
}

function encodeActorId(actorId: string) {
  return actorId.replace("/", "~");
}

function hasExtractedProfileEvidence(input: Partial<AuthorityInput>) {
  return [input.headline, input.about, input.themes, input.proofPoints, input.recentContent]
    .some((value) => typeof value === "string" && value.trim().length >= 3);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
