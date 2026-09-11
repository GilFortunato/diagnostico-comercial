import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { createHumanshipEvent, listHumanshipEvents } from "@/lib/humanship/service";

const createSchema = z.object({ name: z.string().trim().min(2).max(180) });

export async function GET() {
  const access = await authorizeModule("humanship.r1ship");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  return NextResponse.json({ events: await listHumanshipEvents(access.user.id) });
}

export async function POST(request: Request) {
  const access = await authorizeModule("humanship.r1ship");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Informe um nome para o evento." }, { status: 400 });
  const event = await createHumanshipEvent(access.user.id, parsed.data.name);
  return NextResponse.json({ event }, { status: 201 });
}
