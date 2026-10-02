import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { saveCandidateReview } from "@/lib/hr-hunting/candidateMemory";
import { writeAppAuditLog } from "@/lib/audit/appAudit";

const schema = z.object({
  verdict: z.enum(["recommended", "alert"]),
  note: z.string().trim().max(1200).optional().or(z.literal("")),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("hr.hunting");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Revise a avaliação do candidato." }, { status: 400 });

  const candidateId = (await params).id;
  const review = await saveCandidateReview({
    candidateId,
    reviewerId: access.user.id,
    reviewerName: access.user.name || access.user.email || "Usuário",
    verdict: parsed.data.verdict,
    note: parsed.data.note || undefined,
  });

  if (review) {
    await writeAppAuditLog({
      actor: access.user,
      moduleKey: "hr.hunting",
      action: parsed.data.verdict === "recommended" ? "candidate.recommended" : "candidate.alerted",
      entityType: "candidate",
      entityId: candidateId,
      severity: "attention",
      retentionDays: 30,
      metadata: { verdict: parsed.data.verdict, hasNote: Boolean(parsed.data.note) },
    });
    return NextResponse.json({ review });
  }
  return NextResponse.json({ error: "Candidato não encontrado." }, { status: 404 });
}
