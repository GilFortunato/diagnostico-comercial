"use client";

import { useState } from "react";
import { ArrowUpRight, Download } from "lucide-react";
import { brl, type ActivitySummary, type CrmFilters, type CrmRow, type ReportPanel } from "@/lib/crm/model";
import { commercialMetrics } from "@/lib/crm/analytics";
import { operationalReports, reportLabels } from "@/lib/crm/reports";
import { crmControl, dateLabel } from "./controls";

type ReportGroup = { label: string; items: CrmRow[]; cells: string[] };
const groupKey = (label: string) => "group:" + label;
const cardKey = (label: string) => "card:" + label;
const formatNumber = (value: number) => value.toLocaleString("pt-BR");
const percent = (part: number, total: number) => total ? (part / total).toLocaleString("pt-BR", { style: "percent", maximumFractionDigits: 1 }) : "—";

function downloadRows(rows: CrmRow[]) {
  const quote = (value: string | number | null) => {
    const text = String(value ?? "");
    return '"' + (/^[\s]*[=+@\-\t\r]/.test(text) && typeof value === "string" ? "'" : "") + text.replaceAll('"', '""') + '"';
  };
  const header = ["Empresa", "Cadastro", "Segmento", "Etapa", "Responsável", "Próxima ação", "Prazo", "Valor proposto", "Valor vendido"];
  const lines = rows.map((row) => [row.name, row.legacyId, row.segment, row.stage, row.owner, row.nextAction, dateLabel(row.nextActionDate),
    row.proposedValue?.toFixed(2).replace(".", ",") ?? "", row.soldValue?.toFixed(2).replace(".", ",") ?? ""]);
  const url = URL.createObjectURL(new Blob(["\uFEFF", [header, ...lines].map((line) => line.map(quote).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "crm-humanship.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function GroupTable({ title, headers, groups, onSelect }: { title: string; headers: string[]; groups: ReportGroup[]; onSelect: (group: ReportGroup) => void }) {
  return <section className="share-card min-w-0 rounded-xl p-4">
    <h3 className="text-base font-semibold">{title}</h3>
    {groups.length === 0 ? <p className="mt-3 text-sm text-zinc-600">Sem registros com estes filtros.</p> : <div className="mt-2 max-h-[30rem] overflow-auto">
      <table className="w-full min-w-[540px] text-left text-sm"><thead className="sticky top-0 bg-[#f3f7f2] text-xs"><tr>
        {headers.map((label) => <th key={label} scope="col" className="p-3">{label}</th>)}
      </tr></thead><tbody>
        {groups.map((group) => <tr key={group.label} className="border-b border-[var(--share-line)]">
          <td className="p-3"><button type="button" className="flex items-center gap-1 font-semibold text-[var(--share-green-800)] hover:underline" onClick={() => onSelect(group)}>{group.label}<ArrowUpRight size={13} aria-hidden /></button></td>
          {group.cells.map((cell, index) => <td key={index} className="whitespace-nowrap p-3 tabular-nums">{cell}</td>)}
        </tr>)}
      </tbody></table>
    </div>}
  </section>;
}

export function CrmReports({ panel, rows, activities, filters, today, onOpen }: {
  panel: Exclude<ReportPanel, "import">; rows: CrmRow[]; activities: ActivitySummary[]; filters: CrmFilters; today: string; onOpen: (id: string) => void;
}) {
  const [selected, setSelected] = useState("");
  const metrics = commercialMetrics(rows, activities, filters, today);
  const operational = operationalReports(rows, activities, filters, today);
  const ids = (group: { opportunityId: string }[]) => new Set(group.map((item) => item.opportunityId));
  const futureMeetings = panel === "summary"
    ? commercialMetrics(rows, activities, { ...filters, from: "", to: "" }, today).upcomingMeetings
    : metrics.upcomingMeetings;
  const meetings = ids(futureMeetings);
  const held = ids(metrics.heldMeetings);
  const behind = ids(metrics.overdueMeetings);
  const summary = [
    { label: "Contatadas no período", items: rows.filter((row) => metrics.contactedIds.has(row.id)) },
    { label: "Reagiram no período", items: rows.filter((row) => metrics.reactedIds.has(row.id)) },
    { label: "Propostas enviadas no período", items: operational.sent },
    { label: "Reuniões a realizar", items: rows.filter((row) => meetings.has(row.id)), display: formatNumber(futureMeetings.length) },
    { label: "Reuniões realizadas", items: rows.filter((row) => held.has(row.id)), display: formatNumber(metrics.held) },
  ];
  const cards = {
    summary,
    operations: [
      { label: "Oportunidades ativas", items: operational.active }, { label: "Ações atrasadas", items: operational.overdue },
      { label: "Ações de hoje", items: operational.due }, { label: "Sem prazo", items: operational.undated },
      { label: "Sem responsável", items: operational.unassigned },
    ],
    proposals: [
      { label: "Propostas ativas", items: operational.proposals },
      { label: "Valor em propostas", display: brl(operational.total), items: operational.proposals },
      { label: "SLA crítico", items: operational.criticalProposals },
      { label: "Ticket médio com valor definido", display: operational.ticket === null ? "—" : brl(operational.ticket), items: operational.quoted },
      { label: "Propostas com valor definido", items: operational.quoted },
    ],
    meetings: [
      { label: "A agendar", items: rows.filter((row) => row.stage === "Agendar Reunião") },
      { label: "Prioridade alta a agendar", items: operational.highPriorityMeetings },
      ...summary.slice(3), { label: "Agendadas com data passada", items: rows.filter((row) => behind.has(row.id)), display: formatNumber(metrics.overdueMeetings.length) },
      { label: "Reuniões com realização registrada", items: rows.filter((row) => held.has(row.id)), display: percent(metrics.held, metrics.held + metrics.upcoming + metrics.overdueMeetings.length) },
    ],
    segments: [],
  }[panel];
  const groups = panel === "operations" ? operational.sla.map(({ label, items, value }) => ({
    label, items, cells: [formatNumber(items.length), percent(items.length, operational.active.length), brl(value)],
  })) : panel === "proposals" ? operational.byOwner.map(({ label, items, value, critical }) => ({
    label, items, cells: [formatNumber(items.length), brl(value), formatNumber(critical), percent(value, operational.total)],
  })) : panel === "segments" ? operational.segments.map(({ label, items, contacted, hot, won }) => ({
    label, items, cells: [formatNumber(items.length), formatNumber(contacted), percent(contacted, items.length), formatNumber(hot), formatNumber(won)],
  })) : [];
  const selectedGroup = cards.find((item) => cardKey(item.label) === selected) ?? groups.find((item) => groupKey(item.label) === selected);
  const detail = selectedGroup?.items ?? (panel === "proposals" ? operational.proposals : panel === "operations" ? operational.active : rows);
  return <div className="grid min-w-0 gap-4">
    {cards.length > 0 && <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{cards.map((card) => <button type="button" key={card.label}
      onClick={() => setSelected(cardKey(card.label))} aria-pressed={selected === cardKey(card.label)}
      className="share-card rounded-xl p-4 text-left hover:border-emerald-600 aria-pressed:border-emerald-700 aria-pressed:bg-emerald-50">
      <span className="block text-xs font-semibold text-zinc-600">{card.label}</span>
      <strong className="mt-2 block text-xl tabular-nums text-[var(--share-green-950)]">{("display" in card && card.display) || formatNumber(card.items.length)}</strong>
    </button>)}</div>}
    {panel === "operations" && <GroupTable title="Criticidade do SLA" headers={["Alerta", "Oportunidades", "% dos ativos", "Valor em propostas"]} groups={groups} onSelect={(group) => setSelected(groupKey(group.label))} />}
    {panel === "proposals" && <GroupTable title="Propostas por responsável" headers={["Responsável", "Propostas", "Pipeline (R$)", "SLA crítico", "% do valor"]} groups={groups} onSelect={(group) => setSelected(groupKey(group.label))} />}
    {panel === "segments" && <GroupTable title="Indicadores por segmento" headers={["Segmento", "Na carteira", "Contatados", "Taxa de contato", "Quentes ativos", "Ganhos"]} groups={groups} onSelect={(group) => setSelected(groupKey(group.label))} />}
    {panel === "summary" && <p className="text-xs text-zinc-600">As reuniões a realizar incluem toda a agenda futura dos filtros selecionados.</p>}
    {panel === "meetings" && <p className="text-xs text-zinc-600">O percentual usa as reuniões realizadas e os agendamentos ainda abertos com data no período.</p>}
    <section className="share-card min-w-0 rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{selectedGroup?.label || reportLabels[panel]} <span className="text-xs font-normal text-zinc-600">· {detail.length} {detail.length === 1 ? "oportunidade" : "oportunidades"}</span></h3>
        <div className="flex flex-wrap gap-2">
          {selected && <button type="button" className={crmControl + " w-auto"} onClick={() => setSelected("")}>Limpar seleção</button>}
          <button type="button" className={crmControl + " flex w-auto items-center gap-2"} disabled={!detail.length} onClick={() => downloadRows(detail)}><Download size={15} aria-hidden /> Exportar CSV</button>
        </div>
      </div>
      {!detail.length ? <p className="mt-3 text-sm text-zinc-600">Nenhuma oportunidade nesta seleção.</p> :
        <div className="mt-3 max-h-[29rem] overflow-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="sticky top-0 bg-[#f3f7f2] text-xs"><tr>{["Empresa", "Etapa", "Responsável", "Próxima ação", "Valor proposto"].map((label) => <th key={label} className="p-3" scope="col">{label}</th>)}</tr></thead>
            <tbody>{detail.map((row) => <tr key={row.id} className="border-b border-[var(--share-line)] align-top">
              <td className="p-3"><button type="button" className="font-semibold text-[var(--share-green-800)] hover:underline" onClick={() => onOpen(row.id)}>{row.name}</button><p className="text-xs text-zinc-600">{row.segment}</p></td>
              <td className="p-3">{row.stage}</td><td className="p-3">{row.owner ?? "—"}</td>
              <td className="max-w-80 p-3"><span className="block text-xs text-zinc-600">{dateLabel(row.nextActionDate)}</span><p className="line-clamp-2">{row.nextAction}</p></td>
              <td className="whitespace-nowrap p-3">{row.proposedValue === null ? "—" : brl(row.proposedValue)}</td>
            </tr>)}</tbody>
          </table>
        </div>}
    </section>
  </div>;
}
