import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import {
  deleteHumanshipAgendaEvent,
  updateHumanshipAgendaEvent,
} from "@/lib/humanship/agenda";
import { writeAppAuditLog } from "@/lib/audit/appAudit";

const updateSchema = z.object({
  title: z.string().trim().min(2).max(180).optional(),
  description: z.string().trim().max(1200).nullable().optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().nullable().optional(),
  location: z.string().trim().max(220).nullable().optional(),
  format: z.enum(["presencial", "online", "hibrido"]).optional(),
  eventUrl: z.string().trim().url().nullable().optional(),
  coverUrl: z.string().trim().url().nullable().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  featured: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("humanship.r1ship");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Revise os dados do evento e tente novamente." }, { status: 400 });
  }

  const input = {
    ...parsed.data,
    startAt: parsed.data.startAt ? new Date(parsed.data.startAt) : undefined,
    endAt: parsed.data.endAt === undefined ? undefined : parsed.data.endAt ? new Date(parsed.data.endAt) : null,
  };

  if (input.startAt && input.endAt && input.endAt < input.startAt) {
    return NextResponse.json({ error: "A data final não pode ser anterior ao início." }, { status: 400 });
  }

  try {
    const id = (await params).id;
    const event = await updateHumanshipAgendaEvent(id, input);
    if (event) {
      await writeAppAuditLog({
        actor: access.user,
        moduleKey: "humanship",
        action: "agenda.event.updated",
        entityType: "agenda-event",
        entityId: id,
        severity: "attention",
        retentionDays: 30,
        metadata: {
          title: event.title,
          status: event.status,
          featured: event.featured,
          changedFields: Object.keys(parsed.data),
        },
      });
      return NextResponse.json({ event });
    }
    return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Não foi possível atualizar o evento." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("humanship.r1ship");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const id = (await params).id;
    const deleted = await deleteHumanshipAgendaEvent(id);
    if (deleted) {
      await writeAppAuditLog({
        actor: access.user,
        moduleKey: "humanship",
        action: "agenda.event.deleted",
        entityType: "agenda-event",
        entityId: id,
        severity: "security",
        retentionDays: 30,
      });
      return NextResponse.json({ deleted: true });
    }
    return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Não foi possível excluir o evento." }, { status: 500 });
  }
}
