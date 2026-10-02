"use client";

import { useEffect, useMemo, useState } from "react";
import { BookmarkPlus, Building2, Database, Download, ExternalLink, FolderSearch, ListChecks, LoaderCircle, Plus, Search, Trash2, Users } from "lucide-react";
import { demoBusinessUnits } from "@/lib/tenancy/demo";
import { defaultBusinessUnitId, getBusinessUnitDna } from "@/lib/business-units/dna";
import { getSuggestedRoles } from "@/lib/decision-makers/roleIntelligence";
import { splitTerms, type DecisionMakerResult, type HuntingCompany, type HuntingPerson } from "@/lib/decision-makers/search";

type SearchMode = "companies" | "people";
type PeopleSearchTarget = { companyLinkedinUrls: string[]; companyNames: string[] };
type WorkspaceView = "search" | "all" | "mine" | "leads" | "my-leads" | "list";
type SavedB2BSearch = {
  id: string; title: string; mode: string; ownerId: string; ownerName: string; mine: boolean;
  resultCount: number; reused: boolean; updatedAt: string;
};
type WorkspaceLead = {
  id: string; kind: string; name: string; companyName?: string | null; title?: string | null;
  linkedinUrl?: string | null; domain?: string | null; website?: string | null; location?: string | null;
  firstSeenByName: string; mine: boolean; updatedAt: string; payload: unknown;
};
type WorkspaceList = {
  id: string; name: string; ownerId: string; ownerName: string; mine: boolean; shared: boolean; itemCount: number; updatedAt: string;
};
type WorkspaceListDetail = {
  id: string; name: string; ownerId: string; ownerName: string;
  items: Array<{ id: string; addedByName: string; createdAt: string; lead: WorkspaceLead }>;
};

