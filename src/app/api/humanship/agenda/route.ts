import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import {
  createHumanshipAgendaEvent,
  listHumanshipAgendaEvents,
} from "@/lib/humanship/agenda";

const createSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(1200).optional().or(z.literal("")),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional().nullable(),
  location: z.string().trim().max(220).optional().or(z.literal("")),
  format: z.enum(["presencial", "online", "hibrido"]).default("presencial"),
  eventUrl: z.string().trim().url().optional().or(z.literal("")),
  coverUrl: z.string().trim().url().optional().or(z.literal("")),
  status: z.enum(["draft", "published"]).default("draft"),
  featured: z.boolean().default(false),
});

export async function GET() {
  const access = await authorizeModule("humanship.r1ship");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    return NextResponse.json({ events: await listHumanshipAgendaEvents() });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar a agenda do Humanship." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const access = await authorizeModule("humanship.r1ship");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Revise os dados do evento e tente novamente." }, { status: 400 });
  }

  const startAt = new Date(parsed.data.startAt);
  const endAt = parsed.data.endAt ? new Date(parsed.data.endAt) : null;
  if (endAt && endAt < startAt) {
    return NextResponse.json({ error: "A data final não pode ser anterior ao início." }, { status: 400 });
  }

  try {
    const event = await createHumanshipAgendaEvent({
      ...parsed.data,
      description: parsed.data.description || undefined,
      location: parsed.data.location || undefined,
      eventUrl: parsed.data.eventUrl || undefined,
      coverUrl: parsed.data.coverUrl || undefined,
      startAt,
      endAt,
      createdById: access.user.id,
    });
    return NextResponse.json({ event }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Não foi possível cadastrar o evento." }, { status: 500 });
  }
}
