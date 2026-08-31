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

const peakySeniority: Partial<Record<PersonSearchInput["filters"]["seniority"][number], string>> = {
  manager: "manager_level",
  director: "director_level",
  vp: "vp_level",
  c_level: "c_level",
};

export function buildCompanyDiscoveryInput(input: CompanySearchInput) {
  return compactInput({
    ...apifyActors.leadDiscovery.defaultInput,
    totalResults: 100,
    companyMode: true,
    industry: input.filters.industries,
    companyCountry: input.filters.country ? [input.filters.country] : [],
    companyState: input.filters.states,
    companyCityPostalCode: input.filters.cityPostalCodes,
    companyEmployeeSize: input.filters.employeeRanges,
    webKeywords: input.filters.keywords,
    technologyUsed: input.filters.technologies,
    revenue: input.filters.revenueRanges,
    companyDomain: input.filters.domains,
  });
}

export function buildHarvestPeopleInput(input: PersonSearchInput) {
  return compactInput({
    ...apifyActors.linkedinCompanyEmployees.defaultInput,
    companies: input.filters.companyLinkedinUrls,
    maxItems: input.filters.quantity,
    maxItemsPerCompany: Math.max(5, Math.ceil(input.filters.quantity / input.filters.companyLinkedinUrls.length)),
    jobTitles: input.filters.roles,
    locations: input.filters.locations,
    searchQuery: input.filters.profileKeywords.join(" ") || undefined,
    seniorityLevelIds: [...new Set(input.filters.seniority.flatMap((level) => harvestSeniorityIds[level]))],
  });
}

export function buildBroadPeopleInput(input: PersonSearchInput) {
  return compactInput({
    ...apifyActors.leadDiscovery.defaultInput,
    totalResults: 100,
    companyMode: false,
    personTitle: input.filters.roles,
    seniority: input.filters.seniority.map((level) => peakySeniority[level]).filter(Boolean),
  });
}

export async function discoverCompanies(input: CompanySearchInput) {
  return runApifyActor("leadDiscovery", buildCompanyDiscoveryInput(input));
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
  return runApifyActor("leadDiscovery", buildBroadPeopleInput(input));
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

function compactInput(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => {
    if (value === undefined || value === null || value === "") return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  }));
}
