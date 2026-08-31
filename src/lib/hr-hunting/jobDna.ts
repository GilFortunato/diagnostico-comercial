import "server-only";
import { generateGeminiJson } from "@/lib/ai/geminiClient";
import { jobDnaSchema, type JobDna } from "@/lib/hr-hunting/types";

const protectedTerms = /\b(g[eê]nero|mulher(?:es)?|homem(?:ens)?|ra[çc]a|etnia|religi[aã]o|idade|estado civil|gravidez|defici[eê]ncia|orienta[çc][aã]o sexual|pol[ií]tica)\b/i;

export async function createJobDna(input: { title: string; description: string }): Promise<JobDna> {
  try {
    const raw = await generateGeminiJson<unknown>({
      capability: "ai.extractEvidence",
      temperature: 0.05,
      prompt: buildPrompt(input),
    });
    const parsed = jobDnaSchema.safeParse(raw);
    if (parsed.success) return sanitizeJobDna(parsed.data, input);
  } catch {
    // A vaga permanece utilizável sem gerar requisitos que não estejam no texto.
  }
  return conservativeJobDna(input);
}

export function sanitizeJobDna(dna: JobDna, input: { title: string; description: string }): JobDna {
  const description = normalize(input.description);
  return {
    ...dna,
    title: dna.title || input.title,
    responsibilities: dna.responsibilities.filter((item) => !protectedTerms.test(item)),
    criteria: dna.criteria.filter((criterion) => !protectedTerms.test(criterion.label) && description.includes(normalize(criterion.sourceExcerpt).slice(0, 24))),
    interviewChecks: dna.interviewChecks.filter((item) => !protectedTerms.test(item)),
  };
}

export function conservativeJobDna(input: { title: string; description: string }): JobDna {
  const lines = input.description.split(/\n|[.;]/).map((value) => value.trim()).filter((value) => value.length >= 12 && !protectedTerms.test(value));
  const criteria = lines.filter((line) => /requisit|necess[aá]ri|experi[eê]ncia|conhecimento|compet[eê]ncia|desej[aá]vel/i.test(line)).slice(0, 8)
    .map((line, index) => ({ id: `criterio-${index + 1}`, label: line.slice(0, 180), kind: /desej[aá]vel|diferencial/i.test(line) ? "desejável" as const : "obrigatório" as const, sourceExcerpt: line.slice(0, 500) }));
  return { title: input.title, shortSummary: lines[0]?.slice(0, 600) || "A oportunidade será analisada com base nos critérios informados pela recrutadora.", responsibilities: lines.filter((line) => /respons|atuar|conduzir|liderar|desenvolver/i.test(line)).slice(0, 8), criteria, interviewChecks: [] };
}

function buildPrompt(input: { title: string; description: string }) {
  return `Você estrutura vagas para o módulo HR Hunting da Share AI.\n\nTítulo informado: ${input.title}\nDescrição da vaga:\n${input.description}\n\nRegras obrigatórias:\n- Extraia somente informações explicitamente sustentadas pela descrição. Não complete lacunas.\n- Não inclua características pessoais ou protegidas, como gênero, raça, etnia, religião, idade, estado civil, gravidez, deficiência, orientação sexual ou opiniões políticas.\n- Para cada critério, preserve um trecho curto da vaga em sourceExcerpt que comprove a extração.\n- Quando a descrição não sustentar um campo, omita-o ou use listas vazias.\n- Classifique cada critério como obrigatório, desejável ou não relevante apenas quando a linguagem da vaga justificar isso.\n- Escreva em português brasileiro (pt-BR), com ortografia, acentuação, concordância, regência e pontuação impecáveis.\n- Antes de devolver a resposta, faça uma revisão editorial silenciosa do próprio texto.\n\nResponda em JSON com title, shortSummary, mission, area, seniority, location, workModel, responsibilities, criteria e interviewChecks.`;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
