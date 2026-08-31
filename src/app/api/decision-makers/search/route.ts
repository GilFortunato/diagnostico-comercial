import { NextResponse } from "next/server";
import { decisionMakerSearchSchema } from "@/lib/decision-makers/search";
import { executeDecisionMakerSearch } from "@/lib/decision-makers/orchestrator";
import { authorizeModule } from "@/lib/auth/moduleRequest";

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
    return NextResponse.json(await executeDecisionMakerSearch(parsed.data));
  } catch {
    return NextResponse.json({ error: "A pesquisa pública não pôde ser concluída agora. Revise as conexões e tente novamente." }, { status: 503 });
  }
}
