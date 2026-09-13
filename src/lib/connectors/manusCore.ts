export const MANUS_NATIVE_APIFY_CONNECTOR_ID = "cf19c9d0-5f91-4e7a-af04-593febb5c80c";

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

  const native = connectors.find((connector) => connector.id === MANUS_NATIVE_APIFY_CONNECTOR_ID);
  if (native) return native.id;

  const match = connectors.find((connector) => {
    const searchable = connectorSearchText(connector);
    return searchable.includes("apify") || searchable.includes("mcp.apify.com");
  });
  return match?.id ?? null;
}

/**
 * Selects the professional-research connectors already authorized in Manus.
 * The order is intentional: Apify remains the primary discovery source while
 * Apollo, ZoomInfo and Firecrawl can broaden identity resolution when present.
 */
export function findResearchConnectorIds(
  connectors: ManusConnector[],
  preferred = ["apify", "apollo", "zoominfo", "firecrawl"],
) {
  const selected: ManusConnector[] = [];
  const seen = new Set<string>();

  for (const keyword of preferred) {
    const normalizedKeyword = keyword.toLocaleLowerCase("en-US");
    for (const connector of connectors) {
      if (seen.has(connector.id)) continue;
      const searchable = connectorSearchText(connector);
      const matches = normalizedKeyword === "apify"
        ? connector.id === MANUS_NATIVE_APIFY_CONNECTOR_ID || searchable.includes("apify") || searchable.includes("mcp.apify.com")
        : searchable.includes(normalizedKeyword);
      if (!matches) continue;
      selected.push(connector);
      seen.add(connector.id);
      break;
    }
  }

  return selected;
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

function connectorSearchText(connector: ManusConnector) {
  return `${connector.name} ${connector.description ?? ""} ${connector.category ?? ""} ${connector.type ?? ""}`.toLocaleLowerCase("en-US");
}
