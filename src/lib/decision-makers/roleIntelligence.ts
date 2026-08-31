import { getBusinessUnitDna } from "@/lib/business-units/dna";
import { normalizeText, uniqueStrings, type DecisionRole } from "@/lib/decision-makers/search";

const roleFamilies: Array<{ signals: string[]; related: string[] }> = [
  { signals: ["rh", "recursos humanos", "people", "chro"], related: ["CHRO", "Diretor de RH", "Head de People", "Gerente de RH", "HRBP"] },
  { signals: ["t&d", "treinamento", "learning", "desenvolvimento"], related: ["Head de T&D", "Diretor de Desenvolvimento", "Gerente de T&D", "Head de Learning", "Líder de Educação Corporativa"] },
  { signals: ["transformacao", "inovacao", "digital"], related: ["Diretor de Transformação", "Head de Transformação Digital", "Head de Inovação", "Gerente de Inovação"] },
  { signals: ["tecnologia", "ti", "cto", "cio"], related: ["CIO", "CTO", "Diretor de Tecnologia", "Head de TI", "Gerente de Tecnologia"] },
  { signals: ["comercial", "vendas", "sales", "cro"], related: ["CRO", "Diretor Comercial", "Head de Vendas", "Gerente Comercial", "Sales Enablement"] },
  { signals: ["marketing", "cmo"], related: ["CMO", "Diretor de Marketing", "Head de Marketing", "Gerente de Marketing"] },
  { signals: ["educacao", "escola", "academico"], related: ["Diretor Acadêmico", "Diretor Pedagógico", "Head de Educação", "Coordenador Acadêmico"] },
];

export function getSuggestedRoles(businessUnitId: string) {
  const unit = getBusinessUnitDna(businessUnitId);
  return uniqueStrings([
    ...unit.icps.flatMap((icp) => [...icp.decisionMakers, ...icp.influencers, ...icp.champions]),
    ...unit.personas.map((persona) => persona.name),
  ]).slice(0, 18);
}

export function expandRoleFamilies(roles: string[]) {
  const expanded = [...roles];
  for (const role of roles) {
    const normalized = normalizeText(role);
    const family = roleFamilies.find((entry) => entry.signals.some((signal) => normalized.includes(signal)));
    if (family) expanded.push(...family.related);
  }
  return uniqueStrings(expanded).slice(0, 20);
}

export function addRoleSelection(roles: string[], role: string) {
  return uniqueStrings([...roles, role.trim()].filter(Boolean));
}

export function removeRoleSelection(roles: string[], role: string) {
  const target = normalizeText(role);
  return roles.filter((item) => normalizeText(item) !== target);
}

export function inferDecisionRole(title: string, desired: DecisionRole): DecisionRole {
  const normalized = normalizeText(title);
  if (/\b(ceo|cfo|cro|chro|cmo|cio|cto|chief|presidente|socio|sócio|owner)\b/.test(normalized)) return "Decisor econômico";
  if (/\b(diretor|director|vp|vice president|head)\b/.test(normalized)) return "Decisor funcional";
  if (/\b(gerente|manager|coordenador|coordinator|lead|lider|líder)\b/.test(normalized)) return desired === "Decisor econômico" ? "Influenciador" : "Champion";
  if (/\b(especialista|analista|consultor|partner|bp)\b/.test(normalized)) return "Porta de entrada";
  return desired;
}

export function inferSeniority(title: string) {
  const normalized = normalizeText(title);
  if (/\b(ceo|cfo|cro|chro|cmo|cio|cto|chief|presidente|socio|owner)\b/.test(normalized)) return "C-level / Sócio";
  if (/\b(vp|vice president)\b/.test(normalized)) return "Vice-presidente";
  if (/\b(diretor|director|head)\b/.test(normalized)) return "Diretoria / Head";
  if (/\b(gerente|manager|coordenador|lead|lider)\b/.test(normalized)) return "Gestão";
  return "Especialista";
}
