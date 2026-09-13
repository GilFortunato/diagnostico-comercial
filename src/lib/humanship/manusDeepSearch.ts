import "server-only";
import { listManusConnectors } from "@/lib/connectors/manusClient";
import { findResearchConnectorIds, isRealLinkedInPersonUrl } from "@/lib/connectors/manusCore";
import { resolveManusCredential } from "@/lib/connectors/platformCredentials";
import type { HrCandidate } from "@/lib/hr-hunting/types";
import type { HumanshipParticipant } from "@/lib/humanship/types";

const manusBaseUrl = "https://api.manus.ai/v2";
const pollIntervalMs = 3_000;
const requestTimeoutMs = 15_000;

export type HumanshipDeepSearchTarget = Pick<HumanshipParticipant, "id" | "fullName" | "company" | "jobTitle">;

type DeepCandidate = {
  name: string;
  linkedinUrl: string;
  currentTitle?: string;
  currentCompany?: string;
  location?: string;
  confidence: "high" | "medium" | "low";
  evidence: string;
  sourceHints?: string[];
};

type DeepParticipantResult = {
  participantId: string;
  candidates: DeepCandidate[];
};

type DeepSearchPayload = {
  results: DeepParticipantResult[];
};

type ManusMessage = {
  type?: string;
  status_update?: { agent_status?: "running" | "stopped" | "waiting" | "error" };
  structured_output_result?: { success: boolean; value?: DeepSearchPayload; error?: string | null };
};

export type HumanshipDeepSearchResult = {
  status: "success" | "empty" | "unavailable" | "error" | "timeout";
  candidatesByParticipant: Map<string, HrCandidate[]>;
  warnings: string[];
  connectorNames: string[];
  taskId: string | null;
};

