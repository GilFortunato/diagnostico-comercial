import { createAuthorityAssessment, type AuthorityAssessment, type AuthorityInput, type ResearchSource } from "@/lib/diagnostics/authority";
import { resolveProviderForCapability } from "@/lib/ai/providers";
import { ptBrEditorialInstruction, reviewPortugueseCopy, reviewPortugueseList, silentEditorialReviewInstruction } from "@/lib/copy/editorial";

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
    const authoritySellingScore = normalizeScore(geminiResult.overallScore, fallback.authoritySellingScore);

    return {
      ...fallback,
      adapter: "gemini",
      overallScore: authoritySellingScore,
      authoritySellingScore,
      summary: reviewPortugueseCopy(geminiResult.summary ?? fallback.summary),
      strengths: reviewPortugueseList(selectList(geminiResult.strengths, fallback.strengths)),
      gaps: reviewPortugueseList(selectList(geminiResult.gaps, fallback.gaps)),
      risks: reviewPortugueseList(selectList(geminiResult.risks, fallback.risks)),
      opportunities: reviewPortugueseList(selectList(geminiResult.opportunities, fallback.opportunities)),
      recommendations: reviewPortugueseList(selectList(geminiResult.recommendations, fallback.recommendations)),
      sources: [
        ...fallback.sources.filter((source) => source.title !== "Avaliação local"),
        {
          title: "Análise estruturada pela IA",
          confidence: "inference",
          notes: "A IA avaliou somente os dados informados ou autorizados. Nenhuma coleta não autorizada foi executada.",
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
    throw new Error("Não foi possível concluir a análise com a IA.");
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("A IA não retornou conteúdo para análise.");
  }

  return JSON.parse(text) as GeminiAuthorityPayload;
}

function buildPrompt(input: AuthorityInput) {
  return `
Você é um avaliador sênior de autoridade comercial B2B. Avalie o perfil com foco em percepção de cliente, reputação e potencial de gerar conversa comercial.
${ptBrEditorialInstruction}
${silentEditorialReviewInstruction}

Regras:
- Não invente dados externos.
- Não afirme que acessou ou raspou LinkedIn.
- Use apenas as informações abaixo.
- Separe autoridade pessoal permanente de aderência temporária à BU.
- Não use DNA da BU como se fosse informação encontrada no perfil da pessoa.
- Responda somente JSON válido.

Entrada:
BU: ${input.businessUnitName}
URL de referência: ${input.profileUrl || "não informada"}
Objetivo comercial: ${input.objective}
Headline: ${input.headline}
Sobre: ${input.about}
Temas: ${input.themes}
Provas e resultados: ${input.proofPoints}
Conteúdos recentes: ${input.recentContent}
Interações e networking: ${input.interactionSignals}
DNA da BU: ${JSON.stringify(input.businessUnitContext ?? {}, null, 2)}

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
