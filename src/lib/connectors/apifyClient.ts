import "server-only";
import { apifyActors, type ApifyActorKey } from "@/lib/connectors/apifyActors";
import { classifyValidationFailure } from "@/lib/connectors/credentialValidation";
import { PlatformResourceUnavailableError } from "@/lib/connectors/errors";
import { recordPlatformCredentialFailure } from "@/lib/connectors/platformCredentialService";
import { resolveApifyCredential } from "@/lib/connectors/platformCredentials";
import type { PlatformCredentialResolution } from "@/lib/connectors/platformCredentialCore";

export type ApifyRunMetadata = {
  actorId: string;
  itemCount: number;
};

export async function runApifyActor(actorKey: ApifyActorKey, input: Record<string, unknown>) {
  const resolution = await resolveApifyCredential();
  if (!resolution.available || !resolution.credential) throw new PlatformResourceUnavailableError();

  if (actorKey !== "linkedinProfileSearch") {
    return runActorRequest(actorKey, input, resolution);
  }

  // Harvest continua sendo a fonte principal. Quando ele responde vazio ou falha,
  // a mesma credencial Apify é reaproveitada em uma fonte pública de contingência.
  try {
    const primaryItems = await runActorRequest(actorKey, input, resolution);
    if (primaryItems.length) return primaryItems;
    console.info("[apify] profile search returned empty; activating public fallback", {
      actorKey,
      source: resolution.source,
      masked: resolution.masked,
    });
  } catch (error) {
    console.warn("[apify] profile search failed; activating public fallback", {
      actorKey,
      source: resolution.source,
      masked: resolution.masked,
    });
    try {
      return await runActorRequest("linkedinProfileSearchFallback", toPublicProfileFallbackInput(input), resolution);
    } catch {
      throw error;
    }
  }

  return runActorRequest("linkedinProfileSearchFallback", toPublicProfileFallbackInput(input), resolution);
}

async function runActorRequest(
  actorKey: ApifyActorKey,
  input: Record<string, unknown>,
  resolution: PlatformCredentialResolution,
) {
  if (!resolution.credential) throw new PlatformResourceUnavailableError();

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
    console.warn("[apify] actor request failed before response", {
      actorKey,
      actorId,
      source: resolution.source,
      masked: resolution.masked,
    });
    throw new PlatformResourceUnavailableError();
  }

  if (!response.ok) {
    console.warn("[apify] actor returned non-success status", {
      actorKey,
      actorId,
      status: response.status,
      source: resolution.source,
      masked: resolution.masked,
    });
    if ([401, 402, 403, 429].includes(response.status) || response.status >= 500) {
      await recordPlatformCredentialFailure("apify", resolution.source, classifyValidationFailure(response.status));
    }
    throw new PlatformResourceUnavailableError();
  }

  const payload = (await response.json()) as unknown;
  const items = Array.isArray(payload) ? payload : [];
  console.info("[apify] actor completed", {
    actorKey,
    actorId,
    itemCount: items.length,
    source: resolution.source,
    masked: resolution.masked,
  });
  return items;
}

function toPublicProfileFallbackInput(input: Record<string, unknown>) {
  const currentJobTitles = stringArray(input.currentJobTitles);
  const currentCompanies = stringArray(input.currentCompanies).map(companySearchName).filter(Boolean);
  const searchParts = [typeof input.searchQuery === "string" ? input.searchQuery.trim() : "", ...currentJobTitles]
    .filter(Boolean);
  const maxItems = typeof input.maxItems === "number" && Number.isFinite(input.maxItems)
    ? Math.min(120, Math.max(1, Math.floor(input.maxItems)))
    : 25;

  return compactInput({
    searchQuery: [...new Set(searchParts)].join(" OR ") || undefined,
    locations: stringArray(input.locations).slice(0, 20),
    currentCompanies: currentCompanies.slice(0, 10),
    maxItems,
  });
}

function companySearchName(value: string) {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    const companyIndex = parts.indexOf("company");
    if (companyIndex >= 0 && parts[companyIndex + 1]) return parts[companyIndex + 1].replace(/[-_]+/g, " ");
  } catch {
    // Já pode ser um nome em vez de URL.
  }
  return value.trim();
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
}

function compactInput(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => {
    if (value === undefined || value === null || value === "") return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  }));
}

function configuredActorId(actorKey: ApifyActorKey) {
  const variables: Partial<Record<ApifyActorKey, string | undefined>> = {
    linkedinProfile: process.env.APIFY_LINKEDIN_ACTOR_ID,
    linkedinProfilePosts: process.env.APIFY_LINKEDIN_POSTS_ACTOR_ID,
    linkedinProfileSearch: process.env.APIFY_LINKEDIN_PROFILE_SEARCH_ACTOR_ID,
    linkedinProfileSearchFallback: process.env.APIFY_LINKEDIN_PROFILE_SEARCH_FALLBACK_ACTOR_ID,
    linkedinCompanyEmployees: process.env.APIFY_LINKEDIN_EMPLOYEES_ACTOR_ID,
    linkedinCompanyEmployeesFallback: process.env.APIFY_LINKEDIN_EMPLOYEES_FALLBACK_ACTOR_ID,
    linkedinCompanyDetails: process.env.APIFY_LINKEDIN_COMPANY_ACTOR_ID,
    linkedinCompanySearch: process.env.APIFY_LINKEDIN_COMPANY_SEARCH_ACTOR_ID,
    leadDiscovery: process.env.APIFY_LEAD_DISCOVERY_ACTOR_ID,
  };
  return variables[actorKey]?.trim() || undefined;
}

function encodeActorId(actorId: string) {
  return actorId.replace("/", "~");
}
