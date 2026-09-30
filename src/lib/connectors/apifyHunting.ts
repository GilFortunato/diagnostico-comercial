import "server-only";
import { apifyActors } from "@/lib/connectors/apifyActors";
import { runApifyActor } from "@/lib/connectors/apifyClient";
import type { CompanySearchInput, PersonSearchInput } from "@/lib/decision-makers/search";
import type { HuntingPage } from "@/lib/hunting/pagination";

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

export function buildHarvestPeopleInput(input: PersonSearchInput) {
  return compactInput({
    ...apifyActors.linkedinCompanyEmployees.defaultInput,
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

export function buildPrimaryPeopleRecallInput(input: PersonSearchInput, page?: HuntingPage) {
  return compactInput({
    ...apifyActors.linkedinCompanyEmployees.defaultInput,
    companies: input.filters.companyLinkedinUrls,
    profileScraperMode: "Short ($4 per 1k)",
    maxItems: page?.maxItems ?? discoveryLimit(input.filters.quantity),
    ...(page ? { startPage: page.startPage, takePages: page.takePages } : {}),
    jobTitles: uniqueStrings(input.filters.roles).slice(0, 50),
    locations: input.filters.locations,
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
  return compactInput({
    ...apifyActors.linkedinProfileSearch.defaultInput,
    profileScraperMode: "Short",
    maxItems: discoveryLimit(input.filters.quantity),
    currentCompanies: input.filters.companyLinkedinUrls,
    currentJobTitles: uniqueStrings(input.filters.roles).slice(0, 20),
    locations: uniqueStrings(input.filters.locations).slice(0, 20),
  });
}

export async function discoverCompanies(input: CompanySearchInput) {
  return runApifyActor("linkedinCompanySearch", buildCompanyDiscoveryInput(input));
}

export async function discoverHarvestPeople(input: PersonSearchInput, page?: HuntingPage) {
  const items = await runApifyActor("linkedinCompanyEmployees", buildPrimaryPeopleRecallInput(input, page), { timeoutMs: page?.timeoutMs });
  return items.filter(isPublicPersonRow);
}

export async function researchCompanies(companyLinkedinUrls: string[]) {
  return runApifyActor("linkedinCompanyDetails", {
    ...apifyActors.linkedinCompanyDetails.defaultInput,
    companies: companyLinkedinUrls,
  }, { timeoutMs: 20_000 });
}

export async function discoverBroadPeople(input: PersonSearchInput) {
  let profiles: unknown[] = [];
  try {
    const profileItems = await runApifyActor("linkedinProfileSearch", buildBroadPeopleRecallInput(input), { timeoutMs: 25_000, allowFallback: false });
    profiles = profileItems.filter(isPublicPersonRow);
    if (profiles.length >= input.filters.quantity) return profiles;
  } catch {
    // A fonte alternativa por empresa ainda pode responder.
  }

  try {
    const employeeItems = await runApifyActor("linkedinCompanyEmployeesFallback", buildFallbackPeopleRecallInput(input), { timeoutMs: 25_000 });
    return [...profiles, ...employeeItems.filter(isPublicPersonRow)];
  } catch (error) {
    if (profiles.length) return profiles;
    throw error;
  }
}

export async function enrichPersonProfile(linkedinUrl: string) {
  return runApifyActor("linkedinProfile", {
    ...apifyActors.linkedinProfile.defaultInput,
    urls: [linkedinUrl],
    queries: [linkedinUrl],
  }, { timeoutMs: 15_000 });
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
  }, { timeoutMs: 15_000 });
}

function isPublicPersonRow(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.recordType === "diagnostic" || record.ok === false) return false;

  const profileUrl = [record.profileUrl, record.linkedinUrl, record.linkedin_url, record.linkedinProfileUrl, record.navigationUrl, record.url]
    .find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);
  const explicitName = [record.fullName, record.name]
    .find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);
  const firstName = typeof record.firstName === "string" ? record.firstName.trim() : "";
  const lastName = typeof record.lastName === "string" ? record.lastName.trim() : "";
  const name = explicitName?.trim() || [firstName, lastName].filter(Boolean).join(" ").trim();

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
