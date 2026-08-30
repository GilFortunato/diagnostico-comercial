import type { AuthorityAssessment, AuthorityDimensionScore } from "@/lib/diagnostics/authority";
import { buildBusinessUnitGuidance } from "@/lib/business-units/dna";
import { reviewPortugueseCopy } from "@/lib/copy/editorial";
import { buildInterestGraphStrategy } from "@/lib/social-selling/linkedinAlgorithmStrategy";
import type { SocialSellingAction, SocialSellingObjective } from "@/lib/social-selling/socialSellingStrategy";

export type AuthorityPlanActionType =
  | "PROFILE"
  | "AUTHORITY"
  | "CONTENT"
  | "NETWORKING"
  | "ENGAGEMENT"
  | "RESEARCH"
  | "RELATIONSHIP"
  | "BU_ACTIVATION"
  | "MEASUREMENT"
  | "REVIEW";

export type AuthorityPlanAction = {
  day: number;
  type: AuthorityPlanActionType;
  socialSellingAction: SocialSellingAction;
  strategicObjective: SocialSellingObjective;
  scope: "PERSONAL" | "BUSINESS_UNIT";
  title: string;
  action: string;
  reason: string;
  whyNow: string;
  signalToObserve: string;
  expectedImpact: "Baixo" | "Médio" | "Alto";
  effort: "Baixo" | "Médio" | "Alto";
  estimatedTime: string;
  authorityTerritory: string;
  businessUnit: string;
  persona: string;
  relatedModule: string;
  status: "PLANNED" | "DONE" | "SKIPPED";
};

export type AuthorityThirtyDayPlan = {
  id: string;
  createdAt: string;
  assessmentId: string;
  title: string;
  summary: string;
  generation: "gemini" | "structured-skeleton";
  generationNote: string;
  actions: AuthorityPlanAction[];
};

export type AuthorityPlanContext = {
  assessment: AuthorityAssessment;
  history?: AuthorityAssessment[];
};

type SprintBlueprint = {
  action: SocialSellingAction;
  objective: SocialSellingObjective;
  scope: "PERSONAL" | "BUSINESS_UNIT";
};

type ActionTemplate = {
  title: string;
  action: string;
  module: string;
  time: string;
  impact: "Baixo" | "Médio" | "Alto";
  effort: "Baixo" | "Médio" | "Alto";
  signal: string;
};

const actionTypes: AuthorityPlanActionType[] = [
  "PROFILE", "AUTHORITY", "CONTENT", "NETWORKING", "ENGAGEMENT",
  "RESEARCH", "RELATIONSHIP", "BU_ACTIVATION", "MEASUREMENT", "REVIEW",
];

const socialSellingActions: SocialSellingAction[] = [
  "POST", "COMMENT", "REPLY", "PROFILE", "INTELLIGENCE",
  "RAPPORT", "OUTREACH", "RELATIONSHIP", "ANALYSIS", "NO_PUBLISH",
];

const strategicObjectives: SocialSellingObjective[] = ["AUTHORITY", "EXPANSION", "RELATIONSHIP", "CONVERSION", "BU_ACTIVATION"];

