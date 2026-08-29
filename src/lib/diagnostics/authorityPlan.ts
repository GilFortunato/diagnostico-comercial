import type { AuthorityAssessment, AuthorityDimensionScore } from "@/lib/diagnostics/authority";
import { buildBusinessUnitGuidance } from "@/lib/business-units/dna";
import { reviewPortugueseCopy } from "@/lib/copy/editorial";

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
  scope: "PERSONAL" | "BUSINESS_UNIT";
  title: string;
  action: string;
  reason: string;
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
  generation: "gemini" | "structured-fallback";
  generationNote: string;
  actions: AuthorityPlanAction[];
};

export type AuthorityPlanContext = {
  assessment: AuthorityAssessment;
  history?: AuthorityAssessment[];
};

const actionTypes: AuthorityPlanActionType[] = [
  "PROFILE",
  "AUTHORITY",
  "RESEARCH",
  "NETWORKING",
  "CONTENT",
  "ENGAGEMENT",
  "REVIEW",
  "BU_ACTIVATION",
  "RELATIONSHIP",
  "MEASUREMENT",
];

export function createStructuredAuthorityThirtyDayPlan({ assessment, history = [] }: AuthorityPlanContext): AuthorityThirtyDayPlan {
  const guidance = assessment.input.businessUnitContext ?? buildBusinessUnitGuidance(assessment.input.businessUnitId);
  const weakest = assessment.dimensions.slice().sort((left, right) => left.score - right.score)[0];
  const strongest = assessment.dimensions.slice().sort((left, right) => right.score - left.score)[0];
  const bridge = assessment.bridgeOpportunities[0];
  const territory = bridge?.title.split(" + ")[0] ?? guidance.territories[0] ?? assessment.input.businessUnitName;
  const persona = guidance.personas[0] ?? guidance.icps[0] ?? "decisores da BU";
  const authorityNeeds = personalActions(weakest, strongest, territory, assessment);
  const buNeeds = businessUnitActions(territory, persona, assessment, bridge?.title);
  const actions = Array.from({ length: 30 }, (_, offset) => {
    const day = offset + 1;
    const scope = day % 3 === 0 || (assessment.buAffinityScore < 55 && day % 2 === 0) ? "BUSINESS_UNIT" : "PERSONAL";
    const type = actionTypes[offset % actionTypes.length];
    const template = scope === "PERSONAL" ? authorityNeeds[offset % authorityNeeds.length] : buNeeds[offset % buNeeds.length];
    return createAction({ day, type, scope, template, territory, persona, assessment, weakest });
  });

  const historySignal = history.length > 1 ? " O histórico disponível foi considerado para manter a evolução mensurável." : " O primeiro diagnóstico estabelece a linha de base para a comparação futura.";
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    assessmentId: assessment.id,
    title: `Plano estratégico de 30 dias para ${assessment.input.businessUnitName}`,
    summary: reviewPortugueseCopy(`Plano diário para fortalecer ${weakest?.label.toLocaleLowerCase("pt-BR") ?? "a autoridade comercial"} e ativar ${territory} com ${persona}.${historySignal}`),
    generation: "structured-fallback",
    generationNote: "Plano organizado a partir do diagnóstico estruturado. Conecte Gemini para receber também a priorização especializada da IA.",
    actions,
  };
}

export function normalizeAuthorityThirtyDayPlan(candidate: Partial<AuthorityThirtyDayPlan>, fallback: AuthorityThirtyDayPlan): AuthorityThirtyDayPlan {
  const actions = Array.isArray(candidate.actions) && candidate.actions.length === 30 ? candidate.actions.map((action, index) => normalizeAction(action, fallback.actions[index])) : fallback.actions;
  return {
    ...fallback,
    title: cleanText(candidate.title, fallback.title),
    summary: cleanText(candidate.summary, fallback.summary),
    generation: "gemini",
    generationNote: "Plano priorizado pela IA com base no diagnóstico, na BU selecionada e nas informações autorizadas.",
    actions,
  };
}

