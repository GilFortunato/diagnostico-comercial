"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, CalendarDays, ChartNoAxesCombined, ClipboardList, Clock3, Columns3, LayoutList, Search } from "lucide-react";
import { crmButton, crmControl, dateLabel, requestCrm } from "./controls";
import { CrmCreateOpportunity } from "./CrmCreateOpportunity";
import { CrmCharts } from "./CrmCharts";
import { CrmOpportunityDrawer } from "./CrmOpportunityDrawer";
import { commercialMetrics } from "@/lib/crm/analytics";
import { alertFor, brl, channels, emptyFilters, filterRows, isActive, stages, temperatures, todayInBrazil, type ActivitySummary, type CrmFilters, type CrmRow, type ReportView } from "@/lib/crm/model";

type CrmResponse = { rows: CrmRow[]; activities: ActivitySummary[]; views: ReportView[]; sourceCount: number };
type Tab = "Ações de hoje" | "Pipeline" | "Reuniões" | "Propostas" | "BI Comercial" | "Relatórios";
const tabs: { label: Tab; icon: typeof Clock3 }[] = [
  { label: "Ações de hoje", icon: Clock3 }, { label: "Pipeline", icon: Columns3 },
  { label: "Reuniões", icon: CalendarDays }, { label: "Propostas", icon: ClipboardList },
  { label: "BI Comercial", icon: ChartNoAxesCombined }, { label: "Relatórios", icon: LayoutList },
];
const numeric = (v: number) => v.toLocaleString("pt-BR");
const sort = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
export function CrmWorkspace({ initialLead, canHunt }: { initialLead?: string; canHunt: boolean }) {
  const [data, setData] = useState<CrmResponse | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>(initialLead ? "Pipeline" : "Ações de hoje");
  const [layout, setLayout] = useState<"lista" | "kanban">("lista");
  const [selected, setSelected] = useState(initialLead ?? "");
  const [filters, setFilters] = useState<CrmFilters>(emptyFilters);
  const [actionScope, setActionScope] = useState("prioritárias");
  const [viewName, setViewName] = useState("");
  const [viewStatus, setViewStatus] = useState("");
  const [savingView, setSavingView] = useState(false);
  const today = todayInBrazil();

  useEffect(() => {
    const controller = new AbortController();
    requestCrm<CrmResponse>("/api/crm", { signal: controller.signal }).then(setData).catch((cause: Error) => {
      if (cause.name !== "AbortError") setError(cause.message);
    });
    return () => controller.abort();
  }, []);

  async function reload() {
    try {
      setData(await requestCrm<CrmResponse>("/api/crm"));
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao atualizar o CRM."); }
  }

  function change<K extends keyof CrmFilters>(key: K, value: CrmFilters[K]) {
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  async function saveView() {
    setSavingView(true);
    setViewStatus("");
    try {
      const view = await requestCrm<ReportView>("/api/crm/views", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: viewName, filters }) });
      setData((current) => current && { ...current, views: [...current.views.filter((item) => item.id !== view.id), view] });
      setViewName("");
      setViewStatus("Relatório salvo.");
    } catch (cause) { setViewStatus(cause instanceof Error ? cause.message : "Falha ao salvar o relatório."); }
    finally { setSavingView(false); }
  }

  const source = data?.rows ?? [];
  const activity = data?.activities ?? [];
  const rows = filterRows(source, tab === "BI Comercial" || tab === "Relatórios" ? { ...filters, channel: "" } : filters);
  const metrics = commercialMetrics(rows, activity, reportingFilters(filters, tab), today);
  const active = rows.filter(isActive);
  const overdue = active.filter((row) => row.nextActionDate && row.nextActionDate < today);
  const due = active.filter((row) => row.nextActionDate === today);
  const unscheduled = active.filter((row) => !row.nextActionDate);
  const meetingRows = new Set(metrics.upcomingMeetings.map((a) => a.opportunityId));
  const priorityRows = active.filter((row) => ["danger", "warning"].includes(alertFor(row, today).tone) && (row.nextActionDate || alertFor(row, today).label !== "Sem próxima ação"));
  const selectedActions = (actionScope === "atrasadas" ? overdue : actionScope === "hoje" ? due : actionScope === "sem data" ? unscheduled
    : actionScope === "reuniões" ? rows.filter((row) => meetingRows.has(row.id)) : priorityRows)
    .sort((a, b) => (a.nextActionDate ?? "9999").localeCompare(b.nextActionDate ?? "9999"));
  const eventNames = sort(source.flatMap((row) => [row.project ?? "", ...row.events]));
  const options = {
    owner: sort(source.map((row) => row.owner ?? "Sem responsável")), segment: sort(source.map((row) => row.segment ?? "Sem segmento")),
    stage: sort([...stages, ...source.map((row) => row.stage)]), channel: sort([...channels, ...source.flatMap((row) => row.channel?.split(" / ") ?? [])]),
    event: eventNames, temperature: [...temperatures], sponsorship: sort(source.flatMap((row) => row.sponsorship ? [row.sponsorship] : [])),
  };
  const kpis = [
    ["Total no pipeline", numeric(metrics.total)], ["Contatados no período", numeric(metrics.contacted)], ["Leads que reagiram", numeric(metrics.reacted)],
    ["Reuniões a realizar", numeric(metrics.upcoming)], ["Reuniões realizadas", numeric(metrics.held)],
  ];
  const operational = tab === "Ações de hoje";
  const reporting = tab === "BI Comercial" || tab === "Relatórios";
  const invalidPeriod = Boolean(filters.from && filters.to && filters.from > filters.to);

  function drill(key: "owner" | "segment" | "event" | "channel", value: string) {
    change(key, value);
    setTab(key === "owner" ? "Ações de hoje" : "Pipeline");
    if (key === "owner") setActionScope("prioritárias");
  }

  return <main className="share-shell min-h-screen pb-12 text-[var(--share-ink)]">
    <div className="mx-auto max-w-[1440px] px-4 pt-5 sm:px-8 sm:pt-8">
      <div className="share-green-panel flex flex-wrap items-end justify-between gap-5 rounded-2xl p-6 text-white sm:p-8">
        <div><p className="text-sm font-semibold text-[var(--share-lime)]">Humanship</p><h1 className="mt-1 text-4xl font-semibold tracking-tight">CRM</h1><p className="mt-2 text-sm text-white/75">Patrocínios e parcerias</p></div>
        <div className="flex flex-wrap gap-2"><CrmCreateOpportunity onCreated={(id) => { setTab("Pipeline"); setSelected(id); void reload(); }} />
        {canHunt && <Link href="/mapa-decisores" className="inline-flex items-center gap-2 rounded-lg bg-[var(--share-lime)] px-4 py-2.5 text-sm font-semibold text-[var(--share-green-950)]">B2B Hunting <ArrowUpRight className="h-4 w-4" /></Link>}</div>
      </div>
      <nav aria-label="Seções do CRM" className="mt-4 flex gap-1 overflow-x-auto rounded-xl border border-[var(--share-line)] bg-white p-1.5">
        {tabs.map(({ label, icon: Icon }) => <button key={label} type="button" aria-current={tab === label ? "page" : undefined} onClick={() => setTab(label)} className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-green-50 aria-[current=page]:bg-[var(--share-green-950)] aria-[current=page]:text-white"><Icon className="h-4 w-4" />{label}</button>)}
      </nav>
      {error && <div role="alert" className="my-4 flex flex-wrap items-center gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-900">{error}<button type="button" onClick={() => void reload()} className="font-semibold underline">Tentar novamente</button></div>}
      {!data && !error && <p role="status" className="share-card mt-5 rounded-xl p-5 text-sm">Carregando o CRM…</p>}
      {data && <div className="mt-5 grid gap-4">
        {operational && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {([["atrasadas", "Ações atrasadas", overdue.length], ["hoje", "Ações de hoje", due.length], ["reuniões", "Reuniões agendadas", meetingRows.size], ["sem data", "Sem próxima ação", unscheduled.length]] as const).map(([key, label, value]) =>
            <button key={key} type="button" aria-pressed={actionScope === key} onClick={() => setActionScope(actionScope === key ? "prioritárias" : key)} className="share-card rounded-xl p-4 text-left hover:border-emerald-600 aria-pressed:border-emerald-700 aria-pressed:ring-1 aria-pressed:ring-emerald-700">
              <span className="text-sm font-medium text-zinc-600">{label}</span><span className={"mt-2 block text-3xl font-semibold tabular-nums " + (key === "atrasadas" && value ? "text-red-700" : "text-[var(--share-green-950)]")}>{numeric(value)}</span>
            </button>)}
        </div>}
        <section aria-label="Filtros" className="share-card grid gap-3 rounded-xl p-4">
          <label className="relative block"><Search aria-hidden className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" /><span className="sr-only">Buscar oportunidade</span><input className={crmControl + " pl-9"} value={filters.search} onChange={(e) => change("search", e.target.value)} placeholder="Buscar por empresa, decisor ou nº de cadastro" /></label>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
            {([["owner", "Responsável"], ["segment", "Segmento"], ["stage", "Etapa"], ["channel", "Canal"], ["event", "Evento"], ["temperature", "Temperatura"], ["sponsorship", "Cota"]] as const).map(([key, label]) =>
              <label key={key} className="grid gap-1 text-xs font-semibold text-zinc-600">{label}<select className={crmControl} value={filters[key]} onChange={(e) => change(key, e.target.value)}><option value="">Todos</option>{options[key].map((option) => <option key={option}>{option}</option>)}</select></label>)}
          </div>
          {reporting && <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-xs font-semibold">De<input type="date" className={crmControl} value={filters.from} onChange={(e) => change("from", e.target.value)} /></label>
            <label className="grid gap-1 text-xs font-semibold">Até<input type="date" className={crmControl} value={filters.to} onChange={(e) => change("to", e.target.value)} /></label>
            <button type="button" onClick={() => setFilters(emptyFilters)} className="px-2 py-2 text-sm font-semibold text-[var(--share-green-800)] underline">Limpar filtros</button>
          </div>}
          {reporting && invalidPeriod && <p role="alert" className="text-sm text-red-700">A data final precisa ser igual ou posterior à inicial.</p>}
        </section>
        {operational && <CrmTable rows={selectedActions} today={today} onOpen={setSelected} title={actionScope === "prioritárias" ? "Ações prioritárias" : "Ações · " + actionScope} />}
        {tab === "Pipeline" && <section className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-zinc-600">{numeric(rows.length)} oportunidades · {numeric(data.sourceCount)} importadas da planilha</p><div className="flex gap-2">
            <button type="button" onClick={() => setLayout("lista")} aria-pressed={layout === "lista"} className={crmControl + " w-auto aria-pressed:border-emerald-700"}>Lista</button>
            <button type="button" onClick={() => setLayout("kanban")} aria-pressed={layout === "kanban"} className={crmControl + " w-auto aria-pressed:border-emerald-700"}>Kanban</button>
          </div></div>
          {layout === "lista" ? <CrmTable rows={rows} today={today} onOpen={setSelected} title="Oportunidades" /> : <Kanban rows={rows} today={today} onOpen={setSelected} />}
        </section>}
        {tab === "Reuniões" && <>
          <CrmTable rows={rows.filter((row) => row.stage === "Agendar Reunião")} today={today} onOpen={setSelected} title="A agendar" />
          <MeetingList rows={rows} activities={metrics.upcomingMeetings} title="Agendadas a realizar" onOpen={setSelected} />
          <MeetingList rows={rows} activities={metrics.heldMeetings} title="Realizadas" onOpen={setSelected} />
          <MeetingList rows={rows} activities={activity.filter((a) => !a.date && ["Reunião realizada", "Reunião agendada"].includes(a.kind))} title="Reuniões sem data confirmada" onOpen={setSelected} />
        </>}
        {tab === "Propostas" && <>
          <CrmTable rows={rows.filter((row) => row.stage === "Enviar proposta")} today={today} onOpen={setSelected} title="A enviar" />
          <CrmTable rows={rows.filter((row) => ["Proposta enviada", "Negociação"].includes(row.stage))} today={today} onOpen={setSelected} title="Propostas enviadas e negociações" />
          <CrmTable rows={rows.filter((row) => row.contractClosed || row.stage === "Fechado" || row.result === "Vendido")} today={today} onOpen={setSelected} title="Patrocínios fechados" />
        </>}
        {reporting && !invalidPeriod && <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {kpis.map(([label, value]) => <div key={label} className="share-card rounded-xl p-4"><p className="text-sm text-zinc-600">{label}</p><p className="mt-2 text-3xl font-semibold text-[var(--share-green-950)]">{value}</p></div>)}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[["Valor em aberto", brl(metrics.proposedValue)], ["Valor vendido", brl(metrics.soldValue)], ["Respostas positivas", numeric(metrics.positive)]].map(([label, value]) =>
              <div key={label} className="share-card rounded-xl p-4"><p className="text-sm text-zinc-600">{label}</p><p className="mt-2 text-xl font-semibold text-[var(--share-green-950)]">{value}</p></div>)}
          </div>
          {tab === "BI Comercial" ? <CrmCharts metrics={metrics} rows={rows} onOwner={(v) => drill("owner", v)} onSegment={(v) => drill("segment", v)} onEvent={(v) => drill("event", v)} onChannel={(v) => drill("channel", v)} />
            : <>
              <section className="share-card rounded-xl p-4">
                <h2 className="text-lg font-semibold">Consolidação Executiva</h2>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <label className="grid gap-1 text-xs font-semibold">Relatório salvo<select className={crmControl} value="" onChange={(event) => {
                    const view = data.views.find((item) => item.id === event.target.value);
                    if (view) { setFilters(view.filters); setViewName(view.name); setViewStatus(""); }
                  }}><option value="" disabled>Selecionar relatório</option>{data.views.map((view) => <option value={view.id} key={view.id}>{view.name}</option>)}</select></label>
                  <label className="grid gap-1 text-xs font-semibold">Nome do relatório<input className={crmControl} value={viewName} onChange={(event) => setViewName(event.target.value)} placeholder="Reunião de terça" maxLength={80} /></label>
                  <button type="button" className={crmButton} onClick={() => void saveView()} disabled={!viewName.trim() || savingView}>Salvar relatório</button>
                </div>
                {viewStatus && <p role="status" className="mt-3 text-sm">{viewStatus}</p>}
              </section>
              <CrmTable rows={rows.filter((row) => metrics.contactedIds.has(row.id))} today={today} onOpen={setSelected} title="Contatados no período" />
              <CrmTable rows={rows.filter((row) => metrics.reactedIds.has(row.id))} today={today} onOpen={setSelected} title="Leads que reagiram" />
              <MeetingList rows={rows} activities={metrics.upcomingMeetings} title="Reuniões a realizar" onOpen={setSelected} />
              <MeetingList rows={rows} activities={metrics.heldMeetings} title="Reuniões realizadas" onOpen={setSelected} />
            </>}
        </>}
      </div>}
    </div>
    {selected && <CrmOpportunityDrawer key={selected} id={selected} onClose={() => setSelected("")} onSelect={setSelected} onUpdated={() => void reload()} eventNames={eventNames} />}
  </main>;
}

