import { NextResponse } from "next/server";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { executeSearchSchema } from "@/lib/hr-hunting/types";
import { executeResilientHrHuntingSearch } from "@/lib/hr-hunting/resilientSearch";
import { writeAppAuditLog } from "@/lib/audit/appAudit";

export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("hr.hunting");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = executeSearchSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Revise os filtros da busca antes de continuar." }, { status: 400 });
  const id = (await params).id;
  const search = await executeResilientHrHuntingSearch(id, access.user.id, parsed.data);
  if (search) {
    await writeAppAuditLog({
      actor: access.user,
      moduleKey: "hr.hunting",
      action: "candidate.search.executed",
      entityType: "hr-search",
      entityId: id,
      severity: search.status === "connector_error" ? "error" : "info",
      retentionDays: search.status === "connector_error" ? 30 : 7,
      metadata: { status: search.status, resultCount: search.candidates.length, title: search.title },
    });
  }
  return search ? NextResponse.json({ search }) : NextResponse.json({ error: "Busca não encontrada." }, { status: 404 });
}
