import { normalizedLinkedInSnapshotSchema, type NormalizedLinkedInSnapshot } from "@/lib/connectors/linkedinNormalization";

export function mergeLinkedInSnapshots(
  imported?: NormalizedLinkedInSnapshot | null,
  publicSnapshot?: NormalizedLinkedInSnapshot | null,
): NormalizedLinkedInSnapshot | undefined {
  if (!imported) return publicSnapshot ?? undefined;
  if (!publicSnapshot) return imported;

  return normalizedLinkedInSnapshotSchema.parse({
    schemaVersion: 2,
    profileUrl: imported.profileUrl || publicSnapshot.profileUrl,
    collectedAt: mostRecent(imported.collectedAt, publicSnapshot.collectedAt),
    profileAvailable: imported.profileAvailable || publicSnapshot.profileAvailable,
    postsAvailable: imported.postsAvailable || publicSnapshot.postsAvailable,
    userCommentsAvailable: imported.userCommentsAvailable || publicSnapshot.userCommentsAvailable,
    name: imported.name || publicSnapshot.name,
    headline: imported.headline || publicSnapshot.headline,
    about: imported.about || publicSnapshot.about,
    location: imported.location || publicSnapshot.location,
    experiences: mergeUnique(imported.experiences, publicSnapshot.experiences, (item) => key(item.role, item.company, item.startDate)),
    education: mergeUnique(imported.education, publicSnapshot.education, (item) => key(item.institution, item.degree, item.field)),
    certifications: mergeUnique(imported.certifications, publicSnapshot.certifications, (item) => key(item.name, item.institution)),
    skills: unique([...imported.skills, ...publicSnapshot.skills]).slice(0, 80),
    posts: mergePosts(imported.posts, publicSnapshot.posts),
  });
}

function mergePosts(
  imported: NormalizedLinkedInSnapshot["posts"],
  publicPosts: NormalizedLinkedInSnapshot["posts"],
) {
  const items = mergeUnique([...publicPosts, ...imported], [], (item) => item.url || key(item.publishedAt, item.text.slice(0, 120)));
  return items.sort((left, right) => dateValue(right.publishedAt) - dateValue(left.publishedAt)).slice(0, 40);
}

function mergeUnique<T>(primary: T[], secondary: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const item of [...primary, ...secondary]) {
    const identity = getKey(item);
    if (identity && seen.has(identity)) continue;
    if (identity) seen.add(identity);
    output.push(item);
  }
  return output;
}

function unique(values: string[]) {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function key(...values: Array<string | null | undefined>) {
  return values.map((value) => normalize(value ?? "")).filter(Boolean).join("|");
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}

function mostRecent(left: string, right: string) {
  return dateValue(left) >= dateValue(right) ? left : right;
}

function dateValue(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}
