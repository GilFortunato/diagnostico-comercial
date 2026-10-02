import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { writeAppAuditLog } from "@/lib/audit/appAudit";
import { createWhatsCampaign, listWhatsCampaigns } from "@/lib/whats-generator/service";

const createSchema = z.object({
  title: z.string().trim().min(2).max(160),
  baseText: z.string().trim().min(10).max(6000),
  tone: z.string().trim().min(2).max(120).default("Profissional e acolhedor"),
  sourceFileName: z.string().trim().max(260).optional(),
  mapping: z.object({
    name: z.string().min(1),
    phone: z.string().min(1),
    job: z.string().min(1),
  }),
  recipients: z.array(z.object({
    rowNumber: z.number().int().min(2),
    name: z.string().trim().min(1).max(200),
    phone: z.string().trim().min(6).max(80),
    job: z.string().trim().min(1).max(240),
    rawData: z.record(z.string(), z.string()),
  })).min(1).max(1500),
});

export async function GET() {
  const access = await authorizeModule("communication.whats-generator");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  return NextResponse.json({ campaigns: await listWhatsCampaigns(access.user.id) });
}

export async function POST(request: Request) {
  const access = await authorizeModule("communication.whats-generator");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Revise o nome da campanha, texto-base e mapeamento da planilha." }, { status: 400 });

  const campaign = await createWhatsCampaign({ actor: access.user, ...parsed.data });

  await writeAppAuditLog({
    actor: access.user,
    moduleKey: "communication.whats-generator",
    action: "whats.campaign.created",
    entityType: "whats-campaign",
    entityId: campaign.id,
    severity: "info",
    retentionDays: 7,
    metadata: { title: campaign.title, recipients: parsed.data.recipients.length },
  });

  return NextResponse.json({ campaignId: campaign.id }, { status: 201 });
}
