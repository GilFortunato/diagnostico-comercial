import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/auth/adminRequest";
import { toPublicCredentialStatus } from "@/lib/connectors/platformCredentialCore";
import { resolveApifyCredential, resolveGeminiCredential } from "@/lib/connectors/platformCredentials";

export async function GET() {
  const [gemini, apify, isAdmin] = await Promise.all([
    resolveGeminiCredential(),
    resolveApifyCredential(),
    hasAdminSession(),
  ]);
  const googleConnected = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

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
      available: apify.available,
      label: apify.available ? "Fontes públicas disponíveis" : "Fontes públicas temporariamente indisponíveis",
    },
    ...(isAdmin
      ? {
          admin: {
            gemini: toPublicCredentialStatus(gemini),
            apify: toPublicCredentialStatus(apify),
          },
        }
      : {}),
  });
}
