import { Brain, CalendarDays, Target, TrendingUp } from "lucide-react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app/AppHeader";
import { ConnectorStatusSummary } from "@/components/connectors/ConnectorStatusSummary";
import { AuthorityDiagnostic } from "@/components/diagnostics/AuthorityDiagnostic";
import { isAdminEmail } from "@/lib/auth/admin";
import { getUserModuleAccess } from "@/lib/auth/modulePermissions";
import { getSessionUser } from "@/lib/auth/sessionUser";

export default async function DiagnosticoPage() {
  const user = await getSessionUser();
  if (!user) redirect("/");

  const allowed = await getUserModuleAccess(user, "authority.personal").catch(() => false);
  if (!allowed) {
    return (
      <main className="share-shell grid min-h-screen place-items-center p-6">
        <div className="share-card max-w-lg rounded-2xl p-8">
          <h1 className="text-2xl font-semibold text-[var(--share-green-950)]">Diagnóstico ainda não liberado</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">Seu login está ativo, mas sua conta ainda não tem acesso ao Diagnóstico Comercial.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="share-shell min-h-screen text-[var(--share-ink)]">
      <AppHeader isAdmin={isAdminEmail(user.email)} />
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8">
        <section className="share-green-panel overflow-hidden rounded-2xl text-white">
          <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-[1fr_420px]">
            <div>
              <div className="h-2 w-64 max-w-full rounded-r bg-[var(--share-lime)]" />
              <p className="mt-8 text-sm font-semibold uppercase tracking-wide text-[var(--share-lime)]">Diagnóstico Comercial</p>
              <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">Transforme posicionamento em execução guiada.</h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-white/78">Conecte ou informe seu LinkedIn e receba uma leitura clara sobre autoridade, lacunas e próximos passos.</p>
            </div>
            <div className="grid content-between rounded-xl border border-white/15 bg-white/10 p-5">
              <div>
                <p className="text-sm font-medium text-white/70">Seu workspace</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <HeroMetric icon={TrendingUp} label="Pontuação" value="0-100" />
                  <HeroMetric icon={Target} label="Prioridade" value="Perfil" />
                  <HeroMetric icon={CalendarDays} label="Plano" value="30 dias" />
                  <HeroMetric icon={Brain} label="IA" value="Share AI" />
                </div>
              </div>
              <p className="mt-6 text-sm leading-6 text-white/70">O Diagnóstico agora vive em um workspace próprio. A Home concentra a entrada para todos os produtos Share AI.</p>
            </div>
          </div>
        </section>

        <ConnectorStatusSummary />
        <AuthorityDiagnostic />
      </div>
    </main>
  );
}

function HeroMetric({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-4 text-[var(--share-green-950)]">
      <Icon className="h-4 w-4 text-[var(--share-green-700)]" />
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
