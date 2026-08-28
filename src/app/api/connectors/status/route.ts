import { NextResponse } from "next/server";
import { getUserGeminiApiKey } from "@/lib/connectors/userGeminiCredential";

export async function GET() {
  const googleConnected = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
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
      connected: linkedinOauthReady,
      label: linkedinOauthReady ? "LinkedIn OAuth pronto" : "LinkedIn por URL autorizada",
      mode: linkedinOauthReady ? "oauth" : "authorized-url",
    },
  });
}
