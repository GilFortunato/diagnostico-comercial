import { NextResponse } from "next/server";
import { createDecisionMakerSearch, decisionMakerSearchSchema } from "@/lib/decision-makers/search";

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = decisionMakerSearchSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Informe empresa, BU e objetivo comercial para buscar decisores." }, { status: 400 });
  }

  return NextResponse.json(createDecisionMakerSearch(parsed.data));
}
