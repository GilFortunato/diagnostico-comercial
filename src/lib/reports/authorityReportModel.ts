import type { AuthorityAssessment, ConfidenceLevel } from "@/lib/diagnostics/authority";
import type { AuthorityThirtyDayPlan } from "@/lib/diagnostics/authorityPlan";
import { confidenceLabel } from "@/lib/copy/editorial";

export type AuthorityReportSnapshot = {
  id: string;
  ownerId: string;
  ownerEmail: string | null;
  subjectName: string | null;
  businessUnitId: string;
  assessment: AuthorityAssessment;
  plan30Days: AuthorityThirtyDayPlan | null;
  createdAt: Date;
};

export type AuthorityReportViewModel = ReturnType<typeof buildAuthorityReportViewModel>;

export function buildAuthorityReportViewModel(snapshot: AuthorityReportSnapshot) {
  const { assessment } = snapshot;
  const subjectName = resolveAnalyzedProfileName(assessment);
  const authorityScore = assessment.authoritySellingScore ?? assessment.overallScore;
  const businessUnitName = assessment.currentFocus?.businessUnitName || assessment.input.businessUnitName;
  const evidencePriority = ["headline", "about", "experiences", "proofPoints", "posts", "education"];
  const profileEvidence = (assessment.profileReview ?? []).map((item) => ({
    field: item.field,
    label: item.label,
    value: truncateExecutiveText(item.value.trim(), 520) || null,
    status: item.evaluationStatus === "not_evaluated" ? "Não avaliado" : confidenceLabel(item.confidence),
    source: publicSourceLabel(item.sourceLabel),
  })).filter((item) => item.value).sort((left, right) => evidenceOrder(left.field, evidencePriority) - evidenceOrder(right.field, evidencePriority)).slice(0, 6);
  const territories = assessment.input.businessUnitContext?.territories ?? [];
  const primaryRecommendation = assessment.personalAuthorityPlan?.priority || assessment.recommendations?.[0] || assessment.nextActions?.[0] || null;

  return {
    id: assessment.id,
    subjectName,
    businessUnitName,
    createdAt: assessment.createdAt,
    profileUrl: assessment.input.profileUrl || null,
    objective: assessment.currentFocus?.objective || assessment.input.objective,
    headline: assessment.input.headline || null,
    scores: {
      authority: authorityScore,
      businessUnitAffinity: assessment.buAffinityScore,
      activationPotential: assessment.activationPotentialScore,
    },
    classification: assessment.authorityClassification ?? null,
    scoreCoverage: assessment.scoreCoverage ?? null,
    scoreExplanations: assessment.scoreExplanations ?? null,
    executiveOpinion: assessment.summary || null,
    executiveSignals: compact([
      assessment.strengths?.[0] ? { label: "Principal força", value: assessment.strengths[0] } : null,
      assessment.opportunities?.[0] ? { label: "Maior oportunidade", value: assessment.opportunities[0] } : null,
      assessment.gaps?.[0] ? { label: "Lacuna prioritária", value: assessment.gaps[0] } : null,
      primaryRecommendation ? { label: "Recomendação prioritária", value: primaryRecommendation } : null,
    ]),
    dimensions: [
      ...(assessment.dimensions ?? []).filter((dimension) => dimension.score !== null).slice(0, 11),
      ...(assessment.dimensions ?? []).filter((dimension) => dimension.score === null).slice(0, 3),
    ].map((dimension) => ({
      label: dimension.label,
      score: dimension.score,
      status: dimension.status ?? (dimension.score === null ? "not_evaluated" : "evaluated"),
      rationale: dimension.rationale,
      evidence: dimension.evidence ?? [],
    })),
    profileEvidence,
    themeAlignment: assessment.themeAlignment ?? [],
    authorityMap: assessment.authorityMap ?? [],
    authorityPerception: assessment.authorityPerception ?? null,
    evidencePortfolio: assessment.evidencePortfolio ?? null,
    commercialExposure: (assessment.commercialExposure ?? []).slice(0, 6),
    strategicGaps: (assessment.strategicGaps ?? []).slice(0, 5),
    authorityAgenda: assessment.authorityAgenda ?? null,
    bridges: (assessment.bridgeOpportunities ?? []).slice(0, 3),
    strengths: (assessment.strengths ?? []).slice(0, 6),
    gaps: (assessment.gaps ?? []).slice(0, 6),
    recommendations: (assessment.recommendations ?? []).slice(0, 6),
    nextBestAction: assessment.nextBestAction
      ? { priority: assessment.nextBestAction.title, why: assessment.nextBestAction.reason, actions: assessment.nextBestAction.actions.slice(0, 4) }
      : primaryRecommendation
        ? { priority: primaryRecommendation, why: assessment.gaps?.[0] || assessment.summary || null, actions: (assessment.personalAuthorityPlan?.actions ?? assessment.nextActions ?? []).slice(0, 4) }
        : null,
    plan: snapshot.plan30Days,
    territories,
    themes: assessment.themeAlignment?.map((item) => item.theme) ?? [],
    sources: (assessment.sources ?? []).map((source) => ({
      title: publicSourceLabel(source.title),
      notes: publicSourceNotes(source.notes),
      status: confidenceLabel(source.confidence),
    })),
  };
}

function truncateExecutiveText(value: string, max: number) {
  const clean = value.replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trim()}…` : clean;
}

export function buildAuthorityReportFilename(subjectName: string | null, createdAt: string | Date) {
  const safeName = sanitizeFilenamePart(subjectName || "Perfil");
  const date = new Date(createdAt);
  const safeDate = Number.isNaN(date.getTime()) ? "sem-data" : date.toISOString().slice(0, 10);
  return `ShareAI_Diagnostico_LinkedIn_${safeName}_${safeDate}.pdf`;
}

export function confidenceDescription(level: ConfidenceLevel) {
  return confidenceLabel(level);
}

function sanitizeFilenamePart(value: string) {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const safe = normalized.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
  return safe || "Perfil";
}

function resolveAnalyzedProfileName(assessment: AuthorityAssessment) {
  const explicit = typeof assessment.analyzedProfileName === "string" ? assessment.analyzedProfileName.trim() : "";
  const fromSnapshot = assessment.input.linkedinSnapshot?.name?.trim() ?? "";
  return explicit || fromSnapshot || "Nome não identificado";
}

function publicSourceLabel(value: string) {
  if (/\b(?:apify|actor|scraper|endpoint|api)\b/i.test(value)) return "Perfil público do LinkedIn";
  if (/\b(?:gemini|provider|modelo)\b/i.test(value)) return "Análise estruturada da Share AI";
  return value;
}

function publicSourceNotes(value: string) {
  return value
    .replace(/Apify/gi, "fonte pública autorizada")
    .replace(/Gemini/gi, "inteligência da Share AI")
    .replace(/\bActors?\b/gi, "fontes")
    .replace(/\bAPI\b/gi, "integração");
}

function evidenceOrder(field: string, priority: string[]) {
  const index = priority.indexOf(field);
  return index === -1 ? priority.length : index;
}

function compact<T>(items: Array<T | null | undefined>): T[] {
  return items.filter((item): item is T => item !== null && item !== undefined);
}
