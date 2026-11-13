import "server-only";
import type { CrmTask as TaskRecord, Prisma } from "@prisma/client";
import type { CrmTask } from "./model";

export const taskOrder = [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }, { id: "asc" }] as const;
export const pendingTask = (opportunityId: string) => ({ opportunityId, status: "Pendente" });

export function serializeTask(task: TaskRecord): CrmTask {
  return {
    id: task.id, opportunityId: task.opportunityId, title: task.title, owner: task.owner, status: task.status as CrmTask["status"],
    dueDate: task.dueDate?.toISOString().slice(0, 10) ?? null, meetingId: task.meetingId,
    resolvedBy: task.resolvedBy, resolvedAt: task.resolvedAt?.toISOString() ?? null,
  };
}

export function firstTask(tx: Prisma.TransactionClient, opportunityId: string) {
  return tx.crmTask.findFirst({ where: pendingTask(opportunityId), orderBy: [...taskOrder] });
}

export async function syncNextAction(tx: Prisma.TransactionClient, id: string, updatedAt: Date) {
  const first = await firstTask(tx, id);
  await tx.crmOpportunity.update({ where: { id }, data: { nextAction: first?.title ?? null, nextActionDate: first?.dueDate ?? null, updatedAt } });
}
