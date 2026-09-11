import { AppHeader } from "@/components/app/AppHeader";
import { HumanshipR1ShipExperience } from "@/components/humanship/HumanshipR1ShipExperience";
import { isAdminEmail } from "@/lib/auth/admin";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { getUserModuleAccess } from "@/lib/auth/modulePermissions";

export default async function HumanshipPage() {
  const user = await getSessionUser();
  const allowed = user ? await getUserModuleAccess(user, "humanship.r1ship").catch(() => false) : false;
  if (!allowed) {
    return <main className="share-shell min-h-screen px-5 py-16 text-[var(--share-ink)]"><section className="mx-auto max-w-xl border border-[var(--share-line)] bg-white p-8"><p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Humanship</p><h1 className="mt-2 text-3xl font-semibold text-[var(--share-green-950)]">Acesso não liberado</h1><p className="mt-3 text-sm leading-6 text-zinc-600">Entre com sua conta ou peça a um administrador para liberar o módulo R1 Ship.</p></section></main>;
  }
  return <><AppHeader isAdmin={isAdminEmail(user?.email)} /><HumanshipR1ShipExperience accountName={user?.name || user?.email || "Usuário"} /></>;
}
