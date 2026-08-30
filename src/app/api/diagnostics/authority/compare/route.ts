import { NextResponse } from "next/server";
import { compareAuthorityAssessments } from "@/lib/diagnostics/authority";
import { listAuthorityAssessments } from "@/lib/repositories/authorityRepository";
import { getSessionUser } from "@/lib/auth/sessionUser";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Entre com sua conta Google para comparar a evolução." }, { status: 401 });
  }

  const url = new URL(request.url);
  const businessUnitId = url.searchParams.get("businessUnitId");

  if (!businessUnitId) {
    return NextResponse.json({ error: "Selecione uma BU antes de comparar a evolução." }, { status: 400 });
  }

  const items = await listAuthorityAssessments(businessUnitId, user.id);
  return NextResponse.json(compareAuthorityAssessments(items));
}
