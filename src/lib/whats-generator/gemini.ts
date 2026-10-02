import "server-only";

type GenerateRecipient = {
  id: string;
  name: string;
  job: string;
};

type GeminiMessagePayload = {
  messages: Array<{ recipientId: string; message: string }>;
};

const DEFAULT_MODEL = "gemini-3.6-flash";

export async function generateIndividualWhatsMessages(input: {
  baseText: string;
  tone: string;
  recipients: GenerateRecipient[];
}) {
  if (!input.recipients.length) return new Map<string, string>();

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini não está configurado no ambiente.");

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const prompt = [
    "Você é um assistente de comunicação profissional da Share People Hub.",
    "Sua tarefa é redigir UMA mensagem individual de WhatsApp para CADA contato fornecido.",
    "Cada mensagem deve comunicar exatamente a intenção e os fatos do texto-base, mas com redação natural e individual.",
    "Não invente fatos sobre a pessoa, vaga, empresa, datas, links, benefícios ou processo.",
    "Use somente o nome e a vaga fornecidos para personalização factual.",
    "Corrija ortografia, clareza, fluidez e adequação ao WhatsApp sem alterar os fatos.",
    "Se o texto-base tiver {nome} ou {vaga}, substitua pelos valores do contato e nunca deixe esses placeholders na mensagem final.",
    "Não inclua o telefone na mensagem.",
    "Preserve integralmente links, datas, horários, instruções, valores e informações obrigatórias presentes no texto-base.",
    "Não escreva sobre filtros antispam, bloqueios, detecção ou formas de contornar controles de plataforma.",
    "Evite redação mecânica. Varie abertura, estrutura, conectivos e chamada final de forma natural, sem alterar o significado.",
    "Mantenha o texto adequado para uma conversa profissional no WhatsApp.",
    `Tom desejado: ${input.tone}`,
    "",
    "TEXTO-BASE:",
    input.baseText,
    "",
    "CONTATOS:",
    JSON.stringify(input.recipients),
    "",
    "Retorne exatamente um objeto JSON com messages. Cada recipientId deve aparecer uma única vez.",
  ].join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              messages: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    recipientId: { type: "string" },
                    message: { type: "string" },
                  },
                  required: ["recipientId", "message"],
                },
              },
            },
            required: ["messages"],
          },
        },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gemini respondeu com erro ${response.status}${detail ? `: ${detail.slice(0, 240)}` : ""}.`);
  }

  const body = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
  if (!text) throw new Error("Gemini não retornou mensagens.");

  let parsed: GeminiMessagePayload;
  try {
    parsed = JSON.parse(stripCodeFence(text)) as GeminiMessagePayload;
  } catch {
    throw new Error("Gemini retornou um formato de mensagem inválido.");
  }

  const requested = new Set(input.recipients.map((recipient) => recipient.id));
  const result = new Map<string, string>();
  for (const item of parsed.messages || []) {
    const message = item.message?.trim();
    if (!requested.has(item.recipientId) || !message) continue;
    result.set(item.recipientId, message);
  }

  return result;
}

function stripCodeFence(value: string) {
  return value
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}
