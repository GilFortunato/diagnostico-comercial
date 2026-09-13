import type { HrCandidate } from "@/lib/hr-hunting/types";
import type { HumanshipParticipant } from "@/lib/humanship/types";

export type HumanshipLinkedinMatch = {
  candidate: HrCandidate;
  confidence: "confirmed" | "probable";
  score: number;
  nameScore: number;
  companyScore: number;
  titleScore: number;
};

export function buildHumanshipLinkedinQueries(participant: Pick<HumanshipParticipant, "fullName" | "company">) {
  const fullName = clean(participant.fullName);
  const company = clean(participant.company || "");
  const shortened = shortenedName(fullName);
  const queries = [
    [quote(fullName), company ? quote(company) : ""].filter(Boolean).join(" "),
    quote(shortened || fullName),
  ];
  return [...new Set(queries.map((item) => item.trim()).filter(Boolean))].slice(0, 2);
}

export function chooseHumanshipLinkedinMatch(
  participant: Pick<HumanshipParticipant, "fullName" | "company" | "jobTitle">,
  candidates: HrCandidate[],
): HumanshipLinkedinMatch | null {
  const ranked = candidates.map((candidate) => {
    const nameScore = personNameSimilarity(participant.fullName, candidate.name);
    const companyScore = textSimilarity(participant.company || "", candidate.currentCompany || "");
    const titleScore = textSimilarity(participant.jobTitle || "", candidate.currentTitle || "");
    const exactName = normalizeName(participant.fullName) === normalizeName(candidate.name);
    const corroboration = Math.max(companyScore, titleScore);
    const score = nameScore * 0.76 + companyScore * 0.18 + titleScore * 0.06;
    const confirmed = (exactName && corroboration >= 0.3)
      || (nameScore >= 0.84 && corroboration >= 0.28)
      || score >= 0.8;
    const probable = exactName
      || nameScore >= 0.68
      || (nameScore >= 0.58 && corroboration >= 0.45);
    return { candidate, confidence: confirmed ? "confirmed" as const : probable ? "probable" as const : null, score, nameScore, companyScore, titleScore };
  })
    .filter((item): item is Omit<typeof item, "confidence"> & { confidence: "confirmed" | "probable" } => Boolean(item.confidence) && Boolean(item.candidate.profileUrl))
    .sort((a, b) => {
      if (a.confidence !== b.confidence) return a.confidence === "confirmed" ? -1 : 1;
      return b.score - a.score;
    });

  return ranked[0] ?? null;
}

export function personNameSimilarity(a: string, b: string) {
  const leftText = normalizeName(a);
  const rightText = normalizeName(b);
  if (!leftText || !rightText) return 0;
  if (leftText === rightText) return 1;
  if (leftText.includes(rightText) || rightText.includes(leftText)) return 0.92;

  const left = meaningfulNameTokens(leftText);
  const right = meaningfulNameTokens(rightText);
  const intersection = left.filter((token) => right.includes(token)).length;
  const base = intersection / Math.max(left.length, right.length, 1);
  const sameFirstName = left[0] && left[0] === right[0];
  if (sameFirstName && intersection >= 2) return Math.max(base, 0.72);
  return base;
}

export function textSimilarity(a: string, b: string) {
  const leftText = normalize(a);
  const rightText = normalize(b);
  if (!leftText || !rightText) return 0;
  if (leftText === rightText || leftText.includes(rightText) || rightText.includes(leftText)) return 1;
  const left = new Set(leftText.split(/[^a-z0-9]+/).filter((token) => token.length >= 2));
  const right = new Set(rightText.split(/[^a-z0-9]+/).filter((token) => token.length >= 2));
  const intersection = [...left].filter((token) => right.has(token)).length;
  return intersection / Math.max(left.size, right.size, 1);
}

function shortenedName(value: string) {
  const tokens = value.split(/\s+/).filter(Boolean);
  if (tokens.length <= 2) return value;
  return tokens.slice(0, -1).join(" ");
}

function meaningfulNameTokens(value: string) {
  const ignored = new Set(["de", "da", "do", "das", "dos", "e"]);
  return value.split(/\s+/).filter((token) => token.length >= 2 && !ignored.has(token));
}

function normalizeName(value: string) {
  return normalize(value).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function quote(value: string) {
  const cleaned = value.replace(/"/g, "").trim();
  return cleaned.includes(" ") ? `"${cleaned}"` : cleaned;
}
