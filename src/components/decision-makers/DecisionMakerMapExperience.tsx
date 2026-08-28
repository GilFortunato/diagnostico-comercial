"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Compass, KeyRound, Network, Search, ShieldAlert, Sparkles } from "lucide-react";
import { LoginButton } from "@/components/auth/LoginButton";
import { demoBusinessUnits } from "@/lib/tenancy/demo";
import { decisionMakerActorAudit, decisionMakerPipeline, recommendationLabel } from "@/lib/decision-makers/capabilityAudit";

type ConnectorStatus = {
  google: { connected: boolean; label: string };
  gemini: { connected: boolean; label: string; mode: string };
  linkedin: { connected: boolean; label: string; mode: string };
  apify: { connected: boolean; label: string };
};

const roleSignals = ["RH", "T&D", "People", "Learning", "Transformacao Digital", "Inovacao"];
const titleSignals = ["CHRO", "Head of People", "Head of Learning", "Diretor de RH", "Gerente de T&D", "Gerente de DO"];

export function DecisionMakerMapExperience() {
  const [status, setStatus] = useState<ConnectorStatus | null>(null);
  const [company, setCompany] = useState("Natura");
  const [businessUnitId, setBusinessUnitId] = useState("bu_prosper");
  const [objective, setObjective] = useState("Vender programa corporativo de desenvolvimento em IA");
  const [location, setLocation] = useState("");

  useEffect(() => {
    fetch("/api/connectors/status")
      .then((response) => response.json())
      .then((data: ConnectorStatus) => setStatus(data))
      .catch(() => setStatus(null));
  }, []);

  const selectedBu = useMemo(() => demoBusinessUnits.find((unit) => unit.id === businessUnitId) ?? demoBusinessUnits[0], [businessUnitId]);
  const readyCount = status ? [status.google.connected, status.gemini.connected, status.apify.connected].filter(Boolean).length : 0;
  const isReady = Boolean(status?.google.connected && status.gemini.connected && status.apify.connected);

  return (
    <main className="share-shell min-h-screen text-[var(--share-ink)]">
      <header className="border-b border-white/15 bg-[var(--share-green-950)]/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-3">
          <Link href="/" className="inline-flex items-center gap-3 text-white">
            <ArrowLeft className="h-4 w-4 text-[var(--share-lime)]" />
            <span className="share-wordmark text-4xl">share</span>
            <span className="pb-1 text-xs font-semibold uppercase leading-3 text-[var(--share-lime)]">AI</span>
          </Link>
          <LoginButton />
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8">
        <section className="relative overflow-hidden rounded-lg bg-[var(--share-green-950)] text-white shadow-[0_28px_90px_rgb(0_63_46_/_0.18)]">
          <div className="absolute right-6 top-8 h-48 w-48 rounded-full border border-white/10" />
          <div className="absolute right-20 top-20 h-24 w-24 rounded-full border border-[var(--share-lime)]/35" />
          <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-[1fr_360px]">
            <div className="relative">
              <div className="h-2 w-60 max-w-full rounded-r-md bg-[var(--share-lime)]" />
              <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-[var(--share-lime)]">Decision Maker Intelligence</p>
              <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">
                Mapa de decisores para abordar a conta certa pelo caminho certo.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/74">
                A Share AI cruza empresa, BU, sinais publicos e perfis profissionais para diferenciar poder, fit, acessibilidade e qualidade das evidencias.
              </p>
            </div>
            <div className="relative grid content-between rounded-lg border border-white/15 bg-white/10 p-5">
              <div>
                <p className="text-sm font-semibold text-white/74">Conexao para pesquisa</p>
                <div className="mt-4 grid gap-2">
                  <ConnectorMini label="Google" connected={Boolean(status?.google.connected)} />
                  <ConnectorMini label="Gemini" connected={Boolean(status?.gemini.connected)} />
                  <ConnectorMini label="Apify" connected={Boolean(status?.apify.connected)} />
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[var(--share-lime)]">{readyCount}/3 ativos</span>
                <Link href="/conectores" className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-[var(--share-green-950)] hover:bg-[var(--share-lime)]">
                  Configurar
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {!isReady ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-sm font-semibold">
                <ShieldAlert className="h-4 w-4" />
                Pesquisa real ainda depende de Gemini e Apify conectados.
              </span>
              <Link href="/conectores" className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-amber-100">
                Ativar conectores
              </Link>
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <aside className="share-card rounded-lg p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Buscar empresa</p>
            <h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">Briefing da conta</h2>
            <div className="mt-5 grid gap-4">
              <Field icon={<Building2 className="h-4 w-4" />} label="Empresa" value={company} onChange={setCompany} />
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-zinc-700">BU</span>
                <select
                  value={businessUnitId}
                  onChange={(event) => setBusinessUnitId(event.target.value)}
                  className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] px-3 py-2 text-sm outline-none focus:border-[var(--share-green-800)]"
                >
                  {demoBusinessUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>{unit.name}</option>
                  ))}
                </select>
              </label>
              <Field icon={<Sparkles className="h-4 w-4" />} label="Objetivo comercial" value={objective} onChange={setObjective} />
              <Field icon={<Compass className="h-4 w-4" />} label="Localizacao opcional" value={location} onChange={setLocation} placeholder="Brasil, Sao Paulo, remoto..." />
            </div>
            <div className="mt-5">
              <p className="text-sm font-semibold text-[var(--share-green-950)]">Areas de interesse</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {roleSignals.map((signal) => (
                  <span key={signal} className="rounded-md bg-[#edf7eb] px-2 py-1 text-xs font-semibold text-[var(--share-green-900)]">{signal}</span>
                ))}
              </div>
              <p className="mt-4 text-sm font-semibold text-[var(--share-green-950)]">Cargos de partida</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {titleSignals.map((signal) => (
                  <span key={signal} className="rounded-md border border-[var(--share-line)] bg-white px-2 py-1 text-xs font-medium text-zinc-600">{signal}</span>
                ))}
              </div>
            </div>
            <button
              type="button"
              disabled
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-500"
            >
              <Search className="h-4 w-4" />
              Encontrar pessoas estrategicas
            </button>
            <p className="mt-3 text-xs leading-5 text-zinc-500">Execucao sera liberada na proxima fase, apos adapter/capability de pesquisa com controle de custo.</p>
          </aside>

          <div className="grid gap-6">
            <section className="share-card rounded-lg p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Fluxo tecnico proposto</p>
                  <h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">Pesquisa progressiva, sem enriquecer tudo de uma vez</h2>
                </div>
                <span className="rounded-md px-3 py-2 text-sm font-semibold" style={{ backgroundColor: selectedBu.brandPack.surface, color: selectedBu.brandPack.primary }}>
                  {selectedBu.name}
                </span>
              </div>
              <div className="mt-5 grid gap-2 md:grid-cols-2">
                {decisionMakerPipeline.map((step, index) => (
                  <div key={step} className="flex items-center gap-3 rounded-md border border-[var(--share-line)] bg-[#fbfdf8] px-3 py-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--share-green-950)] text-xs font-semibold text-[var(--share-lime)]">{index + 1}</span>
                    <span className="text-sm font-medium text-zinc-700">{step}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="share-card rounded-lg p-5">
              <div className="flex items-center gap-2">
                <Network className="h-5 w-5 text-[var(--share-green-800)]" />
                <h2 className="text-2xl font-semibold text-[var(--share-green-950)]">Auditoria de capacidades</h2>
              </div>
              <div className="mt-5 grid gap-3">
                {decisionMakerActorAudit.map((row) => (
                  <article key={`${row.capability}-${row.actorId}`} className="rounded-md border border-[var(--share-line)] bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-950">{row.capability}</p>
                        <p className="mt-1 text-xs font-mono text-zinc-500">{row.actorId}</p>
                      </div>
                      <span className="rounded-md bg-[#edf7eb] px-2 py-1 text-xs font-semibold text-[var(--share-green-900)]">
                        {recommendationLabel(row.recommendation)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-700">{row.coverage}</p>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <AuditNote title="Limitacao" text={row.limitation} />
                      <AuditNote title="Custo/risco" text={row.costRisk} />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function ConnectorMini({ label, connected }: { label: string; connected: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-white/12 bg-white/8 px-3 py-2">
      <span className="inline-flex items-center gap-2 text-sm text-white/82">
        {connected ? <CheckCircle2 className="h-4 w-4 text-[var(--share-lime)]" /> : <KeyRound className="h-4 w-4 text-white/45" />}
        {label}
      </span>
      <span className={connected ? "text-xs font-semibold text-[var(--share-lime)]" : "text-xs font-semibold text-white/45"}>{connected ? "on" : "off"}</span>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  onChange,
  placeholder,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <span className="flex items-center gap-2 rounded-md border border-[var(--share-line)] bg-[#fbfdf8] px-3 py-2 focus-within:border-[var(--share-green-800)] focus-within:bg-white">
        <span className="text-[var(--share-green-800)]">{icon}</span>
        <input
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
        />
      </span>
    </label>
  );
}

function AuditNote({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md bg-[#fbfdf8] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">{title}</p>
      <p className="mt-1 text-xs leading-5 text-zinc-600">{text}</p>
    </div>
  );
}
