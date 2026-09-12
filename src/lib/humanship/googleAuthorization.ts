import "server-only";
import type { Account } from "next-auth";
import { ConnectorKind, ConnectorStatus } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { decryptCredential, encryptCredential } from "@/lib/security/credentials";

export const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const CONNECTOR_KEY = "google-sheets";

type StoredGoogleAuthorization = {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  scopes: string[];
};

export async function saveHumanshipGoogleAuthorization(userId: string, account: Account) {
  const scopes = normalizeScopes(account.scope);
  if (!scopes.includes(GOOGLE_SHEETS_SCOPE)) return false;

  const prisma = getPrisma();
  const connector = await ensureGoogleSheetsConnector();
  const existing = await prisma.userConnectorCredential.findFirst({
    where: { userId, connectorId: connector.id },
    orderBy: { updatedAt: "desc" },
  });

  let previous: StoredGoogleAuthorization | null = null;
  if (existing?.encrypted) {
    try {
      previous = JSON.parse(decryptCredential(existing.encrypted)) as StoredGoogleAuthorization;
    } catch {
      previous = null;
    }
  }

  const payload: StoredGoogleAuthorization = {
    accessToken: account.access_token || previous?.accessToken || null,
    refreshToken: account.refresh_token || previous?.refreshToken || null,
    expiresAt: account.expires_at ? account.expires_at * 1000 : previous?.expiresAt || null,
    scopes,
  };
  const encrypted = encryptCredential(JSON.stringify(payload));

  if (existing) {
    await prisma.userConnectorCredential.update({
      where: { id: existing.id },
      data: {
        encrypted,
        scopes,
        status: ConnectorStatus.CONNECTED,
        revokedAt: null,
        label: "Google Sheets · somente leitura",
      },
    });
  } else {
    await prisma.userConnectorCredential.create({
      data: {
        userId,
        connectorId: connector.id,
        label: "Google Sheets · somente leitura",
        encrypted,
        scopes,
        status: ConnectorStatus.CONNECTED,
      },
    });
  }

  return true;
}

export async function getHumanshipGoogleConnectionStatus(userId: string) {
  const row = await findGoogleSheetsCredential(userId);
  return {
    connected: Boolean(row && row.status === ConnectorStatus.CONNECTED && row.scopes.includes(GOOGLE_SHEETS_SCOPE)),
    connectedAt: row?.createdAt?.toISOString() || null,
    updatedAt: row?.updatedAt?.toISOString() || null,
  };
}

export async function getHumanshipGoogleAccessToken(userId: string) {
  const row = await findGoogleSheetsCredential(userId);
  if (!row || row.status !== ConnectorStatus.CONNECTED || !row.scopes.includes(GOOGLE_SHEETS_SCOPE)) {
    throw new Error("Conecte o Google Sheets no Humanship antes de sincronizar. O upload em Excel continua disponível sem essa autorização.");
  }

  let stored: StoredGoogleAuthorization;
  try {
    stored = JSON.parse(decryptCredential(row.encrypted)) as StoredGoogleAuthorization;
  } catch {
    throw new Error("A autorização do Google Sheets precisa ser reconectada.");
  }

  if (stored.accessToken && (!stored.expiresAt || stored.expiresAt > Date.now() + 60_000)) {
    return stored.accessToken;
  }
  if (!stored.refreshToken) {
    throw new Error("Reconecte o Google Sheets para renovar a autorização de leitura.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: stored.refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Não foi possível renovar o acesso ao Google Sheets. Reconecte a conta no Humanship.");
  }

  const refreshed = await response.json() as { access_token?: string; expires_in?: number; scope?: string };
  if (!refreshed.access_token) throw new Error("O Google não devolveu uma autorização válida para o Sheets.");

  const next: StoredGoogleAuthorization = {
    accessToken: refreshed.access_token,
    refreshToken: stored.refreshToken,
    expiresAt: Date.now() + Math.max(60, refreshed.expires_in || 3600) * 1000,
    scopes: normalizeScopes(refreshed.scope || stored.scopes.join(" ")),
  };
  await getPrisma().userConnectorCredential.update({
    where: { id: row.id },
    data: {
      encrypted: encryptCredential(JSON.stringify(next)),
      scopes: next.scopes,
      status: ConnectorStatus.CONNECTED,
      revokedAt: null,
    },
  });
  return refreshed.access_token;
}

async function findGoogleSheetsCredential(userId: string) {
  const connector = await ensureGoogleSheetsConnector();
  return getPrisma().userConnectorCredential.findFirst({
    where: { userId, connectorId: connector.id },
    orderBy: { updatedAt: "desc" },
  });
}

async function ensureGoogleSheetsConnector() {
  const prisma = getPrisma();
  let organization = await prisma.organization.findUnique({ where: { slug: "share" } });
  if (!organization) organization = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!organization) {
    organization = await prisma.organization.create({ data: { name: "Share", slug: "share" } });
  }

  return prisma.connector.upsert({
    where: { organizationId_key: { organizationId: organization.id, key: CONNECTOR_KEY } },
    create: {
      organizationId: organization.id,
      key: CONNECTOR_KEY,
      name: "Google Sheets",
      kind: ConnectorKind.DATA_SOURCE,
      capabilities: ["sheets.readonly"],
      status: ConnectorStatus.CONNECTED,
    },
    update: {
      name: "Google Sheets",
      kind: ConnectorKind.DATA_SOURCE,
      capabilities: ["sheets.readonly"],
    },
  });
}

function normalizeScopes(value: string | string[] | null | undefined) {
  const raw = Array.isArray(value) ? value : (value || "").split(/\s+/);
  return [...new Set(raw.map((item) => item.trim()).filter(Boolean))];
}
