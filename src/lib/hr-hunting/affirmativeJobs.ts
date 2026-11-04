import "server-only";
import { runApifyActor } from "@/lib/connectors/apifyClient";
import type { PublicAffirmativeJob } from "@/lib/hr-hunting/types";

type SearchRow = Record<string, unknown>;

const affirmativeSignal = /\bafirmativ[ao]s?\b|\bexclusiv[ao]s?\s+(?:para\s+)?(?:pessoas|mulheres|candidat[ao]s?|pcd|negr[ao]s?|trans|ind[ií]gen[ao]s?)\b/i;
const jobSignal = /\bvagas?\b|\bjobs?\b|\bcarreiras?\b|\boportunidades?\b|\btrainee\b|\best[aá]gio\b|\bprocesso seletivo\b/i;

export async function findPublicAffirmativeJobs(title: string, location = ""): Promise<PublicAffirmativeJob[]> {
  const scope = [safeSearchPhrase(title, 8), safeSearchPhrase(location, 6)].filter(Boolean).join(" ");
  const queries = [
    scope + ' "vaga afirmativa"',
    scope + ' "processo seletivo afirmativo"',
    scope + ' "vaga exclusiva"',
    scope + ' "programa afirmativo" recrutamento',
  ].join("\n");
  const rows = await runApifyActor("publicJobSearch", {
    queries,
    maxPagesPerQuery: 1,
    countryCode: "br",
    languageCode: "pt-BR",
    saveHtmlToKeyValueStore: false,
    maximumLeadsEnrichmentRecords: 0,
  }, { timeoutMs: 45_000 });
  return normalizePublicAffirmativeJobs(rows);
}

export function normalizePublicAffirmativeJobs(rows: unknown[]): PublicAffirmativeJob[] {
  const seen = new Set<string>();
  const jobs: PublicAffirmativeJob[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const organic = Array.isArray(row.organicResults) ? row.organicResults : [row];
    for (const item of organic) {
      if (!isRecord(item)) continue;
      const title = stringField(item.title).slice(0, 180);
      const snippet = stringField(item.description || item.snippet).slice(0, 500);
      const rawUrl = stringField(item.url);
      if (!title || !snippet || !rawUrl) continue;

      let url: URL;
      try { url = new URL(rawUrl); } catch { continue; }
      if (url.protocol !== "https:" || url.username || url.password) continue;
      if (/^(?:blog|noticias|news)\./i.test(url.hostname)) continue;
      if (/\/(?:blog|noticias?|artigos?|news|tags?|categorias?)\//i.test(url.pathname)) continue;
      if (!affirmativeSignal.test(title + " " + snippet)) continue;
      if (!jobSignal.test(title + " " + url.pathname)) continue;

      const key = url.origin + url.pathname.replace(/\/$/, "");
      if (seen.has(key)) continue;
      seen.add(key);
      jobs.push({
        title,
        url: url.toString(),
        source: url.hostname.replace(/^www\./, ""),
        snippet,
      });
      if (jobs.length >= 20) return jobs;
    }
  }
  return jobs;
}

function isRecord(value: unknown): value is SearchRow {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringField(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function safeSearchPhrase(value: string, maxWords: number) {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\p{L}\p{N}\s,.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, maxWords)
    .join(" ");
}
