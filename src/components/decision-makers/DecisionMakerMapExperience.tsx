"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Compass, KeyRound, Search, ShieldAlert, Sparkles } from "lucide-react";
import { LoginButton } from "@/components/auth/LoginButton";
import { demoBusinessUnits } from "@/lib/tenancy/demo";
import { defaultBusinessUnitId, getBusinessUnitDna } from "@/lib/business-units/dna";
import { decisionMakerPipeline } from "@/lib/decision-makers/capabilityAudit";
import type { DecisionMakerResult } from "@/lib/decision-makers/search";
import { confidenceLabel } from "@/lib/copy/editorial";

type ConnectorStatus = {
  google: { connected: boolean; label: string };
  intelligence: { available: boolean; label: string };
  publicSources: { available: boolean; label: string };
};

export function DecisionMakerMapExperience() {
  const [status, setStatus] = useState<ConnectorStatus | null>(null);
  const [company, setCompany] = useState("Natura");
  const [businessUnitId, setBusinessUnitId] = useState(defaultBusinessUnitId);
  const [objective, setObjective] = useState(buildDecisionMakerObjective(defaultBusinessUnitId));
  const [location, setLocation] = useState("");
  const [result, setResult] = useState<DecisionMakerResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/connectors/status")
      .then((response) => response.json())
      .then((data: ConnectorStatus) => setStatus(data))
      .catch(() => setStatus(null));
  }, []);

  const selectedBu = useMemo(() => demoBusinessUnits.find((unit) => unit.id === businessUnitId) ?? demoBusinessUnits[0], [businessUnitId]);
  const roleSignals = selectedBu.icps[0]?.buyingAreas ?? selectedBu.positioning.recommendedTerms.slice(0, 6);
  const titleSignals = selectedBu.icps[0]?.decisionMakers ?? selectedBu.personas.map((persona) => persona.name);
  const readyCount = status ? [status.google.connected, status.intelligence.available, status.publicSources.available].filter(Boolean).length : 0;
  const isReady = Boolean(status?.google.connected && status.intelligence.available && status.publicSources.available);
  const canSearch = company.trim().length >= 2 && objective.trim().length >= 10;

  async function runSearch() {
    if (!canSearch) {
      setError("Informe empresa e objetivo comercial antes de buscar decisores.");
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const response = await fetch("/api/decision-makers/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, businessUnitId, objective, location }),
      });
      const payload = (await response.json()) as DecisionMakerResult | { error?: string };

      if (!response.ok) {
        throw new Error("error" in payload && payload.error ? payload.error : "Não foi possível buscar decisores.");
      }

      setResult(payload as DecisionMakerResult);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Não foi possível buscar decisores.");
    } finally {
      setIsSearching(false);
    }
  }

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
              <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-[var(--share-lime)]">Inteligência de decisores</p>
              <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">
                Mapa de decisores para abordar a conta certa pelo caminho certo.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/74">
                A Share AI cruza empresa, BU, sinais públicos e perfis profissionais para diferenciar poder de decisão, aderência, acessibilidade e qualidade das evidências.
              </p>
            </div>
            <div className="relative grid content-between rounded-lg border border-white/15 bg-white/10 p-5">
              <div>
                <p className="text-sm font-semibold text-white/74">Conexão para pesquisa</p>
                <div className="mt-4 grid gap-2">
                  <ConnectorMini label="Acesso" connected={Boolean(status?.google.connected)} />
                  <ConnectorMini label="Análise especialista" connected={Boolean(status?.intelligence.available)} />
                  <ConnectorMini label="Fontes públicas" connected={Boolean(status?.publicSources.available)} />
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
                A pesquisa real depende da disponibilidade da análise especialista e das fontes públicas.
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
                  onChange={(event) => {
                    setBusinessUnitId(event.target.value);
                    setObjective(buildDecisionMakerObjective(event.target.value));
                    setResult(null);
                  }}
                  className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] px-3 py-2 text-sm outline-none focus:border-[var(--share-green-800)]"
                >
                  {demoBusinessUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>{unit.name}</option>
                  ))}
                </select>
              </label>
              <Field icon={<Sparkles className="h-4 w-4" />} label="Objetivo comercial" value={objective} onChange={setObjective} />
              <Field icon={<Compass className="h-4 w-4" />} label="Localização opcional" value={location} onChange={setLocation} placeholder="Brasil, São Paulo, remoto..." />
            </div>
            <div className="mt-5">
              <p className="text-sm font-semibold text-[var(--share-green-950)]">Áreas de interesse</p>
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
              onClick={runSearch}
              disabled={isSearching || !canSearch}
              className="share-button-primary mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSearching ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Search className="h-4 w-4" />}
              {isSearching ? "Preparando mapa" : "Encontrar pessoas estratégicas"}
            </button>
            {error ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{error}</p> : null}
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              O mapa inicial usa o DNA da BU e identifica claramente inferências. Dados externos só aparecem quando as fontes públicas estão disponíveis.
            </p>
          </aside>

          <div className="grid gap-6">
            {result ? <DecisionMakerSearchResult result={result} /> : null}

            <section className="share-card rounded-lg p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Como a busca trabalha</p>
                  <h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">Pesquisa progressiva, com controle humano</h2>
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

          </div>
        </section>
      </div>
    </main>
  );
}

