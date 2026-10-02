import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { saveCandidateReview } from "@/lib/hr-hunting/candidateMemory";

const schema = z.object({
  verdict: z.enum(["recommended", "alert"]),
  note: z.string().trim().max(1200).optional().or(z.literal("")),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("hr.hunting");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Revise a avaliação do candidato." }, { status: 400 });

  const review = await saveCandidateReview({
    candidateId: (await params).id,
    reviewerId: access.user.id,
    reviewerName: access.user.name || access.user.email || "Usuário",
    verdict: parsed.data.verdict,
    note: parsed.data.note || undefined,
  });

  return review
    ? NextResponse.json({ review })
    : NextResponse.json({ error: "Candidato não encontrado." }, { status: 404 });
}
