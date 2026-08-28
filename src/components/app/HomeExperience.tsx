"use client";

import { CalendarDays, ShieldCheck, Target, TrendingUp } from "lucide-react";
import { useSession } from "next-auth/react";
import { LoginButton } from "@/components/auth/LoginButton";
import { AuthorityDiagnostic } from "@/components/diagnostics/AuthorityDiagnostic";

export function HomeExperience() {
  const { data: session, status } = useSession();
  const isAuthenticated = Boolean(session?.user);

  if (!isAuthenticated) {
    return (
      <main className="share-shell min-h-screen text-[var(--share-ink)]">
        <div className="mx-auto grid min-h-screen max-w-7xl content-center gap-8 px-5 py-8 lg:grid-cols-[1fr_420px]">
          <section className="share-green-panel overflow-hidden rounded-lg p-7 text-white md:p-10">
            <div className="h-2 w-64 max-w-full rounded-r-md bg-[var(--share-lime)]" />
            <div className="mt-10 flex items-end gap-3">
              <span className="share-wordmark text-6xl md:text-7xl">share</span>
              <span className="pb-2 text-sm font-semibold uppercase leading-3 text-[var(--share-lime)]">AI</span>
            </div>
            <p className="mt-7 text-sm font-semibold uppercase tracking-wide text-[var(--share-lime)]">Prosper Digital Skills</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight md:text-6xl">
              Diagnostico de autoridade comercial para quem vende conhecimento.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/78">
              Entre com Google para acessar seu cockpit, selecionar a BU e iniciar a leitura do perfil profissional.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <HeroMetric icon={TrendingUp} label="Score" value="0-100" />
              <HeroMetric icon={Target} label="Foco" value="Autoridade" />
              <HeroMetric icon={ShieldCheck} label="Controle" value="Humano" />
            </div>
          </section>

          <aside className="share-card flex flex-col justify-between rounded-lg p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Acesso seguro</p>
              <h2 className="mt-2 text-3xl font-semibold leading-tight text-[var(--share-green-950)]">Comece com sua conta Google</h2>
              <p className="mt-4 text-sm leading-6 text-zinc-600">
                O LinkedIn entra depois, dentro do diagnostico, para manter login e autorizacoes separados.
              </p>
            </div>
            <div className="mt-8 grid gap-4">
              <LoginButton variant="light" />
              {status === "loading" ? null : (
                <p className="text-xs leading-5 text-zinc-500">
                  O acesso Google identifica voce na plataforma. Conexoes com IA, LinkedIn ou outras fontes exigem consentimento proprio.
                </p>
              )}
            </div>
          </aside>
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
