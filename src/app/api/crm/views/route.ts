import { authorizeCrm, crmError, handleCrmError } from "@/lib/crm/http";
import { viewInput } from "@/lib/crm/schemas";
import { getPrisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  const access = await authorizeCrm();
  if (!access.ok) return crmError(access.error, access.status);
  const input = viewInput.safeParse(await request.json().catch(() => null));
  if (!input.success) return crmError(input.error.issues[0]?.message || "Relatório inválido.", 400);
  const { name, filters } = input.data;
  try {
    const view = await getPrisma().crmReportView.upsert({
      where: { userId_name: { userId: access.user.id, name } },
      create: { userId: access.user.id, name, filters },
      update: { filters },
      select: { id: true, name: true, filters: true },
    });
    return Response.json(view);
  } catch (error) { return handleCrmError(error); }
}