const sprintBlueprint: SprintBlueprint[] = [
  { action: "PROFILE", objective: "AUTHORITY", scope: "PERSONAL" },
  { action: "INTELLIGENCE", objective: "EXPANSION", scope: "BUSINESS_UNIT" },
  { action: "COMMENT", objective: "RELATIONSHIP", scope: "BUSINESS_UNIT" },
  { action: "NO_PUBLISH", objective: "AUTHORITY", scope: "PERSONAL" },
  { action: "POST", objective: "AUTHORITY", scope: "PERSONAL" },
  { action: "REPLY", objective: "RELATIONSHIP", scope: "PERSONAL" },
  { action: "ANALYSIS", objective: "AUTHORITY", scope: "PERSONAL" },
  { action: "COMMENT", objective: "EXPANSION", scope: "BUSINESS_UNIT" },
  { action: "RELATIONSHIP", objective: "RELATIONSHIP", scope: "BUSINESS_UNIT" },
  { action: "POST", objective: "BU_ACTIVATION", scope: "BUSINESS_UNIT" },
  { action: "REPLY", objective: "RELATIONSHIP", scope: "PERSONAL" },
  { action: "NO_PUBLISH", objective: "EXPANSION", scope: "BUSINESS_UNIT" },
  { action: "INTELLIGENCE", objective: "BU_ACTIVATION", scope: "BUSINESS_UNIT" },
  { action: "ANALYSIS", objective: "AUTHORITY", scope: "PERSONAL" },
  { action: "COMMENT", objective: "AUTHORITY", scope: "BUSINESS_UNIT" },
  { action: "POST", objective: "AUTHORITY", scope: "PERSONAL" },
  { action: "REPLY", objective: "RELATIONSHIP", scope: "PERSONAL" },
  { action: "RELATIONSHIP", objective: "EXPANSION", scope: "BUSINESS_UNIT" },
  { action: "INTELLIGENCE", objective: "CONVERSION", scope: "BUSINESS_UNIT" },
  { action: "NO_PUBLISH", objective: "RELATIONSHIP", scope: "PERSONAL" },
  { action: "ANALYSIS", objective: "EXPANSION", scope: "PERSONAL" },
  { action: "COMMENT", objective: "EXPANSION", scope: "BUSINESS_UNIT" },
  { action: "POST", objective: "BU_ACTIVATION", scope: "BUSINESS_UNIT" },
  { action: "REPLY", objective: "RELATIONSHIP", scope: "PERSONAL" },
  { action: "RAPPORT", objective: "RELATIONSHIP", scope: "BUSINESS_UNIT" },
  { action: "RELATIONSHIP", objective: "CONVERSION", scope: "BUSINESS_UNIT" },
  { action: "OUTREACH", objective: "CONVERSION", scope: "BUSINESS_UNIT" },
  { action: "ANALYSIS", objective: "CONVERSION", scope: "PERSONAL" },
  { action: "INTELLIGENCE", objective: "EXPANSION", scope: "BUSINESS_UNIT" },
  { action: "ANALYSIS", objective: "AUTHORITY", scope: "PERSONAL" },
];

export function createStructuredAuthorityThirtyDayPlan({ assessment, history = [] }: AuthorityPlanContext): AuthorityThirtyDayPlan {
  const guidance = assessment.input.businessUnitContext ?? buildBusinessUnitGuidance(assessment.input.businessUnitId);
  const weakest = assessment.dimensions.slice().sort((left, right) => left.score - right.score)[0];
  const bridge = assessment.bridgeOpportunities[0];
  const territory = bridge?.title.split(" + ")[0] ?? guidance.territories[0] ?? assessment.input.businessUnitName;
  const persona = guidance.personas[0] ?? guidance.icps[0] ?? "decisores da BU";
  const interestGraph = buildInterestGraphStrategy({
    personalThemes: assessment.input.themes.split(",").map((item) => item.trim()).filter(Boolean),
    territory,
    persona,
    businessUnit: assessment.input.businessUnitName,
  });
  const actions = sprintBlueprint.map((blueprint, offset) => {
    const adapted = adaptBlueprint(blueprint, assessment);
    const template = createTemplate(adapted.action, { assessment, territory, persona, bridgeTitle: bridge?.title, interestGraph });
    return createAction({ day: offset + 1, blueprint: adapted, template, territory, persona, assessment, weakest });
  });

  const historySignal = history.length > 1
    ? " O histórico disponível orienta a revisão de sinais reais ao longo do ciclo."
    : " O primeiro diagnóstico estabelece a linha de base; métricas ausentes não foram estimadas.";
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    assessmentId: assessment.id,
    title: `Sprint de Social Selling de 30 dias para ${assessment.input.businessUnitName}`,
    summary: reviewPortugueseCopy(`O sprint fortalece ${weakest?.label.toLocaleLowerCase("pt-BR") ?? "a autoridade comercial"}, expande presença em ${territory} e constrói relacionamento com ${persona} antes de qualquer abordagem.${historySignal}`),
    generation: "structured-skeleton",
    generationNote: "Estrutura estratégica validada pela Share AI; nenhuma publicação, comentário ou abordagem é executada automaticamente.",
    actions,
  };
}

