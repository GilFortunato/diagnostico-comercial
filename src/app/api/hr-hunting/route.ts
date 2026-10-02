import { NextResponse } from "next/server";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { createJobSchema } from "@/lib/hr-hunting/types";
import { createHrHuntingSearch, listHrHuntingSearches } from "@/lib/hr-hunting/service";
import { writeAppAuditLog } from "@/lib/audit/appAudit";

export async function GET() {
  const access = await authorizeModule("hr.hunting");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  return NextResponse.json({ searches: await listHrHuntingSearches(access.user.id) });
}

export async function POST(request: Request) {
  const access = await authorizeModule("hr.hunting");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = createJobSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Cole a vaga completa com pelo menos 30 caracteres antes de analisar." }, { status: 400 });
  const search = await createHrHuntingSearch(access.user.id, parsed.data);
  await writeAppAuditLog({
    actor: access.user,
    moduleKey: "hr.hunting",
    action: "job.created",
    entityType: "hr-search",
    entityId: search?.id || null,
    severity: "attention",
    retentionDays: 30,
    metadata: { title: search?.title || parsed.data.title || "vaga", companyName: parsed.data.companyName || null },
  });
  return NextResponse.json({ search }, { status: 201 });
}
