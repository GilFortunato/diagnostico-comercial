import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { toggleHrShortlist } from "@/lib/hr-hunting/service";
import { writeAppAuditLog } from "@/lib/audit/appAudit";

const schema = z.object({ shortlisted: z.boolean(), nextStep: z.string().trim().max(300).optional(), notes: z.string().trim().max(2_000).optional() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("hr.hunting");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Dados da shortlist inválidos." }, { status: 400 });
  const candidateId = (await params).id;
  const updated = await toggleHrShortlist(candidateId, access.user.id, parsed.data.shortlisted, parsed.data.nextStep, parsed.data.notes);
  if (updated) {
    await writeAppAuditLog({
      actor: access.user,
      moduleKey: "hr.hunting",
      action: parsed.data.shortlisted ? "candidate.shortlist.added" : "candidate.shortlist.removed",
      entityType: "candidate",
      entityId: candidateId,
      severity: "attention",
      retentionDays: 30,
      metadata: { shortlisted: parsed.data.shortlisted },
    });
    return NextResponse.json({ updated: true });
  }
  return NextResponse.json({ error: "Candidato não encontrado." }, { status: 404 });
}
