import { redirect } from "next/navigation";
import { ScoutHeader } from "@/components/scout/ScoutHeader";
import { TrendIntelligenceClient } from "@/components/scout/TrendIntelligenceClient";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { getUserModuleAccess } from "@/lib/auth/modulePermissions";

export default async function ShareTrendIntelligencePage() {
  const user = await getSessionUser();
  if (!user) redirect("/share-scout/login?next=/sharetrendintelligence");

  const allowed = await getUserModuleAccess(user, "creative.trend-intelligence");
  if (!allowed) return <AccessDenied />;

  return (
    <main className="share-shell min-h-screen text-[var(--share-ink)]">
      <ScoutHeader active="trend" />
      <div className="mx-auto max-w-7xl px-5 py-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Marketing Intelligence</p>
            <h1 className="mt-2 text-4xl font-semibold text-[var(--share-green-950)]">MKT Scout</h1>
            <p className="mt-2 max-w-3xl text-zinc-600">Descubra sinais recentes e transforme tendências em pautas, campanhas, conteúdo e direção visual.</p>
          </div>
          <span className="rounded-full border border-[var(--share-line)] bg-white px-4 py-2 text-xs font-semibold text-[var(--share-green-800)]">/sharetrendintelligence</span>
        </div>
        <TrendIntelligenceClient />
      </div>
    </main>
  );
}

function AccessDenied() {
  return (
    <main className="share-shell grid min-h-screen place-items-center p-6">
      <div className="share-card max-w-lg rounded-2xl p-8">
        <h1 className="text-2xl font-semibold text-[var(--share-green-950)]">Módulo ainda não liberado</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">Seu login está ativo, mas sua conta ainda não tem acesso ao MKT Scout.</p>
      </div>
    </main>
  );
}
