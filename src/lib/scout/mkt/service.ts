import "server-only";
import { z } from "zod";
import { createHash } from "node:crypto";
import { analyzeSignals } from "./signals";
import { collectSource, filterSourceSignals, SOURCE_REGISTRY } from "./sources";
import { signalSchema, sourceStatusSchema, trendSchema, type BrandId, type SourceId, type SourceStatus, type Trend } from "./types";
import { createEditorialAnalysis, evidenceFingerprint } from "./editorial";
import { scoutAnalysisSchema } from "./analysisTypes";
import { getScoutStore, isFresh, type ScoutStore } from "./store";

export type RadarResult = {
  trends: Trend[]; sources: SourceStatus[]; collectedAt: string;
  cache: { status: "fresh" | "cached" | "stale"; persistent: boolean; message?: string };
  visualSearchAvailable: boolean;
};
const bundleSchema = z.object({ signals: z.array(signalSchema), status: sourceStatusSchema });
export class ScoutError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function visualSearchAvailable() {
  return [process.env.UNSPLASH_ACCESS_KEY, process.env.PEXELS_API_KEY, process.env.PIXABAY_API_KEY].some((key) => key?.trim());
}
export const queryKey = (query = "") => createHash("sha256").update(query.trim().toLocaleLowerCase("pt-BR")).digest("hex");
type Collector = typeof collectSource;
export function createScoutService(store: ScoutStore, collector: Collector = collectSource, now = () => new Date()) {
  const inFlight = new Map<string, Promise<RadarResult>>();
  async function radar(brandId: BrandId, query = ""): Promise<RadarResult> {
    const flightKey = brandId + ":" + queryKey(query);
    const running = inFlight.get(flightKey);
    if (running) return running;
    const work = loadRadar(brandId, query);
    inFlight.set(flightKey, work);
    try { return await work; } finally { inFlight.delete(flightKey); }
  }
  async function loadRadar(brandId: BrandId, query: string): Promise<RadarResult> {
    const date = now();
    const batches = await Promise.all(SOURCE_REGISTRY.map(async (source) => {
      const key = source.id + ":" + queryKey(query);
      const stored = await store.get("source", key);
      const parsed = bundleSchema.safeParse(stored?.record.payload);
      const prior = parsed.success ? parsed.data : null;
      if (prior && isFresh(stored, date.getTime())) {
        const signals = filterSourceSignals(prior.signals, source.id, { now: date, query });
        return { signals, status: { ...prior.status, count: signals.length, status: signals.length ? prior.status.status : prior.status.status === "unavailable" ? "unavailable" as const : "empty" as const }, persistent: stored!.persistent, cached: true };
      }
      let result: z.infer<typeof bundleSchema>;
      try { result = bundleSchema.parse(await collector(source.id as SourceId, { query, now: date })); }
      catch {
        result = { signals: [], status: { id: source.id, name: source.name, status: "unavailable", count: 0, collectedAt: date.toISOString(), message: "Não foi possível consultar esta fonte agora." } };
      }
      if (result.status.status === "unavailable" && prior) {
        const stillRecent = filterSourceSignals(prior.signals, source.id, { now: date, query });
        if (stillRecent.length) result = {
          signals: stillRecent,
          status: { ...prior.status, status: "stale", count: stillRecent.length, message: "Atualização indisponível. Exibindo a última coleta confirmada, com data original." },
        };
      }
      const previousById = new Map(prior?.signals.map((signal) => [signal.id, signal]));
      result.signals = result.signals.map((signal) => ({ ...signal, firstDetectedAt: previousById.get(signal.id)?.firstDetectedAt ?? previousById.get(signal.id)?.detectedAt ?? signal.detectedAt }));
      const saved = await store.put("source", key, result, { ttlMs: ["unavailable", "stale"].includes(result.status.status) ? 120_000 : source.ttlMs });
      return { ...result, persistent: saved.persistent, cached: false };
    }));
    const signals = batches.flatMap((batch) => batch.signals).filter((signal) => date.getTime() - Date.parse(signal.publishedAt ?? signal.detectedAt) <= 72 * 3_600_000);
    const trends = analyzeSignals(signals, brandId, date).slice(0, 24);
    const saved = await Promise.all(trends.map(async (trend) => {
      const key = brandId + ":" + trend.id;
      const prior = await store.get("trend", key);
      const parsed = trendSchema.safeParse(prior?.record.payload);
      if (parsed.success) trend.firstDetectedAt = parsed.data.firstDetectedAt < trend.firstDetectedAt ? parsed.data.firstDetectedAt : trend.firstDetectedAt;
      return store.put("trend", key, trend, { ttlMs: 7 * 86_400_000 });
    }));
    const persistent = batches.every((batch) => batch.persistent) && saved.every((item) => item.persistent);
    return {
      trends, sources: batches.map((batch) => batch.status),
      collectedAt: batches.filter((batch) => batch.signals.length > 0).map((batch) => batch.status.collectedAt).sort().at(-1) ?? date.toISOString(),
      cache: {
        status: batches.some((batch) => batch.status.status === "stale") ? "stale" : batches.every((batch) => batch.cached) ? "cached" : "fresh",
        persistent,
        ...(!persistent ? { message: "Histórico temporariamente indisponível. Os sinais continuam acessíveis nesta sessão." } : {}),
      },
      visualSearchAvailable: visualSearchAvailable(),
    };
  }
  async function trend(trendId: string, brandId: BrandId) {
    const stored = await store.get("trend", brandId + ":" + trendId);
    const parsed = trendSchema.safeParse(stored?.record.payload);
    if (!parsed.success) throw new ScoutError("Este sinal não está mais no radar. Atualize a coleta e selecione novamente.", 404);
    const recent = parsed.data.signals.filter((signal) => now().getTime() - Date.parse(signal.publishedAt ?? signal.detectedAt) <= 72 * 3_600_000);
    if (!recent.length) throw new ScoutError("Os sinais desta tendência saíram da janela atual. Atualize o radar.", 410);
    // Recompute with only recent evidence; a saved snapshot never makes an old fact current.
    const result = analyzeSignals(recent, brandId, now())[0];
    if (!result) throw new ScoutError("Evidências insuficientes. Atualize o radar.", 410);
    return { ...result, id: parsed.data.id, firstDetectedAt: parsed.data.firstDetectedAt };
  }
  async function analysis(trendId: string, brandId: BrandId) {
    const current = await trend(trendId, brandId);
    const key = evidenceFingerprint(current, brandId);
    const stored = await store.get("analysis", key);
    const parsed = scoutAnalysisSchema.safeParse(stored?.record.payload);
    if (parsed.success && isFresh(stored, now().getTime())) return { trend: current, analysis: parsed.data, persistent: stored!.persistent };
    const result = createEditorialAnalysis(current, brandId, now());
    const saved = await store.put("analysis", key, result, { ttlMs: 6 * 3_600_000 });
    return { trend: current, analysis: result, persistent: saved.persistent };
  }
  return { radar, trend, analysis };
}
let service: ReturnType<typeof createScoutService> | undefined;
export const getScoutService = () => service ??= createScoutService(getScoutStore());
