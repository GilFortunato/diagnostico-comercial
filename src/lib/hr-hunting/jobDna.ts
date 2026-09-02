import "server-only";
import { generateGeminiJson } from "@/lib/ai/geminiClient";
import { jobDnaSchema, type JobDna } from "@/lib/hr-hunting/types";

const protectedTerms = /\b(g[eê]nero|mulher(?:es)?|homem(?:ens)?|ra[çc]a|etnia|religi[aã]o|idade|estado civil|gravidez|defici[eê]ncia|orienta[çc][aã]o sexual|pol[ií]tica)\b/i;
const genericHeadings = /^(sobre (a )?vaga|descri[cç][aã]o|responsabilidades?|atribui[cç][oõ]es|requisitos?|qualifica[cç][oõ]es|compet[eê]ncias?|desej[aá]veis?|diferenciais?|benef[ií]cios?|localiza[cç][aã]o|local|modelo de trabalho|quem somos)\s*:??$/i;
const locationOnly = /^(?:local(?:iza[cç][aã]o)?\s*:\s*)?[\p{L} .'-]+\s*[,/-]\s*[A-Z]{2}(?:\s*[,/-]\s*(?:BR|Brasil))?$/iu;

type JobDnaInput = { title?: string; description: string };

export async function createJobDna(input: JobDnaInput): Promise<JobDna> {
  const prepared = prepareInput(input);
  try {
    const raw = await generateGeminiJson<unknown>({
      capability: "ai.extractEvidence",
      temperature: 0.05,
      prompt: buildPrompt(prepared),
    });
    const parsed = jobDnaSchema.safeParse(raw);
    if (parsed.success) return sanitizeJobDna(parsed.data, prepared);
  } catch {
    // A vaga permanece utilizável sem gerar requisitos que não estejam no texto.
  }
  return conservativeJobDna(prepared);
}

export function sanitizeJobDna(dna: JobDna, input: JobDnaInput): JobDna {
  const prepared = prepareInput(input);
  const description = normalize(prepared.description);
  const fallback = conservativeJobDna(prepared);
  const criteria = dna.criteria.filter((criterion) => {
    if (protectedTerms.test(criterion.label) || protectedTerms.test(criterion.sourceExcerpt)) return false;
    const excerpt = normalize(criterion.sourceExcerpt);
    return excerpt.length >= 8 && description.includes(excerpt.slice(0, Math.min(40, excerpt.length)));
  });
  const title = usefulTitle(dna.title) ? dna.title.trim() : fallback.title;
  const shortSummary = weakSummary(dna.shortSummary, title) ? fallback.shortSummary : dna.shortSummary.trim();

  return {
    ...dna,
    title,
    shortSummary,
    mission: meaningful(dna.mission) ? dna.mission?.trim() : fallback.mission,
    area: meaningful(dna.area) ? dna.area?.trim() : fallback.area,
    seniority: meaningful(dna.seniority) ? dna.seniority?.trim() : fallback.seniority,
    location: meaningful(dna.location) ? dna.location?.trim() : fallback.location,
    workModel: meaningful(dna.workModel) ? dna.workModel?.trim() : fallback.workModel,
    responsibilities: dna.responsibilities.filter((item) => !protectedTerms.test(item)).length
      ? dna.responsibilities.filter((item) => !protectedTerms.test(item))
      : fallback.responsibilities,
    criteria: criteria.length ? criteria : fallback.criteria,
    interviewChecks: dna.interviewChecks.filter((item) => !protectedTerms.test(item)),
  };
}

export function conservativeJobDna(input: JobDnaInput): JobDna {
  const prepared = prepareInput(input);
  const lines = cleanLines(prepared.description);
  const title = prepared.title?.trim() || extractTitle(lines) || "Oportunidade profissional";
  const location = extractLocation(lines);
  const workModel = extractWorkModel(lines);
  const sections = classifySections(lines);
  const responsibilities = uniqueStrings([
    ...sections.responsibilities,
    ...lines.filter((line) => /\b(atuar|conduzir|liderar|desenvolver|acompanhar|realizar|gerenciar|apoiar|atender|respons[aá]vel)\b/i.test(line)),
  ]).filter((line) => !protectedTerms.test(line)).slice(0, 10);

  const requiredLines = uniqueStrings([
    ...sections.required,
    ...lines.filter((line) => /\b(requisit|necess[aá]ri|experi[eê]ncia|conhecimento|compet[eê]ncia|dom[ií]nio|viv[eê]ncia|forma[cç][aã]o)\b/i.test(line)),
  ]).filter((line) => !protectedTerms.test(line));
  const desiredLines = uniqueStrings([
    ...sections.desired,
    ...lines.filter((line) => /\b(desej[aá]vel|diferencial|ser[aá] um plus|preferencial)\b/i.test(line)),
  ]).filter((line) => !protectedTerms.test(line));

  const criteria = uniqueStrings([...requiredLines, ...desiredLines]).slice(0, 16).map((line, index) => ({
    id: `criterio-${index + 1}`,
    label: stripBullet(line).slice(0, 180),
    kind: desiredLines.includes(line) ? "desejável" as const : "obrigatório" as const,
    sourceExcerpt: line.slice(0, 500),
  }));

  const summarySource = lines.filter((line) => isNarrativeLine(line, title, location)).slice(0, 2);
  const shortSummary = summarySource.length
    ? summarySource.join(" ").slice(0, 600)
    : [`Oportunidade de ${title}.`, location ? `Localização informada: ${location}.` : "", responsibilities[0] ? `Escopo informado: ${stripBullet(responsibilities[0])}.` : ""].filter(Boolean).join(" ").slice(0, 600);

  return {
    title,
    shortSummary,
    mission: summarySource[0]?.slice(0, 600),
    location: location || undefined,
    workModel: workModel || undefined,
    responsibilities,
    criteria,
    interviewChecks: [],
  };
}

function prepareInput(input: JobDnaInput): JobDnaInput {
  return { title: input.title?.trim() || undefined, description: input.description.trim() };
}

function buildPrompt(input: JobDnaInput) {
  return `Você estrutura vagas para o módulo HR Hunting da Share AI.\n\n${input.title ? `Título informado: ${input.title}\n` : "O título não foi informado separadamente. Extraia o cargo apenas se estiver explícito no texto da vaga.\n"}Vaga completa:\n${input.description}\n\nRegras obrigatórias:\n- Extraia somente informações explicitamente sustentadas pela vaga. Não complete lacunas.\n- title deve ser o nome do cargo, não a localização, empresa ou uma frase genérica.\n- shortSummary deve resumir a missão/escopo profissional da oportunidade em 1 a 3 frases; nunca use apenas cidade, estado, país, modelo de trabalho ou o próprio título como resumo.\n- Separe location, workModel, seniority, area, responsibilities e criteria quando o texto sustentar esses campos.\n- Não inclua características pessoais ou protegidas, como gênero, raça, etnia, religião, idade, estado civil, gravidez, deficiência, orientação sexual ou opiniões políticas.\n- Para cada critério, preserve um trecho curto e literal da vaga em sourceExcerpt que comprove a extração.\n- Quando a vaga não sustentar um campo, omita-o ou use listas vazias.\n- Classifique cada critério como obrigatório, desejável ou não relevante apenas quando a linguagem da vaga justificar isso.\n- Escreva em português brasileiro (pt-BR), com ortografia, acentuação, concordância, regência e pontuação impecáveis.\n- Antes de devolver a resposta, faça uma revisão editorial silenciosa do próprio texto.\n\nResponda em JSON com title, shortSummary, mission, area, seniority, location, workModel, responsibilities, criteria e interviewChecks.`;
}

function cleanLines(description: string) {
  return description.split(/\r?\n/).map((value) => value.replace(/\s+/g, " ").trim()).filter((value) => value.length >= 2);
}

function extractTitle(lines: string[]) {
  for (const line of lines.slice(0, 14)) {
    const labelled = line.match(/^(?:cargo|vaga|posi[cç][aã]o|oportunidade)\s*:\s*(.+)$/i)?.[1]?.trim();
    if (labelled && usefulTitle(labelled)) return labelled.slice(0, 180);
  }
  return lines.find((line) => usefulTitle(line))?.slice(0, 180) || "";
}

function usefulTitle(value: string) {
  const text = value.trim();
  if (text.length < 3 || text.length > 120) return false;
  if (genericHeadings.test(text) || locationOnly.test(text) || /^https?:\/\//i.test(text)) return false;
  if (/^(jundia[ií]|s[aã]o paulo|brasil|remoto|h[ií]brido|presencial)(?:\b|\s*[,/-])/i.test(text)) return false;
  return !/[.!?]$/.test(text) || text.split(/\s+/).length <= 8;
}

function extractLocation(lines: string[]) {
  const labelled = lines.find((line) => /^(?:local(?:iza[cç][aã]o)?|cidade|base)\s*:/i.test(line));
  if (labelled) return labelled.replace(/^[^:]+:\s*/, "").slice(0, 180);
  return lines.find((line) => locationOnly.test(line))?.replace(/^local(?:iza[cç][aã]o)?\s*:\s*/i, "").slice(0, 180) || "";
}

function extractWorkModel(lines: string[]) {
  const line = lines.find((item) => /\b(remoto|h[ií]brido|presencial|home office|on[- ]site)\b/i.test(item));
  if (!line) return "";
  return line.match(/\b(remoto|h[ií]brido|presencial|home office|on[- ]site)\b/i)?.[1] || "";
}

function classifySections(lines: string[]) {
  const output = { responsibilities: [] as string[], required: [] as string[], desired: [] as string[] };
  let section: keyof typeof output | null = null;
  for (const raw of lines) {
    const line = stripBullet(raw);
    if (/^(responsabilidades?|atribui[cç][oõ]es|o que (voc[eê]|você) vai fazer)\s*:??$/i.test(line)) { section = "responsibilities"; continue; }
    if (/^(requisitos?|qualifica[cç][oõ]es|compet[eê]ncias|o que esperamos)\s*:??$/i.test(line)) { section = "required"; continue; }
    if (/^(desej[aá]veis?|diferenciais?|ser[aá] um diferencial)\s*:??$/i.test(line)) { section = "desired"; continue; }
    if (genericHeadings.test(line)) { section = null; continue; }
    if (section && line.length >= 8) output[section].push(raw);
  }
  return output;
}

function isNarrativeLine(line: string, title: string, location: string) {
  const text = stripBullet(line);
  if (text.length < 45 || genericHeadings.test(text) || locationOnly.test(text)) return false;
  if (normalize(text) === normalize(title) || normalize(text) === normalize(location)) return false;
  return !/^(benef[ií]cios?|requisitos?|responsabilidades?|desej[aá]veis?)\b/i.test(text);
}

function weakSummary(summary: string, title: string) {
  const text = summary.trim();
  if (text.length < 35 || locationOnly.test(text)) return true;
  return normalize(text) === normalize(title);
}

function meaningful(value: string | undefined) {
  return Boolean(value?.trim() && value.trim().length >= 2);
}

function stripBullet(value: string) {
  return value.replace(/^[\s•●▪◦*-]+/, "").trim();
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalize(stripBullet(value));
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