export function normalizeAuthorityThirtyDayPlan(candidate: Partial<AuthorityThirtyDayPlan>, fallback: AuthorityThirtyDayPlan): AuthorityThirtyDayPlan {
  const actions = Array.isArray(candidate.actions) && candidate.actions.length === 30
    ? candidate.actions.map((action, index) => normalizeAction(action, fallback.actions[index]))
    : fallback.actions;
  return {
    ...fallback,
    title: cleanText(candidate.title, fallback.title),
    summary: cleanText(candidate.summary, fallback.summary),
    generation: "gemini",
    generationNote: "Sprint priorizado pela IA com base no diagnóstico, na BU, nas pontes e nas informações autorizadas.",
    actions,
  };
}

function normalizeAction(value: unknown, fallback: AuthorityPlanAction): AuthorityPlanAction {
  if (!value || typeof value !== "object") return fallback;
  const item = value as Partial<AuthorityPlanAction>;
  const socialSellingAction = socialSellingActions.includes(item.socialSellingAction as SocialSellingAction)
    ? item.socialSellingAction as SocialSellingAction
    : fallback.socialSellingAction;
  const strategicObjective = strategicObjectives.includes(item.strategicObjective as SocialSellingObjective)
    ? item.strategicObjective as SocialSellingObjective
    : fallback.strategicObjective;
  const type = actionTypes.includes(item.type as AuthorityPlanActionType)
    ? item.type as AuthorityPlanActionType
    : legacyActionType(socialSellingAction);
  return {
    ...fallback,
    day: fallback.day,
    type,
    socialSellingAction,
    strategicObjective,
    scope: item.scope === "BUSINESS_UNIT" ? "BUSINESS_UNIT" : item.scope === "PERSONAL" ? "PERSONAL" : fallback.scope,
    title: cleanText(item.title, fallback.title),
    action: cleanText(item.action, fallback.action),
    reason: cleanText(item.reason, fallback.reason),
    whyNow: cleanText(item.whyNow, fallback.whyNow),
    signalToObserve: cleanText(item.signalToObserve, fallback.signalToObserve),
    expectedImpact: impact(item.expectedImpact, fallback.expectedImpact),
    effort: effort(item.effort, fallback.effort),
    estimatedTime: cleanText(item.estimatedTime, fallback.estimatedTime),
    authorityTerritory: cleanText(item.authorityTerritory, fallback.authorityTerritory),
    businessUnit: cleanText(item.businessUnit, fallback.businessUnit),
    persona: cleanText(item.persona, fallback.persona),
    relatedModule: cleanText(item.relatedModule, fallback.relatedModule),
    status: "PLANNED",
  };
}

function adaptBlueprint(blueprint: SprintBlueprint, assessment: AuthorityAssessment): SprintBlueprint {
  if (blueprint.action === "POST" && assessment.authoritySellingScore < 55) {
    return { action: "NO_PUBLISH", objective: "AUTHORITY", scope: "PERSONAL" };
  }
  if (blueprint.action === "OUTREACH" && (assessment.authoritySellingScore < 60 || assessment.buAffinityScore < 60)) {
    return { action: "RELATIONSHIP", objective: "RELATIONSHIP", scope: "BUSINESS_UNIT" };
  }
  return blueprint;
}

