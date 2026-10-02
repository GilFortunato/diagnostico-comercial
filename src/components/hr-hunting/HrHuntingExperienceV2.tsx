"use client";

import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Check, Copy, Download, ExternalLink, FolderSearch, ListChecks, LoaderCircle, Plus, Search, UserRoundSearch, X } from "lucide-react";
import { buildLinkedInOutreachMessage } from "@/components/hr-hunting/outreachMessage";
import type { HrCandidate, HrHuntingSearchSnapshot, JobDna } from "@/lib/hr-hunting/types";

type JobForm = { description: string; jobUrl: string; companyName: string; recruiterName: string };
type SearchFilters = { quantity: number; currentTitle: string; location: string; keywords: string; seniority: string[] };
type Pending = "job" | "dna" | "search" | "more" | "export" | null;

const emptyForm: JobForm = { description: "", jobUrl: "", companyName: "", recruiterName: "" };
const emptyFilters: SearchFilters = { quantity: 50, currentTitle: "", location: "", keywords: "", seniority: [] };

type WorkspaceView = "new" | "all" | "mine" | "shortlists" | "candidates" | "search";
type SavedSearchSummary = {
  id: string;
  title: string;
  companyName?: string | null;
  recruiterName?: string | null;
  status: string;
  updatedAt: string;
  candidates: number;
  shortlist: number;
  ownerId: string;
  ownerName: string;
  mine: boolean;
};
type CandidateBankItem = {
  id: string;
  name: string;
  currentTitle?: string | null;
  currentCompany?: string | null;
  location?: string | null;
  linkedinUrl?: string | null;
  lastExternalLookupAt?: string | null;
  updatedAt: string;
  reviews: Array<{ id: string; verdict: string; reviewerName: string; note?: string | null; searchTitle?: string | null; createdAt: string }>;
};

