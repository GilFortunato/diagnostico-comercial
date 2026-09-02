import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/auth/adminRequest";
import { testPlatformCredential } from "@/lib/connectors/platformCredentialService";
import type { PlatformProvider } from "@/lib/connectors/platformCredentialCore";

export async function POST(_request: Request, context: { params: Promise<{ provider: string }> }) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Acesso restrito à administração." }, { status: 403 });
  }
  const provider = parseProvider((await context.params).provider);
  if (!provider) return NextResponse.json({ error: "Conector não encontrado." }, { status: 404 });

  try {
    const result = await testPlatformCredential(provider);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch {
    return NextResponse.json({ error: "A configuração está temporariamente indisponível." }, { status: 503 });
  }
}

function parseProvider(provider: string): PlatformProvider | null {
  return provider === "gemini" || provider === "apify" || provider === "manus" ? provider : null;
}
