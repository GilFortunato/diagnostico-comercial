import "server-only";
import { classifyValidationFailure } from "@/lib/connectors/credentialValidation";
import { findApifyConnectorId, type ManusConnector, type ManusRunStatus } from "@/lib/connectors/manusCore";
import { recordPlatformCredentialFailure } from "@/lib/connectors/platformCredentialService";
import { resolveManusCredential } from "@/lib/connectors/platformCredentials";

const manusBaseUrl = "https://api.manus.ai/v2";
const pollIntervalMs = 3_000;
const requestTimeoutMs = 15_000;
let connectorCache: { expiresAt: number; id: string } | null = null;

type StructuredResultEvent<T> = {
  success: boolean;
  value: T;
  error?: string | null;
};

type ManusMessage = {
  type?: string;
  status_update?: { agent_status?: "running" | "stopped" | "waiting" | "error" };
  structured_output_result?: StructuredResultEvent<unknown>;
};

export type ManusTaskResult<T> = {
  status: ManusRunStatus;
  value: T | null;
  warnings: string[];
  taskId: string | null;
  creditUsage: number | null;
  apifyConnectorUsed: boolean;
  durationMs: number;
};

export async function listManusConnectors(apiKey: string): Promise<ManusConnector[]> {
  const response = await fetch(`${manusBaseUrl}/connector.list`, {
    headers: { "x-manus-api-key": apiKey },
    cache: "no-store",
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  if (!response.ok) throw new ManusHttpError(response.status);
  const payload = await response.json() as { ok?: boolean; data?: ManusConnector[] };
  return payload.ok && Array.isArray(payload.data) ? payload.data : [];
}

export async function runManusStructuredTask<T>({
  prompt,
  schema,
  title,
  countResults,
}: {
  prompt: string;
  schema: Record<string, unknown>;
  title: string;
  countResults: (value: T) => number;
}): Promise<ManusTaskResult<T>> {
  const startedAt = Date.now();
  const resolution = await resolveManusCredential();
  if (!resolution.available || !resolution.credential) {
    return result<T>("unavailable", null, ["Manus não está configurado; a pesquisa seguirá pelo fallback disponível."], null, null, false, startedAt);
  }

  const warnings: string[] = [];
  let connectorId: string | null = null;
  try {
    connectorId = await resolveApifyConnectorId(resolution.credential);
  } catch (error) {
    if (error instanceof ManusHttpError) await recordManusCredentialFailure(resolution.source, error.status);
    warnings.push("O conector Apify do Manus não pôde ser confirmado; a Share AI usará o Apify direto como fallback.");
  }

  if (!connectorId) {
    console.warn("[manus-hunting]", { event: "apify_connector_unavailable" });
    return result<T>(
      "unavailable",
      null,
      [...warnings, "O Apify nativo não está disponível para esta API do Manus. Autorize o conector Apify na conta Manus e tente novamente."],
      null,
      null,
      false,
      startedAt,
    );
  }

  let taskId: string | null = null;
  try {
    const createResponse = await fetch(`${manusBaseUrl}/task.create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-manus-api-key": resolution.credential,
      },
      body: JSON.stringify({
        message: {
          content: prompt,
          connectors: [connectorId],
        },
        interactive_mode: false,
        hide_in_task_list: true,
        share_visibility: "private",
        agent_profile: manusAgentProfile(),
        title,
        structured_output_schema: schema,
      }),
      signal: AbortSignal.timeout(requestTimeoutMs),
    });

    if (!createResponse.ok) {
      await recordManusCredentialFailure(resolution.source, createResponse.status);
      const status = createResponse.status === 402 || createResponse.status === 429 ? "quota_exceeded" : "provider_error";
      return result<T>(status, null, warnings, null, null, true, startedAt);
    }

    const created = await createResponse.json() as { ok?: boolean; task_id?: string; error?: { message?: string } };
    taskId = created.ok && typeof created.task_id === "string" ? created.task_id : null;
    if (!taskId) return result<T>("provider_error", null, [...warnings, "Manus não retornou um identificador de tarefa válido."], null, null, true, startedAt);

    console.info("[manus-hunting]", { event: "task_started", taskId, apifyConnectorUsed: true, connectorId });
    const timeoutMs = manusTimeoutMs();
    let sawStopped = false;

    while (Date.now() - startedAt < timeoutMs) {
      await sleep(pollIntervalMs);
      const response = await fetch(`${manusBaseUrl}/task.listMessages?task_id=${encodeURIComponent(taskId)}&order=desc&limit=50`, {
        headers: { "x-manus-api-key": resolution.credential },
        cache: "no-store",
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      if (!response.ok) {
        await recordManusCredentialFailure(resolution.source, response.status);
        const status = response.status === 402 || response.status === 429 ? "quota_exceeded" : "provider_error";
        return result<T>(status, null, warnings, taskId, await readCreditUsage(resolution.credential, taskId), true, startedAt);
      }

      const payload = await response.json() as { ok?: boolean; messages?: ManusMessage[] };
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      const structured = messages.find((message) => message.type === "structured_output_result" && message.structured_output_result)?.structured_output_result as StructuredResultEvent<T> | undefined;
      if (structured) {
        const credits = await readCreditUsage(resolution.credential, taskId);
        if (!structured.success) {
          return result<T>("provider_error", null, [...warnings, structured.error || "Manus não conseguiu estruturar o resultado da pesquisa."], taskId, credits, true, startedAt);
        }
        const count = countResults(structured.value);
        const status: ManusRunStatus = count > 0 ? "success_with_results" : "success_empty";
        console.info("[manus-hunting]", { event: "task_completed", taskId, status, resultCount: count, creditUsage: credits, durationMs: Date.now() - startedAt, apifyConnectorUsed: true });
        return result<T>(status, structured.value, warnings, taskId, credits, true, startedAt);
      }

      const statusEvent = messages.find((message) => message.type === "status_update" && message.status_update)?.status_update;
      if (statusEvent?.agent_status === "error" || statusEvent?.agent_status === "waiting") {
        const credits = await readCreditUsage(resolution.credential, taskId);
        const reason = statusEvent.agent_status === "waiting"
          ? "Manus solicitou interação durante uma pesquisa automática; a Share AI acionará o fallback."
          : "A tarefa Manus terminou com erro.";
        return result<T>("provider_error", null, [...warnings, reason], taskId, credits, true, startedAt);
      }
      if (statusEvent?.agent_status === "stopped") sawStopped = true;
      if (sawStopped && Date.now() - startedAt + pollIntervalMs >= timeoutMs) break;
    }

    await stopTask(resolution.credential, taskId);
    return result<T>("timeout", null, [...warnings, "Manus excedeu o tempo limite desta pesquisa; a tarefa foi interrompida para evitar consumo indefinido."], taskId, await readCreditUsage(resolution.credential, taskId), true, startedAt);
  } catch (error) {
    if (error instanceof ManusHttpError) await recordManusCredentialFailure(resolution.source, error.status);
    const timeout = error instanceof DOMException && error.name === "TimeoutError";
    if (taskId && timeout) await stopTask(resolution.credential, taskId);
    return result<T>(timeout ? "timeout" : "provider_error", null, warnings, taskId, taskId ? await readCreditUsage(resolution.credential, taskId) : null, true, startedAt);
  }
}

async function resolveApifyConnectorId(apiKey: string) {
  if (connectorCache && connectorCache.expiresAt > Date.now()) return connectorCache.id;

  const connectors = await listManusConnectors(apiKey);
  const configuredId = process.env.MANUS_APIFY_CONNECTOR_ID?.trim();
  const validConfiguredId = configuredId && connectors.some((connector) => connector.id === configuredId)
    ? configuredId
    : null;
  const id = findApifyConnectorId(connectors, validConfiguredId);

  // Never cache a missing connector. If the admin authorizes Apify in Manus,
  // the very next Hunting request must be able to detect it immediately.
  if (id) connectorCache = { id, expiresAt: Date.now() + 10 * 60 * 1000 };
  return id;
}

async function readCreditUsage(apiKey: string, taskId: string) {
  try {
    const response = await fetch(`${manusBaseUrl}/task.detail?task_id=${encodeURIComponent(taskId)}`, {
      headers: { "x-manus-api-key": apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { ok?: boolean; task?: { credit_usage?: number } };
    return payload.ok && typeof payload.task?.credit_usage === "number" ? payload.task.credit_usage : null;
  } catch {
    return null;
  }
}

async function stopTask(apiKey: string, taskId: string) {
  try {
    await fetch(`${manusBaseUrl}/task.stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-manus-api-key": apiKey },
      body: JSON.stringify({ task_id: taskId }),
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
  } catch {
    // Best effort only; timeout protection must not throw a second error.
  }
}

async function recordManusCredentialFailure(source: "managed" | "environment" | null, status: number) {
  if (status === 401 || status === 403 || status === 402 || status === 429 || status >= 500) {
    await recordPlatformCredentialFailure("manus", source, classifyValidationFailure(status));
  }
}

function manusAgentProfile(): "standard" | "lite" | "max" {
  const value = process.env.MANUS_HUNTING_AGENT_PROFILE?.trim().toLocaleLowerCase("en-US");
  return value === "lite" || value === "max" ? value : "standard";
}

function manusTimeoutMs() {
  const configured = Number(process.env.MANUS_HUNTING_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return 90_000;
  return Math.max(20_000, Math.min(120_000, Math.round(configured)));
}

function result<T>(status: ManusRunStatus, value: T | null, warnings: string[], taskId: string | null, creditUsage: number | null, apifyConnectorUsed: boolean, startedAt: number): ManusTaskResult<T> {
  return { status, value, warnings, taskId, creditUsage, apifyConnectorUsed, durationMs: Date.now() - startedAt };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class ManusHttpError extends Error {
  constructor(readonly status: number) {
    super(`Manus HTTP ${status}`);
    this.name = "ManusHttpError";
  }
}
