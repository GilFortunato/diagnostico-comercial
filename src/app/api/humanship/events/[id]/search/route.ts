import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { runHumanshipLinkedinSearch } from "@/lib/humanship/service";

const schema = z.object({ rescan: z.boolean().optional().default(false) });

export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("humanship.r1ship");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  const event = await runHumanshipLinkedinSearch(access.user.id, (await params).id, parsed.data);
  return event ? NextResponse.json({ event }) : NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
}
