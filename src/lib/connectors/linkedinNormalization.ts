import { z } from "zod";

const optionalText = z.string().optional().default("");
const optionalNullableText = z.string().nullable().optional().default(null);
const optionalNullableNumber = z.number().nullable().optional().default(null);

export const normalizedLinkedInSnapshotSchema = z.object({
  schemaVersion: z.literal(2),
  profileUrl: z.string().url(),
  collectedAt: z.string(),
  profileAvailable: z.boolean(),
  postsAvailable: z.boolean(),
  userCommentsAvailable: z.boolean(),
  name: optionalText,
  headline: optionalText,
  about: optionalText,
  location: optionalNullableText,
  experiences: z.array(z.object({
    role: optionalText,
    company: optionalText,
    location: optionalNullableText,
    employmentType: optionalNullableText,
    workMode: optionalNullableText,
    startDate: optionalNullableText,
    endDate: optionalNullableText,
    description: optionalNullableText,
    skills: z.array(z.string()).default([]),
    companyUrl: optionalNullableText,
  })).default([]),
  education: z.array(z.object({
    institution: optionalText,
    degree: optionalNullableText,
    field: optionalNullableText,
    startDate: optionalNullableText,
    endDate: optionalNullableText,
    description: optionalNullableText,
  })).default([]),
  certifications: z.array(z.object({
    name: optionalText,
    institution: optionalNullableText,
    issuedAt: optionalNullableText,
    credentialUrl: optionalNullableText,
  })).default([]),
  skills: z.array(z.string()).default([]),
  posts: z.array(z.object({
    text: optionalText,
    publishedAt: optionalNullableText,
    reactions: optionalNullableNumber,
    comments: optionalNullableNumber,
    reposts: optionalNullableNumber,
    url: optionalNullableText,
    mediaType: optionalNullableText,
  })).default([]),
});

export type NormalizedLinkedInSnapshot = z.infer<typeof normalizedLinkedInSnapshotSchema>;

export function normalizeLinkedInPayload({
  profileUrl,
  profile,
  posts,
  collectedAt = new Date().toISOString(),
}: {
  profileUrl: string;
  profile?: Record<string, unknown> | null;
  posts?: unknown[] | null;
  collectedAt?: string;
}): NormalizedLinkedInSnapshot {
  const experienceItems = listOfRecords(profile, ["experience", "experiences", "positions"]);
  const educationItems = listOfRecords(profile, ["education", "educations"]);
  const certificationItems = listOfRecords(profile, ["certifications", "certificates", "licensesAndCertifications"]);
  const postItems = (posts ?? []).filter(isRecord);

  return normalizedLinkedInSnapshotSchema.parse({
    schemaVersion: 2,
    profileUrl,
    collectedAt,
    profileAvailable: Boolean(profile),
    postsAvailable: postItems.length > 0,
    userCommentsAvailable: false,
    name: pickText(profile, ["fullName", "name", "displayName"]),
    headline: pickText(profile, ["headline", "title", "occupation", "currentJobTitle"]),
    about: pickText(profile, ["about", "summary", "description", "bio"]),
    location: pickText(profile, ["location", "geoLocationName", "city"]) || null,
    experiences: experienceItems.map(normalizeExperience).filter(hasExperienceValue),
    education: educationItems.map(normalizeEducation).filter(hasEducationValue),
    certifications: certificationItems.map(normalizeCertification).filter((item) => Boolean(item.name)),
    skills: normalizeStringList(readFirst(profile, ["skills", "topSkills"])),
    posts: postItems.map(normalizePost).filter((item) => Boolean(item.text)).slice(0, 8),
  });
}

