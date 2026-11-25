export function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export type CommercialLead = {
  origin: string; dinner: boolean; organizer: string; status: string; presence: string;
  inPipe: string; newLead: string; opening: string; lastSale: string; hasSale: string;
  lastActivity: string; recordedInvitation?: string; interaction: string; scheduled: string;
  deadline: string; firstCompleted: string; completed: string;
};

function flag(text: string) {
  const v = normalized(text);
  if (["sim", "s", "yes", "true"].includes(v)) return true;
  if (["nao", "n", "no", "false"].includes(v)) return false;
  return undefined;
}

// Excel dates and Brazilian CRM timestamps express local calendar time.
export function stamp(raw: string, endOfDay = false): number | undefined {
  const text = raw.trim();
  const m = /^(\d{4})-(\d\d)-(\d\d)(?:[ T](\d\d):(\d\d)(?::(\d\d))?)?$/.exec(text)
    ?? /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: (\d{1,2}):(\d\d)(?::(\d\d))?)?$/.exec(text);
  if (!m) return undefined;
  const [year, month, day] = m[1].length === 4 ? [+m[1], +m[2], +m[3]] : [+m[3], +m[2], +m[1]];
  endOfDay = endOfDay && m[4] === undefined;
  const hour = +(m[4] ?? (endOfDay ? 23 : 0)), minute = +(m[5] ?? (endOfDay ? 59 : 0)), second = +(m[6] ?? (endOfDay ? 59 : 0));
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day && hour < 24 && minute < 60 && second < 60) return +date;
}

function anniversary(time: number, months: number) {
  const date = new Date(time);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, end));
  return +date;
}

