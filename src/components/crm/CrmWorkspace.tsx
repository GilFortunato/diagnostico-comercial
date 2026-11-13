"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, CalendarDays, ChartNoAxesCombined, ClipboardList, Clock3, Columns3, LayoutList, Pencil, Plus, Search } from "lucide-react";
import { crmButton, crmControl, dateLabel, requestCrm } from "./controls";
import { CrmCreateOpportunity } from "./CrmCreateOpportunity";
import { CrmCharts } from "./CrmCharts";
import { CrmKanban } from "./CrmKanban";
import { CrmAlertLabel } from "./CrmAlertLabel";
import { CrmTaskDialog, TaskQueue, type TaskSelection } from "./CrmTaskQueue";
import { CrmReports } from "./CrmReports";
import { CrmImportReview } from "./CrmImportReview";
import { proposalStages, reportLabels, resolveReportPeriod } from "@/lib/crm/reports";
import { CrmQuickEdit, type QuickEdit } from "./CrmQuickEdit";
import { CrmOpportunityDrawer } from "./CrmOpportunityDrawer";
import { commercialMetrics } from "@/lib/crm/analytics";
import { alertFor, brl, channels, emptyFilters, filterRows, isActive, stages, temperatures, todayInBrazil, type ActivitySummary, type CrmDetail, type CrmFilters, type CrmRow, type CrmTask, type ReportView } from "@/lib/crm/model";

