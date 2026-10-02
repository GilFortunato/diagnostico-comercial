import "server-only";

import { createHash } from "node:crypto";
import { Prisma, type ConfidenceLevel } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import type {
  EvidenceState,
  HrCandidate,
  HrCandidateTeamReview,
  HrHuntingSearchSnapshot,
} from "@/lib/hr-hunting/types";

const PROFILE_REUSE_DAYS = 30;

export function profileKeyForCandidate(candidate: Pick<HrCandidate, "profileUrl" | "id" | "name" | "currentCompany" | "currentTitle">) {
  const linkedin = normalizeLinkedin(candidate.profileUrl);
  if (linkedin) return `linkedin:${linkedin}`;
  if (candidate.id) return `source:${candidate.id}`;
  const signature = [candidate.name, candidate.currentCompany || "", candidate.currentTitle || ""]
    .map(normalizeText)
    .join("|");
  return `signature:${createHash("sha256").update(signature).digest("hex")}`;
}

export async function findReusableCandidateProfiles(limit = 300): Promise<HrCandidate[]> {
  const cutoff = new Date(Date.now() - PROFILE_REUSE_DAYS * 24 * 60 * 60 * 1000);
  const rows = await getPrisma().hrCandidateProfile.findMany({
    where: { lastExternalLookupAt: { gte: cutoff } },
    orderBy: [{ lastExternalLookupAt: "desc" }, { updatedAt: "desc" }],
    take: limit,
  });

  return rows.map((row) => ({
    id: `memory_${row.id}`,
    profileId: row.id,
    name: row.name,
    currentTitle: row.currentTitle || undefined,
    currentCompany: row.currentCompany || undefined,
    location: row.location || undefined,
    profileUrl: row.linkedinUrl || undefined,
    professionalSummary: row.professionalSummary || undefined,
    fitScore: 0,
    fitClassification: "Baixa aderência inicial",
    pointsToValidate: [],
    sourceName: "Banco Share · perfil conhecido",
    confidence: fromPrismaConfidence(row.confidence),
    evidence: [],
    contacts: [],
    shortlisted: false,
    knownByShare: true,
    lastExternalLookupAt: row.lastExternalLookupAt?.toISOString(),
  }));
}

