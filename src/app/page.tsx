import { CalendarDays, ShieldCheck, Target, TrendingUp } from "lucide-react";
import { LoginButton } from "@/components/auth/LoginButton";
import { AuthorityDiagnostic } from "@/components/diagnostics/AuthorityDiagnostic";

export default function Home() {
  return (
    <main className="share-shell min-h-screen text-[var(--share-ink)]">
      <header className="sticky top-0 z-20 border-b border-white/15 bg-[var(--share-green-950)]/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-3">
          <div>
            <div className="flex items-end gap-3">
              <span className="share-wordmark text-4xl">share</span>
              <span className="pb-1 text-xs font-semibold uppercase leading-3 text-[var(--share-lime)]">AI</span>
            </div>
            <p className="mt-1 text-sm text-white/72">Sistema operacional de produtividade comercial</p>
          </div>
          <LoginButton />
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8">
        <section className="share-green-panel overflow-hidden rounded-lg text-white">
          <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-[1fr_420px]">
            <div>
              <div className="h-2 w-64 max-w-full rounded-r-md bg-[var(--share-lime)]" />
              <p className="mt-8 text-sm font-semibold uppercase tracking-wide text-[var(--share-lime)]">Share People Hub</p>
              <h2 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">
                Transforme objetivos comerciais em execução guiada.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-white/78">
                Entre com Google, selecione sua BU, informe a URL do LinkedIn e receba uma leitura comercial clara sobre autoridade, lacunas e próximos passos.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <button className="share-button-primary rounded-md px-4 py-2 text-sm font-semibold" type="button">
                  Começar diagnóstico
                </button>
                <button className="rounded-md border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10" type="button">
                  Ver histórico
                </button>
              </div>
            </div>
            <div className="grid content-between rounded-lg border border-white/15 bg-white/10 p-5">
              <div>
                <p className="text-sm font-medium text-white/70">Cockpit desta semana</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <HeroMetric icon={TrendingUp} label="Score" value="0-100" />
                  <HeroMetric icon={Target} label="Prioridade" value="Perfil" />
                  <HeroMetric icon={CalendarDays} label="Plano" value="30 dias" />
                  <HeroMetric icon={ShieldCheck} label="Aprovacao" value="Ativa" />
                </div>
              </div>
              <p className="mt-6 text-sm leading-6 text-white/70">Diagnóstico focado em percepção de cliente, não em empregabilidade.</p>
            </div>
          </div>
        </section>

        <AuthorityDiagnostic />
      </div>
    </main>
  );
}

function HeroMetric({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-md bg-white p-4 text-[var(--share-green-950)]">
      <Icon className="h-4 w-4 text-[var(--share-green-700)]" />
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
