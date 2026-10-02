import { NextResponse } from "next/server";
import { decisionMakerSearchSchema } from "@/lib/decision-makers/search";
import { executeDecisionMakerSearch } from "@/lib/decision-makers/orchestrator";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { writeAppAuditLog } from "@/lib/audit/appAudit";

export const maxDuration = 300;

export async function POST(request: Request) {
  const access = await authorizeModule("decision.makers");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const payload = await request.json();
  const parsed = decisionMakerSearchSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Revise os filtros obrigatórios da busca antes de continuar." }, { status: 400 });
  }

  try {
    const result = await executeDecisionMakerSearch(parsed.data);
    const resultCount = Array.isArray((result as { rows?: unknown[] }).rows)
      ? (result as { rows: unknown[] }).rows.length
      : Array.isArray((result as { people?: unknown[] }).people)
        ? (result as { people: unknown[] }).people.length
        : undefined;
    await writeAppAuditLog({
      actor: access.user,
      moduleKey: "b2b.hunting",
      action: "decision-maker.search.executed",
      entityType: "search",
      severity: "info",
      retentionDays: 7,
      metadata: { resultCount },
    });
    return NextResponse.json(result);
  } catch {
    await writeAppAuditLog({
      actor: access.user,
      moduleKey: "b2b.hunting",
      action: "decision-maker.search.failed",
      entityType: "search",
      severity: "error",
      retentionDays: 30,
    });
    return NextResponse.json({ error: "A pesquisa pública não pôde ser concluída agora. Revise as conexões e tente novamente." }, { status: 503 });
  }
}
