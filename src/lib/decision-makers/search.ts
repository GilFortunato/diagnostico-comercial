import { z } from "zod";

export const employeeRanges = ["0-9", "10-19", "20-49", "50-99", "100-249", "250-499", "500-999", "1000-4999", "5000-9999", "10000+"] as const;
export const revenueRanges = ["< 500K", "500K-10M", "10M-50M", "50M-100M", "100M-500M", "500M-1B", "1B+"] as const;
export const seniorityLevels = ["manager", "director", "vp", "c_level", "owner"] as const;
export const decisionRoles = ["Decisor econômico", "Decisor funcional", "Champion", "Influenciador", "Porta de entrada"] as const;

const commonSchema = z.object({
  businessUnitId: z.string().min(1),
  objective: z.string().trim().min(10).max(600),
  forceRefresh: z.boolean().optional().default(false),
});

export const companySearchSchema = commonSchema.extend({
  mode: z.literal("companies"),
  filters: z.object({
    industries: z.array(z.string().trim().min(2)).max(10).default([]),
    country: z.string().trim().min(2).default("Brazil"),
    states: z.array(z.string().trim().min(2)).max(20).default([]),
    cityPostalCodes: z.array(z.string().trim().min(2)).max(20).default([]),
    employeeRanges: z.array(z.enum(employeeRanges)).max(10).default([]),
    keywords: z.array(z.string().trim().min(2)).max(15).default([]),
    technologies: z.array(z.string().trim().min(2)).max(10).default([]),
    revenueRanges: z.array(z.enum(revenueRanges)).max(7).default([]),
    domains: z.array(z.string().trim().min(3)).max(10).default([]),
    quantity: z.number().int().min(5).max(50).default(15),
  }),
});

export const personSearchSchema = commonSchema.extend({
  mode: z.literal("people"),
  filters: z.object({
    companyLinkedinUrls: z.array(z.string().url()).min(1).max(10),
    companyNames: z.array(z.string().trim().min(2)).max(10).default([]),
    roles: z.array(z.string().trim().min(2)).min(1).max(20),
    departments: z.array(z.string().trim().min(2)).max(10).default([]),
    seniority: z.array(z.enum(seniorityLevels)).max(5).default([]),
    locations: z.array(z.string().trim().min(2)).max(10).default([]),
    profileKeywords: z.array(z.string().trim().min(2)).max(15).default([]),
    desiredDecisionRole: z.enum(decisionRoles).default("Decisor funcional"),
    quantity: z.number().int().min(5).max(50).default(20),
    includeBroadDiscovery: z.boolean().default(false),
  }),
});

export const decisionMakerSearchSchema = z.discriminatedUnion("mode", [companySearchSchema, personSearchSchema]);
export type DecisionMakerSearchInput = z.infer<typeof decisionMakerSearchSchema>;
export type CompanySearchInput = z.infer<typeof companySearchSchema>;
export type PersonSearchInput = z.infer<typeof personSearchSchema>;
export type DecisionRole = typeof decisionRoles[number];

export type EvidenceConfidence = "confirmado" | "provável" | "inferência" | "não verificado";
export type FitLevel = "Alta" | "Média" | "Baixa";

export type HuntingSource = {
  title: string;
  url?: string;
  confidence: EvidenceConfidence;
  notes: string;
};

export type HuntingCompany = {
  id: string;
  name: string;
  domain?: string;
  website?: string;
  linkedinUrl?: string;
  industry?: string;
  location?: string;
  employeeRange?: string;
  revenueRange?: string;
  description?: string;
  signals: string[];
  fit: FitLevel;
  fitReasons: string[];
  confidence: EvidenceConfidence;
  source: string;
};

export type HuntingPerson = {
  id: string;
  name: string;
  title: string;
  company: string;
  linkedinUrl: string;
  location?: string;
  department?: string;
  seniority?: string;
  probableDecisionRole: DecisionRole;
  fit: FitLevel;
  fitScore: number;
  fitReasons: string[];
  confidence: EvidenceConfidence;
  accessibility: "Alta" | "Média" | "Baixa";
  profileSummary?: string;
  recentSignals: string[];
  professionalEmail?: string;
  emailStatus: "Encontrado" | "Não encontrado";
  professionalPhone?: string;
  phoneStatus: "Encontrado" | "Não encontrado";
  contactSource?: string;
  contactConfidence?: EvidenceConfidence;
  nextBestAction: string;
  rapport: {
    context: string;
    safeOpening: string;
    avoid: string[];
  };
  source: string;
};

export type DecisionMakerResult = {
  mode: "companies" | "people";
  queryId: string;
  generatedAt: string;
  fromCache: boolean;
  businessUnitName: string;
  objective: string;
  companies: HuntingCompany[];
  people: HuntingPerson[];
  targetRolesNotFound: string[];
  nextBestAction: {
    title: string;
    reason: string;
    impact: "alto" | "médio";
    effort: "baixo" | "médio";
  };
  sources: HuntingSource[];
  warnings: string[];
  cost: {
    strategy: string;
    basicCandidates: number;
    profileEnrichments: number;
    postEnrichments: number;
    broadDiscoveryUsed: boolean;
  };
};

export function splitTerms(value: string) {
  return uniqueStrings(value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean));
}

export function uniqueStrings(values: string[]) {
  const unique = new Map<string, string>();
  for (const value of values.filter(Boolean)) {
    const key = normalizeText(value);
    if (!unique.has(key)) unique.set(key, value);
  }
  return [...unique.values()];
}

export function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}
