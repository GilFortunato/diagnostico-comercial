export const MAX_HUNTING_RESULTS = 50;
export const HUNTING_PAGE_SIZE = 50;

export type HuntingPage = { startPage: number; takePages: number; maxItems: number; timeoutMs: number };
export type CollectionSummary = {
  requested: number; unique: number; requests: number; duplicates: number;
  stopReason: "target_reached" | "source_exhausted" | "no_progress" | "request_limit" | "time_limit" | "provider_error";
  nextPage: number;
};

/** Keep the last complete batch: callers rank before selecting the requested N. */
export async function collectHuntingPages<T>(options: {
  target: number;
  key: (item: T) => string;
  fetchPage: (page: HuntingPage) => Promise<{ items: T[]; exhausted: boolean }>;
  initialItems?: T[];
  excludedKeys?: Set<string>;
  startPage?: number;
  maxRequests?: number;
  timeoutMs?: number;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  const deadline = now() + (options.timeoutMs ?? 150_000);
  const items = new Map((options.initialItems ?? []).filter((item) => !options.excludedKeys?.has(options.key(item))).map((item) => [options.key(item), item]));
  const seen = new Set<string>();
  let stagnant = 0;
  const summary: CollectionSummary = { requested: options.target, unique: items.size, requests: 0, duplicates: 0, stopReason: "request_limit", nextPage: options.startPage ?? 1 };
  while (items.size < options.target && summary.requests < (options.maxRequests ?? 12) && summary.nextPage <= 99) {
    const remaining = deadline - now();
    if (remaining < 1_000) { summary.stopReason = "time_limit"; break; }
    let page: Awaited<ReturnType<typeof options.fetchPage>>;
    try {
      summary.requests += 1;
      page = await options.fetchPage({ startPage: summary.nextPage, takePages: 2, maxItems: HUNTING_PAGE_SIZE, timeoutMs: remaining });
    } catch (error) {
      if (!items.size && !options.excludedKeys?.size) throw error;
      summary.stopReason = "provider_error";
      break;
    }
    summary.nextPage += 2;
    let newSourceItems = 0;
    for (const item of page.items) {
      const key = options.key(item);
      if (!seen.has(key)) newSourceItems += 1;
      seen.add(key);
      if (items.has(key) || options.excludedKeys?.has(key)) summary.duplicates += 1;
      else items.set(key, item);
    }
    if (page.exhausted) { summary.stopReason = "source_exhausted"; break; }
    stagnant = newSourceItems ? 0 : stagnant + 1;
    if (stagnant >= 2) { summary.stopReason = "no_progress"; break; }
  }
  summary.unique = items.size;
  if (items.size >= options.target) summary.stopReason = "target_reached";
  return { items: [...items.values()], summary };
}

export function collectionMessage(summary: CollectionSummary) {
  const reasons: Record<CollectionSummary["stopReason"], string> = {
    target_reached: "Meta alcançada.", source_exhausted: "A fonte não retornou mais perfis para este recorte.",
    no_progress: "As últimas páginas não trouxeram perfis novos.", request_limit: "Limite de páginas desta busca atingido.",
    time_limit: "Tempo de coleta atingido; os perfis encontrados foram preservados.",
    provider_error: "A fonte falhou durante a coleta; os perfis encontrados foram preservados.",
  };
  return `${Math.min(summary.unique, summary.requested)} de ${summary.requested} perfis únicos. ${reasons[summary.stopReason]}`;
}
