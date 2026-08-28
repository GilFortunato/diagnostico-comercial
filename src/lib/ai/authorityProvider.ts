import { createAuthorityAssessment, type AuthorityAssessment, type AuthorityInput, type ResearchSource } from "@/lib/diagnostics/authority";
import { resolveProviderForCapability } from "@/lib/ai/providers";

type GeminiAuthorityPayload = {
  overallScore?: number;
  summary?: string;
  strengths?: string[];
  gaps?: string[];
  risks?: string[];
  opportunities?: string[];
  recommendations?: string[];
};

const geminiModel = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";

export async function createAuthorityAssessmentWithProvider(input: AuthorityInput, userGeminiApiKey?: string | null, extraSources: ResearchSource[] = []): Promise<AuthorityAssessment> {
  const fallback = createAuthorityAssessment(input, extraSources);
  const provider = resolveProviderForCapability("ai.generateStructuredAssessment", process.env.DEFAULT_AI_PROVIDER);
  const geminiApiKey = userGeminiApiKey || process.env.GEMINI_API_KEY;

  if (provider?.key !== "gemini" || !geminiApiKey) {
    return fallback;
  }

  try {
    const geminiResult = await generateWithGemini(input, geminiApiKey);

    return {
      ...fallback,
      adapter: "gemini",
      overallScore: normalizeScore(geminiResult.overallScore, fallback.overallScore),
      summary: geminiResult.summary ?? fallback.summary,
      strengths: selectList(geminiResult.strengths, fallback.strengths),
      gaps: selectList(geminiResult.gaps, fallback.gaps),
      risks: selectList(geminiResult.risks, fallback.risks),
      opportunities: selectList(geminiResult.opportunities, fallback.opportunities),
      recommendations: selectList(geminiResult.recommendations, fallback.recommendations),
      sources: [
        ...fallback.sources.filter((source) => source.title !== "Avaliacao heuristica local"),
        {
          title: "Analise estruturada via Google Gemini",
          confidence: "inference",
          notes: "A IA avaliou somente os dados informados ou autorizados. Nenhum scraping de LinkedIn foi executado.",
        },
      ],
    };
  } catch {
    return fallback;
  }
}

async function generateWithGemini(input: AuthorityInput, apiKey: string): Promise<GeminiAuthorityPayload> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.35,
        response_mime_type: "application/json",
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: buildPrompt(input),
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("Gemini request failed.");
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("Gemini response was empty.");
  }

  return JSON.parse(text) as GeminiAuthorityPayload;
}

function buildPrompt(input: AuthorityInput) {
  return `
Voce e um avaliador senior de autoridade comercial B2B. Avalie o perfil com foco em percepcao de cliente, reputacao e potencial de gerar conversa comercial.

Regras:
- Nao invente dados externos.
- Nao afirme que acessou ou raspou LinkedIn.
- Use apenas as informacoes abaixo.
- Responda somente JSON valido.

Entrada:
BU: ${input.businessUnitName}
URL de referencia: ${input.profileUrl || "nao informada"}
Objetivo comercial: ${input.objective}
Headline: ${input.headline}
Sobre: ${input.about}
Temas: ${input.themes}
Provas e resultados: ${input.proofPoints}
Conteudos recentes: ${input.recentContent}
Interacoes e networking: ${input.interactionSignals}

Formato:
{
  "overallScore": 0,
  "summary": "",
  "strengths": [],
  "gaps": [],
  "risks": [],
  "opportunities": [],
  "recommendations": []
}
`;
}

function normalizeScore(score: unknown, fallback: number) {
  if (typeof score !== "number" || Number.isNaN(score)) return fallback;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function selectList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const clean = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return clean.length ? clean.slice(0, 6) : fallback;
}
