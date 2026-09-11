import "server-only";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { normalizeHumanshipRows } from "@/lib/humanship/importRows";

export type GoogleSheetReadResult = {
  spreadsheetId: string;
  spreadsheetTitle: string;
  sheetName: string;
  rows: ReturnType<typeof normalizeHumanshipRows>;
};

export async function readHumanshipGoogleSheet(request: NextRequest, sheetUrlOrId: string): Promise<GoogleSheetReadResult> {
  const spreadsheetId = extractSpreadsheetId(sheetUrlOrId);
  if (!spreadsheetId) throw new Error("Cole um link válido do Google Sheets.");
  const accessToken = await resolveGoogleAccessToken(request);

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

async function resolveGoogleAccessToken(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) throw new Error("Sua sessão Google expirou. Entre novamente para sincronizar a planilha.");
  const accessToken = typeof token.googleAccessToken === "string" ? token.googleAccessToken : null;
  const refreshToken = typeof token.googleRefreshToken === "string" ? token.googleRefreshToken : null;
  const expiresAt = typeof token.googleExpiresAt === "number" ? token.googleExpiresAt * 1000 : 0;

  if (accessToken && (!expiresAt || expiresAt > Date.now() + 60_000)) return accessToken;
  if (!refreshToken) throw new Error("Reconecte sua conta Google para autorizar a leitura do Google Sheets. O upload em Excel continua disponível.");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Não foi possível renovar o acesso ao Google Sheets. Saia e entre novamente com Google.");
  const payload = await response.json() as { access_token?: string };
  if (!payload.access_token) throw new Error("O Google não devolveu uma autorização válida para o Sheets.");
  return payload.access_token;
}

async function googleError(response: Response, fallback: string) {
  try {
    const payload = await response.json() as { error?: { message?: string } };
    const message = payload.error?.message || "";
    if (/insufficient.*scope|permission/i.test(message)) return "Sua conta ainda não autorizou a leitura do Google Sheets. Saia e entre novamente com Google para conceder acesso somente leitura.";
    if (/not found|requested entity/i.test(message)) return "Essa planilha não foi encontrada ou não está disponível para a conta Google conectada.";
  } catch {
    // fall through
  }
  return fallback;
}
