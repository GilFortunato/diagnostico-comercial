import { NextResponse } from "next/server";
import { z } from "zod";
import { clearUserGeminiApiKey, getUserGeminiApiKey, saveUserGeminiApiKey } from "@/lib/connectors/userGeminiCredential";

const credentialSchema = z.object({
  apiKey: z.string().min(20),
});

export async function GET() {
  const apiKey = await getUserGeminiApiKey();
  return NextResponse.json({ connected: Boolean(apiKey) });
}

export async function POST(request: Request) {
  const parsed = credentialSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Informe uma chave Gemini válida." }, { status: 400 });
  }

  try {
    await validateGeminiApiKey(parsed.data.apiKey);
    await saveUserGeminiApiKey(parsed.data.apiKey);
    return NextResponse.json({ connected: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível conectar Gemini." }, { status: 400 });
  }
}

export async function DELETE() {
  await clearUserGeminiApiKey();
  return NextResponse.json({ connected: false });
}

async function validateGeminiApiKey(apiKey: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("A chave Gemini foi recusada pelo Google.");
  }
}
