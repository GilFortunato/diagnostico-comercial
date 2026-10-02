import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { getPrisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

export type ScoutRecord = {
  id: string; kind: string; ownerId: string; cacheKey: string; payload: unknown;
  createdAt: string; updatedAt: string; expiresAt: string | null;
};
export type Stored = { record: ScoutRecord; persistent: boolean };
export interface ScoutStore {
  get(kind: string, key: string, ownerId?: string): Promise<Stored | null>;
  put(kind: string, key: string, payload: unknown, options?: { ownerId?: string; ttlMs?: number }): Promise<Stored>;
}
export const recordId = (kind: string, key: string, ownerId = "") =>
  createHash("sha256").update(JSON.stringify([kind, key, ownerId])).digest("hex");

/** Explicit development storage, never an implicit serverless filesystem fallback. */
export function createScoutStore(localDirectory?: string): ScoutStore {
  const memory = new Map<string, Stored>();
  let databaseRetryAt = 0;
  const remember = (value: Stored) => {
    memory.delete(value.record.id);
    memory.set(value.record.id, value);
    while (memory.size > 500) memory.delete(memory.keys().next().value!);
    return value;
  };
  const canUseDatabase = () => Boolean(process.env.DATABASE_URL) && !localDirectory && Date.now() >= databaseRetryAt;
  return {
    async get(kind, key, ownerId = "") {
      const id = recordId(kind, key, ownerId);
      if (localDirectory) {
        try {
          const record = JSON.parse(await readFile(path.join(localDirectory, id + ".json"), "utf8")) as ScoutRecord;
          if (record.id === id && record.ownerId === ownerId) return remember({ record, persistent: true });
        } catch { /* Missing or corrupt local record: use bounded process cache. */ }
      } else if (canUseDatabase()) {
        try {
          const row = await getPrisma().mktScoutRecord.findUnique({ where: { id } });
          if (row) return remember({ record: {
            ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
            expiresAt: row.expiresAt?.toISOString() ?? null,
          }, persistent: true });
        } catch { databaseRetryAt = Date.now() + 60_000; }
      }
      return memory.get(id) ?? null;
    },
    async put(kind, key, payload, options = {}) {
      const ownerId = options.ownerId ?? "";
      const id = recordId(kind, key, ownerId);
      const previous = memory.get(id);
      const now = new Date();
      const record: ScoutRecord = {
        id, kind, ownerId, cacheKey: key, payload,
        createdAt: previous?.record.createdAt ?? now.toISOString(), updatedAt: now.toISOString(),
        expiresAt: options.ttlMs ? new Date(now.getTime() + options.ttlMs).toISOString() : null,
      };
      if (localDirectory) {
        try {
          await mkdir(localDirectory, { recursive: true });
          const target = path.join(localDirectory, id + ".json");
          const temporary = target + "." + crypto.randomUUID() + ".tmp";
          await writeFile(temporary, JSON.stringify(record), "utf8");
          await rename(temporary, target);
          return remember({ record, persistent: true });
        } catch { /* Surface persistence=false instead of claiming the generation was saved. */ }
      } else if (canUseDatabase()) {
        try {
          const row = await getPrisma().mktScoutRecord.upsert({
            where: { id },
            create: { ...record, payload: payload as Prisma.InputJsonValue },
            update: { payload: payload as Prisma.InputJsonValue, updatedAt: now, expiresAt: record.expiresAt },
          });
          record.createdAt = row.createdAt.toISOString();
          return remember({ record, persistent: true });
        } catch { databaseRetryAt = Date.now() + 60_000; }
      }
      return remember({ record, persistent: false });
    },
  };
}

const globalStore = globalThis as unknown as { mktScoutStore?: ScoutStore };
export function getScoutStore() {
  if (!globalStore.mktScoutStore) {
    const localDirectory = process.env.NODE_ENV !== "production" ? process.env.SCOUT_LOCAL_STORE_DIR : undefined;
    globalStore.mktScoutStore = createScoutStore(localDirectory);
  }
  return globalStore.mktScoutStore;
}
export function isFresh(stored: Stored | null, now = Date.now()) {
  return Boolean(stored && (!stored.record.expiresAt || Date.parse(stored.record.expiresAt) > now));
}
