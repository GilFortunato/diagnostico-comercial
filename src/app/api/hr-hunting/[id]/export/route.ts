import { authorizeModule } from "@/lib/auth/moduleRequest";
import { buildHrHuntingWorkbook } from "@/lib/hr-hunting/exportWorkbook";
import { findOwnedHrHuntingSearch } from "@/lib/hr-hunting/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("hr.hunting");
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });
  const scope = ((await request.json().catch(() => ({}))) as { scope?: string }).scope;
  if (scope !== "all" && scope !== "selected" && scope !== "shortlist") return Response.json({ error: "Escopo de exportação inválido." }, { status: 400 });
  const search = await findOwnedHrHuntingSearch((await params).id, access.user.id);
  if (!search) return Response.json({ error: "Busca não encontrada." }, { status: 404 });
  const workbook = await buildHrHuntingWorkbook(search, scope);
  return new Response(workbook, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="share-ai-hr-hunting-${search.updatedAt.slice(0, 10)}.xlsx"`, "Cache-Control": "private, no-store" } });
}
