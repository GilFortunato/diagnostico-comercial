import { normalizeCandidates } from "@/lib/hr-hunting/service";

export function profileQueries(titles: string[], location: string, keywords: string[]) {
  const term = (text: string) => text.replace(/[^\p{L}\p{N} .-]+/gu, " ").trim().split(/\s+/).slice(0, 8).join(" ");
  const terms = [...new Set(titles.map(term).filter(Boolean))];
  const filters = keywords.map(term).filter(Boolean);
  const keywordsQuery = filters.length ? "(" + filters.map((word) => '"' + word + '"').join(" OR ") + ")" : "";
  return terms.map((title) => ['site:linkedin.com/in/', '"' + title + '"', term(location), keywordsQuery].filter(Boolean).join(" "));
}

export function indexedProfiles(rows: unknown[], location = "") {
  const profiles = [];
  for (const page of rows) {
    if (!page || typeof page !== "object" || !("organicResults" in page) || !Array.isArray(page.organicResults)) continue;
    for (const hit of page.organicResults) {
      if (typeof hit?.url !== "string" || typeof hit.title !== "string") continue;
      let url;
      try { url = new URL(hit.url); } catch { continue; }
      if (url.protocol !== "https:" || url.username || url.password || !/^(?:[a-z]{2,3}\.)?linkedin\.com$/i.test(url.hostname) || !/^\/in\/[^/]+\/?$/.test(url.pathname)) continue;
      const headline = hit.title.replace(/\s*[|·]\s*LinkedIn(?:\s+[\p{L} ]+)?$/iu, "").trim();
      const match = headline.match(/^(.{3,90}?)\s+[-–—|]\s+(.+)$/u);
      if (!match || !/^[\p{L}\p{M}.'’ -]+$/u.test(match[1]) || !match[1].trim().includes(" ")) continue;
      if (/^(?:ex[- ]|former\b)|\b(?:ex[- ]|former\s+)(?:advogad|counsel|manager|analista)/i.test(match[2])) continue;
      const snippet = typeof hit.description === "string" ? hit.description : "";
      const place = snippet.match(/(?:localiza[çc][ãa]o|location)\s*:\s*([^·|•;]{2,100})/iu)?.[1]?.trim()
        || snippet.match(/^([\p{L} ,.-]{2,90}(?:Brasil|Brazil))\s*[·|•]/iu)?.[1]?.trim();
      // A query's location alone is not evidence that the person is based there.
      if (location && !place) continue;
      profiles.push({ fullName: match[1], jobTitle: match[2], linkedinUrl: "https://www.linkedin.com" + url.pathname.replace(/\/$/, ""),
        location: place, summary: snippet, sourceName: "LinkedIn · título público indexado no Google" });
    }
  }
  return normalizeCandidates(profiles);
}
