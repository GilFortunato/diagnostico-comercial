import { AppHeader } from "@/components/app/AppHeader";
import { HrHuntingExperience } from "@/components/hr-hunting/HrHuntingExperience";
import { isAdminEmail } from "@/lib/auth/admin";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { getUserModuleAccess } from "@/lib/auth/modulePermissions";

export default async function HrHuntingPage() {
  const user = await getSessionUser();
  const allowed = user ? await getUserModuleAccess(user, "hr.hunting").catch(() => false) : false;
  if (!allowed) return <main className="share-shell min-h-screen px-5 py-16 text-[var(--share-ink)]"><section className="mx-auto max-w-xl border border-[var(--share-line)] bg-white p-8"><p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">HR Hunting</p><h1 className="mt-2 text-3xl font-semibold text-[var(--share-green-950)]">Acesso não liberado</h1><p className="mt-3 text-sm leading-6 text-zinc-600">Entre com sua conta ou peça a um administrador para liberar o módulo HR Hunting.</p></section></main>;
  return <><AppHeader isAdmin={isAdminEmail(user?.email)} /><HrHuntingExperience /></>;
}
