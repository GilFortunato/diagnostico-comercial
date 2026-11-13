import { authorizeModule } from "@/lib/auth/moduleRequest";
import { authorizeCrm, crmError, handleCrmError } from "@/lib/crm/http";
import { huntingInput } from "@/lib/crm/schemas";
import { addHuntingLead } from "@/lib/crm/service";

export async function POST(request: Request) {
  const [crm, hunting] = await Promise.all([authorizeCrm(), authorizeModule("decision.makers")]);
  if (!crm.ok) return crmError(crm.error, crm.status);
  if (!hunting.ok) return crmError(hunting.error, hunting.status);
  const input = huntingInput.safeParse(await request.json().catch(() => null));
  if (!input.success) return crmError("Selecione um resultado válido do B2B Hunting.", 400);
  try {
    return Response.json(await addHuntingLead(input.data, crm.user.name || crm.user.email || "Equipe comercial"));
  } catch (error) { return handleCrmError(error); }
}
