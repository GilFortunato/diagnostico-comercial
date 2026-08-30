"use client";

import { useMemo, useState, useTransition } from "react";
import { Activity, ArrowRight, BarChart3, CheckCircle2, Download, History, Link, RefreshCw, Sparkles, Target } from "lucide-react";
import type { AuthorityAssessment } from "@/lib/diagnostics/authority";
import type { AuthorityThirtyDayPlan } from "@/lib/diagnostics/authorityPlan";
import { demoBusinessUnits } from "@/lib/tenancy/demo";
import { buildBusinessUnitGuidance, defaultBusinessUnitId, getBusinessUnitStarterInput } from "@/lib/business-units/dna";
import { confidenceLabel } from "@/lib/copy/editorial";

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

type ContentBrief = {
  objective: "Autoridade" | "Conversa" | "Provocação" | "Valor prático" | "Storytelling" | "Relacionamento" | "Ativação da BU";
  bridgeId?: string;
  humanContext: string;
  strategy: "Recomendada" | "Autoridade" | "Mais pessoal" | "Mais provocativo" | "Mais prático" | "Mais conversacional";
};

type ContentDraft = {
  title: string;
  post: string;
  objective: string;
  persona: string;
  territory: string;
  bridge: string;
  timing: string;
  primaryStepps: string[];
  secondaryStepps: string[];
  whyThisWorks: string[];
  naturality: "Alta" | "Média" | "Baixa";
  naturalityRationale: string;
  trend?: { label: string; source?: string; confidence: "confirmed" | "likely" | "inference" | "unverified" } | null;
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
  const [thirtyDayPlan, setThirtyDayPlan] = useState<AuthorityThirtyDayPlan | null>(null);
  const [planView, setPlanView] = useState<"calendar" | "timeline" | "list">("timeline");
  const [formError, setFormError] = useState<string | null>(null);
  const [collectionSteps, setCollectionSteps] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isPlanPending, startPlanTransition] = useTransition();
  const [isContentPending, startContentTransition] = useTransition();
  const [isReportPending, setIsReportPending] = useState(false);
  const [contentComposerOpen, setContentComposerOpen] = useState(false);
  const [contentDraft, setContentDraft] = useState<ContentDraft | null>(null);
  const [contentBrief, setContentBrief] = useState<ContentBrief>({ objective: "Autoridade", bridgeId: undefined, humanContext: "", strategy: "Recomendada" });
  const canRunDiagnostic = form.profileUrl.includes("linkedin.com/in/") && form.objective.trim().length >= 10;
  const suggestedObjective = useMemo(() => getBusinessUnitStarterInput(businessUnitId).objective, [businessUnitId]);

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
    if (options.restoreLatest) setAssessment(items[0] ?? null);
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
    setThirtyDayPlan(null);
    setContentComposerOpen(false);
    setContentDraft(null);
    void refreshHistory(nextBusinessUnitId, { restoreLatest: true });
  }

  function updateField(key: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function runDiagnostic() {
    if (!canRunDiagnostic) {
      setFormError("Informe uma URL válida do LinkedIn e o objetivo comercial antes de gerar o diagnóstico.");
      return;
    }

    setFormError(null);
    setCollectionSteps(["Perfil localizado", "Headline analisada", "Sobre identificado", "Experiências analisadas", "Competências identificadas", "Conteúdo encontrado", "Provas mapeadas", "Preparando análise"]);
    startTransition(async () => {
      const response = await fetch("/api/diagnostics/authority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, businessUnitId, businessUnitName: selectedBu.name, businessUnitContext: buildBusinessUnitGuidance(businessUnitId) }),
      });
      const result = (await response.json()) as AuthorityAssessment | { error?: string };
      if (!response.ok) {
        setFormError("error" in result && result.error ? result.error : "Não foi possível gerar o diagnóstico.");
        setCollectionSteps([]);
        return;
      }
      const nextAssessment = result as AuthorityAssessment;
      saveLocalHistory(nextAssessment);
      setAssessment(nextAssessment);
      setActionPanel(null);
      setThirtyDayPlan(null);
      setContentComposerOpen(false);
      setContentDraft(null);
      await refreshHistory(businessUnitId);
      setCollectionSteps([]);
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
      return { available: false, delta: 0, firstScore: items[0]?.overallScore, latestScore: items[0]?.overallScore, message: "Crie um segundo diagnóstico para comparar evolução." };
    }

    const sorted = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const first = sorted[0];
    const latest = sorted.at(-1);
    const delta = latest ? latest.overallScore - first.overallScore : 0;
    return { available: true, delta, firstScore: first.overallScore, latestScore: latest?.overallScore, message: `Evolução de ${delta} pontos desde o primeiro diagnóstico.` };
  }

  const topDimensions = assessment?.dimensions.slice().sort((a, b) => a.score - b.score).slice(0, 6) ?? [];
  const authoritySellingScore = assessment?.authoritySellingScore ?? assessment?.overallScore ?? 0;
  const buAffinityScore = assessment?.buAffinityScore ?? 0;
  const activationPotentialScore = assessment?.activationPotentialScore ?? 0;

  function handleNextAction(action: string) {
    if (!assessment) return;
    if (action === "Refazer diagnóstico") return runDiagnostic();
    if (action === "Comparar evolução") return compareEvolution();
    if (action === "Gerar plano de 30 dias") return generateThirtyDayPlan();
    if (action === "Criar post agora") return openContentComposer();
    if (action === "Melhorar headline") {
      const headline = assessment.profileReview?.find((item) => item.field === "headline");
      if (headline) return openProfileImprovement(headline);
    }
    const recommendation = buildNextBestAction(assessment);
    setActionPanel({ eyebrow: "Próxima melhor ação", title: recommendation.title, description: recommendation.reason, items: recommendation.actions });
  }

  function generateThirtyDayPlan() {
    if (!assessment) return;
    setFormError(null);
    setActionPanel(null);
    startPlanTransition(async () => {
      try {
        const response = await fetch("/api/diagnostics/authority/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assessment, history }) });
        const result = (await response.json()) as AuthorityThirtyDayPlan | { error?: string };
        if (!response.ok) return setFormError("error" in result && result.error ? result.error : "Não foi possível gerar o plano de 30 dias.");
        setThirtyDayPlan(result as AuthorityThirtyDayPlan);
      } catch {
        setFormError("Não foi possível gerar o plano de 30 dias. Tente novamente.");
      }
    });
  }

  function openBridge(bridge: NonNullable<AuthorityAssessment["bridgeOpportunities"]>[number]) {
    setActionPanel({ eyebrow: "Construir pontes", title: bridge.title, description: bridge.description, items: [`Sua autoridade: ${bridge.whyItWorks.personalAuthority}`, `Conexão com a BU: ${bridge.whyItWorks.businessUnitConnection}`, `Interesse da persona: ${bridge.whyItWorks.personaInterest}`, `Momento de mercado: ${bridge.whyItWorks.marketMoment}`, `Risco: ${bridge.whyItWorks.risk}`] });
  }

  function openProfileImprovement(item: AuthorityAssessment["profileReview"][number]) {
    if (!assessment) return;
    const insight = buildProfileReviewInsight(item, assessment, selectedBu.shortName);
    setActionPanel({ eyebrow: "Sugestão de melhoria", title: item.label, description: insight.analysis, items: [insight.suggestion] });
  }

  function openContentComposer() {
    if (!assessment) return;
    const bridge = assessment.bridgeOpportunities?.[0];
    setContentBrief({ objective: "Autoridade", bridgeId: bridge?.id, humanContext: "", strategy: "Recomendada" });
    setContentDraft(null);
    setContentComposerOpen(true);
    setActionPanel(null);
  }

  function generateContentDraft() {
    if (!assessment) return;
    setFormError(null);
    startContentTransition(async () => {
      try {
        const response = await fetch("/api/diagnostics/authority/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assessment, brief: contentBrief }) });
        const result = (await response.json()) as ContentDraft | { error?: string };
        if (!response.ok) return setFormError("error" in result && result.error ? result.error : "Não foi possível criar o conteúdo agora.");
        setContentDraft(result as ContentDraft);
      } catch {
        setFormError("Não foi possível criar o conteúdo agora. Tente novamente.");
      }
    });
  }

  async function downloadReport() {
    if (!assessment || isReportPending) return;
    setFormError(null);
    setIsReportPending(true);

    try {
      const response = await fetch(`/api/diagnostics/authority/${encodeURIComponent(assessment.id)}/report`, { cache: "no-store" });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error || "Não foi possível preparar o relatório.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = reportFilename(response.headers.get("Content-Disposition"));
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível preparar o relatório.");
    } finally {
      setIsReportPending(false);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <aside className="share-card space-y-4 rounded-lg p-5">
        <div><div className="h-2 w-44 rounded-r-md share-tab-accent" style={{ "--accent-color": selectedBu.brandPack.accent } as React.CSSProperties} /><p className="mt-5 text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Unidade de Negócio</p><h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">{selectedBu.name}</h2><p className="mt-2 text-sm leading-6 text-zinc-600">{selectedBu.description}</p></div>
        <div className="grid gap-2">{demoBusinessUnits.map((unit) => <button key={unit.id} type="button" onClick={() => switchBu(unit.id)} className={`rounded-md border px-3 py-3 text-left text-sm transition ${unit.id === businessUnitId ? "border-[var(--share-green-950)] bg-[var(--share-green-950)] text-white" : "border-[var(--share-line)] bg-white text-zinc-700 hover:border-[var(--share-green-700)]"}`}><span className="flex items-center justify-between gap-3"><span>{unit.name}</span><span className="h-2 w-9 rounded-full" style={{ backgroundColor: unit.brandPack.accent }} /></span></button>)}</div>
        <div className="rounded-md p-3 text-sm text-zinc-700" style={{ backgroundColor: selectedBu.brandPack.surface }}><p className="font-medium text-[var(--share-green-950)]">Contexto ativo</p><p className="mt-1">Tom: {selectedBu.brandPack.voice}</p><p className="mt-1">As recomendações usam a linguagem e os temas desta BU.</p></div>
      </aside>

      <div className="space-y-6">
        <div className="share-card rounded-lg p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Diagnóstico guiado</p><h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">Diagnóstico de autoridade comercial</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">Avalia se um potencial cliente percebe profundidade, repertório e confiança comercial no perfil.</p>
          <div className="mt-5 grid gap-4"><Input icon={<Link className="h-4 w-4 text-[#0a66c2]" />} label="URL do seu perfil no LinkedIn" placeholder="https://www.linkedin.com/in/seu-perfil" value={form.profileUrl} onChange={(value) => updateField("profileUrl", value)} /><div className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Objetivo sugerido pela BU</p><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-700">{suggestedObjective}</p></div><button type="button" onClick={() => updateField("objective", suggestedObjective)} className="rounded-md border border-[var(--share-green-800)] px-3 py-2 text-sm font-semibold text-[var(--share-green-900)] hover:bg-[#edf7eb]">Usar sugestão</button></div></div><Input label="Objetivo comercial" value={form.objective} onChange={(value) => updateField("objective", value)} /><details className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-3"><summary className="cursor-pointer text-sm font-semibold text-[var(--share-green-900)]">Complementar manualmente</summary><div className="mt-4 grid gap-4"><Input label="Headline do LinkedIn" value={form.headline} onChange={(value) => updateField("headline", value)} /><Textarea label="Sobre" value={form.about} onChange={(value) => updateField("about", value)} rows={4} /><Input label="Temas de autoridade" value={form.themes} onChange={(value) => updateField("themes", value)} /><Textarea label="Provas, cases e resultados" value={form.proofPoints} onChange={(value) => updateField("proofPoints", value)} /><Textarea label="Conteúdos recentes" value={form.recentContent} onChange={(value) => updateField("recentContent", value)} /><Textarea label="Interações e networking" value={form.interactionSignals} onChange={(value) => updateField("interactionSignals", value)} /></div></details></div>
          {isPending && collectionSteps.length ? <div className="mt-5 grid gap-2 rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4 sm:grid-cols-2 lg:grid-cols-4">{collectionSteps.map((step, index) => <span key={step} className="inline-flex items-center gap-2 text-sm text-zinc-700">{index < collectionSteps.length - 1 ? <CheckCircle2 className="h-4 w-4 text-[var(--share-green-800)]" /> : <RefreshCw className="h-4 w-4 animate-spin text-[var(--share-green-800)]" />}{step}</span>)}</div> : null}
          {formError ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p> : null}
          <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={runDiagnostic} className="share-button-primary inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55" disabled={isPending}><Sparkles className="h-4 w-4" />{assessment ? "Refazer diagnóstico" : "Analisar meu LinkedIn"}</button><button type="button" onClick={compareEvolution} className="inline-flex items-center gap-2 rounded-md border border-[var(--share-green-800)] px-4 py-2 text-sm font-semibold text-[var(--share-green-900)] hover:bg-[#edf7eb]"><BarChart3 className="h-4 w-4" />Comparar evolução</button></div>
        </div>

        {assessment ? <div className="grid gap-6">
          <section className="share-green-panel rounded-lg p-5 text-white"><div className="mb-5 flex justify-end"><button type="button" onClick={downloadReport} disabled={isReportPending} className="inline-flex items-center gap-2 rounded-md border border-white/25 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-wait disabled:opacity-60"><Download className="h-4 w-4" />{isReportPending ? "Preparando relatório..." : "Baixar relatório executivo"}</button></div><div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]"><div><p className="text-sm font-medium text-white/72">Minha autoridade</p><div className="mt-3 flex items-end gap-2"><span className="text-7xl font-semibold text-[var(--share-lime)]">{authoritySellingScore}</span><span className="pb-2 text-white/70">/100</span></div><p className="mt-4 text-sm leading-6 text-white/78">{assessment.summary}</p>{assessment.input.profileUrl ? <a className="mt-4 inline-flex text-sm font-semibold text-[var(--share-lime)] underline-offset-4 hover:underline" href={assessment.input.profileUrl} target="_blank" rel="noreferrer">Perfil avaliado no LinkedIn</a> : null}</div><div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Autoridade pessoal" value={authoritySellingScore} /><MetricCard label={`Aderência à ${selectedBu.shortName}`} value={buAffinityScore} /><MetricCard label="Potencial de ativação" value={activationPotentialScore} /></div></div></section>

          <section className="share-card rounded-lg p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">O que encontramos no seu perfil</p><h3 className="mt-1 text-xl font-semibold text-[var(--share-green-950)]">Evidências que sustentam o diagnóstico</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">Mostramos o dado encontrado, a leitura estratégica e uma sugestão de melhoria. A BU funciona como lente comercial, sem substituir sua marca pessoal.</p><div className="mt-4 grid gap-3 lg:grid-cols-2">{(assessment.profileReview ?? []).map((item) => { const insight = buildProfileReviewInsight(item, assessment, selectedBu.shortName); return <article key={item.field} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-zinc-950">{item.label}</p><p className="mt-1 text-xs text-zinc-500">Fonte: {item.sourceLabel} · {confidenceLabel(item.confidence)}</p></div><button type="button" onClick={() => openProfileImprovement(item)} className="text-sm font-semibold text-[var(--share-green-900)] underline-offset-4 hover:underline">Sugestão de melhoria</button></div><div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Encontramos</p><p className="mt-1 line-clamp-4 text-sm leading-6 text-zinc-700">{item.value || insight.emptyState}</p></div><div className="mt-4 border-t border-[var(--share-line)] pt-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Leitura do especialista</p><p className="mt-2 text-sm leading-6 text-zinc-700">{insight.analysis}</p><div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-white px-2.5 py-1 text-[var(--share-green-900)]">Autoridade pessoal: {insight.authoritySignal}</span><span className="rounded-full bg-white px-2.5 py-1 text-[var(--share-green-900)]">Aderência à {selectedBu.shortName}: {insight.buSignal}</span></div></div></article>; })}</div>{actionPanel?.eyebrow === "Sugestão de melhoria" ? <ActionPanelCard panel={actionPanel} /> : null}</section>

          <section className="share-card rounded-lg p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Você × BU</p><h3 className="mt-1 text-xl font-semibold text-[var(--share-green-950)]">Onde já existe ponte e onde existe lacuna</h3><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-zinc-500"><tr><th className="border-b border-[var(--share-line)] py-2">Tema</th><th className="border-b border-[var(--share-line)] py-2">Você</th><th className="border-b border-[var(--share-line)] py-2">BU</th><th className="border-b border-[var(--share-line)] py-2">Aderência</th><th className="border-b border-[var(--share-line)] py-2">Leitura</th></tr></thead><tbody>{(assessment.themeAlignment ?? []).map((item) => <tr key={item.theme} className="border-b border-[var(--share-line)] last:border-0"><td className="py-3 font-medium text-zinc-950">{item.theme}</td><td className="py-3 text-zinc-700">{item.personSignal}</td><td className="py-3 text-zinc-700">{item.businessUnitSignal}</td><td className="py-3 font-semibold text-zinc-950">{item.affinity}/100</td><td className="py-3 text-zinc-600">{item.gap}</td></tr>)}</tbody></table></div></section>

          <section className="share-card rounded-lg p-5"><div className="flex items-center gap-2"><Target className="h-4 w-4 text-[var(--share-green-800)]" /><h3 className="text-lg font-semibold text-[var(--share-green-950)]">Melhores pontes</h3></div><div className="mt-4 grid gap-3 lg:grid-cols-2">{(assessment.bridgeOpportunities ?? []).map((bridge) => <button key={bridge.id} type="button" onClick={() => openBridge(bridge)} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4 text-left transition hover:border-[var(--share-green-800)] hover:bg-white"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-zinc-950">{bridge.title}</p><p className="mt-2 text-sm leading-6 text-zinc-600">{bridge.description}</p></div><ArrowRight className="h-4 w-4 shrink-0 text-[var(--share-green-800)]" /></div><div className="mt-3 grid grid-cols-3 gap-2 text-xs text-zinc-600"><span>Você: {bridge.personAffinity}</span><span>BU: {bridge.businessUnitAffinity}</span><span>Conversa: {bridge.conversationPotential}</span></div></button>)}</div></section>

          <div className="share-card rounded-lg p-5"><h3 className="text-lg font-semibold text-[var(--share-green-950)]">Lacunas prioritárias</h3><div className="mt-4 grid gap-3 md:grid-cols-2">{topDimensions.map((dimension) => <div key={dimension.key} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-zinc-900">{dimension.label}</p><span className="text-sm font-semibold text-zinc-950">{dimension.score}</span></div><div className="mt-3 h-2 rounded-full bg-[#dfe8dc]"><div className="h-2 rounded-full" style={{ width: `${dimension.score}%`, backgroundColor: selectedBu.brandPack.accent }} /></div><p className="mt-3 text-xs leading-5 text-zinc-600">{dimension.rationale}</p></div>)}</div></div>

          <div className="grid gap-6 lg:grid-cols-2"><ResultList title="Pontos fortes" icon={<CheckCircle2 className="h-4 w-4" />} items={assessment.strengths} /><ResultList title="Recomendações" icon={<Activity className="h-4 w-4" />} items={assessment.recommendations} /></div>
          <div className="grid gap-6 lg:grid-cols-2"><PlanPanel title="Minha autoridade" subtitle={assessment.personalAuthorityPlan?.cycleLabel ?? "Plano permanente"} items={assessment.personalAuthorityPlan?.actions ?? []} highlight={assessment.personalAuthorityPlan?.priority ?? "Evoluir autoridade pessoal com provas reais."} /><div className="share-card rounded-lg p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">{assessment.businessUnitActivationPlan?.horizon ?? "Sprint semanal"}</p><h3 className="mt-1 text-lg font-semibold text-[var(--share-green-950)]">{assessment.businessUnitActivationPlan?.title ?? `Sprint ${selectedBu.name}`}</h3><p className="mt-2 text-sm leading-6 text-zinc-600">{assessment.businessUnitActivationPlan?.objective}</p><div className="mt-4 grid gap-2">{(assessment.businessUnitActivationPlan?.actions ?? []).map((item) => <div key={`${item.day}-${item.focus}`} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-3"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">{item.day} · {item.focus}</p><p className="mt-1 text-sm text-zinc-700">{item.action}</p><p className="mt-1 text-xs text-zinc-500">Área conectada: {item.module}</p></div>)}</div></div></div>

          <section className="share-card rounded-lg p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Próxima melhor ação</p><h3 className="mt-1 text-xl font-semibold text-[var(--share-green-950)]">{buildNextBestAction(assessment).title}</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">{buildNextBestAction(assessment).reason}</p><div className="mt-4 grid gap-2 sm:grid-cols-3"><button type="button" onClick={() => handleNextAction("O que devo fazer agora?")} className="share-button-primary min-h-11 rounded-md px-4 py-2 text-sm font-semibold">O que devo fazer agora?</button><button type="button" onClick={openContentComposer} className="min-h-11 rounded-md border border-[var(--share-green-800)] bg-white px-4 py-2 text-sm font-semibold text-[var(--share-green-900)] hover:bg-[#edf7eb]">Criar conteúdo recomendado</button><button type="button" onClick={generateThirtyDayPlan} disabled={isPlanPending} className="min-h-11 rounded-md border border-[var(--share-line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--share-green-900)] hover:bg-[#edf7eb]">{isPlanPending ? "Gerando plano..." : "Gerar plano de 30 dias"}</button></div>{isPlanPending ? <PlanGenerationStatus /> : null}{actionPanel && actionPanel.eyebrow !== "Sugestão de melhoria" ? <ActionPanelCard panel={actionPanel} /> : null}</section>

          {contentComposerOpen ? <ContentComposer assessment={assessment} brief={contentBrief} setBrief={setContentBrief} draft={contentDraft} isPending={isContentPending} onGenerate={generateContentDraft} onClose={() => setContentComposerOpen(false)} /> : null}
          {thirtyDayPlan ? <ThirtyDayPlanPanel plan={thirtyDayPlan} view={planView} onViewChange={setPlanView} /> : null}
          <section className="share-card rounded-lg p-5"><h3 className="text-lg font-semibold text-[var(--share-green-950)]">Como esta análise foi feita?</h3><p className="mt-2 text-sm leading-6 text-zinc-600">Cada conclusão separa dados encontrados no perfil, informações declaradas, contexto da BU e inferências da IA. Conteúdos e abordagens são entregues como rascunhos para você usar quando fizer sentido.</p><div className="mt-4 grid gap-2 lg:grid-cols-2">{assessment.sources.map((source) => <SourceEvidence key={`${source.confidence}-${source.title}`} source={source} />)}</div></section>
        </div> : null}

        <div className="grid gap-6 lg:grid-cols-2"><div className="share-card rounded-lg p-5"><div className="flex items-center gap-2"><History className="h-4 w-4 text-[var(--share-green-800)]" /><h3 className="font-semibold text-zinc-950">Histórico</h3></div><div className="mt-4 space-y-2">{history.length ? history.map((item) => <div key={item.id} className="flex items-center justify-between rounded-md bg-[#f0f6ed] px-3 py-2 text-sm"><span>{new Date(item.createdAt).toLocaleString("pt-BR")}</span><span className="font-semibold">{item.overallScore}/100</span></div>) : <p className="text-sm text-zinc-500">Sem diagnósticos neste histórico.</p>}</div></div><div className="share-card rounded-lg p-5"><div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-[var(--share-green-800)]" /><h3 className="font-semibold text-zinc-950">Evolução</h3></div><p className="mt-4 text-sm leading-6 text-zinc-600">{comparison?.message ?? "Gere diagnósticos em momentos diferentes e use Comparar evolução para medir o progresso."}</p></div></div>
      </div>
    </section>
  );
}

function buildNextBestAction(assessment: AuthorityAssessment) {
  const weak = assessment.dimensions.slice().sort((a, b) => a.score - b.score)[0];
  const bridge = assessment.bridgeOpportunities?.[0];
  if (assessment.authoritySellingScore < 55) return { title: "Fortaleça sua base antes de acelerar a prospecção", reason: `Sua autoridade ainda tem uma lacuna relevante em ${weak?.label.toLocaleLowerCase("pt-BR") ?? "posicionamento"}. Corrigir essa base tende a aumentar a confiança antes de expor mais a BU.`, actions: ["Revise a sugestão de melhoria da headline e do Sobre.", "Transforme uma experiência real em prova de autoridade.", "Depois refaça o diagnóstico para medir o ganho."] };
  if (assessment.buAffinityScore < 55) return { title: "Crie presença no território da BU antes de abordar", reason: `Sua autoridade pessoal já sustenta conversas, mas a aderência à ${assessment.input.businessUnitName} ainda é baixa. A melhor estratégia é usar a ponte ${bridge?.title ?? "mais natural"} para construir familiaridade sem parecer publicidade.`, actions: ["Crie um conteúdo consultivo pela ponte recomendada.", "Participe de três conversas de decisores relacionadas ao mesmo tema.", "Só depois avance para hunting ou rapport."] };
  return { title: "Transforme autoridade em relacionamento qualificado", reason: `Seu perfil já apresenta boa base e aderência à ${assessment.input.businessUnitName}. O próximo ganho tende a vir de presença nas conversas certas e de abordagens individuais apoiadas em evidências.`, actions: ["Escolha a ponte com maior potencial de conversa.", "Crie um conteúdo ou comentário que abra o tema sem vender cedo demais.", "Selecione decisores e prepare rapport apenas onde houver contexto real."] };
}

function ContentComposer({ assessment, brief, setBrief, draft, isPending, onGenerate, onClose }: { assessment: AuthorityAssessment; brief: ContentBrief; setBrief: React.Dispatch<React.SetStateAction<ContentBrief>>; draft: ContentDraft | null; isPending: boolean; onGenerate: () => void; onClose: () => void }) {
  const objectives: ContentBrief["objective"][] = ["Autoridade", "Conversa", "Provocação", "Valor prático", "Storytelling", "Relacionamento", "Ativação da BU"];
  const strategies: ContentBrief["strategy"][] = ["Recomendada", "Autoridade", "Mais pessoal", "Mais provocativo", "Mais prático", "Mais conversacional"];
  return <section className="share-card rounded-lg p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Inteligência de conteúdo</p><h3 className="mt-1 text-xl font-semibold text-[var(--share-green-950)]">Transforme a melhor ponte em conteúdo que pareça seu</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">O conteúdo cruza seu perfil, a BU, a persona, a ponte escolhida e STEPPS. Tendência só entra quando houver fonte e relevância real.</p></div><button type="button" onClick={onClose} className="text-sm font-semibold text-zinc-500 hover:text-zinc-900">Fechar</button></div><div className="mt-5 grid gap-4 lg:grid-cols-2"><label className="grid gap-1.5"><span className="text-sm font-medium text-zinc-700">Objetivo do conteúdo</span><select value={brief.objective} onChange={(e) => setBrief((v) => ({ ...v, objective: e.target.value as ContentBrief["objective"] }))} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] px-3 py-2 text-sm">{objectives.map((item) => <option key={item}>{item}</option>)}</select></label><label className="grid gap-1.5"><span className="text-sm font-medium text-zinc-700">Ponte</span><select value={brief.bridgeId ?? ""} onChange={(e) => setBrief((v) => ({ ...v, bridgeId: e.target.value }))} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] px-3 py-2 text-sm"><option value="">Escolher automaticamente</option>{assessment.bridgeOpportunities?.map((bridge) => <option key={bridge.id} value={bridge.id}>{bridge.title}</option>)}</select></label><label className="grid gap-1.5 lg:col-span-2"><span className="text-sm font-medium text-zinc-700">Quer colocar algo seu?</span><textarea value={brief.humanContext} onChange={(e) => setBrief((v) => ({ ...v, humanContext: e.target.value }))} rows={3} placeholder="Ex.: Em uma reunião recente, percebi que..." className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] px-3 py-2 text-sm leading-6" /><span className="text-xs text-zinc-500">Opcional. Uma experiência ou opinião real aumenta a naturalidade. A plataforma não inventará histórias em seu nome.</span></label><label className="grid gap-1.5"><span className="text-sm font-medium text-zinc-700">Estratégia</span><select value={brief.strategy} onChange={(e) => setBrief((v) => ({ ...v, strategy: e.target.value as ContentBrief["strategy"] }))} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] px-3 py-2 text-sm">{strategies.map((item) => <option key={item}>{item}</option>)}</select></label><div className="flex items-end"><button type="button" onClick={onGenerate} disabled={isPending} className="share-button-primary min-h-11 w-full rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60">{isPending ? "Interpretando contexto e construindo conteúdo..." : "Analisar e criar conteúdo"}</button></div></div>{draft ? <ContentDraftPanel draft={draft} /> : null}</section>;
}

function ContentDraftPanel({ draft }: { draft: ContentDraft }) { return <div className="mt-6 grid gap-5"><div className="rounded-lg border border-[var(--share-green-800)] bg-[#f4fbef] p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Rascunho para sua revisão</p><h4 className="mt-1 text-lg font-semibold text-[var(--share-green-950)]">{draft.title}</h4><p className="mt-2 text-sm text-zinc-600">A Share AI gera o conteúdo; a publicação no LinkedIn é feita por você.</p><div className="mt-4 whitespace-pre-wrap rounded-md bg-white p-4 text-sm leading-7 text-zinc-800">{draft.post}</div></div><div className="grid gap-4 lg:grid-cols-2"><div className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Por que escrevemos assim?</p><dl className="mt-3 grid gap-2 text-sm text-zinc-700"><div><dt className="font-semibold">Objetivo</dt><dd>{draft.objective}</dd></div><div><dt className="font-semibold">Persona</dt><dd>{draft.persona}</dd></div><div><dt className="font-semibold">Território</dt><dd>{draft.territory}</dd></div><div><dt className="font-semibold">Ponte</dt><dd>{draft.bridge}</dd></div><div><dt className="font-semibold">Momento</dt><dd>{draft.timing}</dd></div></dl></div><div className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">STEPPS e naturalidade</p><p className="mt-3 text-sm font-semibold text-zinc-950">Principal: {draft.primaryStepps.join(" + ")}</p><p className="mt-1 text-sm text-zinc-600">Secundário: {draft.secondaryStepps.join(" + ") || "Não necessário"}</p><p className="mt-3 text-sm font-semibold text-zinc-950">Naturalidade: {draft.naturality}</p><p className="mt-1 text-sm leading-6 text-zinc-600">{draft.naturalityRationale}</p></div></div><div className="rounded-md border border-[var(--share-line)] bg-white p-4"><p className="text-sm font-semibold text-zinc-950">Leitura estratégica</p><ul className="mt-2 space-y-2 text-sm leading-6 text-zinc-600">{draft.whyThisWorks.map((item) => <li key={item}>{item}</li>)}</ul>{draft.trend ? <p className="mt-3 text-xs text-zinc-500">Tendência: {draft.trend.label} · {confidenceLabel(draft.trend.confidence)}{draft.trend.source ? ` · ${draft.trend.source}` : ""}</p> : <p className="mt-3 text-xs text-zinc-500">Nenhuma tendência foi forçada. A pauta pode ser evergreen quando isso produz conteúdo melhor.</p>}</div></div>; }

function buildProfileReviewInsight(item: AuthorityAssessment["profileReview"][number], assessment: AuthorityAssessment, businessUnitShortName: string) {
  const guidance = assessment.input.businessUnitContext ?? buildBusinessUnitGuidance(assessment.input.businessUnitId);
  const territory = guidance.territories[0] ?? assessment.input.businessUnitName;
  const persona = guidance.personas[0] ?? guidance.icps[0] ?? "decisores do ICP";
  const hasValue = item.value.trim().length > 0;
  if (item.field === "headline") return { authoritySignal: hasValue ? "Média" : "Baixa", buSignal: assessment.buAffinityScore >= 70 ? "Alta" : assessment.buAffinityScore >= 45 ? "Média" : "Baixa", emptyState: "Não encontramos uma headline utilizável nesta análise.", analysis: hasValue ? `A headline comunica sua posição atual, mas precisa ser lida em conjunto com o restante do perfil. O ponto central é verificar se a primeira impressão deixa claro pelo que você quer ser lembrado e se existe uma ponte natural com ${businessUnitShortName}.` : "Sem uma headline clara, o perfil perde força logo na primeira impressão e dificulta a associação com um território de autoridade.", suggestion: `Preserve sua identidade profissional e teste uma headline que combine especialidade, público e impacto. Uma direção possível é conectar ${territory} ao valor que você entrega para ${persona}, sem transformar a headline em uma lista de BUs.` };
  if (item.field === "about") return { authoritySignal: hasValue && item.value.length > 180 ? "Alta" : hasValue ? "Média" : "Baixa", buSignal: assessment.activationPotentialScore >= 70 ? "Alta" : assessment.activationPotentialScore >= 45 ? "Média" : "Baixa", emptyState: "Não encontramos conteúdo suficiente na seção Sobre.", analysis: hasValue ? "O Sobre oferece contexto para entender sua trajetória e seu repertório. A oportunidade é transformar descrição profissional em narrativa de autoridade: problema que você resolve, experiência real, provas e perspectiva própria." : "Sem um Sobre consistente, a plataforma tem menos evidências para avaliar profundidade, repertório e coerência de posicionamento.", suggestion: `Reestruture o Sobre em quatro blocos: problema que você ajuda a resolver, repertório que sustenta sua visão, uma ou duas provas reais e uma ponte opcional com ${territory}. A BU deve aparecer como contexto comercial, não como identidade pessoal.` };
  if (item.field === "proofPoints") return { authoritySignal: hasValue ? "Média" : "Baixa", buSignal: hasValue && assessment.buAffinityScore >= 55 ? "Média" : "Baixa", emptyState: "Não encontramos provas concretas suficientes no perfil.", analysis: hasValue ? "Há sinais de trajetória e experiência, mas experiência profissional não é automaticamente prova de autoridade. O que fortalece percepção comercial são resultados, projetos com impacto, cases, depoimentos, reconhecimentos ou entregas verificáveis." : "A trajetória pode ser sólida e ainda assim ficar pouco comprovada no perfil. Sem evidências concretas, o leitor precisa acreditar na autoridade apenas pela descrição.", suggestion: "Escolha duas experiências reais e transforme cada uma em prova: contexto, desafio, sua contribuição e resultado. Se não houver número público, use impacto qualitativo verificável sem inventar métricas." };
  if (item.field === "posts") return { authoritySignal: hasValue ? "Média" : "Não avaliada", buSignal: hasValue ? "Média" : "Não avaliada", emptyState: "Não conseguimos analisar publicações recentes com a fonte atual.", analysis: hasValue ? "Conteúdo recente ajuda a medir consistência temática, profundidade e presença em conversas. A leitura deve considerar qualidade e aderência, não apenas frequência." : "Sem publicações recentes, não é possível afirmar com segurança como você constrói autoridade por conteúdo nem quais temas já geram associação espontânea.", suggestion: `Use conteúdos recentes para consolidar dois ou três territórios pessoais e, quando ${businessUnitShortName} estiver em foco, escolha pautas que criem uma ponte legítima com ${territory}. Não force assunto da BU quando não houver conexão real.` };
  if (item.field === "interactionSignals") return { authoritySignal: hasValue ? "Média" : "Não avaliada", buSignal: hasValue ? "Média" : "Não avaliada", emptyState: "Ainda não temos evidências suficientes para avaliar networking estratégico.", analysis: hasValue ? "Networking estratégico não é quantidade de conexões. O sinal relevante é presença em conversas com pessoas e temas que importam para seu mercado, com contribuições que reforcem repertório e confiança." : "Sem dados sobre interações, comentários e conversas, não é correto atribuir força ou fraqueza ao seu networking estratégico.", suggestion: `Priorize interações de qualidade com ${persona}: comentários substantivos, perguntas específicas e conexões contextualizadas. O objetivo é construir familiaridade antes de qualquer abordagem comercial.` };
  return { authoritySignal: hasValue ? "Média" : "Não avaliada", buSignal: hasValue ? "Média" : "Não avaliada", emptyState: "Não encontramos informação suficiente nesta dimensão.", analysis: hasValue ? "Esta evidência ajuda a contextualizar sua autoridade, mas deve ser interpretada junto das demais seções do perfil." : "Ainda não existem dados suficientes para uma leitura responsável desta dimensão.", suggestion: `Use esta seção para reforçar evidências reais do seu repertório e, quando fizer sentido, criar uma ponte natural com ${territory}.` };
}

function Input({ label, value, onChange, placeholder, icon }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; icon?: React.ReactNode }) { return <label className="grid gap-1.5"><span className="text-sm font-medium text-zinc-700">{label}</span><span className="flex items-center gap-2 rounded-md border border-[var(--share-line)] bg-[#fbfdf8] px-3 py-2 focus-within:border-[var(--share-green-800)] focus-within:bg-white">{icon}<input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400" /></span></label>; }
function Textarea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) { return <label className="grid gap-1.5"><span className="text-sm font-medium text-zinc-700">{label}</span><textarea value={value} rows={rows} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--share-green-800)] focus:bg-white" /></label>; }
function ResultList({ title, icon, items }: { title: string; icon: React.ReactNode; items: string[] }) { return <div className="share-card rounded-lg p-5"><div className="flex items-center gap-2"><span className="text-zinc-500">{icon}</span><h3 className="font-semibold text-[var(--share-green-950)]">{title}</h3></div><ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-600">{items.map((item) => <li key={item}>{item}</li>)}</ul></div>; }
function MetricCard({ label, value }: { label: string; value: number }) { return <div className="rounded-md border border-white/15 bg-white/10 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-white/70">{label}</p><p className="mt-3 text-4xl font-semibold text-[var(--share-lime)]">{value}</p><div className="mt-3 h-2 rounded-full bg-white/15"><div className="h-2 rounded-full bg-[var(--share-lime)]" style={{ width: `${value}%` }} /></div></div>; }
function PlanPanel({ title, subtitle, highlight, items }: { title: string; subtitle: string; highlight: string; items: string[] }) { return <div className="share-card rounded-lg p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">{subtitle}</p><h3 className="mt-1 text-lg font-semibold text-[var(--share-green-950)]">{title}</h3><p className="mt-3 rounded-md bg-[#edf7eb] px-3 py-2 text-sm font-medium text-[var(--share-green-950)]">{highlight}</p><ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-600">{items.map((item) => <li key={item}>{item}</li>)}</ul></div>; }
function SourceEvidence({ source }: { source: AuthorityAssessment["sources"][number] }) { const tone = source.confidence === "confirmed" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : source.confidence === "likely" ? "border-sky-200 bg-sky-50 text-sky-950" : "border-zinc-200 bg-white text-zinc-800"; return <div className={`rounded-md border px-3 py-2 ${tone}`}><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-wide">{confidenceLabel(source.confidence)}</p>{source.url ? <a className="text-xs font-semibold underline-offset-4 hover:underline" href={source.url} target="_blank" rel="noreferrer">Abrir fonte</a> : null}</div><p className="mt-1 text-sm font-semibold">{source.title}</p><p className="mt-1 text-xs leading-5 opacity-75">{source.notes}</p></div>; }
function ActionPanelCard({ panel }: { panel: ActionPanel }) { return <div className="mt-5 rounded-lg border border-[var(--share-green-800)] bg-[#f4fbef] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">{panel.eyebrow}</p><h4 className="mt-1 text-lg font-semibold text-[var(--share-green-950)]">{panel.title}</h4><p className="mt-2 text-sm leading-6 text-zinc-600">{panel.description}</p><div className="mt-3 grid gap-2">{panel.items.map((item) => <p key={item} className="rounded-md border border-[var(--share-line)] bg-white px-3 py-2 text-sm leading-6 text-zinc-700">{item}</p>)}</div></div>; }
function PlanGenerationStatus() { const steps = ["Analisando lacunas", "Revisando sua autoridade", "Cruzando foco da BU", "Analisando melhores pontes", "Priorizando ações"]; return <div className="mt-5 grid gap-2 rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4 sm:grid-cols-2 lg:grid-cols-5">{steps.map((step, index) => <span key={step} className="inline-flex items-center gap-2 text-sm text-zinc-700">{index < steps.length - 1 ? <CheckCircle2 className="h-4 w-4 text-[var(--share-green-800)]" /> : <RefreshCw className="h-4 w-4 animate-spin text-[var(--share-green-800)]" />}{step}</span>)}</div>; }
function ThirtyDayPlanPanel({ plan, view, onViewChange }: { plan: AuthorityThirtyDayPlan; view: "calendar" | "timeline" | "list"; onViewChange: (view: "calendar" | "timeline" | "list") => void }) { return <section className="share-card rounded-lg p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Plano estratégico de 30 dias</p><h3 className="mt-1 text-xl font-semibold text-[var(--share-green-950)]">{plan.title}</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">{plan.summary}</p><p className="mt-2 text-xs leading-5 text-zinc-500">{plan.generationNote}</p></div><div className="inline-flex overflow-hidden rounded-md border border-[var(--share-line)] bg-white text-sm font-semibold text-[var(--share-green-900)]">{(["calendar", "timeline", "list"] as const).map((option) => <button key={option} type="button" onClick={() => onViewChange(option)} className={`px-3 py-2 ${view === option ? "bg-[#edf7eb]" : "hover:bg-[#fbfdf8]"}`}>{option === "calendar" ? "Calendário" : option === "timeline" ? "Linha do tempo" : "Lista"}</button>)}</div></div>{view === "calendar" ? <PlanCalendar actions={plan.actions} /> : view === "list" ? <PlanList actions={plan.actions} /> : <PlanTimeline actions={plan.actions} />}</section>; }
function PlanTimeline({ actions }: { actions: AuthorityThirtyDayPlan["actions"] }) { return <div className="mt-5 grid gap-3">{actions.map((item) => <PlanActionCard key={item.day} item={item} />)}</div>; }
function PlanList({ actions }: { actions: AuthorityThirtyDayPlan["actions"] }) { return <div className="mt-5 divide-y divide-[var(--share-line)] rounded-md border border-[var(--share-line)] bg-white">{actions.map((item) => <div key={item.day} className="grid gap-2 px-4 py-3 md:grid-cols-[70px_1fr_auto] md:items-center"><p className="text-sm font-semibold text-[var(--share-green-950)]">Dia {item.day}</p><div><p className="text-sm font-semibold text-zinc-950">{item.title}</p><p className="mt-1 text-sm leading-6 text-zinc-600">{item.action}</p></div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">{item.scope === "PERSONAL" ? "Pessoal" : "BU"}</p></div>)}</div>; }
function PlanCalendar({ actions }: { actions: AuthorityThirtyDayPlan["actions"] }) { return <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-7">{actions.map((item) => <div key={item.day} className="min-h-28 rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-3"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Dia {item.day}</p><p className="mt-2 text-sm font-semibold text-zinc-950">{item.title}</p><p className="mt-1 line-clamp-3 text-xs leading-5 text-zinc-600">{item.action}</p></div>)}</div>; }
function PlanActionCard({ item }: { item: AuthorityThirtyDayPlan["actions"][number] }) { return <article className="grid gap-3 rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4 md:grid-cols-[76px_1fr_auto] md:items-start"><div className="rounded-md bg-[#edf7eb] px-3 py-2 text-center"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Dia</p><p className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">{item.day}</p></div><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-zinc-950">{item.title}</p><span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-[var(--share-green-800)]">{item.scope === "PERSONAL" ? "Pessoal" : "BU"}</span></div><p className="mt-2 text-sm leading-6 text-zinc-700">{item.action}</p><p className="mt-2 text-xs leading-5 text-zinc-500">Por quê: {item.reason}</p></div><div className="grid gap-1 text-xs text-zinc-600 md:text-right"><span>Impacto: {item.expectedImpact}</span><span>Esforço: {item.effort}</span><span>{item.estimatedTime}</span><span>{item.relatedModule}</span></div></article>; }
function historyStorageKey(businessUnitId: string) { return `share-ai:authority-history:${businessUnitId}`; }
function loadLocalHistory(businessUnitId: string): AuthorityAssessment[] { if (typeof window === "undefined") return []; try { const raw = window.localStorage.getItem(historyStorageKey(businessUnitId)); if (!raw) return []; const parsed = JSON.parse(raw) as AuthorityAssessment[]; return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function saveLocalHistory(assessment: AuthorityAssessment) { if (typeof window === "undefined") return; const current = loadLocalHistory(assessment.input.businessUnitId); const next = mergeHistory([assessment], current).slice(0, historyLimit); window.localStorage.setItem(historyStorageKey(assessment.input.businessUnitId), JSON.stringify(next)); }
function mergeHistory(...groups: AuthorityAssessment[][]) { const byId = new Map<string, AuthorityAssessment>(); groups.flat().forEach((item) => byId.set(item.id, item)); return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
function reportFilename(contentDisposition: string | null) { const match = contentDisposition?.match(/filename="([^"]+)"/i); return match?.[1] || "ShareAI_Diagnostico_LinkedIn.pdf"; }