type CrmResponse = { rows: CrmRow[]; activities: ActivitySummary[]; tasks?: CrmTask[]; views: ReportView[]; sourceCount: number };
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
  const [taskEdit, setTaskEdit] = useState<TaskSelection>();
  const [quickEdit, setQuickEdit] = useState<QuickEdit>();
  const [savedMessage, setSavedMessage] = useState("");
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

  function applyOpportunity(detail: CrmDetail) {
    setData((current) => current && {
      ...current,
      rows: [detail.row, ...current.rows.filter((row) => row.id !== detail.row.id)],
      activities: [...current.activities.filter((item) => item.opportunityId !== detail.row.id), ...detail.activities],
      tasks: [...(current.tasks ?? []).filter((item) => item.opportunityId !== detail.row.id), ...(detail.tasks ?? [])].toSorted((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")),
    });
  }

  function startEdit(edit: QuickEdit) {
    setSavedMessage("");
    setQuickEdit(edit);
  }

  function change<K extends keyof CrmFilters>(key: K, value: CrmFilters[K]) {
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  async function saveView() {
    setSavingView(true);
    setViewStatus("");
    try {
      const view = await requestCrm<ReportView>("/api/crm/views", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: viewName, filters: { ...filters, from: scopedFilters.from, to: scopedFilters.to } }) });
      setData((current) => current && { ...current, views: [...current.views.filter((item) => item.id !== view.id), view] });
      setViewName("");
      setViewStatus("Relatório salvo.");
    } catch (cause) { setViewStatus(cause instanceof Error ? cause.message : "Falha ao salvar o relatório."); }
    finally { setSavingView(false); }
  }

  const source = data?.rows ?? [];
  const activity = data?.activities ?? [];
  const rows = filterRows(source, filters);
  const reportFilters = reportingFilters(filters, tab);
  const scopedFilters = resolveReportPeriod(reportFilters, today);
  const metrics = commercialMetrics(rows, activity, scopedFilters, today);
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
  const invalidPeriod = Boolean(scopedFilters.from && scopedFilters.to && scopedFilters.from > scopedFilters.to);
  const panel = filters.panel ?? "summary";

  function showMeetings() { setSelected(""); setTab("Reuniões"); }

  function selectTab(next: Tab) {
    setTab(next);
    if (next === "Relatórios") {
      setFilters((value) => !value.panel && !value.from && !value.to && !value.period ? { ...value, panel: "summary", period: "last7" } : value);
    }
  }

  function drill(key: "owner" | "segment" | "event" | "channel" | "stage", value: string) {
    change(key, value);
    setTab(key === "owner" ? "Ações de hoje" : "Pipeline");
    if (key === "owner") setActionScope("prioritárias");
  }

  return <main className="share-shell min-h-screen pb-12 text-[var(--share-ink)]">
    <div className="w-full px-3 pt-5 sm:px-5 sm:pt-8">
      <div className="share-green-panel flex flex-wrap items-end justify-between gap-5 rounded-2xl p-6 text-white sm:p-8">
        <div><p className="text-sm font-semibold text-[var(--share-lime)]">Humanship</p><h1 className="mt-1 text-4xl font-semibold tracking-tight">CRM</h1><p className="mt-2 text-sm text-white/75">Patrocínios e parcerias</p></div>
        <div className="flex flex-wrap gap-2"><CrmCreateOpportunity onCreated={(id) => { setTab("Pipeline"); setSelected(id); void reload(); }} />
        {canHunt && <Link href="/mapa-decisores" className="inline-flex items-center gap-2 rounded-lg bg-[var(--share-lime)] px-4 py-2.5 text-sm font-semibold text-[var(--share-green-950)]">B2B Hunting <ArrowUpRight className="h-4 w-4" /></Link>}</div>
      </div>
      <nav aria-label="Seções do CRM" className="mt-4 flex gap-1 overflow-x-auto rounded-xl border border-[var(--share-line)] bg-white p-1.5">
        {tabs.map(({ label, icon: Icon }) => <button key={label} type="button" aria-current={tab === label ? "page" : undefined} onClick={() => selectTab(label)} className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-green-50 aria-[current=page]:bg-[var(--share-green-950)] aria-[current=page]:text-white"><Icon className="h-4 w-4" />{label}</button>)}
      </nav>
      {error && <div role="alert" className="my-4 flex flex-wrap items-center gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-900">{error}<button type="button" onClick={() => void reload()} className="font-semibold underline">Tentar novamente</button></div>}
      {savedMessage && <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-900">{savedMessage}</p>}
      {!data && !error && <p role="status" className="share-card mt-5 rounded-xl p-5 text-sm">Carregando o CRM…</p>}
      {data && <div className="mt-5 grid grid-cols-1 gap-4">
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
              <label key={key} className="grid gap-1 text-xs font-semibold text-zinc-600">{label}<select aria-label={label} className={crmControl} value={filters[key]} onChange={(e) => change(key, e.target.value)}><option value="">Todos</option>{options[key].map((option) => <option key={option}>{option}</option>)}</select></label>)}
          </div>
          {reporting && <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-xs font-semibold">De<input type="date" className={crmControl} value={scopedFilters.from} onChange={(e) => setFilters((value) => ({ ...value, from: e.target.value, period: undefined }))} /></label>
            <label className="grid gap-1 text-xs font-semibold">Até<input type="date" className={crmControl} value={scopedFilters.to} onChange={(e) => setFilters((value) => ({ ...value, to: e.target.value, period: undefined }))} /></label>
            <label className="grid gap-1 text-xs font-semibold">Período móvel
              <select aria-label="Período móvel" className={crmControl} value={filters.period ?? ""} onChange={(e) => change("period", e.target.value === "last7" ? "last7" : e.target.value === "last30" ? "last30" : undefined)}>
                <option value="">Datas escolhidas</option><option value="last7">Últimos 7 dias</option><option value="last30">Últimos 30 dias</option>
              </select>
            </label>
            <button type="button" onClick={() => setFilters(emptyFilters)} className="px-2 py-2 text-sm font-semibold text-[var(--share-green-800)] underline">Limpar filtros</button>
          </div>}
          {reporting && invalidPeriod && <p role="alert" className="text-sm text-red-700">A data final precisa ser igual ou posterior à inicial.</p>}
        </section>
        {operational && <TaskQueue rows={rows} tasks={data.tasks ?? []} today={today} onOpen={setSelected} onTask={setTaskEdit} onMeeting={showMeetings} />}
        {operational && <CrmTable onTask={setTaskEdit} onEdit={startEdit} rows={selectedActions} today={today} onOpen={setSelected} title={actionScope === "prioritárias" ? "Ações prioritárias" : "Ações · " + actionScope} />}
        {tab === "Pipeline" && <section className="grid grid-cols-1 gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-zinc-600">{numeric(rows.length)} oportunidades · {numeric(data.sourceCount)} importadas da planilha</p><div className="flex gap-2">
            <button type="button" onClick={() => setLayout("lista")} aria-pressed={layout === "lista"} className={crmControl + " w-auto aria-pressed:border-emerald-700"}>Lista</button>
            <button type="button" onClick={() => setLayout("kanban")} aria-pressed={layout === "kanban"} className={crmControl + " w-auto aria-pressed:border-emerald-700"}>Kanban</button>
          </div></div>
          {layout === "lista" ? <CrmTable onTask={setTaskEdit} onEdit={startEdit} rows={rows} today={today} onOpen={setSelected} title="Oportunidades" showSchedule /> : <CrmKanban rows={rows} today={today} onOpen={setSelected} onMoved={applyOpportunity} onRefresh={reload} />}
        </section>}
        {tab === "Reuniões" && <>
          <CrmTable onTask={setTaskEdit} onEdit={startEdit} rows={rows.filter((row) => row.stage === "Agendar Reunião")} today={today} onOpen={setSelected} title="A agendar" canSchedule />
          <MeetingList rows={rows} activities={metrics.upcomingMeetings} title="Agendadas a realizar" onOpen={setSelected} onEdit={startEdit} canManage />
          {metrics.overdueMeetings.length > 0 && <MeetingList rows={rows} activities={metrics.overdueMeetings} title="Agendadas com data passada" onOpen={setSelected} onEdit={startEdit} canManage />}
          <MeetingList rows={rows} activities={metrics.heldMeetings} title="Realizadas" onOpen={setSelected} onEdit={startEdit} />
          <MeetingList rows={rows} activities={activity.filter((item) => item.kind === "Reunião cancelada")} title="Canceladas" onOpen={setSelected} onEdit={startEdit} />
          <MeetingList rows={rows} activities={activity.filter((a) => !a.date && ["Reunião realizada", "Reunião agendada"].includes(a.kind))} title="Reuniões sem data confirmada" onOpen={setSelected} onEdit={startEdit} canManage />
        </>}
        {tab === "Propostas" && <>
          <CrmTable onTask={setTaskEdit} onEdit={startEdit} rows={rows.filter((row) => row.stage === "Enviar proposta")} today={today} onOpen={setSelected} title="A enviar" proposalAction="proposal" />
          <CrmTable onTask={setTaskEdit} onEdit={startEdit} rows={rows.filter((row) => proposalStages.includes(row.stage) && isActive(row))} today={today} onOpen={setSelected} title="Propostas enviadas e negociações" proposalAction="outcome" />
          <CrmTable onTask={setTaskEdit} onEdit={startEdit} rows={rows.filter((row) => row.contractClosed || row.stage === "Fechado" || row.result === "Vendido")} today={today} onOpen={setSelected} title="Patrocínios fechados" />
          <CrmTable onTask={setTaskEdit} onEdit={startEdit} rows={rows.filter((row) => row.stage === "Perdido" || row.result === "Não vendido")} today={today} onOpen={setSelected} title="Oportunidades perdidas" />
        </>}
        {tab === "BI Comercial" && !invalidPeriod && <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {kpis.map(([label, value]) => <div key={label} className="share-card rounded-xl p-4"><p className="text-sm text-zinc-600">{label}</p><p className="mt-2 text-3xl font-semibold text-[var(--share-green-950)]">{value}</p></div>)}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[["Valor em aberto", brl(metrics.proposedValue)], ["Valor vendido", brl(metrics.soldValue)], ["Respostas positivas", numeric(metrics.positive)]].map(([label, value]) =>
              <div key={label} className="share-card rounded-xl p-4"><p className="text-sm text-zinc-600">{label}</p><p className="mt-2 text-xl font-semibold text-[var(--share-green-950)]">{value}</p></div>)}
          </div>
          <CrmCharts metrics={metrics} rows={rows} onOwner={(v) => drill("owner", v)} onSegment={(v) => drill("segment", v)} onEvent={(v) => drill("event", v)} onChannel={(v) => drill("channel", v)} onStage={(v) => drill("stage", v)} />
        </>}
        {tab === "Relatórios" && !invalidPeriod && <>
          <section className="share-card rounded-xl p-4">
            <h2 className="text-lg font-semibold">Relatórios comerciais</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(reportLabels).map(([key, label]) => <button type="button" key={key} aria-pressed={panel === key}
                className="rounded-lg border border-[var(--share-line)] px-3 py-2 text-sm font-semibold aria-pressed:border-emerald-700 aria-pressed:bg-emerald-50"
                onClick={() => {
                  const report = key as NonNullable<CrmFilters["panel"]>;
                  setFilters((value) => report === "summary" && !value.from && !value.to && !value.period ? { ...value, panel: report, period: "last7" } : { ...value, panel: report });
                }}>{label}</button>)}
            </div>
            {panel !== "import" && <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-xs font-semibold">Relatório salvo<select className={crmControl} value="" onChange={(event) => {
                const view = data.views.find((item) => item.id === event.target.value);
                if (view) { setFilters(view.filters); setViewName(view.name); setViewStatus(""); }
              }}><option value="" disabled>Selecionar relatório</option>{data.views.map((view) => <option value={view.id} key={view.id}>{view.name}</option>)}</select></label>
              <label className="grid gap-1 text-xs font-semibold">Nome do relatório<input className={crmControl} value={viewName} onChange={(event) => setViewName(event.target.value)} placeholder={reportLabels[panel]} maxLength={80} /></label>
              <button type="button" className={crmButton} onClick={() => void saveView()} disabled={!viewName.trim() || savingView}>Salvar relatório</button>
            </div>}
            {viewStatus && <p role="status" className="mt-3 text-sm">{viewStatus}</p>}
          </section>
          {panel === "import" ? <CrmImportReview opportunities={source} onOpen={setSelected} /> :
            <CrmReports key={panel} panel={panel} rows={rows} activities={activity} filters={scopedFilters} today={today} onOpen={setSelected} />}
        </>}
      </div>}
    </div>
    {taskEdit && <CrmTaskDialog selection={taskEdit} rows={rows} owners={sort([...options.owner.filter((name) => name !== "Sem responsável"), ...(data?.tasks ?? []).map((task) => task.owner ?? "")])}
      onClose={() => setTaskEdit(undefined)} onRefresh={reload} onSaved={(detail) => { applyOpportunity(detail); setSavedMessage("Tarefa atualizada."); }} />}
    {quickEdit && <CrmQuickEdit edit={quickEdit} today={today} onClose={() => setQuickEdit(undefined)} onRefresh={reload}
      onSaved={(detail, message) => { applyOpportunity(detail); setQuickEdit(undefined); setSavedMessage(message); }} />}
    {selected && !taskEdit && <CrmOpportunityDrawer key={selected} id={selected} onClose={() => setSelected("")} onSelect={setSelected} onUpdated={() => void reload()} eventNames={eventNames} onTask={setTaskEdit} onMeetings={showMeetings} />}
  </main>;
}

