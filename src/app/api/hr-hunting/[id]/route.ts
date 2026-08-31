import { NextResponse } from "next/server";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { updateJobDnaSchema } from "@/lib/hr-hunting/types";
import { findOwnedHrHuntingSearch, updateHrHuntingJobDna } from "@/lib/hr-hunting/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("hr.hunting");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const search = await findOwnedHrHuntingSearch((await params).id, access.user.id);
  return search ? NextResponse.json({ search }) : NextResponse.json({ error: "Busca não encontrada." }, { status: 404 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("hr.hunting");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = updateJobDnaSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Revise os critérios do Job DNA." }, { status: 400 });
  const search = await updateHrHuntingJobDna((await params).id, access.user.id, parsed.data.jobDna);
  return search ? NextResponse.json({ search }) : NextResponse.json({ error: "Busca não encontrada." }, { status: 404 });
}
