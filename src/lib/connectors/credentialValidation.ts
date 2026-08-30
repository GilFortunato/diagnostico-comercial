import "server-only";
import type { CredentialValidation, PlatformProvider } from "@/lib/connectors/platformCredentialCore";

const validationTimeoutMs = 10_000;
export const defaultGeminiModel = "gemini-3.6-flash";

export async function validatePlatformCredential(provider: PlatformProvider, credential: string): Promise<CredentialValidation> {
  if (!credential.trim()) {
    return { ok: false, status: "error", adminMessage: "Informe uma credencial para validar." };
  }

  try {
    const response = provider === "gemini" ? await validateGemini(credential) : await validateApify(credential);
    if (response.ok) return { ok: true, status: "connected", adminMessage: null };
    return classifyValidationFailure(response.status);
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return { ok: false, status: "error", adminMessage: "O serviço demorou demais para responder." };
    }
    return { ok: false, status: "error", adminMessage: "O serviço está temporariamente indisponível." };
  }
}

async function validateGemini(credential: string) {
  const model = process.env.GEMINI_MODEL ?? defaultGeminiModel;
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": credential,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "Responda apenas: OK" }] }],
      generationConfig: { maxOutputTokens: 4, temperature: 0 },
    }),
    signal: AbortSignal.timeout(validationTimeoutMs),
  });
}

async function validateApify(credential: string) {
  return fetch("https://api.apify.com/v2/users/me", {
    headers: { Authorization: `Bearer ${credential}` },
    signal: AbortSignal.timeout(validationTimeoutMs),
  });
}

export function classifyValidationFailure(status: number): CredentialValidation {
  if (status === 429 || status === 402) {
    return { ok: false, status: "limit_reached", adminMessage: "O limite de uso foi atingido." };
  }
  if (status === 401 || status === 403) {
    return { ok: false, status: "error", adminMessage: "A credencial foi recusada." };
  }
  if (status >= 500) {
    return { ok: false, status: "error", adminMessage: "O serviço está temporariamente indisponível." };
  }
  return { ok: false, status: "error", adminMessage: "Não foi possível validar a credencial." };
}
