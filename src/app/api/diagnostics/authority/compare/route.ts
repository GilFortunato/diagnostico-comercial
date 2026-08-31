import { NextResponse } from "next/server";
import { compareAuthorityAssessments } from "@/lib/diagnostics/authority";
import { listAuthorityAssessments } from "@/lib/repositories/authorityRepository";
import { authorizeModule } from "@/lib/auth/moduleRequest";

export async function GET(request: Request) {
  const access = await authorizeModule("authority.personal");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const url = new URL(request.url);
  const businessUnitId = url.searchParams.get("businessUnitId");

  if (!businessUnitId) {
    return NextResponse.json({ error: "Selecione uma BU antes de comparar a evolução." }, { status: 400 });
  }

  const items = await listAuthorityAssessments(businessUnitId, access.user.id);
  return NextResponse.json(compareAuthorityAssessments(items));
}
