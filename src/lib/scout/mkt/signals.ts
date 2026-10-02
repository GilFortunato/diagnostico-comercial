import { createHash } from "node:crypto";
import { getBrandContext } from "./brands";
import { signalSchema, trendSchema, type BrandId, type ScoreComponent, type Signal, type Trend } from "./types";

const HOUR = 60 * 60 * 1000;
const STOPWORDS = new Set("a o as os e de da do das dos em no na nos nas um uma uns umas para por com sem ao aos que se sua seu suas seus sobre entre como mais menos apos antes ser ter sao foi sera nao hoje agora novo nova novos novas the and for from with that this into after over about its you your are was were has have not new to an of in on is at by it em alta diz says will can".split(" "));
export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function tokens(value: string) { return [...new Set(normalizeText(value).split(" ").filter((word) => word.length >= 2 && !STOPWORDS.has(word)))]; }

export function canonicalUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.protocol = "https:";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^utm_|^(fbclid|gclid|mc_cid|mc_eid|ref|oc)$/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    return url.toString().replace(/\/$/, "");
  } catch { return null; }
}

function sameStory(left: Signal, right: Signal): boolean {
  const leftUrl = canonicalUrl(left.url);
  if (leftUrl && leftUrl === canonicalUrl(right.url)) return true;
  const leftTitle = normalizeText(left.title);
  const rightTitle = normalizeText(right.title);
  if (leftTitle === rightTitle) return true;
  const leftTokens = tokens(left.title);
  const rightTokens = tokens(right.title);
  const common = leftTokens.filter((word) => rightTokens.includes(word));
  // A broad topic or one named person is insufficient to join separate events.
  if (common.length < 4) return false;
  const leftNumbers = leftTokens.filter((word) => /^\d+$/.test(word));
  const rightNumbers = rightTokens.filter((word) => /^\d+$/.test(word));
  if (leftNumbers.length && rightNumbers.length && leftNumbers.join() !== rightNumbers.join()) return false;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return common.length / union >= 0.62 && common.length / Math.min(leftTokens.length, rightTokens.length) >= 0.75;
}

function deduplicate(signals: Signal[]): Signal[] {
  const byId = new Map<string, Signal>();
  for (const signal of signals) {
    const existing = byId.get(signal.id);
    if (!existing) { byId.set(signal.id, signal); continue; }
    const latest = existing.detectedAt >= signal.detectedAt ? existing : signal;
    const first = [existing.firstDetectedAt ?? existing.detectedAt, signal.firstDetectedAt ?? signal.detectedAt].sort()[0];
    byId.set(signal.id, { ...latest, firstDetectedAt: first, evidence: [...new Set([...existing.evidence, ...signal.evidence])].slice(0, 8) });
  }
  return [...byId.values()];
}

function publicationIdentity(signal: Signal): string | null {
  if (signal.sourceType === "search") return `platform:${signal.source}`;
  if (signal.publisher) return `publisher:${normalizeText(signal.publisher)}`;
  const url = canonicalUrl(signal.url);
  return url ? `domain:${new URL(url).hostname}` : null;
}

function independentPublications(signals: Signal[]): number {
  const counted: Signal[] = [];
  const publishers = new Set<string>();
  for (const signal of signals) {
    const identity = publicationIdentity(signal);
    if (!identity || publishers.has(identity)) continue;
    // The same linked article or verbatim syndicated headline never corroborates itself.
    if (counted.some((other) => (canonicalUrl(signal.url) && canonicalUrl(signal.url) === canonicalUrl(other.url)) || normalizeText(signal.title) === normalizeText(other.title))) continue;
    publishers.add(identity);
    counted.push(signal);
  }
  return publishers.size;
}

