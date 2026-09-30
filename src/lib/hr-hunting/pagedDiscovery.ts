import { collectHuntingPages, type CollectionSummary, type HuntingPage } from "@/lib/hunting/pagination";
import type { HrCandidate } from "@/lib/hr-hunting/types";

export type HrDiscoveryRound = { input: Record<string, unknown>; nextPage: number; exhausted: boolean };
export type HrDiscoveryState = { version: 1; fingerprint: string; rounds: HrDiscoveryRound[]; pending: HrCandidate[]; fallbackComplete?: boolean };

export function candidateKey(candidate: HrCandidate) {
  if (candidate.profileUrl) return candidate.profileUrl.split("?")[0].replace(/\/$/, "").toLowerCase();
  return [candidate.name, candidate.currentCompany, candidate.currentTitle].map((value) => (value || "").trim().toLocaleLowerCase("pt-BR")).join("|");
}

/** A saved cursor belongs to one exact set of filters and keeps the unused batch. */
export function readDiscoveryState(value: unknown, fingerprint: string): HrDiscoveryState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const state = value as Partial<HrDiscoveryState>;
  if (state.version !== 1 || state.fingerprint !== fingerprint || !Array.isArray(state.rounds) || !Array.isArray(state.pending)) return null;
  if (!state.rounds.every((round) => round.input && Number.isInteger(round.nextPage) && round.nextPage >= 1 && typeof round.exhausted === "boolean")) return null;
  return state as HrDiscoveryState;
}

export async function collectHrDiscovery(options: {
  state: HrDiscoveryState;
  target: number;
  excludedKeys?: Set<string>;
  fetchPage: (input: Record<string, unknown>, page: HuntingPage) => Promise<unknown[]>;
  normalize: (items: unknown[]) => HrCandidate[];
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  const deadline = now() + 150_000;
  const state: HrDiscoveryState = { ...options.state, rounds: options.state.rounds.map((round) => ({ ...round })) };
  let items = state.pending.filter((candidate) => !options.excludedKeys?.has(candidateKey(candidate)));
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
          const raw = await options.fetchPage(round.input, page);
          const candidates = options.normalize(raw);
          if (raw.length && !candidates.length) throw new Error("Formato de perfis não reconhecido.");
          return { items: candidates, exhausted: raw.length === 0 };
        },
      });
      items = result.items;
      round.nextPage = result.summary.nextPage;
      round.exhausted = ["source_exhausted", "no_progress"].includes(result.summary.stopReason) || round.nextPage > 99;
      requests += result.summary.requests;
      summaries.push(result.summary);
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
      : now() >= deadline ? "time_limit"
      : state.rounds.every((round) => round.exhausted) ? "source_exhausted" : "request_limit",
  };
  return { items, state, summary };
}
