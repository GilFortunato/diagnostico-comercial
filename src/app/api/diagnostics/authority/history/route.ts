import { NextResponse } from "next/server";
import { listAuthorityAssessments } from "@/lib/repositories/authorityRepository";
import { authorizeModule } from "@/lib/auth/moduleRequest";

export async function GET(request: Request) {
  const access = await authorizeModule("authority.personal");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const url = new URL(request.url);
  const businessUnitId = url.searchParams.get("businessUnitId");

  if (!businessUnitId) {
    return NextResponse.json({ error: "Selecione uma BU antes de consultar o histórico." }, { status: 400 });
  }

  return NextResponse.json({ items: await listAuthorityAssessments(businessUnitId, access.user.id), adapter: "database" });
}
