export function formatScoutDate(value: string | null | undefined) {
  if (!value || Number.isNaN(Date.parse(value))) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function safeScoutUrl(value: string | null | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export async function scoutRequest<T>(url: string, signal: AbortSignal, body?: object): Promise<T> {
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) throw new Error("Sua sessão expirou. Entre novamente para continuar.");
    if (response.status === 403) throw new Error("Seu acesso ao MKT Scout não está disponível nesta conta.");
    throw new Error(payload?.error || "Não foi possível concluir a consulta agora. Tente novamente.");
  }
  return payload as T;
}
