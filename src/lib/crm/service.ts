import "server-only";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { getPrisma } from "@/lib/db/prisma";
import { isActive, meetingNextAction, normalize, stageOutcome, todayInBrazil, type CrmDetail, type CrmFilters, type CrmImportReview } from "./model";
import type { accountUpdate, activityInput, contactUpdate, huntingInput, manualInput, opportunityUpdate, taskInput, importReviewInput } from "./schemas";

import { firstTask, pendingTask, serializeTask, syncNextAction, taskOrder } from "./tasks";

const day = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;
const money = (value: Prisma.Decimal | null) => value === null ? null : Number(value);
const date = (value: string | null | undefined) => value === undefined ? undefined : value ? new Date(value) : null;
const contactSummary = { select: { contact: { select: { name: true } } } } as const;
const listInclude = {
  account: { select: { name: true, segment: true } },
  contacts: contactSummary,
} satisfies Prisma.CrmOpportunityInclude;
type Opportunity = Prisma.CrmOpportunityGetPayload<{ include: typeof listInclude }>;
type Tx = Prisma.TransactionClient;

export class CrmError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

function crmRow(opp: Opportunity, lastContact: Date | null) {
  return {
    id: opp.id, legacyId: opp.legacyId, version: opp.updatedAt.toISOString(), name: opp.account.name, segment: opp.account.segment,
    contactNames: opp.contacts.map(({ contact }) => contact.name), stage: opp.stage, temperature: opp.temperature,
    priority: opp.priority, owner: opp.owner, channel: opp.channel, project: opp.project, sponsorship: opp.sponsorship, events: opp.events,
    result: opp.result, contractClosed: opp.contractClosed, nextAction: opp.nextAction,
    nextActionDate: day(opp.nextActionDate), lastContact: day(lastContact), proposedValue: money(opp.proposedValue),
    soldValue: money(opp.soldValue), saleDate: day(opp.saleDate), relationship: opp.relationship,
  };
}

export async function listCrm(userId: string) {
  const db = getPrisma();
  const [opportunities, activities, views, sourceCount, tasks] = await Promise.all([
    db.crmOpportunity.findMany({ include: listInclude, orderBy: [{ updatedAt: "desc" }, { id: "asc" }] }),
    db.crmActivity.findMany({ select: { id: true, opportunityId: true, kind: true, date: true, channel: true, reaction: true, stage: true, sourceKey: true, reminder: { select: { id: true } } } }),
    db.crmReportView.findMany({ where: { userId }, select: { id: true, name: true, filters: true }, orderBy: { name: "asc" } }),
    db.crmOpportunity.count({ where: { sourceKey: { startsWith: "humanship-pipeline-2026:" } } }),
    db.crmTask.findMany({ orderBy: [...taskOrder] }),
  ]);
  const lastContacts = new Map<string, Date>();
  for (const activity of activities) {
    if (activity.kind !== "Contato" || !activity.date) continue;
    const previous = lastContacts.get(activity.opportunityId);
    if (!previous || previous < activity.date) lastContacts.set(activity.opportunityId, activity.date);
  }
  return {
    rows: opportunities.map((opp) => crmRow(opp, lastContacts.get(opp.id) ?? null)),
    activities: activities.map(({ sourceKey, reminder, ...activity }) => ({ ...activity, date: day(activity.date), meetingLinked: Boolean(reminder || sourceKey?.startsWith("crm-meeting:")) })),
    views: views.map((view) => ({ ...view, filters: view.filters as CrmFilters })),
    sourceCount,
    tasks: tasks.map(serializeTask),
  };
}

