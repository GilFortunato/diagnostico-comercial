import { NextResponse } from "next/server";
import { apifyActors } from "@/lib/connectors/apifyActors";
import { getUserApifyToken } from "@/lib/connectors/userApifyCredential";

export async function GET() {
  const googleConnected = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const apifyConnected = Boolean(await getUserApifyToken());
  const geminiConnected = Boolean(process.env.GEMINI_API_KEY);
  const linkedinOauthReady = Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);

  return NextResponse.json({
    google: {
      connected: googleConnected,
      label: googleConnected ? "Login com Google disponível" : "Login com Google pendente",
    },
    gemini: {
      connected: geminiConnected,
      label: geminiConnected ? "Inteligência Gemini disponível" : "Inteligência Gemini indisponível",
      mode: geminiConnected ? "platform-free-tier" : "missing-platform-credential",
    },
    linkedin: {
      connected: apifyConnected || linkedinOauthReady,
      label: apifyConnected ? "LinkedIn disponível por fonte pública" : linkedinOauthReady ? "LinkedIn pronto para autorização" : "Fonte do LinkedIn pendente",
      mode: apifyConnected ? "apify-public-profile" : linkedinOauthReady ? "oauth" : "missing-user-credential",
    },
    apify: {
      connected: apifyConnected,
      label: apifyConnected ? "Fontes públicas conectadas" : "Conectar fontes públicas",
      actorId: process.env.APIFY_LINKEDIN_ACTOR_ID ?? apifyActors.linkedinProfile.actorId,
      actors: Object.values(apifyActors),
    },
  });
}
