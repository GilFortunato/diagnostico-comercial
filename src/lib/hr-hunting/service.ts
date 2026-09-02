import "server-only";
import { Prisma, type ConfidenceLevel } from "@prisma/client";
import { runApifyActor } from "@/lib/connectors/apifyClient";
import { getPrisma } from "@/lib/db/prisma";
import { createJobDna } from "@/lib/hr-hunting/jobDna";
import type { CriterionKind, EvidenceState, HrCandidate, HrHuntingSearchSnapshot, JobDna, MessageFormat } from "@/lib/hr-hunting/types";

type SearchInput = { quantity: number; currentTitle?: string; seniority: string[]; location?: string; keywords: string[] };
type UnknownRecord = Record<string, unknown>;
type HrHuntingSearchWithCandidates = Prisma.HrHuntingSearchGetPayload<{
  include: { candidates: { include: { evidence: true; contacts: true; shortlist: true } } };
}>;

const hrHarvestSeniorityIds: Record<string, string[]> = {
  manager: ["200", "210"],
  director: ["220"],
  vp: ["300"],
  c_level: ["310"],
  owner: ["320"],
};

const titleFamilyRules: Array<{ pattern: RegExp; terms: string[] }> = [
  { pattern: /p[oó]s[- ]?vendas?|after sales/i, terms: ["Pós-Vendas", "Analista de Pós-Vendas", "Analista de Customer Success", "Customer Success Analyst", "Analista de Customer Experience", "Customer Experience Analyst", "After Sales Analyst", "Analista de Relacionamento com Cliente"] },
  { pattern: /customer success|sucesso do cliente/i, terms: ["Customer Success", "Customer Success Analyst", "Analista de Customer Success", "Customer Success Manager", "CSM", "Sucesso do Cliente"] },
  { pattern: /customer experience|experi[eê]ncia do cliente/i, terms: ["Customer Experience", "Customer Experience Analyst", "Analista de Customer Experience", "CX Analyst", "Experiência do Cliente"] },
  { pattern: /product manager|gerente de produto/i, terms: ["Product Manager", "Gerente de Produto", "Product Owner", "Senior Product Manager"] },
  { pattern: /business development|desenvolvimento de neg[oó]cios/i, terms: ["Business Development", "Business Development Manager", "Gerente de Desenvolvimento de Negócios", "BD Manager"] },
  { pattern: /sales|comercial|vendas/i, terms: ["Sales", "Sales Manager", "Commercial Manager", "Gerente Comercial", "Gerente de Vendas"] },
  { pattern: /talent development|learning.*development|dho|desenvolvimento humano/i, terms: ["Talent Development", "Learning & Development", "L&D", "DHO", "Desenvolvimento Humano Organizacional", "Treinamento e Desenvolvimento"] },
];

export async function createHrHuntingSearch(ownerId: string, input: { title?: string; description: string; jobUrl?: string; companyName?: string; recruiterName?: string }) {
  const jobDna = await createJobDna(input);
  const search = await getPrisma().hrHuntingSearch.create({
    data: { ownerId, title: jobDna.title, jobDescription: input.description, jobUrl: input.jobUrl || null, companyName: input.companyName || null, recruiterName: input.recruiterName || null, jobDna: jobDna as unknown as Prisma.InputJsonValue, searchTerms: deriveTerms(jobDna), status: "job_dna_ready", connectorWarnings: [] },
  });
  return findOwnedHrHuntingSearch(search.id, ownerId);
}

export async function updateHrHuntingJobDna(id: string, ownerId: string, jobDna: JobDna) {
  await getPrisma().hrHuntingSearch.updateMany({ where: { id, ownerId }, data: { title: jobDna.title, jobDna: jobDna as unknown as Prisma.InputJsonValue, searchTerms: deriveTerms(jobDna), status: "job_dna_ready" } });
  return findOwnedHrHuntingSearch(id, ownerId);
}

export function buildHrCandidateSearchInput(input: SearchInput, fallbackTitle: string) {
  const selectedTitle = input.currentTitle?.trim();
  const titles = unique([selectedTitle || fallbackTitle]).slice(0, 10);
  const keywords = unique(input.keywords).slice(0, 8);
  return compact({
    profileScraperMode: "Short",
    maxItems: input.quantity,
    currentJobTitles: titles,
    locations: input.location?.trim() ? [input.location.trim()] : [],
    searchQuery: keywords.length ? keywords.join(" OR ") : undefined,
    seniorityLevelIds: [...new Set(input.seniority.flatMap((level) => hrHarvestSeniorityIds[level] ?? []))],
  });
}

