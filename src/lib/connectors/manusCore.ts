export type ManusConnector = {
  id: string;
  name: string;
  type?: string;
  description?: string;
  category?: string;
};

export type ManusRunStatus =
  | "success_with_results"
  | "success_empty"
  | "partial"
  | "provider_error"
  | "quota_exceeded"
  | "timeout"
  | "unavailable";

export function findApifyConnectorId(connectors: ManusConnector[], override?: string | null) {
  const explicit = override?.trim();
  if (explicit) return explicit;
  const match = connectors.find((connector) => {
    const searchable = `${connector.name} ${connector.description ?? ""} ${connector.category ?? ""}`.toLocaleLowerCase("pt-BR");
    return searchable.includes("apify") || searchable.includes("mcp.apify.com");
  });
  return match?.id ?? null;
}

export function classifyManusHttpStatus(status: number): Exclude<ManusRunStatus, "success_with_results" | "success_empty" | "partial" | "timeout" | "unavailable"> {
  return status === 402 || status === 429 ? "quota_exceeded" : "provider_error";
}

export function isRealLinkedInPersonUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return /(^|\.)linkedin\.com$/i.test(url.hostname) && /^\/in\//i.test(url.pathname);
  } catch {
    return false;
  }
}

export function isRealLinkedInCompanyUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return /(^|\.)linkedin\.com$/i.test(url.hostname) && /^\/company\//i.test(url.pathname);
  } catch {
    return false;
  }
}
