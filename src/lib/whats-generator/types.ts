export type WhatsImportRow = Record<string, string>;

export type WhatsColumnMapping = {
  name: string;
  phone: string;
  job: string;
};

export type WhatsCampaignSummary = {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  tone: string;
  status: string;
  sourceFileName: string | null;
  totalRecipients: number;
  generatedCount: number;
  sentCount: number;
  updatedAt: string;
};

export type WhatsRecipientView = {
  id: string;
  rowNumber: number;
  name: string;
  phone: string;
  job: string;
  message: string | null;
  status: string;
  generatedAt: string | null;
  sentAt: string | null;
};

export type WhatsCampaignView = WhatsCampaignSummary & {
  baseText: string;
  mapping: WhatsColumnMapping;
  recipients: WhatsRecipientView[];
};
