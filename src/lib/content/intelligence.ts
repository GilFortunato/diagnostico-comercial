import { z } from "zod";
import { getBusinessUnitDna } from "@/lib/business-units/dna";
import { reviewPortugueseCopy, reviewPortugueseList } from "@/lib/copy/editorial";

export const contentOpportunitySchema = z.object({
  businessUnitId: z.string().min(1),
  objective: z.string().min(8),
  personalVoice: z.string().optional().default(""),
  authorityContext: z.object({
    summary: z.string().optional().default(""),
    strengths: z.array(z.string()).optional().default([]),
    gaps: z.array(z.string()).optional().default([]),
    opportunities: z.array(z.string()).optional().default([]),
    recommendations: z.array(z.string()).optional().default([]),
    authoritySellingScore: z.number().min(0).max(100).optional(),
    buAffinityScore: z.number().min(0).max(100).optional(),
    activationPotentialScore: z.number().min(0).max(100).optional(),
  }).optional(),
});

export type ContentOpportunityInput = z.infer<typeof contentOpportunitySchema>;

export type ContentOpportunityResult = {
  title: string;
  businessUnitName: string;
  territory: string;
  audience: string;
  adherenceScore: number;
  whyNow: string;
  stepps: Array<{ key: string; reason: string }>;
  draft: string[];
  sources: Array<{ title: string; confidence: "confirmed" | "inference" | "unverified"; notes: string }>;
};

export function createContentOpportunity(input: ContentOpportunityInput): ContentOpportunityResult {
  const parsed = contentOpportunitySchema.parse(input);
  const unit = getBusinessUnitDna(parsed.businessUnitId);
  const territory = unit.authorityTerritories[0]?.name ?? unit.contentDna.prioritySubjects[0] ?? unit.name;
  const product = unit.products[0]?.name ?? unit.name;
  const audience = unit.icps[0]?.name ?? unit.personas[0]?.name ?? "público comercial da BU";
  const voiceSignal = parsed.personalVoice.trim() ? `com a sua voz: ${parsed.personalVoice.trim()}` : `no tom ${unit.contentDna.tone}`;
  const cta = unit.contentDna.recommendedCtas[0] ?? "qual prioridade merece conversa agora?";

  return {
    title: `${territory}: oportunidade editorial da semana`,
    businessUnitName: unit.name,
    territory,
    audience,
    adherenceScore: Math.min(100, 76 + unit.contentDna.prioritySubjects.length * 3 + unit.authorityTerritories.length * 4),
    whyNow: reviewPortugueseCopy(`O objetivo "${parsed.objective}" combina com ${territory} porque conecta oferta, dor de mercado e critério de autoridade da BU.`),
    stepps: [
      { key: "Valor prático", reason: "Transforma repertório da BU em utilidade concreta para o ICP." },
      { key: "Histórias", reason: "Permite mostrar aprendizado aplicado sem prometer resultado sem fonte." },
      { key: "Gatilhos", reason: `Mantém ${territory} associado a conversas recorrentes do mercado.` },
    ],
    draft: reviewPortugueseList([
      `Gancho: Uma coisa que ${audience} costuma subestimar sobre ${territory}.`,
      `Desenvolvimento: conecte o problema ao produto ${product}, usando ${voiceSignal}.`,
      "Prova: cite apenas evidências aprovadas ou diga claramente que é uma hipótese.",
      `CTA: ${cta}`,
    ]),
    sources: [
      {
        title: `DNA editorial da BU ${unit.name}`,
        confidence: "confirmed",
        notes: "Tom, assuntos, chamadas para ação e afirmações vieram do DNA da BU configurado.",
      },
      {
        title: "Objetivo informado pelo usuário",
        confidence: "confirmed",
        notes: parsed.objective,
      },
      {
        title: "Tendências externas",
        confidence: "unverified",
        notes: "Radar de notícias e calendário externo ainda não conectados nesta etapa.",
      },
    ],
  };
}
