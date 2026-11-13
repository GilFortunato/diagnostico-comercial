import { authorizeCrm, crmError, handleCrmError } from "@/lib/crm/http";
import { importReviewInput } from "@/lib/crm/schemas";
import { listCrmImportReview, reviewCrmImport } from "@/lib/crm/service";

export async function GET() {
  const access = await authorizeCrm();
  if (!access.ok) return crmError(access.error, access.status);
  try {
    return Response.json(await listCrmImportReview(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return handleCrmError(error); }
}

export async function PATCH(request: Request) {
  const access = await authorizeCrm();
  if (!access.ok) return crmError(access.error, access.status);
  const input = importReviewInput.safeParse(await request.json().catch(() => null));
  if (!input.success) return crmError("Informe a decisão sobre o registro importado.", 400);
  try {
    return Response.json(await reviewCrmImport(input.data, access.user.name || access.user.email || "Equipe comercial"));
  } catch (error) { return handleCrmError(error); }
}