function normalizeAction(value: unknown, fallback: AuthorityPlanAction): AuthorityPlanAction {
  if (!value || typeof value !== "object") return fallback;
  const item = value as Partial<AuthorityPlanAction>;
  const type = actionTypes.includes(item.type as AuthorityPlanActionType) ? (item.type as AuthorityPlanActionType) : fallback.type;
  return {
    ...fallback,
    day: fallback.day,
    type,
    scope: item.scope === "BUSINESS_UNIT" ? "BUSINESS_UNIT" : item.scope === "PERSONAL" ? "PERSONAL" : fallback.scope,
    title: cleanText(item.title, fallback.title),
    action: cleanText(item.action, fallback.action),
    reason: cleanText(item.reason, fallback.reason),
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

function createAction({ day, type, scope, template, territory, persona, assessment, weakest }: {
  day: number;
  type: AuthorityPlanActionType;
  scope: "PERSONAL" | "BUSINESS_UNIT";
  template: { title: string; action: string; module: string; time: string; impact: "Baixo" | "Médio" | "Alto"; effort: "Baixo" | "Médio" | "Alto" };
  territory: string;
  persona: string;
  assessment: AuthorityAssessment;
  weakest?: AuthorityDimensionScore;
}): AuthorityPlanAction {
  const buReason = assessment.buAffinityScore < 55
    ? `A aderência à ${assessment.input.businessUnitName} ainda é ${assessment.buAffinityScore}/100; esta ação fortalece uma ponte concreta.`
    : `A aderência à ${assessment.input.businessUnitName} já permite aprofundar uma conversa com contexto comercial.`;
  return {
    day,
    type,
    scope,
    title: template.title,
    action: template.action,
    reason: scope === "PERSONAL" ? `${weakest?.label ?? "A autoridade pessoal"} é uma lacuna prioritária do diagnóstico.` : buReason,
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

function personalActions(weakest: AuthorityDimensionScore | undefined, strongest: AuthorityDimensionScore | undefined, territory: string, assessment: AuthorityAssessment) {
  const focus = weakest?.label.toLocaleLowerCase("pt-BR") ?? "autoridade comercial";
  const proofAction = assessment.input.proofPoints.trim()
    ? "Transforme uma experiência real em um caso curto: contexto, decisão, aprendizado e resultado verificável."
    : "Liste duas experiências reais, indique o contexto e peça validação dos dados antes de usá-las como prova.";
  return [
    { title: "Ajustar o posicionamento", action: `Revise headline e Sobre para explicar seu território de ${territory}, público e impacto sem linguagem publicitária.`, module: "Perfil profissional", time: "25 min", impact: "Alto" as const, effort: "Médio" as const },
    { title: "Transformar experiência em prova", action: proofAction, module: "Autoridade comercial", time: "30 min", impact: "Alto" as const, effort: "Médio" as const },
    { title: "Organizar repertório", action: `Separe três aprendizados pessoais que sustentem ${focus} e marque o que já possui evidência.`, module: "Autoridade comercial", time: "20 min", impact: "Médio" as const, effort: "Baixo" as const },
    { title: "Criar conteúdo de autoridade", action: `Escreva um rascunho sobre ${territory} partindo de um problema real, uma experiência e uma pergunta para a audiência.`, module: "Inteligência de conteúdo", time: "35 min", impact: "Alto" as const, effort: "Médio" as const },
    { title: "Revisar coerência", action: `Confira se perfil, prova e conteúdo usam o mesmo território de autoridade: ${territory}.`, module: "Perfil profissional", time: "15 min", impact: "Médio" as const, effort: "Baixo" as const },
    { title: "Registrar aprendizado", action: `Anote o que funcionou na conversa ou conteúdo e o que deve mudar antes da próxima ação. O ponto forte atual é ${strongest?.label.toLocaleLowerCase("pt-BR") ?? "a base de autoridade"}.`, module: "Histórico e evolução", time: "10 min", impact: "Baixo" as const, effort: "Baixo" as const },
  ];
}

function businessUnitActions(territory: string, persona: string, assessment: AuthorityAssessment, bridgeTitle?: string) {
  return [
    { title: "Mapear conversas relevantes", action: `Encontre três conversas públicas de ${persona} sobre ${territory}; registre apenas sinais verificáveis.`, module: "Mapa de decisores", time: "25 min", impact: "Médio" as const, effort: "Baixo" as const },
    { title: "Ativar uma ponte", action: `Use a ponte ${bridgeTitle ?? territory} para formular uma pergunta consultiva, sem apresentar oferta antes de entender o contexto.`, module: "Social selling", time: "20 min", impact: "Alto" as const, effort: "Baixo" as const },
    { title: "Participar de conversas", action: `Faça três contribuições úteis em discussões de ${persona}; compartilhe critério, exemplo ou aprendizado, sem convite comercial.`, module: "Social selling", time: "20 min", impact: "Médio" as const, effort: "Baixo" as const },
    { title: "Preparar conteúdo da BU", action: `Conecte um aprendizado pessoal a uma dor de ${persona} em ${territory}, citando somente provas confirmadas.`, module: "Inteligência de conteúdo", time: "30 min", impact: "Alto" as const, effort: "Médio" as const },
    { title: "Preparar relacionamento", action: `Selecione uma pessoa com contexto compatível e prepare uma abordagem individual. A mensagem só pode ser enviada após sua aprovação.`, module: "Rapport", time: "15 min", impact: "Médio" as const, effort: "Baixo" as const },
    { title: "Medir aderência", action: `Revise se as conversas e o conteúdo aproximaram seu perfil do foco ${assessment.input.businessUnitName}; registre o sinal no histórico.`, module: "Histórico e evolução", time: "15 min", impact: "Médio" as const, effort: "Baixo" as const },
  ];
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
