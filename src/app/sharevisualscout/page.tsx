import { redirect } from "next/navigation";
import { ScoutHeader } from "@/components/scout/ScoutHeader";
import { VisualScoutClient } from "@/components/scout/VisualScoutClient";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { getUserModuleAccess } from "@/lib/auth/modulePermissions";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ShareVisualScoutPage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/share-scout/login?next=/sharevisualscout");

  const allowed = await getUserModuleAccess(user, "creative.visual-scout");
  if (!allowed) return <AccessDenied />;

  const params = await searchParams;
  const queryValue = params.q;
  const initialQuery = Array.isArray(queryValue) ? queryValue[0] ?? "" : queryValue ?? "";

  return (
    <main className="share-shell min-h-screen text-[var(--share-ink)]">
      <ScoutHeader active="visual" />
      <div className="mx-auto max-w-7xl px-5 py-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Share Scout</p>
            <h1 className="mt-2 text-4xl font-semibold text-[var(--share-green-950)]">Share Visual Scout</h1>
            <p className="mt-2 max-w-3xl text-zinc-600">Encontre imagens que combinam com o briefing — não só com a palavra-chave.</p>
          </div>
          <span className="rounded-full border border-[var(--share-line)] bg-white px-4 py-2 text-xs font-semibold text-[var(--share-green-800)]">/sharevisualscout</span>
        </div>
        <div className="mt-8"><VisualScoutClient initialQuery={initialQuery} /></div>
      </div>
    </main>
  );
}

function AccessDenied() {
  return (
    <main className="share-shell grid min-h-screen place-items-center p-6">
      <div className="share-card max-w-lg rounded-2xl p-8">
        <h1 className="text-2xl font-semibold text-[var(--share-green-950)]">Módulo ainda não liberado</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">Seu login está ativo, mas sua conta ainda não tem acesso ao Share Visual Scout.</p>
      </div>
    </main>
  );
}