export function buildTitleFamily(title: string) {
  const trimmed = title.trim();
  const expanded = titleFamilyRules.find((rule) => rule.pattern.test(trimmed))?.terms ?? [];
  return unique([trimmed, ...expanded]).filter(Boolean).slice(0, 10);
}

export function buildHrCandidateRecallInput(input: SearchInput, fallbackTitle: string) {
  const selectedTitle = input.currentTitle?.trim() || fallbackTitle.trim();
  const titleFamily = buildTitleFamily(selectedTitle);
  return compact({
    profileScraperMode: "Short",
    maxItems: Math.min(50, Math.max(25, input.quantity * 2)),
    takePages: 2,
    searchQuery: titleFamily.join(" OR ") || undefined,
    locations: input.location?.trim() ? [input.location.trim()] : [],
  });
}

export async function executeHrHuntingSearch(id: string, ownerId: string, input: SearchInput) {
  const search = await findOwnedHrHuntingSearch(id, ownerId);
  if (!search) return null;

  const warnings: string[] = [];
  let rawItems: unknown[] = [];
  let connectorFailed = false;

  try {
    rawItems = await runApifyActor("linkedinProfileSearch", buildHrCandidateRecallInput(input, search.jobDna.title || search.title));
  } catch {
    connectorFailed = true;
    warnings.push("A fonte principal de descoberta de profissionais ficou indisponível. Este estado não representa zero candidatos; valide o conector Apify e tente novamente.");
  }

  const discovered = normalizeCandidates(rawItems);
  if (!connectorFailed && rawItems.length > 0 && discovered.length === 0) {
    connectorFailed = true;
    warnings.push("A fonte retornou perfis, mas nenhum registro continha nome e evidência profissional suficiente em um formato reconhecido. O estado foi preservado como erro de processamento, não como zero candidatos.");
  }

  let enriched = discovered;
  if (!connectorFailed && discovered.length) {
    const enrichmentUrls = selectProfilesForEnrichment(discovered, search.jobDna, input)
      .map((candidate) => candidate.profileUrl)
      .filter((url): url is string => Boolean(url));

    if (enrichmentUrls.length) {
      try {
        const enrichmentItems = await runApifyActor("linkedinProfile", { urls: enrichmentUrls });
        const enrichedProfiles = normalizeCandidates(enrichmentItems);
        enriched = mergeCandidateProfiles(discovered, enrichedProfiles);
        warnings.push(`A Share AI enriqueceu ${enrichedProfiles.length} perfil(is) antes de calcular a aderência.`);
      } catch {
        warnings.push("O enriquecimento de perfil ficou indisponível; a aderência foi calculada apenas com os dados estruturados da descoberta.");
      }
    }
  }

  const quality = connectorFailed ? { eligible: [] as HrCandidate[], rejected: [] as HrCandidate[] } : applyCandidateQualityGate(enriched, search.jobDna, input);
  if (!connectorFailed && quality.rejected.length) {
    warnings.push(`${quality.rejected.length} perfil(is) foram mantidos fora do ranking por cargo, localização ou evidência profissional insuficiente.`);
  }

  const candidates = connectorFailed ? [] : rankCandidates(quality.eligible, search.jobDna, input).slice(0, input.quantity);
  await getPrisma().$transaction(async (tx) => {
    await tx.hrHuntingCandidate.deleteMany({ where: { searchId: id } });
    if (candidates.length) await tx.hrHuntingCandidate.createMany({ data: candidates.map((candidate) => ({
      id: candidate.id, searchId: id, sourcePersonId: candidate.id, name: candidate.name, currentTitle: candidate.currentTitle || null, currentCompany: candidate.currentCompany || null,
      location: candidate.location || null, profileUrl: candidate.profileUrl || null, professionalSummary: candidate.professionalSummary || null, fitScore: candidate.fitScore,
      fitClassification: candidate.fitClassification, mainSignal: candidate.mainSignal || null, pointsToValidate: candidate.pointsToValidate, sourceName: candidate.sourceName,
      confidence: toPrismaConfidence(candidate.confidence), rawSnapshot: candidate as unknown as Prisma.InputJsonValue,
    })) });
    for (const candidate of candidates) {
      const row = await tx.hrHuntingCandidate.findUnique({ where: { id: candidate.id }, select: { id: true } });
      if (!row) continue;
      if (candidate.evidence.length) await tx.hrHuntingCandidateEvidence.createMany({ data: candidate.evidence.map((evidence) => ({ candidateId: row.id, criterion: evidence.criterion, criterionType: evidence.criterionType, result: evidence.result, evidence: evidence.evidence || null, source: evidence.source, confidence: toPrismaConfidence(evidence.confidence) })) });
      if (candidate.contacts.length) await tx.hrHuntingCandidateContact.createMany({ data: candidate.contacts.map((contact) => ({ candidateId: row.id, value: contact.value, type: contact.type, source: contact.source, confidence: toPrismaConfidence(contact.confidence), obtainedAt: contact.obtainedAt ? new Date(contact.obtainedAt) : null })) });
    }
    await tx.hrHuntingSearch.update({
      where: { id },
      data: {
        status: connectorFailed ? "connector_error" : candidates.length ? "results_ready" : "no_results",
        sourceSnapshot: rawItems as Prisma.InputJsonValue,
        connectorWarnings: [...new Set(warnings)],
      },
    });
  });
  return findOwnedHrHuntingSearch(id, ownerId);
}

