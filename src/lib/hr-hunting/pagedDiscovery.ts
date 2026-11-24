import { collectHuntingPages, type CollectionSummary, type HuntingPage } from "@/lib/hunting/pagination";
import type { HrCandidate } from "@/lib/hr-hunting/types";

export type HrDiscoveryRound = { input: Record<string, unknown>; nextPage: number; exhausted: boolean; runId?: string };
export type HrDiscoveryState = { version: 1; fingerprint: string; rounds: HrDiscoveryRound[]; pending: HrCandidate[]; fallbackComplete?: boolean; fallbackTitles?: string[]; indexedQueries?: string[]; searchFilters?: { quantity: number; currentTitle?: string; seniority: string[]; location?: string; keywords: string[]; alternateTitles?: string[] } };

export function candidateKey(candidate: HrCandidate) {
  if (candidate.profileUrl) return candidate.profileUrl.split("?")[0].replace(/\/$/, "").toLowerCase();
  return [candidate.name, candidate.currentCompany, candidate.currentTitle].map((value) => (value || "").trim().toLocaleLowerCase("pt-BR")).join("|");
}

/** A saved cursor belongs to one exact set of filters and keeps the unused batch. */
export function readDiscoveryState(value: unknown, fingerprint: string): HrDiscoveryState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const state = value as Partial<HrDiscoveryState>;
  if (state.version !== 1 || state.fingerprint !== fingerprint || !Array.isArray(state.rounds) || !Array.isArray(state.pending)) return null;
  if (!state.rounds.every((round) => round.input && Number.isInteger(round.nextPage) && round.nextPage >= 1 && typeof round.exhausted === "boolean" && (round.runId === undefined || (typeof round.runId === "string" && /^[A-Za-z0-9]{8,32}$/.test(round.runId))))) return null;
  return state as HrDiscoveryState;
}

export async function collectHrDiscovery(options: {
  state: HrDiscoveryState;
  target: number;
  excludedKeys?: Set<string>;
  fetchPage: (input: Record<string, unknown>, page: HuntingPage, round: HrDiscoveryRound) => Promise<unknown[] | { items: unknown[]; pending: boolean; partial: boolean }>;
  normalize: (items: unknown[]) => HrCandidate[];
  accept?: (candidate: HrCandidate) => boolean;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  const deadline = now() + 100_000;
  const state: HrDiscoveryState = { ...options.state, rounds: options.state.rounds.map((round) => ({ ...round })) };
  let items = state.pending.filter((candidate) => !options.excludedKeys?.has(candidateKey(candidate)) && (!options.accept || options.accept(candidate)));
  const summaries: CollectionSummary[] = [];
  let requests = 0;
  for (const round of state.rounds) {
    if (items.length >= options.target || requests >= 12 || now() >= deadline) break;
    if (round.exhausted) continue;
    try {
      const result = await collectHuntingPages({
        target: options.target, initialItems: items, excludedKeys: options.excludedKeys,
        key: candidateKey, startPage: round.nextPage, maxRequests: 12 - requests,
        timeoutMs: deadline - now(), now,
        fetchPage: async (page) => {
          const fetched = await options.fetchPage(round.input, page, round);
          const raw = Array.isArray(fetched) ? fetched : fetched.items;
          const candidates = options.normalize(raw);
          if (raw.length && !candidates.length) throw new Error("Formato de perfis não reconhecido.");
          return { items: options.accept ? candidates.filter(options.accept) : candidates, exhausted: raw.length === 0, pending: !Array.isArray(fetched) && fetched.pending, partial: !Array.isArray(fetched) && fetched.partial };
        },
      });
      items = result.items;
      round.nextPage = result.summary.nextPage;
      round.exhausted = ["source_exhausted", "no_progress"].includes(result.summary.stopReason) || round.nextPage > 99;
      requests += result.summary.requests;
      summaries.push(result.summary);
      if (round.runId) break;
    } catch {
      requests += 1;
      summaries.push({ requested: options.target, unique: items.length, requests: 1, duplicates: 0, stopReason: "provider_error", nextPage: round.nextPage });
    }
  }
  const summary: CollectionSummary = {
    requested: options.target, unique: items.length, requests,
    duplicates: summaries.reduce((sum, item) => sum + item.duplicates, 0),
    nextPage: state.rounds.find((round) => !round.exhausted)?.nextPage ?? 1,
    stopReason: items.length >= options.target ? "target_reached"
      : summaries.some((item) => item.stopReason === "provider_error") ? "provider_error"
      : now() >= deadline || state.rounds.some((round) => round.runId) ? "time_limit"
      : state.rounds.every((round) => round.exhausted) ? "source_exhausted" : "request_limit",
  };
  return { items, state, summary };
}