function reportingFilters(filters: CrmFilters, tab: Tab) {
  return tab === "BI Comercial" || tab === "Relatórios" ? filters : { ...filters, from: "", to: "", channel: "", period: undefined };
}

function CrmTable({ rows, today, onOpen, onEdit, onTask, title, canSchedule, showSchedule, proposalAction }: { rows: CrmRow[]; today: string; onOpen: (id: string) => void; onEdit: (edit: QuickEdit) => void; onTask: (edit: TaskSelection) => void; title: string; canSchedule?: boolean; showSchedule?: boolean; proposalAction?: "proposal" | "outcome" }) {
  return <section className="share-card overflow-hidden rounded-xl">
    <h2 className="px-4 pt-4 text-lg font-semibold">{title} <span className="ml-1 text-sm font-normal text-zinc-500">{rows.length}</span></h2>
    {!rows.length ? <p className="p-4 text-sm text-zinc-500">Nenhuma oportunidade para estes filtros.</p> : <div className="max-h-[35rem] overflow-auto">
      <table className="mt-2 w-full min-w-[850px] text-left text-sm">
        <thead className="sticky top-0 bg-[#f3f7f2] text-xs text-zinc-700"><tr>{["Empresa", "Alerta", "Próxima ação", "Etapa", "Responsável", "Valor proposto"].map((label) => <th scope="col" key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id} className="border-t border-[var(--share-line)] align-top hover:bg-green-50/40">
          <td className="px-4 py-3"><button type="button" className="text-left font-semibold text-[var(--share-green-950)] hover:underline" onClick={() => onOpen(row.id)}>{row.name}</button><p className="mt-1 max-w-44 text-xs text-zinc-600">{[row.legacyId ? "#" + row.legacyId : "", row.contactNames.join(", ")].filter(Boolean).join(" · ")}</p></td>
          <td className="px-4 py-3"><CrmAlertLabel row={row} today={today} /></td>
          <td className="max-w-72 px-4 py-3">
            <span className="block font-medium">{dateLabel(row.nextActionDate)}</span>
            <p className="mt-1 line-clamp-2 text-xs text-zinc-600">{row.nextAction}</p>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {row.nextAction && <QuickButton label="Editar próxima ação" row={row} mode="action" onEdit={onEdit} />}
              <button type="button" onClick={() => onTask({ row })} aria-label={"Nova tarefa · " + row.name} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--share-green-800)] hover:underline"><Plus size={13} aria-hidden /> Nova tarefa</button>
              {(canSchedule || (showSchedule && isActive(row))) && <QuickButton label="Agendar reunião" row={row} mode="schedule" onEdit={onEdit} />}
            </div>
          </td>
          <td className="px-4 py-3">
            <QuickButton label={row.stage} accessibleLabel="Alterar etapa" row={row} mode="stage" onEdit={onEdit} />
            <span className="mt-1 block text-xs text-zinc-600">{row.temperature}</span>
            {proposalAction && <div className="mt-1"><QuickButton label={proposalAction === "proposal" ? "Registrar envio" : "Registrar resultado"} row={row} mode={proposalAction} onEdit={onEdit} /></div>}
          </td>
          <td className="px-4 py-3">{row.owner || "—"}</td><td className="whitespace-nowrap px-4 py-3">{row.proposedValue === null ? "—" : brl(row.proposedValue)}</td>
        </tr>)}</tbody>
      </table>
    </div>}
  </section>;
}

