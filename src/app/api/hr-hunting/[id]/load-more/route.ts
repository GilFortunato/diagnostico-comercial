import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { loadMoreHrHuntingCandidates } from "@/lib/hr-hunting/loadMore";

export const maxDuration = 300;

const loadMoreSchema = z.object({
  batchSize: z.number().int().min(5).max(25).default(20),
  quantity: z.number().int().min(5).max(50).default(20),
  currentTitle: z.string().trim().max(180).optional().or(z.literal("")),
  seniority: z.array(z.enum(["manager", "director", "vp", "c_level", "owner"])).max(5).default([]),
  location: z.string().trim().max(180).optional().or(z.literal("")),
  keywords: z.array(z.string().trim().min(2).max(80)).max(12).default([]),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("hr.hunting");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = loadMoreSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Revise os filtros antes de carregar mais candidatos." }, { status: 400 });
  const search = await loadMoreHrHuntingCandidates((await params).id, access.user.id, parsed.data);
  return search ? NextResponse.json({ search }) : NextResponse.json({ error: "Busca não encontrada." }, { status: 404 });
}
