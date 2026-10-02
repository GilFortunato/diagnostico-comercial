import "server-only";

import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import type { WhatsCampaignView, WhatsColumnMapping } from "@/lib/whats-generator/types";

type Actor = { id: string; name?: string | null; email?: string | null };

export async function listWhatsCampaigns(actorId: string) {
  const rows = await getPrisma().whatsCampaign.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return rows.map((campaign) => ({
    id: campaign.id,
    ownerId: campaign.ownerId,
    ownerName: campaign.ownerName,
    mine: campaign.ownerId === actorId,
    title: campaign.title,
    tone: campaign.tone,
    status: campaign.status,
    sourceFileName: campaign.sourceFileName,
    totalRecipients: campaign.totalRecipients,
    generatedCount: campaign.generatedCount,
    sentCount: campaign.sentCount,
    updatedAt: campaign.updatedAt.toISOString(),
  }));
}

export async function createWhatsCampaign(input: {
  actor: Actor;
  title: string;
  baseText: string;
  tone: string;
  sourceFileName?: string;
  mapping: WhatsColumnMapping;
  recipients: Array<{ rowNumber: number; name: string; phone: string; job: string; rawData: Record<string, string> }>;
}) {
  const ownerName = input.actor.name || input.actor.email || "Usuário";
  return getPrisma().whatsCampaign.create({
    data: {
      ownerId: input.actor.id,
      ownerName,
      title: input.title.trim(),
      baseText: input.baseText.trim(),
      tone: input.tone.trim(),
      sourceFileName: input.sourceFileName?.trim() || null,
      mapping: input.mapping as unknown as Prisma.InputJsonValue,
      totalRecipients: input.recipients.length,
      status: "ready",
      recipients: {
        create: input.recipients.map((recipient) => ({
          rowNumber: recipient.rowNumber,
          name: recipient.name.trim(),
          phone: normalizePhone(recipient.phone),
          job: recipient.job.trim(),
          rawData: recipient.rawData as unknown as Prisma.InputJsonValue,
        })),
      },
    },
  });
}

export async function getWhatsCampaign(id: string): Promise<WhatsCampaignView | null> {
  const campaign = await getPrisma().whatsCampaign.findUnique({
    where: { id },
    include: { recipients: { orderBy: { rowNumber: "asc" } } },
  });
  if (!campaign) return null;

  return {
    id: campaign.id,
    ownerId: campaign.ownerId,
    ownerName: campaign.ownerName,
    title: campaign.title,
    baseText: campaign.baseText,
    tone: campaign.tone,
    status: campaign.status,
    sourceFileName: campaign.sourceFileName,
    mapping: campaign.mapping as unknown as WhatsColumnMapping,
    totalRecipients: campaign.totalRecipients,
    generatedCount: campaign.generatedCount,
    sentCount: campaign.sentCount,
    updatedAt: campaign.updatedAt.toISOString(),
    recipients: campaign.recipients.map((recipient) => ({
      id: recipient.id,
      rowNumber: recipient.rowNumber,
      name: recipient.name,
      phone: recipient.phone,
      job: recipient.job,
      message: recipient.message,
      status: recipient.status,
      generatedAt: recipient.generatedAt?.toISOString() || null,
      sentAt: recipient.sentAt?.toISOString() || null,
    })),
  };
}

export async function getWhatsRecipientsForGeneration(campaignId: string, recipientIds?: string[]) {
  return getPrisma().whatsRecipient.findMany({
    where: {
      campaignId,
      status: { not: "do_not_contact" },
      ...(recipientIds?.length ? { id: { in: recipientIds } } : { message: null }),
    },
    orderBy: { rowNumber: "asc" },
    take: recipientIds?.length ? Math.min(25, recipientIds.length) : 20,
  });
}

export async function saveGeneratedMessages(campaignId: string, messages: Map<string, string>) {
  if (!messages.size) return refreshWhatsCampaignCounters(campaignId);

  await getPrisma().$transaction(
    [...messages.entries()].map(([recipientId, message]) =>
      getPrisma().whatsRecipient.update({
        where: { id: recipientId },
        data: {
          message,
          status: "generated",
          generatedAt: new Date(),
        },
      }),
    ),
  );
  return refreshWhatsCampaignCounters(campaignId);
}

export async function updateWhatsRecipient(input: {
  campaignId: string;
  recipientId: string;
  message?: string;
  status?: "pending" | "generated" | "sent" | "do_not_contact";
}) {
  const found = await getPrisma().whatsRecipient.findFirst({
    where: { id: input.recipientId, campaignId: input.campaignId },
    select: { id: true },
  });
  if (!found) return null;

  await getPrisma().whatsRecipient.update({
    where: { id: input.recipientId },
    data: {
      ...(typeof input.message === "string" ? { message: input.message.trim() || null } : {}),
      ...(input.status ? {
        status: input.status,
        sentAt: input.status === "sent" ? new Date() : input.status === "pending" ? null : undefined,
      } : {}),
    },
  });

  await refreshWhatsCampaignCounters(input.campaignId);
  return getPrisma().whatsRecipient.findUnique({ where: { id: input.recipientId } });
}

export async function deleteOwnedWhatsCampaign(id: string, ownerId: string) {
  const found = await getPrisma().whatsCampaign.findFirst({ where: { id, ownerId }, select: { id: true, title: true } });
  if (!found) return null;
  await getPrisma().whatsCampaign.delete({ where: { id } });
  return found;
}

export async function refreshWhatsCampaignCounters(campaignId: string) {
  const [totalRecipients, generatedCount, sentCount] = await Promise.all([
    getPrisma().whatsRecipient.count({ where: { campaignId } }),
    getPrisma().whatsRecipient.count({ where: { campaignId, message: { not: null } } }),
    getPrisma().whatsRecipient.count({ where: { campaignId, status: "sent" } }),
  ]);

  return getPrisma().whatsCampaign.update({
    where: { id: campaignId },
    data: {
      totalRecipients,
      generatedCount,
      sentCount,
      status: sentCount >= totalRecipients && totalRecipients > 0 ? "completed" : generatedCount > 0 ? "in_progress" : "ready",
    },
  });
}

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}
