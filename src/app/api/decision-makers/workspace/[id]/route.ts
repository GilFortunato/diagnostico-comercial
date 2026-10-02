import { NextResponse } from "next/server";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { writeAppAuditLog } from "@/lib/audit/appAudit";
import { deleteOwnedB2BSearch, getB2BWorkspaceSearch } from "@/lib/decision-makers/workspace";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("decision.makers");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const search = await getB2BWorkspaceSearch((await params).id);
  return search ? NextResponse.json({ search }) : NextResponse.json({ error: "Pesquisa não encontrada." }, { status: 404 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("decision.makers");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const id = (await params).id;
  const deleted = await deleteOwnedB2BSearch(id, access.user.id);
  if (!deleted) return NextResponse.json({ error: "Somente o proprietário pode excluir esta pesquisa." }, { status: 403 });

  await writeAppAuditLog({
    actor: access.user,
    moduleKey: "b2b.hunting",
    action: "workspace.search.deleted",
    entityType: "b2b-search",
    entityId: id,
    severity: "attention",
    retentionDays: 30,
    metadata: { title: deleted.title },
  });

  return NextResponse.json({ deleted: true });
}