export function HrHuntingExperienceV2({ accountName }: { accountName?: string | null }) {
  const [search, setSearch] = useState<HrHuntingSearchSnapshot | null>(null);
  const [form, setForm] = useState<JobForm>(emptyForm);
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters);
  const [selected, setSelected] = useState<string[]>([]);
  const [candidate, setCandidate] = useState<HrCandidate | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<WorkspaceView>("new");
  const [savedSearches, setSavedSearches] = useState<SavedSearchSummary[]>([]);
  const [candidateBank, setCandidateBank] = useState<CandidateBankItem[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  const sorted = useMemo(() => [...(search?.candidates || [])].sort((a, b) => b.fitScore - a.fitScore || a.name.localeCompare(b.name, "pt-BR")), [search]);
  const selectedCandidates = sorted.filter((item) => selected.includes(item.id));
  const visibleSearches = useMemo(() => {
    if (view === "mine") return savedSearches.filter((item) => item.mine);
    if (view === "shortlists") return savedSearches.filter((item) => item.mine && item.shortlist > 0);
    return savedSearches;
  }, [savedSearches, view]);

  useEffect(() => {
    void refreshSavedSearches();
  }, []);

  async function refreshSavedSearches() {
    try {
      const response = await fetch("/api/hr-hunting", { cache: "no-store" });
      const body = await response.json() as { searches?: SavedSearchSummary[] };
      if (response.ok) setSavedSearches(body.searches || []);
    } catch {
      // A navegação continua funcional mesmo se a lista compartilhada estiver temporariamente indisponível.
    }
  }

  async function openSavedSearch(id: string) {
    setWorkspaceLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/hr-hunting/${id}`, { cache: "no-store" });
      const body = await response.json() as { search?: HrHuntingSearchSnapshot; error?: string };
      if (!response.ok || !body.search) throw new Error(body.error || "Não foi possível abrir a vaga.");
      setSearch(body.search);
      setFilters({
        ...emptyFilters,
        currentTitle: body.search.jobDna.title || "",
        location: body.search.jobDna.location || "",
      });
      setSelected([]);
      setCandidate(null);
      setView("search");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível abrir a vaga.");
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function openCandidateBank() {
    setView("candidates");
    setWorkspaceLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/hr-hunting/candidates", { cache: "no-store" });
      const body = await response.json() as { candidates?: CandidateBankItem[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Não foi possível carregar o banco de candidatos.");
      setCandidateBank(body.candidates || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o banco de candidatos.");
    } finally {
      setWorkspaceLoading(false);
    }
  }

  function resetSearch() {
    setSearch(null);
    setForm(emptyForm);
    setFilters(emptyFilters);
    setSelected([]);
    setCandidate(null);
    setError(null);
    setPending(null);
    setView("new");
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("hr-hunting:draft");
      window.localStorage.removeItem("hr-hunting:draft");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function createJob() {
    setPending("job"); setError(null);
    try {
      const response = await fetch("/api/hr-hunting", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const body = await response.json() as { search?: HrHuntingSearchSnapshot; error?: string };
      if (!response.ok || !body.search) throw new Error(body.error || "Não foi possível analisar a vaga.");
      setSearch(body.search);
      setFilters({ ...emptyFilters, currentTitle: body.search.jobDna.title || "", location: body.search.jobDna.location || "" });
      setSelected([]);
      setView("search");
      await refreshSavedSearches();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível analisar a vaga.");
    } finally { setPending(null); }
  }

  async function saveDna(jobDna: JobDna) {
    if (!search) return;
    setPending("dna"); setError(null);
    try {
      const response = await fetch(`/api/hr-hunting/${search.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobDna }) });
      const body = await response.json() as { search?: HrHuntingSearchSnapshot; error?: string };
      if (!response.ok || !body.search) throw new Error(body.error || "Não foi possível salvar o Job DNA.");
      setSearch(body.search);
      setFilters((current) => ({ ...current, currentTitle: jobDna.title || current.currentTitle, location: jobDna.location || current.location }));
      await refreshSavedSearches();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar o Job DNA."); }
    finally { setPending(null); }
  }

  async function runSearch() {
    if (!search) return;
    setPending("search"); setError(null);
    try {
      const response = await fetch(`/api/hr-hunting/${search.id}/search`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...filters, keywords: split(filters.keywords) }),
      });
      const body = await response.json() as { search?: HrHuntingSearchSnapshot; error?: string };
      if (!response.ok || !body.search) throw new Error(body.error || "Não foi possível buscar candidatos.");
      setSearch(body.search); setSelected([]); setCandidate(null);
      await refreshSavedSearches();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível buscar candidatos."); }
    finally { setPending(null); }
  }

  async function loadMore() {
    if (!search) return;
    setPending("more"); setError(null);
    const before = search.candidates.length;
    try {
      const response = await fetch(`/api/hr-hunting/${search.id}/load-more`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...filters, keywords: split(filters.keywords), batchSize: 20 }),
      });
      const body = await response.json() as { search?: HrHuntingSearchSnapshot; error?: string };
      if (!response.ok || !body.search) throw new Error(body.error || "Não foi possível carregar mais candidatos.");
      setSearch(body.search);
      const added = Math.max(0, body.search.candidates.length - before);
      if (added === 0) setError("Não encontramos novos perfis elegíveis sem repetir os atuais. Você pode ampliar os critérios e fazer uma nova busca.");
      await refreshSavedSearches();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar mais candidatos."); }
    finally { setPending(null); }
  }

  async function toggleShortlist(item: HrCandidate, shortlisted: boolean) {
    if (!search) return;
    const response = await fetch(`/api/hr-hunting/candidates/${item.id}/shortlist`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shortlisted }) });
    if (!response.ok) return setError("Não foi possível atualizar a shortlist.");
    const refreshed = await fetch(`/api/hr-hunting/${search.id}`, { cache: "no-store" });
    const body = await refreshed.json() as { search?: HrHuntingSearchSnapshot };
    if (body.search) {
      setSearch(body.search);
      setCandidate(body.search.candidates.find((current) => current.id === item.id) || null);
    }
    await refreshSavedSearches();
  }

  async function refreshCurrentCandidate(candidateId: string) {
    if (!search) return;
    const response = await fetch(`/api/hr-hunting/${search.id}`, { cache: "no-store" });
    const body = await response.json() as { search?: HrHuntingSearchSnapshot };
    if (!body.search) return;
    setSearch(body.search);
    setCandidate(body.search.candidates.find((current) => current.id === candidateId) || null);
  }

  async function exportSnapshot(scope: "all" | "shortlist") {
    if (!search) return;
    setPending("export"); setError(null);
    try {
      const response = await fetch(`/api/hr-hunting/${search.id}/export`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope }) });
      if (!response.ok) throw new Error("Não foi possível preparar a planilha.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "share-ai-hr-hunting.xlsx"; anchor.click(); URL.revokeObjectURL(url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível preparar a planilha."); }
    finally { setPending(null); }
  }

  return (
    <main className="min-h-screen bg-[#eef4e9] text-[var(--share-ink)]">
      <div className="mx-auto max-w-[1440px] px-5 py-7">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--share-green-800)]">HR Hunting</p>
            <h1 className="mt-1 text-3xl font-semibold text-[var(--share-green-950)]">Workspace de talentos</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">Vagas, shortlists e memória de candidatos compartilhadas com toda a equipe autorizada.</p>
          </div>
          {search && view === "search" ? (
            <span className="rounded-full border border-[#cbdcc9] bg-white px-4 py-2 text-xs font-bold text-[#006142]">
              {huntingLabel(search.ownerName)}
            </span>
          ) : null}
        </header>

        {error ? <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</p> : null}

        <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
          <WorkspaceSidebar
            view={view}
            searches={savedSearches}
            onNew={resetSearch}
            onView={(next) => { setView(next); setCandidate(null); }}
            onCandidates={() => void openCandidateBank()}
          />

          <section className="min-w-0">
            {workspaceLoading ? (
              <div className="rounded-3xl border border-[#cbdcc9] bg-white p-8 text-sm text-zinc-600 shadow-sm">
                <span className="inline-flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" /> Carregando workspace...</span>
              </div>
            ) : null}

            {!workspaceLoading && view === "new" ? <Intake form={form} setForm={setForm} pending={pending === "job"} onSubmit={createJob} /> : null}

            {!workspaceLoading && ["all", "mine", "shortlists"].includes(view) ? (
              <SavedSearchList
                title={view === "all" ? "Todas as vagas" : view === "mine" ? "Minhas vagas" : "Minhas shortlists"}
                searches={visibleSearches}
                onOpen={(id) => void openSavedSearch(id)}
              />
            ) : null}

            {!workspaceLoading && view === "candidates" ? <CandidateBank candidates={candidateBank} /> : null}

            {!workspaceLoading && view === "search" && search ? (
              <>
                <article className="rounded-3xl border border-[#cbdcc9] bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#006142]">{huntingLabel(search.ownerName)}</p>
                      <h2 className="mt-1 text-2xl font-semibold text-[#003f2c]">{search.title}</h2>
                      <p className="mt-2 text-sm text-zinc-500">{search.companyName || "Empresa não informada"} · {search.candidates.length} candidato(s) · {search.candidates.filter((item) => item.shortlisted).length} na shortlist</p>
                    </div>
                    <button type="button" onClick={resetSearch} className="rounded-xl border border-[#cbdcc9] px-4 py-2 text-sm font-semibold text-[#006142]">Nova vaga</button>
                  </div>
                </article>

                <DnaEditor initial={search.jobDna} pending={pending === "dna"} onSave={saveDna} />
                <section className="mt-6 rounded-3xl border border-[#cbdcc9] bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div><p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Busca de candidatos</p><h2 className="mt-1 text-xl font-semibold text-[var(--share-green-950)]">Defina o recorte da descoberta</h2><p className="mt-1 text-sm text-zinc-600">O banco Share é consultado primeiro. Somente a lacuna de perfis segue para fontes externas.</p></div>
                    <button type="button" onClick={runSearch} disabled={pending === "search" || pending === "more"} className="inline-flex items-center gap-2 rounded-xl bg-[var(--share-green-950)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending === "search" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{pending === "search" ? "Buscando candidatos" : "Buscar candidatos"}</button>
                  </div>
                  <div className="mt-5 grid gap-4 md:grid-cols-4"><Field label="Cargo atual" value={filters.currentTitle} setValue={(currentTitle) => setFilters({ ...filters, currentTitle })} placeholder="Ex.: Product Manager" /><Field label="Localização" value={filters.location} setValue={(location) => setFilters({ ...filters, location })} placeholder="Ex.: Jundiaí, SP" /><Field label="Palavras-chave" value={filters.keywords} setValue={(keywords) => setFilters({ ...filters, keywords })} placeholder="Separe por vírgulas" /><label className="grid gap-1 text-sm font-medium text-zinc-700">Resultados iniciais<input type="number" min="5" max="50" value={filters.quantity} onChange={(event) => setFilters({ ...filters, quantity: Number(event.target.value) })} className="h-10 rounded-md border border-[var(--share-line)] px-3 font-normal" /></label></div>
                </section>

                <ConnectorNotice status={search.status} warnings={search.connectorWarnings} />
                {search.status === "job_dna_ready" ? <State title="Job DNA pronto para revisão" text="Revise o cargo e os critérios profissionais antes de iniciar a busca." /> : null}
                {search.status === "no_results" ? <State title="Nenhum candidato elegível neste recorte" text="Amplie a família de cargo ou a localização. Falha de fonte é tratada separadamente e não vira falso zero." /> : null}
                {search.status === "connector_error" ? <State title="A pesquisa não pôde ser concluída" text="Os resultados existentes foram preservados. Teste a conexão e tente novamente." /> : null}

                {sorted.length ? <Results candidates={sorted} selected={selected} setSelected={setSelected} onOpen={setCandidate} onShortlist={toggleShortlist} onExport={exportSnapshot} exporting={pending === "export"} onLoadMore={loadMore} loadingMore={pending === "more"} /> : null}
                {selectedCandidates.length >= 2 ? <Compare candidates={selectedCandidates} /> : null}
              </>
            ) : null}
          </section>
        </div>

        {candidate && search ? <CandidateDrawer candidate={candidate} search={search} accountName={accountName} onClose={() => setCandidate(null)} onShortlist={toggleShortlist} onReviewed={() => void refreshCurrentCandidate(candidate.id)} /> : null}
      </div>
    </main>
  );
}

