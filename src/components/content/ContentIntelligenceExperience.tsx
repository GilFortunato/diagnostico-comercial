"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, RefreshCw, Sparkles } from "lucide-react";
import { LoginButton } from "@/components/auth/LoginButton";
import { defaultBusinessUnitId } from "@/lib/business-units/dna";
import { demoBusinessUnits } from "@/lib/tenancy/demo";
import type { ContentOpportunityResult } from "@/lib/content/intelligence";
import { confidenceLabel } from "@/lib/copy/editorial";

export function ContentIntelligenceExperience() {
  const [businessUnitId, setBusinessUnitId] = useState(defaultBusinessUnitId);
  const [objective, setObjective] = useState("Gerar autoridade consultiva para conversas comerciais desta semana.");
  const [personalVoice, setPersonalVoice] = useState("");
  const [result, setResult] = useState<ContentOpportunityResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedBu = useMemo(() => demoBusinessUnits.find((unit) => unit.id === businessUnitId) ?? demoBusinessUnits[0], [businessUnitId]);

  function generate() {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/content/opportunity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessUnitId, objective, personalVoice }),
      });
      const payload = (await response.json()) as ContentOpportunityResult | { error?: string };
      if (!response.ok) {
        setError("error" in payload && payload.error ? payload.error : "Não foi possível gerar oportunidade editorial.");
        return;
      }
      setResult(payload as ContentOpportunityResult);
    });
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
        <section className="share-green-panel rounded-lg p-6 text-white md:p-8">
          <div className="h-2 w-56 rounded-r-md bg-[var(--share-lime)]" />
          <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-[var(--share-lime)]">Inteligência editorial</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">Sobre o que vale a pena falar agora?</h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-white/74">
            A Share AI combina DNA editorial da BU, voz pessoal, objetivo, ICP e STEPPS para sugerir uma pauta com fonte e confiança.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="share-card rounded-lg p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Briefing editorial</p>
            <label className="mt-4 grid gap-1.5">
              <span className="text-sm font-semibold text-[var(--share-green-950)]">BU</span>
              <select value={businessUnitId} onChange={(event) => setBusinessUnitId(event.target.value)} className="rounded-md border border-[var(--share-line)] bg-white px-3 py-2 text-sm">
                {demoBusinessUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
              </select>
            </label>
            <Field label="Objetivo" value={objective} onChange={setObjective} />
            <Field label="Minha voz" value={personalVoice} onChange={setPersonalVoice} placeholder="Ex.: direto, provocativo, com exemplos reais..." />
            <button type="button" onClick={generate} disabled={isPending} className="share-button-primary mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold disabled:opacity-60">
              {isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Criar oportunidade
            </button>
            {error ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
            <p className="mt-4 text-sm leading-6 text-zinc-600">BU ativa: {selectedBu.name}. Nada é publicado sem aprovação humana.</p>
          </aside>

          {result ? (
            <section className="grid gap-4">
              <div className="share-card rounded-lg p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Radar da semana</p>
                <h2 className="mt-1 text-3xl font-semibold text-[var(--share-green-950)]">{result.title}</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-600">{result.whyNow}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge label={`BU: ${result.businessUnitName}`} />
                  <Badge label={`Território: ${result.territory}`} />
                  <Badge label={`Aderência: ${result.adherenceScore}%`} />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <ResultCard title="Por que escrevemos assim?" items={result.stepps.map((item) => `${item.key}: ${item.reason}`)} />
                <ResultCard title="Rascunho aprovado por humano" items={result.draft} />
              </div>

              <div className="share-card rounded-lg p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Fontes e confiança</p>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {result.sources.map((source) => (
                    <div key={source.title} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-3">
                      <p className="text-xs font-semibold uppercase text-zinc-500">{confidenceLabel(source.confidence)}</p>
                      <p className="mt-1 text-sm font-semibold text-zinc-950">{source.title}</p>
                      <p className="mt-2 text-xs leading-5 text-zinc-600">{source.notes}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : (
            <section className="share-card grid place-items-center rounded-lg p-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-[var(--share-green-800)]" />
              <h2 className="mt-4 text-2xl font-semibold text-[var(--share-green-950)]">Radar pronto para orientar conteúdo</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">Informe o objetivo e gere uma pauta com estratégia STEPPS, contexto da BU e controle de afirmações.</p>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="mt-4 grid gap-1.5">
      <span className="text-sm font-semibold text-[var(--share-green-950)]">{label}</span>
      <textarea value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} rows={3} className="rounded-md border border-[var(--share-line)] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--share-green-800)]" />
    </label>
  );
}

function Badge({ label }: { label: string }) {
  return <span className="rounded-md bg-[#edf7eb] px-2 py-1 text-xs font-semibold text-[var(--share-green-900)]">{label}</span>;
}

function ResultCard({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="share-card rounded-lg p-5">
      <h3 className="text-lg font-semibold text-[var(--share-green-950)]">{title}</h3>
      <div className="mt-3 grid gap-2">
        {items.map((item) => <p key={item} className="rounded-md bg-[#fbfdf8] px-3 py-2 text-sm leading-6 text-zinc-700">{item}</p>)}
      </div>
    </article>
  );
}
