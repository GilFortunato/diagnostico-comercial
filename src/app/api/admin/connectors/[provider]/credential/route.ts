import { NextResponse } from "next/server";
import { z } from "zod";
import { hasAdminSession } from "@/lib/auth/adminRequest";
import { getPlatformCredentialStatus, removePlatformCredential, replacePlatformCredential } from "@/lib/connectors/platformCredentialService";
import type { PlatformProvider } from "@/lib/connectors/platformCredentialCore";

const credentialSchema = z.object({ credential: z.string().trim().min(8).max(512) });

export async function GET(_request: Request, context: { params: Promise<{ provider: string }> }) {
  if (!(await hasAdminSession())) return forbidden();
  const provider = parseProvider((await context.params).provider);
  if (!provider) return notFound();
  try {
    return NextResponse.json(await getPlatformCredentialStatus(provider));
  } catch {
    return unavailable();
  }
}

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  if (!(await hasAdminSession())) return forbidden();
  const provider = parseProvider((await context.params).provider);
  if (!provider) return notFound();

  const parsed = credentialSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Informe uma credencial válida para testar." }, { status: 400 });
  }

  try {
    const result = await replacePlatformCredential(provider, parsed.data.credential);
    return NextResponse.json(result, { status: result.activated ? 200 : 422 });
  } catch {
    return unavailable();
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ provider: string }> }) {
  if (!(await hasAdminSession())) return forbidden();
  const provider = parseProvider((await context.params).provider);
  if (!provider) return notFound();
  try {
    return NextResponse.json(await removePlatformCredential(provider));
  } catch {
    return unavailable();
  }
}

function parseProvider(provider: string): PlatformProvider | null {
  return provider === "gemini" || provider === "apify" ? provider : null;
}

function forbidden() {
  return NextResponse.json({ error: "Acesso restrito à administração." }, { status: 403 });
}

function notFound() {
  return NextResponse.json({ error: "Conector não encontrado." }, { status: 404 });
}

function unavailable() {
  return NextResponse.json({ error: "A configuração está temporariamente indisponível." }, { status: 503 });
}
