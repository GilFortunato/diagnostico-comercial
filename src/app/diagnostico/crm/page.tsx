import { AppHeader } from "@/components/app/AppHeader";
import { CrmWorkspace } from "@/components/crm/CrmWorkspace";
import { isAdminUser } from "@/lib/auth/admin";
import { authorizeCrm } from "@/lib/crm/http";
import { getUserModuleAccess } from "@/lib/auth/modulePermissions";

export const metadata = { title: "CRM Humanship | Share AI" };

export default async function CrmPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const access = await authorizeCrm();
  if (!access.ok) {
    return <>
      <AppHeader />
      <main className="share-shell min-h-screen p-8">
        <section className="share-card mx-auto max-w-lg rounded-xl p-8">
          <h1 className="text-2xl font-semibold">CRM Humanship</h1>
          <p className="mt-3 text-sm text-zinc-600">{access.error}</p>
        </section>
      </main>
    </>;
  }
  const [{ lead }, canHunt] = await Promise.all([searchParams, getUserModuleAccess(access.user, "decision.makers").catch(() => false)]);
  return <>
    <AppHeader isAdmin={isAdminUser(access.user)} canUseCrm />
    <CrmWorkspace initialLead={typeof lead === "string" ? lead : undefined} canHunt={canHunt} />
  </>;
}
