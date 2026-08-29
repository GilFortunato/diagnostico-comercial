import { z } from "zod";
import { getBusinessUnitDna } from "@/lib/business-units/dna";

export const decisionMakerSearchSchema = z.object({
  company: z.string().min(2),
  businessUnitId: z.string().min(1),
  objective: z.string().min(10),
  location: z.string().optional().default(""),
});

export type DecisionMakerSearchInput = z.infer<typeof decisionMakerSearchSchema>;

export type DecisionMakerResult = {
  company: {
    name: string;
    businessUnitName: string;
    fitScore: number;
    confidence: "inference" | "unverified";
    rationale: string[];
    buyingAreas: string[];
  };
  nextBestAction: {
    title: string;
    impact: "medium" | "high";
    effort: "low" | "medium";
    reason: string;
  };
  people: Array<{
    id: string;
    displayName: string;
    role: string;
    probableDecisionRole: "Decisor econômico" | "Decisor funcional" | "Champion" | "Influenciador" | "Porta de entrada";
    fitScore: number;
    accessibility: "Baixa" | "Média" | "Alta";
    confidence: "Inferência" | "Não verificado";
    whyRelevant: string;
    suggestedConversation: string;
    contactStatus: string;
    doNotUse: string[];
  }>;
  sources: Array<{
    title: string;
    confidence: "inference" | "unverified";
    notes: string;
  }>;
};

const roleByIndex: DecisionMakerResult["people"][number]["probableDecisionRole"][] = [
  "Decisor econômico",
  "Decisor funcional",
  "Champion",
  "Influenciador",
  "Porta de entrada",
];

export function createDecisionMakerSearch(input: DecisionMakerSearchInput): DecisionMakerResult {
  const parsed = decisionMakerSearchSchema.parse(input);
  const unit = getBusinessUnitDna(parsed.businessUnitId);
  const icp = unit.icps[0];
  const product = unit.products[0];
  const titles = uniqueList([...(icp?.decisionMakers ?? []), ...(icp?.influencers ?? []), ...(icp?.champions ?? []), ...unit.personas.map((persona) => persona.name)]).slice(0, 6);
  const territories = unit.authorityTerritories.map((territory) => territory.name);
  const buyingAreas = icp?.buyingAreas ?? unit.positioning.recommendedTerms;
  const fitScore = clampScore(62 + unit.products.length * 3 + unit.icps.length * 4 + unit.authorityTerritories.length * 2);

  const people: DecisionMakerResult["people"] = titles.map((title, index) => {
    const decisionRole = roleByIndex[index % roleByIndex.length];
    const score = clampScore(76 - index * 5 + (decisionRole === "Champion" ? 6 : 0));
    const territory = territories[index % Math.max(territories.length, 1)] ?? unit.name;

    return {
      id: `${slugify(parsed.company)}-${slugify(title)}`,
      displayName: "Pessoa a identificar",
      role: title,
      probableDecisionRole: decisionRole,
      fitScore: score,
      accessibility: index <= 1 ? "Média" : index <= 3 ? "Alta" : "Baixa",
      confidence: "Inferência",
      whyRelevant: `${title} tende a participar de decisões ligadas a ${territory} quando a conta possui uma agenda aderente ao objetivo informado.`,
      suggestedConversation: `Pesquisar sinais profissionais sobre ${territory} antes de abordar ${title}. A primeira conversa deve validar contexto, não vender imediatamente.`,
      contactStatus: "Nenhum contato profissional verificado nesta etapa.",
      doNotUse: [
        "Não usar dados pessoais ou sensíveis.",
        "Não presumir orçamento, organograma ou interesse sem fonte.",
        "Não enviar pitch antes de validar o contexto profissional.",
      ],
    };
  });

  return {
    company: {
      name: parsed.company,
      businessUnitName: unit.name,
      fitScore,
      confidence: "inference",
      rationale: [
        `Objetivo informado: ${parsed.objective}.`,
        product ? `Produto inicial considerado: ${product.name}.` : `BU considerada: ${unit.name}.`,
        buyingAreas.length ? `Áreas compradoras prováveis: ${buyingAreas.slice(0, 5).join(", ")}.` : "Áreas compradoras ainda não configuradas no DNA da BU.",
        parsed.location ? `Localização usada como filtro futuro: ${parsed.location}.` : "Sem filtro de localização nesta busca inicial.",
      ],
      buyingAreas,
    },
    nextBestAction: {
      title: people[1]?.role ? `Validar sinais públicos de ${people[1].role}` : "Completar ICP da BU antes de abordar",
      impact: "high",
      effort: "low",
      reason: "Ainda não há fonte externa confirmada. A melhor próxima ação é enriquecer poucos papéis antes de criar abordagem.",
    },
    people,
    sources: [
      {
        title: "DNA da BU configurado",
        confidence: "inference",
        notes: "Mapa gerado a partir do contexto institucional da BU, sem pesquisa externa.",
      },
      {
        title: "Empresa informada pelo usuário",
        confidence: "unverified",
        notes: "A empresa ainda não foi validada por fonte pública nesta etapa.",
      },
    ],
  };
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function uniqueList(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function slugify(value: string) {
  return value.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
