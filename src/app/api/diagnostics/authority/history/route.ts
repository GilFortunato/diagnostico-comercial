import { NextResponse } from "next/server";
import { listAuthorityAssessments } from "@/lib/repositories/authorityRepository";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const businessUnitId = url.searchParams.get("businessUnitId");

  if (!businessUnitId) {
    return NextResponse.json({ error: "Selecione uma BU antes de consultar o histórico." }, { status: 400 });
  }

  return NextResponse.json({ items: await listAuthorityAssessments(businessUnitId), adapter: "demo-local" });
}
