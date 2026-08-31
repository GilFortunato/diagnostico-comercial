import { authorizeModule } from "@/lib/auth/moduleRequest";
import { buildDecisionMakerWorkbook } from "@/lib/decision-makers/exportWorkbook";
import type { DecisionMakerResult } from "@/lib/decision-makers/search";

export async function POST(request: Request) {
  const access = await authorizeModule("decision.makers");
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });
  const result = (await request.json()) as DecisionMakerResult;
  if (!isExportableSnapshot(result)) return Response.json({ error: "O snapshot da busca é inválido ou está incompleto." }, { status: 400 });

  const workbook = await buildDecisionMakerWorkbook(result);
  const date = result.generatedAt.slice(0, 10);
  return new Response(workbook, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="share-ai-mapa-decisores-${date}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function isExportableSnapshot(value: unknown): value is DecisionMakerResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<DecisionMakerResult>;
  return (result.mode === "companies" || result.mode === "people")
    && typeof result.generatedAt === "string"
    && typeof result.businessUnitName === "string"
    && typeof result.objective === "string"
    && Array.isArray(result.companies)
    && Array.isArray(result.people)
    && Array.isArray(result.sources)
    && Boolean(result.cost && typeof result.cost === "object");
}
