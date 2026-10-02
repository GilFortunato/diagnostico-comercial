import { AppHeader } from "@/components/app/AppHeader";
import { WhatsGeneratorExperience } from "@/components/whats-generator/WhatsGeneratorExperience";
import { isAdminUser } from "@/lib/auth/admin";
import { getUserModuleAccess } from "@/lib/auth/modulePermissions";
import { getSessionUser } from "@/lib/auth/sessionUser";

export default async function WhatsGeneratorPage() {
  const user = await getSessionUser();
  const allowed = user ? await getUserModuleAccess(user, "communication.whats-generator").catch(() => false) : false;

  if (!user || !allowed) {
    return (
      <main className="share-shell min-h-screen px-5 py-16 text-[var(--share-ink)]">
        <section className="mx-auto max-w-xl rounded-2xl border border-[var(--share-line)] bg-white p-8">
          <p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Gerador Whats</p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--share-green-950)]">Acesso não liberado</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">Sua conta ainda não tem acesso ao Gerador Whats.</p>
        </section>
      </main>
    );
  }

  return (
    <>
      <AppHeader isAdmin={isAdminUser(user)} />
      <WhatsGeneratorExperience />
    </>
  );
}