function createAction({ day, blueprint, template, territory, persona, assessment, weakest }: {
  day: number;
  blueprint: SprintBlueprint;
  template: ActionTemplate;
  territory: string;
  persona: string;
  assessment: AuthorityAssessment;
  weakest?: AuthorityDimensionScore;
}): AuthorityPlanAction {
  const personalReason = `${weakest?.label ?? "A autoridade pessoal"} é uma prioridade do diagnóstico e precisa sustentar a ação antes de ampliar exposição.`;
  const buReason = assessment.buAffinityScore < 55
    ? `A aderência à ${assessment.input.businessUnitName} ainda é ${assessment.buAffinityScore}/100; a ação cria uma ponte concreta sem forçar propaganda.`
    : `A aderência à ${assessment.input.businessUnitName} permite aprofundar uma conversa com contexto comercial e identidade pessoal preservada.`;
  return {
    day,
    type: legacyActionType(blueprint.action),
    socialSellingAction: blueprint.action,
    strategicObjective: blueprint.objective,
    scope: blueprint.scope,
    title: template.title,
    action: template.action,
    reason: blueprint.scope === "PERSONAL" ? personalReason : buReason,
    whyNow: whyNowFor(blueprint.action, assessment, territory, persona),
    signalToObserve: template.signal,
    expectedImpact: template.impact,
    effort: template.effort,
    estimatedTime: template.time,
    authorityTerritory: territory,
    businessUnit: assessment.input.businessUnitName,
    persona,
    relatedModule: template.module,
    status: "PLANNED",
  };
}

function createTemplate(action: SocialSellingAction, context: {
  assessment: AuthorityAssessment;
  territory: string;
  persona: string;
  bridgeTitle?: string;
  interestGraph: ReturnType<typeof buildInterestGraphStrategy>;
}): ActionTemplate {
  const { assessment, territory, persona, bridgeTitle, interestGraph } = context;
  const proofAction = assessment.input.proofPoints.trim()
    ? "Use uma experiência real e preserve contexto, decisão, aprendizado e resultado exatamente como foram informados."
    : "Mapeie uma experiência real e valide contexto, contribuição e resultado antes de tratá-la como prova.";

  switch (action) {
    case "PROFILE":
      return template("Ajuste a base de autoridade", `Revise headline e Sobre para deixar claro seu território de ${territory}, para quem você gera valor e quais provas são verificáveis.`, "Perfil profissional", "30 min", "Alto", "Médio", "Clareza entre perfil, território e provas");
    case "INTELLIGENCE":
      return template("Mapeie o cluster profissional", `${interestGraph.outOfNetworkAction} Registre autores, temas e perguntas recorrentes sem supor intenção comercial.`, "Mapa de decisores", "25 min", "Médio", "Baixo", "Novas conversas coerentes fora da rede atual");
    case "COMMENT":
      return template("Entre em uma conversa relevante", `Comente em uma conversa de ${persona} sobre ${territory}. Acrescente ponto de vista, consequência ou pergunta específica em duas a seis linhas, sem pitch.`, "Social selling", "20 min", "Alto", "Baixo", "Resposta substantiva ou continuidade da conversa");
    case "NO_PUBLISH":
      return template("Hoje, não publique", `Use o período para revisar conversas em andamento, responder com substância e verificar se a próxima tese realmente fortalece ${territory}.`, "Inteligência de conteúdo", "20 min", "Médio", "Baixo", "Tese mais clara ou conversa aprofundada antes do próximo post");
    case "POST":
      return template("Publique uma tese de autoridade", `Crie uma publicação sobre ${territory} a partir de uma experiência ou observação real. ${proofAction} Use a ponte ${bridgeTitle ?? territory} somente se ela parecer natural.`, "Inteligência de conteúdo", "40 min", "Alto", "Médio", "Comentários substantivos, visitas ao perfil ou conversas, quando informados");
    case "REPLY":
      return template("Continue a conversa", `Responda aos comentários recebidos com uma consequência, nuance ou pergunta ligada a ${territory}; evite encerrar apenas com agradecimento.`, "Social selling", "15 min", "Médio", "Baixo", "Profundidade e continuidade das respostas");
    case "RELATIONSHIP":
      return template("Construa familiaridade", `Aprofunde uma interação com alguém de ${persona} que já demonstrou interesse em ${territory}. Não apresente oferta antes de existir contexto de conversa.`, "Social selling", "20 min", "Alto", "Baixo", "Reconhecimento mútuo ou abertura para continuar a conversa");
    case "RAPPORT":
      return template("Prepare rapport com evidência", `Estude uma pessoa ou conta de ${persona}, identifique uma ponte verificável com ${territory} e prepare uma abordagem individual para aprovação humana.`, "Rapport", "25 min", "Alto", "Médio", "Contexto específico suficiente para uma conversa individual");
    case "OUTREACH":
      return template("Inicie uma conversa contextual", `Somente após as interações anteriores, envie uma mensagem individual a uma pessoa de ${persona}, usando a ponte real construída em ${territory} e sem pitch genérico.`, "Rapport", "15 min", "Alto", "Baixo", "Resposta e continuidade da conversa, não envio da mensagem por si só");
    case "ANALYSIS":
      return template("Revise sinais reais", "Registre o que aconteceu nas ações anteriores. Analise somente métricas e respostas disponíveis; se um dado não existe, mantenha a leitura qualitativa.", "Histórico e evolução", "20 min", "Médio", "Baixo", "Mudança observável em autoridade, expansão, relacionamento ou conversa");
  }
}

