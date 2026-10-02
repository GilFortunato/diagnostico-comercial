import { z } from "zod";
import { brandIdSchema } from "./types";

const text = z.string().min(1).max(4000);
export const opportunitySchema = z.object({
  id: z.string(), channel: text, format: text, title: text, angle: text, audience: text,
  objective: text, hook: text, structure: z.array(text).min(2).max(10), cta: text, rationale: text,
});
export const visualDirectionSchema = z.object({
  concept: text, composition: text, mood: text, medium: text, palette: z.array(text),
  framing: text, negativeSpace: text, include: z.array(text), avoid: z.array(text),
  noText: z.array(text), channels: z.array(z.object({ channel: text, format: text, guidance: text })),
  searchTerms: z.array(text),
});
export const scoutAnalysisSchema = z.object({
  id: z.string(), trendId: z.string(), brandId: brandIdSchema, generatedAt: z.string(),
  mode: z.literal("editorial"), whatHappened: text, whyNow: text, brandInterpretation: text,
  risks: z.array(text), opportunities: z.array(opportunitySchema), visual: visualDirectionSchema,
  evidenceIds: z.array(z.string()),
});
export const copyOutputSchema = z.object({
  title: text, body: z.string().min(30).max(14000),
  evidenceIds: z.array(z.string()).min(1).max(30),
});
export const scoutGenerationSchema = copyOutputSchema.extend({
  id: z.string(), trendId: z.string(), brandId: brandIdSchema, opportunityId: z.string(),
  createdAt: z.string(), sourceUrls: z.array(z.string()), mode: z.enum(["ai", "editorial"]),
  model: z.string().nullable(), persistent: z.boolean(), cached: z.boolean(), notice: z.string().nullable(),
  usage: z.object({ inputTokens: z.number(), outputTokens: z.number(), costUsd: z.number().nullable() }),
});
export type ContentOpportunity = z.infer<typeof opportunitySchema>;
export type VisualDirection = z.infer<typeof visualDirectionSchema>;
export type ScoutAnalysis = z.infer<typeof scoutAnalysisSchema>;
export type ScoutGeneration = z.infer<typeof scoutGenerationSchema>;
