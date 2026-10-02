import { NextResponse } from "next/server";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { writeAppAuditLog } from "@/lib/audit/appAudit";
import { deleteOwnedWhatsCampaign, getWhatsCampaign } from "@/lib/whats-generator/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("communication.whats-generator");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const campaign = await getWhatsCampaign((await params).id);
  return campaign ? NextResponse.json({ campaign }) : NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("communication.whats-generator");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const id = (await params).id;
  const deleted = await deleteOwnedWhatsCampaign(id, access.user.id);
  if (!deleted) return NextResponse.json({ error: "Somente quem criou a campanha pode excluí-la." }, { status: 403 });

  await writeAppAuditLog({
    actor: access.user,
    moduleKey: "communication.whats-generator",
    action: "whats.campaign.deleted",
    entityType: "whats-campaign",
    entityId: id,
    severity: "attention",
    retentionDays: 30,
    metadata: { title: deleted.title },
  });

  return NextResponse.json({ deleted: true });
}