export function DecisionMakerMapExperienceV2() {
  const units = useMemo(() => demoBusinessUnits.filter((unit) => unit.contextType === "business"), []);
  const initialUnit = units.find((unit) => unit.id === defaultBusinessUnitId) || units[0];
  const [mode, setMode] = useState<SearchMode>("people");
  const [businessUnitId, setBusinessUnitId] = useState(initialUnit.id);
  const [objective, setObjective] = useState(buildObjective(initialUnit.id));
  const [result, setResult] = useState<DecisionMakerResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("search");
  const [savedSearches, setSavedSearches] = useState<SavedB2BSearch[]>([]);
  const [workspaceLeads, setWorkspaceLeads] = useState<WorkspaceLead[]>([]);
  const [workspaceLists, setWorkspaceLists] = useState<WorkspaceList[]>([]);
  const [activeList, setActiveList] = useState<WorkspaceListDetail | null>(null);
  const [selectedListId, setSelectedListId] = useState("");
  const [newListName, setNewListName] = useState("");
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  const [industries, setIndustries] = useState("");
  const [country, setCountry] = useState("Brazil");
  const [states, setStates] = useState("");
  const [companyKeywords, setCompanyKeywords] = useState("");
  const [domains, setDomains] = useState("");
  const [companyQuantity, setCompanyQuantity] = useState(15);

  const [companyLinkedinUrls, setCompanyLinkedinUrls] = useState("");
  const [companyNames, setCompanyNames] = useState("");
  const [rolesText, setRolesText] = useState(getSuggestedRoles(initialUnit.id).slice(0, 5).join(", "));
  const [locations, setLocations] = useState("Brasil");
  const [profileKeywords, setProfileKeywords] = useState("");
  const [peopleQuantity, setPeopleQuantity] = useState(50);
  const [includeBroadDiscovery, setIncludeBroadDiscovery] = useState(false);

  const selectedCompanies = useMemo(
    () => result?.companies.filter((company) => selectedCompanyIds.includes(company.id)) || [],
    [result, selectedCompanyIds],
  );
  const canSearch = mode === "companies"
    ? Boolean(splitTerms(industries).length || splitTerms(companyKeywords).length || splitTerms(domains).length)
    : Boolean(splitTerms(companyLinkedinUrls).length && splitTerms(rolesText).length);

  useEffect(() => {
    void refreshWorkspace();
  }, []);

  async function refreshWorkspace() {
    try {
      const response = await fetch("/api/decision-makers/workspace", { cache: "no-store" });
      const body = await response.json() as { searches?: SavedB2BSearch[]; leads?: WorkspaceLead[]; lists?: WorkspaceList[] };
      if (!response.ok) return;
      setSavedSearches(body.searches || []);
      setWorkspaceLeads(body.leads || []);
      setWorkspaceLists(body.lists || []);
      setSelectedListId((current) => current || body.lists?.[0]?.id || "");
    } catch {
      // O motor de busca continua disponível mesmo se o workspace estiver temporariamente indisponível.
    }
  }

  async function openSavedSearch(id: string) {
    setWorkspaceLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/decision-makers/workspace/${id}`, { cache: "no-store" });
      const body = await response.json() as { search?: { input: import("@/lib/decision-makers/search").DecisionMakerSearchInput; result: DecisionMakerResult }; error?: string };
      if (!response.ok || !body.search) throw new Error(body.error || "Não foi possível abrir a pesquisa.");
      applyWorkspaceInput(body.search.input);
      setResult(body.search.result);
      setSelectedCompanyIds([]);
      setWorkspaceView("search");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível abrir a pesquisa.");
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function deleteSavedSearch(item: SavedB2BSearch) {
    if (!item.mine || !window.confirm(`Excluir a pesquisa "${item.title}"? Os leads globais encontrados nela serão preservados.`)) return;
    setWorkspaceLoading(true);
    try {
      const response = await fetch(`/api/decision-makers/workspace/${item.id}`, { method: "DELETE" });
      const body = await response.json() as { deleted?: boolean; error?: string };
      if (!response.ok || !body.deleted) throw new Error(body.error || "Não foi possível excluir a pesquisa.");
      await refreshWorkspace();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível excluir a pesquisa.");
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function createSharedList() {
    if (newListName.trim().length < 2) return;
    setWorkspaceLoading(true);
    try {
      const response = await fetch("/api/decision-makers/lists", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newListName.trim() }),
      });
      const body = await response.json() as { list?: { id: string }; error?: string };
      if (!response.ok || !body.list) throw new Error(body.error || "Não foi possível criar a lista.");
      setNewListName("");
      setSelectedListId(body.list.id);
      await refreshWorkspace();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar a lista.");
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function openSharedList(id: string) {
    setWorkspaceLoading(true);
    try {
      const response = await fetch(`/api/decision-makers/lists/${id}`, { cache: "no-store" });
      const body = await response.json() as { list?: WorkspaceListDetail; error?: string };
      if (!response.ok || !body.list) throw new Error(body.error || "Não foi possível abrir a lista.");
      setActiveList(body.list);
      setSelectedListId(id);
      setWorkspaceView("list");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível abrir a lista.");
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function saveLeadToList(leadId?: string) {
    if (!leadId) return setError("Este resultado ainda não possui um registro de lead no workspace.");
    if (!selectedListId) return setError("Crie ou selecione uma lista compartilhada antes de salvar o lead.");
    try {
      const response = await fetch(`/api/decision-makers/lists/${selectedListId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Não foi possível salvar o lead na lista.");
      await refreshWorkspace();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o lead na lista.");
    }
  }

  function applyWorkspaceInput(input: import("@/lib/decision-makers/search").DecisionMakerSearchInput) {
    setBusinessUnitId(input.businessUnitId);
    setObjective(input.objective);
    setMode(input.mode);
    if (input.mode === "companies") {
      setIndustries(input.filters.industries.join(", "));
      setCountry(input.filters.country);
      setStates(input.filters.states.join(", "));
      setCompanyKeywords(input.filters.keywords.join(", "));
      setDomains(input.filters.domains.join(", "));
      setCompanyQuantity(input.filters.quantity);
    } else {
      setCompanyLinkedinUrls(input.filters.companyLinkedinUrls.join("\n"));
      setCompanyNames(input.filters.companyNames.join(", "));
      setRolesText(input.filters.roles.join(", "));
      setLocations(input.filters.locations.join(", "));
      setProfileKeywords(input.filters.profileKeywords.join(", "));
      setPeopleQuantity(input.filters.quantity);
      setIncludeBroadDiscovery(input.filters.includeBroadDiscovery);
    }
  }

  async function runSearch({
    loadMore = false,
    forceRefresh = false,
    peopleTarget,
  }: {
    loadMore?: boolean;
    forceRefresh?: boolean;
    peopleTarget?: PeopleSearchTarget;
  } = {}) {
    const searchMode: SearchMode = peopleTarget ? "people" : mode;
    const targetCompanyUrls = peopleTarget?.companyLinkedinUrls ?? splitTerms(companyLinkedinUrls);
    const targetCompanyNames = peopleTarget?.companyNames ?? splitTerms(companyNames);
    const canRun = searchMode === "companies"
      ? Boolean(splitTerms(industries).length || splitTerms(companyKeywords).length || splitTerms(domains).length)
      : Boolean(targetCompanyUrls.length && splitTerms(rolesText).length);

    if (!canRun) {
      setError(searchMode === "companies" ? "Informe setor, palavra-chave ou domínio." : "Informe ao menos uma página corporativa do LinkedIn e um cargo.");
      return;
    }

    if (loadMore) setIsLoadingMore(true);
    else setIsSearching(true);
    setError(null);

    try {
      const currentCount = searchMode === "companies" ? result?.companies.length || 0 : result?.people.length || 0;
      const baseQuantity = searchMode === "companies" ? companyQuantity : peopleQuantity;
      const requestedQuantity = loadMore ? Math.min(50, Math.max(baseQuantity, currentCount + 20)) : baseQuantity;
      const payload = searchMode === "companies"
        ? {
            mode: searchMode,
            businessUnitId,
            objective,
            forceRefresh: forceRefresh || loadMore,
            filters: {
              industries: splitTerms(industries),
              country,
              states: splitTerms(states),
              cityPostalCodes: [],
              employeeRanges: [],
              keywords: splitTerms(companyKeywords),
              technologies: [],
              revenueRanges: [],
              domains: splitTerms(domains),
              quantity: requestedQuantity,
            },
          }
        : {
            mode: searchMode,
            businessUnitId,
            objective,
            forceRefresh: forceRefresh || loadMore,
            filters: {
              companyLinkedinUrls: targetCompanyUrls,
              companyNames: targetCompanyNames,
              roles: splitTerms(rolesText),
              departments: [],
              seniority: [],
              locations: splitTerms(locations),
              profileKeywords: splitTerms(profileKeywords),
              desiredDecisionRole: "Decisor funcional",
              quantity: requestedQuantity,
              includeBroadDiscovery,
            },
          };

      const response = await fetch("/api/decision-makers/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as DecisionMakerResult | { error?: string };
      if (!response.ok) throw new Error("error" in data && data.error ? data.error : "Não foi possível concluir a busca.");
      const next = data as DecisionMakerResult;

      if (loadMore && result && result.mode === next.mode) {
        const merged = mergeResults(result, next);
        const before = currentCount;
        const after = searchMode === "companies" ? merged.companies.length : merged.people.length;
        setResult(merged);
        if (after === before) setError("A nova rodada não trouxe resultados inéditos. Amplie os critérios para aumentar a cobertura.");
      } else {
        setResult(next);
        setSelectedCompanyIds([]);
      }
      await refreshWorkspace();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir a busca.");
    } finally {
      setIsSearching(false);
      setIsLoadingMore(false);
    }
  }

  async function searchPeopleForCompanies(companies: HuntingCompany[]) {
    const usable = companies.filter((company) => company.linkedinUrl);
    if (!usable.length) {
      setError("A empresa precisa ter uma página corporativa do LinkedIn identificada para buscar decisores.");
      return;
    }

    const urls = usable.map((company) => company.linkedinUrl).filter((url): url is string => Boolean(url));
    const names = usable.map((company) => company.name);
    setCompanyLinkedinUrls(urls.join("\n"));
    setCompanyNames(names.join(", "));
    setMode("people");
    setResult(null);
    setError(null);
    window.scrollTo({ top: 320, behavior: "smooth" });
    await runSearch({ forceRefresh: true, peopleTarget: { companyLinkedinUrls: urls, companyNames: names } });
  }

  function continueWithSelectedCompanies() {
    void searchPeopleForCompanies(selectedCompanies);
  }

  async function exportSnapshot() {
    if (!result) return;
    setIsExporting(true);
    try {
      const response = await fetch("/api/decision-makers/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      if (!response.ok) throw new Error("Não foi possível gerar a planilha.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `share-ai-hunting-${result.generatedAt.slice(0, 10)}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível exportar.");
    } finally {
      setIsExporting(false);
    }
  }

  function changeContext(id: string) {
    setBusinessUnitId(id);
    setObjective(buildObjective(id));
    setRolesText(getSuggestedRoles(id).slice(0, 5).join(", "));
    setResult(null);
    setSelectedCompanyIds([]);
  }

  return <main className="share-shell min-h-screen text-[var(--share-ink)]">
    <div className="mx-auto max-w-[1600px] px-5 py-7">
      <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <B2BWorkspaceSidebar
          view={workspaceView}
          searches={savedSearches}
          leads={workspaceLeads}
          lists={workspaceLists}
          newListName={newListName}
          setNewListName={setNewListName}
          onNew={() => { setWorkspaceView("search"); setResult(null); }}
          onView={setWorkspaceView}
          onOpenList={(id) => void openSharedList(id)}
          onCreateList={() => void createSharedList()}
        />
        <div className="min-w-0 grid gap-5">
      <section className="rounded-lg bg-[var(--share-green-950)] p-6 text-white">
        <p className="text-xs font-semibold uppercase text-[var(--share-lime)]">B2B Hunting</p>
        <h1 className="mt-2 text-3xl font-semibold">Encontre contas e decisores sem repetir resultados.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">Cada nova rodada amplia a cobertura e deduplica por LinkedIn, domínio e identificadores confiáveis antes de exibir.</p>
      </section>

      {workspaceView === "search" ? <section className="rounded-lg border border-[var(--share-line)] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--share-line)] p-3">
          <div className="flex gap-2">
            <Mode active={mode === "companies"} icon={Building2} label="Encontrar empresas" onClick={() => { setWorkspaceView("search"); setMode("companies"); setResult(null); }} />
            <Mode active={mode === "people"} icon={Users} label="Encontrar pessoas" onClick={() => { setWorkspaceView("search"); setMode("people"); setResult(null); }} />
          </div>
          <div className="grid min-w-[520px] gap-2 sm:grid-cols-[200px_1fr]">
            <label className="grid gap-1 text-xs font-semibold text-zinc-600">Contexto de negócio<select value={businessUnitId} onChange={(event) => changeContext(event.target.value)} className="h-10 border border-[var(--share-line)] bg-white px-3 text-sm">{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
            <Field label="Objetivo comercial" value={objective} setValue={setObjective} />
          </div>
        </div>

        <div className="grid lg:grid-cols-[340px_1fr]">
          <aside className="border-r border-[var(--share-line)] p-5">
            {mode === "companies" ? <div className="grid gap-4">
              <Area label="Setores" value={industries} setValue={setIndustries} />
              <Field label="País" value={country} setValue={setCountry} />
              <Field label="Estados / regiões" value={states} setValue={setStates} />
              <Area label="Palavras-chave" value={companyKeywords} setValue={setCompanyKeywords} />
              <Area label="Domínios" value={domains} setValue={setDomains} />
              <NumberField label="Resultados iniciais" value={companyQuantity} setValue={setCompanyQuantity} />
            </div> : <div className="grid gap-4">
              <Area label="Páginas corporativas do LinkedIn" value={companyLinkedinUrls} setValue={setCompanyLinkedinUrls} placeholder="https://www.linkedin.com/company/empresa" />
              <Field label="Nomes das empresas" value={companyNames} setValue={setCompanyNames} />
              <Area label="Cargos e famílias" value={rolesText} setValue={setRolesText} />
              <Field label="Localizações" value={locations} setValue={setLocations} />
              <Area label="Palavras-chave profissionais" value={profileKeywords} setValue={setProfileKeywords} />
              <NumberField label="Pessoas desejadas (até 50)" value={peopleQuantity} setValue={setPeopleQuantity} />
              <p className="text-xs leading-5 text-zinc-500">Primeiro buscamos os cargos e locais informados. Se faltarem resultados, consultamos outros funcionários das mesmas empresas e priorizamos a aderência no ranking. A quantidade depende da cobertura da fonte.</p>
              <label className="flex items-start gap-2 text-sm text-zinc-600"><input type="checkbox" checked={includeBroadDiscovery} onChange={(event) => setIncludeBroadDiscovery(event.target.checked)} className="mt-1" />Consultar fonte complementar mesmo após atingir a meta</label>
            </div>}
            <button type="button" onClick={() => runSearch()} disabled={isSearching || !canSearch} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--share-green-950)] px-4 text-sm font-semibold text-white disabled:opacity-50">
              {isSearching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {isSearching ? "Pesquisando fontes" : mode === "companies" ? "Buscar empresas" : "Buscar pessoas"}
            </button>
            {error ? <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">{error}</p> : null}
          </aside>

          <div className="min-w-0 p-5">
            {!result ? <Empty mode={mode} /> : <>
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--share-line)] pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Resultados</p>
                    {result.persistentCache ? <span className="rounded-full bg-[#eef6e8] px-2 py-1 text-[10px] font-bold uppercase text-[#52712b]">Reaproveitado do Banco Share</span> : null}
                  </div>
                  <h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">{result.mode === "companies" ? `${result.companies.length} contas encontradas` : `${result.people.length} pessoas encontradas`}</h2>
                  <p className="mt-1 text-sm text-zinc-600">{result.nextBestAction.reason}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => runSearch({ forceRefresh: true })} className="rounded-md border border-[var(--share-line)] px-3 py-2 text-sm">Atualizar resultados</button>
                  <button type="button" onClick={exportSnapshot} disabled={isExporting} className="inline-flex items-center gap-2 rounded-md border border-[var(--share-green-800)] px-3 py-2 text-sm text-[var(--share-green-900)]"><Download className="h-4 w-4" />Exportar</button>
                </div>
              </div>

              {result.mode === "companies" ? <CompanyTable
                companies={result.companies}
                selected={selectedCompanyIds}
                setSelected={setSelectedCompanyIds}
                onContinue={continueWithSelectedCompanies}
                onSearchCompany={(company) => { void searchPeopleForCompanies([company]); }}
                isSearching={isSearching}
                selectedListId={selectedListId}
                lists={workspaceLists}
                onSelectList={setSelectedListId}
                onSaveLead={(leadId) => void saveLeadToList(leadId)}
              /> : <PeopleTable people={result.people} selectedListId={selectedListId} lists={workspaceLists} onSelectList={setSelectedListId} onSaveLead={(leadId) => void saveLeadToList(leadId)} />}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-md bg-[#fbfdf8] p-4">
                <p className="text-sm text-zinc-600">{result.mode === "companies" ? "Novas contas são deduplicadas por LinkedIn, domínio e nome normalizado." : "Novas pessoas são deduplicadas pela URL real do LinkedIn e ID da fonte."}</p>
                <button type="button" onClick={() => runSearch({ loadMore: true })} disabled={isLoadingMore || (result.mode === "companies" ? result.companies.length >= 50 : result.people.length >= 50)} className="inline-flex items-center gap-2 rounded-md bg-[var(--share-green-950)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {isLoadingMore ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {isLoadingMore ? "Buscando inéditos" : "Carregar mais 20"}
                </button>
              </div>

              {result.warnings.length ? <details className="mt-4 rounded-md border border-[var(--share-line)] p-3">
                <summary className="cursor-pointer text-sm font-semibold text-[var(--share-green-900)]">Detalhes da pesquisa</summary>
                <ul className="mt-2 grid gap-1 text-xs leading-5 text-zinc-600">{result.warnings.slice(-8).map((warning) => <li key={warning}>• {warning}</li>)}</ul>
              </details> : null}
            </>}
          </div>
        </div>
      </section> : null}

      {workspaceLoading ? <div className="rounded-2xl border border-[var(--share-line)] bg-white p-5 text-sm text-zinc-500"><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />Atualizando workspace...</div> : null}

      {!workspaceLoading && (workspaceView === "all" || workspaceView === "mine") ? (
        <SavedSearchPanel
          title={workspaceView === "mine" ? "Minhas pesquisas" : "Pesquisas da equipe"}
          searches={workspaceView === "mine" ? savedSearches.filter((item) => item.mine) : savedSearches}
          onOpen={(id) => void openSavedSearch(id)}
          onDelete={(item) => void deleteSavedSearch(item)}
        />
      ) : null}

      {!workspaceLoading && (workspaceView === "leads" || workspaceView === "my-leads") ? (
        <WorkspaceLeadsPanel
          title={workspaceView === "my-leads" ? "Meus leads" : "Leads da equipe"}
          leads={workspaceView === "my-leads" ? workspaceLeads.filter((lead) => lead.mine) : workspaceLeads}
          lists={workspaceLists}
          selectedListId={selectedListId}
          onSelectList={setSelectedListId}
          onSaveLead={(leadId) => void saveLeadToList(leadId)}
        />
      ) : null}

      {!workspaceLoading && workspaceView === "list" ? (
        <LeadListPanel list={activeList} />
      ) : null}
        </div>
      </div>
    </div>
  </main>;
}

function B2BWorkspaceSidebar({
  view, searches, leads, lists, newListName, setNewListName, onNew, onView, onOpenList, onCreateList,
}: {
  view: WorkspaceView;
  searches: SavedB2BSearch[];
  leads: WorkspaceLead[];
  lists: WorkspaceList[];
  newListName: string;
  setNewListName: (value: string) => void;
  onNew: () => void;
  onView: (view: WorkspaceView) => void;
  onOpenList: (id: string) => void;
  onCreateList: () => void;
}) {
  const mine = searches.filter((item) => item.mine).length;
  return <aside className="self-start rounded-2xl bg-[var(--share-green-950)] p-4 text-white shadow-sm lg:sticky lg:top-24">
    <p className="px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--share-lime)]">B2B Workspace</p>
    <button type="button" onClick={onNew} className={`mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${view === "search" ? "bg-[var(--share-lime)] text-[var(--share-green-950)]" : "bg-white text-[var(--share-green-950)]"}`}><Plus className="h-4 w-4" /> Nova busca</button>
    <nav className="mt-4 space-y-1">
      <button type="button" onClick={() => onView("all")} className={workspaceNav(view === "all")}><FolderSearch className="h-4 w-4" /><span className="flex-1">Pesquisas da equipe</span><span className="text-xs opacity-50">{searches.length}</span></button>
      <button type="button" onClick={() => onView("mine")} className={workspaceNav(view === "mine")}><Search className="h-4 w-4" /><span className="flex-1">Minhas pesquisas</span><span className="text-xs opacity-50">{mine}</span></button>
      <button type="button" onClick={() => onView("leads")} className={workspaceNav(view === "leads")}><Database className="h-4 w-4" /><span className="flex-1">Leads da equipe</span><span className="text-xs opacity-50">{leads.length}</span></button>
      <button type="button" onClick={() => onView("my-leads")} className={workspaceNav(view === "my-leads")}><Users className="h-4 w-4" /><span className="flex-1">Meus leads</span><span className="text-xs opacity-50">{leads.filter((lead) => lead.mine).length}</span></button>
    </nav>
    <div className="my-4 h-px bg-white/10" />
    <div className="px-2">
      <div className="flex items-center gap-2"><ListChecks className="h-4 w-4 text-[var(--share-lime)]" /><p className="text-xs font-bold uppercase tracking-[0.12em] text-white/65">Listas compartilhadas</p></div>
      <div className="mt-2 space-y-1">
        {lists.map((list) => <button key={list.id} type="button" onClick={() => onOpenList(list.id)} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs text-white/75 hover:bg-white/10 hover:text-white"><span className="truncate">{list.name}</span><span className="opacity-45">{list.itemCount}</span></button>)}
      </div>
      <input value={newListName} onChange={(event) => setNewListName(event.target.value)} placeholder="Nova lista" className="mt-3 h-9 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-xs text-white placeholder:text-white/35" />
      <button type="button" onClick={onCreateList} disabled={newListName.trim().length < 2} className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white px-3 text-xs font-bold text-[var(--share-green-950)] disabled:opacity-40"><Plus className="h-3.5 w-3.5" /> Criar lista</button>
    </div>
    <div className="mt-5 border-t border-white/10 px-2 pt-4"><p className="text-[10px] uppercase tracking-[0.12em] text-white/40">Cache Share</p><p className="mt-1 text-xs leading-5 text-white/55">Buscas idênticas recentes são reaproveitadas antes de chamar fontes externas.</p></div>
  </aside>;
}

function workspaceNav(active: boolean) {
  return `flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold ${active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`;
}

function SavedSearchPanel({ title, searches, onOpen, onDelete }: { title: string; searches: SavedB2BSearch[]; onOpen: (id: string) => void; onDelete: (item: SavedB2BSearch) => void }) {
  return <section className="rounded-2xl border border-[var(--share-line)] bg-white p-6">
    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--share-green-800)]">Workspace compartilhado</p>
    <h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">{title}</h2>
    <div className="mt-5 grid gap-3 md:grid-cols-2">
      {searches.map((item) => <article key={item.id} className="rounded-2xl border border-[var(--share-line)] bg-[#fbfdf9] p-5">
        <div className="flex items-start justify-between gap-3">
          <button type="button" onClick={() => onOpen(item.id)} className="min-w-0 flex-1 text-left">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--share-green-800)]">{huntingOwnerLabel(item.ownerName)}</p>
            <h3 className="mt-1 text-lg font-semibold text-[var(--share-green-950)]">{item.title}</h3>
            <p className="mt-3 text-xs text-zinc-500">{item.resultCount} resultado(s){item.reused ? " · reaproveitada do banco Share" : ""}</p>
          </button>
          {item.mine ? <button type="button" onClick={() => onDelete(item)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label="Excluir pesquisa"><Trash2 className="h-4 w-4" /></button> : null}
        </div>
      </article>)}
      {!searches.length ? <p className="col-span-full py-10 text-center text-sm text-zinc-500">Nenhuma pesquisa salva nesta área.</p> : null}
    </div>
  </section>;
}

function WorkspaceLeadsPanel({ title, leads, lists, selectedListId, onSelectList, onSaveLead }: { title: string; leads: WorkspaceLead[]; lists: WorkspaceList[]; selectedListId: string; onSelectList: (id: string) => void; onSaveLead: (id: string) => void }) {
  return <section className="rounded-2xl border border-[var(--share-line)] bg-white p-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--share-green-800)]">Banco Share</p><h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">{title}</h2><p className="mt-2 text-sm text-zinc-500">Empresas e pessoas já encontradas pelo comercial, preservando quem trouxe o lead primeiro.</p></div>
      <LeadListSelector lists={lists} selectedListId={selectedListId} onSelectList={onSelectList} />
    </div>
    <div className="mt-5 divide-y divide-[var(--share-line)]">
      {leads.map((lead) => <div key={lead.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
        <div><div className="flex flex-wrap items-center gap-2"><strong className="text-[var(--share-green-950)]">{lead.name}</strong><span className="rounded-full bg-[#eef6e8] px-2 py-1 text-[10px] font-bold uppercase text-[#52712b]">{leadOwnerLabel(lead.firstSeenByName)}</span></div><p className="mt-1 text-sm text-zinc-500">{lead.title || lead.companyName || lead.domain || "Informações comerciais preservadas no banco Share"}{lead.location ? ` · ${lead.location}` : ""}</p></div>
        <div className="flex gap-2">{lead.linkedinUrl ? <a href={lead.linkedinUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-[var(--share-line)] px-3 py-2 text-xs font-semibold text-[var(--share-green-800)]">LinkedIn</a> : null}<button type="button" onClick={() => onSaveLead(lead.id)} className="inline-flex items-center gap-1 rounded-lg bg-[var(--share-green-950)] px-3 py-2 text-xs font-semibold text-white"><BookmarkPlus className="h-3.5 w-3.5" /> Salvar na lista</button></div>
      </div>)}
      {!leads.length ? <p className="py-10 text-center text-sm text-zinc-500">O banco comercial ainda está vazio.</p> : null}
    </div>
  </section>;
}

function LeadListPanel({ list }: { list: WorkspaceListDetail | null }) {
  if (!list) return <section className="rounded-2xl border border-[var(--share-line)] bg-white p-8 text-center text-sm text-zinc-500">Selecione uma lista compartilhada.</section>;
  return <section className="rounded-2xl border border-[var(--share-line)] bg-white p-6">
    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--share-green-800)]">Lista compartilhada</p>
    <h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">{list.name}</h2>
    <p className="mt-1 text-sm text-zinc-500">Criada por {list.ownerName}</p>
    <div className="mt-5 divide-y divide-[var(--share-line)]">{list.items.map((item) => <div key={item.id} className="py-4"><div className="flex flex-wrap items-center gap-2"><strong>{item.lead.name}</strong><span className="rounded-full bg-[#eef6e8] px-2 py-1 text-[10px] font-bold uppercase text-[#52712b]">{leadOwnerLabel(item.lead.firstSeenByName)}</span></div><p className="mt-1 text-sm text-zinc-500">{item.lead.title || item.lead.companyName || item.lead.domain || ""}</p><p className="mt-1 text-xs text-zinc-400">Adicionado por {item.addedByName}</p></div>)}</div>
  </section>;
}

function LeadListSelector({ lists, selectedListId, onSelectList }: { lists: WorkspaceList[]; selectedListId: string; onSelectList: (id: string) => void }) {
  return <label className="grid gap-1 text-xs font-semibold text-zinc-600">Salvar em lista<select value={selectedListId} onChange={(event) => onSelectList(event.target.value)} className="h-9 min-w-[180px] rounded-lg border border-[var(--share-line)] bg-white px-2 text-xs"><option value="">Selecione</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select></label>;
}

function huntingOwnerLabel(ownerName: string) {
  const first = ownerName.trim().split(/\s+/)[0] || "Equipe";
  return first.toLocaleLowerCase("pt-BR") === "gil" ? "Pesquisa da Gil" : `Pesquisa de ${first}`;
}

function leadOwnerLabel(ownerName: string) {
  const first = ownerName.trim().split(/\s+/)[0] || "Equipe";
  return first.toLocaleLowerCase("pt-BR") === "gil" ? "Lead da Gil" : `Lead de ${first}`;
}

function mergeResults(current: DecisionMakerResult, incoming: DecisionMakerResult): DecisionMakerResult {
  const companies = dedupeCompanies([...current.companies, ...incoming.companies]);
  const people = dedupePeople([...current.people, ...incoming.people]).sort((a, b) => b.fitScore - a.fitScore || a.name.localeCompare(b.name, "pt-BR"));
  const added = incoming.mode === "companies" ? companies.length - current.companies.length : people.length - current.people.length;
  return {
    ...incoming,
    queryId: current.queryId,
    generatedAt: incoming.generatedAt,
    fromCache: false,
    companies,
    people,
    warnings: [...new Set([...current.warnings, ...incoming.warnings, `${Math.max(0, added)} resultado(s) inédito(s) adicionado(s) nesta rodada.`])],
    sources: [...current.sources, ...incoming.sources].filter((source, index, list) => list.findIndex((item) => item.title === source.title) === index),
  };
}

function dedupePeople(people: HuntingPerson[]) {
  const seen = new Set<string>();
  return people.filter((person) => {
    const key = (person.linkedinUrl || person.id || `${person.name}|${person.company}|${person.title}`).trim().replace(/\/$/, "").toLocaleLowerCase("pt-BR");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeCompanies(companies: HuntingCompany[]) {
  const seen = new Set<string>();
  return companies.filter((company) => {
    const key = (company.linkedinUrl || company.domain || company.id || company.name).trim().replace(/\/$/, "").toLocaleLowerCase("pt-BR");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function CompanyTable({
  companies,
  selected,
  setSelected,
  onContinue,
  onSearchCompany,
  isSearching,
  selectedListId,
  lists,
  onSelectList,
  onSaveLead,
}: {
  companies: HuntingCompany[];
  selected: string[];
  setSelected: (ids: string[]) => void;
  onContinue: () => void;
  onSearchCompany: (company: HuntingCompany) => void;
  isSearching: boolean;
  selectedListId: string;
  lists: WorkspaceList[];
  onSelectList: (id: string) => void;
  onSaveLead: (leadId?: string) => void;
}) {
  return <div className="mt-4">
    <div className="mb-3 flex justify-end"><LeadListSelector lists={lists} selectedListId={selectedListId} onSelectList={onSelectList} /></div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1040px] text-left text-sm">
        <thead className="text-xs uppercase text-[var(--share-green-800)]">
          <tr><th className="border-b p-3">Conta</th><th className="border-b p-3">Setor</th><th className="border-b p-3">Localização</th><th className="border-b p-3">Fit</th><th className="border-b p-3">Fonte</th><th className="border-b p-3">Workspace</th><th className="border-b p-3">Ação</th></tr>
        </thead>
        <tbody>{companies.map((company) => <tr key={company.id} className="border-b border-[var(--share-line)]">
          <td className="p-3"><label className="flex items-start gap-3"><input type="checkbox" checked={selected.includes(company.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, company.id] : selected.filter((id) => id !== company.id))} className="mt-1" /><span><strong>{company.name}</strong>{company.domain ? <span className="block text-xs text-zinc-500">{company.domain}</span> : null}</span></label></td>
          <td className="p-3">{company.industry || "Não informado"}</td>
          <td className="p-3">{company.location || "Não informada"}</td>
          <td className="p-3 font-semibold">{company.fit}</td>
          <td className="p-3">{company.linkedinUrl ? <a href={company.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--share-green-800)]">LinkedIn <ExternalLink className="h-3.5 w-3.5" /></a> : company.source}</td>
          <td className="p-3">{company.firstSeenByName ? <span className="rounded-full bg-[#eef6e8] px-2 py-1 text-[10px] font-bold uppercase text-[#52712b]">{leadOwnerLabel(company.firstSeenByName)}</span> : <span className="text-xs text-zinc-400">Novo lead</span>}</td>
          <td className="p-3"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => onSearchCompany(company)} disabled={!company.linkedinUrl || isSearching} className="whitespace-nowrap rounded-md bg-[var(--share-green-950)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{company.linkedinUrl ? "Buscar decisores" : "Sem LinkedIn"}</button><button type="button" onClick={() => onSaveLead(company.workspaceLeadId)} disabled={!company.workspaceLeadId || !selectedListId} className="inline-flex items-center gap-1 rounded-md border border-[var(--share-line)] px-3 py-2 text-xs font-semibold text-[var(--share-green-800)] disabled:opacity-40"><BookmarkPlus className="h-3.5 w-3.5" /> Lista</button></div></td>
        </tr>)}</tbody>
      </table>
    </div>
    <button type="button" onClick={onContinue} disabled={!selected.length || isSearching} className="mt-4 rounded-md border border-[var(--share-green-800)] px-4 py-2 text-sm font-semibold text-[var(--share-green-900)] disabled:opacity-50">Buscar decisores nas contas selecionadas</button>
  </div>;
}

function PeopleTable({ people, selectedListId, lists, onSelectList, onSaveLead }: { people: HuntingPerson[]; selectedListId: string; lists: WorkspaceList[]; onSelectList: (id: string) => void; onSaveLead: (leadId?: string) => void }) {
  return <div className="mt-4">
    <div className="mb-3 flex justify-end"><LeadListSelector lists={lists} selectedListId={selectedListId} onSelectList={onSelectList} /></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-left text-sm"><thead className="text-xs uppercase text-[var(--share-green-800)]"><tr><th className="border-b p-3">Pessoa</th><th className="border-b p-3">Cargo</th><th className="border-b p-3">Empresa</th><th className="border-b p-3">Fit</th><th className="border-b p-3">Workspace</th><th className="border-b p-3">Próxima ação</th></tr></thead><tbody>{people.map((person) => <tr key={person.id} className="border-b border-[var(--share-line)]"><td className="p-3"><a href={person.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[var(--share-green-950)] hover:underline">{person.name}<ExternalLink className="h-3.5 w-3.5" /></a><span className="mt-1 block text-xs text-zinc-500">{person.location || "Localização não informada"}</span></td><td className="p-3">{person.title}</td><td className="p-3">{person.company}</td><td className="p-3"><strong>{person.fitScore}%</strong><span className="ml-2 text-xs text-zinc-500">{person.fit}</span></td><td className="p-3"><div className="flex flex-col items-start gap-2">{person.firstSeenByName ? <span className="rounded-full bg-[#eef6e8] px-2 py-1 text-[10px] font-bold uppercase text-[#52712b]">{leadOwnerLabel(person.firstSeenByName)}</span> : <span className="text-xs text-zinc-400">Novo lead</span>}<button type="button" onClick={() => onSaveLead(person.workspaceLeadId)} disabled={!person.workspaceLeadId || !selectedListId} className="inline-flex items-center gap-1 rounded-md border border-[var(--share-line)] px-2 py-1 text-[10px] font-semibold text-[var(--share-green-800)] disabled:opacity-40"><BookmarkPlus className="h-3 w-3" /> Salvar na lista</button></div></td><td className="p-3 text-zinc-600">{person.nextBestAction}</td></tr>)}</tbody></table></div>
  </div>;
}

function Empty({ mode }: { mode: SearchMode }) {
  return <div className="flex min-h-[320px] items-center justify-center text-center"><div><p className="text-lg font-semibold text-[var(--share-green-950)]">{mode === "companies" ? "Defina o mercado e encontre contas" : "Informe as empresas e cargos-alvo"}</p><p className="mt-2 max-w-lg text-sm leading-6 text-zinc-500">A Share AI preserva evidências e nunca cria uma pessoa só para preencher o resultado.</p></div></div>;
}

function Mode({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Building2; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${active ? "bg-[var(--share-green-950)] text-white" : "text-zinc-600"}`}><Icon className="h-4 w-4" />{label}</button>;
}

function Field({ label, value, setValue }: { label: string; value: string; setValue: (value: string) => void }) {
  return <label className="grid gap-1 text-xs font-semibold text-zinc-600">{label}<input value={value} onChange={(event) => setValue(event.target.value)} className="h-10 rounded-md border border-[var(--share-line)] px-3 text-sm font-normal" /></label>;
}

function Area({ label, value, setValue, placeholder = "" }: { label: string; value: string; setValue: (value: string) => void; placeholder?: string }) {
  return <label className="grid gap-1 text-xs font-semibold text-zinc-600">{label}<textarea value={value} onChange={(event) => setValue(event.target.value)} rows={3} placeholder={placeholder} className="rounded-md border border-[var(--share-line)] p-3 text-sm font-normal" /></label>;
}

function NumberField({ label, value, setValue }: { label: string; value: number; setValue: (value: number) => void }) {
  return <label className="grid gap-1 text-xs font-semibold text-zinc-600">{label}<input type="number" min="5" max="50" value={value} onChange={(event) => setValue(Number(event.target.value))} className="h-10 rounded-md border border-[var(--share-line)] px-3 text-sm font-normal" /></label>;
}

function buildObjective(id: string) {
  const unit = getBusinessUnitDna(id);
  return `Encontrar contas e pessoas aderentes a ${unit.positioning.whatWeAre.toLocaleLowerCase("pt-BR")} e criar conversas comerciais baseadas em evidências.`;
}