export async function upsertCandidateProfiles(
  tx: Prisma.TransactionClient,
  candidates: HrCandidate[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  for (const candidate of candidates) {
    const profileKey = profileKeyForCandidate(candidate);
    const linkedinUrl = normalizeLinkedin(candidate.profileUrl) || null;
    const existing = linkedinUrl
      ? await tx.hrCandidateProfile.findFirst({ where: { OR: [{ profileKey }, { linkedinUrl }] } })
      : await tx.hrCandidateProfile.findUnique({ where: { profileKey } });

    const data = {
      profileKey,
      linkedinUrl,
      sourcePersonId: candidate.id.startsWith("memory_") ? null : candidate.id,
      name: candidate.name,
      currentTitle: candidate.currentTitle || null,
      currentCompany: candidate.currentCompany || null,
      location: candidate.location || null,
      professionalSummary: candidate.professionalSummary || null,
      sourceName: candidate.sourceName,
      confidence: toPrismaConfidence(candidate.confidence),
      rawSnapshot: candidate as unknown as Prisma.InputJsonValue,
      lastExternalLookupAt: candidate.knownByShare && candidate.lastExternalLookupAt
        ? new Date(candidate.lastExternalLookupAt)
        : new Date(),
    };

    const row = existing
      ? await tx.hrCandidateProfile.update({
          where: { id: existing.id },
          data: {
            ...data,
            profileKey: existing.profileKey,
            linkedinUrl: linkedinUrl || existing.linkedinUrl,
            lastExternalLookupAt: candidate.knownByShare
              ? existing.lastExternalLookupAt
              : data.lastExternalLookupAt,
          },
        })
      : await tx.hrCandidateProfile.create({ data });

    result.set(profileKey, row.id);
  }

  return result;
}

export async function attachCandidateMemory(snapshot: HrHuntingSearchSnapshot): Promise<HrHuntingSearchSnapshot> {
  const profileIds = [...new Set(snapshot.candidates.map((candidate) => candidate.profileId).filter((id): id is string => Boolean(id)))];
  if (!profileIds.length) return snapshot;

  const [profiles, reviews] = await Promise.all([
    getPrisma().hrCandidateProfile.findMany({ where: { id: { in: profileIds } } }),
    getPrisma().hrCandidateReview.findMany({
      where: { profileId: { in: profileIds } },
      orderBy: { createdAt: "desc" },
      take: Math.max(50, profileIds.length * 8),
    }),
  ]);

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const reviewsByProfile = new Map<string, HrCandidateTeamReview[]>();
  for (const review of reviews) {
    const current = reviewsByProfile.get(review.profileId) || [];
    current.push({
      id: review.id,
      verdict: review.verdict === "recommended" ? "recommended" : "alert",
      reviewerName: review.reviewerName,
      note: review.note || undefined,
      searchTitle: review.searchTitle || undefined,
      createdAt: review.createdAt.toISOString(),
    });
    reviewsByProfile.set(review.profileId, current.slice(0, 6));
  }

  return {
    ...snapshot,
    candidates: snapshot.candidates.map((candidate) => {
      if (!candidate.profileId) return candidate;
      const profile = profileById.get(candidate.profileId);
      return {
        ...candidate,
        knownByShare: Boolean(profile),
        lastExternalLookupAt: profile?.lastExternalLookupAt?.toISOString(),
        teamReviews: reviewsByProfile.get(candidate.profileId) || [],
      };
    }),
  };
}

export async function saveCandidateReview(input: {
  candidateId: string;
  reviewerId: string;
  reviewerName: string;
  verdict: "recommended" | "alert";
  note?: string;
}) {
  const candidate = await getPrisma().hrHuntingCandidate.findUnique({
    where: { id: input.candidateId },
    include: { search: { select: { id: true, title: true } } },
  });
  if (!candidate) return null;

  let profileId = candidate.profileId;
  if (!profileId) {
    const candidateShape: HrCandidate = {
      id: candidate.sourcePersonId || candidate.id,
      name: candidate.name,
      currentTitle: candidate.currentTitle || undefined,
      currentCompany: candidate.currentCompany || undefined,
      location: candidate.location || undefined,
      profileUrl: candidate.profileUrl || undefined,
      professionalSummary: candidate.professionalSummary || undefined,
      fitScore: candidate.fitScore,
      fitClassification: candidate.fitClassification as HrCandidate["fitClassification"],
      mainSignal: candidate.mainSignal || undefined,
      pointsToValidate: candidate.pointsToValidate,
      sourceName: candidate.sourceName,
      confidence: fromPrismaConfidence(candidate.confidence),
      evidence: [],
      contacts: [],
      shortlisted: false,
    };

    await getPrisma().$transaction(async (tx) => {
      const map = await upsertCandidateProfiles(tx, [candidateShape]);
      profileId = map.get(profileKeyForCandidate(candidateShape)) || null;
      if (profileId) {
        await tx.hrHuntingCandidate.update({ where: { id: candidate.id }, data: { profileId } });
      }
    });
  }

  if (!profileId) return null;

  return getPrisma().hrCandidateReview.create({
    data: {
      profileId,
      reviewerId: input.reviewerId,
      reviewerName: input.reviewerName,
      verdict: input.verdict,
      note: input.note?.trim() || null,
      searchId: candidate.search.id,
      searchTitle: candidate.search.title,
    },
  });
}

export async function listGlobalCandidateProfiles() {
  const profiles = await getPrisma().hrCandidateProfile.findMany({
    orderBy: { updatedAt: "desc" },
    take: 250,
  });
  if (!profiles.length) return [];

  const reviews = await getPrisma().hrCandidateReview.findMany({
    where: { profileId: { in: profiles.map((profile) => profile.id) } },
    orderBy: { createdAt: "desc" },
  });
  const reviewsByProfile = new Map<string, typeof reviews>();
  for (const review of reviews) {
    const current = reviewsByProfile.get(review.profileId) || [];
    current.push(review);
    reviewsByProfile.set(review.profileId, current);
  }

  return profiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    currentTitle: profile.currentTitle,
    currentCompany: profile.currentCompany,
    location: profile.location,
    linkedinUrl: profile.linkedinUrl,
    lastExternalLookupAt: profile.lastExternalLookupAt?.toISOString() || null,
    updatedAt: profile.updatedAt.toISOString(),
    reviews: (reviewsByProfile.get(profile.id) || []).slice(0, 5).map((review) => ({
      id: review.id,
      verdict: review.verdict,
      reviewerName: review.reviewerName,
      note: review.note,
      searchTitle: review.searchTitle,
      createdAt: review.createdAt.toISOString(),
    })),
  }));
}

function normalizeLinkedin(value?: string) {
  if (!value) return "";
  const normalized = value.trim().split("?")[0].replace(/\/$/, "").toLocaleLowerCase("en-US");
  return /linkedin\.com\/in\//i.test(normalized) ? normalized : "";
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}

function toPrismaConfidence(value: EvidenceState): ConfidenceLevel {
  if (value === "confirmado") return "CONFIRMED";
  if (value === "provável") return "LIKELY";
  if (value === "inferência") return "INFERENCE";
  return "UNVERIFIED";
}

function fromPrismaConfidence(value: ConfidenceLevel): EvidenceState {
  if (value === "CONFIRMED") return "confirmado";
  if (value === "LIKELY") return "provável";
  if (value === "INFERENCE") return "inferência";
  return "não verificado";
}
