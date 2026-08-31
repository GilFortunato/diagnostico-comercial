import { inferDecisionRole, inferSeniority } from "@/lib/decision-makers/roleIntelligence";
import { normalizeText, type DecisionRole, type HuntingCompany, type HuntingPerson } from "@/lib/decision-makers/search";

type UnknownRecord = Record<string, unknown>;

export function normalizeCompanies(items: unknown[], source: string): HuntingCompany[] {
  const normalized = items.filter(isRecord).reduce<HuntingCompany[]>((accumulator, item) => {
    const name = pickString(item, ["name", "companyName", "organization.name", "company.name"]);
    if (!name) return accumulator;
    const linkedinUrl = normalizeLinkedInUrl(pickString(item, ["linkedinUrl", "linkedin_url", "companyLinkedinUrl", "organization.linkedinUrl", "company.linkedinUrl"]));
    const website = pickString(item, ["website", "websiteUrl", "companyWebsite", "organization.website", "company.website"]);
    const domain = pickString(item, ["domain", "companyDomain", "organization.primaryDomain", "company.domain"]) || domainFromUrl(website);
    const industry = pickString(item, ["industry", "industryName", "organization.industry", "company.industry"]);
    const location = joinLocation(item);
    const employeeRange = pickString(item, ["employeeRange", "employeeSize", "companyEmployeeSize", "organization.employeeRange", "company.employeeRange"]);
    const revenueRange = pickString(item, ["revenue", "revenueRange", "organization.revenue", "company.revenue"]);
    const description = pickString(item, ["description", "about", "organization.description", "company.description"]);

    accumulator.push({
      id: stableId(linkedinUrl || domain || name),
      name,
      domain: domain || undefined,
      website: website || undefined,
      linkedinUrl: linkedinUrl || undefined,
      industry: industry || undefined,
      location: location || undefined,
      employeeRange: employeeRange || undefined,
      revenueRange: revenueRange || undefined,
      description: description || undefined,
      signals: [industry, employeeRange, revenueRange].filter(Boolean),
      fit: "Média" as const,
      fitReasons: [],
      confidence: linkedinUrl || website ? "provável" as const : "não verificado" as const,
      source,
    });
    return accumulator;
  }, []);

  return deduplicateCompanies(normalized);
}

export function normalizePeople(items: unknown[], source: string, desiredRole: DecisionRole): HuntingPerson[] {
  const normalized = items.filter(isRecord).reduce<HuntingPerson[]>((accumulator, item) => {
    const name = pickString(item, ["fullName", "name", "profile.fullName", "person.name", "firstName"]);
    const lastName = pickString(item, ["lastName"]);
    const fullName = lastName && name && !normalizeText(name).includes(normalizeText(lastName)) ? `${name} ${lastName}` : name;
    const title = pickString(item, ["title", "jobTitle", "headline", "position", "currentPosition.title", "employment.title"]);
    const company = pickString(item, ["companyName", "company", "organization.name", "currentPosition.companyName", "employment.companyName"]);
    const linkedinUrl = normalizeLinkedInUrl(pickString(item, ["linkedinUrl", "linkedin_url", "profileUrl", "url", "profile.linkedinUrl"]));
    if (!fullName || !title || !company || !linkedinUrl || normalizeText(fullName).includes("pessoa a identificar")) return accumulator;

    const location = joinLocation(item);
    const department = pickString(item, ["department", "function", "jobFunction", "employment.department"]);
    const professionalEmail = pickProfessionalContact(item, ["workEmail", "businessEmail", "professionalEmail", "email"]);
    const professionalPhone = pickProfessionalContact(item, ["workPhone", "businessPhone", "professionalPhone", "phone"]);
    const profileSummary = pickString(item, ["about", "summary", "description", "profile.summary"]);

    accumulator.push({
      id: stableId(linkedinUrl),
      name: fullName,
      title,
      company,
      linkedinUrl,
      location: location || undefined,
      department: department || undefined,
      seniority: inferSeniority(title),
      probableDecisionRole: inferDecisionRole(title, desiredRole),
      fit: "Média" as const,
      fitScore: 0,
      fitReasons: [],
      confidence: "provável" as const,
      accessibility: professionalEmail || professionalPhone ? "Alta" as const : "Média" as const,
      profileSummary: profileSummary || undefined,
      recentSignals: [],
      professionalEmail: professionalEmail || undefined,
      emailStatus: professionalEmail ? "Encontrado" as const : "Não encontrado" as const,
      professionalPhone: professionalPhone || undefined,
      phoneStatus: professionalPhone ? "Encontrado" as const : "Não encontrado" as const,
      contactSource: professionalEmail || professionalPhone ? source : undefined,
      contactConfidence: professionalEmail || professionalPhone ? "provável" as const : undefined,
      nextBestAction: "Pesquisar mais sinais profissionais antes de iniciar uma conversa.",
      rapport: {
        context: "Ainda sem sinais profissionais suficientes para uma leitura de rapport.",
        safeOpening: "Validar o contexto e as prioridades da pessoa antes de apresentar uma solução.",
        avoid: ["Não presumir orçamento, interesse ou poder de decisão.", "Não usar dados pessoais ou sensíveis."],
      },
      source,
    });
    return accumulator;
  }, []);

  return deduplicatePeople(normalized);
}