export function classifyLead(lead: CommercialLead, now: number) {
  const origin = normalized(lead.origin);
  const status = normalized(lead.status);
  const dinnerOrigin = /^(humanship dinner|jantar|jantar humanship|humanship jantar)$/.test(origin);
  const explicitReferral = ["indicacao direta", "indicacoes diretas", "indicacao"].includes(origin);
  // An event roster can record the referrer in Status. That establishes a clue,
  // but only CRM evidence can establish the start or breach of the SLA.
  const referralInStatus = (!origin || dinnerOrigin) && /^indicacao(?: |$)/.test(status);
  const event = ["grande evento", "grandes eventos"].includes(origin);
  const isNew = flag(lead.newLead);
  const deadline = stamp(lead.deadline, true);
  const verifyReferral = referralInStatus && isNew !== true && deadline === undefined;
  const applicable = isNew !== false || deadline !== undefined;
  const sla = applicable && (explicitReferral || referralInStatus) ? "24 horas úteis" :
    applicable && event ? "5 dias úteis" : "";
  const completion = stamp(lead.firstCompleted);
  const done = completion !== undefined && completion <= now;
  const missed = !!sla && deadline !== undefined && now > deadline && !done && flag(lead.completed) === false && !lead.firstCompleted.trim();
  const slaState = !sla ? "" : verifyReferral ? "Aplicável se a indicação for um novo lead. Confirmar entrada e atendimento no Pipedrive" : done ? (deadline === undefined ? "Concluída · conferir prazo" : completion <= deadline ? "Cumprido" : "Concluída após o prazo") :
    missed ? "Vencido sem atendimento" : !deadline ? "Conferir vencimento no Pipedrive" : flag(lead.completed) === false && !lead.firstCompleted.trim() ? "Em prazo" : "Verificar atividade concluída";
  const result = (order: number, decision: string, reason: string, action: string, owner = "") => ({ order, decision, reason, action, owner, sla, slaState });
  const dinner = dinnerOrigin || (!origin && lead.dinner);
  const pipe = flag(lead.inPipe);
  const open = stamp(lead.opening), sale = stamp(lead.lastSale, true);
  const lastRecorded = stamp(lead.lastActivity, true);
  const activityDates = [lastRecorded, stamp(lead.recordedInvitation ?? "", true), completion]
    .filter((time): time is number => time !== undefined);
  const last = activityDates.length ? Math.max(...activityDates) : undefined;
  const past = (date: number | undefined) => date !== undefined && date <= now;
  const none = flag(lead.interaction) === false && !lead.lastActivity.trim() &&
    !lead.recordedInvitation?.trim() && !lead.firstCompleted.trim() && flag(lead.completed) !== true;
  const existing = isNew === false || pipe === true || past(open) || past(sale);
  const attended = flag(lead.presence) ?? (["presente", "compareceu", "participou"].includes(normalized(lead.status)) ? true : undefined);
  const toOrganizer = (reason: string) => result(2, "Prioridade do organizador", reason, lead.organizer ? "Encaminhar ao organizador do jantar." : "Identificar o organizador do jantar e encaminhar.", lead.organizer);
  if (missed) return result(0, "Redistribuir por SLA", "Prazo expirado e ausência de atividade concluída informada.", "Retornar à fila geral ou redistribuir a outro executivo.");
  if (sla && done && deadline !== undefined && completion > deadline) return result(0, "Revisar redistribuição por SLA", "O primeiro atendimento foi concluído depois do vencimento.", "Verificar a redistribuição prevista para o descumprimento no Pipedrive.");
  if (dinner && (isNew === true || (pipe === false && !existing)) && !past(sale)) return toOrganizer("Lead identificado como novo para o jantar.");
  const inactiveFrom = past(lastRecorded) && past(last) ? last : none && past(open) ? open : undefined;
  if (dinner && existing && attended && inactiveFrom !== undefined && now > anniversary(inactiveFrom, 6))
    return toOrganizer("Presença registrada e mais de seis meses sem atividade, considerando também o convite.");
  if (past(sale) && sale !== undefined && now > anniversary(sale, 12) && (none || (past(lastRecorded) && last !== undefined && last <= sale)) && flag(lead.scheduled) === false)
    return result(1, "Liberar para reativação", "Última venda há mais de um ano, sem interação posterior nem atividade agendada.", "Liberar a conta para reativação por outro executivo.");
  if (open !== undefined && now - open >= 90 * 86400000 && flag(lead.hasSale) === false && !lead.lastSale.trim() && none && flag(lead.scheduled) === false)
    return result(1, "Redistribuir por inatividade", "Lead aberto há pelo menos 90 dias, sem venda, interação ou atividade agendada.", "Redistribuir para outro executivo ou fila de resgate.");
  if (sla && verifyReferral) return result(3, "Validar indicação e SLA", "O status identifica uma indicação.", "Conferir se é um novo lead, a data de entrada e a primeira atividade concluída no Pipedrive.");
  if (sla) return result(done ? 5 : 3, done ? "Atendimento registrado" : "Primeiro atendimento", "Origem informada: " + lead.origin + ".", done ? "Conferir o SLA registrado." : "Registrar a abordagem como atividade concluída no Pipedrive.");
  if (dinner && existing && attended && past(last) && inactiveFrom !== undefined && now <= anniversary(inactiveFrom, 6))
    return result(5, "Manter titularidade", "Há atividade registrada nos últimos seis meses.", "Manter o acompanhamento com o titular.");
  if (dinner && !existing) return result(4, "Validar cadastro", "Falta identificar se o contato é novo ou já pertence à base.", "Consultar o Pipedrive. Se for novo do jantar, encaminhar ao organizador.");
  if (dinner && attended !== true) return result(4, "Validar participação e histórico", "O cadastro não comprova presença e inatividade no jantar.", "Conferir a lista de presença e a última atividade no Pipedrive, incluindo o convite.");
  return result(4, "Validar histórico", "Os dados disponíveis não comprovam uma regra de transferência.", "Conferir abertura, vendas, interações e atividades agendadas no Pipedrive.");
}
