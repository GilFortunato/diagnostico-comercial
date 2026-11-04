import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { loadMoreHrHuntingCandidates } from "@/lib/hr-hunting/loadMore";
import { executeSearchSchema } from "@/lib/hr-hunting/types";

export const maxDuration = 300;

const loadMoreSchema = executeSearchSchema.extend({
  batchSize: z.number().int().min(5).max(25).default(20),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("hr.hunting");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = loadMoreSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Revise os filtros antes de carregar mais candidatos." }, { status: 400 });
  if (parsed.data.affirmativeMode && !parsed.data.affirmativeFocus.length) return NextResponse.json({ error: "Selecione ao menos uma opção afirmativa para esta busca." }, { status: 400 });
  const search = await loadMoreHrHuntingCandidates((await params).id, access.user.id, parsed.data);
  return search ? NextResponse.json({ search }) : NextResponse.json({ error: "Busca não encontrada." }, { status: 404 });
}
