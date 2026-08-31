import "server-only";
import { resolveProviderForCapability, type AiCapability } from "@/lib/ai/providers";
import {
  defaultGeminiModel,
  classifyValidationFailure,
  supportsLegacyGeminiSamplingParameters,
} from "@/lib/connectors/credentialValidation";
import { recordPlatformCredentialFailure } from "@/lib/connectors/platformCredentialService";
import { resolveGeminiCredential } from "@/lib/connectors/platformCredentials";
import { PlatformResourceUnavailableError } from "@/lib/connectors/errors";

export { PlatformResourceUnavailableError as PlatformCapabilityUnavailableError };

export async function generateGeminiJson<T>({
  capability,
  prompt,
  temperature = 0.35,
}: {
  capability: AiCapability;
  prompt: string;
  temperature?: number;
}): Promise<T> {
  const provider = resolveProviderForCapability(capability, process.env.DEFAULT_AI_PROVIDER);
  const resolution = await resolveGeminiCredential();
  if (provider?.key !== "gemini" || !resolution.credential || !resolution.available) {
    throw new PlatformResourceUnavailableError();
  }

  const model = process.env.GEMINI_MODEL ?? defaultGeminiModel;
  const generationConfig: { responseMimeType: "application/json"; temperature?: number } = {
    responseMimeType: "application/json",
  };
  if (supportsLegacyGeminiSamplingParameters(model)) generationConfig.temperature = temperature;

  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": resolution.credential,
      },
      body: JSON.stringify({
        generationConfig,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    throw new PlatformResourceUnavailableError();
  }

  if (!response.ok) {
    await recordPlatformCredentialFailure("gemini", resolution.source, classifyValidationFailure(response.status));
    throw new PlatformResourceUnavailableError();
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || !text.trim()) throw new PlatformResourceUnavailableError();

  try {
    return JSON.parse(stripCodeFence(text)) as T;
  } catch {
    throw new PlatformResourceUnavailableError();
  }
}

function stripCodeFence(value: string) {
  return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}
