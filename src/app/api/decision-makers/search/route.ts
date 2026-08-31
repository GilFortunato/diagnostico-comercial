import { NextResponse } from "next/server";
import { createDecisionMakerSearch, decisionMakerSearchSchema } from "@/lib/decision-makers/search";
import { authorizeModule } from "@/lib/auth/moduleRequest";

export async function POST(request: Request) {
  const access = await authorizeModule("decision.makers");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const payload = await request.json();
  const parsed = decisionMakerSearchSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Informe empresa, BU e objetivo comercial para buscar decisores." }, { status: 400 });
  }

  return NextResponse.json(createDecisionMakerSearch(parsed.data));
}
