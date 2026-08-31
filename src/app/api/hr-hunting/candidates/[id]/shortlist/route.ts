import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { toggleHrShortlist } from "@/lib/hr-hunting/service";

const schema = z.object({ shortlisted: z.boolean(), nextStep: z.string().trim().max(300).optional(), notes: z.string().trim().max(2_000).optional() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("hr.hunting");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Dados da shortlist inválidos." }, { status: 400 });
  const updated = await toggleHrShortlist((await params).id, access.user.id, parsed.data.shortlisted, parsed.data.nextStep, parsed.data.notes);
  return updated ? NextResponse.json({ updated: true }) : NextResponse.json({ error: "Candidato não encontrado." }, { status: 404 });
}
