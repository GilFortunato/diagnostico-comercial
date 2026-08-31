import assert from "node:assert/strict";
import test from "node:test";
import { adminAccessStatus } from "@/lib/auth/admin";
import { supportsLegacyGeminiSamplingParameters } from "@/lib/connectors/geminiCompatibility";
import {
  maskCredential,
  replaceCredentialCore,
  resolveCredentialCore,
  toPublicCredentialStatus,
  type PlatformProvider,
  type StoredPlatformCredential,
} from "@/lib/connectors/platformCredentialCore";

const providers: Array<{ provider: PlatformProvider; managed: string; environment: string }> = [
  { provider: "gemini", managed: "AIza-managed-secret-1234", environment: "AIza-environment-secret-9876" },
  { provider: "apify", managed: "apify_api_managed_secret_1234", environment: "apify_api_environment_secret_9876" },
];

for (const scenario of providers) {
  test(`${scenario.provider}: credencial do banco tem precedência sobre o ambiente`, async () => {
    const result = await resolveCredentialCore({
      stored: storedCredential(scenario.managed),
      environmentCredential: scenario.environment,
      decrypt: (value) => value,
    });

    assert.equal(result.credential, scenario.managed);
    assert.equal(result.source, "managed");
    assert.equal(result.available, true);
    assert.equal(result.validated, true);
  });

  test(`${scenario.provider}: usa ambiente quando não há credencial administrada`, async () => {
    const result = await resolveCredentialCore({ stored: null, environmentCredential: scenario.environment, decrypt: (value) => value });
    assert.equal(result.credential, scenario.environment);
    assert.equal(result.source, "environment");
    assert.equal(result.available, true);
  });

  test(`${scenario.provider}: fica indisponível sem banco e sem ambiente`, async () => {
    const result = await resolveCredentialCore({ stored: null, environmentCredential: null, decrypt: (value) => value });
    assert.equal(result.credential, null);
    assert.equal(result.source, null);
    assert.equal(result.available, false);
    assert.equal(result.status, "disconnected");
  });

  test(`${scenario.provider}: credencial inválida preserva a conexão atual`, async () => {
    let saveCalls = 0;
    const result = await replaceCredentialCore({
      provider: scenario.provider,
      credential: "invalid-secret",
      validate: async () => ({ ok: false, status: "error", adminMessage: "A credencial foi recusada." }),
      encrypt: (value) => value,
      save: async () => { saveCalls += 1; },
    });
    assert.equal(result.activated, false);
    assert.equal(saveCalls, 0);
  });

  test(`${scenario.provider}: credencial válida substitui a anterior`, async () => {
    let saved: { encrypted: string; masked: string } | null = null;
    const result = await replaceCredentialCore({
      provider: scenario.provider,
      credential: scenario.managed,
      validate: async () => ({ ok: true, status: "connected", adminMessage: null }),
      encrypt: (value) => `encrypted:${value}`,
      save: async (input) => { saved = input; },
      now: () => new Date("2026-08-29T20:35:00.000Z"),
    });
    assert.equal(result.activated, true);
    assert.deepEqual(saved, {
      provider: scenario.provider,
      encrypted: `encrypted:${scenario.managed}`,
      masked: maskCredential(scenario.managed),
      status: "connected",
      lastValidatedAt: new Date("2026-08-29T20:35:00.000Z"),
      lastError: null,
    });
  });

  test(`${scenario.provider}: remoção da credencial administrada retorna ao ambiente`, async () => {
    const afterRemoval = await resolveCredentialCore({ stored: null, environmentCredential: scenario.environment, decrypt: (value) => value });
    assert.equal(afterRemoval.source, "environment");
    assert.equal(afterRemoval.credential, scenario.environment);
  });

  test(`${scenario.provider}: resposta pública nunca contém o segredo completo`, async () => {
    const resolved = await resolveCredentialCore({ stored: storedCredential(scenario.managed), environmentCredential: null, decrypt: (value) => value });
    const serialized = JSON.stringify(toPublicCredentialStatus(resolved));
    assert.equal(serialized.includes(scenario.managed), false);
    assert.equal("credential" in toPublicCredentialStatus(resolved), false);
  });
}

test("Gemini 3.x não recebe parâmetros legados de amostragem", () => {
  assert.equal(supportsLegacyGeminiSamplingParameters("gemini-3.6-flash"), false);
  assert.equal(supportsLegacyGeminiSamplingParameters("gemini-3.7-flash"), false);
  assert.equal(supportsLegacyGeminiSamplingParameters("gemini-3-flash-preview"), false);
});

test("modelos Gemini anteriores preservam parâmetros legados quando configurados", () => {
  assert.equal(supportsLegacyGeminiSamplingParameters("gemini-2.5-flash"), true);
});

test("endpoints administrativos devem responder 403 para e-mail não autorizado", () => {
  assert.equal(adminAccessStatus("vendedor@share.com.br", "admin@share.com.br"), 403);
  assert.equal(adminAccessStatus(null, "admin@share.com.br"), 403);
  assert.equal(adminAccessStatus("admin@share.com.br", "admin@share.com.br"), 200);
});

test("credencial administrada com erro pode ser testada, mas não usada comercialmente", async () => {
  const secret = "AIza-managed-unhealthy-secret-1234";
  const result = await resolveCredentialCore({
    stored: { ...storedCredential(secret), status: "error", lastError: "O serviço está temporariamente indisponível." },
    environmentCredential: null,
    decrypt: (value) => value,
  });

  assert.equal(result.available, false);
  assert.equal(result.source, "managed");
  assert.equal(result.credential, secret);
  assert.equal(JSON.stringify(toPublicCredentialStatus(result)).includes(secret), false);
});

function storedCredential(secret: string): StoredPlatformCredential {
  return {
    encrypted: secret,
    masked: maskCredential(secret),
    status: "connected",
    lastValidatedAt: new Date("2026-08-29T20:35:00.000Z"),
    lastError: null,
  };
}
