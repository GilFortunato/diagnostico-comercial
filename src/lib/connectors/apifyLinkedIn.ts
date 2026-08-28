import "server-only";
import type { AuthorityInput, ResearchSource } from "@/lib/diagnostics/authority";

type LinkedInExtraction = {
  input: Partial<AuthorityInput>;
  source: ResearchSource;
};

const defaultActorId = "unseenuser/linkedin-profile";

export async function extractLinkedInProfileWithApify(profileUrl: string, token: string): Promise<LinkedInExtraction | null> {
  const actorId = encodeActorId(process.env.APIFY_LINKEDIN_ACTOR_ID ?? defaultActorId);
  const endpoint = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=120`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      urls: [profileUrl],
      queries: [profileUrl],
    }),
  });

  if (!response.ok) {
    throw new Error("A coleta via Apify nao retornou dados.");
  }

  const items = (await response.json()) as unknown[];
  const profile = items.find((item) => item && typeof item === "object") as Record<string, unknown> | undefined;
  if (!profile) return null;

  return {
    input: mapProfileToAuthorityInput(profile),
    source: {
      title: "Perfil publico do LinkedIn coletado via Apify",
      url: profileUrl,
      confidence: "likely",
      notes: "Dados retornados pelo Actor unseenuser/linkedin-profile para a URL informada pelo usuario.",
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
