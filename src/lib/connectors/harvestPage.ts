import "server-only";
import { apifyActors } from "@/lib/connectors/apifyActors";
import { resolveApifyCredential } from "@/lib/connectors/platformCredentials";
import { PlatformResourceUnavailableError } from "@/lib/connectors/errors";
import { classifyValidationFailure } from "@/lib/connectors/credentialValidation";
import { recordPlatformCredentialFailure } from "@/lib/connectors/platformCredentialService";
import type { HrDiscoveryRound } from "@/lib/hr-hunting/pagedDiscovery";

type Run = { id: string; status: string; defaultDatasetId: string; exitCode?: number; statusMessage?: string };
const validId = (id: unknown): id is string => typeof id === "string" && /^[a-zA-Z0-9]{8,32}$/.test(id);
const terminal = new Set(["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"]);

export async function fetchHarvestPage(input: Record<string, unknown>, round: HrDiscoveryRound, timeoutMs: number, waitSeconds = 25) {
  const auth = await resolveApifyCredential();
  if (!auth.available || !auth.credential) throw new PlatformResourceUnavailableError();
  const actor = process.env.APIFY_LINKEDIN_PROFILE_SEARCH_ACTOR_ID?.trim() || apifyActors.linkedinProfileSearch.actorId;
  const deadline = Date.now() + timeoutMs;
  return readHarvestPage(actor, input, round, async (path, init) => {
    const remaining = deadline - Date.now();
    if (remaining < 500) throw new PlatformResourceUnavailableError();
    const response = await fetch("https://api.apify.com/v2/" + path, {
      ...init, headers: { Authorization: "Bearer " + auth.credential, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(remaining), cache: "no-store",
    });
    if (!response.ok) {
      console.warn("[hr-hunting] Harvest API error", { status: response.status, runId: round.runId });
      if ([401, 402, 403, 429].includes(response.status)) {
        await recordPlatformCredentialFailure("apify", auth.source, classifyValidationFailure(response.status));
      }
      if (response.status === 404 && path.startsWith("actor-runs/")) delete round.runId;
      throw new PlatformResourceUnavailableError();
    }
    return response.json();
  }, waitSeconds);
}

export async function readHarvestPage(actor: string, input: Record<string, unknown>, round: HrDiscoveryRound,
  request: (path: string, init?: RequestInit) => Promise<{ data: Run } | unknown[]>, waitSeconds = 25) {
  const starting = !validId(round.runId);
  if (starting) {
    const started = await request("acts/" + encodeURIComponent(actor.replace("/", "~")) + "/runs?timeout=180",
      { method: "POST", body: JSON.stringify(input) });
    if (Array.isArray(started) || !validId(started.data?.id)) throw new PlatformResourceUnavailableError();
    round.runId = started.data.id;
  }
  const result = await request("actor-runs/" + round.runId + "?waitForFinish=" + waitSeconds);
  if (Array.isArray(result) || result.data?.id !== round.runId || !validId(result.data?.defaultDatasetId)) throw new PlatformResourceUnavailableError();
  const run = result.data;
  const finished = terminal.has(run.status);
  console.info("[hr-hunting] Harvest run", { runId: run.id, status: run.status, exitCode: run.exitCode, resumed: !starting });
  const items = await request("datasets/" + run.defaultDatasetId + "/items?clean=true&limit=50");
  if (!Array.isArray(items)) throw new PlatformResourceUnavailableError();
  if (finished) delete round.runId;
  const failed = finished && run.status !== "SUCCEEDED";
  if (failed && !items.length) throw new PlatformResourceUnavailableError();
  return { items, pending: !finished, partial: failed };
}
