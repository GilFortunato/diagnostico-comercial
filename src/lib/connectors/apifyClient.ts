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

export async function runApifyActor(actorKey: ApifyActorKey, input: Record<string, unknown>, options: { timeoutMs?: number; allowFallback?: boolean } = {}) {
  const resolution = await resolveApifyCredential();
  if (!resolution.available || !resolution.credential) throw new PlatformResourceUnavailableError();

  const deadline = Date.now() + Math.min(130_000, options.timeoutMs ?? 130_000);
  if (actorKey !== "linkedinProfileSearch" || options.allowFallback === false || Number(input.startPage ?? 1) > 1) {
    return runActorRequest(actorKey, input, resolution, deadline);
  }

  // Harvest continua sendo a fonte principal. Quando ele responde vazio ou falha,
  // a mesma credencial Apify é reaproveitada em uma fonte pública de contingência.
  try {
    const primaryItems = await runActorRequest(actorKey, input, resolution, deadline);
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
      return await runActorRequest("linkedinProfileSearchFallback", input, resolution, deadline);
    } catch {
      throw error;
    }
  }

  return runActorRequest("linkedinProfileSearchFallback", input, resolution, deadline);
}

async function runActorRequest(
  actorKey: ApifyActorKey,
  input: Record<string, unknown>,
  resolution: PlatformCredentialResolution,
  deadline: number,
) {
  if (!resolution.credential) throw new PlatformResourceUnavailableError();

  const configuredId = configuredActorId(actorKey);
  const actorId = configuredId ?? apifyActors[actorKey].actorId;
  const isDamiFallback = actorKey === "linkedinProfileSearchFallback"
    && encodeActorId(actorId) === encodeActorId(apifyActors.linkedinProfileSearchFallback.actorId);
  const actorInput = actorKey === "linkedinProfileSearchFallback"
    ? toPublicProfileFallbackInput(input, isDamiFallback)
    : input;
  const timeoutMs = deadline - Date.now();
  if (timeoutMs < 1_000) throw new PlatformResourceUnavailableError();
  const endpoint = `https://api.apify.com/v2/acts/${encodeActorId(actorId)}/run-sync-get-dataset-items?timeout=${Math.min(120, Math.floor(timeoutMs / 1_000))}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resolution.credential}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(actorInput),
      signal: AbortSignal.timeout(timeoutMs),
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
    const payload = await response.json().catch(() => null);
    const errorType = payload?.error?.type;
    console.warn("[apify] actor returned non-success status", {
      actorKey,
      actorId,
      status: response.status,
      errorType: typeof errorType === "string" && /^[a-z-]{1,80}$/.test(errorType) ? errorType : undefined,
      source: resolution.source,
      masked: resolution.masked,
    });
    if ([401, 402, 403, 429].includes(response.status) || response.status >= 500) {
      await recordPlatformCredentialFailure("apify", resolution.source, classifyValidationFailure(response.status));
    }
    throw new PlatformResourceUnavailableError();
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) throw new PlatformResourceUnavailableError();
  const items = isDamiFallback ? readPublicProfileFallbackItems(payload) : payload;
  console.info("[apify] actor completed", {
    actorKey,
    actorId,
    itemCount: items.length,
    // Schema keys only: diagnose Actor format changes without logging profile values.
    fields: items[0] && typeof items[0] === "object" ? Object.keys(items[0]).slice(0, 30) : [],
    source: resolution.source,
    masked: resolution.masked,
  });
  return items;
}

export function toPublicProfileFallbackInput(input: Record<string, unknown>, useDamiSchema = true) {
  const currentJobTitles = [...new Set(stringArray(input.currentJobTitles))];
  const currentCompanies = stringArray(input.currentCompanies).map(companySearchName).filter(Boolean).slice(0, 10);
  const locations = stringArray(input.locations);
  const searchQuery = typeof input.searchQuery === "string" ? input.searchQuery.trim() : "";
  const maxItems = typeof input.maxItems === "number" && Number.isFinite(input.maxItems)
    ? Math.min(120, Math.max(1, Math.floor(input.maxItems)))
    : 25;

  if (!useDamiSchema) {
    return compactInput({ searchQuery: searchQuery.slice(0, 300), currentJobTitles: currentJobTitles.slice(0, 20), locations: locations.slice(0, 20), currentCompanies, maxItems });
  }
  const searchQueries = [...new Set(searchQuery.split(/\s+OR\s+/).map((term) => term.trim()).filter(Boolean))].slice(0, Math.min(20, maxItems));
  return compactInput({
    searchQueries,
    currentJobTitles: currentJobTitles.slice(0, 10),
    locations: locations.slice(0, 10),
    currentCompanies,
    maxProfiles: Math.floor(maxItems / (searchQueries.length || 1)),
  });
}

export function readPublicProfileFallbackItems(payload: unknown[]) {
  const rows = payload.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
  const profiles = rows.filter((row) => row.ok === true && row.recordType === "profile");
  const failures = rows.filter((row) => row.ok === false && row.errorCode !== "NO_RESULTS");
  if (failures.length) {
    const codes = [...new Set(failures.map((row) => row.errorCode))]
      .filter((code): code is string => typeof code === "string" && /^[A-Z_]{1,50}$/.test(code));
    console.warn("[apify] fallback search returned diagnostics", { codes, profileCount: profiles.length });
  }
  const empty = rows.length === payload.length && rows.every((row) => row.errorCode === "NO_RESULTS" || row._sample === true);
  if (!profiles.length && !empty) {
    throw new PlatformResourceUnavailableError();
  }
  return profiles;
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
    publicJobSearch: process.env.APIFY_PUBLIC_JOB_SEARCH_ACTOR_ID,
  };
  return variables[actorKey]?.trim() || undefined;
}

function encodeActorId(actorId: string) {
  return actorId.replace("/", "~");
}
