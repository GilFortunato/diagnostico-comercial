"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Building2, Download, ExternalLink, LoaderCircle, Plus, Search, Users } from "lucide-react";
import { LoginButton } from "@/components/auth/LoginButton";
import { demoBusinessUnits } from "@/lib/tenancy/demo";
import { defaultBusinessUnitId, getBusinessUnitDna } from "@/lib/business-units/dna";
import { getSuggestedRoles } from "@/lib/decision-makers/roleIntelligence";
import { splitTerms, type DecisionMakerResult, type HuntingCompany, type HuntingPerson } from "@/lib/decision-makers/search";

type SearchMode = "companies" | "people";

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

  const [industries, setIndustries] = useState("Recursos Humanos, Educação corporativa");
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
  const [peopleQuantity, setPeopleQuantity] = useState(20);
  const [includeBroadDiscovery, setIncludeBroadDiscovery] = useState(false);

  const selectedCompanies = useMemo(() => result?.companies.filter((company) => selectedCompanyIds.includes(company.id)) || [], [result, selectedCompanyIds]);
  const canSearch = mode === "companies"
    ? Boolean(splitTerms(industries).length || splitTerms(companyKeywords).length || splitTerms(domains).length)
    : Boolean(splitTerms(companyLinkedinUrls).length && splitTerms(rolesText).length);

  async function runSearch({ loadMore = false, forceRefresh = false }: { loadMore?: boolean; forceRefresh?: boolean } = {}) {
    if (!canSearch) {
      setError(mode === "companies" ? "Informe setor, palavra-chave ou domínio." : "Informe ao menos uma página corporativa do LinkedIn e um cargo.");
      return;
    }
    if (loadMore) setIsLoadingMore(true);
    else setIsSearching(true);
    setError(null);
    try {
      const currentCount = mode === "companies" ? result?.companies.length || 0 : result?.people.length || 0;
      const baseQuantity = mode === "companies" ? companyQuantity : peopleQuantity;
      const requestedQuantity = loadMore ? Math.min(50, Math.max(baseQuantity, currentCount + 20)) : baseQuantity;
      const payload = mode === "companies"
        ? {
            mode,
            businessUnitId,
            objective,
            forceRefresh: forceRefresh || loadMore,
            filters: {
              industries: splitTerms(industries), country, states: splitTerms(states), cityPostalCodes: [], employeeRanges: [],
              keywords: splitTerms(companyKeywords), technologies: [], revenueRanges: [], domains: splitTerms(domains), quantity: requestedQuantity,
            },
          }
        : {
            mode,
            businessUnitId,
            objective,
            forceRefresh: forceRefresh || loadMore,
            filters: {
              companyLinkedinUrls: splitTerms(companyLinkedinUrls), companyNames: splitTerms(companyNames), roles: splitTerms(rolesText), departments: [], seniority: ["manager", "director", "vp", "c_level"],
              locations: splitTerms(locations), profileKeywords: splitTerms(profileKeywords), desiredDecisionRole: "Decisor funcional", quantity: requestedQuantity, includeBroadDiscovery,
            },
          };
      const response = await fetch("/api/decision-makers/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as DecisionMakerResult | { error?: string };
      if (!response.ok) throw new Error("error" in data && data.error ? data.error : "Não foi possível concluir a busca.");
      const next = data as DecisionMakerResult;
      if (loadMore && result && result.mode === next.mode) {
        const merged = mergeResults(result, next);
        const before = currentCount;
        const after = mode === "companies" ? merged.companies.length : merged.people.length;
        setResult(merged);
        if (after === before) setError("A nova rodada não trouxe resultados inéditos. Amplie os critérios para aumentar a cobertura.");
      } else {
        setResult(next);
        setSelectedCompanyIds([]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir a busca.");
    } finally {
      setIsSearching(false); setIsLoadingMore(false);
    }
  }

  function continueWithSelectedCompanies() {
    const usable = selectedCompanies.filter((company) => company.linkedinUrl);
    if (!usable.length) return setError("Selecione ao menos uma empresa com página corporativa do LinkedIn identificada.");
    setCompanyLinkedinUrls(usable.map((company) => company.linkedinUrl).filter(Boolean).join("\n"));
    setCompanyNames(usable.map((company) => company.name).join(", "));
    setMode("people"); setResult(null); setError(null);
    window.scrollTo({ top: 320, behavior: "smooth" });
  }

  async function exportSnapshot() {
    if (!result) return;
    setIsExporting(true);
    try {
      const response = await fetch("/api/decision-makers/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(result) });
      if (!response.ok) throw new Error("Não foi possível gerar a planilha.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `share-ai-hunting-${result.generatedAt.slice(0, 10)}.xlsx`; anchor.click(); URL.revokeObjectURL(url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível exportar."); }
    finally { setIsExporting(false); }
  }

  function changeContext(id: string) {
    setBusinessUnitId(id); setObjective(buildObjective(id)); setRolesText(getSuggestedRoles(id).slice(0, 5).join(", ")); setResult(null); setSelectedCompanyIds([]);
  }

  return <main className="share-shell min-h-screen text-[var(--share-ink)]">
    <header className="border-b border-white/15 bg-[var(--share-green-950)] text-white"><div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-3"><Link href="/" className="inline-flex items-center gap-3"><ArrowLeft className="h-4 w-4 text-[var(--share-lime)]" /><span className="share-wordmark text-4xl">share</span><span className="text-xs font-semibold uppercase text-[var(--share-lime)]">AI</span></Link><LoginButton /></div></header>
    <div className="mx-auto grid max-w-[1440px] gap-5 px-5 py-7">
      <section className="rounded-lg bg-[var(--share-green-950)] p-6 text-white"><p className="text-xs font-semibold uppercase text-[var(--share-lime)]">B2B Hunting</p><h1 className="mt-2 text-3xl font-semibold">Encontre contas e decisores sem repetir resultados.</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">Cada nova rodada amplia a cobertura e deduplica por LinkedIn, domínio e identificadores confiáveis antes de exibir.</p></section>

      <section className="rounded-lg border border-[var(--share-line)] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--share-line)] p-3">
          <div className="flex gap-2"><Mode active={mode === "companies"} icon={Building2} label="Encontrar empresas" onClick={() => { setMode("companies"); setResult(null); }} /><Mode active={mode === "people"} icon={Users} label="Encontrar pessoas" onClick={() => { setMode("people"); setResult(null); }} /></div>
          <div className="grid min-w-[520px] gap-2 sm:grid-cols-[200px_1fr]"><label className="grid gap-1 text-xs font-semibold text-zinc-600">Contexto de negócio<select value={businessUnitId} onChange={(event) => changeContext(event.target.value)} className="h-10 border border-[var(--share-line)] bg-white px-3 text-sm">{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><Field label="Objetivo comercial" value={objective} setValue={setObjective} /></div>
        </div>
        <div className="grid lg:grid-cols-[340px_1fr]">
          <aside className="border-r border-[var(--share-line)] p-5">
            {mode === "companies" ? <div className="grid gap-4"><Area label="Setores" value={industries} setValue={setIndustries} /><Field label="País" value={country} setValue={setCountry} /><Field label="Estados / regiões" value={states} setValue={setStates} /><Area label="Palavras-chave" value={companyKeywords} setValue={setCompanyKeywords} /><Area label="Domínios" value={domains} setValue={setDomains} /><NumberField label="Resultados iniciais" value={companyQuantity} setValue={setCompanyQuantity} /></div> : <div className="grid gap-4"><Area label="Páginas corporativas do LinkedIn" value={companyLinkedinUrls} setValue={setCompanyLinkedinUrls} placeholder="https://www.linkedin.com/company/empresa" /><Field label="Nomes das empresas" value={companyNames} setValue={setCompanyNames} /><Area label="Cargos e famílias" value={rolesText} setValue={setRolesText} /><Field label="Localizações" value={locations} setValue={setLocations} /><Area label="Palavras-chave profissionais" value={profileKeywords} setValue={setProfileKeywords} /><NumberField label="Resultados iniciais" value={peopleQuantity} setValue={setPeopleQuantity} /><label className="flex items-start gap-2 text-sm text-zinc-600"><input type="checkbox" checked={includeBroadDiscovery} onChange={(event) => setIncludeBroadDiscovery(event.target.checked)} className="mt-1" />Usar descoberta complementar quando necessário</label></div>}
            <button type="button" onClick={() => runSearch()} disabled={isSearching || !canSearch} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--share-green-950)] px-4 text-sm font-semibold text-white disabled:opacity-50">{isSearching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{isSearching ? "Pesquisando fontes" : mode === "companies" ? "Buscar empresas" : "Buscar pessoas"}</button>
            {error ? <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">{error}</p> : null}
          </aside>
          <div className="min-w-0 p-5">
            {!result ? <Empty mode={mode} /> : <>
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--share-line)] pb-4"><div><p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Resultados</p><h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">{result.mode === "companies" ? `${result.companies.length} contas encontradas` : `${result.people.length} pessoas encontradas`}</h2><p className="mt-1 text-sm text-zinc-600">{result.nextBestAction.reason}</p></div><div className="flex gap-2"><button type="button" onClick={() => runSearch({ forceRefresh: true })} className="rounded-md border border-[var(--share-line)] px-3 py-2 text-sm">Atualizar resultados</button><button type="button" onClick={exportSnapshot} disabled={isExporting} className="inline-flex items-center gap-2 rounded-md border border-[var(--share-green-800)] px-3 py-2 text-sm text-[var(--share-green-900)]"><Download className="h-4 w-4" />Exportar</button></div></div>
              {result.mode === "companies" ? <CompanyTable companies={result.companies} selected={selectedCompanyIds} setSelected={setSelectedCompanyIds} onContinue={continueWithSelectedCompanies} /> : <PeopleTable people={result.people} />}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-md bg-[#fbfdf8] p-4"><p className="text-sm text-zinc-600">{result.mode === "companies" ? "Novas contas são deduplicadas por LinkedIn, domínio e nome normalizado." : "Novas pessoas são deduplicadas pela URL real do LinkedIn e ID da fonte."}</p><button type="button" onClick={() => runSearch({ loadMore: true })} disabled={isLoadingMore || (result.mode === "companies" ? result.companies.length >= 50 : result.people.length >= 50)} className="inline-flex items-center gap-2 rounded-md bg-[var(--share-green-950)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isLoadingMore ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{isLoadingMore ? "Buscando inéditos" : "Carregar mais 20"}</button></div>
              {result.warnings.length ? <details className="mt-4 rounded-md border border-[var(--share-line)] p-3"><summary className="cursor-pointer text-sm font-semibold text-[var(--share-green-900)]">Detalhes da pesquisa</summary><ul className="mt-2 grid gap-1 text-xs leading-5 text-zinc-600">{result.warnings.slice(-8).map((warning) => <li key={warning}>• {warning}</li>)}</ul></details> : null}
            </>}
          </div>
        </div>
      </section>
    </div>
  </main>;
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

function dedupePeople(people: HuntingPerson[]) { const seen = new Set<string>(); return people.filter((person) => { const key = (person.linkedinUrl || person.id || `${person.name}|${person.company}|${person.title}`).trim().replace(/\/$/, "").toLocaleLowerCase("pt-BR"); if (!key || seen.has(key)) return false; seen.add(key); return true; }); }
function dedupeCompanies(companies: HuntingCompany[]) { const seen = new Set<string>(); return companies.filter((company) => { const key = (company.linkedinUrl || company.domain || company.id || company.name).trim().replace(/\/$/, "").toLocaleLowerCase("pt-BR"); if (!key || seen.has(key)) return false; seen.add(key); return true; }); }

function CompanyTable({ companies, selected, setSelected, onContinue }: { companies: HuntingCompany[]; selected: string[]; setSelected: (ids: string[]) => void; onContinue: () => void }) { return <div className="mt-4"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase text-[var(--share-green-800)]"><tr><th className="border-b p-3">Conta</th><th className="border-b p-3">Setor</th><th className="border-b p-3">Localização</th><th className="border-b p-3">Fit</th><th className="border-b p-3">Fonte</th></tr></thead><tbody>{companies.map((company) => <tr key={company.id} className="border-b border-[var(--share-line)]"><td className="p-3"><label className="flex items-start gap-3"><input type="checkbox" checked={selected.includes(company.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, company.id] : selected.filter((id) => id !== company.id))} className="mt-1" /><span><strong>{company.name}</strong>{company.domain ? <span className="block text-xs text-zinc-500">{company.domain}</span> : null}</span></label></td><td className="p-3">{company.industry || "Não informado"}</td><td className="p-3">{company.location || "Não informada"}</td><td className="p-3 font-semibold">{company.fit}</td><td className="p-3">{company.linkedinUrl ? <a href={company.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--share-green-800)]">LinkedIn <ExternalLink className="h-3.5 w-3.5" /></a> : company.source}</td></tr>)}</tbody></table></div><button type="button" onClick={onContinue} disabled={!selected.length} className="mt-4 rounded-md border border-[var(--share-green-800)] px-4 py-2 text-sm font-semibold text-[var(--share-green-900)] disabled:opacity-50">Buscar pessoas nas contas selecionadas</button></div>; }
function PeopleTable({ people }: { people: HuntingPerson[] }) { return <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs uppercase text-[var(--share-green-800)]"><tr><th className="border-b p-3">Pessoa</th><th className="border-b p-3">Cargo</th><th className="border-b p-3">Empresa</th><th className="border-b p-3">Fit</th><th className="border-b p-3">Próxima ação</th></tr></thead><tbody>{people.map((person) => <tr key={person.id} className="border-b border-[var(--share-line)]"><td className="p-3"><a href={person.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[var(--share-green-950)] hover:underline">{person.name}<ExternalLink className="h-3.5 w-3.5" /></a><span className="mt-1 block text-xs text-zinc-500">{person.location || "Localização não informada"}</span></td><td className="p-3">{person.title}</td><td className="p-3">{person.company}</td><td className="p-3"><strong>{person.fitScore}%</strong><span className="ml-2 text-xs text-zinc-500">{person.fit}</span></td><td className="p-3 text-zinc-600">{person.nextBestAction}</td></tr>)}</tbody></table></div>; }
function Empty({ mode }: { mode: SearchMode }) { return <div className="flex min-h-[320px] items-center justify-center text-center"><div><p className="text-lg font-semibold text-[var(--share-green-950)]">{mode === "companies" ? "Defina o mercado e encontre contas" : "Informe as empresas e cargos-alvo"}</p><p className="mt-2 max-w-lg text-sm leading-6 text-zinc-500">A Share AI preserva evidências e nunca cria uma pessoa só para preencher o resultado.</p></div></div>; }
function Mode({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Building2; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${active ? "bg-[var(--share-green-950)] text-white" : "text-zinc-600"}`}><Icon className="h-4 w-4" />{label}</button>; }
function Field({ label, value, setValue }: { label: string; value: string; setValue: (value: string) => void }) { return <label className="grid gap-1 text-xs font-semibold text-zinc-600">{label}<input value={value} onChange={(event) => setValue(event.target.value)} className="h-10 rounded-md border border-[var(--share-line)] px-3 text-sm font-normal" /></label>; }
function Area({ label, value, setValue, placeholder = "" }: { label: string; value: string; setValue: (value: string) => void; placeholder?: string }) { return <label className="grid gap-1 text-xs font-semibold text-zinc-600">{label}<textarea value={value} onChange={(event) => setValue(event.target.value)} rows={3} placeholder={placeholder} className="rounded-md border border-[var(--share-line)] p-3 text-sm font-normal" /></label>; }
function NumberField({ label, value, setValue }: { label: string; value: number; setValue: (value: number) => void }) { return <label className="grid gap-1 text-xs font-semibold text-zinc-600">{label}<input type="number" min="5" max="50" value={value} onChange={(event) => setValue(Number(event.target.value))} className="h-10 rounded-md border border-[var(--share-line)] px-3 text-sm font-normal" /></label>; }
function buildObjective(id: string) { const unit = getBusinessUnitDna(id); return `Encontrar contas e pessoas aderentes a ${unit.positioning.whatWeAre.toLocaleLowerCase("pt-BR")} e criar conversas comerciais baseadas em evidências.`; }
