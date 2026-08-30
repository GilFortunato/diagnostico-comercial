import { z } from "zod";
import { getBusinessUnitDna } from "@/lib/business-units/dna";
import { reviewPortugueseCopy, reviewPortugueseList } from "@/lib/copy/editorial";
import { buildHookVariants, type CirculationPotential, type HookIntelligence } from "@/lib/social-selling/contentQualityGate";
import { buildInterestGraphStrategy, type InterestGraphStrategy } from "@/lib/social-selling/linkedinAlgorithmStrategy";

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
  expertReading: string;
  thesis: string;
  hook: HookIntelligence;
  interestGraph: InterestGraphStrategy;
  circulationPotential: CirculationPotential;
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
  const thesis = `Em ${territory}, decisões mais úteis surgem quando ${audience} consegue ligar contexto, critério e evidência antes de escolher uma solução.`;
  const hookVariants = buildHookVariants({ thesis, territory });
  const hook: HookIntelligence = {
    variants: hookVariants,
    selectedType: hookVariants[0].type,
    selected: hookVariants[0].text,
    payoff: `O desenvolvimento deve mostrar como contexto, critério e evidência mudam a leitura de ${territory}, sem inventar experiência ou resultado.`,
  };
  const interestGraph = buildInterestGraphStrategy({
    personalThemes: unit.contentDna.prioritySubjects.slice(0, 3),
    territory,
    persona: audience,
    businessUnit: unit.name,
  });

  return {
    title: `${territory}: oportunidade editorial da semana`,
    businessUnitName: unit.name,
    territory,
    audience,
    adherenceScore: Math.min(100, 76 + unit.contentDna.prioritySubjects.length * 3 + unit.authorityTerritories.length * 4),
    whyNow: reviewPortugueseCopy(`O objetivo "${parsed.objective}" combina com ${territory} porque conecta oferta, dor de mercado e critério de autoridade da BU.`),
    expertReading: reviewPortugueseCopy(`O objetivo informado ganha relevância quando deixa de ser uma pauta genérica e assume uma tensão concreta de ${audience} em ${territory}. A BU oferece contexto, mas a autoridade precisa partir da perspectiva da pessoa.`),
    thesis: reviewPortugueseCopy(thesis),
    hook,
    interestGraph,
    circulationPotential: {
      level: "Médio",
      rationale: "Existe coerência entre território, audiência e valor prático, mas a força final depende de experiência, exemplo ou opinião real acrescentados pela pessoa.",
      disclaimer: "Avaliação editorial qualitativa; não é previsão de alcance ou viralidade.",
    },
    stepps: [
      { key: "Valor prático", reason: "Transforma repertório da BU em utilidade concreta para o ICP." },
      { key: "Histórias", reason: "Permite mostrar aprendizado aplicado sem prometer resultado sem fonte." },
      { key: "Gatilhos", reason: `Mantém ${territory} associado a conversas recorrentes do mercado.` },
    ],
    draft: reviewPortugueseList([
      hook.selected,
      `Desenvolva a tese com um problema concreto de ${audience} e uma perspectiva ${voiceSignal}.`,
      `Conecte o tema ao contexto de ${product} somente quando a ponte for legítima, sem transformar a pessoa em porta-voz da BU.`,
      "Use apenas evidências aprovadas ou declare claramente quando algo for interpretação ou hipótese.",
      `Se uma chamada fizer sentido para o objetivo, considere: ${cta}`,
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
