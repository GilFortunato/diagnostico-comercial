import { NextResponse } from "next/server";
import { listAuthorityAssessments } from "@/lib/repositories/authorityRepository";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { upgradeAuthorityAssessmentV2 } from "@/lib/diagnostics/authorityV2";

export async function GET(request: Request) {
  const access = await authorizeModule("authority.personal");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const url = new URL(request.url);
  const businessUnitId = url.searchParams.get("businessUnitId");

  if (!businessUnitId) {
    return NextResponse.json({ error: "Selecione uma BU antes de consultar o histórico." }, { status: 400 });
  }

  const items = await listAuthorityAssessments(businessUnitId, access.user.id);
  return NextResponse.json({ items: items.map(upgradeAuthorityAssessmentV2), adapter: "database" });
}
