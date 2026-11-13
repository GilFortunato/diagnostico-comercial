import { alertFor, isActive, type ActivitySummary, type CrmFilters, type CrmRow } from "./model";

export const reportLabels = {
  summary: "Reunião de terça", operations: "Operação e SLA", proposals: "Propostas e follow-up",
  meetings: "Gestão de reuniões", segments: "Cobertura por segmento", import: "Conferência da importação",
} as const;

export function resolveReportPeriod(filters: CrmFilters, today: string): CrmFilters {
  if (!filters.period) return filters;
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - (filters.period === "last7" ? 6 : 29));
  return { ...filters, from: start.toISOString().slice(0, 10), to: today };
}

export const proposalStages = ["Proposta enviada", "Negociação"];
const sumProposed = (rows: CrmRow[]) => rows.reduce((sum, row) => sum + (row.proposedValue ?? 0), 0);
const won = (row: CrmRow) => row.contractClosed || row.stage === "Fechado" || row.result === "Vendido";

function groupRows(rows: CrmRow[], key: (row: CrmRow) => string) {
  const groups = new Map<string, CrmRow[]>();
  for (const row of rows) {
    const label = key(row);
    const group = groups.get(label);
    if (group) group.push(row);
    else groups.set(label, [row]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
}

export function operationalReports(rows: CrmRow[], activities: ActivitySummary[], filters: CrmFilters, today: string) {
  const inPeriod = (date: string | null) => date && (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to);
  const active = rows.filter(isActive);
  const status = (row: CrmRow) => alertFor(row, today).label;
  const critical = (row: CrmRow) => alertFor(row, today).tone === "danger";
  const proposals = active.filter((row) => proposalStages.includes(row.stage));
  const quoted = proposals.filter((row) => row.proposedValue !== null);
  const contacted = new Set(activities.filter((a) => a.kind === "Contato" && inPeriod(a.date) && (!filters.channel || a.channel === filters.channel)).map((a) => a.opportunityId));
  const sent = new Set(activities.filter((a) => a.kind === "Proposta enviada" && inPeriod(a.date) && (!filters.channel || a.channel === filters.channel)).map((a) => a.opportunityId));
  return {
    active, proposals, quoted, sent: rows.filter((row) => sent.has(row.id)),
    overdue: active.filter((row) => status(row) === "Atrasado"),
    due: active.filter((row) => status(row) === "Ação hoje"),
    undated: active.filter((row) => !row.nextActionDate),
    unassigned: active.filter((row) => !row.owner?.trim()),
    criticalProposals: proposals.filter(critical),
    total: sumProposed(proposals), ticket: quoted.length ? sumProposed(quoted) / quoted.length : null,
    sla: groupRows(active, status).map(([label, items]) => ({ label, items, value: sumProposed(items) })),
    byOwner: groupRows(proposals, (row) => row.owner || "Sem responsável").map(([label, items]) => ({
      label, items, value: sumProposed(items), critical: items.filter(critical).length,
    })),
    segments: groupRows(rows, (row) => row.segment || "Sem segmento").map(([label, items]) => ({
      label, items, contacted: items.filter((row) => contacted.has(row.id)).length,
      hot: items.filter((row) => row.temperature === "Quente" && isActive(row)).length, won: items.filter(won).length,
    })).sort((a, b) => b.items.length - a.items.length),
    highPriorityMeetings: active.filter((row) => row.stage === "Agendar Reunião" && row.priority === "Alta"),
  };
}