function reportingFilters(filters: CrmFilters, tab: Tab) {
  return tab === "BI Comercial" || tab === "Relatórios" ? filters : { ...filters, from: "", to: "", channel: "" };
}

function AlertLabel({ row, today }: { row: CrmRow; today: string }) {
  const alert = alertFor(row, today);
  const colors: Record<string, string> = { danger: "bg-red-50 text-red-800", warning: "bg-amber-50 text-amber-900", ok: "bg-emerald-50 text-emerald-900", neutral: "bg-zinc-100 text-zinc-700" };
  return <span className={"inline-block rounded-full px-2 py-1 text-xs font-semibold " + colors[alert.tone]}>{alert.label}</span>;
}

function CrmTable({ rows, today, onOpen, title }: { rows: CrmRow[]; today: string; onOpen: (id: string) => void; title: string }) {
  return <section className="share-card overflow-hidden rounded-xl">
    <h2 className="px-4 pt-4 text-lg font-semibold">{title} <span className="ml-1 text-sm font-normal text-zinc-500">{rows.length}</span></h2>
    {!rows.length ? <p className="p-4 text-sm text-zinc-500">Nenhuma oportunidade para estes filtros.</p> : <div className="max-h-[35rem] overflow-auto">
      <table className="mt-2 w-full min-w-[850px] text-left text-sm">
        <thead className="sticky top-0 bg-[#f3f7f2] text-xs text-zinc-700"><tr>{["Empresa", "Alerta", "Próxima ação", "Etapa", "Responsável", "Valor proposto"].map((label) => <th scope="col" key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id} className="border-t border-[var(--share-line)] align-top hover:bg-green-50/40">
          <td className="px-4 py-3"><button type="button" className="text-left font-semibold text-[var(--share-green-950)] hover:underline" onClick={() => onOpen(row.id)}>{row.name}</button><p className="mt-1 max-w-44 text-xs text-zinc-600">{[row.legacyId ? "#" + row.legacyId : "", row.contactNames.join(", ")].filter(Boolean).join(" · ")}</p></td>
          <td className="px-4 py-3"><AlertLabel row={row} today={today} /></td><td className="max-w-72 px-4 py-3"><span className="block font-medium">{dateLabel(row.nextActionDate)}</span><p className="mt-1 line-clamp-2 text-xs text-zinc-600">{row.nextAction}</p></td>
          <td className="px-4 py-3">{row.stage}<span className="mt-1 block text-xs text-zinc-600">{row.temperature}</span></td>
          <td className="px-4 py-3">{row.owner || "—"}</td><td className="whitespace-nowrap px-4 py-3">{row.proposedValue === null ? "—" : brl(row.proposedValue)}</td>
        </tr>)}</tbody>
      </table>
    </div>}
  </section>;
}

