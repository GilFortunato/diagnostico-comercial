import { NextResponse } from "next/server";
import { listAuthorityAssessments } from "@/lib/repositories/authorityRepository";
import { getSessionUser } from "@/lib/auth/sessionUser";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Entre com sua conta Google para consultar o histórico." }, { status: 401 });
  }

  const url = new URL(request.url);
  const businessUnitId = url.searchParams.get("businessUnitId");

  if (!businessUnitId) {
    return NextResponse.json({ error: "Selecione uma BU antes de consultar o histórico." }, { status: 400 });
  }

  return NextResponse.json({ items: await listAuthorityAssessments(businessUnitId, user.id), adapter: "database" });
}
