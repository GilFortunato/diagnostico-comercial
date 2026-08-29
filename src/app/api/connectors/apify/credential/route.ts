import { NextResponse } from "next/server";
import { z } from "zod";
import { clearUserApifyToken, getUserApifyToken, saveUserApifyToken } from "@/lib/connectors/userApifyCredential";

const credentialSchema = z.object({
  token: z.string().min(20),
});

export async function GET() {
  const token = await getUserApifyToken();
  return NextResponse.json({ connected: Boolean(token) });
}

export async function POST(request: Request) {
  const parsed = credentialSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Informe um token Apify válido." }, { status: 400 });
  }

  try {
    await validateApifyToken(parsed.data.token);
    await saveUserApifyToken(parsed.data.token);
    return NextResponse.json({ connected: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível conectar Apify." }, { status: 400 });
  }
}

export async function DELETE() {
  await clearUserApifyToken();
  return NextResponse.json({ connected: false });
}

async function validateApifyToken(token: string) {
  const response = await fetch("https://api.apify.com/v2/users/me", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("O token Apify foi recusado.");
  }
}
