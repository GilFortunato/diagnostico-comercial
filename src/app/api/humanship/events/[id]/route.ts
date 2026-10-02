import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { canDeleteHumanshipEvents } from "@/lib/humanship/managers";
import { deleteHumanshipEvent, getHumanshipEvent, renameHumanshipEvent } from "@/lib/humanship/service";
import { writeAppAuditLog } from "@/lib/audit/appAudit";

const renameSchema = z.object({ name: z.string().trim().min(2).max(180) });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("humanship.r1ship");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const event = await getHumanshipEvent(access.user.id, (await params).id);
  return event ? NextResponse.json({ event }) : NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("humanship.r1ship");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const parsed = renameSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Informe um nome válido para o evento." }, { status: 400 });

  const id = (await params).id;
  const event = await renameHumanshipEvent(access.user.id, id, parsed.data.name);
  if (event) {
    await writeAppAuditLog({
      actor: access.user,
      moduleKey: "humanship",
      action: "r1.event.renamed",
      entityType: "humanship-event",
      entityId: id,
      severity: "attention",
      retentionDays: 30,
      metadata: { name: event.name },
    });
    return NextResponse.json({ event });
  }
  return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("humanship.r1ship");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!canDeleteHumanshipEvents(access.user)) {
    return NextResponse.json({ error: "Somente os gestores autorizados podem excluir eventos." }, { status: 403 });
  }

  const id = (await params).id;
  const deleted = await deleteHumanshipEvent(id);
  if (deleted) {
    await writeAppAuditLog({
      actor: access.user,
      moduleKey: "humanship",
      action: "r1.event.deleted",
      entityType: "humanship-event",
      entityId: id,
      severity: "security",
      retentionDays: 30,
    });
    return NextResponse.json({ deleted: true });
  }
  return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
}
