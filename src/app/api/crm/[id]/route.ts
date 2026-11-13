import { z } from "zod";
import { authorizeCrm, crmError, handleCrmError } from "@/lib/crm/http";
import { accountUpdate, activityInput, contactUpdate, opportunityUpdate, taskInput } from "@/lib/crm/schemas";
import { addCrmActivity, getCrmDetail, updateCrmAccount, updateCrmContact, updateCrmOpportunity, updateCrmTask } from "@/lib/crm/service";

const mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("opportunity"), data: opportunityUpdate, taskInput }),
  z.object({ action: z.literal("account"), data: accountUpdate }),
  z.object({ action: z.literal("contact"), data: contactUpdate }),
  z.object({ action: z.literal("activity"), data: activityInput }),
  z.object({ action: z.literal("task"), data: taskInput }),
]);

export async function GET(_request: Request, { params }: RouteContext<"/api/crm/[id]">) {
  const access = await authorizeCrm();
  if (!access.ok) return crmError(access.error, access.status);
  try {
    const detail = await getCrmDetail((await params).id);
    return detail ? Response.json(detail, { headers: { "Cache-Control": "private, no-store" } }) : crmError("Oportunidade não encontrada.", 404);
  } catch (error) { return handleCrmError(error); }
}

export async function PATCH(request: Request, { params }: RouteContext<"/api/crm/[id]">) {
  const access = await authorizeCrm();
  if (!access.ok) return crmError(access.error, access.status);
  const input = mutation.safeParse(await request.json().catch(() => null));
  if (!input.success) return crmError(input.error.issues[0]?.message || "Dados inválidos.", 400);
  const { id } = await params;
  const { action, data } = input.data;
  const actor = access.user.name || access.user.email || "Equipe comercial";
  try {
    if (action === "opportunity") await updateCrmOpportunity(id, data, actor);
    if (action === "account") await updateCrmAccount(id, data);
    if (action === "contact") await updateCrmContact(id, data);
    if (action === "activity") await addCrmActivity(id, data, actor);
    if (action === "task") await updateCrmTask(id, data, actor);
    return Response.json(await getCrmDetail(id));
  } catch (error) { return handleCrmError(error); }
}
