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

// Contrato legado mantido para consumidores/testes que ainda inspecionam o payload
// Harvest. A descoberta B2B principal em produção usa buildPrimaryPeopleRecallInput.
export function buildHarvestPeopleInput(input: PersonSearchInput) {
  return compactInput({
    companies: input.filters.companyLinkedinUrls,
    maxItems: input.filters.quantity,
    profileScraperMode: "Short ($4 per 1k)",
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

export function buildPrimaryPeopleRecallInput(input: PersonSearchInput) {
  const roleTerms = uniqueStrings(input.filters.roles).slice(0, 12);
  const profileTerms = uniqueStrings(input.filters.profileKeywords).slice(0, 8);
  const locations = uniqueStrings(input.filters.locations).slice(0, 10);

  return compactInput({
    ...apifyActors.linkedinCompanyEmployees.defaultInput,
    companies: input.filters.companyLinkedinUrls,
    resultsLimit: discoveryLimit(input.filters.quantity),
    jobTitles: roleTerms,
    locations,
    searchQuery: profileTerms.length ? profileTerms.join(" OR ") : undefined,
    includeMentions: false,
  });
}

export function buildFallbackPeopleRecallInput(input: PersonSearchInput) {
  return compactInput({
    ...apifyActors.linkedinCompanyEmployeesFallback.defaultInput,
    companyUrls: input.filters.companyLinkedinUrls,
    proMode: false,
    maxEmployees: discoveryLimit(input.filters.quantity),
  });
}

export function buildHarvestPeopleRecallInput(input: PersonSearchInput) {
  return buildPrimaryPeopleRecallInput(input);
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
  const items = await runApifyActor("linkedinCompanyEmployees", buildPrimaryPeopleRecallInput(input));
  return items.filter(isPublicPersonRow);
}

export async function researchCompanies(companyLinkedinUrls: string[]) {
  return runApifyActor("linkedinCompanyDetails", {
    ...apifyActors.linkedinCompanyDetails.defaultInput,
    companies: companyLinkedinUrls,
  });
}

export async function discoverBroadPeople(input: PersonSearchInput) {
  const items = await runApifyActor("linkedinCompanyEmployeesFallback", buildFallbackPeopleRecallInput(input));
  return items.filter(isPublicPersonRow);
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

function isPublicPersonRow(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const profileUrl = [record.profileUrl, record.linkedinUrl, record.linkedin_url, record.url]
    .find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);
  const name = [record.fullName, record.name]
    .find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);
  return Boolean(name && profileUrl && /linkedin\.com\/in\//i.test(profileUrl));
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
