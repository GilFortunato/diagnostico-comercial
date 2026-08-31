import "server-only";
import { Prisma, type ConfidenceLevel } from "@prisma/client";
import { runApifyActor } from "@/lib/connectors/apifyClient";
import { getPrisma } from "@/lib/db/prisma";
import { createJobDna } from "@/lib/hr-hunting/jobDna";
import type { CriterionKind, EvidenceState, HrCandidate, HrHuntingSearchSnapshot, JobDna, MessageFormat } from "@/lib/hr-hunting/types";

type SearchInput = { quantity: number; currentTitle?: string; seniority: string[]; location?: string; keywords: string[] };
type UnknownRecord = Record<string, unknown>;

export async function createHrHuntingSearch(ownerId: string, input: { title: string; description: string; jobUrl?: string; companyName?: string; recruiterName?: string }) {
  const jobDna = await createJobDna(input);
  const search = await getPrisma().hrHuntingSearch.create({
    data: { ownerId, title: input.title, jobDescription: input.description, jobUrl: input.jobUrl || null, companyName: input.companyName || null, recruiterName: input.recruiterName || null, jobDna: jobDna as unknown as Prisma.InputJsonValue, searchTerms: deriveTerms(jobDna), status: "job_dna_ready", connectorWarnings: [] },
  });
  return findOwnedHrHuntingSearch(search.id, ownerId);
}

export async function updateHrHuntingJobDna(id: string, ownerId: string, jobDna: JobDna) {
  await getPrisma().hrHuntingSearch.updateMany({ where: { id, ownerId }, data: { jobDna: jobDna as unknown as Prisma.InputJsonValue, searchTerms: deriveTerms(jobDna), status: "job_dna_ready" } });
  return findOwnedHrHuntingSearch(id, ownerId);
}

export async function executeHrHuntingSearch(id: string, ownerId: string, input: SearchInput) {
  const search = await findOwnedHrHuntingSearch(id, ownerId);
  if (!search) return null;
  const searchTerms = unique([input.currentTitle || "", ...search.searchTerms, ...input.keywords]).slice(0, 16);
  const warnings: string[] = input.location ? ["A localização foi usada para leitura de aderência quando retornada pela fonte. O conector de descoberta atual não aceita esse filtro como parâmetro de busca."] : [];
  let rawItems: unknown[] = [];
  try {
    rawItems = await runApifyActor("leadDiscovery", compact({ totalResults: 100, companyMode: false, personTitle: searchTerms, seniority: input.seniority }));
  } catch {
    warnings.push("Não foi possível concluir a fonte de descoberta de profissionais. Nenhum candidato foi criado como substituição.");
  }
  const candidates = rankCandidates(normalizeCandidates(rawItems), search.jobDna, input).slice(0, input.quantity);
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
    await tx.hrHuntingSearch.update({ where: { id }, data: { status: rawItems.length ? "results_ready" : "no_results", sourceSnapshot: rawItems as Prisma.InputJsonValue, connectorWarnings: warnings } });
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

function serializeSearch(row: Awaited<ReturnType<typeof getPrisma>> extends never ? never : any): HrHuntingSearchSnapshot {
  const candidates: HrCandidate[] = row.candidates.map((candidate: any) => ({
    id: candidate.id, name: candidate.name, currentTitle: candidate.currentTitle || undefined, currentCompany: candidate.currentCompany || undefined, location: candidate.location || undefined,
    profileUrl: candidate.profileUrl || undefined, professionalSummary: candidate.professionalSummary || undefined, fitScore: candidate.fitScore, fitClassification: candidate.fitClassification,
    mainSignal: candidate.mainSignal || undefined, pointsToValidate: candidate.pointsToValidate, sourceName: candidate.sourceName, confidence: fromPrismaConfidence(candidate.confidence),
    evidence: candidate.evidence.map((item: any) => ({ criterion: item.criterion, criterionType: item.criterionType, result: item.result, evidence: item.evidence || undefined, source: item.source, confidence: fromPrismaConfidence(item.confidence) })),
    contacts: candidate.contacts.map((item: any) => ({ value: item.value, type: item.type, source: item.source, confidence: fromPrismaConfidence(item.confidence), obtainedAt: item.obtainedAt?.toISOString() })),
    shortlisted: Boolean(candidate.shortlist), shortlist: candidate.shortlist ? { nextStep: candidate.shortlist.nextStep || undefined, notes: candidate.shortlist.notes || undefined } : undefined,
  }));
  return { id: row.id, title: row.title, jobDescription: row.jobDescription, jobUrl: row.jobUrl || undefined, companyName: row.companyName || undefined, recruiterName: row.recruiterName || undefined, jobDna: row.jobDna as JobDna, searchTerms: row.searchTerms, status: row.status, connectorWarnings: row.connectorWarnings, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), candidates };
}

