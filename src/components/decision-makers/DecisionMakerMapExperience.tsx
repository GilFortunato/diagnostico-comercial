"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  Filter,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { LoginButton } from "@/components/auth/LoginButton";
import { demoBusinessUnits } from "@/lib/tenancy/demo";
import { defaultBusinessUnitId, getBusinessUnitDna } from "@/lib/business-units/dna";
import { addRoleSelection, getSuggestedRoles, removeRoleSelection } from "@/lib/decision-makers/roleIntelligence";
import {
  decisionRoles,
  employeeRanges,
  revenueRanges,
  seniorityLevels,
  splitTerms,
  type DecisionMakerResult,
  type DecisionRole,
  type HuntingCompany,
  type HuntingPerson,
} from "@/lib/decision-makers/search";

type SearchMode = "companies" | "people";
type ConnectorStatus = {
  google: { connected: boolean; label: string };
  intelligence: { available: boolean; label: string };
  publicSources: { available: boolean; label: string };
};

const seniorityLabels: Record<(typeof seniorityLevels)[number], string> = {
  manager: "Gerência",
  director: "Diretoria / Head",
  vp: "Vice-presidência",
  c_level: "C-level",
  owner: "Sócio / Proprietário",
};

export function DecisionMakerMapExperience() {
  const [status, setStatus] = useState<ConnectorStatus | null>(null);
  const [mode, setMode] = useState<SearchMode>("people");
  const [businessUnitId, setBusinessUnitId] = useState(defaultBusinessUnitId);
  const [objective, setObjective] = useState(buildObjective(defaultBusinessUnitId));
  const [result, setResult] = useState<DecisionMakerResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [sortPeople, setSortPeople] = useState<"fit" | "name" | "company">("fit");

  const [industries, setIndustries] = useState("Educação corporativa, Recursos Humanos");
  const [country, setCountry] = useState("Brazil");
  const [states, setStates] = useState("");
  const [cityPostalCodes, setCityPostalCodes] = useState("");
  const [selectedEmployeeRanges, setSelectedEmployeeRanges] = useState<string[]>(["1000-4999", "5000-9999", "10000+"]);
  const [companyKeywords, setCompanyKeywords] = useState("inteligência artificial, transformação digital");
  const [technologies, setTechnologies] = useState("");
  const [selectedRevenueRanges, setSelectedRevenueRanges] = useState<string[]>([]);
  const [domains, setDomains] = useState("");
  const [companyQuantity, setCompanyQuantity] = useState(15);

  const [companyLinkedinUrls, setCompanyLinkedinUrls] = useState("");
  const [companyNames, setCompanyNames] = useState("");
  const [roles, setRoles] = useState(() => getSuggestedRoles(defaultBusinessUnitId).slice(0, 5));
  const [roleInput, setRoleInput] = useState("");
  const [departments, setDepartments] = useState("");
  const [selectedSeniorities, setSelectedSeniorities] = useState<string[]>(["manager", "director", "vp", "c_level"]);
  const [locations, setLocations] = useState("Brasil");
  const [profileKeywords, setProfileKeywords] = useState("");
  const [desiredDecisionRole, setDesiredDecisionRole] = useState<DecisionRole>("Decisor funcional");
  const [peopleQuantity, setPeopleQuantity] = useState(20);
  const [includeBroadDiscovery, setIncludeBroadDiscovery] = useState(false);

  useEffect(() => {
    fetch("/api/connectors/status")
      .then((response) => response.json())
      .then((data: ConnectorStatus) => setStatus(data))
      .catch(() => setStatus(null));
  }, []);

  const selectedBu = useMemo(() => demoBusinessUnits.find((unit) => unit.id === businessUnitId) ?? demoBusinessUnits[0], [businessUnitId]);
  const suggestedRoles = useMemo(() => getSuggestedRoles(businessUnitId), [businessUnitId]);
  const selectedCompanies = useMemo(() => result?.companies.filter((company) => selectedCompanyIds.includes(company.id)) ?? [], [result, selectedCompanyIds]);
  const readyCount = status ? [status.google.connected, status.intelligence.available, status.publicSources.available].filter(Boolean).length : 0;
  const sortedPeople = useMemo(() => sortPeopleList(result?.people ?? [], sortPeople), [result, sortPeople]);
  const canSearch = mode === "companies"
    ? splitTerms(industries).length > 0 || splitTerms(companyKeywords).length > 0 || splitTerms(domains).length > 0
    : splitTerms(companyLinkedinUrls).length > 0 && roles.length > 0;

  async function runSearch(forceRefresh = false) {
    if (!canSearch) {
      setError(mode === "companies"
        ? "Informe pelo menos um setor, palavra-chave ou domínio."
        : "Informe a URL corporativa do LinkedIn e ao menos um cargo.");
      return;
    }
    setIsSearching(true);
    setError(null);
    setSelectedCompanyIds([]);
    try {
      const payload = mode === "companies"
        ? {
            mode,
            businessUnitId,
            objective,
            forceRefresh,
            filters: {
              industries: splitTerms(industries),
              country,
              states: splitTerms(states),
              cityPostalCodes: splitTerms(cityPostalCodes),
              employeeRanges: selectedEmployeeRanges,
              keywords: splitTerms(companyKeywords),
              technologies: splitTerms(technologies),
              revenueRanges: selectedRevenueRanges,
              domains: splitTerms(domains),
              quantity: companyQuantity,
            },
          }
        : {
            mode,
            businessUnitId,
            objective,
            forceRefresh,
            filters: {
              companyLinkedinUrls: splitTerms(companyLinkedinUrls),
              companyNames: splitTerms(companyNames),
              roles,
              departments: splitTerms(departments),
              seniority: selectedSeniorities,
              locations: splitTerms(locations),
              profileKeywords: splitTerms(profileKeywords),
              desiredDecisionRole,
              quantity: peopleQuantity,
              includeBroadDiscovery,
            },
          };
      const response = await fetch("/api/decision-makers/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as DecisionMakerResult | { error?: string };
      if (!response.ok) throw new Error("error" in data && data.error ? data.error : "Não foi possível concluir a busca.");
      setResult(data as DecisionMakerResult);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Não foi possível concluir a busca.");
    } finally {
      setIsSearching(false);
    }
  }

  function continueWithSelectedCompanies() {
    const usable = selectedCompanies.filter((company) => company.linkedinUrl);
    if (usable.length === 0) {
      setError("Selecione ao menos uma empresa com página corporativa do LinkedIn identificada.");
      return;
    }
    setCompanyLinkedinUrls(usable.map((company) => company.linkedinUrl).filter(Boolean).join("\n"));
    setCompanyNames(usable.map((company) => company.name).join(", "));
    setMode("people");
    setResult(null);
    setError(null);
    window.scrollTo({ top: 420, behavior: "smooth" });
  }

  async function exportSnapshot() {
    if (!result) return;
    setIsExporting(true);
    setError(null);
    try {
      const response = await fetch("/api/decision-makers/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      if (!response.ok) throw new Error("Não foi possível gerar a planilha.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `share-ai-mapa-decisores-${result.generatedAt.slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Não foi possível gerar a planilha.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <main className="share-shell min-h-screen text-[var(--share-ink)]">
      <header className="border-b border-white/15 bg-[var(--share-green-950)] text-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-5 py-3">
          <Link href="/" className="inline-flex items-center gap-3 text-white">
            <ArrowLeft className="h-4 w-4 text-[var(--share-lime)]" />
            <span className="share-wordmark text-4xl">share</span>
            <span className="pb-1 text-xs font-semibold uppercase text-[var(--share-lime)]">AI</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-white/70 md:inline">Hunting Intelligence</span>
            <LoginButton />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-5 px-4 py-6 md:px-6">
        <section className="border-l-4 border-[var(--share-lime)] bg-[var(--share-green-950)] px-5 py-5 text-white md:px-7">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--share-lime)]">Mapa de decisores</p>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Encontre contas e pessoas com evidências públicas.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/72">Pesquise, selecione e aprofunde somente os perfis mais relevantes. A plataforma não cria pessoas ausentes nem presume contatos.</p>
            </div>
            <div className="flex items-center gap-3 border border-white/15 bg-white/8 px-4 py-3">
              <ShieldCheck className="h-5 w-5 text-[var(--share-lime)]" />
              <div>
                <p className="text-xs text-white/60">Recursos disponíveis</p>
                <p className="text-sm font-semibold">{readyCount}/3 conectados</p>
              </div>
              <Link href="/conectores" className="ml-2 text-xs font-semibold text-[var(--share-lime)] hover:underline">Ver status</Link>
            </div>
          </div>
        </section>

        <section className="share-card rounded-lg">
          <div className="flex flex-col border-b border-[var(--share-line)] lg:flex-row lg:items-center lg:justify-between">
            <div className="flex p-2" role="tablist" aria-label="Modalidade de busca">
              <ModeButton active={mode === "companies"} icon={<Building2 className="h-4 w-4" />} onClick={() => { setMode("companies"); setResult(null); }} label="Encontrar empresas" />
              <ModeButton active={mode === "people"} icon={<Users className="h-4 w-4" />} onClick={() => { setMode("people"); setResult(null); }} label="Encontrar pessoas" />
            </div>
            <div className="grid gap-2 border-t border-[var(--share-line)] p-3 sm:grid-cols-[220px_minmax(320px,1fr)] lg:w-[650px] lg:border-l lg:border-t-0">
              <label className="grid gap-1 text-xs font-semibold text-zinc-600">
                Business Unit
                <select value={businessUnitId} onChange={(event) => changeBusinessUnit(event.target.value)} className="h-10 border border-[var(--share-line)] bg-white px-3 text-sm outline-none focus:border-[var(--share-green-800)]">
                  {demoBusinessUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-zinc-600">
                Objetivo comercial
                <input value={objective} onChange={(event) => setObjective(event.target.value)} className="h-10 border border-[var(--share-line)] bg-white px-3 text-sm font-normal outline-none focus:border-[var(--share-green-800)]" />
              </label>
            </div>
          </div>

          <div className="grid lg:grid-cols-[360px_1fr]">
            <aside className="border-b border-[var(--share-line)] p-5 lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-2 text-[var(--share-green-900)]">
                <Filter className="h-4 w-4" />
                <h2 className="text-sm font-semibold">{mode === "companies" ? "Filtros de mercado" : "Filtros de pessoas"}</h2>
              </div>
              {mode === "companies" ? (
                <CompanyFilters
                  industries={industries} setIndustries={setIndustries} country={country} setCountry={setCountry} states={states} setStates={setStates} cityPostalCodes={cityPostalCodes} setCityPostalCodes={setCityPostalCodes}
                  employeeRanges={selectedEmployeeRanges} setEmployeeRanges={setSelectedEmployeeRanges}
                  keywords={companyKeywords} setKeywords={setCompanyKeywords} technologies={technologies} setTechnologies={setTechnologies}
                  revenues={selectedRevenueRanges} setRevenues={setSelectedRevenueRanges} domains={domains} setDomains={setDomains}
                  quantity={companyQuantity} setQuantity={setCompanyQuantity}
                />
              ) : (
                <PeopleFilters
                  companyUrls={companyLinkedinUrls} setCompanyUrls={setCompanyLinkedinUrls} companyNames={companyNames} setCompanyNames={setCompanyNames}
                  roles={roles} setRoles={setRoles} roleInput={roleInput} setRoleInput={setRoleInput} suggestions={suggestedRoles}
                  departments={departments} setDepartments={setDepartments} seniorities={selectedSeniorities} setSeniorities={setSelectedSeniorities}
                  locations={locations} setLocations={setLocations} profileKeywords={profileKeywords} setProfileKeywords={setProfileKeywords}
                  desiredRole={desiredDecisionRole} setDesiredRole={setDesiredDecisionRole} quantity={peopleQuantity} setQuantity={setPeopleQuantity}
                  broad={includeBroadDiscovery} setBroad={setIncludeBroadDiscovery}
                />
              )}
              <button type="button" onClick={() => runSearch(false)} disabled={isSearching || !canSearch} className="share-button-primary mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">
                {isSearching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {isSearching ? "Pesquisando fontes" : mode === "companies" ? "Buscar empresas" : "Buscar pessoas"}
              </button>
              <p className="mt-3 text-xs leading-5 text-zinc-500">{mode === "companies" ? "A descoberta ampla possui custo mínimo por execução. Refine os filtros antes de buscar." : "Primeiro buscamos até 25 candidatos básicos. Somente os melhores perfis recebem enriquecimento adicional."}</p>
              {error ? <p className="mt-3 border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{error}</p> : null}
            </aside>

            <div className="min-w-0 p-5">
              {result ? (
                <>
                  <ResultToolbar result={result} selectedCount={selectedCompanies.length} sortPeople={sortPeople} setSortPeople={setSortPeople} onRefresh={() => runSearch(true)} onExport={exportSnapshot} isExporting={isExporting} />
                  {result.mode === "companies" ? (
                    <CompanyResults companies={result.companies} selectedIds={selectedCompanyIds} setSelectedIds={setSelectedCompanyIds} onContinue={continueWithSelectedCompanies} />
                  ) : (
                    <PeopleResults people={sortedPeople} missingRoles={result.targetRolesNotFound} />
                  )}
                  <IntelligenceSummary result={result} />
                </>
              ) : (
                <EmptyWorkspace mode={mode} buName={selectedBu.name} />
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );

  function changeBusinessUnit(id: string) {
    setBusinessUnitId(id);
    setObjective(buildObjective(id));
    setRoles(getSuggestedRoles(id).slice(0, 5));
    setResult(null);
  }
}

function CompanyFilters(props: {
  industries: string; setIndustries: (value: string) => void; country: string; setCountry: (value: string) => void;
  states: string; setStates: (value: string) => void; cityPostalCodes: string; setCityPostalCodes: (value: string) => void;
  employeeRanges: string[]; setEmployeeRanges: (value: string[]) => void; keywords: string; setKeywords: (value: string) => void;
  technologies: string; setTechnologies: (value: string) => void; revenues: string[]; setRevenues: (value: string[]) => void;
  domains: string; setDomains: (value: string) => void; quantity: number; setQuantity: (value: number) => void;
}) {
  return <div className="mt-4 grid gap-4">
    <TextAreaField label="Setores" value={props.industries} onChange={props.setIndustries} placeholder="Um ou mais setores, separados por vírgula" />
    <TextField label="País da empresa" value={props.country} onChange={props.setCountry} placeholder="Brazil" />
    <div className="grid gap-3 sm:grid-cols-2"><TextField label="Estados / regiões" value={props.states} onChange={props.setStates} placeholder="SP, RJ" /><TextField label="Cidade ou CEP" value={props.cityPostalCodes} onChange={props.setCityPostalCodes} placeholder="São Paulo" /></div>
    <CheckboxGroup label="Faixa de funcionários" options={employeeRanges.map((value) => ({ value, label: value }))} selected={props.employeeRanges} onChange={props.setEmployeeRanges} />
    <TextAreaField label="Palavras-chave da empresa" value={props.keywords} onChange={props.setKeywords} placeholder="IA, upskilling, transformação" />
    <details className="border-t border-[var(--share-line)] pt-3">
      <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-[var(--share-green-900)]">Filtros avançados <ChevronDown className="h-4 w-4" /></summary>
      <div className="mt-4 grid gap-4">
        <TextAreaField label="Tecnologias usadas" value={props.technologies} onChange={props.setTechnologies} placeholder="Salesforce, SAP" />
        <CheckboxGroup label="Faixa de receita" options={revenueRanges.map((value) => ({ value, label: value }))} selected={props.revenues} onChange={props.setRevenues} />
        <TextAreaField label="Domínios específicos" value={props.domains} onChange={props.setDomains} placeholder="empresa.com.br" />
      </div>
    </details>
    <QuantityField label="Quantidade exibida" value={props.quantity} onChange={props.setQuantity} max={25} />
  </div>;
}

function PeopleFilters(props: {
  companyUrls: string; setCompanyUrls: (value: string) => void; companyNames: string; setCompanyNames: (value: string) => void;
  roles: string[]; setRoles: (value: string[]) => void; roleInput: string; setRoleInput: (value: string) => void; suggestions: string[];
  departments: string; setDepartments: (value: string) => void; seniorities: string[]; setSeniorities: (value: string[]) => void;
  locations: string; setLocations: (value: string) => void; profileKeywords: string; setProfileKeywords: (value: string) => void;
  desiredRole: DecisionRole; setDesiredRole: (value: DecisionRole) => void; quantity: number; setQuantity: (value: number) => void;
  broad: boolean; setBroad: (value: boolean) => void;
}) {
  function addRole(value: string) {
    const role = value.trim();
    if (role) props.setRoles(addRoleSelection(props.roles, role));
    props.setRoleInput("");
  }
  return <div className="mt-4 grid gap-4">
    <TextAreaField label="Páginas corporativas do LinkedIn" value={props.companyUrls} onChange={props.setCompanyUrls} placeholder="https://www.linkedin.com/company/empresa" />
    <TextField label="Nomes das empresas" value={props.companyNames} onChange={props.setCompanyNames} placeholder="Usado para validar resultados complementares" />
    <div>
      <span className="text-sm font-medium text-zinc-700">Cargos e famílias de papel</span>
      <div className="mt-2 flex gap-2">
        <input value={props.roleInput} onChange={(event) => props.setRoleInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addRole(props.roleInput); } }} placeholder="Adicionar cargo" className="h-10 min-w-0 flex-1 border border-[var(--share-line)] px-3 text-sm outline-none focus:border-[var(--share-green-800)]" />
        <button type="button" onClick={() => addRole(props.roleInput)} aria-label="Adicionar cargo" title="Adicionar cargo" className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--share-green-950)] text-white"><Plus className="h-4 w-4" /></button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">{props.roles.map((role) => <button type="button" key={role} onClick={() => props.setRoles(removeRoleSelection(props.roles, role))} className="inline-flex items-center gap-1 rounded-md bg-[#edf7eb] px-2 py-1 text-xs font-semibold text-[var(--share-green-900)]" title="Remover cargo">{role}<X className="h-3 w-3" /></button>)}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">{props.suggestions.filter((role) => !props.roles.includes(role)).slice(0, 6).map((role) => <button type="button" key={role} onClick={() => addRole(role)} className="rounded-md border border-[var(--share-line)] bg-white px-2 py-1 text-xs text-zinc-600 hover:border-[var(--share-green-800)]">+ {role}</button>)}</div>
    </div>
    <CheckboxGroup label="Senioridade" options={seniorityLevels.map((value) => ({ value, label: seniorityLabels[value] }))} selected={props.seniorities} onChange={props.setSeniorities} />
    <TextAreaField label="Localizações" value={props.locations} onChange={props.setLocations} placeholder="Brasil, São Paulo" />
    <details className="border-t border-[var(--share-line)] pt-3">
      <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-[var(--share-green-900)]">Filtros avançados <ChevronDown className="h-4 w-4" /></summary>
      <div className="mt-4 grid gap-4">
        <TextAreaField label="Áreas ou departamentos" value={props.departments} onChange={props.setDepartments} placeholder="RH, Learning, Inovação" />
        <TextAreaField label="Palavras no perfil" value={props.profileKeywords} onChange={props.setProfileKeywords} placeholder="upskilling, inteligência artificial" />
        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">Papel decisor desejado<select value={props.desiredRole} onChange={(event) => props.setDesiredRole(event.target.value as DecisionRole)} className="h-10 border border-[var(--share-line)] bg-white px-3 text-sm outline-none">{decisionRoles.map((role) => <option key={role}>{role}</option>)}</select></label>
      </div>
    </details>
    <QuantityField label="Candidatos básicos" value={props.quantity} onChange={props.setQuantity} max={25} />
    <label className="flex items-start gap-3 border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
      <input type="checkbox" checked={props.broad} onChange={(event) => props.setBroad(event.target.checked)} className="mt-1 accent-[var(--share-green-900)]" />
      <span><strong>Complementar com descoberta ampla</strong><br />Executa no mínimo 100 resultados e pode elevar o custo. Use quando a busca na conta conhecida não for suficiente.</span>
    </label>
  </div>;
}

function ResultToolbar({ result, selectedCount, sortPeople, setSortPeople, onRefresh, onExport, isExporting }: {
  result: DecisionMakerResult; selectedCount: number; sortPeople: "fit" | "name" | "company"; setSortPeople: (value: "fit" | "name" | "company") => void;
  onRefresh: () => void; onExport: () => void; isExporting: boolean;
}) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--share-line)] pb-4">
    <div><p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Resultados da pesquisa</p><p className="mt-1 text-sm text-zinc-600">{result.mode === "companies" ? `${result.companies.length} empresas encontradas · ${selectedCount} selecionadas` : `${result.people.length} pessoas reais · ${result.targetRolesNotFound.length} papéis sem correspondência`}{result.fromCache ? " · resultado reutilizado" : ""}</p></div>
    <div className="flex flex-wrap items-center gap-2">
      {result.mode === "people" ? <select value={sortPeople} onChange={(event) => setSortPeople(event.target.value as "fit" | "name" | "company")} className="h-9 border border-[var(--share-line)] bg-white px-2 text-xs"><option value="fit">Maior aderência</option><option value="name">Nome</option><option value="company">Empresa</option></select> : null}
      <button type="button" onClick={onRefresh} title="Atualizar fontes" className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--share-line)] bg-white px-3 text-xs font-semibold text-[var(--share-green-900)]"><RefreshCw className="h-3.5 w-3.5" />Atualizar</button>
      <button type="button" onClick={onExport} disabled={isExporting} className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--share-green-950)] px-3 text-xs font-semibold text-white disabled:opacity-60">{isExporting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}Exportar XLSX</button>
    </div>
  </div>;
}

function CompanyResults({ companies, selectedIds, setSelectedIds, onContinue }: { companies: HuntingCompany[]; selectedIds: string[]; setSelectedIds: (ids: string[]) => void; onContinue: () => void }) {
  if (companies.length === 0) return <NoResults text="Nenhuma empresa real foi confirmada com esses filtros. Ajuste setor, país ou palavras-chave." />;
  return <div className="mt-4">
    <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-[#f4f8f2] text-xs uppercase text-zinc-500"><tr><th className="w-10 px-3 py-3"><input type="checkbox" aria-label="Selecionar todas" checked={selectedIds.length === companies.length} onChange={(event) => setSelectedIds(event.target.checked ? companies.map((company) => company.id) : [])} /></th><th className="px-3 py-3">Empresa</th><th className="px-3 py-3">Aderência</th><th className="px-3 py-3">Setor e porte</th><th className="px-3 py-3">Por que entrou</th><th className="px-3 py-3">Fonte</th></tr></thead><tbody>{companies.map((company) => <tr key={company.id} className="border-b border-[var(--share-line)] align-top"><td className="px-3 py-4"><input type="checkbox" aria-label={`Selecionar ${company.name}`} checked={selectedIds.includes(company.id)} onChange={() => setSelectedIds(selectedIds.includes(company.id) ? selectedIds.filter((id) => id !== company.id) : [...selectedIds, company.id])} /></td><td className="px-3 py-4"><p className="font-semibold text-zinc-950">{company.name}</p><p className="mt-1 text-xs text-zinc-500">{company.domain ?? company.location ?? "Localização não informada"}</p>{company.linkedinUrl ? <a href={company.linkedinUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--share-green-800)]">LinkedIn <ExternalLink className="h-3 w-3" /></a> : <p className="mt-2 text-xs text-amber-700">Página corporativa não identificada</p>}</td><td className="px-3 py-4"><FitBadge value={company.fit} /></td><td className="px-3 py-4 text-zinc-600"><p>{company.industry ?? "Setor não informado"}</p><p className="mt-1 text-xs">{company.employeeRange ?? "Porte não informado"}</p></td><td className="max-w-md px-3 py-4 text-xs leading-5 text-zinc-600">{company.fitReasons.join(" ")}</td><td className="px-3 py-4 text-xs text-zinc-500">{company.confidence}</td></tr>)}</tbody></table></div>
    <div className="mt-4 flex justify-end"><button type="button" onClick={onContinue} disabled={selectedIds.length === 0} className="share-button-primary inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Buscar pessoas nas selecionadas <ArrowRight className="h-4 w-4" /></button></div>
  </div>;
}

function PeopleResults({ people, missingRoles }: { people: HuntingPerson[]; missingRoles: string[] }) {
  return <div className="mt-4 grid gap-5">
    {people.length === 0 ? <NoResults text="Nenhuma pessoa real foi confirmada. Revise a página corporativa, amplie cargos ou reduza os filtros." /> : <div className="divide-y divide-[var(--share-line)] border-y border-[var(--share-line)]">{people.map((person) => <PersonRow key={person.id} person={person} />)}</div>}
    {missingRoles.length ? <section className="border-l-4 border-amber-400 bg-amber-50 px-4 py-3"><h3 className="text-sm font-semibold text-amber-950">Papéis-alvo ainda não encontrados</h3><p className="mt-1 text-xs leading-5 text-amber-900">{missingRoles.join(", ")}. Eles permanecem como alvos de pesquisa, não como pessoas encontradas.</p></section> : null}
  </div>;
}

function PersonRow({ person }: { person: HuntingPerson }) {
  return <article className="grid gap-4 py-5 xl:grid-cols-[minmax(220px,0.85fr)_minmax(280px,1.2fr)_minmax(250px,1fr)]">
    <div><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--share-green-950)] text-sm font-semibold text-[var(--share-lime)]">{person.name.split(/\s+/).slice(0, 2).map((name) => name[0]).join("")}</div><div><h3 className="font-semibold text-zinc-950">{person.name}</h3><p className="mt-1 text-sm text-zinc-600">{person.title}</p><p className="mt-1 text-xs text-zinc-500">{person.company}{person.location ? ` · ${person.location}` : ""}</p></div></div><div className="mt-3 flex flex-wrap gap-2"><FitBadge value={person.fit} /><span className="rounded-md bg-[#edf7eb] px-2 py-1 text-xs font-semibold text-[var(--share-green-900)]">{person.probableDecisionRole}</span><span className="rounded-md border border-[var(--share-line)] px-2 py-1 text-xs text-zinc-600">Confiança {person.confidence}</span></div><a href={person.linkedinUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--share-green-800)]">Abrir perfil público <ExternalLink className="h-3 w-3" /></a></div>
    <div><p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Por que está no mapa</p><ul className="mt-2 grid gap-1 text-xs leading-5 text-zinc-600">{person.fitReasons.slice(0, 4).map((reason) => <li key={reason} className="flex gap-2"><Check className="mt-1 h-3 w-3 shrink-0 text-[var(--share-green-700)]" />{reason}</li>)}</ul>{person.recentSignals.length ? <details className="mt-3"><summary className="cursor-pointer text-xs font-semibold text-[var(--share-green-800)]">Sinais profissionais recentes</summary><div className="mt-2 grid gap-2 text-xs leading-5 text-zinc-600">{person.recentSignals.map((signal) => <p key={signal}>{signal}</p>)}</div></details> : null}</div>
    <div><p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Rapport e contato</p><p className="mt-2 text-xs leading-5 text-zinc-600">{person.rapport.context}</p><p className="mt-2 text-xs font-medium leading-5 text-[var(--share-green-950)]">{person.rapport.safeOpening}</p><p className="mt-2 border-l-2 border-[var(--share-lime)] pl-2 text-xs font-semibold leading-5 text-[var(--share-green-950)]">Próxima ação: {person.nextBestAction}</p><div className="mt-3 border-t border-[var(--share-line)] pt-3 text-xs text-zinc-600">{person.professionalEmail ? <p>E-mail profissional: <strong>{person.professionalEmail}</strong> · {person.emailStatus}</p> : <p>E-mail profissional: não encontrado.</p>}{person.professionalPhone ? <p className="mt-1">Telefone profissional: <strong>{person.professionalPhone}</strong> · {person.phoneStatus}</p> : <p className="mt-1">Telefone profissional: não encontrado.</p>}{person.contactSource ? <p className="mt-1 text-zinc-500">Fonte: {person.contactSource} · Confiança {person.contactConfidence}</p> : null}</div></div>
  </article>;
}

function IntelligenceSummary({ result }: { result: DecisionMakerResult }) {
  return <section className="mt-5 grid gap-4 border-t border-[var(--share-line)] pt-5 md:grid-cols-[1.2fr_1fr]">
    <div className="bg-[var(--share-green-950)] p-4 text-white"><p className="text-xs font-semibold uppercase text-[var(--share-lime)]">Próxima melhor ação</p><h3 className="mt-2 text-lg font-semibold">{result.nextBestAction.title}</h3><p className="mt-2 text-sm leading-6 text-white/72">{result.nextBestAction.reason}</p></div>
    <div className="border border-[var(--share-line)] p-4"><p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Controle de custo</p><p className="mt-2 text-sm font-semibold text-zinc-950">{result.cost.strategy}</p><p className="mt-2 text-xs leading-5 text-zinc-600">{result.cost.basicCandidates} candidatos básicos · {result.cost.profileEnrichments} perfis enriquecidos · {result.cost.postEnrichments} leituras de publicações</p>{result.warnings.length ? <details className="mt-3"><summary className="cursor-pointer text-xs font-semibold text-amber-800">{result.warnings.length} alertas da pesquisa</summary><div className="mt-2 grid gap-1 text-xs leading-5 text-zinc-600">{result.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div></details> : null}</div>
  </section>;
}

function EmptyWorkspace({ mode, buName }: { mode: SearchMode; buName: string }) {
  return <div className="flex min-h-[520px] items-center justify-center border border-dashed border-[var(--share-line)] bg-[#fbfdf8] p-8 text-center"><div className="max-w-lg">{mode === "companies" ? <Building2 className="mx-auto h-9 w-9 text-[var(--share-green-700)]" /> : <BriefcaseBusiness className="mx-auto h-9 w-9 text-[var(--share-green-700)]" />}<h2 className="mt-4 text-2xl font-semibold text-[var(--share-green-950)]">{mode === "companies" ? "Descubra contas antes de aprofundar" : "Comece por uma conta conhecida"}</h2><p className="mt-3 text-sm leading-6 text-zinc-600">{mode === "companies" ? `Use sinais de mercado compatíveis com ${buName}, selecione as empresas e avance para as pessoas.` : "Informe a página corporativa do LinkedIn. A busca coleta candidatos básicos, ranqueia por evidência e enriquece apenas os melhores."}</p></div></div>;
}

function ModeButton({ active, icon, onClick, label }: { active: boolean; icon: React.ReactNode; onClick: () => void; label: string }) { return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`inline-flex h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold ${active ? "border-[var(--share-lime)] bg-[var(--share-green-950)] text-white" : "border-transparent text-zinc-600 hover:bg-[#f4f8f2]"}`}>{icon}{label}</button>; }
function FitBadge({ value }: { value: "Alta" | "Média" | "Baixa" }) { const style = value === "Alta" ? "bg-emerald-100 text-emerald-900" : value === "Média" ? "bg-amber-100 text-amber-900" : "bg-zinc-100 text-zinc-700"; return <span className={`rounded-md px-2 py-1 text-xs font-semibold ${style}`}>Aderência {value.toLocaleLowerCase("pt-BR")}</span>; }
function NoResults({ text }: { text: string }) { return <div className="border border-dashed border-[var(--share-line)] bg-[#fbfdf8] px-5 py-12 text-center text-sm text-zinc-600">{text}</div>; }
function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="grid gap-1.5 text-sm font-medium text-zinc-700">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-10 border border-[var(--share-line)] bg-white px-3 text-sm font-normal outline-none focus:border-[var(--share-green-800)]" /></label>; }
function TextAreaField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="grid gap-1.5 text-sm font-medium text-zinc-700">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={2} className="resize-y border border-[var(--share-line)] bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[var(--share-green-800)]" /></label>; }
function QuantityField({ label, value, onChange, max }: { label: string; value: number; onChange: (value: number) => void; max: number }) { return <label className="grid gap-1.5 text-sm font-medium text-zinc-700">{label}<span className="flex items-center gap-3"><input type="range" min={5} max={max} step={5} value={value} onChange={(event) => onChange(Number(event.target.value))} className="min-w-0 flex-1 accent-[var(--share-green-900)]" /><strong className="w-8 text-right text-sm text-[var(--share-green-950)]">{value}</strong></span></label>; }
function CheckboxGroup({ label, options, selected, onChange }: { label: string; options: Array<{ value: string; label: string }>; selected: string[]; onChange: (value: string[]) => void }) { return <fieldset><legend className="text-sm font-medium text-zinc-700">{label}</legend><div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">{options.map((option) => <label key={option.value} className="flex items-center gap-2 text-xs text-zinc-600"><input type="checkbox" checked={selected.includes(option.value)} onChange={() => onChange(selected.includes(option.value) ? selected.filter((item) => item !== option.value) : [...selected, option.value])} className="accent-[var(--share-green-900)]" />{option.label}</label>)}</div></fieldset>; }

function sortPeopleList(people: HuntingPerson[], sort: "fit" | "name" | "company") { const copy = [...people]; if (sort === "name") return copy.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")); if (sort === "company") return copy.sort((a, b) => a.company.localeCompare(b.company, "pt-BR") || b.fitScore - a.fitScore); return copy.sort((a, b) => b.fitScore - a.fitScore); }
function buildObjective(businessUnitId: string) { const unit = getBusinessUnitDna(businessUnitId); const product = unit.products[0]?.name ?? unit.name; const territory = unit.authorityTerritories[0]?.name ?? "prioridade comercial"; return `Encontrar contas e decisores para ${product}, com foco em ${territory}.`; }
