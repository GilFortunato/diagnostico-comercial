import { NextResponse } from "next/server";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { updateJobDnaSchema } from "@/lib/hr-hunting/types";
import { deleteOwnedHrHuntingSearch, findOwnedHrHuntingSearch, updateHrHuntingJobDna } from "@/lib/hr-hunting/service";
import { writeAppAuditLog } from "@/lib/audit/appAudit";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("hr.hunting");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const search = await findOwnedHrHuntingSearch((await params).id, access.user.id);
  return search ? NextResponse.json({ search }) : NextResponse.json({ error: "Busca não encontrada." }, { status: 404 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("hr.hunting");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = updateJobDnaSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Revise os critérios do Job DNA." }, { status: 400 });
  const search = await updateHrHuntingJobDna((await params).id, access.user.id, parsed.data.jobDna);
  return search ? NextResponse.json({ search }) : NextResponse.json({ error: "Busca não encontrada." }, { status: 404 });
}


export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("hr.hunting");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const id = (await params).id;
  const deleted = await deleteOwnedHrHuntingSearch(id, access.user.id);
  if (!deleted) {
    return NextResponse.json(
      { error: "Somente o proprietário da vaga pode excluí-la." },
      { status: 403 },
    );
  }

  await writeAppAuditLog({
    actor: access.user,
    moduleKey: "hr.hunting",
    action: "job.deleted",
    entityType: "hr-search",
    entityId: id,
    severity: "attention",
    retentionDays: 30,
    metadata: { title: deleted.title, companyName: deleted.companyName },
  });

  return NextResponse.json({ deleted: true });
}
