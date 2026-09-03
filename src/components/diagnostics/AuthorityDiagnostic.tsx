"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Activity, ArrowRight, BarChart3, CheckCircle2, Download, History, Link, RefreshCw, Sparkles, Target } from "lucide-react";
import type { AuthorityAssessment } from "@/lib/diagnostics/authority";
import type { AuthorityThirtyDayPlan } from "@/lib/diagnostics/authorityPlan";
import { demoBusinessUnits } from "@/lib/tenancy/demo";
import { buildBusinessUnitGuidance, defaultBusinessUnitId, getBusinessUnitStarterInput, isPersonalBusinessContext } from "@/lib/business-units/dna";
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
  firstScore?: number | null;
  latestScore?: number | null;
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
  expertReading: string;
  thesis: string;
  expertTips: string[];
  strategicDecision: { action: string; label: string; rationale: string };
  hook: {
    variants: Array<{ type: string; text: string }>;
    selectedType: string;
    selected: string;
    payoff: string;
  };
  interestGraph: {
    professionalSignal: string;
    inNetworkAction: string;
    outOfNetworkAction: string;
    coherencePrinciple: string;
  };
  commentStrategy: { where: string; suggestion: string };
  circulationPotential: { level: "Baixo" | "Médio" | "Alto"; rationale: string; disclaimer: string };
  trend?: { label: string; source?: string; confidence: "confirmed" | "likely" | "inference" | "unverified" } | null;
};

const historyLimit = 20;

