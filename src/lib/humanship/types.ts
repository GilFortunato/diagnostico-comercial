export type HumanshipDataSource = "google_sheets" | "excel";
export type HumanshipClassification = "eligible" | "validate" | "possible_rejected" | "pending";
export type HumanshipDecision = "pending" | "approved" | "review" | "rejected";
export type HumanshipSearchStatus = "pending" | "searching" | "found" | "probable" | "not_found" | "error";

export type HumanshipParticipant = {
  id: string;
  eventId: string;
  sourceKey: string;
  sourceRow?: number;
  active: boolean;
  fullName: string;
  email?: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
  linkedinUrl?: string;
  linkedinName?: string;
  linkedinTitle?: string;
  linkedinCompany?: string;
  linkedinLocation?: string;
  searchStatus: HumanshipSearchStatus;
  classification: HumanshipClassification;
  classificationReason?: string;
  roleReference?: string;
  roleScore?: number;
  companyRestriction?: string;
  humanDecision: HumanshipDecision;
  decisionByName?: string;
  decisionAt?: string;
  message1CopiedAt?: string;
  message2CopiedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type HumanshipEvent = {
  id: string;
  ownerId: string;
  name: string;
  status: string;
  sourceKind?: HumanshipDataSource;
  sourceName?: string;
  sourceExternalId?: string;
  sourceSheetName?: string;
  sourceRowCount: number;
  restrictionVersion: string;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
  participants: HumanshipParticipant[];
};

export type ImportedHumanshipRow = {
  sourceKey: string;
  sourceRow: number;
  fullName: string;
  email?: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
  sourcePayload: Record<string, string>;
};
