import { z } from "zod";

export const criterionKinds = ["obrigatório", "desejável", "não relevante"] as const;
export const evidenceStates = ["confirmado", "provável", "inferência", "não verificado"] as const;
export const contactTypes = ["e-mail profissional", "telefone profissional"] as const;
export const messageFormats = ["linkedin", "whatsapp", "email"] as const;

export type CriterionKind = typeof criterionKinds[number];
export type EvidenceState = typeof evidenceStates[number];
export type MessageFormat = typeof messageFormats[number];

export const jobCriterionSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(2).max(180),
  kind: z.enum(criterionKinds),
  sourceExcerpt: z.string().trim().min(2).max(500),
});

export const jobDnaSchema = z.object({
  title: z.string().trim().min(2).max(180),
  shortSummary: z.string().trim().max(600),
  mission: z.string().trim().max(600).optional(),
  area: z.string().trim().max(120).optional(),
  seniority: z.string().trim().max(120).optional(),
  location: z.string().trim().max(180).optional(),
  workModel: z.string().trim().max(120).optional(),
  responsibilities: z.array(z.string().trim().min(2).max(300)).max(12),
  criteria: z.array(jobCriterionSchema).max(24),
  interviewChecks: z.array(z.string().trim().min(2).max(240)).max(12),
});

export type JobDna = z.infer<typeof jobDnaSchema>;
export type JobCriterion = z.infer<typeof jobCriterionSchema>;

export const createJobSchema = z.object({
  title: z.string().trim().min(2).max(180).optional().or(z.literal("")),
  description: z.string().trim().min(30).max(20_000),
  jobUrl: z.string().trim().url().max(2_000).optional().or(z.literal("")),
  companyName: z.string().trim().max(180).optional().or(z.literal("")),
  recruiterName: z.string().trim().max(180).optional().or(z.literal("")),
});

export const updateJobDnaSchema = z.object({ jobDna: jobDnaSchema });
export const executeSearchSchema = z.object({
  quantity: z.number().int().min(5).max(50).default(20),
  currentTitle: z.string().trim().max(180).optional().or(z.literal("")),
  seniority: z.array(z.enum(["manager", "director", "vp", "c_level", "owner"])).max(5).default([]),
  location: z.string().trim().max(180).optional().or(z.literal("")),
  keywords: z.array(z.string().trim().min(2).max(80)).max(12).default([]),
});

export type HrCandidateEvidence = { criterion: string; criterionType: CriterionKind; result: "atende" | "parcial" | "não verificado"; evidence?: string; source: string; confidence: EvidenceState };
export type HrCandidateContact = { value: string; type: typeof contactTypes[number]; source: string; confidence: EvidenceState; obtainedAt?: string };
export type HrCandidate = {
  id: string; name: string; currentTitle?: string; currentCompany?: string; location?: string; profileUrl?: string; professionalSummary?: string;
  fitScore: number; fitClassification: "Muito alta" | "Alta" | "Boa" | "Parcial" | "Baixa aderência inicial"; mainSignal?: string; pointsToValidate: string[];
  sourceName: string; confidence: EvidenceState; evidence: HrCandidateEvidence[]; contacts: HrCandidateContact[]; shortlisted: boolean; shortlist?: { nextStep?: string; notes?: string };
};
export type HrHuntingSearchSnapshot = {
  id: string; title: string; jobDescription: string; jobUrl?: string; companyName?: string; recruiterName?: string; jobDna: JobDna; searchTerms: string[];
  status: string; connectorWarnings: string[]; createdAt: string; updatedAt: string; candidates: HrCandidate[];
};