export function normalizeCandidates(items: unknown[]): HrCandidate[] {
  const seen = new Set<string>();
  return items.flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const name = pick(item, ["fullName", "name", "profile.fullName", "person.name"]);
    const title = pick(item, ["title", "jobTitle", "headline", "position", "currentPosition.title"]);
    const profileUrl = normalizeLinkedIn(pick(item, ["linkedinUrl", "linkedin_url", "profileUrl", "url", "profile.linkedinUrl"]));
    if (!name || !title || /pessoa a identificar/i.test(name)) return [];
    const company = pick(item, ["companyName", "company", "organization.name", "currentPosition.companyName"]);
    const key = profileUrl || `${normal(name)}|${normal(company)}|${normal(title)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const email = pick(item, ["workEmail", "businessEmail", "professionalEmail"]);
    const phone = pick(item, ["workPhone", "businessPhone", "professionalPhone"]);
    return [{ id: `hr_${stableId(key || String(index))}`, name, currentTitle: title, currentCompany: company || undefined, location: pick(item, ["location", "locationName", "geo"]) || undefined, profileUrl: profileUrl || undefined, professionalSummary: pick(item, ["about", "summary", "description", "profile.summary"]) || undefined, fitScore: 0, fitClassification: "Baixa aderência inicial" as const, pointsToValidate: [], sourceName: "Descoberta pública via Apify", confidence: profileUrl ? "confirmado" as const : "provável" as const, evidence: [], contacts: [...(email ? [{ value: email, type: "e-mail profissional" as const, source: "Descoberta pública via Apify", confidence: "confirmado" as const }] : []), ...(phone ? [{ value: phone, type: "telefone profissional" as const, source: "Descoberta pública via Apify", confidence: "confirmado" as const }] : [])], shortlisted: false }];
  });
}

export function rankCandidates(candidates: HrCandidate[], dna: JobDna, input: SearchInput) {
  const criteria = dna.criteria.filter((criterion) => criterion.kind !== "não relevante");
  return candidates.map((candidate) => {
    const text = normal([candidate.currentTitle, candidate.currentCompany, candidate.location, candidate.professionalSummary].filter(Boolean).join(" "));
    const evidence = criteria.map((criterion) => evaluateCriterion(criterion.label, criterion.kind, text, candidate.sourceName));
    const required = evidence.filter((item) => item.criterionType === "obrigatório");
    const desired = evidence.filter((item) => item.criterionType === "desejável");
    const requiredRatio = ratio(required); const desiredRatio = ratio(desired);
    const titleMatch = input.currentTitle && text.includes(normal(input.currentTitle)) ? 15 : 0;
    const locationMatch = input.location && candidate.location && normal(candidate.location).includes(normal(input.location)) ? 5 : 0;
    const score = Math.round(Math.min(100, (required.length ? requiredRatio * 75 : 0) + (desired.length ? desiredRatio * 20 : 0) + titleMatch + locationMatch));
    const matched = evidence.filter((item) => item.result === "atende");
    return { ...candidate, fitScore: score, fitClassification: classify(score), mainSignal: matched[0]?.criterion, pointsToValidate: evidence.filter((item) => item.result !== "atende").map((item) => item.criterion), evidence };
  }).sort((a, b) => b.fitScore - a.fitScore || a.name.localeCompare(b.name, "pt-BR"));
}

function evaluateCriterion(label: string, kind: CriterionKind, profileText: string, source: string) {
  const terms = normal(label).split(/\s+/).filter((term) => term.length > 3 && !/requisito|experiencia|conhecimento|desejavel|obrigatorio/.test(term));
  const matches = terms.filter((term) => profileText.includes(term));
  const result = matches.length === 0 ? "não verificado" as const : matches.length === terms.length ? "atende" as const : "parcial" as const;
  return { criterion: label, criterionType: kind, result, evidence: matches.length ? `Termos encontrados no perfil retornado pela fonte: ${matches.join(", ")}.` : undefined, source, confidence: matches.length ? "confirmado" as const : "não verificado" as const };
}

function ratio(evidence: Array<{ result: string }>) { return evidence.length ? evidence.reduce((sum, item) => sum + (item.result === "atende" ? 1 : item.result === "parcial" ? 0.5 : 0), 0) / evidence.length : 0; }
function classify(score: number): HrCandidate["fitClassification"] { if (score >= 90) return "Muito alta"; if (score >= 80) return "Alta"; if (score >= 70) return "Boa"; if (score >= 60) return "Parcial"; return "Baixa aderência inicial"; }
function deriveTerms(dna: JobDna) { return unique([dna.title, ...dna.criteria.filter((item) => item.kind !== "não relevante").map((item) => item.label)]).slice(0, 12); }
function unique(items: string[]): string[] { return [...new Map<string, string>(items.map((item): [string, string] => [normal(item), item.trim()]).filter(([key]) => Boolean(key))).values()]; }
function compact(value: Record<string, unknown>) { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== "" && (!Array.isArray(item) || item.length))); }
function pick(record: UnknownRecord, paths: string[]) { for (const path of paths) { const value = path.split(".").reduce<unknown>((current, key) => isRecord(current) ? current[key] : undefined, record); if (typeof value === "string" && value.trim()) return value.trim(); } return ""; }
function isRecord(value: unknown): value is UnknownRecord { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function normal(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
function normalizeLinkedIn(value: string) { return /linkedin\.com\/in\//i.test(value) ? value.split("?")[0].replace(/\/$/, "") : ""; }
function stableId(value: string) { let hash = 2166136261; for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619); return (hash >>> 0).toString(36); }
function toPrismaConfidence(value: EvidenceState): ConfidenceLevel { return value === "confirmado" ? "CONFIRMED" : value === "provável" ? "LIKELY" : value === "inferência" ? "INFERENCE" : "UNVERIFIED"; }
function fromPrismaConfidence(value: ConfidenceLevel): EvidenceState { return value === "CONFIRMED" ? "confirmado" : value === "LIKELY" ? "provável" : value === "INFERENCE" ? "inferência" : "não verificado"; }