export async function getCrmDetail(id: string): Promise<(CrmDetail & { version: string }) | null> {
  const db = getPrisma();
  const [opp, history] = await Promise.all([
    db.crmOpportunity.findUnique({
      where: { id },
      include: { account: true, tasks: { orderBy: [...taskOrder] }, contacts: { include: { contact: true } }, activities: {
        include: { reminder: { select: { id: true } } },
        orderBy: [{ date: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      }, huntingLinks: { select: { leadId: true, searchId: true, context: true } } },
    }),
    db.crmImportRow.findMany({ where: { opportunityId: id }, orderBy: { rowNumber: "asc" } }),
  ]);
  if (!opp) return null;
  const related = await db.crmOpportunity.findMany({
    where: { accountId: opp.accountId, id: { not: id } },
    select: { id: true, stage: true, project: true, sponsorship: true, contacts: contactSummary },
    orderBy: { updatedAt: "desc" },
  });
  return {
    row: crmRow(opp, opp.activities.find((activity) => activity.kind === "Contato" && activity.date)?.date ?? null),
    tasks: opp.tasks.map(serializeTask),
    account: opp.account, contacts: opp.contacts.map(({ contact }) => contact),
    activities: opp.activities.map(({ sourceKey, reminder, ...activity }) => ({ ...activity, date: day(activity.date), meetingLinked: Boolean(reminder || sourceKey?.startsWith("crm-meeting:")) })),
    history: history.map((record) => ({ ...record, data: record.data as CrmDetail["history"][number]["data"] })),
    source: opp.huntingLinks, related: related.map((item) => ({ ...item, contacts: item.contacts.map(({ contact }) => contact.name) })),
    contactStatus: opp.contactStatus, origin: opp.origin, sponsorship: opp.sponsorship,
    proposalDueDate: day(opp.proposalDueDate), paymentMethod: opp.paymentMethod, downPayment: money(opp.downPayment),
    installmentCount: opp.installmentCount, notes: opp.notes, followUp: opp.followUp, historicalNotes: opp.historicalNotes,
    version: opp.updatedAt.toISOString(),
  };
}

const versionConflict = "A ficha foi atualizada por outra pessoa. Reabra e tente novamente.";

async function lockOpportunity(tx: Tx, id: string, version: string) {
  const previous = await tx.crmOpportunity.findUnique({ where: { id } });
  if (!previous) throw new CrmError("Oportunidade não encontrada.", 404);
  const expected = new Date(version);
  if (+previous.updatedAt !== +expected) throw new CrmError(versionConflict, 409);
  const lockedAt = new Date(Math.max(Date.now(), +previous.updatedAt + 1));
  const locked = await tx.crmOpportunity.updateMany({
    where: { id, updatedAt: expected }, data: { updatedAt: lockedAt },
  });
  if (!locked.count) throw new CrmError(versionConflict, 409);
  return { ...previous, lockedAt };
}

type Meeting = NonNullable<z.infer<typeof opportunityUpdate>["meeting"]>;

async function saveMeeting(tx: Tx, id: string, meeting: Meeting, owner: string | null, actor: string, today: Date) {
  const scheduled = meeting.id ? await tx.crmActivity.findFirst({
    where: { id: meeting.id, opportunityId: id, kind: "Reunião agendada" },
  }) : null;
  if (meeting.id && !scheduled) throw new CrmError("O agendamento mudou. Atualize a lista e tente novamente.", 409);
  const base = { opportunityId: id, actor };
  if (meeting.kind === "Reunião cancelada") {
    await tx.crmActivity.update({ where: { id: meeting.id }, data: { kind: "Agendamento cancelado" } });
    await tx.crmTask.updateMany({ where: { ...pendingTask(id), meetingId: meeting.id }, data: { status: "Cancelada", resolvedAt: new Date(), resolvedBy: actor } });
    return { ...base, kind: meeting.kind, date: today, note: [day(scheduled?.date ?? null), meeting.note].filter(Boolean).join(" · ") };
  }
  const meetingDate = new Date(meeting.date);
  if (meeting.kind === "Reunião realizada") {
    if (meetingDate > today) throw new CrmError("A data de realização da reunião não pode estar no futuro.");
    if (scheduled) {
      await tx.crmActivity.update({ where: { id: scheduled.id }, data: { kind: "Agendamento concluído" } });
      await tx.crmTask.updateMany({ where: { ...pendingTask(id), meetingId: scheduled.id }, data: { status: "Concluída", resolvedAt: new Date(), resolvedBy: actor } });
    }
    return { ...base, kind: meeting.kind, date: meetingDate, note: meeting.note, ...(scheduled ? { sourceKey: "crm-meeting:" + scheduled.id } : {}) };
  }
  const activity = scheduled
    ? await tx.crmActivity.update({ where: { id: scheduled.id }, data: { date: meetingDate, note: meeting.note } })
    : await tx.crmActivity.create({ data: { ...base, kind: meeting.kind, date: meetingDate, note: meeting.note } });
  await tx.crmTask.upsert({
    where: { meetingId: activity.id },
    create: { opportunityId: id, meetingId: activity.id, title: meetingNextAction, dueDate: meetingDate, owner },
    update: { dueDate: meetingDate, status: "Pendente", resolvedAt: null, resolvedBy: null },
  });
  if (scheduled && day(scheduled.date) !== meeting.date) {
    return { ...base, kind: "Reunião reagendada", date: today, note: (day(scheduled.date) ?? "Sem data") + " → " + meeting.date };
  }
}

function describeAction(label: string | null, due: Date | null) {
  return [label, day(due)?.split("-").reverse().join("/")].filter(Boolean).join(" · ") || "Sem próxima ação";
}

export async function updateCrmOpportunity(id: string, input: z.infer<typeof opportunityUpdate>, actor: string) {
  const { version, nextAction, nextActionDate, proposalDueDate, saleDate, meeting, proposal, outcomeNote, ...values } = input;
  await getPrisma().$transaction(async (tx) => {
    const previous = await lockOpportunity(tx, id, version);
    const scheduledCount = meeting?.kind === "Reunião cancelada"
      ? await tx.crmActivity.count({ where: { opportunityId: id, kind: "Reunião agendada" } }) : 0;
    const requestedStage = scheduledCount > 1 ? previous.stage : values.stage ?? previous.stage;
    const { stage, result, contractClosed } = stageOutcome(previous, requestedStage, values.result);
    const stageChanged = stage !== previous.stage;
    const today = new Date(todayInBrazil());
    const owner = values.owner === undefined ? previous.owner : values.owner;
    const log: Prisma.CrmActivityCreateManyInput[] = [];
    if (meeting) {
      const entry = await saveMeeting(tx, id, meeting, owner, actor, today);
      if (entry) log.push(entry);
    }
    const action = nextAction === undefined ? previous.nextAction : nextAction || null;
    const nextDate = nextActionDate === undefined ? previous.nextActionDate : date(nextActionDate) ?? null;
    const actionChanged = action !== previous.nextAction || day(nextDate) !== day(previous.nextActionDate);
    if (actionChanged && meeting?.kind !== "Reunião agendada") {
      const current = await firstTask(tx, id);
      const replaceCurrent = !meeting && current && !current.meetingId;
      if (action || nextDate) {
        const fields = { title: action || "Próxima ação", dueDate: nextDate };
        if (replaceCurrent) await tx.crmTask.update({ where: { id: current.id }, data: fields });
        else await tx.crmTask.create({ data: { opportunityId: id, owner: owner || actor, ...fields } });
      } else if (replaceCurrent) {
        await tx.crmTask.update({ where: { id: current.id }, data: { status: "Cancelada", resolvedAt: new Date(), resolvedBy: actor } });
      }
      log.push({ opportunityId: id, kind: "Próxima ação atualizada", date: today, actor, note: describeAction(previous.nextAction, previous.nextActionDate) + "\n→ " + describeAction(action, nextDate) });
    }
    const next = await firstTask(tx, id);
    if (stageChanged && isActive({ stage, result, contractClosed }) && meeting?.kind !== "Reunião cancelada" && !next?.dueDate) {
      throw new CrmError("Informe a próxima ação e a data antes de avançar uma oportunidade ativa.");
    }
    if (stageChanged) log.push({ opportunityId: id, kind: "Mudança de etapa", date: today, stage, actor, note: previous.stage + " → " + stage });
    if (values.result === "Vendido" && saleDate && new Date(saleDate) > today) throw new CrmError("A data do fechamento não pode estar no futuro.");
    if (outcomeNote) log.push({ opportunityId: id, kind: "Resultado da proposta", date: today, actor, note: outcomeNote });
    if (proposal) {
      const sentOn = new Date(proposal.sentOn);
      if (sentOn > today) throw new CrmError("A data de envio da proposta não pode estar no futuro.");
      const existing = await tx.crmActivity.findFirst({ where: { opportunityId: id, kind: "Proposta enviada", date: sentOn } });
      if (existing) await tx.crmActivity.update({ where: { id: existing.id }, data: { note: proposal.note } });
      else log.push({ opportunityId: id, kind: "Proposta enviada", date: sentOn, channel: values.channel === undefined ? previous.channel : values.channel, actor, note: proposal.note });
    }
    await tx.crmOpportunity.update({ where: { id }, data: {
      ...values, result, contractClosed, nextAction: next?.title ?? null, nextActionDate: next?.dueDate ?? null,
      proposalDueDate: date(proposalDueDate), saleDate: date(saleDate), updatedAt: previous.lockedAt,
    } });
    if (log.length) await tx.crmActivity.createMany({ data: log });
  });
}

export async function updateCrmTask(id: string, input: z.infer<typeof taskInput>, actor: string) {
  const { task } = input;
  await getPrisma().$transaction(async (tx) => {
    if (task.kind === "create") {
      const duplicate = await tx.crmTask.findUnique({ where: { requestId: task.requestId } });
      if (duplicate?.opportunityId === id && duplicate.title === task.title && duplicate.owner === task.owner && day(duplicate.dueDate) === task.dueDate) return;
      if (duplicate) throw new CrmError("Já existe uma tarefa com esse identificador.", 409);
    }
    const { lockedAt } = await lockOpportunity(tx, id, input.version);
    let title: string;
    let kind: string;
    if (task.kind === "create") {
      title = task.title;
      kind = "Tarefa criada";
      await tx.crmTask.create({ data: {
        opportunityId: id, requestId: task.requestId, title, owner: task.owner, dueDate: new Date(task.dueDate),
      } });
    } else {
      const current = await tx.crmTask.findFirst({ where: { id: task.id, opportunityId: id } });
      if (!current) throw new CrmError("Tarefa não encontrada.", 404);
      if (current.meetingId) throw new CrmError("Atualize este lembrete pela aba Reuniões.");
      title = current.title;
      if (task.kind === "edit") {
        if (current.status !== "Pendente") throw new CrmError("Reabra a tarefa antes de editar.");
        kind = "Tarefa atualizada";
        title = [
          describeAction(current.title, current.dueDate) + " · " + (current.owner ?? "Sem responsável"),
          describeAction(task.title, new Date(task.dueDate)) + " · " + task.owner,
        ].join("\n→ ");
        await tx.crmTask.update({ where: { id: current.id }, data: { title: task.title, owner: task.owner, dueDate: new Date(task.dueDate) } });
      } else {
        const status = { complete: "Concluída", cancel: "Cancelada", reopen: "Pendente" }[task.kind];
        if (current.status === status) return;
        if (task.kind !== "reopen" && current.status !== "Pendente") throw new CrmError("A tarefa já foi encerrada.");
        kind = { complete: "Tarefa concluída", cancel: "Tarefa cancelada", reopen: "Tarefa reaberta" }[task.kind];
        await tx.crmTask.update({ where: { id: current.id }, data: {
          status, resolvedAt: task.kind === "reopen" ? null : new Date(), resolvedBy: task.kind === "reopen" ? null : actor,
        } });
      }
    }
    await syncNextAction(tx, id, lockedAt);
    await tx.crmActivity.create({ data: { opportunityId: id, kind, actor, date: new Date(todayInBrazil()), note: title } });
  });
}

export async function listCrmImportReview(): Promise<CrmImportReview[]> {
  const rows = await getPrisma().crmImportRow.findMany({
    where: { sheet: "Página3" }, orderBy: { rowNumber: "asc" },
    select: { rowNumber: true, data: true, opportunityId: true, reviewNote: true, reviewedAt: true, reviewedBy: true },
  });
  return rows.map((row) => ({ ...row, reviewedAt: row.reviewedAt?.toISOString() ?? null, data: row.data as CrmImportReview["data"] }));
}

export async function reviewCrmImport(input: z.infer<typeof importReviewInput>, actor: string) {
  await getPrisma().$transaction(async (tx) => {
    const { rowNumber, opportunityId, reviewNote, reviewedAt } = input;
    if (opportunityId && !await tx.crmOpportunity.findUnique({ where: { id: opportunityId }, select: { id: true } })) {
      throw new CrmError("Oportunidade não encontrada.", 404);
    }
    const reviewTime = new Date(Math.max(Date.now(), reviewedAt ? Date.parse(reviewedAt) + 1 : 0));
    const updated = await tx.crmImportRow.updateMany({
      where: { sheet: "Página3", rowNumber, reviewedAt: date(reviewedAt) },
      data: { opportunityId, reviewNote, reviewedBy: actor, reviewedAt: reviewTime },
    });
    if (!updated.count) throw new CrmError("Este registro já mudou. Atualize a conferência.", 409);
  });
  return listCrmImportReview();
}

export async function updateCrmAccount(id: string, input: z.infer<typeof accountUpdate>) {
  const opportunity = await getPrisma().crmOpportunity.findUnique({ where: { id }, select: { accountId: true } });
  if (!opportunity) throw new CrmError("Oportunidade não encontrada.", 404);
  await getPrisma().crmAccount.update({ where: { id: opportunity.accountId }, data: { ...input, identityKey: normalize(input.name) } });
}

export async function updateCrmContact(id: string, input: z.infer<typeof contactUpdate>) {
  const { id: contactId, ...values } = input;
  await getPrisma().$transaction(async (tx) => {
    const opportunity = await tx.crmOpportunity.findUnique({ where: { id }, select: { accountId: true } });
    if (!opportunity) throw new CrmError("Oportunidade não encontrada.", 404);
    if (contactId) {
      const link = await tx.crmOpportunityContact.findUnique({ where: { opportunityId_contactId: { opportunityId: id, contactId } } });
      if (!link) throw new CrmError("Contato não encontrado nesta oportunidade.", 404);
      await tx.crmContact.update({ where: { id: contactId }, data: values });
      return;
    }
    const contact = await upsertContact(tx, opportunity.accountId, values);
    await tx.crmOpportunityContact.createMany({ data: [{ opportunityId: id, contactId: contact.id }], skipDuplicates: true });
  });
}

async function upsertContact(tx: Tx, accountId: string, values: Omit<z.infer<typeof contactUpdate>, "id">) {
  const identityKey = normalize(values.name);
  const matches = await tx.crmContact.findMany({ where: { accountId }, select: { id: true, name: true, email: true, linkedinUrl: true, phone: true, title: true, seniority: true, location: true } });
  const existing = matches.find((contact) =>
    (values.email && contact.email?.toLowerCase() === values.email.toLowerCase()) ||
    (values.linkedinUrl && normalizedUrl(contact.linkedinUrl) === normalizedUrl(values.linkedinUrl)) ||
    normalize(contact.name) === identityKey);
  if (existing) {
    return tx.crmContact.update({ where: { id: existing.id }, data: {
      email: existing.email || values.email, phone: existing.phone || values.phone, linkedinUrl: existing.linkedinUrl || values.linkedinUrl,
      title: existing.title || values.title, seniority: existing.seniority || values.seniority, location: existing.location || values.location,
    } });
  }
  return tx.crmContact.upsert({ where: { accountId_identityKey: { accountId, identityKey } }, create: { ...values, accountId, identityKey }, update: {} });
}

export async function addCrmActivity(id: string, input: z.infer<typeof activityInput>, actor: string) {
  await getPrisma().$transaction(async (tx) => {
    const opp = await tx.crmOpportunity.updateMany({ where: { id }, data: { updatedAt: new Date() } });
    if (!opp.count) throw new CrmError("Oportunidade não encontrada.", 404);
    const attempt = input.kind === "Contato" ? (await tx.crmActivity.aggregate({
      where: { opportunityId: id, kind: "Contato" }, _max: { attempt: true },
    }))._max.attempt ?? 0 : null;
    await tx.crmActivity.create({ data: { ...input, date: new Date(input.date), opportunityId: id, actor, attempt: attempt === null ? null : attempt + 1 } });
  });
}

function normalizedUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, "").toLowerCase() + url.pathname.replace(/\/$/, "").toLowerCase();
  } catch { return null; }
}