export function scoreBrandRelevance(signals: Signal[], brandId: BrandId): Trend["brandRelevance"] {
  const brand = getBrandContext(brandId);
  const text = ` ${normalizeText(signals.map((signal) => signal.title).join(" "))} `;
  const matched = brand.keywords.filter((keyword) => text.includes(` ${normalizeText(keyword)} `));
  const score = Math.min(100, matched.length * 30);
  return { score, label: score >= 60 ? "Alta" : score >= 30 ? "Média" : "Baixa", reason: matched.length ? `Afinidade editorial com ${brand.name}: os títulos mencionam ${matched.slice(0, 4).join(", ")}. É uma estimativa por correspondência de temas; valide a adequação antes de publicar.` : `Os títulos não trazem conexão explícita com ${brand.editorialFocus}. A afinidade estimada para ${brand.name} é baixa; não force a associação.` };
}

function sourceVolume(signal: Signal): { value: number; description: string } | null {
  const metrics = signal.rawMetrics;
  if (metrics.approximateSearchesLowerBound !== undefined) return { value: Math.min(100, Math.log10(1 + metrics.approximateSearchesLowerBound) / 6 * 100), description: `${metrics.approximateSearchesLowerBound.toLocaleString("pt-BR")} buscas como limite inferior aproximado informado pelo Google Trends` };
  if (metrics.views !== undefined) return { value: Math.min(100, Math.log10(1 + metrics.views) / 7 * 100), description: `${metrics.views.toLocaleString("pt-BR")} visualizações acumuladas no YouTube` };
  if (metrics.points !== undefined) return { value: Math.min(100, Math.log10(1 + metrics.points) / 3 * 100), description: `${metrics.points.toLocaleString("pt-BR")} pontos no Hacker News` };
  return null;
}

function calculateScore(signals: Signal[], brand: Trend["brandRelevance"], now: Date, publications: number): Trend["score"] {
  const publicationDates = signals.flatMap((signal) => signal.publishedAt ? [new Date(signal.publishedAt).getTime()] : []).filter(Number.isFinite);
  const latestPublication = publicationDates.length ? Math.max(...publicationDates) : null;
  const ageHours = latestPublication === null ? null : Math.max(0, (now.getTime() - latestPublication) / HOUR);
  const volumes = signals.map(sourceVolume).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  const largestVolume = volumes.sort((a, b) => b.value - a.value)[0];
  const components: ScoreComponent[] = [
    { key: "velocity", label: "Velocidade", value: null, weight: 0.30, explanation: "Indisponível: as fontes não fornecem duas medições comparáveis da mesma métrica. Uma contagem acumulada não demonstra crescimento." },
    { key: "recency", label: "Recência", value: ageHours === null ? null : Math.round(Math.max(0, 100 * (1 - ageHours / 72))), weight: 0.20, explanation: ageHours === null ? "As publicações não têm data original validada; a data de coleta não substitui a data do fato." : `Publicação ou entrada no feed mais recente há ${Math.round(ageHours)} h. Escala linear: 100 no momento da publicação e 0 após 72 h. Links relacionados sem data não entram neste cálculo.` },
    { key: "volume", label: "Volume observado", value: largestVolume ? Math.round(largestVolume.value) : null, weight: 0.20, explanation: largestVolume ? `Maior indicador normalizado do grupo: ${largestVolume.description}. Escala logarítmica, com referências de 1 milhão de buscas, 10 milhões de visualizações ou 1.000 pontos. Métricas de fontes diferentes não são somadas; o indicador não representa alcance total.` : "Indisponível: as fontes deste grupo não informaram contagens de busca, visualizações ou pontos." },
    { key: "sourceDiversity", label: "Diversidade de fontes", value: Math.min(100, Math.max(0, publications - 1) * 100 / 3), weight: 0.15, explanation: `${publications} origens identificáveis após excluir URLs e manchetes repetidas. Uma origem = 0; quatro ou mais = 100. A diversidade indica cobertura e associação, sem comprovar independência editorial ou veracidade.` },
    { key: "brandRelevance", label: "Relevância para a marca", value: brand.score, weight: 0.15, explanation: `${brand.reason} Regra: 30 pontos por tema distinto encontrado, até 100.` },
  ];
  const availableWeight = components.reduce((total, component) => total + (component.value === null ? 0 : component.weight), 0);
  const normalized = components.map((component) => ({ ...component, weight: component.value === null ? 0 : component.weight / availableWeight }));
  const value = Math.round(normalized.reduce((total, component) => total + (component.value ?? 0) * component.weight, 0));
  return { value, components: normalized, explanation: `Índice editorial de prioridade, de 0 a 100. Os pesos de referência (velocidade 30%, recência 20%, volume 20%, diversidade 15%, marca 15%) são redistribuídos somente entre métricas disponíveis. Não é uma previsão de viralização nem uma medida de crescimento comprovado.` };
}

