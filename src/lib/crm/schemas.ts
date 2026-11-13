import { z } from "zod";
import { activityKinds, channels, priorities, reactions, reportPanels, results, stages, temperatures } from "./model";

const date = z.iso.date();
const text = (max = 300) => z.string().trim().max(max);
const field = (max = 300) => text(max).nullable().optional();
const link = z.url({ protocol: /^https?$/ }).max(2000).nullable().optional();
const money = z.number().finite().min(0).max(9999999999999).nullable().optional();

export const opportunityUpdate = z.strictObject({
  stage: z.enum(stages).optional(), temperature: z.enum(temperatures).optional(),
  priority: z.enum(priorities).nullable().optional(), result: z.enum(results).optional(),
  contactStatus: field(), relationship: field(4000), owner: field(), origin: field(),
  channel: field(), project: field(), sponsorship: field(), events: z.array(text()).max(40).optional(),
  nextAction: field(4000), nextActionDate: date.nullable().optional(), proposalDueDate: date.nullable().optional(),
  proposedValue: money, soldValue: money, saleDate: date.nullable().optional(), paymentMethod: field(),
  downPayment: money, installmentCount: z.number().int().min(1).max(120).nullable().optional(),
  notes: field(20000), followUp: field(20000), historicalNotes: field(20000),
  meeting: z.discriminatedUnion("kind", [
    z.strictObject({ id: text().min(1).optional(), kind: z.enum(["Reunião agendada", "Reunião realizada"]), date, note: field(12000) }),
    z.strictObject({ id: text().min(1), kind: z.literal("Reunião cancelada"), note: text(12000).min(1) }),
  ]).optional(),
  proposal: z.strictObject({ sentOn: date, note: field(12000) }).optional(),
  outcomeNote: field(4000),
  version: z.iso.datetime(),
});

export const accountUpdate = z.strictObject({
  name: text().min(1), legalName: field(), segment: field(), employeeRange: field(),
  website: field(2000), linkedinUrl: link, location: field(),
});

export const contactUpdate = z.strictObject({
  id: text().min(1).optional(), name: text().min(1), title: field(), seniority: field(),
  email: field(), phone: field(), linkedinUrl: field(2000), location: field(),
});

export const activityInput = z.strictObject({
  kind: z.enum(activityKinds.filter((kind) => kind !== "Mudança de etapa")),
  date, channel: z.enum(channels).nullable().optional(), reaction: z.enum(reactions).nullable().optional(), note: field(12000),
}).refine((activity) => activity.kind !== "Reação" || Boolean(activity.reaction), "Selecione o tipo de reação.");

export const filtersSchema = z.strictObject({
  search: text(), from: z.union([date, z.literal("")]), to: z.union([date, z.literal("")]),
  owner: text(), segment: text(), stage: text(), channel: text(), event: text(), temperature: text(), sponsorship: text().default(""), panel: z.enum(reportPanels).optional(), period: z.enum(["last7", "last30"]).optional(),
}).refine((f) => !f.from || !f.to || f.from <= f.to, "A data final precisa ser igual ou posterior à inicial.");

export const viewInput = z.strictObject({ name: text(80).min(1), filters: filtersSchema });
export const huntingInput = z.strictObject({
  leadId: text().min(1), searchId: text().min(1).optional(),
  opportunityId: text().min(1).optional(), project: field(), sponsorship: field(), createNew: z.boolean().optional(),
});

export const manualInput = z.strictObject({
  requestId: z.uuid(), company: text().min(1), contact: field(), segment: field(), origin: field(),
  project: field(), sponsorship: field(), owner: field(),
});

const taskFields = { title: text(4000).min(1), dueDate: date, owner: text().min(1) };
export const taskMutation = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("create"), requestId: z.uuid(), ...taskFields }),
  z.strictObject({ kind: z.literal("edit"), id: text().min(1), ...taskFields }),
  z.strictObject({ kind: z.enum(["complete", "cancel", "reopen"]), id: text().min(1) }),
]);

export const taskInput = z.strictObject({ version: z.iso.datetime(), task: taskMutation });
export const importReviewInput = z.strictObject({
  rowNumber: z.number().int().positive(), opportunityId: text().min(1).nullable(), reviewNote: text(4000).min(1),
  reviewedAt: z.iso.datetime().nullable(),
});