export function AuthorityDiagnostic() {
  const [businessUnitId, setBusinessUnitId] = useState(defaultBusinessUnitId);
  const selectedBu = useMemo(() => demoBusinessUnits.find((item) => item.id === businessUnitId) ?? demoBusinessUnits[0], [businessUnitId]);
  const isPersonalContext = useMemo(() => isPersonalBusinessContext(businessUnitId), [businessUnitId]);
  const [form, setForm] = useState<FormState>(getBusinessUnitStarterInput(businessUnitId));
  const [assessment, setAssessment] = useState<AuthorityAssessment | null>(null);
  const [history, setHistory] = useState<AuthorityAssessment[]>([]);
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
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [profileChangeModalOpen, setProfileChangeModalOpen] = useState(false);
  const [profileChangeCandidate, setProfileChangeCandidate] = useState<string | null>(null);
  const [highlightPlan, setHighlightPlan] = useState(false);
  const planSectionRef = useRef<HTMLDivElement>(null);
  const [contentComposerOpen, setContentComposerOpen] = useState(false);
  const [contentDraft, setContentDraft] = useState<ContentDraft | null>(null);
  const [contentBrief, setContentBrief] = useState<ContentBrief>({ objective: "Autoridade", bridgeId: undefined, humanContext: "", strategy: "Recomendada" });
  const [showSuggestedObjective, setShowSuggestedObjective] = useState(true);
  const canRunDiagnostic = form.profileUrl.includes("linkedin.com/in/") && form.objective.trim().length >= 10;
  const suggestedObjective = useMemo(() => getBusinessUnitStarterInput(businessUnitId).objective, [businessUnitId]);
  const contextHeading = isPersonalContext ? "Contexto profissional" : "Unidade de Negócio";
  const affinityMetricLabel = isPersonalContext ? "Aderência ao seu foco" : `Aderência à ${selectedBu.shortName}`;
  const activationMetricLabel = isPersonalContext ? "Potencial de posicionamento" : "Potencial de ativação";

  useEffect(() => {
    void fetch("/api/profile", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const result = await response.json() as { profile?: { linkedinUrl?: string | null } | null };
      if (result.profile?.linkedinUrl) setForm((current) => ({ ...current, profileUrl: result.profile!.linkedinUrl! }));
    });
    void refreshHistory(defaultBusinessUnitId, { restoreLatest: true });
    // Initial hydration intentionally runs once; subsequent BU changes call refreshHistory explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshHistory(targetBusinessUnitId = businessUnitId, options: { restoreLatest?: boolean } = {}) {
    try {
      const response = await fetch(`/api/diagnostics/authority/history?businessUnitId=${targetBusinessUnitId}`);
      const result = (await response.json()) as { items?: AuthorityAssessment[] };
      const items = (result.items ?? []).slice(0, historyLimit);
      setHistory(items);
      if (options.restoreLatest) {
        const latest = items[0] ?? null;
        setAssessment(latest);
        if (latest?.id) void loadSavedPlan(latest.id);
      }
      return items;
    } catch {
      setHistory([]);
      if (options.restoreLatest) setAssessment(null);
      return [];
    }
  }

  async function loadSavedPlan(assessmentId: string) {
    try {
      const response = await fetch(`/api/diagnostics/authority/plan?assessmentId=${encodeURIComponent(assessmentId)}`, { cache: "no-store" });
      const result = await response.json() as { plan?: AuthorityThirtyDayPlan | null };
      setThirtyDayPlan(response.ok ? result.plan ?? null : null);
    } catch {
      setThirtyDayPlan(null);
    }
  }

  function switchBu(nextBusinessUnitId: string) {
    setBusinessUnitId(nextBusinessUnitId);
    setForm((current) => ({ ...getBusinessUnitStarterInput(nextBusinessUnitId), profileUrl: current.profileUrl }));
    setAssessment(null);
    setHistory([]);
    setComparison(null);
    setActionPanel(null);
    setThirtyDayPlan(null);
    setContentComposerOpen(false);
    setContentDraft(null);
    setShowSuggestedObjective(true);
    void refreshHistory(nextBusinessUnitId, { restoreLatest: true });
  }

  function updateField(key: keyof FormState, value: string) {
    if (
      key === "profileUrl"
      && assessment
      && /linkedin\.com\/in\//i.test(value)
      && normalizeLinkedInUrl(value) !== normalizeLinkedInUrl(assessment.input.profileUrl ?? "")
    ) {
      setForm((current) => ({ ...current, profileUrl: value }));
      setProfileChangeCandidate(value);
      setProfileChangeModalOpen(true);
      return;
    }
    setForm((current) => ({ ...current, [key]: value }));
  }

  function useSuggestedObjective() {
    updateField("objective", suggestedObjective);
    setShowSuggestedObjective(false);
  }

  function confirmProfileChange() {
    setAssessment(null);
    setThirtyDayPlan(null);
    setActionPanel(null);
    setContentComposerOpen(false);
    setContentDraft(null);
    setComparison(null);
    setProfileChangeCandidate(null);
    setProfileChangeModalOpen(false);
    setShowSuggestedObjective(true);
  }

  function cancelProfileChange() {
    setForm((current) => ({ ...current, profileUrl: assessment?.input.profileUrl ?? current.profileUrl }));
    setProfileChangeCandidate(null);
    setProfileChangeModalOpen(false);
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
      setAssessment(nextAssessment);
      setActionPanel(null);
      setThirtyDayPlan(null);
      setContentComposerOpen(false);
      setContentDraft(null);
      await refreshHistory(businessUnitId);
      setCollectionSteps([]);
      setShowSuggestedObjective(true);
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
    if (first?.overallScore === null || latest?.overallScore === null) {
      return { available: false, delta: 0, firstScore: first?.overallScore, latestScore: latest?.overallScore, message: "A comparação exige dois diagnósticos com evidências suficientes para pontuação." };
    }
    const delta = latest ? latest.overallScore - first.overallScore : 0;
    return { available: true, delta, firstScore: first.overallScore, latestScore: latest?.overallScore, message: `Evolução de ${delta} pontos desde o primeiro diagnóstico.` };
  }

  const authoritySellingScore = assessment?.authoritySellingScore ?? assessment?.overallScore ?? null;
  const buAffinityScore = assessment?.buAffinityScore ?? null;
  const activationPotentialScore = assessment?.activationPotentialScore ?? null;
  const authorityClassification = assessment?.authorityClassification || legacyAuthorityClassification(authoritySellingScore);
  const scoreCoverage = assessment?.scoreCoverage ?? legacyScoreCoverage(assessment);
  const scoreExplanations = assessment?.scoreExplanations ?? {
    authority: "Pontuação preservada do diagnóstico histórico.",
    businessUnitAffinity: "Aderência registrada no momento deste diagnóstico.",
    activationPotential: "Potencial de ativação registrado no momento deste diagnóstico.",
  };
  const nextBestAction = assessment?.nextBestAction ?? (assessment ? {
    action: "ANALYSIS",
    title: assessment.personalAuthorityPlan?.priority || assessment.recommendations?.[0] || "Revisar evidências",
    reason: assessment.summary || "O próximo movimento depende das evidências preservadas neste diagnóstico.",
    actions: assessment.personalAuthorityPlan?.actions ?? assessment.nextActions ?? [],
  } : null);
  const authorityPerception = assessment?.authorityPerception ?? null;
  const authorityMap = assessment?.authorityMap ?? [];
  const commercialExposure = assessment?.commercialExposure ?? [];
  const strategicGaps = assessment?.strategicGaps ?? [];
  const assessmentSources = assessment?.sources ?? [];

  function generateThirtyDayPlan() {
    if (!assessment) return;
    setFormError(null);
    setActionPanel(null);
    startPlanTransition(async () => {
      try {
        const response = await fetch("/api/diagnostics/authority/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assessmentId: assessment.id }) });
        const result = (await response.json()) as AuthorityThirtyDayPlan | { error?: string };
        if (!response.ok) return setFormError("error" in result && result.error ? result.error : "Não foi possível gerar o plano de 30 dias.");
        setThirtyDayPlan(result as AuthorityThirtyDayPlan);
        setHighlightPlan(false);
      } catch {
        setFormError("Não foi possível gerar o plano de 30 dias. Tente novamente.");
      }
    });
  }

  function openBridge(bridge: NonNullable<AuthorityAssessment["bridgeOpportunities"]>[number]) {
    setActionPanel({ eyebrow: "Construir pontes", title: bridge.title, description: bridge.description, items: [`Sua autoridade: ${bridge.whyItWorks.personalAuthority}`, `${isPersonalContext ? "Conexão com seu foco" : "Conexão com a BU"}: ${bridge.whyItWorks.businessUnitConnection}`, `Interesse da persona: ${bridge.whyItWorks.personaInterest}`, `Momento de mercado: ${bridge.whyItWorks.marketMoment}`, `Risco: ${bridge.whyItWorks.risk}`] });
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

  async function downloadReport(skipPlanCheck = false) {
    if (!assessment || isReportPending) return;
    if (!skipPlanCheck && !thirtyDayPlan) {
      setDownloadModalOpen(true);
      return;
    }
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

  function showPlanBeforeDownload() {
    setDownloadModalOpen(false);
    setHighlightPlan(true);
    window.setTimeout(() => planSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <aside className="share-card space-y-4 rounded-lg p-5">
        <div><div className="h-2 w-44 rounded-r-md share-tab-accent" style={{ "--accent-color": selectedBu.brandPack.accent } as React.CSSProperties} /><p className="mt-5 text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">{contextHeading}</p><h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">{selectedBu.name}</h2><p className="mt-2 text-sm leading-6 text-zinc-600">{selectedBu.description}</p></div>
        <div className="grid gap-2">{demoBusinessUnits.map((unit) => <button key={unit.id} type="button" onClick={() => switchBu(unit.id)} className={`rounded-md border px-3 py-3 text-left text-sm transition ${unit.id === businessUnitId ? "border-[var(--share-green-950)] bg-[var(--share-green-950)] text-white" : "border-[var(--share-line)] bg-white text-zinc-700 hover:border-[var(--share-green-700)]"}`}><span className="flex items-center justify-between gap-3"><span>{unit.name}</span><span className="h-2 w-9 rounded-full" style={{ backgroundColor: unit.brandPack.accent }} /></span></button>)}</div>
        <div className="rounded-md p-3 text-sm text-zinc-700" style={{ backgroundColor: selectedBu.brandPack.surface }}><p className="font-medium text-[var(--share-green-950)]">Contexto ativo</p><p className="mt-1">Tom: {selectedBu.brandPack.voice}</p><p className="mt-1">{isPersonalContext ? "As recomendações usam seu objetivo, sua trajetória e o mercado profissional que você quer alcançar." : "As recomendações usam a linguagem e os temas desta BU."}</p></div>
      </aside>

      <div className="space-y-6">
        <div className="share-card rounded-lg p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Diagnóstico guiado</p><h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">Diagnóstico de autoridade comercial</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">Avalia se um potencial cliente percebe profundidade, repertório e confiança comercial no perfil.</p>
          <div className="mt-5 grid gap-4"><Input icon={<Link className="h-4 w-4 text-[#0a66c2]" />} label="URL do seu perfil no LinkedIn" placeholder="https://www.linkedin.com/in/seu-perfil" value={form.profileUrl} onChange={(value) => updateField("profileUrl", value)} />{showSuggestedObjective ? <div className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">{isPersonalContext ? "Objetivo sugerido para seu perfil" : "Objetivo sugerido pela BU"}</p><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-700">{suggestedObjective}</p></div><button type="button" onClick={useSuggestedObjective} className="rounded-md border border-[var(--share-green-800)] px-3 py-2 text-sm font-semibold text-[var(--share-green-900)] hover:bg-[#edf7eb]">Usar sugestão</button></div></div> : null}<Input label={isPersonalContext ? "Objetivo profissional" : "Objetivo comercial"} value={form.objective} onChange={(value) => updateField("objective", value)} /><details className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-3"><summary className="cursor-pointer text-sm font-semibold text-[var(--share-green-900)]">Complementar manualmente</summary><div className="mt-4 grid gap-4"><Input label="Headline do LinkedIn" value={form.headline} onChange={(value) => updateField("headline", value)} /><Textarea label="Sobre" value={form.about} onChange={(value) => updateField("about", value)} rows={4} /><Input label="Temas de autoridade" value={form.themes} onChange={(value) => updateField("themes", value)} /><Textarea label="Provas, cases e resultados" value={form.proofPoints} onChange={(value) => updateField("proofPoints", value)} /><Textarea label="Conteúdos recentes" value={form.recentContent} onChange={(value) => updateField("recentContent", value)} /><Textarea label="Interações e networking" value={form.interactionSignals} onChange={(value) => updateField("interactionSignals", value)} /></div></details></div>
          {isPending && collectionSteps.length ? <div className="mt-5 grid gap-2 rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4 sm:grid-cols-2 lg:grid-cols-4">{collectionSteps.map((step, index) => <span key={step} className="inline-flex items-center gap-2 text-sm text-zinc-700">{index < collectionSteps.length - 1 ? <CheckCircle2 className="h-4 w-4 text-[var(--share-green-800)]" /> : <RefreshCw className="h-4 w-4 animate-spin text-[var(--share-green-800)]" />}{step}</span>)}</div> : null}
          {formError ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p> : null}
          <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={runDiagnostic} className="share-button-primary inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55" disabled={isPending}><Sparkles className="h-4 w-4" />{assessment ? "Refazer diagnóstico" : "Analisar meu LinkedIn"}</button><button type="button" onClick={compareEvolution} className="inline-flex items-center gap-2 rounded-md border border-[var(--share-green-800)] px-4 py-2 text-sm font-semibold text-[var(--share-green-900)] hover:bg-[#edf7eb]"><BarChart3 className="h-4 w-4" />Comparar evolução</button></div>
        </div>

        {assessment ? <div className="grid gap-6">
          <section className="share-green-panel rounded-lg p-6 text-white">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-lime)]">Resumo executivo de autoridade</p><h3 className="mt-2 text-2xl font-semibold">{authorityClassification}</h3><p className="mt-2 text-sm text-white/70">Perfil analisado: {assessment.analyzedProfileName || "Nome não identificado"}</p></div>
              <button type="button" onClick={() => downloadReport()} disabled={isReportPending} className="inline-flex items-center gap-2 rounded-md border border-white/25 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-wait disabled:opacity-60"><Download className="h-4 w-4" />{isReportPending ? "Preparando relatório..." : "Baixar relatório executivo"}</button>
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
              <div className="border-b border-white/15 pb-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6"><p className="text-sm text-white/70">Pontuação de autoridade comercial</p><div className="mt-2 flex items-end gap-2"><span className="text-7xl font-semibold text-[var(--share-lime)]">{scoreText(authoritySellingScore)}</span>{authoritySellingScore !== null ? <span className="pb-2 text-white/70">/100</span> : null}</div><p className="mt-3 text-xs text-white/65">{authoritySellingScore === null ? "Sem pontuação por falta de evidência compatível." : `Cobertura de evidências: ${scoreCoverage}%`}</p></div>
              <div><p className="max-w-3xl text-base leading-7 text-white/85">{assessment.summary}</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><CompactMetric label={affinityMetricLabel} value={buAffinityScore} explanation={scoreExplanations.businessUnitAffinity} /><CompactMetric label={activationMetricLabel} value={activationPotentialScore} explanation={scoreExplanations.activationPotential} /></div>{nextBestAction ? <div className="mt-5 rounded-md border border-white/15 bg-white/10 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-lime)]">Prioridade</p><p className="mt-1 font-semibold">{nextBestAction.title}</p><p className="mt-2 text-sm leading-6 text-white/75">{nextBestAction.reason}</p></div> : null}{assessment.input.profileUrl ? <a className="mt-4 inline-flex text-sm font-semibold text-[var(--share-lime)] underline-offset-4 hover:underline" href={assessment.input.profileUrl} target="_blank" rel="noreferrer">Perfil avaliado no LinkedIn</a> : null}</div>
            </div>
          </section>

          {authorityPerception ? <section className="share-card rounded-lg p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Autoridade construída × percebida</p><h3 className="mt-1 text-xl font-semibold text-[var(--share-green-950)]">O que sua trajetória sustenta e o que o LinkedIn deixa visível</h3><div className="mt-4 grid gap-3 md:grid-cols-3"><ExecutiveReading label="Construída" level={authorityPerception.builtLevel} text={authorityPerception.builtAuthority} /><ExecutiveReading label="Percebida" level={authorityPerception.perceivedLevel} text={authorityPerception.perceivedAuthority} /><ExecutiveReading label="Gap de expressão" level="Prioridade" text={authorityPerception.expressionGap} /></div></section> : null}

          {authorityMap.length ? <section className="share-card rounded-lg p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Mapa de autoridade</p><h3 className="mt-1 text-xl font-semibold text-[var(--share-green-950)]">Em quais territórios sua autoridade se sustenta</h3><div className="mt-4 grid gap-3 lg:grid-cols-2">{authorityMap.map((item) => <article key={item.territory} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><h4 className="font-semibold text-zinc-950">{item.territory}</h4><span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-[var(--share-green-900)]">Força {item.currentStrength}</span></div><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Evidências essenciais</p><ul className="mt-2 space-y-1 text-sm leading-6 text-zinc-700">{item.evidence.length ? item.evidence.slice(0, 3).map((evidence) => <li key={evidence}>{evidence}</li>) : <li>Dados ainda insuficientes para confirmar este território.</li>}</ul><div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-600"><span>Confiança: {confidenceLabel(item.credibility)}</span><span>Visibilidade: {item.publicVisibility}</span><span>Potencial: {item.potential}</span></div></article>)}</div></section> : null}

          <section className="share-card rounded-lg p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">O que encontramos no seu perfil</p><h3 className="mt-1 text-xl font-semibold text-[var(--share-green-950)]">Evidências que sustentam o diagnóstico</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">Mostramos o dado encontrado, a leitura estratégica e uma sugestão de melhoria. {isPersonalContext ? "Seu objetivo profissional funciona como lente de leitura, sem tentar encaixar sua marca pessoal em uma oferta da Share." : "A BU funciona como lente comercial, sem substituir sua marca pessoal."}</p><div className="mt-4 grid gap-3 lg:grid-cols-2">{(assessment.profileReview ?? []).map((item) => { const insight = buildProfileReviewInsight(item, assessment, selectedBu.shortName); return <article key={item.field} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-zinc-950">{item.label}</p><p className="mt-1 text-xs text-zinc-500">Fonte: {publicSourceText(item.sourceLabel)} · {confidenceLabel(item.confidence)}</p></div><button type="button" onClick={() => openProfileImprovement(item)} className="text-sm font-semibold text-[var(--share-green-900)] underline-offset-4 hover:underline">Sugestão de melhoria</button></div><div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Encontramos</p><p className="mt-1 line-clamp-4 text-sm leading-6 text-zinc-700">{item.value || insight.emptyState}</p></div><div className="mt-4 border-t border-[var(--share-line)] pt-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Leitura do especialista</p><p className="mt-2 text-sm leading-6 text-zinc-700">{insight.analysis}</p><div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-white px-2.5 py-1 text-[var(--share-green-900)]">Autoridade pessoal: {insight.authoritySignal}</span><span className="rounded-full bg-white px-2.5 py-1 text-[var(--share-green-900)]">{isPersonalContext ? "Aderência ao foco" : `Aderência à ${selectedBu.shortName}`}: {insight.buSignal}</span></div></div></article>; })}</div>{actionPanel?.eyebrow === "Sugestão de melhoria" ? <ActionPanelCard panel={actionPanel} /> : null}</section>

          <section className="share-card rounded-lg p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">{isPersonalContext ? "Você × foco profissional" : "Você × BU"}</p><h3 className="mt-1 text-xl font-semibold text-[var(--share-green-950)]">Onde já existe ponte e onde existe lacuna</h3><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-zinc-500"><tr><th className="border-b border-[var(--share-line)] py-2">Tema</th><th className="border-b border-[var(--share-line)] py-2">Você</th><th className="border-b border-[var(--share-line)] py-2">{isPersonalContext ? "Foco" : "BU"}</th><th className="border-b border-[var(--share-line)] py-2">Aderência</th><th className="border-b border-[var(--share-line)] py-2">Leitura</th></tr></thead><tbody>{(assessment.themeAlignment ?? []).map((item) => <tr key={item.theme} className="border-b border-[var(--share-line)] last:border-0"><td className="py-3 font-medium text-zinc-950">{item.theme}</td><td className="py-3 text-zinc-700">{item.personSignal}</td><td className="py-3 text-zinc-700">{item.businessUnitSignal}</td><td className="py-3 font-semibold text-zinc-950">{item.affinity}/100</td><td className="py-3 text-zinc-600">{item.gap}</td></tr>)}</tbody></table></div></section>

          <section className="share-card rounded-lg p-5"><div className="flex items-center gap-2"><Target className="h-4 w-4 text-[var(--share-green-800)]" /><h3 className="text-lg font-semibold text-[var(--share-green-950)]">Melhores pontes</h3></div><div className="mt-4 grid gap-3 lg:grid-cols-2">{(assessment.bridgeOpportunities ?? []).map((bridge) => <button key={bridge.id} type="button" onClick={() => openBridge(bridge)} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4 text-left transition hover:border-[var(--share-green-800)] hover:bg-white"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-zinc-950">{bridge.title}</p><p className="mt-2 text-sm leading-6 text-zinc-600">{bridge.description}</p></div><ArrowRight className="h-4 w-4 shrink-0 text-[var(--share-green-800)]" /></div><div className="mt-3 grid grid-cols-3 gap-2 text-xs text-zinc-600"><span>Você: {bridge.personAffinity}</span><span>{isPersonalContext ? "Foco" : "BU"}: {bridge.businessUnitAffinity}</span><span>Conversa: {bridge.conversationPotential}</span></div></button>)}</div></section>

          <section className="share-card rounded-lg p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Inteligência de exposição comercial</p><h3 className="mt-1 text-xl font-semibold text-[var(--share-green-950)]">O que explorar, reformular ou reduzir</h3><div className="mt-4 grid gap-3 lg:grid-cols-2">{commercialExposure.length ? commercialExposure.map((item) => <article key={`${item.classification}-${item.evidence}`} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">{commercialExposureLabel(item.classification)}</span><span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">{item.recommendation}</span></div><p className="mt-3 text-sm font-medium leading-6 text-zinc-900">{item.evidence}</p><p className="mt-2 text-sm leading-6 text-zinc-600">{item.rationale}</p><p className="mt-3 text-xs text-zinc-500">Valor para o cliente: {item.clientValue} · Exposição à concorrência: {item.competitorExposure}</p></article>) : <p className="text-sm text-zinc-500">Não há evidência pública suficiente para avaliar exposição competitiva.</p>}</div></section>

          {strategicGaps.length ? <section className="share-card rounded-lg p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Agenda estratégica de autoridade</p><h3 className="mt-1 text-xl font-semibold text-[var(--share-green-950)]">Onde a autoridade pede decisão</h3><p className="mt-2 text-sm leading-6 text-zinc-600">Lacunas priorizadas por impacto em percepção e conversa comercial. Ausência de dado aparece como limite de avaliação, não como nota baixa.</p><div className="mt-4 grid gap-4">{strategicGaps.map((gap) => <article key={gap.title} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-zinc-950">{gap.title}</p><p className="mt-1 text-xs text-zinc-500">Prioridade {gap.priority} · {gap.confidence === "not_evaluated" ? "Não avaliado" : confidenceLabel(gap.confidence)}</p></div><span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-[var(--share-green-900)]">{gap.nextBestAction}</span></div><div className="mt-4 grid gap-3 md:grid-cols-2"><StrategicGapField label="Diagnóstico" text={gap.diagnosis} /><StrategicGapField label="Leitura especialista" text={gap.expertReading} /><StrategicGapField label="Impacto em autoridade" text={gap.authorityImpact} /><StrategicGapField label="Impacto comercial" text={gap.commercialImpact} /></div>{gap.competitiveExposure ? <StrategicGapField label="Exposição competitiva" text={gap.competitiveExposure} /> : null}{gap.evidence.length ? <p className="mt-3 text-xs leading-5 text-zinc-500">Evidência: {gap.evidence.join(" · ")}</p> : null}<p className="mt-3 rounded-md bg-white px-3 py-2 text-sm leading-6 text-zinc-700"><strong>Recomendação:</strong> {gap.recommendation}</p></article>)}</div></section> : null}

          <div className="grid gap-6 lg:grid-cols-2"><ResultList title="Pontos fortes" icon={<CheckCircle2 className="h-4 w-4" />} items={assessment.strengths} /><ResultList title="Recomendações" icon={<Activity className="h-4 w-4" />} items={assessment.recommendations} /></div>
          <div className="grid gap-6 lg:grid-cols-2"><PlanPanel title="Minha autoridade" subtitle={assessment.personalAuthorityPlan?.cycleLabel ?? "Plano permanente"} items={assessment.personalAuthorityPlan?.actions ?? []} highlight={assessment.personalAuthorityPlan?.priority ?? "Evoluir autoridade pessoal com provas reais."} /><div className="share-card rounded-lg p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">{assessment.businessUnitActivationPlan?.horizon ?? "Sprint semanal"}</p><h3 className="mt-1 text-lg font-semibold text-[var(--share-green-950)]">{assessment.businessUnitActivationPlan?.title ?? (isPersonalContext ? "Sprint de posicionamento" : `Sprint ${selectedBu.name}`)}</h3><p className="mt-2 text-sm leading-6 text-zinc-600">{assessment.businessUnitActivationPlan?.objective}</p><div className="mt-4 grid gap-2">{(assessment.businessUnitActivationPlan?.actions ?? []).map((item) => <div key={`${item.day}-${item.focus}`} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-3"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">{item.day} · {item.focus}</p><p className="mt-1 text-sm text-zinc-700">{item.action}</p><p className="mt-1 text-xs text-zinc-500">{isPersonalContext ? "Foco relacionado" : "Área conectada"}: {item.module}</p></div>)}</div></div></div>

          <section className="share-card rounded-lg p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Próxima melhor ação</p><h3 className="mt-1 text-xl font-semibold text-[var(--share-green-950)]">{nextBestAction?.title}</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">{nextBestAction?.reason}</p><div className="mt-4 grid gap-2 sm:grid-cols-3"><button type="button" onClick={openContentComposer} className="min-h-11 rounded-md border border-[var(--share-green-800)] bg-white px-4 py-2 text-sm font-semibold text-[var(--share-green-900)] hover:bg-[#edf7eb]">Criar conteúdo recomendado</button><button type="button" onClick={generateThirtyDayPlan} disabled={isPlanPending} className="share-button-primary min-h-11 rounded-md px-4 py-2 text-sm font-semibold">{isPlanPending ? "Gerando plano..." : "Gerar plano estratégico de 30 dias"}</button><button type="button" onClick={() => downloadReport()} disabled={isReportPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[var(--share-green-800)] bg-white px-4 py-2 text-sm font-semibold text-[var(--share-green-900)] hover:bg-[#edf7eb] disabled:cursor-wait disabled:opacity-60"><Download className="h-4 w-4" />{isReportPending ? "Preparando..." : "Baixar diagnóstico"}</button></div>{isPlanPending ? <PlanGenerationStatus /> : null}{actionPanel && actionPanel.eyebrow !== "Sugestão de melhoria" ? <ActionPanelCard panel={actionPanel} /> : null}</section>

          {contentComposerOpen ? <ContentComposer assessment={assessment} brief={contentBrief} setBrief={setContentBrief} draft={contentDraft} isPending={isContentPending} onGenerate={generateContentDraft} onClose={() => setContentComposerOpen(false)} personalContext={isPersonalContext} /> : null}
          <div ref={planSectionRef} className={highlightPlan ? "rounded-lg ring-4 ring-[var(--share-lime)] ring-offset-4" : ""}>{thirtyDayPlan ? <ThirtyDayPlanPanel plan={thirtyDayPlan} view={planView} onViewChange={setPlanView} /> : highlightPlan ? <section className="share-card rounded-lg p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Plano de 30 dias</p><h3 className="mt-1 text-xl font-semibold text-[var(--share-green-950)]">Gere o plano antes de baixar</h3><p className="mt-2 text-sm leading-6 text-zinc-600">A geração é uma ação consciente e ficará salva neste diagnóstico.</p><button type="button" onClick={generateThirtyDayPlan} disabled={isPlanPending} className="share-button-primary mt-4 rounded-md px-4 py-2 text-sm font-semibold">{isPlanPending ? "Gerando plano..." : "Gerar plano agora"}</button></section> : null}</div>
          <section className="share-card rounded-lg p-5"><h3 className="text-lg font-semibold text-[var(--share-green-950)]">Como esta análise foi feita?</h3><p className="mt-2 text-sm leading-6 text-zinc-600">Cada conclusão separa dados encontrados no perfil, informações declaradas, contexto ativo e inferências da IA. Conteúdos e abordagens são entregues como rascunhos para você usar quando fizer sentido.</p><div className="mt-4 grid gap-2 lg:grid-cols-2">{assessmentSources.map((source) => <SourceEvidence key={`${source.confidence}-${source.title}`} source={source} />)}</div></section>
        </div> : null}

          <div className="grid gap-6 lg:grid-cols-2"><div className="share-card rounded-lg p-5"><div className="flex items-center gap-2"><History className="h-4 w-4 text-[var(--share-green-800)]" /><h3 className="font-semibold text-zinc-950">Histórico</h3></div><div className="mt-4 space-y-2">{history.length ? history.map((item) => <button type="button" key={item.id} onClick={() => { setAssessment(item); void loadSavedPlan(item.id); }} className="flex w-full items-center justify-between rounded-md bg-[#f0f6ed] px-3 py-2 text-left text-sm hover:bg-[#e4f0df]"><span>{new Date(item.createdAt).toLocaleString("pt-BR")}</span><span className="font-semibold">{item.overallScore === null ? "Não avaliado" : `${item.overallScore}/100`}</span></button>) : <p className="text-sm text-zinc-500">Sem diagnósticos neste histórico.</p>}</div></div><div className="share-card rounded-lg p-5"><div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-[var(--share-green-800)]" /><h3 className="font-semibold text-zinc-950">Evolução</h3></div><p className="mt-4 text-sm leading-6 text-zinc-600">{comparison?.message ?? "Gere diagnósticos em momentos diferentes e use Comparar evolução para medir o progresso."}</p></div></div>
        {downloadModalOpen ? <DownloadReportModal onGenerateFirst={showPlanBeforeDownload} onDownloadWithoutPlan={() => { setDownloadModalOpen(false); void downloadReport(true); }} onCancel={() => setDownloadModalOpen(false)} /> : null}
        {profileChangeModalOpen ? <ProfileChangeModal profileUrl={profileChangeCandidate} onConfirm={confirmProfileChange} onCancel={cancelProfileChange} /> : null}
      </div>
    </section>
  );
}

function ContentComposer({ assessment, brief, setBrief, draft, isPending, onGenerate, onClose, personalContext }: { assessment: AuthorityAssessment; brief: ContentBrief; setBrief: React.Dispatch<React.SetStateAction<ContentBrief>>; draft: ContentDraft | null; isPending: boolean; onGenerate: () => void; onClose: () => void; personalContext: boolean }) {
  const objectives: ContentBrief["objective"][] = personalContext ? ["Autoridade", "Conversa", "Provocação", "Valor prático", "Storytelling", "Relacionamento"] : ["Autoridade", "Conversa", "Provocação", "Valor prático", "Storytelling", "Relacionamento", "Ativação da BU"];
  const strategies: ContentBrief["strategy"][] = ["Recomendada", "Autoridade", "Mais pessoal", "Mais provocativo", "Mais prático", "Mais conversacional"];
  return <section className="share-card rounded-lg p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Inteligência de conteúdo</p><h3 className="mt-1 text-xl font-semibold text-[var(--share-green-950)]">Transforme a melhor ponte em conteúdo que pareça seu</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">{personalContext ? "O conteúdo cruza seu perfil, seu objetivo profissional, as melhores pontes e STEPPS. Tendência só entra quando houver fonte e relevância real." : "O conteúdo cruza seu perfil, a BU, a persona, a ponte escolhida e STEPPS. Tendência só entra quando houver fonte e relevância real."}</p></div><button type="button" onClick={onClose} className="text-sm font-semibold text-zinc-500 hover:text-zinc-900">Fechar</button></div><div className="mt-5 grid gap-4 lg:grid-cols-2"><label className="grid gap-1.5"><span className="text-sm font-medium text-zinc-700">Objetivo do conteúdo</span><select value={brief.objective} onChange={(e) => setBrief((v) => ({ ...v, objective: e.target.value as ContentBrief["objective"] }))} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] px-3 py-2 text-sm">{objectives.map((item) => <option key={item}>{item}</option>)}</select></label><label className="grid gap-1.5"><span className="text-sm font-medium text-zinc-700">Ponte</span><select value={brief.bridgeId ?? ""} onChange={(e) => setBrief((v) => ({ ...v, bridgeId: e.target.value }))} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] px-3 py-2 text-sm"><option value="">Escolher automaticamente</option>{assessment.bridgeOpportunities?.map((bridge) => <option key={bridge.id} value={bridge.id}>{bridge.title}</option>)}</select></label><label className="grid gap-1.5 lg:col-span-2"><span className="text-sm font-medium text-zinc-700">Quer colocar algo seu?</span><textarea value={brief.humanContext} onChange={(e) => setBrief((v) => ({ ...v, humanContext: e.target.value }))} rows={3} placeholder="Ex.: Em uma reunião recente, percebi que..." className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] px-3 py-2 text-sm leading-6" /><span className="text-xs text-zinc-500">Opcional. Uma experiência ou opinião real aumenta a naturalidade. A plataforma não inventará histórias em seu nome.</span></label><label className="grid gap-1.5"><span className="text-sm font-medium text-zinc-700">Estratégia</span><select value={brief.strategy} onChange={(e) => setBrief((v) => ({ ...v, strategy: e.target.value as ContentBrief["strategy"] }))} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] px-3 py-2 text-sm">{strategies.map((item) => <option key={item}>{item}</option>)}</select></label><div className="flex items-end"><button type="button" onClick={onGenerate} disabled={isPending} className="share-button-primary min-h-11 w-full rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60">{isPending ? "Interpretando contexto e construindo conteúdo..." : "Analisar e criar conteúdo"}</button></div></div>{draft ? <ContentDraftPanel draft={draft} /> : null}</section>;
}

function ContentDraftPanel({ draft }: { draft: ContentDraft }) { return <div className="mt-6 grid gap-5"><div className="rounded-lg border border-[var(--share-green-800)] bg-[#f4fbef] p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Rascunho para sua revisão</p><h4 className="mt-1 text-lg font-semibold text-[var(--share-green-950)]">{draft.title}</h4><p className="mt-2 text-sm font-semibold text-[var(--share-green-900)]">{draft.strategicDecision.label}</p><p className="mt-1 text-sm text-zinc-600">A Share AI gera o conteúdo; a publicação no LinkedIn é feita por você.</p><div className="mt-4 whitespace-pre-wrap rounded-md bg-white p-4 text-sm leading-7 text-zinc-800">{draft.post}</div></div><div className="grid gap-4 lg:grid-cols-2"><div className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Estratégia de conexão</p><dl className="mt-3 grid gap-2 text-sm text-zinc-700"><div><dt className="font-semibold">Tese</dt><dd>{draft.thesis}</dd></div><div><dt className="font-semibold">Gancho escolhido</dt><dd>{draft.hook.selected}</dd></div><div><dt className="font-semibold">Entrega do gancho</dt><dd>{draft.hook.payoff}</dd></div><div><dt className="font-semibold">Potencial de circulação: {draft.circulationPotential.level}</dt><dd>{draft.circulationPotential.rationale}</dd></div></dl><p className="mt-3 text-xs leading-5 text-zinc-500">{draft.circulationPotential.disclaimer}</p></div><div className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">STEPPS e naturalidade</p><p className="mt-3 text-sm font-semibold text-zinc-950">Principal: {draft.primaryStepps.join(" + ")}</p><p className="mt-1 text-sm text-zinc-600">Secundário: {draft.secondaryStepps.join(" + ") || "Não necessário"}</p><p className="mt-3 text-sm font-semibold text-zinc-950">Naturalidade: {draft.naturality}</p><p className="mt-1 text-sm leading-6 text-zinc-600">{draft.naturalityRationale}</p><p className="mt-3 text-sm font-semibold text-zinc-950">Foco profissional</p><p className="mt-1 text-sm leading-6 text-zinc-600">{draft.interestGraph.professionalSignal}</p></div></div><div className="rounded-md border border-[var(--share-line)] bg-white p-4"><p className="text-sm font-semibold text-zinc-950">Leitura estratégica</p><ul className="mt-2 space-y-2 text-sm leading-6 text-zinc-600">{draft.whyThisWorks.map((item) => <li key={item}>{item}</li>)}</ul>{draft.trend ? <p className="mt-3 text-xs text-zinc-500">Tendência: {draft.trend.label} · {confidenceLabel(draft.trend.confidence)}{draft.trend.source ? ` · ${draft.trend.source}` : ""}</p> : <p className="mt-3 text-xs text-zinc-500">Nenhuma tendência foi forçada. A pauta pode ser evergreen quando isso produz conteúdo melhor.</p>}</div>{draft.strategicDecision.action !== "POST" ? <div className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4"><p className="text-sm font-semibold text-zinc-950">Alternativa de relacionamento para hoje</p><p className="mt-2 text-xs leading-5 text-zinc-500">Onde: {draft.commentStrategy.where}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{draft.commentStrategy.suggestion}</p></div> : null}</div>; }

function buildProfileReviewInsight(item: AuthorityAssessment["profileReview"][number], assessment: AuthorityAssessment, businessUnitShortName: string) {
  const guidance = assessment.input.businessUnitContext ?? buildBusinessUnitGuidance(assessment.input.businessUnitId);
  const personalContext = isPersonalBusinessContext(assessment.input.businessUnitId);
  const territory = guidance.territories[0] ?? assessment.input.businessUnitName;
  const persona = guidance.personas[0] ?? guidance.icps[0] ?? (personalContext ? "seu público profissional" : "decisores do ICP");
  const contextReference = personalContext ? "seu foco profissional" : businessUnitShortName;
  const hasValue = item.value.trim().length > 0;
  if (item.field === "headline") return { authoritySignal: hasValue ? "Média" : "Baixa", buSignal: (assessment.buAffinityScore ?? 0) >= 70 ? "Alta" : (assessment.buAffinityScore ?? 0) >= 45 ? "Média" : "Baixa", emptyState: "Não encontramos uma headline utilizável nesta análise.", analysis: hasValue ? `A headline comunica sua posição atual, mas precisa ser lida em conjunto com o restante do perfil. O ponto central é verificar se a primeira impressão deixa claro pelo que você quer ser lembrado e se existe uma ponte natural com ${contextReference}.` : "Sem uma headline clara, o perfil perde força logo na primeira impressão e dificulta a associação com um território de autoridade.", suggestion: personalContext ? `Preserve sua identidade profissional e teste uma headline que combine especialidade, público e impacto. Uma direção possível é conectar ${territory} ao valor que você entrega para ${persona}, sem transformar a headline em uma lista de palavras-chave.` : `Preserve sua identidade profissional e teste uma headline que combine especialidade, público e impacto. Uma direção possível é conectar ${territory} ao valor que você entrega para ${persona}, sem transformar a headline em uma lista de BUs.` };
  if (item.field === "about") return { authoritySignal: hasValue && item.value.length > 180 ? "Alta" : hasValue ? "Média" : "Baixa", buSignal: (assessment.activationPotentialScore ?? 0) >= 70 ? "Alta" : (assessment.activationPotentialScore ?? 0) >= 45 ? "Média" : "Baixa", emptyState: "Não encontramos conteúdo suficiente na seção Sobre.", analysis: hasValue ? "O Sobre oferece contexto para entender sua trajetória e seu repertório. A oportunidade é transformar descrição profissional em narrativa de autoridade: problema que você resolve, experiência real, provas e perspectiva própria." : "Sem um Sobre consistente, a plataforma tem menos evidências para avaliar profundidade, repertório e coerência de posicionamento.", suggestion: personalContext ? `Reestruture o Sobre em quatro blocos: problema que você ajuda a resolver, repertório que sustenta sua visão, uma ou duas provas reais e uma ponte opcional com ${territory}. Seu foco profissional deve organizar a narrativa sem apagar sua identidade.` : `Reestruture o Sobre em quatro blocos: problema que você ajuda a resolver, repertório que sustenta sua visão, uma ou duas provas reais e uma ponte opcional com ${territory}. A BU deve aparecer como contexto comercial, não como identidade pessoal.` };
  if (item.field === "proofPoints") return { authoritySignal: hasValue ? "Média" : "Baixa", buSignal: hasValue && (assessment.buAffinityScore ?? 0) >= 55 ? "Média" : "Baixa", emptyState: "Não encontramos provas concretas suficientes no perfil.", analysis: hasValue ? "Há sinais de trajetória e experiência, mas experiência profissional não é automaticamente prova de autoridade. O que fortalece percepção comercial são resultados, projetos com impacto, cases, depoimentos, reconhecimentos ou entregas verificáveis." : "A trajetória pode ser sólida e ainda assim ficar pouco comprovada no perfil. Sem evidências concretas, o leitor precisa acreditar na autoridade apenas pela descrição.", suggestion: "Escolha duas experiências reais e transforme cada uma em prova: contexto, desafio, sua contribuição e resultado. Se não houver número público, use impacto qualitativo verificável sem inventar métricas." };
  if (item.field === "posts") return { authoritySignal: hasValue ? "Média" : "Não avaliada", buSignal: hasValue ? "Média" : "Não avaliada", emptyState: "Não conseguimos analisar publicações recentes com a fonte atual.", analysis: hasValue ? "Conteúdo recente ajuda a medir consistência temática, profundidade e presença em conversas. A leitura deve considerar qualidade e aderência, não apenas frequência." : "Sem publicações recentes, não é possível afirmar com segurança como você constrói autoridade por conteúdo nem quais temas já geram associação espontânea.", suggestion: personalContext ? `Use conteúdos recentes para consolidar dois ou três territórios pessoais e escolha pautas que criem uma ponte legítima com ${territory}. Não force um tema apenas porque ele parece estratégico; preserve coerência com sua experiência real.` : `Use conteúdos recentes para consolidar dois ou três territórios pessoais e, quando ${businessUnitShortName} estiver em foco, escolha pautas que criem uma ponte legítima com ${territory}. Não force assunto da BU quando não houver conexão real.` };
  if (item.field === "interactionSignals") return { authoritySignal: hasValue ? "Média" : "Não avaliada", buSignal: hasValue ? "Média" : "Não avaliada", emptyState: "Ainda não temos evidências suficientes para avaliar networking estratégico.", analysis: hasValue ? "Networking estratégico não é quantidade de conexões. O sinal relevante é presença em conversas com pessoas e temas que importam para seu mercado, com contribuições que reforcem repertório e confiança." : "Sem dados sobre interações, comentários e conversas, não é correto atribuir força ou fraqueza ao seu networking estratégico.", suggestion: `Priorize interações de qualidade com ${persona}: comentários substantivos, perguntas específicas e conexões contextualizadas. O objetivo é construir familiaridade antes de qualquer abordagem comercial.` };
  return { authoritySignal: hasValue ? "Média" : "Não avaliada", buSignal: hasValue ? "Média" : "Não avaliada", emptyState: "Não encontramos informação suficiente nesta dimensão.", analysis: hasValue ? "Esta evidência ajuda a contextualizar sua autoridade, mas deve ser interpretada junto das demais seções do perfil." : "Ainda não existem dados suficientes para uma leitura responsável desta dimensão.", suggestion: `Use esta seção para reforçar evidências reais do seu repertório e, quando fizer sentido, criar uma ponte natural com ${territory}.` };
}

function Input({ label, value, onChange, placeholder, icon }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; icon?: React.ReactNode }) { return <label className="grid gap-1.5"><span className="text-sm font-medium text-zinc-700">{label}</span><span className="flex items-center gap-2 rounded-md border border-[var(--share-line)] bg-[#fbfdf8] px-3 py-2 focus-within:border-[var(--share-green-800)] focus-within:bg-white">{icon}<input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400" /></span></label>; }
function Textarea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) { return <label className="grid gap-1.5"><span className="text-sm font-medium text-zinc-700">{label}</span><textarea value={value} rows={rows} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--share-green-800)] focus:bg-white" /></label>; }
function ResultList({ title, icon, items }: { title: string; icon: React.ReactNode; items: string[] }) { return <div className="share-card rounded-lg p-5"><div className="flex items-center gap-2"><span className="text-zinc-500">{icon}</span><h3 className="font-semibold text-[var(--share-green-950)]">{title}</h3></div><ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-600">{items.map((item) => <li key={item}>{item}</li>)}</ul></div>; }
function CompactMetric({ label, value, explanation }: { label: string; value: number | null; explanation: string }) { return <div className="rounded-md border border-white/15 bg-white/10 p-4"><div className="flex items-baseline justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-wide text-white/70">{label}</p><p className="text-lg font-semibold text-[var(--share-lime)]">{scoreText(value)}</p></div><p className="mt-2 text-xs leading-5 text-white/70">{explanation}</p></div>; }
function ExecutiveReading({ label, level, text }: { label: string; level: string; text: string }) { return <article className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">{label}</p><span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">{level}</span></div><p className="mt-3 text-sm leading-6 text-zinc-700">{text}</p></article>; }
function StrategicGapField({ label, text }: { label: string; text: string }) { return <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">{label}</p><p className="mt-1 text-sm leading-6 text-zinc-700">{text}</p></div>; }
function commercialExposureLabel(value: AuthorityAssessment["commercialExposure"][number]["classification"]) { const labels = { PROVA_COMERCIAL: "Prova comercial", SINAL_AUTORIDADE: "Sinal de autoridade", DETALHE_OPERACIONAL: "Detalhe operacional", EXPOSICAO_COMPETITIVA: "Exposição competitiva" }; return labels[value]; }
function PlanPanel({ title, subtitle, highlight, items }: { title: string; subtitle: string; highlight: string; items: string[] }) { return <div className="share-card rounded-lg p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">{subtitle}</p><h3 className="mt-1 text-lg font-semibold text-[var(--share-green-950)]">{title}</h3><p className="mt-3 rounded-md bg-[#edf7eb] px-3 py-2 text-sm font-medium text-[var(--share-green-950)]">{highlight}</p><ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-600">{items.map((item) => <li key={item}>{item}</li>)}</ul></div>; }
function SourceEvidence({ source }: { source: AuthorityAssessment["sources"][number] }) { const tone = source.confidence === "confirmed" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : source.confidence === "likely" ? "border-sky-200 bg-sky-50 text-sky-950" : "border-zinc-200 bg-white text-zinc-800"; return <div className={`rounded-md border px-3 py-2 ${tone}`}><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-wide">{confidenceLabel(source.confidence)}</p>{source.url ? <a className="text-xs font-semibold underline-offset-4 hover:underline" href={source.url} target="_blank" rel="noreferrer">Abrir fonte</a> : null}</div><p className="mt-1 text-sm font-semibold">{publicSourceText(source.title)}</p><p className="mt-1 text-xs leading-5 opacity-75">{publicSourceNote(source.notes)}</p></div>; }
function ActionPanelCard({ panel }: { panel: ActionPanel }) { return <div className="mt-5 rounded-lg border border-[var(--share-green-800)] bg-[#f4fbef] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">{panel.eyebrow}</p><h4 className="mt-1 text-lg font-semibold text-[var(--share-green-950)]">{panel.title}</h4><p className="mt-2 text-sm leading-6 text-zinc-600">{panel.description}</p><div className="mt-3 grid gap-2">{panel.items.map((item) => <p key={item} className="rounded-md border border-[var(--share-line)] bg-white px-3 py-2 text-sm leading-6 text-zinc-700">{item}</p>)}</div></div>; }
function PlanGenerationStatus() { const steps = ["Analisando lacunas", "Revisando sua autoridade", "Cruzando o foco ativo", "Analisando melhores pontes", "Priorizando ações"]; return <div className="mt-5 grid gap-2 rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4 sm:grid-cols-2 lg:grid-cols-5">{steps.map((step, index) => <span key={step} className="inline-flex items-center gap-2 text-sm text-zinc-700">{index < steps.length - 1 ? <CheckCircle2 className="h-4 w-4 text-[var(--share-green-800)]" /> : <RefreshCw className="h-4 w-4 animate-spin text-[var(--share-green-800)]" />}{step}</span>)}</div>; }
function ThirtyDayPlanPanel({ plan, view, onViewChange }: { plan: AuthorityThirtyDayPlan; view: "calendar" | "timeline" | "list"; onViewChange: (view: "calendar" | "timeline" | "list") => void }) { return <section className="share-card rounded-lg p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Plano estratégico de autoridade e Social Selling</p><h3 className="mt-1 text-xl font-semibold text-[var(--share-green-950)]">{plan.title}</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">{plan.summary}</p><p className="mt-2 text-xs leading-5 text-zinc-500">{plan.generationNote}</p></div><div className="inline-flex overflow-hidden rounded-md border border-[var(--share-line)] bg-white text-sm font-semibold text-[var(--share-green-900)]">{(["calendar", "timeline", "list"] as const).map((option) => <button key={option} type="button" onClick={() => onViewChange(option)} className={`px-3 py-2 ${view === option ? "bg-[#edf7eb]" : "hover:bg-[#fbfdf8]"}`}>{option === "calendar" ? "Calendário" : option === "timeline" ? "Linha do tempo" : "Lista"}</button>)}</div></div><div className="mt-5 grid gap-3 lg:grid-cols-2"><PlanExecutiveField label="Objetivo do ciclo" text={plan.objective ?? plan.summary} /><PlanExecutiveField label="Por que agora" text={plan.whyNow ?? plan.summary} /><PlanExecutiveField label="Estado atual" text={plan.currentState ?? "Estado registrado no diagnóstico que originou este plano."} /><PlanExecutiveField label="Estado desejado" text={plan.desiredState ?? "Evoluir autoridade e conversas comerciais com evidências observáveis."} /></div><div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">{(plan.weeks ?? []).map((week) => <article key={week.week} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Semana {week.week} · dias {week.dayRange[0]}–{week.dayRange[1]}</p><h4 className="mt-2 font-semibold text-zinc-950">{week.title}</h4><p className="mt-2 text-sm leading-6 text-zinc-600">{week.objective}</p></article>)}</div>{view === "calendar" ? <PlanCalendar actions={plan.actions} /> : view === "list" ? <PlanList actions={plan.actions} /> : <PlanTimeline actions={plan.actions} />}</section>; }
function PlanExecutiveField({ label, text }: { label: string; text: string }) { return <div className="rounded-md border border-[var(--share-line)] bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">{label}</p><p className="mt-2 text-sm leading-6 text-zinc-700">{text}</p></div>; }
function PlanTimeline({ actions }: { actions: AuthorityThirtyDayPlan["actions"] }) { return <div className="mt-5 grid gap-3">{actions.map((item) => <PlanActionCard key={item.day} item={item} />)}</div>; }
function PlanList({ actions }: { actions: AuthorityThirtyDayPlan["actions"] }) { return <div className="mt-5 divide-y divide-[var(--share-line)] rounded-md border border-[var(--share-line)] bg-white">{actions.map((item) => <div key={item.day} className="grid gap-2 px-4 py-3 md:grid-cols-[70px_1fr_auto] md:items-center"><p className="text-sm font-semibold text-[var(--share-green-950)]">Dia {item.day}</p><div><p className="text-sm font-semibold text-zinc-950">{item.title}</p><p className="mt-1 text-sm leading-6 text-zinc-600">{item.action}</p></div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">{socialActionLabel(item.socialSellingAction)} · {item.scope === "PERSONAL" ? "Pessoal" : "Contexto"}</p></div>)}</div>; }
function PlanCalendar({ actions }: { actions: AuthorityThirtyDayPlan["actions"] }) { return <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-7">{actions.map((item) => <div key={item.day} className="min-h-28 rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-3"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Dia {item.day}</p><p className="mt-2 text-sm font-semibold text-zinc-950">{item.title}</p><p className="mt-1 line-clamp-3 text-xs leading-5 text-zinc-600">{item.action}</p></div>)}</div>; }
function PlanActionCard({ item }: { item: AuthorityThirtyDayPlan["actions"][number] }) { return <article className="grid gap-3 rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4 md:grid-cols-[76px_1fr_auto] md:items-start"><div className="rounded-md bg-[#edf7eb] px-3 py-2 text-center"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Dia</p><p className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">{item.day}</p></div><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-zinc-950">{item.title}</p><span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-[var(--share-green-800)]">{socialActionLabel(item.socialSellingAction)}</span><span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-600">{item.scope === "PERSONAL" ? "Pessoal" : "Contexto"}</span></div><p className="mt-2 text-sm leading-6 text-zinc-700">{item.action}</p><p className="mt-2 text-xs leading-5 text-zinc-500">Por que agora: {item.whyNow}</p><p className="mt-1 text-xs leading-5 text-zinc-500">Sinal a observar: {item.signalToObserve}</p></div><div className="grid gap-1 text-xs text-zinc-600 md:text-right"><span>Impacto: {item.expectedImpact}</span><span>Esforço: {item.effort}</span><span>{item.estimatedTime}</span><span>{item.relatedModule}</span></div></article>; }
function socialActionLabel(action: string) { const labels: Record<string, string> = { POST: "Publicar", COMMENT: "Comentar", REPLY: "Responder", PROFILE: "Perfil", INTELLIGENCE: "Inteligência", RAPPORT: "Rapport", OUTREACH: "Abordar", RELATIONSHIP: "Relacionamento", ANALYSIS: "Analisar", NO_PUBLISH: "Não publicar" }; return labels[action] ?? action; }
function DownloadReportModal({ onGenerateFirst, onDownloadWithoutPlan, onCancel }: { onGenerateFirst: () => void; onDownloadWithoutPlan: () => void; onCancel: () => void }) { return <div role="dialog" aria-modal="true" aria-labelledby="download-plan-title" className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"><section className="w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Relatório executivo</p><h3 id="download-plan-title" className="mt-2 text-2xl font-semibold text-[var(--share-green-950)]">Seu relatório ainda não possui o Plano de 30 Dias deste diagnóstico</h3><p className="mt-3 text-sm leading-6 text-zinc-600">Você pode baixar agora ou gerar primeiro sua estratégia de evolução.</p><div className="mt-6 grid gap-2"><button type="button" onClick={onGenerateFirst} className="share-button-primary rounded-md px-4 py-3 text-sm font-semibold">Gerar plano antes de baixar</button><button type="button" onClick={onDownloadWithoutPlan} className="rounded-md border border-[var(--share-green-800)] px-4 py-3 text-sm font-semibold text-[var(--share-green-900)]">Baixar sem o plano</button><button type="button" onClick={onCancel} className="rounded-md px-4 py-3 text-sm font-semibold text-zinc-500 hover:bg-zinc-50">Cancelar</button></div></section></div>; }
function ProfileChangeModal({ profileUrl, onConfirm, onCancel }: { profileUrl: string | null; onConfirm: () => void; onCancel: () => void }) { return <div role="dialog" aria-modal="true" aria-labelledby="profile-change-title" className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"><section className="w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Novo contexto de diagnóstico</p><h3 id="profile-change-title" className="mt-2 text-2xl font-semibold text-[var(--share-green-950)]">Alterar o perfil analisado?</h3><p className="mt-3 text-sm leading-6 text-zinc-600">O Plano de 30 Dias atual foi criado com base no perfil anterior e deixará de ser utilizado neste diagnóstico. O histórico será preservado.</p>{profileUrl ? <p className="mt-3 break-all rounded-md bg-[#fbfdf8] px-3 py-2 text-xs text-zinc-600">{profileUrl}</p> : null}<div className="mt-6 flex flex-wrap justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-md px-4 py-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">Cancelar</button><button type="button" onClick={onConfirm} className="share-button-primary rounded-md px-4 py-3 text-sm font-semibold">Alterar perfil</button></div></section></div>; }
function reportFilename(contentDisposition: string | null) { const match = contentDisposition?.match(/filename="([^"]+)"/i); return match?.[1] || "ShareAI_Diagnostico_LinkedIn.pdf"; }

function legacyAuthorityClassification(score: number | null) {
  if (score === null) return "Dados insuficientes para classificar a autoridade";
  if (score >= 80) return "Autoridade consolidada";
  if (score >= 65) return "Autoridade em expansão";
  if (score >= 48) return "Autoridade emergente";
  return "Autoridade em construção";
}

function scoreText(value: number | null) {
  return value === null ? "Não avaliado" : String(value);
}

function normalizeLinkedInUrl(value: string) {
  return value.trim().replace(/\/$/, "").toLocaleLowerCase("pt-BR");
}

function legacyScoreCoverage(assessment: AuthorityAssessment | null) {
  const dimensions = assessment?.dimensions ?? [];
  const totalWeight = dimensions.reduce((total, dimension) => total + dimension.weight, 0);
  if (!totalWeight) return 0;
  const evaluatedWeight = dimensions.filter((dimension) => dimension.score !== null).reduce((total, dimension) => total + dimension.weight, 0);
  return Math.round((evaluatedWeight / totalWeight) * 100);
}

function publicSourceText(value: string) {
  if (/\b(?:apify|actor|scraper|endpoint|api)\b/i.test(value)) return "Perfil público do LinkedIn";
  if (/\b(?:gemini|provider|modelo)\b/i.test(value)) return "Análise estruturada da Share AI";
  return value;
}

function publicSourceNote(value: string) {
  return value
    .replace(/\bApify\b/gi, "fonte pública autorizada")
    .replace(/\bGemini\b/gi, "inteligência da Share AI")
    .replace(/\bActors?\b/gi, "fontes")
    .replace(/\bAPI\b/gi, "integração")
    .replace(/\bproviders?\b/gi, "serviço de inteligência");
}
