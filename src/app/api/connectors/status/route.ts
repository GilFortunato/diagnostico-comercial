import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/auth/adminRequest";
import { toPublicCredentialStatus } from "@/lib/connectors/platformCredentialCore";
import { resolveApifyCredential, resolveGeminiCredential, resolveManusCredential } from "@/lib/connectors/platformCredentials";

export async function GET() {
  const [gemini, apify, manus, isAdmin] = await Promise.all([
    resolveGeminiCredential(),
    resolveApifyCredential(),
    resolveManusCredential(),
    hasAdminSession(),
  ]);
  const googleConnected = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const huntingAvailable = manus.available || apify.available;

  return NextResponse.json({
    google: {
      connected: googleConnected,
      label: googleConnected ? "Acesso com Google disponível" : "Acesso com Google indisponível",
    },
    intelligence: {
      available: gemini.available,
      label: gemini.available ? "Inteligência disponível" : "Inteligência temporariamente indisponível",
    },
    publicSources: {
      available: huntingAvailable,
      label: huntingAvailable ? "Pesquisa pública disponível" : "Pesquisa pública temporariamente indisponível",
    },
    ...(isAdmin
      ? {
          admin: {
            gemini: toPublicCredentialStatus(gemini),
            apify: toPublicCredentialStatus(apify),
            manus: toPublicCredentialStatus(manus),
          },
        }
      : {}),
  });
}