function DecisionMakerSearchResult({ result }: { result: DecisionMakerResult }) {
  return (
    <section className="grid gap-4">
      <div className="share-card rounded-lg p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Dossiê da conta</p>
            <h2 className="mt-1 text-3xl font-semibold text-[var(--share-green-950)]">{result.company.name}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">BU: {result.company.businessUnitName}</p>
          </div>
          <div className="rounded-md bg-[var(--share-green-950)] px-4 py-3 text-white">
            <p className="text-xs font-semibold uppercase text-white/60">Aderência inicial</p>
            <p className="mt-1 text-3xl font-semibold text-[var(--share-lime)]">{result.company.fitScore}/100</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2">
          {result.company.rationale.map((item) => (
            <p key={item} className="rounded-md bg-[#fbfdf8] px-3 py-2 text-sm leading-6 text-zinc-700">{item}</p>
          ))}
        </div>
        <div className="mt-4 rounded-md border border-[var(--share-line)] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Próxima melhor ação</p>
          <h3 className="mt-1 text-xl font-semibold text-[var(--share-green-950)]">{result.nextBestAction.title}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-600">{result.nextBestAction.reason}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-md bg-[#edf7eb] px-2 py-1 text-xs font-semibold text-[var(--share-green-900)]">Impacto {levelLabel(result.nextBestAction.impact)}</span>
            <span className="rounded-md bg-[#edf7eb] px-2 py-1 text-xs font-semibold text-[var(--share-green-900)]">Esforço {levelLabel(result.nextBestAction.effort)}</span>
          </div>
        </div>
      </div>

      <div className="share-card rounded-lg p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Pessoas estratégicas</p>
        <h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">Mapa inicial por papel decisor</h2>
        <div className="mt-5 grid gap-3 xl:grid-cols-2">
          {result.people.map((person) => (
            <article key={person.id} className="rounded-md border border-[var(--share-line)] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-950">{person.displayName}</p>
                  <p className="mt-1 text-sm text-zinc-600">{person.role}</p>
                </div>
                <span className="rounded-md bg-[#edf7eb] px-2 py-1 text-xs font-semibold text-[var(--share-green-900)]">{person.probableDecisionRole}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <Metric label="Aderência" value={`${person.fitScore}/100`} />
                <Metric label="Acesso" value={person.accessibility} />
                <Metric label="Confiança" value={person.confidence} />
              </div>
              <p className="mt-4 text-sm leading-6 text-zinc-700">{person.whyRelevant}</p>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{person.suggestedConversation}</p>
              <p className="mt-3 rounded-md bg-[#fbfdf8] px-3 py-2 text-xs text-zinc-500">{person.contactStatus}</p>
              <details className="mt-3 rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-3">
                <summary className="cursor-pointer text-xs font-semibold text-[var(--share-green-900)]">Não usar nesta abordagem</summary>
                <ul className="mt-2 grid gap-1 text-xs leading-5 text-zinc-600">
                  {person.doNotUse.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </details>
            </article>
          ))}
        </div>
      </div>

      <div className="share-card rounded-lg p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Fontes e confiança</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {result.sources.map((source) => (
            <div key={source.title} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-3">
              <p className="text-sm font-semibold text-zinc-950">{source.title}</p>
              <p className="mt-1 text-xs font-semibold uppercase text-zinc-500">{confidenceLabel(source.confidence)}</p>
              <p className="mt-2 text-xs leading-5 text-zinc-600">{source.notes}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[#fbfdf8] p-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 font-semibold text-[var(--share-green-950)]">{value}</p>
    </div>
  );
}

function ConnectorMini({ label, connected }: { label: string; connected: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-white/12 bg-white/8 px-3 py-2">
      <span className="inline-flex items-center gap-2 text-sm text-white/82">
        {connected ? <CheckCircle2 className="h-4 w-4 text-[var(--share-lime)]" /> : <KeyRound className="h-4 w-4 text-white/45" />}
        {label}
      </span>
      <span className={connected ? "text-xs font-semibold text-[var(--share-lime)]" : "text-xs font-semibold text-white/45"}>{connected ? "Ligado" : "Desligado"}</span>
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

function buildDecisionMakerObjective(businessUnitId: string) {
  const unit = getBusinessUnitDna(businessUnitId);
  const product = unit.products[0]?.name ?? unit.name;
  const territory = unit.authorityTerritories[0]?.name ?? "prioridade comercial";
  return `Encontrar decisores para ${product} com foco em ${territory}.`;
}

function levelLabel(level: "low" | "medium" | "high") {
  if (level === "low") return "baixo";
  if (level === "medium") return "médio";
  return "alto";
}
