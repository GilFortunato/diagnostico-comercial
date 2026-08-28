import { NextResponse } from "next/server";
import { apifyActors } from "@/lib/connectors/apifyActors";
import { getUserApifyToken } from "@/lib/connectors/userApifyCredential";
import { getUserGeminiApiKey } from "@/lib/connectors/userGeminiCredential";

export async function GET() {
  const googleConnected = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const apifyConnected = Boolean(await getUserApifyToken());
  const hasUserGeminiCredential = Boolean(await getUserGeminiApiKey());
  const geminiConnected = hasUserGeminiCredential || Boolean(process.env.GEMINI_API_KEY);
  const linkedinOauthReady = Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);

  return NextResponse.json({
    google: {
      connected: googleConnected,
      label: googleConnected ? "Google Login conectado" : "Google Login pendente",
    },
    gemini: {
      connected: geminiConnected,
      label: geminiConnected ? "Gemini conectado" : "Conectar Gemini",
      mode: hasUserGeminiCredential ? "user-credential" : geminiConnected ? "platform-provider" : "missing-user-credential",
    },
    linkedin: {
      connected: apifyConnected || linkedinOauthReady,
      label: apifyConnected ? "LinkedIn via Apify conectado" : linkedinOauthReady ? "LinkedIn OAuth pronto" : "Conectar LinkedIn",
      mode: apifyConnected ? "apify-public-profile" : linkedinOauthReady ? "oauth" : "missing-user-credential",
    },
    apify: {
      connected: apifyConnected,
      label: apifyConnected ? "Apify conectado" : "Conectar Apify",
      actorId: process.env.APIFY_LINKEDIN_ACTOR_ID ?? apifyActors.linkedinProfile.actorId,
      actors: Object.values(apifyActors),
    },
  });
}
