"use client";

import { ArrowRight, Brain, CalendarDays, CheckCircle2, FileText, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { LoginButton } from "@/components/auth/LoginButton";
import { ConnectorStatusSummary } from "@/components/connectors/ConnectorStatusSummary";
import { AuthorityDiagnostic } from "@/components/diagnostics/AuthorityDiagnostic";
import { defaultBusinessUnitId, getBusinessUnitDna } from "@/lib/business-units/dna";

export function HomeExperience() {
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user);
  const isAdmin = isPublicAdminEmail(session?.user?.email);
  const defaultBu = getBusinessUnitDna(defaultBusinessUnitId);

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
              {defaultBu.name}
            </span>
          </div>

          <section className="overflow-hidden rounded-lg border border-[var(--share-line)] bg-white shadow-[0_28px_90px_rgb(0_63_46_/_0.12)]">
            <div className="grid lg:grid-cols-[1fr_440px]">
              <div className="p-7 md:p-10">
                <div className="h-2 w-52 rounded-r-md bg-[var(--share-lime)]" />
                <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Diagnóstico comercial</p>
                <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight text-[var(--share-green-950)] md:text-5xl">
                  Leia sua autoridade no LinkedIn antes de o cliente decidir por você.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-600">
                  A plataforma cruza objetivo comercial, BU, provas e conteúdo do perfil para apontar pontuação, lacunas e próximos passos.
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  <HeroMetric icon={TrendingUp} label="Pontuação" value="0-100" />
                  <HeroMetric icon={Target} label="Foco" value="ICP" />
                  <HeroMetric icon={Brain} label="Inteligência" value="Gemini" />
                </div>
              </div>

              <aside className="share-green-panel flex min-h-[420px] flex-col justify-between p-7 text-white md:p-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-lime)]">Acesso com Google</p>
                  <h2 className="mt-3 text-3xl font-semibold leading-tight">Entre para iniciar o diagnóstico</h2>
                  <div className="mt-6 grid gap-3 text-sm leading-6 text-white/78">
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[var(--share-lime)]" />
                      Login Google para identificar o usuário
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[var(--share-lime)]" />
                      Inteligência Gemini disponibilizada pela Share AI
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[var(--share-lime)]" />
                      Conteúdos e abordagens são entregues como rascunhos para você usar
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
                Transforme objetivos comerciais em execução guiada.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-white/78">
                Selecione sua BU, conecte ou informe seu LinkedIn e receba uma leitura comercial clara sobre autoridade, lacunas e próximos passos.
              </p>
            </div>
            <div className="grid content-between rounded-lg border border-white/15 bg-white/10 p-5">
              <div>
                <p className="text-sm font-medium text-white/70">Cockpit desta semana</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <HeroMetric icon={TrendingUp} label="Pontuação" value="0-100" />
                  <HeroMetric icon={Target} label="Prioridade" value="Perfil" />
                  <HeroMetric icon={CalendarDays} label="Plano" value="30 dias" />
                  <HeroMetric icon={Brain} label="IA" value="Gemini" />
                </div>
              </div>
              <p className="mt-6 text-sm leading-6 text-white/70">Diagnóstico focado em percepção de cliente, não em empregabilidade.</p>
            </div>
          </div>
        </section>

        <ConnectorStatusSummary />
        <section className="grid gap-4 rounded-lg border border-[var(--share-line)] bg-white p-5 shadow-[0_18px_60px_rgb(0_63_46_/_0.08)] lg:grid-cols-[1fr_360px]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Próxima melhor ação</p>
            <h2 className="mt-1 text-3xl font-semibold text-[var(--share-green-950)]">Comece pelo diagnóstico de autoridade.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              Antes de gerar conteúdo, abordar decisores ou preparar reunião, a Share AI precisa entender como seu perfil sustenta a conversa comercial da BU selecionada.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-md bg-[#edf7eb] px-2 py-1 text-xs font-semibold text-[var(--share-green-900)]">Impacto alto</span>
              <span className="rounded-md bg-[#edf7eb] px-2 py-1 text-xs font-semibold text-[var(--share-green-900)]">Esforço baixo</span>
              <span className="rounded-md bg-[#edf7eb] px-2 py-1 text-xs font-semibold text-[var(--share-green-900)]">Base para conteúdo e rapport</span>
            </div>
          </div>
          <div className="grid content-center gap-3 rounded-md bg-[#fbfdf8] p-4">
            <a href="#diagnostico" className="share-button-primary inline-flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold">
              O que devo fazer agora?
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link href="/conteudo" className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--share-green-800)] bg-white px-4 py-3 text-sm font-semibold text-[var(--share-green-900)] hover:bg-[#edf7eb]">
              Criar oportunidade editorial
              <FileText className="h-4 w-4" />
            </Link>
          </div>
        </section>
        <section className="grid gap-4 rounded-lg border border-[var(--share-line)] bg-white p-5 shadow-[0_18px_60px_rgb(0_63_46_/_0.08)] md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Nova área</p>
            <h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">Mapa de decisores</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              Estruture a pesquisa de conta, encontre pessoas estratégicas e prepare rapport com fontes e confiança.
            </p>
          </div>
          <Link
            href="/mapa-decisores"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--share-green-800)] px-4 py-2 text-sm font-semibold text-[var(--share-green-900)] hover:bg-[#edf7eb]"
          >
            Abrir mapa
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
        {isAdmin ? (
          <section className="grid gap-4 rounded-lg border border-[var(--share-line)] bg-white p-5 shadow-[0_18px_60px_rgb(0_63_46_/_0.08)] md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Admin</p>
              <h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">DNA das Unidades de Negócio</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                Configure produtos, ICPs, personas, territórios, DNA editorial, afirmações e documentos sem transformar uma BU em produto fixo.
              </p>
            </div>
            <Link
              href="/admin/business-units"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--share-green-800)] px-4 py-2 text-sm font-semibold text-[var(--share-green-900)] hover:bg-[#edf7eb]"
            >
              Abrir Admin
              <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        ) : null}
        <div id="diagnostico">
          <AuthorityDiagnostic />
        </div>
      </div>
    </main>
  );
}

function isPublicAdminEmail(email?: string | null) {
  const adminEmails = (process.env.NEXT_PUBLIC_SHARE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLocaleLowerCase("pt-BR"))
    .filter(Boolean);
  return Boolean(email && adminEmails.includes(email.toLocaleLowerCase("pt-BR")));
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
