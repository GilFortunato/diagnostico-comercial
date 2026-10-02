import { AppHeader } from "@/components/app/AppHeader";
import { DecisionMakerMapExperienceV2 } from "@/components/decision-makers/DecisionMakerMapExperienceV2";
import { isAdminUser } from "@/lib/auth/admin";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { getUserModuleAccess } from "@/lib/auth/modulePermissions";

export default async function DecisionMakerMapPage() {
  const user = await getSessionUser();
  const allowed = user ? await getUserModuleAccess(user, "decision.makers").catch(() => false) : false;

  if (!user || !allowed) {
    return (
      <main className="share-shell min-h-screen px-5 py-16 text-[var(--share-ink)]">
        <section className="mx-auto max-w-xl border border-[var(--share-line)] bg-white p-8">
          <p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">B2B Hunting</p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--share-green-950)]">Acesso não liberado</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">Sua conta ainda não tem acesso ao B2B Hunting.</p>
        </section>
      </main>
    );
  }

  return (
    <>
      <AppHeader isAdmin={isAdminUser(user)} />
      <DecisionMakerMapExperienceV2 />
    </>
  );
}
