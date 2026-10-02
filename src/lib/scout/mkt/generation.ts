import "server-only";
import { randomUUID } from "node:crypto";
import { getBrandContext } from "./brands";
import { editorialCopy, evidenceFingerprint } from "./editorial";
import { scoutGenerationSchema, type ScoutGeneration, type ScoutAnalysis } from "./analysisTypes";
import type { BrandId, Trend } from "./types";
import { getScoutStore, isFresh, type ScoutStore } from "./store";
import { getScoutService, ScoutError } from "./service";
import { resolveScoutModel, runCopyAgent } from "./copyAgent";

type GeneratorDeps = {
  store: ScoutStore;
  analysis: (id: string, brand: BrandId) => Promise<{ trend: Trend; analysis: ScoutAnalysis; persistent: boolean }>;
  resolveModel?: typeof resolveScoutModel;
  runAgent?: typeof runCopyAgent;
};
export function createContentGenerator(deps: GeneratorDeps) {
  const inFlight = new Map<string, Promise<ScoutGeneration>>();
  const attempts = new Map<string, number[]>();
  async function get(id: string, userId: string) {
    const stored = await deps.store.get("generation", id, userId);
    const payload = stored?.record.payload as { result?: unknown } | undefined;
    const parsed = scoutGenerationSchema.safeParse(payload?.result);
    if (!parsed.success) throw new ScoutError("Conteúdo não encontrado para esta conta.", 404);
    return { ...parsed.data, persistent: stored!.persistent, cached: true };
  }
  async function generate(input: { trendId: string; brandId: BrandId; opportunityId: string; userId: string }) {
    const { trend, analysis } = await deps.analysis(input.trendId, input.brandId);
    const selectedOpportunity = analysis.opportunities.find((item) => item.id === input.opportunityId);
    if (!selectedOpportunity) throw new ScoutError("Escolha uma oportunidade disponível nesta análise.");
    const opportunity = selectedOpportunity;
    // The selected model is part of the cache identity; a configuration change never reuses an incompatible run.
    const configuredModel = process.env.SCOUT_GEMINI_MODEL || process.env.GEMINI_MODEL || "gemini-3.8-flash";
    const cacheKey = evidenceFingerprint(trend, input.brandId) + ":" + opportunity.id + ":" + configuredModel;
    const key = input.userId + ":" + cacheKey;
    const running = inFlight.get(key);
    if (running) return running;
    const work = create();
    inFlight.set(key, work);
    try { return await work; } finally { inFlight.delete(key); }

    async function create(): Promise<ScoutGeneration> {
      const cache = await deps.store.get("copy-cache", cacheKey, input.userId);
      if (isFresh(cache)) {
        const cachedId = (cache?.record.payload as { id?: string } | undefined)?.id;
        if (cachedId) {
          try { return await get(cachedId, input.userId); } catch { /* Recover from a lost cached record. */ }
        }
      }
      const recent = (attempts.get(input.userId) ?? []).filter((time) => time > Date.now() - 60_000);
      if (recent.length >= 6) throw new ScoutError("Você já gerou vários rascunhos. Aguarde um minuto e tente novamente.", 429);
      attempts.set(input.userId, [...recent, Date.now()]);
      if (attempts.size > 1000) attempts.delete(attempts.keys().next().value!);
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      const context = { trend, analysis, brand: getBrandContext(input.brandId), opportunity };
      const pending = await deps.store.put("generation", id, { status: "pending", createdAt, context }, { ownerId: input.userId });
      let copy = editorialCopy(trend, input.brandId, opportunity);
      let mode: ScoutGeneration["mode"] = "editorial";
      let model: string | null = null;
      let usage: ScoutGeneration["usage"] = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
      let notice = "Rascunho editorial preparado com as evidências disponíveis. Revise a leitura da marca antes de usar.";
      // A paid call is allowed only after the pending run has been durably saved.
      if (pending.persistent) {
        try {
          const resolved = await (deps.resolveModel ?? resolveScoutModel)();
          if (resolved) {
            model = resolved.modelId;
            const generated = await (deps.runAgent ?? runCopyAgent)({ model: resolved.model, trend, brandId: input.brandId, analysis, opportunity });
            copy = generated.output;
            usage = generated.usage;
            mode = "ai";
            notice = "Rascunho gerado por IA. Confira as fontes e revise antes de usar.";
          }
        } catch {
          notice = "A redação por IA está indisponível agora. Preparamos um rascunho editorial com as evidências preservadas.";
          // Failed provider requests can incur cost without returning usage; never report zero as known.
          usage = { inputTokens: 0, outputTokens: 0, costUsd: null };
        }
      } else {
        notice = "Rascunho editorial disponível. O histórico está indisponível; copie o texto para guardá-lo.";
      }
      const result = scoutGenerationSchema.parse({
        ...copy, id, trendId: trend.id, brandId: input.brandId, opportunityId: opportunity.id,
        createdAt, mode, model, persistent: pending.persistent, cached: false, notice, usage,
        sourceUrls: [...new Set(trend.signals.filter((signal) => copy.evidenceIds.includes(signal.id)).flatMap((signal) => signal.url ? [signal.url] : []))],
      });
      const saved = await deps.store.put("generation", id, { status: "completed", result, context }, { ownerId: input.userId });
      result.persistent = saved.persistent;
      if (!saved.persistent) result.notice = "Rascunho pronto, mas o histórico está indisponível. Copie o texto para guardá-lo.";
      await deps.store.put("copy-cache", cacheKey, { id }, { ownerId: input.userId, ttlMs: mode === "ai" ? 24 * 3_600_000 : 10 * 60_000 });
      return result;
    }
  }
  return { generate, get };
}
let generator: ReturnType<typeof createContentGenerator> | undefined;
export const getContentGenerator = () => generator ??= createContentGenerator({ store: getScoutStore(), analysis: getScoutService().analysis });