function domain(value?: string | null) {
  if (!value) return null;
  try { return new URL(value.includes("://") ? value : "https://" + value).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return null; }
}

function payloadObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
const asText = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;

export async function addHuntingLead(input: z.infer<typeof huntingInput>, actor: string) {
  const db = getPrisma();
  const lead = await db.b2BLead.findUnique({ where: { id: input.leadId } });
  if (!lead) throw new CrmError("Lead do Hunting não encontrado.", 404);
  const searchId = input.searchId
    ? (await db.b2BSearchLead.findUnique({ where: { searchId_leadId: { searchId: input.searchId, leadId: lead.id } }, select: { searchId: true } }))?.searchId
    : undefined;
  const info = payloadObject(lead.payload);
  const person = lead.kind === "person";
  const company = (person ? lead.companyName : lead.name)?.trim();
  if (!company) throw new CrmError("O resultado do Hunting precisa de uma empresa identificada.");
  const identityKey = normalize(company);
  const companyUrl = person ? null : lead.linkedinUrl;
  const host = domain(lead.domain ?? lead.website);
  const accountOptions = await db.crmAccount.findMany({ select: { id: true, name: true, identityKey: true, website: true, linkedinUrl: true } });
  const match = accountOptions.find((account) => account.identityKey === identityKey)
    ?? accountOptions.find((account) => (host && domain(account.website) === host) || (companyUrl && normalizedUrl(account.linkedinUrl) === normalizedUrl(companyUrl)));
  const previous = await db.crmHuntingLink.findFirst({ where: { leadId: lead.id }, orderBy: { createdAt: "asc" } });
  if (previous && !input.createNew && !input.opportunityId) return { id: previous.opportunityId };
  if (match && !input.createNew && !input.opportunityId) {
    const existing = await db.crmOpportunity.findMany({
      where: { accountId: match.id }, select: { id: true, stage: true, project: true, sponsorship: true, contacts: contactSummary },
      orderBy: { updatedAt: "desc" },
    });
    if (existing.length) return { choices: existing.map((item) => ({ ...item, contacts: item.contacts.map(({ contact }) => contact.name) })), company: match.name };
  }
  return db.$transaction(async (tx) => {
    const account = match ?? await tx.crmAccount.upsert({
      where: { identityKey },
      create: { identityKey, name: company, segment: asText(info.industry), employeeRange: asText(info.employeeRange),
        website: lead.website, linkedinUrl: companyUrl, location: person ? null : lead.location },
      update: {},
    });
    let id = input.opportunityId;
    if (id) {
      const target = await tx.crmOpportunity.findUnique({ where: { id }, select: { accountId: true } });
      if (target?.accountId !== account.id) throw new CrmError("Selecione uma oportunidade da empresa encontrada.", 409);
    } else {
      const project = input.project || null;
      const sponsorship = input.sponsorship || null;
      const sourceKey = ["hunting", lead.id, normalize(project ?? ""), normalize(sponsorship ?? "")].map(encodeURIComponent).join(":");
      const target = await tx.crmOpportunity.upsert({
        where: { sourceKey },
        create: { sourceKey, accountId: account.id, origin: "B2B Hunting", channel: "LinkedIn", owner: actor, project, sponsorship },
        update: {},
      });
      id = target.id;
    }
    if (person) {
      const contact = await upsertContact(tx, account.id, {
        name: lead.name, title: lead.title, email: asText(info.professionalEmail), phone: asText(info.professionalPhone),
        seniority: asText(info.seniority), linkedinUrl: lead.linkedinUrl, location: lead.location,
      });
      await tx.crmOpportunityContact.createMany({ data: [{ opportunityId: id, contactId: contact.id }], skipDuplicates: true });
    }
    await tx.crmHuntingLink.createMany({ data: [{
      leadId: lead.id, opportunityId: id, searchId: searchId ?? lead.firstSeenSearchId,
      context: { fit: asText(info.fit), fitReasons: Array.isArray(info.fitReasons) ? info.fitReasons.filter((value): value is string => typeof value === "string") : [], source: asText(info.source) },
    }], skipDuplicates: true });
    return { id };
  });
}

export async function createManualOpportunity(input: z.infer<typeof manualInput>, userId: string, actor: string) {
  return getPrisma().$transaction(async (tx) => {
    const identityKey = normalize(input.company);
    const account = await tx.crmAccount.upsert({
      where: { identityKey }, update: {},
      create: { identityKey, name: input.company, segment: input.segment },
    });
    const sourceKey = "manual:" + userId + ":" + input.requestId;
    const opportunity = await tx.crmOpportunity.upsert({
      where: { sourceKey }, update: {},
      create: { sourceKey, accountId: account.id, origin: input.origin, project: input.project, sponsorship: input.sponsorship, owner: input.owner || actor },
    });
    if (input.contact && opportunity.accountId === account.id) {
      const contact = await upsertContact(tx, account.id, { name: input.contact });
      await tx.crmOpportunityContact.createMany({ data: [{ opportunityId: opportunity.id, contactId: contact.id }], skipDuplicates: true });
    }
    return { id: opportunity.id };
  });
}
