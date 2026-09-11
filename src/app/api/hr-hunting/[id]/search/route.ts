import { NextResponse } from "next/server";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { executeSearchSchema } from "@/lib/hr-hunting/types";
import { executeResilientHrHuntingSearch } from "@/lib/hr-hunting/resilientSearch";

export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("hr.hunting");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = executeSearchSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Revise os filtros da busca antes de continuar." }, { status: 400 });
  const search = await executeResilientHrHuntingSearch((await params).id, access.user.id, parsed.data);
  return search ? NextResponse.json({ search }) : NextResponse.json({ error: "Busca não encontrada." }, { status: 404 });
}