export async function findOwnedHrHuntingSearch(id: string, ownerId: string): Promise<HrHuntingSearchSnapshot | null> {
  const row = await getPrisma().hrHuntingSearch.findFirst({ where: { id, ownerId }, include: { candidates: { include: { evidence: true, contacts: true, shortlist: true }, orderBy: { fitScore: "desc" } } } });
  return row ? serializeSearch(row) : null;
}

export async function listHrHuntingSearches(ownerId: string) {
  const rows = await getPrisma().hrHuntingSearch.findMany({ where: { ownerId }, orderBy: { updatedAt: "desc" }, take: 20, include: { candidates: { select: { id: true, shortlist: true } } } });
  return rows.map((row) => ({ id: row.id, title: row.title, status: row.status, updatedAt: row.updatedAt.toISOString(), candidates: row.candidates.length, shortlist: row.candidates.filter((candidate) => candidate.shortlist).length }));
}

export async function toggleHrShortlist(candidateId: string, ownerId: string, shortlisted: boolean, nextStep?: string, notes?: string) {
  const candidate = await getPrisma().hrHuntingCandidate.findFirst({ where: { id: candidateId, search: { ownerId } }, select: { id: true } });
  if (!candidate) return false;
  if (!shortlisted) { await getPrisma().hrHuntingShortlist.deleteMany({ where: { candidateId } }); return true; }
  await getPrisma().hrHuntingShortlist.upsert({ where: { candidateId }, create: { candidateId, nextStep: nextStep || null, notes: notes || null }, update: { nextStep: nextStep || null, notes: notes || null } });
  return true;
}

export function buildApproachMessage(search: HrHuntingSearchSnapshot, candidate: HrCandidate, format: MessageFormat) {
  const firstName = candidate.name.split(/\s+/)[0] || candidate.name;
  const recruiter = search.recruiterName || "a equipe de recrutamento da Share People Hub";
  const company = search.companyName ? ` para a ${search.companyName}` : "";
  const opening = format === "email" ? `Olá, ${firstName}!` : `Oi, ${firstName}!`;
  const channel = format === "linkedin" ? "Seu perfil apresentou boa aderência inicial aos critérios profissionais da oportunidade." : "Seu perfil apresentou boa aderência inicial aos critérios profissionais que estamos avaliando.";
  const link = search.jobUrl ? `\n\nDetalhes da vaga: ${search.jobUrl}` : "";
  return `${opening}\n\nSou ${recruiter}. Estamos conduzindo uma oportunidade${company}: ${search.jobDna.shortSummary}\n\n${channel} Se fizer sentido para você, podemos conversar?${link}`;
}

