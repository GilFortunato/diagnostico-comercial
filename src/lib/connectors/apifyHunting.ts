import "server-only";
import { apifyActors } from "@/lib/connectors/apifyActors";
import { runApifyActor } from "@/lib/connectors/apifyClient";
import type { CompanySearchInput, PersonSearchInput } from "@/lib/decision-makers/search";

const harvestSeniorityIds: Record<PersonSearchInput["filters"]["seniority"][number], string[]> = {
  manager: ["200", "210"],
  director: ["220"],
  vp: ["300"],
  c_level: ["310"],
  owner: ["320"],
};

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

// Legacy strict builder kept as a stable contract for callers/tests that need to inspect
// the complete Harvest filter mapping. Production discovery now uses the recall-first
// builder below so a valid employee is not excluded by stacked exact filters.
export function buildHarvestPeopleInput(input: PersonSearchInput) {
  return compactInput({
    ...apifyActors.linkedinCompanyEmployees.defaultInput,
    companies: input.filters.companyLinkedinUrls,
    maxItems: input.filters.quantity,
    jobTitles: input.filters.roles,
    locations: input.filters.locations,
    searchQuery: input.filters.profileKeywords.join(" OR ") || undefined,
    seniorityLevelIds: [...new Set(input.filters.seniority.flatMap((level) => harvestSeniorityIds[level]))],
  });
}

export function buildBroadPeopleInput(input: PersonSearchInput) {
  return compactInput({
    ...apifyActors.linkedinProfileSearch.defaultInput,
    profileScraperMode: "Short",
    maxItems: input.filters.quantity,
    currentCompanies: input.filters.companyLinkedinUrls,
    currentJobTitles: input.filters.roles,
    locations: input.filters.locations,
    searchQuery: input.filters.profileKeywords.join(" OR ") || undefined,
    seniorityLevelIds: [...new Set(input.filters.seniority.flatMap((level) => harvestSeniorityIds[level]))],
  });
}

export function buildHarvestPeopleRecallInput(input: PersonSearchInput) {
  const searchTerms = uniqueStrings([
    ...input.filters.roles,
    ...input.filters.profileKeywords,
  ]).slice(0, 8);

  return compactInput({
    ...apifyActors.linkedinCompanyEmployees.defaultInput,
    companies: input.filters.companyLinkedinUrls,
    profileScraperMode: "Short ($4 per 1k)",
    maxItems: discoveryLimit(input.filters.quantity),
    searchQuery: searchTerms.length ? searchTerms.join(" OR ") : undefined,
  });
}

export function buildBroadPeopleRecallInput(input: PersonSearchInput) {
  const searchTerms = uniqueStrings([
    ...input.filters.roles,
    ...input.filters.profileKeywords,
  ]).slice(0, 8);

  return compactInput({
    ...apifyActors.linkedinProfileSearch.defaultInput,
    profileScraperMode: "Short",
    maxItems: discoveryLimit(input.filters.quantity),
    currentCompanies: input.filters.companyLinkedinUrls,
    searchQuery: searchTerms.length ? searchTerms.join(" OR ") : undefined,
  });
}

export async function discoverCompanies(input: CompanySearchInput) {
  return runApifyActor("linkedinCompanySearch", buildCompanyDiscoveryInput(input));
}

export async function discoverHarvestPeople(input: PersonSearchInput) {
  return runApifyActor("linkedinCompanyEmployees", buildHarvestPeopleRecallInput(input));
}

export async function researchCompanies(companyLinkedinUrls: string[]) {
  return runApifyActor("linkedinCompanyDetails", {
    ...apifyActors.linkedinCompanyDetails.defaultInput,
    companies: companyLinkedinUrls,
  });
}

export async function discoverBroadPeople(input: PersonSearchInput) {
  return runApifyActor("linkedinProfileSearch", buildBroadPeopleRecallInput(input));
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
