"use client";

import { useMemo, useState, useTransition } from "react";
import { Activity, BarChart3, CheckCircle2, History, Link, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import type { AuthorityAssessment } from "@/lib/diagnostics/authority";
import { demoBusinessUnits } from "@/lib/tenancy/demo";
import { prosperContext } from "@/lib/tenancy/prosper";
import { StatusPill } from "@/components/app/StatusPill";

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

type ProfileInputMode = "url" | "linkedin";

const sampleByBu: Record<string, FormState> = {
  bu_share: {
    profileUrl: "",
    objective: "Ser reconhecido por decisores B2B como especialista em Social Selling e inteligencia comercial.",
    headline: "Estrategia comercial B2B, Social Selling e posicionamento para empresas que vendem conhecimento",
    about: "Ajudo times comerciais e liderancas a transformar repertorio, contexto de marca e relacoes em oportunidades mais qualificadas. Minha atuacao combina diagnostico, conteudo, hunting e preparacao para conversas com decisores.",
    themes: "social selling, autoridade comercial, vendas B2B, posicionamento",
    proofPoints: "Projetos com clientes B2B, playbooks comerciais, cases de melhoria de abordagem e workshops com liderancas.",
    recentContent: "Posts com insights sobre autoridade comercial, comentarios em conversas de decisores e artigos sobre reputacao no LinkedIn.",
    interactionSignals: "Interacoes com gestores, diretores comerciais, lideres de marketing e fundadores.",
  },
  bu_prosper: {
    profileUrl: "",
    objective: "Ser lembrado por RHs, liderancas e areas de negocio como referencia em habilidades digitais, IA aplicada e transformacao com resultado.",
    headline: "Habilidades digitais, IA aplicada e desenvolvimento de talentos para empresas que querem gerar valor real",
    about: "Atuo na Prosper Digital Skills, frente da Share People Hub dedicada ao desenvolvimento de habilidades digitais para o futuro do trabalho. Ajudo empresas a sair do entendimento da IA para a aplicacao pratica e a construcao de solucoes reais, conectando aprendizagem, dados, negocio, diversidade e impacto.",
    themes: "IA aplicada a RH, habilidades digitais, futuro do trabalho, AI for Business, educacao corporativa, Prosper Sprints",
    proofPoints: "Programas como Inic.IA, AI for Business, AI Builders, Potenc.IA e Prosper Sprints; jornadas com empresas como AB InBev, CI&T, John Deere, Bosch, Vivo, BNP Paribas, Itau, Localiza e Suzano.",
    recentContent: "Posts e comentarios sobre sensibilizacao em IA, letramento digital, uso pratico de ferramentas, desafios reais de negocio, ROI educacional e novas formas de trabalho.",
    interactionSignals: "Conversas com RH, liderancas de negocio, gestores de treinamento, operacoes, decisores de transformacao digital e patrocinadores de programas de DEI.",
  },
  bu_education_recruit: {
    profileUrl: "",
    objective: "Construir autoridade com instituicoes de ensino que precisam recrutar melhor.",
    headline: "Recrutamento para educacao, atracao de talentos e inteligencia para instituicoes de ensino",
    about: "Apoio instituicoes educacionais na leitura de perfil, atracao e selecao de talentos alinhados ao contexto escolar. O foco e unir criterio, agilidade e qualidade de decisao.",
    themes: "recrutamento educacional, talentos, gestao escolar, selecao",
    proofPoints: "Projetos de recrutamento, mapeamento de mercado educacional e processos seletivos para instituicoes de ensino.",
    recentContent: "Conteudos sobre desafios de recrutamento na educacao e comentarios em temas de gestao escolar.",
    interactionSignals: "Interacoes com mantenedores, gestores escolares, coordenadores e liderancas de educacao.",
  },
};

export function AuthorityDiagnostic() {
  const [businessUnitId, setBusinessUnitId] = useState(demoBusinessUnits[1].id);
  const selectedBu = useMemo(() => demoBusinessUnits.find((item) => item.id === businessUnitId) ?? demoBusinessUnits[0], [businessUnitId]);
  const [form, setForm] = useState<FormState>(sampleByBu[businessUnitId]);
  const [assessment, setAssessment] = useState<AuthorityAssessment | null>(null);
  const [history, setHistory] = useState<AuthorityAssessment[]>([]);
  const [comparison, setComparison] = useState<CompareState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [profileInputMode, setProfileInputMode] = useState<ProfileInputMode>("url");
  const [isPending, startTransition] = useTransition();
  const canRunDiagnostic = form.profileUrl.includes("linkedin.com/in/") && form.objective.trim().length >= 10;

  function switchBu(nextBusinessUnitId: string) {
    setBusinessUnitId(nextBusinessUnitId);
    setForm(sampleByBu[nextBusinessUnitId]);
    setAssessment(null);
    setHistory([]);
    setComparison(null);
    setProfileInputMode("url");
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
        body: JSON.stringify({ ...form, businessUnitId, businessUnitName: selectedBu.name }),
      });
      const result = (await response.json()) as AuthorityAssessment;
      setAssessment(result);
      await refreshHistory();
    });
  }

  async function refreshHistory() {
    const response = await fetch(`/api/diagnostics/authority/history?businessUnitId=${businessUnitId}`);
    const result = (await response.json()) as { items: AuthorityAssessment[] };
    setHistory(result.items);
  }

  function compareEvolution() {
    startTransition(async () => {
      const response = await fetch(`/api/diagnostics/authority/compare?businessUnitId=${businessUnitId}`);
      setComparison((await response.json()) as CompareState);
      await refreshHistory();
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
        {businessUnitId === "bu_prosper" ? <ProsperContextPanel /> : null}

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
            <div className="grid gap-3 rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-3">
              <div className="flex flex-wrap gap-2">
                <ModeButton active={profileInputMode === "url"} onClick={() => setProfileInputMode("url")}>
                  Colar URL
                </ModeButton>
                <ModeButton active={profileInputMode === "linkedin"} onClick={() => setProfileInputMode("linkedin")}>
                  Conectar LinkedIn
                </ModeButton>
              </div>
              {profileInputMode === "url" ? (
                <Input
                  icon={<Link className="h-4 w-4 text-[#0a66c2]" />}
                  label="URL do perfil no LinkedIn"
                  placeholder="https://www.linkedin.com/in/seu-perfil"
                  value={form.profileUrl}
                  onChange={(value) => updateField("profileUrl", value)}
                />
              ) : (
                <div className="rounded-md border border-[#0a66c2]/20 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--share-green-950)]">Conexao LinkedIn</p>
                      <p className="mt-1 max-w-xl text-sm leading-6 text-zinc-600">
                        A conexao segura sera ativada quando o app LinkedIn e as permissoes oficiais estiverem configurados.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled
                      className="rounded-md border border-[#0a66c2]/25 px-3 py-2 text-sm font-semibold text-[#0a66c2] opacity-60"
                    >
                      Aguardando configuracao
                    </button>
                  </div>
                  <button type="button" onClick={() => setProfileInputMode("url")} className="mt-3 text-sm font-semibold text-[var(--share-green-900)] underline-offset-4 hover:underline">
                    Usar URL publica por enquanto
                  </button>
                </div>
              )}
            </div>
            <Input label="Objetivo comercial" value={form.objective} onChange={(value) => updateField("objective", value)} />
            <Input label="Headline do LinkedIn" value={form.headline} onChange={(value) => updateField("headline", value)} />
            <Textarea label="Sobre" value={form.about} onChange={(value) => updateField("about", value)} rows={4} />
            <Input label="Temas de autoridade" value={form.themes} onChange={(value) => updateField("themes", value)} />
            <Textarea label="Provas, cases e resultados" value={form.proofPoints} onChange={(value) => updateField("proofPoints", value)} />
            <Textarea label="Conteudos recentes" value={form.recentContent} onChange={(value) => updateField("recentContent", value)} />
            <Textarea label="Interacoes e networking" value={form.interactionSignals} onChange={(value) => updateField("interactionSignals", value)} />
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
              {assessment ? "Refazer diagnostico" : "Gerar diagnostico"}
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
              <div className="mt-4 flex flex-wrap gap-2">
                {assessment.sources.map((source) => (
                  <StatusPill key={source.title} tone={source.confidence === "confirmed" ? "ready" : "neutral"}>
                    {source.confidence}: {source.title}
                  </StatusPill>
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
              <div className="mt-5 flex flex-wrap gap-2">
                {assessment.nextActions.map((action) => (
                  <button key={action} type="button" className="rounded-md border border-[var(--share-line)] bg-white px-3 py-2 text-sm font-medium text-[var(--share-green-900)] hover:bg-[#edf7eb]">
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
            <p className="mt-3 text-sm leading-6 text-zinc-600">Acoes externas como publicar, enviar mensagem ou acionar CRM exigem preview e aprovacao humana.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ModeButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
        active
          ? "bg-[var(--share-green-950)] text-white"
          : "border border-[var(--share-line)] bg-white text-[var(--share-green-900)] hover:bg-[#edf7eb]"
      }`}
    >
      {children}
    </button>
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

function ProsperContextPanel() {
  return (
    <div className="overflow-hidden rounded-lg bg-[linear-gradient(135deg,#ff0048_0%,#c51bbf_48%,#5b19ef_100%)] text-white shadow-[0_24px_80px_rgb(91_25_239_/_0.22)]">
      <div className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#2ef2ce]">Prosper Digital Skills</p>
            <h3 className="mt-2 text-2xl font-semibold md:text-3xl">Contexto Prosper ativo</h3>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/82">{prosperContext.positioning}</p>
          </div>
          <div className="rounded-md border border-white/20 px-4 py-3 text-right">
            <p className="text-xs text-white/70">Maturidade em IA</p>
            <p className="mt-1 text-xl font-semibold text-[#2ef2ce]">Entender - Aplicar - Construir</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 xl:grid-cols-5">
          {prosperContext.pillars.map((pillar) => (
            <article key={pillar.title} className="rounded-md border border-white/15 bg-white/10 p-4">
              <h4 className="text-sm font-semibold text-[#2ef2ce]">{pillar.title}</h4>
              <p className="mt-2 min-h-20 text-xs leading-5 text-white/78">{pillar.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {pillar.offers.map((offer) => (
                  <span key={offer} className="rounded-full bg-white/14 px-2 py-1 text-[11px] font-medium text-white">
                    {offer}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-md border border-[#2ef2ce]/70 bg-white/8 p-4">
            <p className="text-sm font-semibold text-[#2ef2ce]">Diferenciais para autoridade comercial</p>
            <div className="mt-3 grid gap-2 text-sm leading-5 text-white/82 sm:grid-cols-2">
              {prosperContext.differentiators.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
          <div className="rounded-md border border-white/15 bg-white/10 p-4">
            <p className="text-sm font-semibold text-[#2ef2ce]">Jornada de evolucao em IA</p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {prosperContext.aiMaturity.map((step) => (
                <div key={step.level} className="rounded-md bg-white/12 p-3">
                  <p className="text-xs font-semibold uppercase text-white">{step.level}</p>
                  <p className="mt-2 text-xs leading-5 text-white/78">{step.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
