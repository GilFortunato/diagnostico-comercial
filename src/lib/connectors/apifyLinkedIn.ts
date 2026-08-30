import "server-only";
import type { AuthorityInput, ResearchSource } from "@/lib/diagnostics/authority";
import { apifyActors } from "@/lib/connectors/apifyActors";
import { classifyValidationFailure } from "@/lib/connectors/credentialValidation";
import { PlatformResourceUnavailableError } from "@/lib/connectors/errors";
import { recordPlatformCredentialFailure } from "@/lib/connectors/platformCredentialService";
import { resolveApifyCredential } from "@/lib/connectors/platformCredentials";

type LinkedInExtraction = {
  input: Partial<AuthorityInput>;
  source: ResearchSource;
};

export async function extractLinkedInProfileWithApify(profileUrl: string): Promise<LinkedInExtraction | null> {
  const resolution = await resolveApifyCredential();
  if (!resolution.available || !resolution.credential) throw new PlatformResourceUnavailableError();

  const actorId = encodeActorId(process.env.APIFY_LINKEDIN_ACTOR_ID ?? apifyActors.linkedinProfile.actorId);
  const endpoint = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?timeout=120`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resolution.credential}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ urls: [profileUrl], queries: [profileUrl] }),
      signal: AbortSignal.timeout(130_000),
    });
  } catch {
    throw new PlatformResourceUnavailableError();
  }

  if (!response.ok) {
    await recordPlatformCredentialFailure("apify", resolution.source, classifyValidationFailure(response.status));
    throw new PlatformResourceUnavailableError();
  }

  const items = (await response.json()) as unknown[];
  const profile = items.find((item) => item && typeof item === "object") as Record<string, unknown> | undefined;
  if (!profile) return null;
  const input = mapProfileToAuthorityInput(profile);
  if (!hasExtractedProfileEvidence(input)) return null;

  return {
    input,
    source: {
      title: "Perfil público do LinkedIn",
      url: profileUrl,
      confidence: "likely",
      notes: "Informações obtidas por meio do conector de pesquisa autorizado para a URL informada.",
    },
  };
}

function encodeActorId(actorId: string) {
  return actorId.replace("/", "~");
}

function mapProfileToAuthorityInput(profile: Record<string, unknown>): Partial<AuthorityInput> {
  const headline = firstString(profile, ["headline", "title", "occupation", "currentPosition", "currentJobTitle"]);
  const about = firstString(profile, ["about", "summary", "description", "bio"]);
  const experience = listText(profile, ["experience", "experiences", "positions"]);
  const education = listText(profile, ["education", "educations"]);
  const skills = listText(profile, ["skills"]);
  const certifications = listText(profile, ["certifications", "certificates"]);
  const recentContent = listText(profile, ["posts", "activities", "recentPosts"]);

  return {
    headline,
    about: joinSections([about, experience]),
    themes: joinSections([skills, certifications]),
    proofPoints: joinSections([experience, education, certifications]),
    recentContent,
    interactionSignals: joinSections([firstString(profile, ["connections", "followers", "location"]), recentContent]),
  };
}

function firstString(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function listText(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    const text = valueToText(value);
    if (text) return text;
  }
  return "";
}

function valueToText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(valueToText).filter(Boolean).join(" | ");
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map(valueToText)
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

function joinSections(values: string[]) {
  return values.filter(Boolean).join("\n\n");
}

function hasExtractedProfileEvidence(input: Partial<AuthorityInput>) {
  return [input.headline, input.about, input.themes, input.proofPoints, input.recentContent, input.interactionSignals]
    .some((value) => typeof value === "string" && value.trim().length >= 3);
}