function serializeSearch(row: HrHuntingSearchWithCandidates): HrHuntingSearchSnapshot {
  const candidates: HrCandidate[] = row.candidates.map((candidate) => ({
    id: candidate.id, name: candidate.name, currentTitle: candidate.currentTitle || undefined, currentCompany: candidate.currentCompany || undefined, location: candidate.location || undefined,
    profileUrl: candidate.profileUrl || undefined, professionalSummary: candidate.professionalSummary || undefined, fitScore: candidate.fitScore, fitClassification: candidate.fitClassification as HrCandidate["fitClassification"],
    mainSignal: candidate.mainSignal || undefined, pointsToValidate: candidate.pointsToValidate, sourceName: candidate.sourceName, confidence: fromPrismaConfidence(candidate.confidence),
    evidence: candidate.evidence.map((item) => ({ criterion: item.criterion, criterionType: item.criterionType as HrCandidate["evidence"][number]["criterionType"], result: item.result as HrCandidate["evidence"][number]["result"], evidence: item.evidence || undefined, source: item.source, confidence: fromPrismaConfidence(item.confidence) })),
    contacts: candidate.contacts.map((item) => ({ value: item.value, type: item.type as HrCandidate["contacts"][number]["type"], source: item.source, confidence: fromPrismaConfidence(item.confidence), obtainedAt: item.obtainedAt?.toISOString() })),
    shortlisted: Boolean(candidate.shortlist), shortlist: candidate.shortlist ? { nextStep: candidate.shortlist.nextStep || undefined, notes: candidate.shortlist.notes || undefined } : undefined,
  }));
  return { id: row.id, title: row.title, jobDescription: row.jobDescription, jobUrl: row.jobUrl || undefined, companyName: row.companyName || undefined, recruiterName: row.recruiterName || undefined, jobDna: row.jobDna as JobDna, searchTerms: row.searchTerms, status: row.status, connectorWarnings: row.connectorWarnings, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), candidates };
}

export function normalizeCandidates(items: unknown[]): HrCandidate[] {
  const seen = new Set<string>();
  return flattenProfileItems(items).flatMap((item, index) => {
    const explicitName = pick(item, ["fullName", "name", "profile.fullName", "person.name"]);
    const firstName = pick(item, ["firstName", "profile.firstName", "person.firstName"]);
    const lastName = pick(item, ["lastName", "profile.lastName", "person.lastName"]);
    const name = cleanName(explicitName || [firstName, lastName].filter(Boolean).join(" "));
    const currentPosition = firstRecord(item.currentPosition ?? getPath(item, "profile.currentPosition"));
    const currentExperience = firstRecord(item.experience ?? getPath(item, "profile.experience"));
    const title = pick(item, ["jobTitle", "title", "position", "employment.title", "profile.position", "profile.headline"])
      || pick(currentPosition, ["title", "position", "jobTitle"])
      || pick(currentExperience, ["position", "title", "jobTitle"])
      || pick(item, ["headline"]);
    const profileUrl = normalizeLinkedIn(pick(item, ["linkedinUrl", "linkedin_url", "linkedinProfileUrl", "profileUrl", "url", "navigationUrl", "profile.linkedinUrl", "profile.url"]));
    if (!name || /pessoa a identificar/i.test(name)) return [];
    const company = pick(item, ["companyName", "company", "organization.name", "employment.companyName", "profile.companyName"])
      || pick(currentPosition, ["companyName", "company.name"])
      || pick(currentExperience, ["companyName", "company.name"]);
    const key = profileUrl || `${normal(name)}|${normal(company)}|${normal(title)}`;
    if (!profileUrl && !title) return [];
    if (seen.has(key)) return [];
    seen.add(key);
    const email = pick(item, ["workEmail", "businessEmail", "professionalEmail", "profile.workEmail"]);
    const phone = pick(item, ["workPhone", "businessPhone", "professionalPhone", "profile.workPhone"]);
    const sourceName = pick(item, ["sourceName", "_sourceName"]) || "LinkedIn Profile Search via Harvest";
    const location = pickLocation(item) || pickLocation(currentExperience);
    const professionalSummary = pick(item, ["about", "summary", "description", "profile.summary", "headline", "position"]);
    return [{
      id: `hr_${stableId(key || String(index))}`,
      name,
      currentTitle: title || undefined,
      currentCompany: company || undefined,
      location: location || undefined,
      profileUrl: profileUrl || undefined,
      professionalSummary: professionalSummary || undefined,
      fitScore: 0,
      fitClassification: "Baixa aderência inicial" as const,
      pointsToValidate: title ? [] : ["Cargo atual não informado pela fonte"],
      sourceName,
      confidence: profileUrl ? "confirmado" as const : "provável" as const,
      evidence: [],
      contacts: [
        ...(email ? [{ value: email, type: "e-mail profissional" as const, source: sourceName, confidence: "confirmado" as const }] : []),
        ...(phone ? [{ value: phone, type: "telefone profissional" as const, source: sourceName, confidence: "confirmado" as const }] : []),
      ],
      shortlisted: false,
    }];
  });
}

