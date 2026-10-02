import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { writeAppAuditLog } from "@/lib/audit/appAudit";
import { updateWhatsRecipient } from "@/lib/whats-generator/service";

const schema = z.object({
  message: z.string().max(8000).optional(),
  status: z.enum(["pending", "generated", "sent", "do_not_contact"]).optional(),
}).refine((value) => value.message !== undefined || value.status !== undefined);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; recipientId: string }> }) {
  const access = await authorizeModule("communication.whats-generator");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Alteração inválida." }, { status: 400 });

  const { id, recipientId } = await params;
  const recipient = await updateWhatsRecipient({ campaignId: id, recipientId, ...parsed.data });
  if (!recipient) return NextResponse.json({ error: "Contato não encontrado." }, { status: 404 });

  if (parsed.data.status === "sent" || parsed.data.status === "do_not_contact") {
    await writeAppAuditLog({
      actor: access.user,
      moduleKey: "communication.whats-generator",
      action: parsed.data.status === "sent" ? "whats.recipient.sent" : "whats.recipient.do_not_contact",
      entityType: "whats-recipient",
      entityId: recipientId,
      severity: parsed.data.status === "sent" ? "info" : "attention",
      retentionDays: parsed.data.status === "sent" ? 7 : 30,
      metadata: { campaignId: id },
    });
  }

  return NextResponse.json({ updated: true });
}
