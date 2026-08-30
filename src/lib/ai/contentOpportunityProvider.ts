import "server-only";
import { generateGeminiJson } from "@/lib/ai/geminiClient";
import { getBusinessUnitDna } from "@/lib/business-units/dna";
import { createContentOpportunity, type ContentOpportunityInput, type ContentOpportunityResult } from "@/lib/content/intelligence";
import { ptBrEditorialInstruction, reviewPortugueseCopy, reviewPortugueseList, silentEditorialReviewInstruction } from "@/lib/copy/editorial";
import { assertAuthorityContentQuality, buildContentQualityPromptSection, type CirculationPotential, type HookIntelligence, type HookType } from "@/lib/social-selling/contentQualityGate";
import { buildLinkedInAlgorithmPromptSection } from "@/lib/social-selling/linkedinAlgorithmStrategy";
import { buildSocialSellingPromptSection } from "@/lib/social-selling/socialSellingStrategy";

type GeminiContentPayload = {
  title?: string;
  whyNow?: string;
  expertReading?: string;
  thesis?: string;
  hook?: Partial<HookIntelligence>;
  circulationPotential?: Partial<CirculationPotential>;
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

  const expertReading = reviewPortugueseCopy(generated.expertReading ?? structure.expertReading);
  const thesis = reviewPortugueseCopy(generated.thesis ?? structure.thesis);
  const hook = normalizeHook(generated.hook, structure.hook);
  const stepps = normalizeStepps(generated.stepps, structure.stepps);
  const draft = ensureSelectedHook(reviewPortugueseList(normalizeDraft(generated.draft, structure.draft)), hook.selected);
  const result: ContentOpportunityResult = {
    ...structure,
    title: reviewPortugueseCopy(generated.title ?? structure.title),
    whyNow: reviewPortugueseCopy(generated.whyNow ?? structure.whyNow),
    expertReading,
    thesis,
    hook,
    circulationPotential: normalizeCirculationPotential(generated.circulationPotential, structure.circulationPotential),
    stepps,
    draft,
    sources: [
      ...structure.sources.filter((source) => source.title !== "Tendências externas"),
      {
        title: "Inteligência editorial da Share AI",
        confidence: "inference",
        notes: "O rascunho foi gerado com o objetivo informado, o DNA da BU e o contexto autorizado do diagnóstico.",
      },
    ],
  };

  assertAuthorityContentQuality({
    post: result.draft.join("\n\n"),
    expertReading: result.expertReading,
    thesis: result.thesis,
    hook: result.hook,
    businessUnitName: result.businessUnitName,
    primaryStepps: result.stepps.slice(0, 2).map((item) => item.key),
  });

  return result;
}

function buildContentPrompt(input: ContentOpportunityInput, structure: ContentOpportunityResult) {
  const unit = getBusinessUnitDna(input.businessUnitId);
  return `
Você é especialista sênior em conteúdo B2B, autoridade comercial, social selling e STEPPS.
${ptBrEditorialInstruction}
${silentEditorialReviewInstruction}
${buildLinkedInAlgorithmPromptSection()}
${buildSocialSellingPromptSection()}
${buildContentQualityPromptSection()}

Crie um rascunho consultivo para LinkedIn. Antes de escrever, produza leitura do especialista, tese e três opções de gancho; selecione uma e faça o corpo entregar sua promessa.
Não invente fatos, tendências, resultados, experiências ou fontes.
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
  "expertReading": "",
  "thesis": "",
  "hook": {
    "variants": [
      { "type": "CONTRADICTION_TENSION", "text": "" },
      { "type": "SPECIFIC_PERSONAL", "text": "" },
      { "type": "INSIGHT_QUESTION", "text": "" }
    ],
    "selectedType": "CONTRADICTION_TENSION | SPECIFIC_PERSONAL | INSIGHT_QUESTION",
    "selected": "primeira frase exata do rascunho",
    "payoff": "como o desenvolvimento entrega o gancho"
  },
  "circulationPotential": { "level": "Baixo | Médio | Alto", "rationale": "avaliação editorial qualitativa" },
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

function normalizeHook(value: Partial<HookIntelligence> | undefined, fallback: HookIntelligence): HookIntelligence {
  if (!value || !Array.isArray(value.variants) || value.variants.length !== 3) return fallback;
  const allowedTypes = new Set<HookType>(["CONTRADICTION_TENSION", "SPECIFIC_PERSONAL", "INSIGHT_QUESTION"]);
  const variants = value.variants.filter((item) => allowedTypes.has(item.type) && typeof item.text === "string" && item.text.trim().length >= 12);
  if (variants.length !== 3 || !allowedTypes.has(value.selectedType as HookType) || typeof value.selected !== "string" || typeof value.payoff !== "string") return fallback;
  return {
    variants: variants.map((item) => ({ type: item.type, text: reviewPortugueseCopy(item.text) })),
    selectedType: value.selectedType as HookType,
    selected: reviewPortugueseCopy(value.selected),
    payoff: reviewPortugueseCopy(value.payoff),
  };
}

function normalizeCirculationPotential(value: Partial<CirculationPotential> | undefined, fallback: CirculationPotential): CirculationPotential {
  if (!value || (value.level !== "Baixo" && value.level !== "Médio" && value.level !== "Alto") || typeof value.rationale !== "string") return fallback;
  return {
    level: value.level,
    rationale: reviewPortugueseCopy(value.rationale),
    disclaimer: "Avaliação editorial qualitativa; não é previsão de alcance ou viralidade.",
  };
}

function ensureSelectedHook(draft: string[], selected: string) {
  if (draft.length && normalize(draft[0]) === normalize(selected)) return draft;
  return [selected, ...draft.filter((item) => normalize(item) !== normalize(selected))];
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}
