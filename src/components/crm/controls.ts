export const crmButton = "inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--share-green-950)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[var(--share-green-800)] disabled:opacity-50";
export const crmControl = "w-full rounded-lg border border-[var(--share-line)] bg-white px-3 py-2 text-sm text-[var(--share-green-950)] outline-offset-2";

export class CrmRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function requestCrm<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...options });
  const body = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok || !body) throw new CrmRequestError(body?.error || "Não foi possível consultar o CRM.", response.status);
  return body;
}

export function dateLabel(value: string | null) {
  return value ? value.split("-").reverse().join("/") : "—";
}