export function buildAuthorityInputFromLinkedIn(snapshot: NormalizedLinkedInSnapshot) {
  const experiences = snapshot.experiences.map((item) => [
    [item.role, item.company].filter(Boolean).join(" na "),
    item.description,
  ].filter(Boolean).join(": ")).filter(Boolean);
  const education = snapshot.education.map((item) => [item.degree, item.field, item.institution].filter(Boolean).join(" · ")).filter(Boolean);
  const certifications = snapshot.certifications.map((item) => [item.name, item.institution].filter(Boolean).join(" · ")).filter(Boolean);
  const posts = snapshot.posts.map((item) => item.text).filter(Boolean);
  const interactionTotals = snapshot.posts.reduce((totals, post) => ({
    reactions: totals.reactions + (post.reactions ?? 0),
    comments: totals.comments + (post.comments ?? 0),
    reposts: totals.reposts + (post.reposts ?? 0),
  }), { reactions: 0, comments: 0, reposts: 0 });

  return {
    headline: snapshot.headline,
    about: [snapshot.about, experiences.join("\n")].filter(Boolean).join("\n\n"),
    themes: [...snapshot.skills, ...certifications].filter(Boolean).join(", "),
    proofPoints: [...experiences, ...education, ...certifications].filter(Boolean).join("\n"),
    recentContent: posts.join("\n\n"),
    interactionSignals: snapshot.postsAvailable
      ? `${snapshot.posts.length} publicações recuperadas; ${interactionTotals.reactions} reações, ${interactionTotals.comments} comentários recebidos e ${interactionTotals.reposts} republicações.`
      : "",
    linkedinSnapshot: snapshot,
  };
}

export function extractMeasurableResults(snapshot?: NormalizedLinkedInSnapshot | null) {
  if (!snapshot) return [];
  const texts = [snapshot.about, ...snapshot.experiences.map((item) => item.description ?? "")];
  const resultPattern = /(?:redu(?:ção|ziu|zido)|aument(?:o|ou)|econom(?:ia|izou)|melhor(?:a|ou)|crescimento|nps|lead\s*time|tickets?|horas?).{0,90}?(?:\d+[\d.,]*\s*%?|\d+[\d.,]*\s*(?:horas?|dias?|pontos?))/giu;
  return unique(texts.flatMap((text) => normalizeHumanText(text).match(resultPattern) ?? []).map((item) => item.trim())).slice(0, 8);
}

export function normalizeHumanText(value: unknown) {
  if (typeof value !== "string") return "";
  let text = value.normalize("NFKC").replace(/[\u0000-\u001F\u007F\uFFFD]/g, " ").trim();
  if (/%[0-9A-Fa-f]{2}/.test(text)) {
    try { text = decodeURIComponent(text); } catch { /* Keep the original human-readable fragment. */ }
  }
  text = text.replace(/\s+/g, " ").trim();
  if (!text || isTechnicalValue(text) || hasCorruptedEncoding(text)) return "";
  return text;
}

function hasCorruptedEncoding(value: string) {
  const hasLatin = /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(value);
  const hasCyrillic = /[\u0400-\u04FF]/.test(value);
  return (hasLatin && hasCyrillic) || /(?:Ã.|Â.|Ð.|Ñ.){2,}/.test(value);
}

function normalizeExperience(item: Record<string, unknown>) {
  return {
    role: pickText(item, ["role", "title", "position", "jobTitle"]),
    company: pickText(item, ["companyName", "company", "organization", "employer"]),
    location: pickText(item, ["location", "locationName"]) || null,
    employmentType: pickText(item, ["employmentType", "type"]) || null,
    workMode: pickText(item, ["workMode", "locationType"]) || null,
    startDate: pickDate(item, ["startDate", "startedAt", "from"]) || null,
    endDate: pickDate(item, ["endDate", "endedAt", "to"]) || null,
    description: pickText(item, ["description", "summary", "details"]) || null,
    skills: normalizeStringList(readFirst(item, ["skills"])),
    companyUrl: pickSafeUrl(item, ["companyUrl", "companyLinkedinUrl", "url"]),
  };
}

