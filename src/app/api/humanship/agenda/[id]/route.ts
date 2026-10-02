import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import {
  deleteHumanshipAgendaEvent,
  updateHumanshipAgendaEvent,
} from "@/lib/humanship/agenda";

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
    const event = await updateHumanshipAgendaEvent((await params).id, input);
    return event
      ? NextResponse.json({ event })
      : NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Não foi possível atualizar o evento." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("humanship.r1ship");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const deleted = await deleteHumanshipAgendaEvent((await params).id);
    return deleted
      ? NextResponse.json({ deleted: true })
      : NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Não foi possível excluir o evento." }, { status: 500 });
  }
}
