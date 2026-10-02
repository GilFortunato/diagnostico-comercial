import { z } from "zod";

export const brandIdSchema = z.enum(["share", "ache", "prosper", "potencia"]);
export type BrandId = z.infer<typeof brandIdSchema>;
export const sourceIdSchema = z.enum(["google-trends", "agencia-brasil", "hacker-news", "youtube"]);
export type SourceId = z.infer<typeof sourceIdSchema>;
export const publicUrlSchema = z.string().url().refine((value) => /^https?:\/\//i.test(value), "A URL deve ser HTTP ou HTTPS.");
const timestamp = z.string().datetime();

export const signalSchema = z.object({
  id: z.string().min(1).max(100),
  source: sourceIdSchema,
  sourceType: z.enum(["search", "news", "community", "video"]),
  title: z.string().min(1).max(500),
  url: publicUrlSchema.nullable(),
  publisher: z.string().max(200).nullable(),
  publishedAt: timestamp.nullable(),
  detectedAt: timestamp,
  firstDetectedAt: timestamp.optional(),
  relatedSignalId: z.string().min(1).max(100).optional(),
  evidence: z.array(z.string().max(1600)).min(1).max(8),
  rawMetrics: z.record(z.string().max(80), z.number().finite().nonnegative()),
  confidence: z.number().min(0).max(1),
  geography: z.enum(["BR", "global"]),
});
export type Signal = z.infer<typeof signalSchema>;

export const scoreComponentSchema = z.object({
  key: z.enum(["velocity", "recency", "volume", "sourceDiversity", "brandRelevance"]),
  label: z.string(),
  value: z.number().min(0).max(100).nullable(),
  weight: z.number().min(0).max(1),
  explanation: z.string(),
});
export const trendSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  summary: z.string(),
  signals: z.array(signalSchema).min(1).max(60),
  firstDetectedAt: timestamp,
  lastDetectedAt: timestamp,
  score: z.object({
    value: z.number().min(0).max(100),
    components: z.array(scoreComponentSchema),
    explanation: z.string(),
  }),
  growthExplanation: z.string(),
  brandRelevance: z.object({ score: z.number().min(0).max(100), label: z.enum(["Alta", "Média", "Baixa"]), reason: z.string() }),
  independentSourceCount: z.number().int().nonnegative(),
});
export type Trend = z.infer<typeof trendSchema>;
export type ScoreComponent = z.infer<typeof scoreComponentSchema>;
export const sourceStatusSchema = z.object({
  id: sourceIdSchema,
  name: z.string(),
  status: z.enum(["ok", "empty", "unavailable", "stale"]),
  count: z.number().int().nonnegative(),
  collectedAt: timestamp,
  message: z.string(),
});
export type SourceStatus = z.infer<typeof sourceStatusSchema>;
