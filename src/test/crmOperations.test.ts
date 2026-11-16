import { strict as assert } from "node:assert";
import { test } from "node:test";
import { commercialMetrics } from "../lib/crm/analytics";
import { emptyFilters, stageOutcome, type ActivitySummary, type CrmRow } from "../lib/crm/model";
import { operationalReports, resolveReportPeriod } from "../lib/crm/reports";
import { crmMutation } from "../lib/crm/schemas";

const today = "2026-11-13";
const row: CrmRow = {
  id: "opp", legacyId: null, name: "Patrocinador", segment: "Tecnologia", version: today,
  contactNames: [], stage: "Proposta enviada", temperature: "Morno", priority: null,
  owner: "Comercial", channel: "LinkedIn", project: "Festival", sponsorship: "Anual",
  events: ["Festival", "Conferência"], result: "Em aberto", contractClosed: false,
  nextAction: "Retornar", nextActionDate: "2026-11-10", lastContact: "2026-11-09",
  proposedValue: 12000, soldValue: null, saleDate: null, relationship: null,
};

const activity = (id: string, kind: string, date: string, meetingLinked = false): ActivitySummary => ({
  id, opportunityId: row.id, kind, date, channel: "LinkedIn", reaction: null, stage: null, meetingLinked,
});

test("Kanban stage changes accept opportunity data without a task payload", () => {
  const version = "2026-11-16T12:00:00.000Z";
  const move = { action: "opportunity", data: { stage: "Em conversa", version } };
  assert.deepEqual(crmMutation.parse(move), move);

  const moveWithNextAction = {
    ...move,
    data: { ...move.data, nextAction: "Retornar ao decisor", nextActionDate: "2026-11-17" },
  };
  assert.deepEqual(crmMutation.parse(moveWithNextAction), moveWithNextAction);
  assert.equal(crmMutation.safeParse({ ...move, data: { stage: "Em conversa" } }).success, false);
  assert.equal(crmMutation.safeParse({ ...move, action: "task" }).success, false);
});

test("completing a meeting keeps another explicitly scheduled meeting visible", () => {
  const agenda = [
    activity("held", "Reunião realizada", today),
    activity("legacy", "Reunião agendada", today),
    activity("current", "Reunião agendada", today, true),
    activity("canceled", "Agendamento cancelado", "2026-11-14", true),
    activity("complete", "Agendamento concluído", "2026-11-14", true),
  ];
  const metrics = commercialMetrics([row], agenda, emptyFilters, today);
  assert.equal(metrics.held, 1);
  assert.deepEqual(metrics.upcomingMeetings.map((item) => item.id), ["current"]);
});

test("proposal totals count packages once and average only defined values", () => {
  const rows = [
    row,
    { ...row, id: "no-amount", stage: "Negociação", proposedValue: null },
    { ...row, id: "sold", contractClosed: true },
  ];
  const report = operationalReports(rows, [activity("send", "Proposta enviada", today)], emptyFilters, today);
  assert.equal(report.total, 12000);
  assert.equal(report.ticket, 12000);
  assert.equal(report.proposals.length, 2);
  assert.equal(report.criticalProposals.length, 2);
  assert.deepEqual(report.sent.map((item) => item.id), ["opp"]);
});

test("relative reports recompute their inclusive period and a legacy won opportunity can be reopened", () => {
  const view = { ...emptyFilters, period: "last7" } as const;
  assert.equal(resolveReportPeriod(view, today).from, "2026-11-07");
  assert.equal(resolveReportPeriod(view, "2026-11-20").from, "2026-11-14");
  assert.deepEqual(stageOutcome({ ...row, contractClosed: true }, "Em conversa"), {
    stage: "Em conversa", result: "Em aberto", contractClosed: false,
  });
});
