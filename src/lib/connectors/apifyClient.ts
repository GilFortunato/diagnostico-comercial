import "server-only";
import { apifyActors, type ApifyActorKey } from "@/lib/connectors/apifyActors";
import { classifyValidationFailure } from "@/lib/connectors/credentialValidation";
import { PlatformResourceUnavailableError } from "@/lib/connectors/errors";
import { recordPlatformCredentialFailure } from "@/lib/connectors/platformCredentialService";
import { resolveApifyCredential } from "@/lib/connectors/platformCredentials";

export type ApifyRunMetadata = {
  actorId: string;
  itemCount: number;
};

export async function runApifyActor(actorKey: ApifyActorKey, input: Record<string, unknown>) {
  const resolution = await resolveApifyCredential();
  if (!resolution.available || !resolution.credential) throw new PlatformResourceUnavailableError();

  const configuredId = configuredActorId(actorKey);
  const actorId = configuredId ?? apifyActors[actorKey].actorId;
  const endpoint = `https://api.apify.com/v2/acts/${encodeActorId(actorId)}/run-sync-get-dataset-items?timeout=120`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resolution.credential}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(130_000),
    });
  } catch {
    throw new PlatformResourceUnavailableError();
  }

  if (!response.ok) {
    if ([401, 402, 403, 429].includes(response.status) || response.status >= 500) {
      await recordPlatformCredentialFailure("apify", resolution.source, classifyValidationFailure(response.status));
    }
    throw new PlatformResourceUnavailableError();
  }

  const payload = (await response.json()) as unknown;
  return Array.isArray(payload) ? payload : [];
}

function configuredActorId(actorKey: ApifyActorKey) {
  const variables: Partial<Record<ApifyActorKey, string | undefined>> = {
    linkedinProfile: process.env.APIFY_LINKEDIN_ACTOR_ID,
    linkedinProfilePosts: process.env.APIFY_LINKEDIN_POSTS_ACTOR_ID,
    linkedinProfileSearch: process.env.APIFY_LINKEDIN_PROFILE_SEARCH_ACTOR_ID,
    linkedinCompanyEmployees: process.env.APIFY_LINKEDIN_EMPLOYEES_ACTOR_ID,
    linkedinCompanyDetails: process.env.APIFY_LINKEDIN_COMPANY_ACTOR_ID,
    linkedinCompanySearch: process.env.APIFY_LINKEDIN_COMPANY_SEARCH_ACTOR_ID,
    leadDiscovery: process.env.APIFY_LEAD_DISCOVERY_ACTOR_ID,
  };
  return variables[actorKey]?.trim() || undefined;
}

function encodeActorId(actorId: string) {
  return actorId.replace("/", "~");
}
