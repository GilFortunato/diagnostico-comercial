import "server-only";

import { z } from "zod";
import { getBrandContext, type BrandContext } from "@/lib/scout/mkt/brands";
import type { BrandId } from "@/lib/scout/mkt/types";

export const moodboardInputSchema = z.object({
  projectName: z.string().trim().min(2).max(160),
  brandId: z.enum(["share", "ache", "prosper", "potencia"]),
  briefing: z.string().trim().min(20).max(6000),
  audience: z.string().trim().max(600).default(""),
  deliverable: z.string().trim().max(400).default(""),
  mustHave: z.string().trim().max(1200).default(""),
  avoid: z.string().trim().max(1200).default(""),
  approvedHistory: z.string().trim().max(1800).default(""),
});

const directionSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(2).max(100),
  concept: z.string().min(10).max(700),
  composition: z.string().min(5).max(500),
  photographicStyle: z.string().min(5).max(500),
  typography: z.string().min(2).max(300),
  palette: z.array(z.object({ name: z.string().max(80), hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/) })).min(3).max(6),
  keywords: z.array(z.string().min(2).max(80)).min(3).max(10),
  searchQuery: z.string().min(3).max(300),
});

export const moodboardInterpretationSchema = z.object({
  objective: z.string().min(10).max(700),
  coreMessage: z.string().min(5).max(500),
  audienceReading: z.string().min(5).max(500),
  ambiguities: z.array(z.string().max(300)).max(6),
  guardrails: z.array(z.string().max(300)).max(8),
  directions: z.array(directionSchema).min(2).max(3),
});

export type MoodboardInput = z.infer<typeof moodboardInputSchema>;
export type MoodboardInterpretation = z.infer<typeof moodboardInterpretationSchema>;
export type MoodboardDirection = z.infer<typeof directionSchema>;

export async function interpretMoodboardBrief(input: MoodboardInput): Promise<{ interpretation: MoodboardInterpretation; mode: "ai" | "fallback" }> {
  const brand = getBrandContext(input.brandId as BrandId);
  const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GEMINI_API_KEY?.trim();
  if (!apiKey) return { interpretation: fallbackInterpretation(input, brand), mode: "fallback" };

  const model = process.env.SCOUT_GEMINI_MODEL || process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const prompt = [
    "Você é um diretor de arte sênior e estrategista visual.",
    "Transforme um briefing de design em rotas visuais que possam ser usadas para pesquisar referências fotográficas e montar um moodboard preliminar.",
    "Não invente fatos sobre a marca, público ou projeto. Use apenas o briefing e o contexto fornecido.",
    "Não dependa de Pinterest ou Behance. As consultas de imagem serão executadas em bancos como Unsplash, Pexels, Pixabay e Openverse.",
    "As searchQuery devem ser curtas, concretas e preferencialmente em inglês, com termos que funcionem em bancos de imagem.",
    "As rotas devem ser diferentes entre si, mas todas coerentes com o briefing.",
    "A paleta é direção criativa, não identidade oficial. Não altere cores obrigatórias citadas pelo usuário.",
    "",
    "CONTEXTO DA MARCA:",
    JSON.stringify({ name: brand.name, description: brand.description, audience: brand.audience, voice: brand.voice, avoid: brand.avoid }),
    "",
    "PROJETO:",
    JSON.stringify(input),
  ].join("\n");

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              objective: { type: "string" },
              coreMessage: { type: "string" },
              audienceReading: { type: "string" },
              ambiguities: { type: "array", items: { type: "string" } },
              guardrails: { type: "array", items: { type: "string" } },
              directions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    concept: { type: "string" },
                    composition: { type: "string" },
                    photographicStyle: { type: "string" },
                    typography: { type: "string" },
                    palette: {
                      type: "array",
                      items: { type: "object", properties: { name: { type: "string" }, hex: { type: "string" } }, required: ["name", "hex"] },
                    },
                    keywords: { type: "array", items: { type: "string" } },
                    searchQuery: { type: "string" },
                  },
                  required: ["id","name","concept","composition","photographicStyle","typography","palette","keywords","searchQuery"],
                },
              },
            },
            required: ["objective","coreMessage","audienceReading","ambiguities","guardrails","directions"],
          },
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error("provider");
    const body = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const raw = body.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
    if (!raw) throw new Error("empty");
    const parsed = moodboardInterpretationSchema.parse(JSON.parse(stripCodeFence(raw)));
    return { interpretation: parsed, mode: "ai" };
  } catch {
    return { interpretation: fallbackInterpretation(input, brand), mode: "fallback" };
  }
}

function fallbackInterpretation(input: MoodboardInput, brand: BrandContext): MoodboardInterpretation {
  const seed = input.briefing.split(/[,.\n;]+/).map((item) => item.trim()).filter(Boolean).slice(0, 5);
  const base = seed.join(" ") || input.projectName;
  return {
    objective: `Traduzir o briefing de ${input.projectName} em referências visuais que reduzam a pesquisa manual e facilitem a validação inicial.`,
    coreMessage: input.briefing.slice(0, 360),
    audienceReading: input.audience || brand.audience,
    ambiguities: ["A interpretação por IA está indisponível; revise objetivo, público e restrições antes de aprovar a rota."],
    guardrails: [input.mustHave, input.avoid, ...brand.avoid].filter(Boolean).slice(0, 8),
    directions: [
      makeFallbackDirection("route-a", "Direção editorial", base, "#0B4A39", "#D8F04A", "#F4F7EF"),
      makeFallbackDirection("route-b", "Direção humana", `people ${base}`, "#173E32", "#B9D7A7", "#F6F1E8"),
    ],
  };
}

function makeFallbackDirection(id: string, name: string, query: string, a: string, b: string, c: string): MoodboardDirection {
  return {
    id,
    name,
    concept: "Uma rota inicial derivada diretamente do briefing, preparada para validação visual.",
    composition: "Composição limpa, foco claro no sujeito e espaço para aplicação de texto.",
    photographicStyle: "Fotografia editorial contemporânea, natural e pouco posada.",
    typography: "Tipografia sem serifa, hierarquia direta e boa legibilidade.",
    palette: [{ name: "Base", hex: a }, { name: "Acento", hex: b }, { name: "Neutro", hex: c }],
    keywords: query.split(/\s+/).filter(Boolean).slice(0, 8),
    searchQuery: query.slice(0, 280),
  };
}

function stripCodeFence(value: string) {
  return value.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}