export function applyCandidateQualityGate(candidates: HrCandidate[], dna: JobDna, input: SearchInput) {
  const targetTitle = input.currentTitle?.trim() || dna.title;
  const strictLocation = Boolean(input.location?.trim()) && !/\bremot[oa]\b/i.test(dna.workModel || "");
  const eligible: HrCandidate[] = [];
  const rejected: HrCandidate[] = [];

  for (const candidate of candidates) {
    const titleFit = candidate.currentTitle ? titleAffinity(candidate.currentTitle, targetTitle) : 0;
    const locationFit = locationAffinity(candidate.location || "", input.location || "");
    const hasProfessionalEvidence = Boolean(candidate.currentTitle && candidate.profileUrl);
    const passesTitle = titleFit >= 0.35;
    const passesLocation = !strictLocation || !candidate.location || locationFit >= 0.65;
    if (hasProfessionalEvidence && passesTitle && passesLocation) eligible.push(candidate);
    else rejected.push(candidate);
  }
  return { eligible, rejected };
}

export function rankCandidates(candidates: HrCandidate[], dna: JobDna, input: SearchInput) {
  const criteria = dna.criteria.filter((criterion) => criterion.kind !== "não relevante");
  const targetTitle = input.currentTitle?.trim() || dna.title;
  return candidates.map((candidate) => {
    const text = normal([candidate.currentTitle, candidate.currentCompany, candidate.location, candidate.professionalSummary].filter(Boolean).join(" "));
    const evidence = criteria.map((criterion) => evaluateCriterion(criterion.label, criterion.kind, text, candidate.sourceName));
    const required = evidence.filter((item) => item.criterionType === "obrigatório");
    const desired = evidence.filter((item) => item.criterionType === "desejável");
    const requiredRatio = ratio(required);
    const desiredRatio = ratio(desired);
    const titleFit = titleAffinity(candidate.currentTitle || "", targetTitle);
    const locationFit = input.location ? locationAffinity(candidate.location || "", input.location) : 1;
    const completeness = [candidate.currentCompany, candidate.professionalSummary].filter(Boolean).length / 2;
    const score = Math.round(Math.min(100,
      titleFit * 35
      + (required.length ? requiredRatio * 40 : 20)
      + (desired.length ? desiredRatio * 10 : 5)
      + locationFit * 10
      + completeness * 5,
    ));
    const matched = evidence.filter((item) => item.result === "atende");
    const pointsToValidate = [...new Set([
      ...(!candidate.currentCompany ? ["Empresa atual não informada pela fonte"] : []),
      ...(!candidate.professionalSummary ? ["Resumo/experiência profissional não detalhados pela fonte"] : []),
      ...(input.location && !candidate.location ? ["Localização não informada pela fonte"] : []),
      ...evidence.filter((item) => item.result !== "atende").map((item) => item.criterion),
    ])];
    const mainSignal = titleFit >= 0.7 ? `Cargo/família profissional aderente: ${candidate.currentTitle}` : matched[0]?.criterion;
    return { ...candidate, fitScore: score, fitClassification: classify(score), mainSignal, pointsToValidate, evidence };
  }).sort((a, b) => b.fitScore - a.fitScore || a.name.localeCompare(b.name, "pt-BR"));
}

function selectProfilesForEnrichment(candidates: HrCandidate[], dna: JobDna, input: SearchInput) {
  const targetTitle = input.currentTitle?.trim() || dna.title;
  const targetLocation = input.location || "";
  const limit = Math.min(25, Math.max(10, input.quantity));
  return [...candidates]
    .filter((candidate) => candidate.profileUrl)
    .sort((a, b) => discoveryPriority(b, targetTitle, targetLocation) - discoveryPriority(a, targetTitle, targetLocation))
    .slice(0, limit);
}