function Kanban({ rows, today, onOpen }: { rows: CrmRow[]; today: string; onOpen: (id: string) => void }) {
  const columns = [...new Set([...stages, ...rows.map((row) => row.stage)])];
  return <div className="flex gap-3 overflow-x-auto pb-3" aria-label="Kanban do pipeline">
    {columns.map((stage) => {
      const group = rows.filter((row) => row.stage === stage);
      return <section key={stage} className="w-64 shrink-0 rounded-xl border border-[var(--share-line)] bg-[#edf3ed] p-3">
        <h2 className="text-sm font-semibold">{stage} <span className="text-zinc-600">· {group.length}</span></h2>
        <p className="my-2 text-xs text-zinc-600">{brl(group.reduce((sum, row) => sum + (row.proposedValue ?? 0), 0))}</p>
        <div className="grid max-h-[34rem] gap-2 overflow-y-auto">{group.map((row) => <button type="button" key={row.id} onClick={() => onOpen(row.id)} className="share-card grid gap-2 rounded-lg p-3 text-left text-sm hover:border-emerald-600"><strong>{row.name}</strong><span className="text-xs text-zinc-600">{[row.owner, row.temperature, row.nextActionDate && dateLabel(row.nextActionDate)].filter(Boolean).join(" · ")}</span><span><AlertLabel row={row} today={today} /></span></button>)}</div>
      </section>;
    })}
  </div>;
}

function MeetingList({ activities, rows, title, onOpen }: { activities: ActivitySummary[]; rows: CrmRow[]; title: string; onOpen: (id: string) => void }) {
  const index = new Map(rows.map((row) => [row.id, row]));
  const meetings = activities.filter((a) => index.has(a.opportunityId)).toSorted((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  return <section className="share-card rounded-xl p-4">
    <h2 className="text-lg font-semibold">{title} <span className="text-sm font-normal text-zinc-600">{meetings.length}</span></h2>
    {!meetings.length ? <p className="mt-3 text-sm text-zinc-500">Nenhuma reunião para estes filtros.</p> : <ul className="mt-3 grid divide-y divide-[var(--share-line)]">
      {meetings.map((activity, i) => { const row = index.get(activity.opportunityId)!; return <li key={activity.opportunityId + ":" + i} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm"><time className="min-w-24 text-zinc-600" dateTime={activity.date ?? undefined}>{dateLabel(activity.date)}</time><button type="button" className="font-semibold hover:underline" onClick={() => onOpen(row.id)}>{row.name}</button><span className="text-zinc-600">{[row.owner, ...row.contactNames].filter(Boolean).join(" · ")}</span></li>; })}
    </ul>}
  </section>;
}
