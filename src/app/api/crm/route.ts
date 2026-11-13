import { authorizeCrm, crmError, handleCrmError } from "@/lib/crm/http";
import { manualInput } from "@/lib/crm/schemas";
import { createManualOpportunity, listCrm } from "@/lib/crm/service";

export async function GET() {
  const access = await authorizeCrm();
  if (!access.ok) return crmError(access.error, access.status);
  try {
    return Response.json(await listCrm(access.user.id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return handleCrmError(error); }
}

export async function POST(request: Request) {
  const access = await authorizeCrm();
  if (!access.ok) return crmError(access.error, access.status);
  const input = manualInput.safeParse(await request.json().catch(() => null));
  if (!input.success) return crmError("Informe uma empresa para cadastrar a oportunidade.", 400);
  try {
    return Response.json(await createManualOpportunity(input.data, access.user.id, access.user.name || access.user.email || "Equipe comercial"));
  } catch (error) { return handleCrmError(error); }
}