function discoveryPriority(candidate: HrCandidate, targetTitle: string, targetLocation: string) {
  const titleScore = candidate.currentTitle ? titleAffinity(candidate.currentTitle, targetTitle) * 70 : 0;
  const locationScore = targetLocation ? locationAffinity(candidate.location || "", targetLocation) * 20 : 20;
  const evidenceScore = [candidate.currentCompany, candidate.professionalSummary].filter(Boolean).length * 5;
  return titleScore + locationScore + evidenceScore;
}

function mergeCandidateProfiles(discovered: HrCandidate[], enriched: HrCandidate[]) {
  const enrichedByUrl = new Map(enriched.filter((candidate) => candidate.profileUrl).map((candidate) => [candidate.profileUrl!, candidate]));
  return discovered.map((candidate) => {
    const detail = candidate.profileUrl ? enrichedByUrl.get(candidate.profileUrl) : undefined;
    if (!detail) return candidate;
    return {
      ...candidate,
      currentTitle: detail.currentTitle || candidate.currentTitle,
      currentCompany: detail.currentCompany || candidate.currentCompany,
      location: detail.location || candidate.location,
      professionalSummary: detail.professionalSummary || candidate.professionalSummary,
      sourceName: "Apify · busca + enriquecimento de perfil",
      contacts: uniqueContacts([...candidate.contacts, ...detail.contacts]),
      confidence: "confirmado" as const,
    };
  });
}

