import { AppHeader } from "@/components/app/AppHeader";
import { GoogleSheetsConnectButton } from "@/components/humanship/GoogleSheetsConnectButton";
import { HumanshipR1ShipExperience } from "@/components/humanship/HumanshipR1ShipExperience";
import { isAdminEmail } from "@/lib/auth/admin";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { getUserModuleAccess } from "@/lib/auth/modulePermissions";
import { getHumanshipGoogleConnectionStatus } from "@/lib/humanship/googleAuthorization";

export default async function HumanshipPage() {
  const user = await getSessionUser();
  const allowed = user ? await getUserModuleAccess(user, "humanship.r1ship").catch(() => false) : false;
  if (!user || !allowed) {
    return <main className="share-shell min-h-screen px-5 py-16 text-[var(--share-ink)]"><section className="mx-auto max-w-xl border border-[var(--share-line)] bg-white p-8"><p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Humanship</p><h1 className="mt-2 text-3xl font-semibold text-[var(--share-green-950)]">Acesso não liberado</h1><p className="mt-3 text-sm leading-6 text-zinc-600">Entre com sua conta ou peça a um administrador para liberar o módulo R1 Ship.</p></section></main>;
  }

  const googleSheets = await getHumanshipGoogleConnectionStatus(user.id).catch(() => ({ connected: false, connectedAt: null, updatedAt: null }));

  return <>
    <AppHeader isAdmin={isAdminEmail(user.email)} />
    <div className="mx-auto max-w-7xl px-5 pt-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--share-line)] bg-white p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Google Sheets · opcional</p>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            {googleSheets.connected
              ? "Conectado com acesso somente leitura. O login normal da Share AI não depende dessa permissão."
              : "Autorize somente se quiser sincronizar uma planilha do Google. O upload em Excel continua disponível sem essa conexão."}
          </p>
        </div>
        <GoogleSheetsConnectButton email={user.email} connected={googleSheets.connected} />
      </section>
    </div>
    <HumanshipR1ShipExperience accountName={user.name || user.email || "Usuário"} />
  </>;
}