function template(title: string, action: string, module: string, time: string, impact: ActionTemplate["impact"], effort: ActionTemplate["effort"], signal: string): ActionTemplate {
  return { title, action, module, time, impact, effort, signal };
}

function whyNowFor(action: SocialSellingAction, assessment: AuthorityAssessment, territory: string, persona: string) {
  if (action === "NO_PUBLISH") return `Qualidade e coerência em ${territory} geram mais avanço do que manter uma frequência artificial.`;
  if (action === "COMMENT" || action === "RELATIONSHIP" || action === "REPLY") return `O momento pede familiaridade com ${persona} antes de qualquer abordagem comercial.`;
  if (action === "OUTREACH" || action === "RAPPORT") return "As etapas anteriores criam contexto suficiente para avaliar uma conversa individual sem antecipar o pitch.";
  if (action === "ANALYSIS") return "O sprint precisa aprender com sinais reais para não repetir ações por hábito.";
  if (action === "PROFILE") return `O Authority Selling Score atual é ${assessment.authoritySellingScore}/100; a base do perfil orienta como todo o restante será percebido.`;
  return `Esta ação fortalece a associação entre sua autoridade, ${territory} e as conversas relevantes para ${persona}.`;
}

function legacyActionType(action: SocialSellingAction): AuthorityPlanActionType {
  if (action === "PROFILE") return "PROFILE";
  if (action === "POST") return "CONTENT";
  if (action === "COMMENT" || action === "REPLY") return "ENGAGEMENT";
  if (action === "INTELLIGENCE") return "RESEARCH";
  if (action === "RELATIONSHIP" || action === "RAPPORT" || action === "OUTREACH") return "RELATIONSHIP";
  if (action === "ANALYSIS") return "MEASUREMENT";
  return "REVIEW";
}

function cleanText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? reviewPortugueseCopy(value.trim()) : fallback;
}

function impact(value: unknown, fallback: AuthorityPlanAction["expectedImpact"]) {
  return value === "Baixo" || value === "Médio" || value === "Alto" ? value : fallback;
}

function effort(value: unknown, fallback: AuthorityPlanAction["effort"]) {
  return value === "Baixo" || value === "Médio" || value === "Alto" ? value : fallback;
}
