export const stages = [
  "Mapeado", "Primeiro contato", "Em conversa", "Agendar Reunião", "Reunião agendada",
  "Reunião realizada", "Enviar proposta", "Proposta enviada", "Negociação",
  "FUP Futuro", "Fechado", "Perdido", "Concorrente", "Sem resposta",
] as const;
export type CrmStage = (typeof stages)[number];
export const temperatures = ["Frio", "Morno", "Quente"] as const;
export const priorities = ["Alta", "Média", "Baixa"] as const;
export const results = ["Em aberto", "Vendido", "Não vendido", "Sem retorno"] as const;
export const channels = ["LinkedIn", "WhatsApp", "E-mail", "Telefone", "Evento", "Google Meet", "Indicação", "Outro"] as const;
export const activityKinds = ["Contato", "Reação", "Reunião agendada", "Reunião realizada", "Proposta enviada", "Nota", "Mudança de etapa"] as const;
export const reactions = ["Conexão aceita", "Resposta positiva", "Resposta negativa", "Outro retorno"] as const;

export const crmPath = "/diagnostico/crm";
export const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase().replace(/\s+/g, " ");
const brazilDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", dateStyle: "short" });
export const todayInBrazil = (now = new Date()) => brazilDay.format(now);
export const daysBetween = (from: string, to: string) => Math.floor((Date.parse(to) - Date.parse(from)) / 86400000);
export const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export type CrmRow = {
  id: string; legacyId: string | null; name: string; segment: string | null; version: string;
  contactNames: string[]; stage: string; temperature: string; priority: string | null;
  owner: string | null; channel: string | null; project: string | null; sponsorship: string | null; events: string[];
  result: string; contractClosed: boolean; nextAction: string | null; nextActionDate: string | null;
  lastContact: string | null; proposedValue: number | null; soldValue: number | null;
  saleDate: string | null; relationship: string | null;
};

export type ActivitySummary = {
  id: string; opportunityId: string; kind: string; date: string | null;
  channel: string | null; reaction: string | null; stage: string | null;
  meetingLinked?: boolean;
};

export type CrmTask = {
  id: string; opportunityId: string; title: string; owner: string | null; dueDate: string | null;
  status: "Pendente" | "Concluída" | "Cancelada";
  meetingId: string | null; resolvedBy: string | null; resolvedAt: string | null;
};

export type CrmImportReview = {
  rowNumber: number; opportunityId: string | null; data: Record<string, string | number | boolean | null>;
  reviewNote: string | null; reviewedBy: string | null; reviewedAt: string | null;
};

export const reportPanels = ["summary", "operations", "proposals", "meetings", "segments", "import"] as const;
export type ReportPanel = (typeof reportPanels)[number];

export type CrmDetail = {
  tasks?: CrmTask[];
  row: CrmRow;
  account: { name: string; legalName: string | null; segment: string | null; employeeRange: string | null; website: string | null; linkedinUrl: string | null; location: string | null };
  contacts: { id: string; name: string; title: string | null; seniority: string | null; email: string | null; phone: string | null; linkedinUrl: string | null; location: string | null }[];
  activities: (ActivitySummary & { note: string | null; attempt: number | null; actor: string | null })[];
  history: { sheet: string; rowNumber: number; data: Record<string, string | number | boolean | null> }[];
  source: { leadId: string; searchId: string | null; context: unknown }[];
  related: { id: string; stage: string; project: string | null; sponsorship: string | null; contacts: string[] }[];
  contactStatus: string | null; origin: string | null; sponsorship: string | null;
  proposalDueDate: string | null; paymentMethod: string | null; downPayment: number | null;
  installmentCount: number | null; notes: string | null; followUp: string | null; historicalNotes: string | null;
};

export type CrmFilters = { search: string; from: string; to: string; owner: string; segment: string; stage: string; channel: string; event: string; temperature: string; sponsorship: string; panel?: ReportPanel; period?: "last7" | "last30" };
export type ReportView = { id: string; name: string; filters: CrmFilters };
export const emptyFilters: CrmFilters = { search: "", from: "", to: "", owner: "", segment: "", stage: "", channel: "", event: "", temperature: "", sponsorship: "" };

export function isActive(row: Pick<CrmRow, "stage" | "result" | "contractClosed">) {
  return !row.contractClosed && !["Fechado", "Perdido", "Concorrente", "FUP Futuro"].includes(row.stage) && !["Vendido", "Não vendido"].includes(row.result);
}

export function stageOutcome(previous: Pick<CrmRow, "stage" | "result" | "contractClosed">, stage: string, explicitResult?: string) {
  const changed = stage !== previous.stage;
  let result = explicitResult ?? previous.result;
  if (changed && explicitResult === undefined) {
    if (stage === "Fechado") result = "Vendido";
    else if (stage === "Perdido") result = "Não vendido";
    else if (["Fechado", "Perdido"].includes(previous.stage) || previous.contractClosed || ["Vendido", "Não vendido"].includes(previous.result)) result = "Em aberto";
  }
  const contractClosed = changed || explicitResult !== undefined
    ? stage === "Fechado" || result === "Vendido"
    : previous.contractClosed;
  return { stage, result, contractClosed };
}

export function needsNextAction(row: CrmRow, stage: CrmStage) {
  return stage !== row.stage && isActive(stageOutcome(row, stage)) && (!row.nextAction?.trim() || !row.nextActionDate);
}

export const meetingNextAction = "Participar da reunião";

export function alertFor(row: CrmRow, today: string) {
  if (!isActive(row)) return { label: row.contractClosed ? "Ganho" : row.stage, tone: "neutral" };
  if (row.nextActionDate && row.nextActionDate < today) return { label: "Atrasado", tone: "danger" };
  if (row.nextActionDate === today) return { label: "Ação hoje", tone: "warning" };
  const idle = row.lastContact ? daysBetween(row.lastContact, today) : null;
  const critical = row.temperature === "Quente" || row.stage === "Proposta enviada";
  if (idle !== null && idle > (critical ? 7 : 15)) return { label: critical ? "Inatividade crítica" : "Lead inativo", tone: critical ? "danger" : "warning" };
  if (!row.nextActionDate) return { label: "Sem próxima ação", tone: "warning" };
  return { label: row.stage === "Reunião agendada" ? "Reunião agendada" : "Em dia", tone: "ok" };
}

export function installmentPlan(value: number | null, entry: number | null, count: number | null) {
  if (value === null) return null;
  const balanceCents = Math.round(value * 100) - Math.round((entry ?? 0) * 100);
  const installments = count && balanceCents > 0
    ? Array.from({ length: count }, (_, index) => (Math.floor(balanceCents / count) + Number(index < balanceCents % count)) / 100)
    : [];
  return { balance: balanceCents / 100, installments };
}

export function filterRows(rows: CrmRow[], filters: CrmFilters) {
  const query = normalize(filters.search).replace(/^#/, "");
  return rows.filter((row) =>
    (!query || normalize([row.name, row.legacyId, row.owner, row.segment, ...row.contactNames].join(" ")).includes(query)) &&
    (!filters.owner || (row.owner ?? "Sem responsável") === filters.owner) &&
    (!filters.segment || (row.segment ?? "Sem segmento") === filters.segment) &&
    (!filters.stage || row.stage === filters.stage) &&
    (!filters.channel || (row.channel ?? "Sem canal").split(" / ").includes(filters.channel)) &&
    (!filters.event || row.events.includes(filters.event) || row.project === filters.event) &&
    (!filters.temperature || row.temperature === filters.temperature) &&
    (!filters.sponsorship || row.sponsorship === filters.sponsorship));
}
