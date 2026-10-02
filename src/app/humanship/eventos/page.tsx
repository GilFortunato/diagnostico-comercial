import { AppHeader } from "@/components/app/AppHeader";
import { HumanshipAgendaManager } from "@/components/humanship/HumanshipAgendaManager";
import { isAdminEmail } from "@/lib/auth/admin";
import { getUserModuleAccess } from "@/lib/auth/modulePermissions";
import { getSessionUser } from "@/lib/auth/sessionUser";

export default async function HumanshipEventsPage() {
  const user = await getSessionUser();
  const allowed = user ? await getUserModuleAccess(user, "humanship.r1ship").catch(() => false) : false;

  if (!user || !allowed) {
    return (
      <main className="share-shell min-h-screen px-5 py-16 text-[var(--share-ink)]">
        <section className="mx-auto max-w-xl border border-[var(--share-line)] bg-white p-8">
          <p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Humanship · Eventos & Comunidade</p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--share-green-950)]">Acesso não liberado</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">Entre com sua conta ou peça a um administrador para liberar o módulo Humanship.</p>
        </section>
      </main>
    );
  }

  return (
    <>
      <AppHeader isAdmin={isAdminEmail(user.email)} />
      <HumanshipAgendaManager />
    </>
  );
}
