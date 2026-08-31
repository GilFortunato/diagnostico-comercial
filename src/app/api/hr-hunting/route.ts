import { NextResponse } from "next/server";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { createJobSchema } from "@/lib/hr-hunting/types";
import { createHrHuntingSearch, listHrHuntingSearches } from "@/lib/hr-hunting/service";

export async function GET() {
  const access = await authorizeModule("hr.hunting");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  return NextResponse.json({ searches: await listHrHuntingSearches(access.user.id) });
}

export async function POST(request: Request) {
  const access = await authorizeModule("hr.hunting");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = createJobSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Informe o título e uma descrição de vaga com pelo menos 30 caracteres." }, { status: 400 });
  const search = await createHrHuntingSearch(access.user.id, parsed.data);
  return NextResponse.json({ search }, { status: 201 });
}
