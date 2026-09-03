import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { testPlatformCredential } from "@/lib/connectors/platformCredentialService";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.active === false) {
    return NextResponse.json({ error: "Sua sessão não está ativa." }, { status: 401 });
  }

  const [gemini, apify, manus] = await Promise.all([
    testPlatformCredential("gemini"),
    testPlatformCredential("apify"),
    testPlatformCredential("manus"),
  ]);

  const intelligenceAvailable = gemini.ok;
  const publicSourcesAvailable = manus.ok || apify.ok;
  const ok = intelligenceAvailable && publicSourcesAvailable;

  return NextResponse.json({
    ok,
    intelligenceAvailable,
    publicSourcesAvailable,
    message: ok
      ? "Conexões restabelecidas e validadas."
      : "A verificação terminou, mas um dos recursos ainda está indisponível.",
  }, { status: ok ? 200 : 503 });
}
