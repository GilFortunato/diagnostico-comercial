export type PlatformProvider = "gemini" | "apify";
export type PlatformCredentialSource = "managed" | "environment" | null;
export type PlatformCredentialHealth = "connected" | "limit_reached" | "error" | "disconnected";

export type StoredPlatformCredential = {
  encrypted: string;
  masked: string;
  status: Exclude<PlatformCredentialHealth, "disconnected">;
  lastValidatedAt: Date | null;
  lastError: string | null;
};

export type PlatformCredentialResolution = {
  available: boolean;
  configured: boolean;
  validated: boolean;
  credential: string | null;
  source: PlatformCredentialSource;
  status: PlatformCredentialHealth;
  masked: string | null;
  lastValidatedAt: Date | null;
  lastError: string | null;
};

export type PublicPlatformCredentialStatus = Omit<PlatformCredentialResolution, "credential">;

export type CredentialValidation = {
  ok: boolean;
  status: Exclude<PlatformCredentialHealth, "disconnected">;
  adminMessage: string | null;
};

export async function resolveCredentialCore({
  stored,
  environmentCredential,
  decrypt,
}: {
  stored: StoredPlatformCredential | null;
  environmentCredential?: string | null;
  decrypt: (encrypted: string) => string;
}): Promise<PlatformCredentialResolution> {
  let managedCredential: string | null = null;
  if (stored) {
    try {
      const credential = decrypt(stored.encrypted).trim();
      if (credential) {
        managedCredential = credential;
      }
      if (credential && stored.status === "connected") {
        return {
          available: true,
          configured: true,
          validated: Boolean(stored.lastValidatedAt),
          credential,
          source: "managed",
          status: "connected",
          masked: stored.masked,
          lastValidatedAt: stored.lastValidatedAt,
          lastError: null,
        };
      }
    } catch {
      // A broken managed value must never block the emergency environment fallback.
    }
  }

  const fallback = environmentCredential?.trim();
  if (fallback) {
    return {
      available: true,
      configured: true,
      validated: false,
      credential: fallback,
      source: "environment",
      status: "connected",
      masked: maskCredential(fallback),
      lastValidatedAt: null,
      lastError: stored?.lastError ?? null,
    };
  }

  return {
    available: false,
    configured: Boolean(stored),
    validated: Boolean(stored?.lastValidatedAt),
    credential: managedCredential,
    source: managedCredential ? "managed" : null,
    status: stored?.status ?? "disconnected",
    masked: stored?.masked ?? null,
    lastValidatedAt: stored?.lastValidatedAt ?? null,
    lastError: stored?.lastError ?? null,
  };
}

export function toPublicCredentialStatus(resolution: PlatformCredentialResolution): PublicPlatformCredentialStatus {
  return {
    available: resolution.available,
    configured: resolution.configured,
    validated: resolution.validated,
    source: resolution.source,
    status: resolution.status,
    masked: resolution.masked,
    lastValidatedAt: resolution.lastValidatedAt,
    lastError: resolution.lastError,
  };
}

export async function replaceCredentialCore({
  provider,
  credential,
  validate,
  encrypt,
  save,
  now = () => new Date(),
}: {
  provider: PlatformProvider;
  credential: string;
  validate: (provider: PlatformProvider, credential: string) => Promise<CredentialValidation>;
  encrypt: (credential: string) => string;
  save: (input: {
    provider: PlatformProvider;
    encrypted: string;
    masked: string;
    status: "connected";
    lastValidatedAt: Date;
    lastError: null;
  }) => Promise<void>;
  now?: () => Date;
}) {
  const normalized = credential.trim();
  const validation = await validate(provider, normalized);

  if (!validation.ok) {
    return {
      activated: false as const,
      status: validation.status,
      message: validation.adminMessage ?? "Não foi possível validar a nova credencial. A conexão anterior continua ativa.",
    };
  }

  await save({
    provider,
    encrypted: encrypt(normalized),
    masked: maskCredential(normalized),
    status: "connected",
    lastValidatedAt: now(),
    lastError: null,
  });

  return {
    activated: true as const,
    status: "connected" as const,
    message: "Credencial validada e ativada.",
  };
}

export function maskCredential(value: string) {
  const normalized = value.trim();
  if (!normalized) return "••••••••••••";
  const visiblePrefix = normalized.startsWith("AIza") ? "AIza" : normalized.startsWith("apify_api_") ? "apify_api_" : "";
  const visibleSuffix = normalized.length > 8 ? normalized.slice(-4) : "";
  return `${visiblePrefix}••••••••••••${visibleSuffix}`;
}
