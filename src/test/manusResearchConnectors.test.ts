import assert from "node:assert/strict";
import test from "node:test";
import { findResearchConnectorIds, MANUS_NATIVE_APIFY_CONNECTOR_ID } from "@/lib/connectors/manusCore";

test("Manus deep search selects professional research connectors in priority order", () => {
  const selected = findResearchConnectorIds([
    { id: "fc", name: "Firecrawl Web Research" },
    { id: "zi", name: "ZoomInfo" },
    { id: MANUS_NATIVE_APIFY_CONNECTOR_ID, name: "Native integration" },
    { id: "ap", name: "Apollo" },
    { id: "other", name: "Google Drive" },
  ]);

  assert.deepEqual(selected.map((connector) => connector.id), [
    MANUS_NATIVE_APIFY_CONNECTOR_ID,
    "ap",
    "zi",
    "fc",
  ]);
});

test("Manus deep search ignores unrelated connectors", () => {
  const selected = findResearchConnectorIds([
    { id: "drive", name: "Google Drive" },
    { id: "slack", name: "Slack" },
  ]);
  assert.deepEqual(selected, []);
});
