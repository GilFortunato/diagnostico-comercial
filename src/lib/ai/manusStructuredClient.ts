import "server-only";
import { classifyValidationFailure } from "@/lib/connectors/credentialValidation";
import { recordPlatformCredentialFailure } from "@/lib/connectors/platformCredentialService";
import { resolveManusCredential } from "@/lib/connectors/platformCredentials";
import { PlatformResourceUnavailableError } from "@/lib/connectors/errors";

const manusBaseUrl = "https://api.manus.ai/v2";
const pollIntervalMs = 2_500;
const requestTimeoutMs = 15_000;

type StructuredResultEvent<T> = {
  success: boolean;
  value: T;
  error?: string | null;
};

type ManusMessage = {
  type?: string;
  structured_output_result?: StructuredResultEvent<unknown>;
  status_update?: {
    agent_status?: "running" | "stopped" | "waiting" | "error";
  };
};

/**
 * Structured Manus generation for reasoning/content tasks.
 * Deliberately does not attach Apify or any other connector: the prompt must be
 * solved only from the data supplied by Share AI.
 */
export async function generateManusJson<T>({
  prompt,
  schema,
  title,
}: {
  prompt: string;
  schema: Record<string, unknown>;
  title: string;
}): Promise<T> {
  const resolution = await resolveManusCredential();
  if (!resolution.available || !resolution.credential) throw new PlatformResourceUnavailableError();

  let taskId: string | null = null;
  try {
    const createResponse = await fetch(`${manusBaseUrl}/task.create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-manus-api-key": resolution.credential,
      },
      body: JSON.stringify({
        message: { content: prompt },
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
      await recordFailure(resolution.source, createResponse.status);
      console.warn("[manus-authority]", { event: "task_create_failed", httpStatus: createResponse.status });
      throw new PlatformResourceUnavailableError();
    }

    const created = await createResponse.json() as { ok?: boolean; task_id?: string };
    taskId = created.ok && typeof created.task_id === "string" ? created.task_id : null;
    if (!taskId) throw new PlatformResourceUnavailableError();

    const startedAt = Date.now();
    while (Date.now() - startedAt < manusTimeoutMs()) {
      await sleep(pollIntervalMs);
      const response = await fetch(`${manusBaseUrl}/task.listMessages?task_id=${encodeURIComponent(taskId)}&order=desc&limit=100&verbose=true`, {
        headers: { "x-manus-api-key": resolution.credential },
        cache: "no-store",
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      if (!response.ok) {
        await recordFailure(resolution.source, response.status);
        throw new PlatformResourceUnavailableError();
      }

      const payload = await response.json() as { ok?: boolean; messages?: ManusMessage[] };
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      const structured = messages.find((message) => message.type === "structured_output_result" && message.structured_output_result)?.structured_output_result as StructuredResultEvent<T> | undefined;
      if (structured) {
        if (!structured.success || structured.value === undefined || structured.value === null) {
          console.warn("[manus-authority]", { event: "structured_output_failed", taskId });
          throw new PlatformResourceUnavailableError();
        }
        console.info("[manus-authority]", { event: "task_completed", taskId, durationMs: Date.now() - startedAt });
        return structured.value;
      }

      const status = messages.find((message) => message.type === "status_update" && message.status_update)?.status_update?.agent_status;
      if (status === "error" || status === "waiting") throw new PlatformResourceUnavailableError();
      if (status === "stopped") {
        // Give the structured result one final polling cycle before falling back.
        await sleep(pollIntervalMs);
      }
    }

    if (taskId) await stopTask(resolution.credential, taskId);
    console.warn("[manus-authority]", { event: "task_timeout", taskId });
    throw new PlatformResourceUnavailableError();
  } catch (error) {
    if (error instanceof PlatformResourceUnavailableError) throw error;
    if (taskId) await stopTask(resolution.credential, taskId);
    console.warn("[manus-authority]", { event: "task_exception", taskId, errorName: error instanceof Error ? error.name : "UnknownError" });
    throw new PlatformResourceUnavailableError();
  }
}

async function recordFailure(source: "managed" | "environment" | null, status: number) {
  if (status === 401 || status === 403 || status === 402 || status === 429 || status >= 500) {
    await recordPlatformCredentialFailure("manus", source, classifyValidationFailure(status)).catch(() => undefined);
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
    // Best effort only.
  }
}

function manusAgentProfile(): "standard" | "lite" | "max" {
  const value = process.env.MANUS_CONTENT_AGENT_PROFILE?.trim().toLocaleLowerCase("en-US");
  return value === "lite" || value === "max" ? value : "standard";
}

function manusTimeoutMs() {
  const configured = Number(process.env.MANUS_CONTENT_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return 60_000;
  return Math.max(20_000, Math.min(75_000, Math.round(configured)));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
