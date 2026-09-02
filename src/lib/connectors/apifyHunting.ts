import "server-only";
import { apifyActors } from "@/lib/connectors/apifyActors";
import { runApifyActor } from "@/lib/connectors/apifyClient";
import type { CompanySearchInput, PersonSearchInput } from "@/lib/decision-makers/search";

export function buildCompanyDiscoveryInput(input: CompanySearchInput) {
  const queryTerms = uniqueStrings([
    ...input.filters.keywords,
    ...input.filters.industries,
    ...input.filters.technologies,
    ...input.filters.domains,
  ]).slice(0, 6);
  const locations = uniqueStrings([
    ...input.filters.cityPostalCodes,
    ...input.filters.states,
    input.filters.country,
  ]).slice(0, 20);

  return compactInput({
    ...apifyActors.linkedinCompanySearch.defaultInput,
    scraperMode: "short",
    maxItems: input.filters.quantity,
    searchQuery: queryTerms.length ? queryTerms.join(" OR ") : undefined,
    locations,
  });
}

export function buildHarvestPeopleInput(input: PersonSearchInput) {
  const searchTerms = uniqueStrings([
    ...input.filters.roles,
    ...input.filters.profileKeywords,
  ]).slice(0, 8);

  return compactInput({
    ...apifyActors.linkedinCompanyEmployees.defaultInput,
    companies: input.filters.companyLinkedinUrls,
    profileScraperMode: "Short ($4 per 1k)",
    maxItems: discoveryLimit(input.filters.quantity),
    // Recall first: LinkedIn's exact title/location/seniority filters are brittle when
    // combined. We deliberately use one fuzzy query here and rank/filter in Share AI.
    searchQuery: searchTerms.length ? searchTerms.join(" OR ") : undefined,
  });
}

export function buildBroadPeopleInput(input: PersonSearchInput) {
  const searchTerms = uniqueStrings([
    ...input.filters.roles,
    ...input.filters.profileKeywords,
  ]).slice(0, 8);

  return compactInput({
    ...apifyActors.linkedinProfileSearch.defaultInput,
    profileScraperMode: "Short",
    maxItems: discoveryLimit(input.filters.quantity),
    currentCompanies: input.filters.companyLinkedinUrls,
    // Keep the company hard-bound, but avoid stacking exact-title, geo and seniority
    // filters. The product ranking layer is the right place to apply those signals.
    searchQuery: searchTerms.length ? searchTerms.join(" OR ") : undefined,
  });
}

export async function discoverCompanies(input: CompanySearchInput) {
  return runApifyActor("linkedinCompanySearch", buildCompanyDiscoveryInput(input));
}

export async function discoverHarvestPeople(input: PersonSearchInput) {
  return runApifyActor("linkedinCompanyEmployees", buildHarvestPeopleInput(input));
}

export async function researchCompanies(companyLinkedinUrls: string[]) {
  return runApifyActor("linkedinCompanyDetails", {
    ...apifyActors.linkedinCompanyDetails.defaultInput,
    companies: companyLinkedinUrls,
  });
}

export async function discoverBroadPeople(input: PersonSearchInput) {
  return runApifyActor("linkedinProfileSearch", buildBroadPeopleInput(input));
}

export async function enrichPersonProfile(linkedinUrl: string) {
  return runApifyActor("linkedinProfile", {
    ...apifyActors.linkedinProfile.defaultInput,
    urls: [linkedinUrl],
    queries: [linkedinUrl],
  });
}

export async function enrichPersonPosts(linkedinUrl: string) {
  return runApifyActor("linkedinProfilePosts", {
    ...apifyActors.linkedinProfilePosts.defaultInput,
    targetUrls: [linkedinUrl],
    maxPosts: 5,
    includeQuotePosts: true,
    includeReposts: true,
    scrapeComments: false,
    scrapeReactions: false,
  });
}

function discoveryLimit(quantity: number) {
  return Math.min(50, Math.max(25, quantity * 2));
}

function compactInput(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => {
    if (value === undefined || value === null || value === "") return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  }));
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.trim().toLocaleLowerCase("pt-BR");
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
