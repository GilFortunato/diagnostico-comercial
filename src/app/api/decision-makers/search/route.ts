import { NextResponse } from "next/server";
import { decisionMakerSearchSchema } from "@/lib/decision-makers/search";
import { executeDecisionMakerSearch } from "@/lib/decision-makers/orchestrator";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { writeAppAuditLog } from "@/lib/audit/appAudit";
import { findReusableB2BSearch, persistB2BWorkspaceSearch } from "@/lib/decision-makers/workspace";

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
    const reusable = parsed.data.forceRefresh ? null : await findReusableB2BSearch(parsed.data);
    if (reusable) {
      const reused = reusable.resultSnapshot as unknown as import("@/lib/decision-makers/search").DecisionMakerResult;
      const persisted = await persistB2BWorkspaceSearch({
        actor: access.user,
        searchInput: parsed.data,
        result: { ...reused, fromCache: true, persistentCache: true },
        reusedFromSearchId: reusable.id,
      });
      await writeAppAuditLog({
        actor: access.user,
        moduleKey: "b2b.hunting",
        action: "decision-maker.search.reused",
        entityType: "search",
        entityId: persisted.workspaceSearchId,
        severity: "info",
        retentionDays: 7,
        metadata: {
          resultCount: persisted.mode === "companies" ? persisted.companies.length : persisted.people.length,
          reusedFromSearchId: reusable.id,
        },
      });
      return NextResponse.json(persisted);
    }

    const result = await executeDecisionMakerSearch(parsed.data);
    const persisted = await persistB2BWorkspaceSearch({
      actor: access.user,
      searchInput: parsed.data,
      result,
    });
    const resultCount = persisted.mode === "companies" ? persisted.companies.length : persisted.people.length;
    await writeAppAuditLog({
      actor: access.user,
      moduleKey: "b2b.hunting",
      action: "decision-maker.search.executed",
      entityType: "search",
      entityId: persisted.workspaceSearchId,
      severity: "info",
      retentionDays: 7,
      metadata: { resultCount, persistentCache: false },
    });
    return NextResponse.json(persisted);
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
