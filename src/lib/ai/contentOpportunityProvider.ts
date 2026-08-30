import "server-only";
import { generateGeminiJson } from "@/lib/ai/geminiClient";
import { getBusinessUnitDna } from "@/lib/business-units/dna";
import { createContentOpportunity, type ContentOpportunityInput, type ContentOpportunityResult } from "@/lib/content/intelligence";
import { ptBrEditorialInstruction, reviewPortugueseCopy, reviewPortugueseList, silentEditorialReviewInstruction } from "@/lib/copy/editorial";

type GeminiContentPayload = {
  title?: string;
  whyNow?: string;
  stepps?: Array<{ key?: string; reason?: string }>;
  draft?: string[];
};

export async function createContentOpportunityWithProvider(input: ContentOpportunityInput): Promise<ContentOpportunityResult> {
  const structure = createContentOpportunity(input);
  const generated = await generateGeminiJson<GeminiContentPayload>({
    capability: "ai.generateContentPlan",
    prompt: buildContentPrompt(input, structure),
    temperature: 0.45,
  });

  return {
    ...structure,
    title: reviewPortugueseCopy(generated.title ?? structure.title),
    whyNow: reviewPortugueseCopy(generated.whyNow ?? structure.whyNow),
    stepps: normalizeStepps(generated.stepps, structure.stepps),
    draft: reviewPortugueseList(normalizeDraft(generated.draft, structure.draft)),
    sources: [
      ...structure.sources.filter((source) => source.title !== "Tendências externas"),
      {
        title: "Inteligência editorial da Share AI",
        confidence: "inference",
        notes: "O rascunho foi gerado com o objetivo informado, o DNA da BU e o contexto autorizado do diagnóstico.",
      },
    ],
  };
}

function buildContentPrompt(input: ContentOpportunityInput, structure: ContentOpportunityResult) {
  const unit = getBusinessUnitDna(input.businessUnitId);
  return `
Você é especialista sênior em conteúdo B2B, autoridade comercial, social selling e STEPPS.
${ptBrEditorialInstruction}
${silentEditorialReviewInstruction}

Crie um rascunho consultivo para LinkedIn. Não invente fatos, tendências, resultados, experiências ou fontes.
Use somente o objetivo, o DNA da BU, a voz pessoal e o contexto do diagnóstico fornecidos abaixo.
Nenhum conteúdo será publicado automaticamente; o texto será submetido à aprovação humana.
Responda somente JSON válido, sem markdown.

Entrada:
${JSON.stringify({
  objective: input.objective,
  personalVoice: input.personalVoice,
  authorityContext: input.authorityContext ?? null,
  businessUnit: unit,
  editorialStructure: structure,
}, null, 2)}

Formato:
{
  "title": "",
  "whyNow": "",
  "stepps": [{ "key": "", "reason": "" }],
  "draft": ["gancho", "desenvolvimento", "prova ou ressalva", "chamada para conversa"]
}
`;
}

function normalizeStepps(value: GeminiContentPayload["stepps"], fallback: ContentOpportunityResult["stepps"]) {
  if (!Array.isArray(value) || !value.length) return fallback;
  const normalized = value
    .filter((item) => typeof item?.key === "string" && typeof item?.reason === "string")
    .map((item) => ({ key: reviewPortugueseCopy(item.key!), reason: reviewPortugueseCopy(item.reason!) }))
    .slice(0, 5);
  return normalized.length ? normalized : fallback;
}

function normalizeDraft(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const normalized = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 8);
  return normalized.length ? normalized : fallback;
}
