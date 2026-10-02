import Link from "next/link";
import { redirect } from "next/navigation";
import { ScoutHeader } from "@/components/scout/ScoutHeader";
import { BriefingMoodboardClient } from "@/components/scout/BriefingMoodboardClient";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { getUserModuleAccess } from "@/lib/auth/modulePermissions";

export default async function BriefingMoodboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/share-scout/login?next=%2Fsharemoodboard");
  const allowed = await getUserModuleAccess(user, "creative.trend-intelligence");
  if (!allowed) return <AccessDenied />;

  return (
    <main className="share-shell min-h-screen text-[var(--share-ink)]">
      <ScoutHeader active="moodboard" />
      <div className="mx-auto max-w-7xl px-5 py-7 md:py-9">
        <div className="mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--share-green-800)]">MKT Scout · Projeto de Design</p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-[var(--share-green-950)]">Moodboard</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">Do briefing à direção visual: transforme contexto em rotas criativas, referências rastreáveis e um painel preliminar conectado ao Visual Scout.</p>
        </div>
        <BriefingMoodboardClient />
      </div>
    </main>
  );
}

function AccessDenied() {
  return <main className="share-shell grid min-h-screen place-items-center p-6"><div className="share-card max-w-lg rounded-2xl p-8"><h1 className="text-2xl font-semibold text-[var(--share-green-950)]">Módulo ainda não liberado</h1><p className="mt-3 text-sm leading-6 text-zinc-600">Seu login está ativo, mas sua conta ainda não tem acesso ao MKT Scout.</p><Link href="/" className="mt-5 inline-block text-sm font-semibold text-[var(--share-green-800)] underline underline-offset-4">Voltar ao Share Hub</Link></div></main>;
}
