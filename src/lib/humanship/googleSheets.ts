import "server-only";
import { getHumanshipGoogleAccessToken } from "@/lib/humanship/googleAuthorization";
import { normalizeHumanshipRows } from "@/lib/humanship/importRows";

export type GoogleSheetReadResult = {
  spreadsheetId: string;
  spreadsheetTitle: string;
  sheetName: string;
  rows: ReturnType<typeof normalizeHumanshipRows>;
};

export async function readHumanshipGoogleSheet(ownerId: string, sheetUrlOrId: string): Promise<GoogleSheetReadResult> {
  const spreadsheetId = extractSpreadsheetId(sheetUrlOrId);
  if (!spreadsheetId) throw new Error("Cole um link válido do Google Sheets.");
  const accessToken = await getHumanshipGoogleAccessToken(ownerId);

  const metadataResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=properties.title,sheets.properties`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!metadataResponse.ok) throw new Error(await googleError(metadataResponse, "Não foi possível acessar essa planilha no Google Sheets."));
  const metadata = await metadataResponse.json() as {
    properties?: { title?: string };
    sheets?: Array<{ properties?: { title?: string; index?: number; hidden?: boolean } }>;
  };
  const sheet = [...(metadata.sheets || [])]
    .filter((item) => item.properties?.title && !item.properties.hidden)
    .sort((a, b) => (a.properties?.index || 0) - (b.properties?.index || 0))[0];
  const sheetName = sheet?.properties?.title;
  if (!sheetName) throw new Error("A planilha não possui uma aba visível para leitura.");

  const range = `'${sheetName.replace(/'/g, "''")}'!A:ZZ`;
  const valuesResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?majorDimension=ROWS`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!valuesResponse.ok) throw new Error(await googleError(valuesResponse, "Não foi possível ler os dados da planilha."));
  const values = await valuesResponse.json() as { values?: unknown[][] };

  return {
    spreadsheetId,
    spreadsheetTitle: metadata.properties?.title || "Google Sheets",
    sheetName,
    rows: normalizeHumanshipRows(values.values || []),
  };
}

export function extractSpreadsheetId(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match?.[1]) return match[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(trimmed) ? trimmed : null;
}

async function googleError(response: Response, fallback: string) {
  try {
    const payload = await response.json() as { error?: { message?: string } };
    const message = payload.error?.message || "";
    if (/insufficient.*scope|permission/i.test(message)) return "A conexão do Google Sheets não tem permissão de leitura suficiente. Reconecte a conta no Humanship.";
    if (/not found|requested entity/i.test(message)) return "Essa planilha não foi encontrada ou não está disponível para a conta Google conectada.";
  } catch {
    // fall through
  }
  return fallback;
}
