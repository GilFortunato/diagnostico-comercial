import "server-only";

import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";

export type AppAuditSeverity = "info" | "attention" | "error" | "security";

type Actor = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
};

type AuditInput = {
  actor?: Actor | null;
  moduleKey: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  severity?: AppAuditSeverity;
  retentionDays?: 7 | 30;
  metadata?: Record<string, unknown>;
};

const BLOCKED_KEYS = /(token|secret|password|cookie|authorization|credential|access.?key|api.?key|refresh.?token)/i;

export async function writeAppAuditLog(input: AuditInput) {
  const severity = input.severity ?? "info";
  const retentionDays = input.retentionDays ?? (severity === "info" ? 7 : 30);

  try {
    await getPrisma().appAuditLog.create({
      data: {
        actorUserId: input.actor?.id || null,
        actorName: input.actor?.name || null,
        actorEmail: input.actor?.email || null,
        moduleKey: input.moduleKey.slice(0, 120),
        action: input.action.slice(0, 160),
        entityType: input.entityType?.slice(0, 120) || null,
        entityId: input.entityId?.slice(0, 180) || null,
        severity,
        retentionDays,
        metadata: sanitizeMetadata(input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    await pruneExpiredAppAuditLogs().catch(() => undefined);
  } catch (error) {
    console.error("[audit-log] failed to persist", {
      moduleKey: input.moduleKey,
      action: input.action,
      error: error instanceof Error ? error.message.slice(0, 180) : "unknown",
    });
  }
}

export async function pruneExpiredAppAuditLogs() {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 86_400_000);
  const thirtyDaysAgo = new Date(now - 30 * 86_400_000);

  await getPrisma().appAuditLog.deleteMany({
    where: {
      OR: [
        { retentionDays: { lte: 7 }, createdAt: { lt: sevenDaysAgo } },
        { retentionDays: { gt: 7 }, createdAt: { lt: thirtyDaysAgo } },
      ],
    },
  });
}

export async function listAppAuditLogs(input: {
  days?: 7 | 30;
  moduleKey?: string;
  severity?: string;
  actor?: string;
  take?: number;
}) {
  await pruneExpiredAppAuditLogs().catch(() => undefined);

  const days = input.days ?? 7;
  const since = new Date(Date.now() - days * 86_400_000);
  const actor = input.actor?.trim();

  return getPrisma().appAuditLog.findMany({
    where: {
      createdAt: { gte: since },
      ...(input.moduleKey && input.moduleKey !== "all" ? { moduleKey: input.moduleKey } : {}),
      ...(input.severity && input.severity !== "all" ? { severity: input.severity } : {}),
      ...(actor
        ? {
            OR: [
              { actorName: { contains: actor, mode: "insensitive" } },
              { actorEmail: { contains: actor, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(500, Math.max(20, input.take ?? 200)),
  });
}

function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[truncated]";
  if (value === null || value === undefined) return null;

  if (typeof value === "string") return value.length > 300 ? `${value.slice(0, 300)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeMetadata(item, depth + 1));

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const clean: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(record).slice(0, 30)) {
      clean[key] = BLOCKED_KEYS.test(key) ? "[redacted]" : sanitizeMetadata(item, depth + 1);
    }
    return clean;
  }

  return String(value).slice(0, 300);
}
