import assert from "node:assert/strict";
import { test } from "node:test";
import { GET } from "../app/api/cron/crm-chat/route";
import { groupCrmChatTasks, runCrmChatAlerts, sendCrmChatDigest } from "../lib/crm/googleChat";
import { recipientSettings } from "../lib/crm/googleChatConfig";

const recipients = [
  { email: "ana@corp.example", aliases: ["Ana", "Ana Silva"] },
  { email: "bia@corp.example", aliases: ["Bia"] },
];

test("routes overdue tasks to their mapped owners before using the opportunity owner", () => {
  const opportunity = { owner: "Bia", stage: "Em conversa", result: "Em aberto", contractClosed: false, account: { name: "Empresa" } };
  const shared = { title: "Proposta", owner: "ÁNA / Ana Silva / Desconhecido", dueDate: new Date("2026-11-13"), opportunityId: "opportunity", opportunity };
  const fallback = { ...shared, title: "Ligação", owner: "  " };
  const won = { ...shared, opportunity: { ...opportunity, contractClosed: true } };
  const { grouped, unmapped } = groupCrmChatTasks([shared, fallback, won], recipients);

  assert.deepEqual(grouped.get(recipients[0].email), [shared]);
  assert.deepEqual(grouped.get(recipients[1].email), [fallback]);
  assert.deepEqual(unmapped, ["Desconhecido"]);
  const schema = recipientSettings("sender@corp.example");
  assert.equal(schema.safeParse(recipients).success, true);
  assert.equal(schema.safeParse([...recipients, { email: "outro@corp.example", aliases: ["Ána"] }]).success, false);
  assert.equal(schema.safeParse([{ email: "ana@example.com", aliases: ["Ana"] }]).success, false);
});

test("uses a direct conversation and a stable message ID for retries to the same recipient", async (context) => {
  const messageIds = new Set<string>();
  context.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
    const url = new URL(input);
    assert.equal(url.host, "chat.googleapis.com");
    assert.equal(init.method, "POST");
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer token");
    if (url.pathname === "/v1/spaces:setup") {
      assert.deepEqual(JSON.parse(String(init.body)), {
        space: { spaceType: "DIRECT_MESSAGE", singleUserBotDm: false },
        memberships: [{ member: { name: `users/${recipients[0].email}`, type: "HUMAN" } }],
      });
      return Response.json({ name: "spaces/DM123", spaceType: "DIRECT_MESSAGE" });
    }
    assert.equal(url.pathname, "/v1/spaces/DM123/messages");
    const messageId = url.searchParams.get("messageId");
    assert.match(messageId ?? "", /^client-crm-[a-f0-9]{32}$/);
    assert.ok(messageId);
    if (messageIds.has(messageId)) return Response.json({ error: { status: "ALREADY_EXISTS" } }, { status: 409 });
    messageIds.add(messageId);
    return Response.json({ name: "spaces/DM123/messages/MSG1" });
  });

  assert.equal(await sendCrmChatDigest(recipients[0].email, "token", "2026-11-16", "Resumo"), "sent");
  assert.equal(await sendCrmChatDigest(recipients[0].email, "token", "2026-11-16", "Resumo atualizado"), "alreadySent");
  assert.equal(await sendCrmChatDigest(recipients[0].email, "token", "2026-11-17", "Resumo"), "sent");
});

test("rejects a scheduled call without authorization and skips the weekend before accessing data", async () => {
  const response = await GET(new Request("https://example.com/api/cron/crm-chat"));
  assert.equal(response.status, 401);
  assert.deepEqual(await runCrmChatAlerts(new Date("2026-11-16T01:00:00Z")), { status: "weekend" });
});
