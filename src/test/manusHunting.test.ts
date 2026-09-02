import assert from "node:assert/strict";
import test from "node:test";
import { classifyManusHttpStatus, findApifyConnectorId, isRealLinkedInCompanyUrl, isRealLinkedInPersonUrl } from "@/lib/connectors/manusCore";

test("Manus encontra o conector Apify instalado", () => {
  const id = findApifyConnectorId([
    { id: "calendar", name: "Calendar", type: "builtin" },
    { id: "apify-mcp", name: "Apify MCP", type: "mcp", description: "Actors via https://mcp.apify.com" },
  ]);
  assert.equal(id, "apify-mcp");
});

test("MANUS_APIFY_CONNECTOR_ID explícito tem precedência", () => {
  assert.equal(findApifyConnectorId([{ id: "detected", name: "Apify" }], "configured"), "configured");
});

test("429 e 402 são tratados como limite e não como zero resultados", () => {
  assert.equal(classifyManusHttpStatus(429), "quota_exceeded");
  assert.equal(classifyManusHttpStatus(402), "quota_exceeded");
  assert.equal(classifyManusHttpStatus(401), "provider_error");
});

test("somente URL real /in/ do LinkedIn é aceita como pessoa", () => {
  assert.equal(isRealLinkedInPersonUrl("https://www.linkedin.com/in/pessoa-real"), true);
  assert.equal(isRealLinkedInPersonUrl("https://linkedin.com/company/corpus"), false);
  assert.equal(isRealLinkedInPersonUrl("https://example.com/in/pessoa-real"), false);
  assert.equal(isRealLinkedInPersonUrl("pessoa-real"), false);
});

test("URL corporativa do LinkedIn é validada separadamente", () => {
  assert.equal(isRealLinkedInCompanyUrl("https://www.linkedin.com/company/corpus"), true);
  assert.equal(isRealLinkedInCompanyUrl("https://www.linkedin.com/in/pessoa-real"), false);
});