export function mergePeople(primary: HuntingPerson[], secondary: HuntingPerson[]) {
  const merged = new Map<string, HuntingPerson>();
  for (const person of [...secondary, ...primary]) {
    const key = normalizeLinkedInUrl(person.linkedinUrl) || `${normalizeText(person.name)}|${normalizeText(person.company)}|${normalizeText(person.title)}`;
    const previous = merged.get(key);
    merged.set(key, previous ? mergePerson(previous, person) : person);
  }
  return [...merged.values()];
}

export function pickString(record: UnknownRecord, paths: string[]) {
  for (const path of paths) {
    const value = path.split(".").reduce<unknown>((current, key) => isRecord(current) ? current[key] : undefined, record);
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function mergePerson(base: HuntingPerson, update: HuntingPerson): HuntingPerson {
  return {
    ...base,
    ...update,
    location: update.location || base.location,
    department: update.department || base.department,
    profileSummary: update.profileSummary || base.profileSummary,
    professionalEmail: update.professionalEmail || base.professionalEmail,
    professionalPhone: update.professionalPhone || base.professionalPhone,
    contactSource: update.contactSource || base.contactSource,
    recentSignals: [...new Set([...base.recentSignals, ...update.recentSignals])],
  };
}

function deduplicateCompanies(companies: HuntingCompany[]) {
  const seen = new Set<string>();
  return companies.filter((company) => {
    const key = company.linkedinUrl || company.domain || normalizeText(company.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deduplicatePeople(people: HuntingPerson[]) {
  const seen = new Set<string>();
  return people.filter((person) => {
    const key = person.linkedinUrl || `${normalizeText(person.name)}|${normalizeText(person.company)}|${normalizeText(person.title)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function joinLocation(record: UnknownRecord) {
  const direct = pickString(record, ["location", "locationName", "geo", "companyLocation", "organization.location"]);
  if (direct) return direct;
  return [pickString(record, ["city", "location.city"]), pickString(record, ["state", "location.state"]), pickString(record, ["country", "location.country"])].filter(Boolean).join(", ");
}

function pickProfessionalContact(record: UnknownRecord, paths: string[]) {
  const value = pickString(record, paths);
  if (!value || /personal|private/i.test(paths.find((path) => pickString(record, [path]) === value) ?? "")) return "";
  return value;
}

function normalizeLinkedInUrl(value: string) {
  if (!value || !/linkedin\.com\/(in|company)\//i.test(value)) return "";
  return value.split("?")[0].replace(/\/$/, "");
}

function domainFromUrl(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function stableId(value: string) {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `hunt_${(hash >>> 0).toString(36)}`;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
