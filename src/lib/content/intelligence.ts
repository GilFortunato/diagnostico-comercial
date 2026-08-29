import { z } from "zod";
import { getBusinessUnitDna } from "@/lib/business-units/dna";

export const contentOpportunitySchema = z.object({
  businessUnitId: z.string().min(1),
  objective: z.string().min(8),
  personalVoice: z.string().optional().default(""),
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
  const audience = unit.icps[0]?.name ?? unit.personas[0]?.name ?? "publico comercial da BU";
  const voiceSignal = parsed.personalVoice.trim() ? `com a sua voz: ${parsed.personalVoice.trim()}` : `no tom ${unit.contentDna.tone}`;
  const cta = unit.contentDna.recommendedCtas[0] ?? "qual prioridade merece conversa agora?";

  return {
    title: `${territory}: oportunidade editorial da semana`,
    businessUnitName: unit.name,
    territory,
    audience,
    adherenceScore: Math.min(100, 76 + unit.contentDna.prioritySubjects.length * 3 + unit.authorityTerritories.length * 4),
    whyNow: `O objetivo "${parsed.objective}" combina com ${territory} porque conecta oferta, dor de mercado e criterio de autoridade da BU.`,
    stepps: [
      { key: "Practical Value", reason: "Transforma repertorio da BU em utilidade concreta para o ICP." },
      { key: "Stories", reason: "Permite mostrar aprendizado aplicado sem prometer resultado sem fonte." },
      { key: "Triggers", reason: `Mantem ${territory} associado a conversas recorrentes do mercado.` },
    ],
    draft: [
      `Gancho: Uma coisa que ${audience} costuma subestimar sobre ${territory}.`,
      `Desenvolvimento: conecte o problema ao produto ${product}, usando ${voiceSignal}.`,
      `Prova: cite apenas evidencias aprovadas ou diga claramente que e uma hipotese.`,
      `CTA: ${cta}`,
    ],
    sources: [
      {
        title: `Content DNA da BU ${unit.name}`,
        confidence: "confirmed",
        notes: "Tom, assuntos, CTAs e claims vieram do BU DNA configurado.",
      },
      {
        title: "Objetivo informado pelo usuario",
        confidence: "confirmed",
        notes: parsed.objective,
      },
      {
        title: "Tendencias externas",
        confidence: "unverified",
        notes: "Radar de noticias e calendario externo ainda nao conectado nesta etapa.",
      },
    ],
  };
}
