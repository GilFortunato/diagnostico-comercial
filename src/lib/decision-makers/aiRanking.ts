import "server-only";
import { z } from "zod";
import { generateGeminiJson } from "@/lib/ai/geminiClient";
import { decisionRoles, type HuntingPerson } from "@/lib/decision-makers/search";

const aiRankingSchema = z.object({
  ranking: z.array(z.object({
    id: z.string(),
    probableDecisionRole: z.enum(decisionRoles),
    evidenceReason: z.string().min(10).max(400),
  })).max(10),
  nextBestAction: z.object({
    title: z.string().min(5).max(160),
    reason: z.string().min(10).max(500),
  }),
});

export type AiRankingResult = z.infer<typeof aiRankingSchema>;

export async function refineDecisionMakerRanking(people: HuntingPerson[], objective: string, businessUnitName: string) {
  if (people.length === 0) return null;
  const evidence = people.slice(0, 10).map((person) => ({
    id: person.id,
    title: person.title,
    company: person.company,
    department: person.department,
    seniority: person.seniority,
    deterministicScore: person.fitScore,
    evidenceReasons: person.fitReasons,
    recentSignals: person.recentSignals,
  }));

  const raw = await generateGeminiJson<unknown>({
    capability: "ai.rankDecisionMakers",
    temperature: 0.15,
    prompt: `Você é o classificador de Hunting Intelligence da Share AI.

Objetivo comercial: ${objective}
Business Unit: ${businessUnitName}

Pessoas reais já encontradas e suas evidências:
${JSON.stringify(evidence)}

Regras obrigatórias:
- Retorne somente IDs presentes na entrada. Nunca crie pessoa, empresa, cargo, contato ou evidência.
- Use apenas as evidências fornecidas para ordenar os IDs.
- Classifique o papel provável como um destes valores exatos: ${decisionRoles.join(", ")}.
- Não trate cargo como prova de orçamento ou poder final de decisão.
- A próxima melhor ação deve priorizar pesquisa, validação ou rapport; nunca envio automático.
- Escreva em português brasileiro (pt-BR), com ortografia, acentuação, concordância, regência e pontuação impecáveis.
- Antes de devolver a resposta, faça uma revisão editorial silenciosa do próprio texto.

Responda em JSON: {"ranking":[{"id":"...","probableDecisionRole":"...","evidenceReason":"..."}],"nextBestAction":{"title":"...","reason":"..."}}.`,
  });

  const parsed = aiRankingSchema.safeParse(raw);
  if (!parsed.success) return null;
  const knownIds = new Set(people.map((person) => person.id));
  if (parsed.data.ranking.some((item) => !knownIds.has(item.id))) return null;
  return parsed.data;
}

export function applyAiRanking(people: HuntingPerson[], result: AiRankingResult) {
  const byId = new Map(people.map((person) => [person.id, person]));
  const ordered: HuntingPerson[] = [];
  for (const item of result.ranking) {
    const person = byId.get(item.id);
    if (!person) continue;
    ordered.push({
      ...person,
      probableDecisionRole: item.probableDecisionRole,
      fitReasons: [...new Set([...person.fitReasons, item.evidenceReason])].slice(0, 6),
    });
    byId.delete(item.id);
  }
  return [...ordered, ...byId.values()];
}