export function analyzeSignals(input: Signal[], brandId: BrandId, now = new Date()): Trend[] {
  const valid = input.flatMap((signal) => { const parsed = signalSchema.safeParse(signal); return parsed.success ? [parsed.data] : []; });
  const currentDatedIds = new Set(valid.filter((signal) => signal.publishedAt && new Date(signal.publishedAt).getTime() <= now.getTime() + 5 * 60_000 && now.getTime() - new Date(signal.publishedAt).getTime() <= 72 * HOUR).map((signal) => signal.id));
  const current = deduplicate(valid.filter((signal) => currentDatedIds.has(signal.id) || (!signal.publishedAt && signal.relatedSignalId && currentDatedIds.has(signal.relatedSignalId))));
  const collectionOrder = (signal: Signal) => signal.sourceType === "search" ? 0 : signal.relatedSignalId ? 1 : 2;
  current.sort((a, b) => collectionOrder(a) - collectionOrder(b) || a.id.localeCompare(b.id));
  const groups: Signal[][] = [];
  for (const signal of current) {
    const explicit = signal.relatedSignalId ? groups.find((group) => group.some((member) => member.id === signal.relatedSignalId)) : undefined;
    const group = explicit ?? groups.find((candidate) => candidate.some((member) => (canonicalUrl(signal.url) && canonicalUrl(signal.url) === canonicalUrl(member.url)) || normalizeText(signal.title) === normalizeText(member.title)) || (candidate.some((member) => sameStory(member, signal)) && candidate.filter((member) => !member.relatedSignalId).every((member) => sameStory(member, signal))));
    if (group) group.push(signal);
    else groups.push([signal]);
  }
  return groups.map((group) => {
    const signals = group.slice(0, 60);
    const representative = signals.find((signal) => signal.sourceType === "search") ?? signals[0];
    const brandRelevance = scoreBrandRelevance(signals, brandId);
    const independentSourceCount = independentPublications(signals);
    const dates = signals.map((signal) => signal.firstDetectedAt ?? signal.detectedAt).sort();
    const lastDates = signals.map((signal) => signal.detectedAt).sort();
    const categories = [...new Set(signals.map((signal) => ({ search: "buscas", news: "notícias", community: "comunidade global", video: "vídeo" })[signal.sourceType]))];
    const summary = `${signals.length} evidência${signals.length === 1 ? "" : "s"} encontrada${signals.length === 1 ? "" : "s"} em ${categories.join(", ")}. ${signals.some((signal) => signal.geography === "global") ? "Inclui discussão global, cuja relevância para o Brasil precisa ser avaliada. " : ""}${signals.some((signal) => signal.relatedSignalId) ? "Links relacionados foram associados pela fonte; podem não informar a data original." : "Consulte as publicações para verificar o contexto completo."}`;
    return trendSchema.parse({ id: `trend-${createHash("sha256").update(normalizeText(representative.title)).digest("hex").slice(0, 22)}`, title: representative.title, summary, signals, firstDetectedAt: dates[0], lastDetectedAt: lastDates.at(-1), score: calculateScore(signals, brandRelevance, now, independentSourceCount), growthExplanation: "Os sinais mostram atenção ou cobertura observada nesta coleta. Sem uma série temporal comparável, não é possível confirmar crescimento, velocidade ou sua causa.", brandRelevance, independentSourceCount });
  }).sort((a, b) => b.score.value - a.score.value || b.lastDetectedAt.localeCompare(a.lastDetectedAt) || a.id.localeCompare(b.id));
}
