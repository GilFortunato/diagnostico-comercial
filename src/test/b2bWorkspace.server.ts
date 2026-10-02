import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { companySearchSchema } from "@/lib/decision-makers/search";
import { b2bQueryHash, findReusableB2BSearch, deleteOwnedB2BSearch, addB2BLeadToList } from "@/lib/decision-makers/workspace";

const input = companySearchSchema.parse({ mode: "companies", businessUnitId: "bu_prosper", objective: "Encontrar empresas para prospecção", filters: { industries: ["Software", "Education"] } });

test("B2B cache normalizes filter order but keeps brand and objective boundaries", () => {
  assert.equal(b2bQueryHash(input), b2bQueryHash({ ...input, forceRefresh: true, filters: { ...input.filters, industries: [...input.filters.industries].reverse() } }));
  assert.notEqual(b2bQueryHash(input), b2bQueryHash({ ...input, businessUnitId: "bu_share" }));
  assert.notEqual(b2bQueryHash(input), b2bQueryHash({ ...input, objective: "Outra necessidade comercial" }));
});

test("B2B persistence bounds cache age, restricts deletion to owner and shares list additions", async () => {
  const globals = globalThis as unknown as { shareAiPrisma?: PrismaClient };
  const previous = globals.shareAiPrisma;
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://test.invalid/test";
  let deleted = false;
  let shared = false;
  let added = false;
  globals.shareAiPrisma = {
    b2BWorkspaceSearch: {
      findFirst: async ({ where }: { where: { queryHash?: string; updatedAt?: { gte: Date }; reusedFromSearchId?: string | null; ownerId?: string } }) => {
        if (where.queryHash) {
          assert.equal(where.reusedFromSearchId, null);
          const age = Date.now() - where.updatedAt!.gte.getTime();
          assert.ok(age >= 7 * 86400000 && age < 7 * 86400000 + 2000);
          return { id: "original-search" };
        }
        return where.ownerId === "owner" ? { id: "search", title: "Pesquisa da Gil" } : null;
      },
      delete: async () => { deleted = true; },
    },
    b2BLeadList: { findUnique: async () => ({ id: "list", shared }) },
    b2BLead: { findUnique: async () => ({ id: "lead" }) },
    b2BLeadListItem: { upsert: async ({ create }: { create: { addedById: string; addedByName: string } }) => {
      assert.equal(create.addedById, "colleague"); assert.equal(create.addedByName, "Colega"); added = true; return create;
    } },
  } as unknown as PrismaClient;
  try {
    assert.equal((await findReusableB2BSearch(input))?.id, "original-search");
    assert.equal(await deleteOwnedB2BSearch("search", "colleague"), null);
    assert.equal(deleted, false);
    assert.equal((await deleteOwnedB2BSearch("search", "owner"))?.id, "search");
    assert.equal(deleted, true);
    const item = { actor: { id: "colleague", name: "Colega" }, listId: "list", leadId: "lead" };
    assert.equal(await addB2BLeadToList(item), null); assert.equal(added, false);
    shared = true;
    await addB2BLeadToList(item); assert.equal(added, true);
  } finally {
    globals.shareAiPrisma = previous;
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  }
});
