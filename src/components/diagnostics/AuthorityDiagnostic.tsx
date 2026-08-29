"use client";

import { useMemo, useState, useTransition } from "react";
import { Activity, BarChart3, CheckCircle2, History, Link, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import type { AuthorityAssessment } from "@/lib/diagnostics/authority";
import { demoBusinessUnits } from "@/lib/tenancy/demo";
import { buildBusinessUnitGuidance, defaultBusinessUnitId, getBusinessUnitStarterInput } from "@/lib/business-units/dna";

type FormState = {
  profileUrl: string;
  objective: string;
  headline: string;
  about: string;
  themes: string;
  proofPoints: string;
  recentContent: string;
  interactionSignals: string;
};

type CompareState = {
  available: boolean;
  delta: number;
  firstScore?: number;
  latestScore?: number;
  message: string;
};

type ActionPanel = {
  title: string;
  eyebrow: string;
  description: string;
  items: string[];
};

const historyLimit = 20;

export function AuthorityDiagnostic() {
  const [businessUnitId, setBusinessUnitId] = useState(defaultBusinessUnitId);
  const selectedBu = useMemo(() => demoBusinessUnits.find((item) => item.id === businessUnitId) ?? demoBusinessUnits[0], [businessUnitId]);
  const [form, setForm] = useState<FormState>(getBusinessUnitStarterInput(businessUnitId));
  const [assessment, setAssessment] = useState<AuthorityAssessment | null>(() => loadLocalHistory(defaultBusinessUnitId)[0] ?? null);
  const [history, setHistory] = useState<AuthorityAssessment[]>(() => loadLocalHistory(defaultBusinessUnitId));
  const [comparison, setComparison] = useState<CompareState | null>(null);
  const [actionPanel, setActionPanel] = useState<ActionPanel | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canRunDiagnostic = form.profileUrl.includes("linkedin.com/in/") && form.objective.trim().length >= 10;

  async function refreshHistory(targetBusinessUnitId = businessUnitId, options: { restoreLatest?: boolean } = {}) {
    const localItems = loadLocalHistory(targetBusinessUnitId);
    let serverItems: AuthorityAssessment[] = [];

    try {
      const response = await fetch(`/api/diagnostics/authority/history?businessUnitId=${targetBusinessUnitId}`);
      const result = (await response.json()) as { items?: AuthorityAssessment[] };
      serverItems = result.items ?? [];
    } catch {
      serverItems = [];
    }

    const items = mergeHistory(localItems, serverItems).slice(0, historyLimit);
    setHistory(items);
    if (options.restoreLatest) {
      setAssessment(items[0] ?? null);
    }
    return items;
  }

  function switchBu(nextBusinessUnitId: string) {
    const nextHistory = loadLocalHistory(nextBusinessUnitId);
    setBusinessUnitId(nextBusinessUnitId);
    setForm(getBusinessUnitStarterInput(nextBusinessUnitId));
    setAssessment(nextHistory[0] ?? null);
    setHistory(nextHistory);
    setComparison(null);
    setActionPanel(null);
    void refreshHistory(nextBusinessUnitId, { restoreLatest: true });
  }

  function updateField(key: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function runDiagnostic() {
    if (!canRunDiagnostic) {
      setFormError("Informe uma URL valida do LinkedIn e o objetivo comercial antes de gerar o diagnostico.");
      return;
    }

    setFormError(null);
    startTransition(async () => {
      const response = await fetch("/api/diagnostics/authority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, businessUnitId, businessUnitName: selectedBu.name, businessUnitContext: buildBusinessUnitGuidance(businessUnitId) }),
      });
      const result = (await response.json()) as AuthorityAssessment | { error?: string };
      if (!response.ok) {
        setFormError("error" in result && result.error ? result.error : "Nao foi possivel gerar o diagnostico.");
        return;
      }
      const nextAssessment = result as AuthorityAssessment;
      saveLocalHistory(nextAssessment);
      setAssessment(nextAssessment);
      setActionPanel(null);
      await refreshHistory(businessUnitId);
    });
  }

  function compareEvolution() {
    startTransition(async () => {
      const result = await fetchComparison();
      setComparison(result);
      await refreshHistory();
    });
  }

  async function fetchComparison() {
    const items = await refreshHistory(businessUnitId);
    if (items.length < 2) {
      return {
        available: false,
        delta: 0,
        firstScore: items[0]?.overallScore,
        latestScore: items[0]?.overallScore,
        message: "Crie um segundo diagnostico para comparar evolucao.",
      };
    }

    const sorted = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const first = sorted[0];
    const latest = sorted.at(-1);
    const delta = latest ? latest.overallScore - first.overallScore : 0;
    return {
      available: true,
      delta,
      firstScore: first.overallScore,
      latestScore: latest?.overallScore,
      message: `Evolucao de ${delta} pontos desde o primeiro diagnostico.`,
    };
  }

  function handleNextAction(action: string) {
    if (!assessment) return;

    if (action === "Refazer diagnostico") {
      runDiagnostic();
      return;
    }

    if (action === "Comparar evolucao") {
      startTransition(async () => {
        const result = await fetchComparison();
        setComparison(result);
        setActionPanel({
          eyebrow: "Comparacao",
          title: "Evolucao preparada",
          description: "A comparacao usa o primeiro e o ultimo diagnostico salvos nesta BU.",
          items: [result.message],
        });
        await refreshHistory();
      });
      return;
    }

    if (action === "Gerar plano de 30 dias") {
      setActionPanel({
        eyebrow: "Plano de execucao",
        title: "30 dias para aumentar autoridade comercial",
        description: "Plano organizado por semana, com acoes de alto impacto antes de qualquer acao externa.",
        items: assessment.plan30Days.map((week) => `Semana ${week.week}: ${week.objective} - ${week.actions.map((item) => item.action).join(" ")}`),
      });
      return;
    }

    if (action === "Criar post agora") {
      const topic = assessment.opportunities[0] ?? "um aprendizado comercial relevante";
      setActionPanel({
        eyebrow: "Rascunho aprovado por humano",
        title: "Post consultivo para LinkedIn",
        description: "Rascunho para revisar antes de publicar. A plataforma nao publica nada sem aprovacao.",
        items: [
          `Gancho: O que muda quando ${topic.toLocaleLowerCase("pt-BR")}`,
          `Corpo: conte uma situacao real, explique o criterio de decisao e mostre uma implicacao pratica para ${assessment.input.businessUnitName}.`,
          "CTA: Qual desses sinais sua empresa ja consegue medir hoje?",
        ],
      });
      return;
    }

    if (action === "Melhorar headline") {
      const guidance = buildBusinessUnitGuidance(businessUnitId);
      const territory = guidance.territories[0] ?? selectedBu.name;
      const cta = guidance.recommendedCtas[0] ?? "conversas comerciais";
      setActionPanel({
        eyebrow: "Headline",
        title: "Sugestao de posicionamento",
        description: "Use como ponto de partida e ajuste para soar como a pessoa, nao como propaganda.",
        items: [
          `${territory} para liderancas B2B | Transformo conhecimento em decisao comercial | ${cta}`,
          `${assessment.input.businessUnitName}: aprendizagem aplicada, dados e autoridade para times que precisam vender melhor`,
        ],
      });
      return;
    }

    setActionPanel({
      eyebrow: "Proximo passo",
      title: "O que fazer agora",
      description: "Prioridade calculada a partir das menores dimensoes do diagnostico atual.",
      items: topDimensions.slice(0, 3).map((dimension) => `${dimension.label}: ${dimension.rationale}`),
    });
  }

  const topDimensions = assessment?.dimensions.slice().sort((a, b) => a.score - b.score).slice(0, 6) ?? [];

  return (
    <section className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <aside className="share-card space-y-4 rounded-lg p-5">
        <div>
          <div className="h-2 w-44 rounded-r-md share-tab-accent" style={{ "--accent-color": selectedBu.brandPack.accent } as React.CSSProperties} />
          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Unidade de negocio</p>
          <h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">{selectedBu.name}</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">{selectedBu.description}</p>
        </div>
        <div className="grid gap-2">
          {demoBusinessUnits.map((unit) => (
            <button
              key={unit.id}
              type="button"
              onClick={() => switchBu(unit.id)}
              className={`rounded-md border px-3 py-3 text-left text-sm transition ${
                unit.id === businessUnitId ? "border-[var(--share-green-950)] bg-[var(--share-green-950)] text-white" : "border-[var(--share-line)] bg-white text-zinc-700 hover:border-[var(--share-green-700)]"
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span>{unit.name}</span>
                <span className="h-2 w-9 rounded-full" style={{ backgroundColor: unit.brandPack.accent }} />
              </span>
            </button>
          ))}
        </div>
        <div className="rounded-md p-3 text-sm text-zinc-700" style={{ backgroundColor: selectedBu.brandPack.surface }}>
          <p className="font-medium text-[var(--share-green-950)]">Contexto ativo</p>
          <p className="mt-1">Tom: {selectedBu.brandPack.voice}</p>
          <p className="mt-1">As recomendacoes usam a linguagem e os temas desta BU.</p>
        </div>
      </aside>

      <div className="space-y-6">
        <BusinessUnitContextPanel businessUnit={selectedBu} />

        <div className="share-card rounded-lg p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Diagnostico guiado</p>
              <h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">Diagnostico de Autoridade Comercial</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                Avalia se um potencial cliente percebe profundidade, repertorio e confianca comercial no perfil.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-4">
            <Input
              icon={<Link className="h-4 w-4 text-[#0a66c2]" />}
              label="URL do seu perfil no LinkedIn"
              placeholder="https://www.linkedin.com/in/seu-perfil"
              value={form.profileUrl}
              onChange={(value) => updateField("profileUrl", value)}
            />
            <Input label="Objetivo comercial" value={form.objective} onChange={(value) => updateField("objective", value)} />
            <details className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-3">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--share-green-900)]">Complementar manualmente</summary>
              <div className="mt-4 grid gap-4">
                <Input label="Headline do LinkedIn" value={form.headline} onChange={(value) => updateField("headline", value)} />
                <Textarea label="Sobre" value={form.about} onChange={(value) => updateField("about", value)} rows={4} />
                <Input label="Temas de autoridade" value={form.themes} onChange={(value) => updateField("themes", value)} />
                <Textarea label="Provas, cases e resultados" value={form.proofPoints} onChange={(value) => updateField("proofPoints", value)} />
                <Textarea label="Conteudos recentes" value={form.recentContent} onChange={(value) => updateField("recentContent", value)} />
                <Textarea label="Interacoes e networking" value={form.interactionSignals} onChange={(value) => updateField("interactionSignals", value)} />
              </div>
            </details>
          </div>
          {formError ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p> : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={runDiagnostic}
              className="share-button-primary inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55"
              disabled={isPending}
            >
              <Sparkles className="h-4 w-4" />
              {assessment ? "Refazer diagnostico" : "Analisar meu LinkedIn"}
            </button>
            <button type="button" onClick={compareEvolution} className="inline-flex items-center gap-2 rounded-md border border-[var(--share-green-800)] px-4 py-2 text-sm font-semibold text-[var(--share-green-900)] hover:bg-[#edf7eb]">
              <BarChart3 className="h-4 w-4" />
              Comparar evolucao
            </button>
            {isPending ? <span className="inline-flex items-center gap-2 text-sm text-zinc-500"><RefreshCw className="h-4 w-4 animate-spin" /> Processando</span> : null}
          </div>
        </div>

        {assessment ? (
          <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
            <div className="share-green-panel rounded-lg p-5 text-white">
              <p className="text-sm font-medium text-white/72">Score geral</p>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-7xl font-semibold text-[var(--share-lime)]">{assessment.overallScore}</span>
                <span className="pb-2 text-white/70">/100</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-white/78">{assessment.summary}</p>
              {assessment.input.profileUrl ? (
                <a className="mt-4 inline-flex text-sm font-semibold text-[var(--share-lime)] underline-offset-4 hover:underline" href={assessment.input.profileUrl} target="_blank" rel="noreferrer">
                  Perfil avaliado no LinkedIn
                </a>
              ) : null}
              <div className="mt-5 grid gap-2">
                {assessment.sources.map((source) => (
                  <SourceEvidence key={`${source.confidence}-${source.title}`} source={source} />
                ))}
              </div>
            </div>

            <div className="share-card rounded-lg p-5">
              <h3 className="text-lg font-semibold text-[var(--share-green-950)]">Lacunas prioritarias</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {topDimensions.map((dimension) => (
                  <div key={dimension.key} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-zinc-900">{dimension.label}</p>
                      <span className="text-sm font-semibold text-zinc-950">{dimension.score}</span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-[#dfe8dc]">
                      <div className="h-2 rounded-full" style={{ width: `${dimension.score}%`, backgroundColor: selectedBu.brandPack.accent }} />
                    </div>
                    <p className="mt-3 text-xs leading-5 text-zinc-600">{dimension.rationale}</p>
                  </div>
                ))}
              </div>
            </div>

            <ResultList title="Pontos fortes" icon={<CheckCircle2 className="h-4 w-4" />} items={assessment.strengths} />
            <ResultList title="Recomendacoes" icon={<Activity className="h-4 w-4" />} items={assessment.recommendations} />
            <div className="share-card rounded-lg p-5 xl:col-span-2">
              <h3 className="text-lg font-semibold text-[var(--share-green-950)]">Plano inicial de 30 dias</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {assessment.plan30Days.map((week) => (
                  <div key={week.week} className="rounded-md p-4" style={{ backgroundColor: selectedBu.brandPack.surface }}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Semana {week.week}</p>
                    <p className="mt-1 font-medium text-zinc-950">{week.objective}</p>
                    <ul className="mt-3 space-y-2 text-sm leading-5 text-zinc-600">
                      {week.actions.map((action) => <li key={action.action}>{action.action}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
              {actionPanel ? <ActionPanelCard panel={actionPanel} /> : null}
              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {assessment.nextActions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => handleNextAction(action)}
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--share-line)] bg-white px-3 py-2 text-center text-sm font-semibold text-[var(--share-green-900)] transition hover:border-[var(--share-green-800)] hover:bg-[#edf7eb]"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="share-card rounded-lg p-5">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-[var(--share-green-800)]" />
              <h3 className="font-semibold text-zinc-950">Historico</h3>
            </div>
            <div className="mt-4 space-y-2">
              {history.length ? history.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-md bg-[#f0f6ed] px-3 py-2 text-sm">
                  <span>{new Date(item.createdAt).toLocaleString("pt-BR")}</span>
                  <span className="font-semibold">{item.overallScore}/100</span>
                </div>
              )) : <p className="text-sm text-zinc-500">Sem diagnosticos neste historico.</p>}
            </div>
          </div>
          <div className="share-card rounded-lg p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[var(--share-green-800)]" />
              <h3 className="font-semibold text-zinc-950">Comparacao e governanca</h3>
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-600">{comparison?.message ?? "Gere diagnosticos e use Comparar evolucao para medir progresso."}</p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">O LinkedIn conectado entra por OAuth oficial; ate la, o diagnostico usa apenas dados informados e fontes permitidas.</p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">Acoes externas como publicar, enviar mensagem ou acionar CRM exigem preview e aprovacao humana.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <span className="flex items-center gap-2 rounded-md border border-[var(--share-line)] bg-[#fbfdf8] px-3 py-2 focus-within:border-[var(--share-green-800)] focus-within:bg-white">
        {icon}
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

function Textarea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <textarea value={value} rows={rows} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--share-green-800)] focus:bg-white" />
    </label>
  );
}

function ResultList({ title, icon, items }: { title: string; icon: React.ReactNode; items: string[] }) {
  return (
    <div className="share-card rounded-lg p-5">
      <div className="flex items-center gap-2">
        <span className="text-zinc-500">{icon}</span>
        <h3 className="font-semibold text-[var(--share-green-950)]">{title}</h3>
      </div>
      <ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-600">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function SourceEvidence({ source }: { source: AuthorityAssessment["sources"][number] }) {
  const tone =
    source.confidence === "confirmed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : source.confidence === "likely"
        ? "border-sky-200 bg-sky-50 text-sky-950"
        : "border-white/15 bg-white/10 text-white";

  return (
    <div className={`rounded-md border px-3 py-2 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide">{source.confidence}</p>
        {source.url ? (
          <a className="text-xs font-semibold underline-offset-4 hover:underline" href={source.url} target="_blank" rel="noreferrer">
            abrir fonte
          </a>
        ) : null}
      </div>
      <p className="mt-1 text-sm font-semibold">{source.title}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{source.notes}</p>
    </div>
  );
}

function ActionPanelCard({ panel }: { panel: ActionPanel }) {
  return (
    <div className="mt-5 rounded-lg border border-[var(--share-green-800)] bg-[#f4fbef] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">{panel.eyebrow}</p>
      <h4 className="mt-1 text-lg font-semibold text-[var(--share-green-950)]">{panel.title}</h4>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{panel.description}</p>
      <div className="mt-3 grid gap-2">
        {panel.items.map((item) => (
          <p key={item} className="rounded-md border border-[var(--share-line)] bg-white px-3 py-2 text-sm leading-6 text-zinc-700">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function historyStorageKey(businessUnitId: string) {
  return `share-ai:authority-history:${businessUnitId}`;
}

function loadLocalHistory(businessUnitId: string): AuthorityAssessment[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(historyStorageKey(businessUnitId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AuthorityAssessment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalHistory(assessment: AuthorityAssessment) {
  if (typeof window === "undefined") return;

  const current = loadLocalHistory(assessment.input.businessUnitId);
  const next = mergeHistory([assessment], current).slice(0, historyLimit);
  window.localStorage.setItem(historyStorageKey(assessment.input.businessUnitId), JSON.stringify(next));
}

function mergeHistory(...groups: AuthorityAssessment[][]) {
  const byId = new Map<string, AuthorityAssessment>();
  groups.flat().forEach((item) => byId.set(item.id, item));
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

type VisualBusinessUnitContext = {
  positioning?: string;
  pillars?: Array<{ title: string; description: string; offers: string[] }>;
  differentiators?: string[];
  aiMaturity?: Array<{ level: string; title: string }>;
};

function BusinessUnitContextPanel({ businessUnit }: { businessUnit: (typeof demoBusinessUnits)[number] }) {
  const context = businessUnit.brandPack.context as VisualBusinessUnitContext | undefined;
  if (!context?.pillars?.length) return null;

  return (
    <div className="share-card overflow-hidden rounded-lg">
      <div className="border-b border-[var(--share-line)] bg-[#fbfdf8] p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">{businessUnit.name}</p>
            <h3 className="mt-2 text-2xl font-semibold text-[var(--share-green-950)] md:text-3xl">DNA comercial da BU</h3>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">{context.positioning}</p>
          </div>
          <div className="rounded-md border border-[var(--share-line)] bg-white px-4 py-3 text-right">
            <p className="text-xs text-zinc-500">Brand Pack</p>
            <p className="mt-1 text-xl font-semibold text-[var(--share-green-950)]">{businessUnit.brandPack.voice}</p>
          </div>
        </div>
      </div>

      <div className="p-5 md:p-6">
        <div className="grid gap-3 xl:grid-cols-5">
          {context.pillars.map((pillar) => (
            <article key={pillar.title} className="rounded-md border border-[var(--share-line)] bg-white p-4">
              <div className="h-1.5 w-12 rounded-full" style={{ backgroundColor: businessUnit.brandPack.accent }} />
              <h4 className="mt-3 text-sm font-semibold text-[var(--share-green-950)]">{pillar.title}</h4>
              <p className="mt-2 min-h-20 text-xs leading-5 text-zinc-600">{pillar.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {pillar.offers.map((offer) => (
                  <span key={offer} className="rounded-md bg-[#edf7eb] px-2 py-1 text-[11px] font-semibold text-[var(--share-green-900)]">
                    {offer}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4">
            <p className="text-sm font-semibold text-[var(--share-green-950)]">Diferenciais para autoridade comercial</p>
            <div className="mt-3 grid gap-2 text-sm leading-5 text-zinc-700 sm:grid-cols-2">
              {(context.differentiators ?? []).map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
          <div className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4">
            <p className="text-sm font-semibold text-[var(--share-green-950)]">Jornada de evolucao</p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {(context.aiMaturity ?? []).map((step) => (
                <div key={step.level} className="rounded-md bg-white p-3">
                  <p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">{step.level}</p>
                  <p className="mt-2 text-xs leading-5 text-zinc-600">{step.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