function WorkspaceSidebar({
  view,
  searches,
  onNew,
  onView,
  onCandidates,
}: {
  view: WorkspaceView;
  searches: SavedSearchSummary[];
  onNew: () => void;
  onView: (view: WorkspaceView) => void;
  onCandidates: () => void;
}) {
  const mine = searches.filter((item) => item.mine).length;
  const shortlist = searches.filter((item) => item.mine && item.shortlist > 0).length;
  const items = [
    { key: "all" as const, label: "Todas as vagas", icon: BriefcaseBusiness, count: searches.length },
    { key: "mine" as const, label: "Minhas vagas", icon: FolderSearch, count: mine },
    { key: "shortlists" as const, label: "Minhas shortlists", icon: ListChecks, count: shortlist },
  ];

  return (
    <aside className="self-start rounded-3xl border border-[#cbdcc9] bg-[#003f2c] p-4 text-white shadow-sm lg:sticky lg:top-24">
      <p className="px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#dcef55]">HR Workspace</p>
      <button type="button" onClick={onNew} className={`mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold ${view === "new" ? "bg-[#dcef55] text-[#173b28]" : "bg-white text-[#003f2c]"}`}>
        <Plus className="h-4 w-4" /> Nova busca
      </button>
      <nav className="mt-4 space-y-1">
        {items.map(({ key, label, icon: Icon, count }) => (
          <button key={key} type="button" onClick={() => onView(key)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold ${view === key ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
            <Icon className="h-4 w-4" /><span className="flex-1">{label}</span><span className="text-xs text-white/55">{count}</span>
          </button>
        ))}
        <button type="button" onClick={onCandidates} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold ${view === "candidates" ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
          <UserRoundSearch className="h-4 w-4" /><span className="flex-1">Todos os candidatos</span>
        </button>
      </nav>
      <div className="mt-5 border-t border-white/10 pt-4 px-2">
        <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">Memória Share</p>
        <p className="mt-2 text-xs leading-5 text-white/60">Perfis conhecidos são consultados antes de novas chamadas externas.</p>
      </div>
    </aside>
  );
}

function SavedSearchList({ title, searches, onOpen }: { title: string; searches: SavedSearchSummary[]; onOpen: (id: string) => void }) {
  return (
    <section className="rounded-3xl border border-[#cbdcc9] bg-white p-6 shadow-sm">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#006142]">Workspace compartilhado</p>
        <h2 className="mt-1 text-2xl font-semibold text-[#003f2c]">{title}</h2>
      </div>
      {!searches.length ? <p className="rounded-2xl border border-dashed border-[#cbdcc9] px-5 py-10 text-center text-sm text-zinc-500">Nenhuma vaga nesta área ainda.</p> : (
        <div className="grid gap-3 md:grid-cols-2">
          {searches.map((item) => (
            <button key={item.id} type="button" onClick={() => onOpen(item.id)} className="rounded-2xl border border-[#d8e3d6] bg-[#fbfdf9] p-5 text-left transition hover:border-[#8caf83] hover:bg-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#006142]">{huntingLabel(item.ownerName)}</p>
                  <h3 className="mt-1 text-lg font-semibold text-[#003f2c]">{item.title}</h3>
                  <p className="mt-1 text-xs text-zinc-500">{item.companyName || "Empresa não informada"}</p>
                </div>
                {item.mine ? <span className="rounded-full bg-[#e9f5dc] px-2.5 py-1 text-[10px] font-bold uppercase text-[#47651a]">Minha</span> : null}
              </div>
              <div className="mt-4 flex gap-4 text-xs text-zinc-500">
                <span>{item.candidates} candidatos</span>
                <span>{item.shortlist} shortlist</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function CandidateBank({ candidates }: { candidates: CandidateBankItem[] }) {
  return (
    <section className="rounded-3xl border border-[#cbdcc9] bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#006142]">Memória da equipe</p>
      <h2 className="mt-1 text-2xl font-semibold text-[#003f2c]">Todos os candidatos</h2>
      <p className="mt-2 text-sm text-zinc-500">Perfis já encontrados pela Share e disponíveis para reaproveitamento em novas vagas.</p>
      <div className="mt-5 divide-y divide-[#e4ebe2]">
        {candidates.map((item) => {
          const latest = item.reviews[0];
          return (
            <div key={item.id} className="flex flex-wrap items-start justify-between gap-4 py-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-[#003f2c]">{item.name}</strong>
                  {latest ? <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${latest.verdict === "recommended" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{latest.verdict === "recommended" ? "Recomendado" : "Alerta"}</span> : null}
                </div>
                <p className="mt-1 text-sm text-zinc-600">{item.currentTitle || "Cargo não informado"}{item.currentCompany ? ` · ${item.currentCompany}` : ""}</p>
                {latest ? <p className="mt-2 text-xs text-zinc-500">{latest.reviewerName}{latest.searchTitle ? ` · ${latest.searchTitle}` : ""}{latest.note ? ` · ${latest.note}` : ""}</p> : null}
              </div>
              {item.linkedinUrl ? <a href={item.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#006142]">LinkedIn <ExternalLink className="h-3.5 w-3.5" /></a> : null}
            </div>
          );
        })}
        {!candidates.length ? <p className="py-10 text-center text-sm text-zinc-500">O banco de candidatos ainda está vazio.</p> : null}
      </div>
    </section>
  );
}

function huntingLabel(ownerName?: string) {
  const first = (ownerName || "Equipe").trim().split(/\s+/)[0] || "Equipe";
  if (first.toLocaleLowerCase("pt-BR") === "gil") return "Hunting da Gil";
  return `Hunting de ${first}`;
}

function Intake({ form, setForm, pending, onSubmit }: { form: JobForm; setForm: (value: JobForm) => void; pending: boolean; onSubmit: () => void }) {
  return <section className="mt-8 max-w-4xl rounded-lg border border-[var(--share-line)] bg-white p-6"><p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Nova busca</p><h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">Cole a vaga completa</h2><p className="mt-2 text-sm leading-6 text-zinc-600">Título, local, responsabilidades e requisitos ficam no mesmo texto. A Share AI estrutura o Job DNA para sua revisão.</p><div className="mt-6 grid gap-4"><Area label="Vaga completa" value={form.description} setValue={(description) => setForm({ ...form, description })} rows={16} placeholder="Cole aqui a oportunidade exatamente como recebeu." /><div className="grid gap-4 md:grid-cols-3"><Field label="Link da vaga" value={form.jobUrl} setValue={(jobUrl) => setForm({ ...form, jobUrl })} placeholder="Opcional" /><Field label="Empresa ou cliente" value={form.companyName} setValue={(companyName) => setForm({ ...form, companyName })} placeholder="Opcional" /><Field label="Recrutadora responsável" value={form.recruiterName} setValue={(recruiterName) => setForm({ ...form, recruiterName })} placeholder="Opcional" /></div><div className="flex justify-end"><button type="button" disabled={pending || form.description.trim().length < 30} onClick={onSubmit} className="inline-flex items-center gap-2 rounded-md bg-[var(--share-green-950)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{pending ? "Analisando vaga" : "Analisar vaga"}</button></div></div></section>;
}

function DnaEditor({ initial, pending, onSave }: { initial: JobDna; pending: boolean; onSave: (dna: JobDna) => void }) {
  const [dna, setDna] = useState(initial);
  const updateCriterion = (index: number, patch: Partial<JobDna["criteria"][number]>) => setDna({ ...dna, criteria: dna.criteria.map((item, current) => current === index ? { ...item, ...patch } : item) });
  return <section className="mt-7 rounded-lg border border-[var(--share-line)] bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Job DNA</p><h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">Revise antes de buscar</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">Critérios não encontrados no perfil permanecem como “Não verificado”, sem reprovação automática.</p></div><button type="button" disabled={pending} onClick={() => onSave(dna)} className="inline-flex items-center gap-2 rounded-md border border-[var(--share-green-800)] px-4 py-2 text-sm font-semibold text-[var(--share-green-900)]"><Check className="h-4 w-4" />Salvar Job DNA</button></div><div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="Cargo identificado" value={dna.title} setValue={(title) => setDna({ ...dna, title })} /><Field label="Localização" value={dna.location || ""} setValue={(location) => setDna({ ...dna, location })} /></div><Area label="Resumo da oportunidade" value={dna.shortSummary} setValue={(shortSummary) => setDna({ ...dna, shortSummary })} rows={4} /><div className="mt-4 grid gap-4 md:grid-cols-3"><Field label="Área" value={dna.area || ""} setValue={(area) => setDna({ ...dna, area })} /><Field label="Senioridade" value={dna.seniority || ""} setValue={(seniority) => setDna({ ...dna, seniority })} /><Field label="Modelo de trabalho" value={dna.workModel || ""} setValue={(workModel) => setDna({ ...dna, workModel })} /></div>{dna.responsibilities.length ? <div className="mt-5"><p className="text-sm font-medium text-zinc-700">Responsabilidades identificadas</p><ul className="mt-2 grid gap-1 text-sm text-zinc-600">{dna.responsibilities.map((item) => <li key={item}>• {item}</li>)}</ul></div> : null}<div className="mt-5 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-[var(--share-line)] text-xs uppercase text-[var(--share-green-800)]"><tr><th className="p-3">Critério</th><th className="p-3">Classificação</th><th className="p-3">Trecho da vaga</th></tr></thead><tbody>{dna.criteria.map((item, index) => <tr key={item.id} className="border-b border-[var(--share-line)]"><td className="p-3"><input value={item.label} onChange={(event) => updateCriterion(index, { label: event.target.value })} className="w-full rounded-md border border-[var(--share-line)] px-2 py-1" /></td><td className="p-3"><select value={item.kind} onChange={(event) => updateCriterion(index, { kind: event.target.value as typeof item.kind })} className="rounded-md border border-[var(--share-line)] bg-white px-2 py-1"><option value="obrigatório">Obrigatório</option><option value="desejável">Desejável</option><option value="não relevante">Não relevante</option></select></td><td className="p-3 text-zinc-600">{item.sourceExcerpt}</td></tr>)}</tbody></table></div></section>;
}

function Results({ candidates, selected, setSelected, onOpen, onShortlist, onExport, exporting, onLoadMore, loadingMore }: { candidates: HrCandidate[]; selected: string[]; setSelected: (ids: string[]) => void; onOpen: (candidate: HrCandidate) => void; onShortlist: (candidate: HrCandidate, value: boolean) => void; onExport: (scope: "all" | "shortlist") => void; exporting: boolean; onLoadMore: () => void; loadingMore: boolean }) {
  return <section className="mt-6 overflow-hidden rounded-lg border border-[var(--share-line)] bg-white"><div className="flex flex-wrap items-end justify-between gap-4 p-5"><div><p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Resultados</p><h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">Ranking de aderência profissional</h2><p className="mt-1 text-sm text-zinc-600">{candidates.length} candidato(s) encontrado(s), ordenados por aderência à vaga.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => onExport("all")} disabled={exporting} className="inline-flex items-center gap-2 rounded-md border border-[var(--share-line)] px-3 py-2 text-sm"><Download className="h-4 w-4" />Exportar resultados</button><button type="button" onClick={() => onExport("shortlist")} disabled={exporting} className="inline-flex items-center gap-2 rounded-md border border-[var(--share-green-800)] px-3 py-2 text-sm text-[var(--share-green-900)]"><Download className="h-4 w-4" />Exportar shortlist</button></div></div><div className="overflow-x-auto"><table className="w-full min-w-[960px] text-left text-sm"><thead className="border-y border-[var(--share-line)] bg-[#fbfdf8] text-xs uppercase text-[var(--share-green-800)]"><tr><th className="p-3">#</th><th className="p-3">Candidato</th><th className="p-3">Cargo atual</th><th className="p-3">Localização</th><th className="p-3">Aderência</th><th className="p-3">Principal sinal</th><th className="p-3">Shortlist</th></tr></thead><tbody>{candidates.map((item, index) => <tr key={item.id} className="border-b border-[var(--share-line)]"><td className="p-3"><label className="flex items-center gap-3"><input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} />{index + 1}</label></td><td className="p-3"><button type="button" onClick={() => onOpen(item)} className="font-medium text-[var(--share-green-950)] hover:underline">{item.name}</button><p className="mt-1 text-xs text-zinc-500">{item.currentCompany || "Empresa não informada pela fonte"}</p></td><td className="p-3">{item.currentTitle || "Não informado"}</td><td className="p-3">{item.location || "Não informada"}</td><td className="p-3"><strong className="text-lg text-[var(--share-green-950)]">{item.fitScore}%</strong><p className="text-xs text-zinc-500">{item.fitClassification}</p></td><td className="p-3">{item.mainSignal || "A validar"}</td><td className="p-3"><div className="flex items-center gap-2"><button type="button" onClick={() => onShortlist(item, !item.shortlisted)} className="rounded-md border border-[var(--share-line)] px-3 py-2">{item.shortlisted ? "Remover" : "Adicionar"}</button>{item.profileUrl ? <a href={item.profileUrl} target="_blank" rel="noreferrer" aria-label="Abrir LinkedIn"><ExternalLink className="h-4 w-4 text-[var(--share-green-800)]" /></a> : null}</div></td></tr>)}</tbody></table></div><div className="flex flex-wrap items-center justify-between gap-4 bg-[#fbfdf8] p-5"><p className="text-sm text-zinc-600">Novos lotes são deduplicados pela URL real do LinkedIn antes de entrar no ranking.</p><button type="button" onClick={onLoadMore} disabled={loadingMore} className="inline-flex items-center gap-2 rounded-md bg-[var(--share-green-950)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{loadingMore ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{loadingMore ? "Buscando novos perfis" : "Carregar mais 20"}</button></div></section>;
}

function CandidateDrawer({ candidate, search, accountName, onClose, onShortlist }: { candidate: HrCandidate; search: HrHuntingSearchSnapshot; accountName?: string | null; onClose: () => void; onShortlist: (candidate: HrCandidate, value: boolean) => void }) {
  const [copied, setCopied] = useState(false);
  const outreachMessage = buildLinkedInOutreachMessage(candidate, search, accountName);
  const hasJobLink = Boolean(search.jobUrl?.trim());

  async function copyMessage() {
    if (!hasJobLink) return;
    try {
      await navigator.clipboard.writeText(outreachMessage);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return <div className="fixed inset-0 z-50 bg-black/35" onMouseDown={onClose}><aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Candidato</p><h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">{candidate.name}</h2><p className="mt-1 text-sm text-zinc-600">{candidate.currentTitle || "Cargo não informado"}{candidate.currentCompany ? ` · ${candidate.currentCompany}` : ""}</p></div><button type="button" onClick={onClose}><X className="h-5 w-5" /></button></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><Metric label="Aderência" value={`${candidate.fitScore}%`} /><Metric label="Confiança" value={candidate.confidence} /></div>{candidate.professionalSummary ? <section className="mt-5"><h3 className="font-semibold text-[var(--share-green-950)]">Resumo profissional</h3><p className="mt-2 text-sm leading-6 text-zinc-600">{candidate.professionalSummary}</p></section> : null}<section className="mt-5"><h3 className="font-semibold text-[var(--share-green-950)]">Critérios avaliados</h3><div className="mt-2 grid gap-2">{candidate.evidence.map((item) => <div key={`${item.criterion}-${item.result}`} className="rounded-md border border-[var(--share-line)] p-3"><p className="text-sm font-medium">{item.criterion}</p><p className="mt-1 text-xs text-zinc-500">{item.result} · {item.confidence}</p>{item.evidence ? <p className="mt-2 text-sm text-zinc-600">{item.evidence}</p> : null}</div>)}</div></section>{candidate.pointsToValidate.length ? <section className="mt-5"><h3 className="font-semibold text-[var(--share-green-950)]">Pontos a validar</h3><ul className="mt-2 grid gap-1 text-sm text-zinc-600">{candidate.pointsToValidate.map((item) => <li key={item}>• {item}</li>)}</ul></section> : null}<section className="mt-5 rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-[var(--share-green-950)]">Mensagem para LinkedIn</h3><p className="mt-1 text-xs text-zinc-500">A abordagem usa o nome da conta que está logada e o link cadastrado da vaga.</p></div><button type="button" onClick={copyMessage} disabled={!hasJobLink} className="inline-flex items-center gap-2 rounded-md border border-[var(--share-green-800)] px-3 py-2 text-sm font-semibold text-[var(--share-green-900)] disabled:cursor-not-allowed disabled:opacity-50"><Copy className="h-4 w-4" />{copied ? "Copiado" : "Copiar mensagem"}</button></div><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{outreachMessage}</p>{!hasJobLink ? <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Adicione o link da vaga no InHire para habilitar a cópia da mensagem completa.</p> : null}</section><div className="mt-6 flex flex-wrap gap-2"><button type="button" onClick={() => onShortlist(candidate, !candidate.shortlisted)} className="rounded-md bg-[var(--share-green-950)] px-4 py-2 text-sm font-semibold text-white">{candidate.shortlisted ? "Remover da shortlist" : "Adicionar à shortlist"}</button>{candidate.profileUrl ? <a href={candidate.profileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-[var(--share-green-800)] px-4 py-2 text-sm font-semibold text-[var(--share-green-900)]">LinkedIn <ExternalLink className="h-4 w-4" /></a> : null}</div></aside></div>;
}

function Compare({ candidates }: { candidates: HrCandidate[] }) { return <section className="mt-6 rounded-lg border border-[var(--share-line)] bg-white p-5"><p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Comparação</p><h2 className="mt-1 text-xl font-semibold text-[var(--share-green-950)]">Candidatos selecionados</h2><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{candidates.map((item) => <article key={item.id} className="rounded-md border border-[var(--share-line)] p-4"><h3 className="font-semibold">{item.name}</h3><p className="mt-1 text-sm text-zinc-600">{item.currentTitle || "Cargo a validar"}</p><p className="mt-3 text-2xl font-semibold text-[var(--share-green-950)]">{item.fitScore}%</p><p className="text-xs text-zinc-500">{item.fitClassification}</p></article>)}</div></section>; }

function ConnectorNotice({ status, warnings }: { status: string; warnings: string[] }) { if (!warnings.length) return null; const headline = status === "connector_error" ? "A pesquisa precisa de atenção" : "Detalhes da pesquisa"; return <details className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3"><summary className="cursor-pointer text-sm font-semibold text-amber-900">{headline}</summary><ul className="mt-3 grid gap-1 text-sm leading-6 text-amber-900">{warnings.slice(-6).map((item, index) => <li key={`${index}-${item}`}>• {item}</li>)}</ul></details>; }
function State({ title, text }: { title: string; text: string }) { return <section className="mt-5 rounded-lg border border-[var(--share-line)] bg-white p-5"><h2 className="font-semibold text-[var(--share-green-950)]">{title}</h2><p className="mt-2 text-sm leading-6 text-zinc-600">{text}</p></section>; }
function Field({ label, value, setValue, placeholder = "" }: { label: string; value: string; setValue: (value: string) => void; placeholder?: string }) { return <label className="grid gap-1 text-sm font-medium text-zinc-700">{label}<input value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} className="h-10 rounded-md border border-[var(--share-line)] px-3 font-normal" /></label>; }
function Area({ label, value, setValue, rows = 5, placeholder = "" }: { label: string; value: string; setValue: (value: string) => void; rows?: number; placeholder?: string }) { return <label className="mt-4 grid gap-1 text-sm font-medium text-zinc-700">{label}<textarea value={value} onChange={(event) => setValue(event.target.value)} rows={rows} placeholder={placeholder} className="rounded-md border border-[var(--share-line)] p-3 font-normal" /></label>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-3"><p className="text-xs uppercase text-zinc-500">{label}</p><p className="mt-1 font-semibold text-[var(--share-green-950)]">{value}</p></div>; }
function split(value: string) { return [...new Set(value.split(/[,;\n]/).map((item) => item.trim()).filter((item) => item.length >= 2))]; }
