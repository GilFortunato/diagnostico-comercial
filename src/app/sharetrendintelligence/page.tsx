import { redirect } from "next/navigation";
import Link from "next/link";
import { ScoutHeader } from "@/components/scout/ScoutHeader";
import { TrendIntelligenceClient } from "@/components/scout/TrendIntelligenceClient";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { getUserModuleAccess } from "@/lib/auth/modulePermissions";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ShareTrendIntelligencePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const destination = new URLSearchParams();
  if (typeof params.generation === "string") destination.set("generation", params.generation.slice(0, 150));
  if (typeof params.q === "string") destination.set("q", params.q.slice(0, 120));
  const returnPath = `/sharetrendintelligence${destination.size ? `?${destination}` : ""}`;
  const user = await getSessionUser();
  if (!user) redirect(`/share-scout/login?next=${encodeURIComponent(returnPath)}`);
  const allowed = await getUserModuleAccess(user, "creative.trend-intelligence");
  if (!allowed) return <AccessDenied />;
  const generationId = typeof params.generation === "string" ? params.generation.slice(0, 150) : undefined;
  const initialQuery = typeof params.q === "string" ? params.q.slice(0, 120) : undefined;

  return (
    <main className="share-shell min-h-screen text-[var(--share-ink)]">
      <ScoutHeader active="trend" />
      <div className="mx-auto max-w-7xl px-5 py-7 md:py-9">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--share-green-800)]">Inteligência de marketing</p>
            <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-[var(--share-green-950)]">MKT Scout</h1>
          </div>
          <p className="text-xs text-[#64765e]">Explore o agora. Crie com contexto.</p>
        </div>
        <TrendIntelligenceClient initialGenerationId={generationId} initialQuery={initialQuery} />
      </div>
    </main>
  );
}

function AccessDenied() {
  return <main className="share-shell grid min-h-screen place-items-center p-6"><div className="share-card max-w-lg rounded-2xl p-8"><h1 className="text-2xl font-semibold text-[var(--share-green-950)]">Módulo ainda não liberado</h1><p className="mt-3 text-sm leading-6 text-zinc-600">Seu login está ativo, mas sua conta ainda não tem acesso ao MKT Scout.</p><Link href="/" className="mt-5 inline-block text-sm font-semibold text-[var(--share-green-800)] underline underline-offset-4">Voltar ao Share Hub</Link></div></main>;
}
