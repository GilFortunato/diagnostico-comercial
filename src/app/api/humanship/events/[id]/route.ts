import { NextResponse } from "next/server";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { getHumanshipEvent } from "@/lib/humanship/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("humanship.r1ship");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const event = await getHumanshipEvent(access.user.id, (await params).id);
  return event ? NextResponse.json({ event }) : NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
}
