import { NextResponse } from "next/server";

export async function GET() {
  const googleConnected = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const geminiConnected = Boolean(process.env.GEMINI_API_KEY);
  const linkedinOauthReady = Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);

  return NextResponse.json({
    google: {
      connected: googleConnected,
      label: googleConnected ? "Google Login conectado" : "Google Login pendente",
    },
    gemini: {
      connected: geminiConnected,
      label: geminiConnected ? "Gemini conectado" : "Conectar Gemini",
      mode: geminiConnected ? "ai-provider" : "missing-env",
    },
    linkedin: {
      connected: linkedinOauthReady,
      label: linkedinOauthReady ? "LinkedIn OAuth pronto" : "LinkedIn por URL autorizada",
      mode: linkedinOauthReady ? "oauth" : "authorized-url",
    },
  });
}