function normalizeEducation(item: Record<string, unknown>) {
  return {
    institution: pickText(item, ["institution", "schoolName", "school", "organization"]),
    degree: pickText(item, ["degree", "degreeName", "qualification"]) || null,
    field: pickText(item, ["field", "fieldOfStudy", "subject"]) || null,
    startDate: pickDate(item, ["startDate", "startedAt", "from"]) || null,
    endDate: pickDate(item, ["endDate", "endedAt", "to"]) || null,
    description: pickText(item, ["description", "activities", "summary"]) || null,
  };
}

function normalizeCertification(item: Record<string, unknown>) {
  return {
    name: pickText(item, ["name", "title", "certificateName"]),
    institution: pickText(item, ["institution", "authority", "issuer", "organization"]) || null,
    issuedAt: pickDate(item, ["issuedAt", "issueDate", "startDate"]) || null,
    credentialUrl: pickSafeUrl(item, ["credentialUrl", "url"]),
  };
}

function normalizePost(item: Record<string, unknown>) {
  return {
    text: pickText(item, ["text", "content", "commentary", "postText", "description"]),
    publishedAt: pickDate(item, ["publishedAt", "postedAt", "date", "createdAt"]) || null,
    reactions: pickNumber(item, ["reactions", "reactionCount", "numLikes", "likes"]),
    comments: pickNumber(item, ["comments", "commentCount", "numComments"]),
    reposts: pickNumber(item, ["reposts", "repostCount", "numShares", "shares"]),
    url: pickSafeUrl(item, ["url", "postUrl", "linkedinUrl"]),
    mediaType: pickText(item, ["mediaType", "type", "contentType"]) || null,
  };
}

function listOfRecords(source: Record<string, unknown> | null | undefined, keys: string[]) {
  const value = readFirst(source, keys);
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function readFirst(source: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!source) return undefined;
  for (const key of keys) if (source[key] !== undefined && source[key] !== null) return source[key];
  return undefined;
}

function pickText(source: Record<string, unknown> | null | undefined, keys: string[]) {
  const value = readFirst(source, keys);
  if (typeof value === "string") return normalizeHumanText(value);
  if (isRecord(value)) return normalizeHumanText(readFirst(value, ["name", "title", "text", "label", "localizedName"]));
  return "";
}

function pickDate(source: Record<string, unknown>, keys: string[]) {
  const value = readFirst(source, keys);
  if (typeof value === "string") return normalizeHumanText(value);
  if (typeof value === "number") return value > 1900 && value < 2200 ? String(value) : "";
  if (isRecord(value)) {
    const month = typeof value.month === "number" ? value.month : null;
    const year = typeof value.year === "number" ? value.year : null;
    return year ? [month ? String(month).padStart(2, "0") : null, year].filter(Boolean).join("/") : "";
  }
  return "";
}

function pickNumber(source: Record<string, unknown>, keys: string[]) {
  const value = readFirst(source, keys);
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value);
  return null;
}

function pickSafeUrl(source: Record<string, unknown>, keys: string[]) {
  const value = readFirst(source, keys);
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return unique(value.map((item) => {
    if (typeof item === "string") return normalizeHumanText(item);
    if (isRecord(item)) return pickText(item, ["name", "skill", "title", "label"]);
    return "";
  }).filter(Boolean)).slice(0, 30);
}

function isTechnicalValue(value: string) {
  return /^https?:\/\//i.test(value)
    || /(?:\.jpg|\.jpeg|\.png|\.webp|\.gif)(?:\?|$)/i.test(value)
    || /^urn:li:/i.test(value)
    || /^\d{2,4}\s*[x× ]\s*\d{2,4}$/i.test(value)
    || /^(?:[a-f0-9]{20,}|[A-Za-z0-9_-]{35,})$/i.test(value);
}

function hasExperienceValue(item: ReturnType<typeof normalizeExperience>) {
  return Boolean(item.role || item.company || item.description);
}

function hasEducationValue(item: ReturnType<typeof normalizeEducation>) {
  return Boolean(item.institution || item.degree || item.field);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function unique(values: string[]) {
  return [...new Set(values)];
}