function QuickButton({ label, accessibleLabel, row, mode, meeting, onEdit }: {
  label: string; accessibleLabel?: string; row: CrmRow; mode: QuickEdit["mode"];
  meeting?: ActivitySummary; onEdit: (edit: QuickEdit) => void;
}) {
  const Icon = mode === "action" && !row.nextAction ? Plus : Pencil;
  return <button type="button" aria-label={(accessibleLabel ?? label) + " · " + row.name}
    onClick={() => onEdit({ row, mode, meeting })}
    className="inline-flex items-center gap-1.5 rounded text-left text-xs font-semibold text-[var(--share-green-800)] hover:underline">
    {label}<Icon aria-hidden className="h-3 w-3 shrink-0" />
  </button>;
}

function MeetingList({ activities, rows, title, onOpen, onEdit, canManage }: {
  activities: ActivitySummary[]; rows: CrmRow[]; title: string; onOpen: (id: string) => void;
  onEdit?: (edit: QuickEdit) => void; canManage?: boolean;
}) {
  const index = new Map(rows.map((row) => [row.id, row]));
  const meetings = activities.filter((a) => index.has(a.opportunityId)).toSorted((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  return <section className="share-card rounded-xl p-4">
    <h2 className="text-lg font-semibold">{title} <span className="text-sm font-normal text-zinc-600">{meetings.length}</span></h2>
    {!meetings.length ? <p className="mt-3 text-sm text-zinc-500">Nenhuma reunião para estes filtros.</p> : <ul className="mt-3 grid divide-y divide-[var(--share-line)]">
      {meetings.map((activity) => {
        const row = index.get(activity.opportunityId)!;
        return <li key={activity.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 text-sm">
          <time className="min-w-24 text-zinc-600" dateTime={activity.date ?? undefined}>{dateLabel(activity.date)}</time>
          <button type="button" className="font-semibold hover:underline" onClick={() => onOpen(row.id)}>{row.name}</button>
          <span className="text-zinc-600">{[row.owner, ...row.contactNames].filter(Boolean).join(" · ")}</span>
          {onEdit && <div className="ml-auto flex flex-wrap gap-3">
            <QuickButton label={row.stage} accessibleLabel="Alterar etapa" row={row} mode="stage" onEdit={onEdit} />
            <QuickButton label={row.nextAction ? "Editar ação" : "Nova ação"} row={row} mode="action" onEdit={onEdit} />
            {canManage && activity.kind === "Reunião agendada" && <>
              <QuickButton label={activity.date ? "Reagendar" : "Definir data"} row={row} mode="schedule" meeting={activity} onEdit={onEdit} />
              <QuickButton label="Marcar realizada" row={row} mode="held" meeting={activity} onEdit={onEdit} />
              <QuickButton label="Cancelar reunião" row={row} mode="cancelMeeting" meeting={activity} onEdit={onEdit} />
            </>}
          </div>}
        </li>;
      })}
    </ul>}
  </section>;
}
