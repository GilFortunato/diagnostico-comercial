import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient, Prisma } from "@prisma/client";
import { saveHumanshipLinkedin } from "@/lib/humanship/service";

test("manual LinkedIn persistence scopes the participant and preserves human decisions", async () => {
  const globals = globalThis as unknown as { shareAiPrisma?: PrismaClient };
  const previous = globals.shareAiPrisma;
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://test.invalid/test";
  const statements: Prisma.Sql[] = [];
  let accessible = true;
  globals.shareAiPrisma = {
    $queryRaw: async (sql: Prisma.Sql) => {
      statements.push(sql);
      if (sql.text.includes('FROM "HumanshipRoleRule"')) return [];
      assert.ok(sql.values.includes("owner-test"));
      assert.match(sql.text, /e\."ownerId" = \$/);
      return accessible ? [{ company: "Hesselbach", jobTitle: "Head de RH" }] : [];
    },
    $executeRaw: async (sql: Prisma.Sql) => { statements.push(sql); return 1; },
  } as unknown as PrismaClient;
  try {
    const input = { ownerId: "owner-test", participantId: "participant-test", linkedinUrl: "linkedin.com/in/test-person?trk=x", savedByName: "Tester" };
    assert.equal(await saveHumanshipLinkedin(input), true);
    const update = statements.find((sql) => sql.text.includes('UPDATE "HumanshipParticipant"'))!;
    assert.ok(update.values.includes("https://www.linkedin.com/in/test-person"));
    assert.ok(update.values.includes("validate"));
    assert.match(update.text, /e\."ownerId" = \$/);
    assert.doesNotMatch(update.text, /"humanDecision"|"decisionAt"|"message1CopiedAt"|"email"\s*=/);
    statements.length = 0;
    accessible = false;
    assert.equal(await saveHumanshipLinkedin(input), false);
    assert.equal(statements.some((sql) => sql.text.includes("UPDATE")), false);
    statements.length = 0;
    assert.equal(await saveHumanshipLinkedin({ ...input, linkedinUrl: "https://example.com/person" }), false);
    assert.equal(statements.length, 0);
  } finally {
    globals.shareAiPrisma = previous;
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  }
});
