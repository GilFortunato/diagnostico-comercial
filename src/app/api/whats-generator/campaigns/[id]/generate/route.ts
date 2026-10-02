import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { writeAppAuditLog } from "@/lib/audit/appAudit";
import { generateIndividualWhatsMessages } from "@/lib/whats-generator/gemini";
import { getWhatsCampaign, getWhatsRecipientsForGeneration, saveGeneratedMessages } from "@/lib/whats-generator/service";

export const maxDuration = 120;

const schema = z.object({
  recipientIds: z.array(z.string().min(1)).max(25).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("communication.whats-generator");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Lote de contatos inválido." }, { status: 400 });

  const campaignId = (await params).id;
  const campaign = await getWhatsCampaign(campaignId);
  if (!campaign) return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });

  const recipients = await getWhatsRecipientsForGeneration(campaignId, parsed.data.recipientIds);
  if (!recipients.length) return NextResponse.json({ generated: 0, campaign });

  try {
    const messages = await generateIndividualWhatsMessages({
      baseText: campaign.baseText,
      tone: campaign.tone,
      recipients: recipients.map((recipient) => ({
        id: recipient.id,
        name: recipient.name,
        job: recipient.job,
      })),
    });

    await saveGeneratedMessages(campaignId, messages);
    const updated = await getWhatsCampaign(campaignId);

    await writeAppAuditLog({
      actor: access.user,
      moduleKey: "communication.whats-generator",
      action: "whats.messages.generated",
      entityType: "whats-campaign",
      entityId: campaignId,
      severity: "info",
      retentionDays: 7,
      metadata: { generated: messages.size },
    });

    return NextResponse.json({ generated: messages.size, campaign: updated });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Não foi possível gerar as mensagens." }, { status: 503 });
  }
}