function uniqueContacts(contacts: HrCandidate["contacts"]) {
  const seen = new Set<string>();
  return contacts.filter((contact) => {
    const key = `${contact.type}|${normal(contact.value)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function titleAffinity(candidateTitle: string, targetTitle: string) {
  const candidate = normal(candidateTitle);
  const target = normal(targetTitle);
  if (!candidate || !target) return 0;
  if (candidate === target || candidate.includes(target) || target.includes(candidate)) return 1;
  const family = buildTitleFamily(targetTitle).map(normal);
  if (family.some((term) => term.length >= 5 && (candidate.includes(term) || term.includes(candidate)))) return 0.9;
  const functionalTerms = unique(family.flatMap(titleTokens));
  const candidateTerms = titleTokens(candidate);
  const overlap = candidateTerms.filter((term) => functionalTerms.includes(term));
  return candidateTerms.length ? Math.min(0.8, overlap.length / Math.max(2, Math.min(candidateTerms.length, functionalTerms.length))) : 0;
}

function titleTokens(value: string) {
  return normal(value).split(/[^a-z0-9]+/).filter((term) => term.length >= 3 && !/^(analista|analyst|gerente|manager|senior|sr|junior|jr|pleno|especialista|specialist|assistente|assistant|de|do|da|the)$/.test(term));
}

function locationAffinity(candidateLocation: string, targetLocation: string) {
  if (!targetLocation.trim()) return 1;
  if (!candidateLocation.trim()) return 0.4;
  const candidate = normal(candidateLocation);
  const target = normal(targetLocation);
  if (candidate.includes(target) || target.includes(candidate)) return 1;
  const targetCity = normal(targetLocation.split(/[,/-]/)[0] || "");
  if (targetCity.length >= 3 && candidate.includes(targetCity)) return 1;
  const targetTerms = target.split(/[^a-z0-9]+/).filter((term) => term.length >= 3);
  const matches = targetTerms.filter((term) => candidate.includes(term));
  return targetTerms.length ? matches.length / targetTerms.length : 0;
}

function evaluateCriterion(label: string, kind: CriterionKind, profileText: string, source: string) {
  const terms = normal(label).split(/\s+/).filter((term) => term.length > 3 && !/requisito|experiencia|conhecimento|desejavel|obrigatorio|profissional|atuacao|vivencia/.test(term));
  const matches = terms.filter((term) => profileText.includes(term));
  const matchRatio = terms.length ? matches.length / terms.length : 0;
  const result = matchRatio >= 0.7 ? "atende" as const : matchRatio >= 0.3 ? "parcial" as const : "não verificado" as const;
  return { criterion: label, criterionType: kind, result, evidence: matches.length ? `Termos profissionais encontrados no perfil retornado pela fonte: ${matches.join(", ")}.` : undefined, source, confidence: matches.length ? "confirmado" as const : "não verificado" as const };
}

function flattenProfileItems(items: unknown[]) {
  const output: UnknownRecord[] = [];
  const visit = (value: unknown, depth: number) => {
    if (depth > 3) return;
    if (Array.isArray(value)) { for (const child of value) visit(child, depth + 1); return; }
    if (!isRecord(value)) return;
    if (looksLikeProfile(value)) { output.push(value); return; }
    let expanded = false;
    for (const key of ["profiles", "people", "results", "items", "data", "searchResults"]) {
      const nested = value[key];
      if (Array.isArray(nested) || isRecord(nested)) { expanded = true; visit(nested, depth + 1); }
    }
    if (!expanded) output.push(value);
  };
  visit(items, 0);
  return output;
}

function looksLikeProfile(record: UnknownRecord) {
  return Boolean(pick(record, ["linkedinUrl", "linkedin_url", "linkedinProfileUrl", "profileUrl", "profile.linkedinUrl", "firstName", "fullName", "position", "headline"]));
}

function pickLocation(record: UnknownRecord) {
  const direct = pick(record, ["locationName", "geo", "location.linkedinText", "location.parsed.text", "location.text", "profile.location.linkedinText", "profile.location.parsed.text"]);
  if (direct) return direct;
  const city = pick(record, ["city", "location.city", "location.parsed.city"]);
  const state = pick(record, ["state", "location.state", "location.parsed.state"]);
  const country = pick(record, ["country", "location.country", "location.parsed.country"]);
  return [city, state, country].filter(Boolean).join(", ");
}

function cleanName(value: string) {
  return value.replace(/\bundefined\b/gi, "").replace(/\s+/g, " ").trim();
}

function ratio(evidence: Array<{ result: string }>) { return evidence.length ? evidence.reduce((sum, item) => sum + (item.result === "atende" ? 1 : item.result === "parcial" ? 0.5 : 0), 0) / evidence.length : 0; }
function classify(score: number): HrCandidate["fitClassification"] { if (score >= 90) return "Muito alta"; if (score >= 80) return "Alta"; if (score >= 70) return "Boa"; if (score >= 60) return "Parcial"; return "Baixa aderência inicial"; }
function deriveTerms(dna: JobDna) { return unique([dna.title, ...dna.criteria.filter((item) => item.kind !== "não relevante").map((item) => item.label)]).slice(0, 12); }
function unique(items: string[]): string[] { return [...new Map<string, string>(items.map((item): [string, string] => [normal(item), item.trim()]).filter(([key]) => Boolean(key))).values()]; }
function compact(value: Record<string, unknown>) { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== "" && (!Array.isArray(item) || item.length))); }
function getPath(record: UnknownRecord, path: string) { return path.split(".").reduce<unknown>((current, key) => isRecord(current) ? current[key] : undefined, record); }
function pick(record: UnknownRecord, paths: string[]) { for (const path of paths) { const value = getPath(record, path); if (typeof value === "string" && value.trim()) return value.trim(); if (typeof value === "number") return String(value); } return ""; }
function firstRecord(value: unknown): UnknownRecord { if (Array.isArray(value)) return value.find(isRecord) ?? {}; return isRecord(value) ? value : {}; }
function isRecord(value: unknown): value is UnknownRecord { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function normal(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }
function normalizeLinkedIn(value: string) { return /linkedin\.com\/in\//i.test(value) ? value.split("?")[0].replace(/\/$/, "") : ""; }
function stableId(value: string) { let hash = 2166136261; for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619); return (hash >>> 0).toString(36); }
function toPrismaConfidence(value: EvidenceState): ConfidenceLevel { return value === "confirmado" ? "CONFIRMED" : value === "provável" ? "LIKELY" : value === "inferência" ? "INFERENCE" : "UNVERIFIED"; }
function fromPrismaConfidence(value: ConfidenceLevel): EvidenceState { return value === "CONFIRMED" ? "confirmado" : value === "LIKELY" ? "provável" : value === "INFERENCE" ? "inferência" : "não verificado"; }
