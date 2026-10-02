import { NextResponse } from "next/server";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { writeAppAuditLog } from "@/lib/audit/appAudit";
import { applyCurrentHumanshipRestrictionsToEvent } from "@/lib/humanship/restrictionConfig";
import { getHumanshipEvent } from "@/lib/humanship/service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("humanship.admin");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const id = (await params).id;
  const applied = await applyCurrentHumanshipRestrictionsToEvent(id);
  if (!applied) return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });

  const event = await getHumanshipEvent(access.user.id, id);
  await writeAppAuditLog({
    actor: access.user,
    moduleKey: "humanship",
    action: "restrictions.applied_to_event",
    entityType: "humanship-event",
    entityId: id,
    severity: "security",
    retentionDays: 30,
    metadata: { version: applied.version },
  });

  return NextResponse.json({ event, restrictions: applied });
}
