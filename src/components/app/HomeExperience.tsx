"use client";

import { ArrowRight, CalendarDays, CheckCircle2, ShieldCheck, Target, TrendingUp } from "lucide-react";
import { useSession } from "next-auth/react";
import { LoginButton } from "@/components/auth/LoginButton";
import { ConnectorReadiness } from "@/components/connectors/ConnectorReadiness";
import { AuthorityDiagnostic } from "@/components/diagnostics/AuthorityDiagnostic";

export function HomeExperience() {
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user);

  if (!isAuthenticated) {
    return (
      <main className="share-shell min-h-screen text-[var(--share-ink)]">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-5 py-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-end gap-3">
              <span className="share-wordmark text-5xl text-[var(--share-green-950)]">share</span>
              <span className="pb-1 text-xs font-semibold uppercase text-[var(--share-green-800)]">AI</span>
            </div>
            <span className="hidden rounded-md border border-[var(--share-line)] bg-white px-3 py-2 text-sm font-medium text-zinc-600 sm:inline-flex">
              Prosper Digital Skills
            </span>
          </div>

          <section className="overflow-hidden rounded-lg border border-[var(--share-line)] bg-white shadow-[0_28px_90px_rgb(0_63_46_/_0.12)]">
            <div className="grid lg:grid-cols-[1fr_440px]">
              <div className="p-7 md:p-10">
                <div className="h-2 w-52 rounded-r-md bg-[var(--share-lime)]" />
                <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Diagnostico Comercial</p>
                <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight text-[var(--share-green-950)] md:text-5xl">
                  Leia sua autoridade no LinkedIn antes do cliente decidir por voce.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-600">
                  A plataforma cruza objetivo comercial, BU, provas e conteudo do perfil para apontar score, lacunas e proximos passos.
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  <HeroMetric icon={TrendingUp} label="Score" value="0-100" />
                  <HeroMetric icon={Target} label="Foco" value="ICP" />
                  <HeroMetric icon={ShieldCheck} label="Aprovacao" value="Humana" />
                </div>
              </div>

              <aside className="share-green-panel flex min-h-[420px] flex-col justify-between p-7 text-white md:p-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-lime)]">Acesso seguro</p>
                  <h2 className="mt-3 text-3xl font-semibold leading-tight">Entre para iniciar o diagnostico</h2>
                  <div className="mt-6 grid gap-3 text-sm leading-6 text-white/78">
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[var(--share-lime)]" />
                      Login Google para identificar o usuario
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[var(--share-lime)]" />
                      LinkedIn e IA com autorizacoes separadas
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[var(--share-lime)]" />
                      Nada e publicado sem revisao humana
                    </span>
                  </div>
                </div>
                <div className="mt-8 grid gap-4">
                  <LoginButton />
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--share-lime)]">
                    Acessar cockpit <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </aside>
            </div>
          </section>
        </div>
      </main>
    );
  }

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
                Transforme objetivos comerciais em execucao guiada.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-white/78">
                Selecione sua BU, conecte ou informe seu LinkedIn e receba uma leitura comercial clara sobre autoridade, lacunas e proximos passos.
              </p>
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
              <p className="mt-6 text-sm leading-6 text-white/70">Diagnostico focado em percepcao de cliente, nao em empregabilidade.</p>
            </div>
          </div>
        </section>

        <ConnectorReadiness />
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