export async function runHumanshipManusDeepSearch(targets: HumanshipDeepSearchTarget[]): Promise<HumanshipDeepSearchResult> {
  const cleanTargets = targets.filter((target) => target.id && target.fullName.trim()).slice(0, 8);
  if (!cleanTargets.length) return emptyResult("empty");

  const credential = await resolveManusCredential();
  if (!credential.available || !credential.credential) {
    return {
      ...emptyResult("unavailable"),
      warnings: ["Manus não está configurado; a busca profunda foi ignorada."],
    };
  }

  let connectorNames: string[] = [];
  let connectorIds: string[] = [];
  try {
    const available = await listManusConnectors(credential.credential);
    const selected = findResearchConnectorIds(available);
    connectorNames = selected.map((connector) => connector.name);
    connectorIds = selected.map((connector) => connector.id);
  } catch {
    return {
      ...emptyResult("unavailable"),
      warnings: ["Não foi possível consultar os conectores autorizados no Manus para esta busca profunda."],
    };
  }

  if (!connectorIds.length) {
    return {
      ...emptyResult("unavailable"),
      warnings: ["Nenhum conector de pesquisa profissional compatível (Apify, Apollo, ZoomInfo ou Firecrawl) está autorizado no Manus."],
    };
  }

  const prompt = buildPrompt(cleanTargets, connectorNames);
  let taskId: string | null = null;
  const startedAt = Date.now();
  const timeoutMs = deepSearchTimeoutMs();

  try {
    const createdResponse = await fetch(`${manusBaseUrl}/task.create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-manus-api-key": credential.credential,
      },
      body: JSON.stringify({
        message: { content: prompt, connectors: connectorIds },
        interactive_mode: false,
        hide_in_task_list: true,
        share_visibility: "private",
        agent_profile: "standard",
        title: `Share AI · Humanship · Busca profunda (${cleanTargets.length})`,
        structured_output_schema: deepSearchSchema,
      }),
      signal: AbortSignal.timeout(requestTimeoutMs),
    });

    if (!createdResponse.ok) {
      return {
        ...emptyResult("error"),
        connectorNames,
        warnings: [`Manus não iniciou a busca profunda (HTTP ${createdResponse.status}).`],
      };
    }

    const created = await createdResponse.json() as { ok?: boolean; task_id?: string };
    taskId = created.ok && typeof created.task_id === "string" ? created.task_id : null;
    if (!taskId) {
      return {
        ...emptyResult("error"),
        connectorNames,
        warnings: ["Manus não retornou um identificador válido para a busca profunda."],
      };
    }

    while (Date.now() - startedAt < timeoutMs) {
      await sleep(pollIntervalMs);
      const response = await fetch(`${manusBaseUrl}/task.listMessages?task_id=${encodeURIComponent(taskId)}&order=desc&limit=100&verbose=true`, {
        headers: { "x-manus-api-key": credential.credential },
        cache: "no-store",
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      if (!response.ok) {
        return {
          ...emptyResult("error"),
          connectorNames,
          taskId,
          warnings: [`A busca profunda Manus foi interrompida durante a consulta (HTTP ${response.status}).`],
        };
      }

      const payload = await response.json() as { ok?: boolean; messages?: ManusMessage[] };
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      const structured = messages.find((message) => message.type === "structured_output_result" && message.structured_output_result)?.structured_output_result;
      if (structured) {
        if (!structured.success || !structured.value) {
          return {
            ...emptyResult("error"),
            connectorNames,
            taskId,
            warnings: [structured.error || "Manus concluiu a busca profunda sem um resultado estruturado utilizável."],
          };
        }
        const candidatesByParticipant = normalizePayload(structured.value, cleanTargets);
        const resultCount = [...candidatesByParticipant.values()].reduce((sum, candidates) => sum + candidates.length, 0);
        return {
          status: resultCount ? "success" : "empty",
          candidatesByParticipant,
          warnings: resultCount ? [] : ["A busca profunda Manus não encontrou correspondências profissionais suficientemente sustentadas."],
          connectorNames,
          taskId,
        };
      }

      const status = messages.find((message) => message.type === "status_update")?.status_update?.agent_status;
      if (status === "error" || status === "waiting") {
        return {
          ...emptyResult("error"),
          connectorNames,
          taskId,
          warnings: [status === "waiting" ? "Manus solicitou interação durante a busca automática; o resultado não foi usado." : "A busca profunda Manus terminou com erro."],
        };
      }
    }

    await stopTask(credential.credential, taskId);
    return {
      ...emptyResult("timeout"),
      connectorNames,
      taskId,
      warnings: ["A busca profunda Manus excedeu o tempo limite e foi interrompida para evitar consumo indefinido."],
    };
  } catch (error) {
    if (taskId) await stopTask(credential.credential, taskId);
    return {
      ...emptyResult(error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "error"),
      connectorNames,
      taskId,
      warnings: ["A busca profunda Manus ficou indisponível nesta execução; a busca direta do LinkedIn foi preservada."],
    };
  }
}

function buildPrompt(targets: HumanshipDeepSearchTarget[], connectorNames: string[]) {
  return [
    "Você é um pesquisador sênior de Talent Sourcing e resolução de identidade profissional da Share AI.",
    "Use SOMENTE fontes profissionais públicas acessíveis pelos conectores autorizados. Não use nem infira atributos pessoais sensíveis ou protegidos.",
    "Sua missão é encontrar perfis pessoais reais do LinkedIn para os participantes abaixo quando a busca direta não conseguiu confirmar a identidade.",
    "Considere variações de nome, sobrenomes extras ou omitidos, erros simples de digitação, nomes profissionais abreviados e pequenas diferenças entre o nome da planilha e o nome usado no LinkedIn.",
    "Cruze nome com empresa e cargo. Empresa e cargo servem como fortes sinais de corroboração quando o nome não for idêntico.",
    "Não invente URLs. Só retorne um candidato quando houver uma URL real no formato https://www.linkedin.com/in/... encontrada nas fontes consultadas.",
    "Não escolha uma identidade final: retorne até 4 candidatos plausíveis por participante, ordenados do mais forte ao mais fraco. A Share AI fará a decisão final por score.",
    "Se a evidência for insuficiente, retorne candidates vazio para aquele participantId.",
    `Conectores disponíveis nesta tarefa: ${connectorNames.join(", ")}.`,
    "Participantes:",
    JSON.stringify(targets.map((target) => ({
      participantId: target.id,
      fullName: target.fullName,
      company: target.company || null,
      jobTitle: target.jobTitle || null,
    }))),
    "No campo evidence, explique em uma frase objetiva quais sinais profissionais sustentam a correspondência (nome, empresa e/ou cargo).",
    "Responda exclusivamente no schema solicitado.",
  ].join("\n");
}

function normalizePayload(payload: DeepSearchPayload, targets: HumanshipDeepSearchTarget[]) {
  const validIds = new Set(targets.map((target) => target.id));
  const result = new Map<string, HrCandidate[]>();

  for (const item of Array.isArray(payload.results) ? payload.results : []) {
    if (!validIds.has(item.participantId) || !Array.isArray(item.candidates)) continue;
    const candidates = item.candidates
      .filter((candidate) => candidate && isRealLinkedInPersonUrl(candidate.linkedinUrl) && candidate.name?.trim())
      .slice(0, 4)
      .map((candidate, index): HrCandidate => ({
        id: `manus_${item.participantId}_${index}_${stableToken(candidate.linkedinUrl)}`,
        name: candidate.name.trim(),
        currentTitle: cleanOptional(candidate.currentTitle),
        currentCompany: cleanOptional(candidate.currentCompany),
        location: cleanOptional(candidate.location),
        profileUrl: candidate.linkedinUrl.trim(),
        professionalSummary: candidate.evidence?.trim() || undefined,
        fitScore: 0,
        fitClassification: "Parcial",
        mainSignal: candidate.evidence?.trim() || undefined,
        pointsToValidate: candidate.confidence === "high" ? [] : ["Confirmar identidade antes da decisão final."],
        sourceName: "Manus deep search",
        confidence: candidate.confidence === "high" ? "confirmado" : candidate.confidence === "medium" ? "provável" : "inferência",
        evidence: [],
        contacts: [],
        shortlisted: false,
      }));
    if (candidates.length) result.set(item.participantId, deduplicateByUrl(candidates));
  }

  return result;
}

function deduplicateByUrl(candidates: HrCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = (candidate.profileUrl || "").toLocaleLowerCase("en-US").replace(/\/$/, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cleanOptional(value: string | undefined) {
  const clean = value?.replace(/\s+/g, " ").trim();
  return clean || undefined;
}

function stableToken(value: string) {
  let hash = 0;
  for (const char of value) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return Math.abs(hash).toString(36);
}

function deepSearchTimeoutMs() {
  const configured = Number(process.env.MANUS_HUMANSHIP_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return 90_000;
  return Math.max(30_000, Math.min(150_000, Math.round(configured)));
}

async function stopTask(apiKey: string, taskId: string) {
  try {
    await fetch(`${manusBaseUrl}/task.stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-manus-api-key": apiKey },
      body: JSON.stringify({ task_id: taskId }),
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
  } catch {
    // Best effort only.
  }
}

function emptyResult(status: HumanshipDeepSearchResult["status"]): HumanshipDeepSearchResult {
  return { status, candidatesByParticipant: new Map(), warnings: [], connectorNames: [], taskId: null };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const deepSearchSchema = {
  type: "object",
  additionalProperties: false,
  required: ["results"],
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["participantId", "candidates"],
        properties: {
          participantId: { type: "string" },
          candidates: {
            type: "array",
            maxItems: 4,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "linkedinUrl", "confidence", "evidence"],
              properties: {
                name: { type: "string" },
                linkedinUrl: { type: "string" },
                currentTitle: { type: "string" },
                currentCompany: { type: "string" },
                location: { type: "string" },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
                evidence: { type: "string" },
                sourceHints: { type: "array", items: { type: "string" }, maxItems: 4 },
              },
            },
          },
        },
      },
    },
  },
};
