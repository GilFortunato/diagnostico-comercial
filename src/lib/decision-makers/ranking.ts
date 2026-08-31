import { getBusinessUnitDna } from "@/lib/business-units/dna";
import { inferDecisionRole } from "@/lib/decision-makers/roleIntelligence";
import { normalizeText, type CompanySearchInput, type HuntingCompany, type HuntingPerson, type PersonSearchInput } from "@/lib/decision-makers/search";

export function rankCompanies(companies: HuntingCompany[], input: CompanySearchInput) {
  const unit = getBusinessUnitDna(input.businessUnitId);
  const buSignals = [
    ...unit.icps.flatMap((icp) => [...icp.sectors, ...icp.positiveSignals, ...icp.buyingAreas]),
    ...unit.positioning.recommendedTerms,
  ].map(normalizeText);

  return companies.map((company) => {
    const evidence = normalizeText([company.industry, company.location, company.employeeRange, company.revenueRange, company.domain].filter(Boolean).join(" "));
    const reasons: string[] = [];
    let score = 0;
    const filterTerms = [...input.filters.industries, ...input.filters.keywords, ...input.filters.technologies].map(normalizeText);
    const matchedFilters = filterTerms.filter((term) => evidence.includes(term));
    const matchedBu = buSignals.filter((term) => term.length > 2 && evidence.includes(term)).slice(0, 3);

    if (company.linkedinUrl || company.website) { score += 20; reasons.push("Empresa vinculada a uma fonte pública identificável."); }
    if (company.industry) { score += 12; reasons.push(`Setor informado pela fonte: ${company.industry}.`); }
    if (company.location) { score += 8; reasons.push(`Localização disponível: ${company.location}.`); }
    if (company.employeeRange) { score += 10; reasons.push(`Faixa de funcionários disponível: ${company.employeeRange}.`); }
    if (company.revenueRange) { score += 8; reasons.push(`Faixa de receita disponível: ${company.revenueRange}.`); }
    if (matchedFilters.length) { score += Math.min(24, matchedFilters.length * 8); reasons.push(`Aderência aos filtros: ${matchedFilters.slice(0, 3).join(", ")}.`); }
    if (matchedBu.length) { score += Math.min(18, matchedBu.length * 6); reasons.push(`Sinais compatíveis com o contexto da BU: ${matchedBu.join(", ")}.`); }
    if (!matchedFilters.length && !matchedBu.length) reasons.push("A aderência comercial ainda precisa ser validada com mais evidências públicas.");

    return { ...company, fit: fitFromScore(score), fitReasons: reasons.slice(0, 5) };
  }).sort(compareFit);
}

export function rankPeople(people: HuntingPerson[], input: PersonSearchInput) {
  const unit = getBusinessUnitDna(input.businessUnitId);
  const requestedRoles = input.filters.roles.map(normalizeText);
  const departments = [...input.filters.departments, ...unit.icps.flatMap((icp) => icp.buyingAreas)].map(normalizeText);
  const keywords = [...input.filters.profileKeywords, ...unit.positioning.recommendedTerms].map(normalizeText);

  return people.map((person) => {
    const title = normalizeText(person.title);
    const profileEvidence = normalizeText([person.title, person.department, person.profileSummary, ...person.recentSignals].filter(Boolean).join(" "));
    const probableDecisionRole = inferDecisionRole(person.title, input.filters.desiredDecisionRole);
    const reasons: string[] = [];
    let score = 0;

    const exactRole = requestedRoles.some((role) => title === role || title.includes(role));
    const roleTerms = requestedRoles.flatMap((role) => role.split(/\s+/).filter((term) => term.length > 3));
    const relatedRole = roleTerms.some((term) => title.includes(term));
    if (exactRole) { score += 32; reasons.push("Cargo diretamente aderente aos papéis pesquisados."); }
    else if (relatedRole) { score += 18; reasons.push("Cargo pertence à família de papéis pesquisada."); }

    if (probableDecisionRole === input.filters.desiredDecisionRole) { score += 18; reasons.push(`Papel provável compatível com ${input.filters.desiredDecisionRole.toLocaleLowerCase("pt-BR")}.`); }
    if (input.filters.seniority.length === 0 || matchesSeniority(person.title, input.filters.seniority)) { score += 14; reasons.push(`Senioridade compatível: ${person.seniority ?? "sinalizada pelo cargo"}.`); }
    const departmentMatch = departments.find((term) => term.length > 2 && profileEvidence.includes(term));
    if (departmentMatch) { score += 12; reasons.push(`Área relacionada ao contexto comprador: ${departmentMatch}.`); }
    const keywordMatches = keywords.filter((term) => term.length > 3 && profileEvidence.includes(term)).slice(0, 2);
    if (keywordMatches.length) { score += keywordMatches.length * 6; reasons.push(`Evidências temáticas: ${keywordMatches.join(", ")}.`); }
    if (person.location && (input.filters.locations.length === 0 || input.filters.locations.some((location) => normalizeText(person.location ?? "").includes(normalizeText(location))))) {
      score += 6;
      reasons.push(`Localização compatível: ${person.location}.`);
    }
    if (person.profileSummary) { score += 4; reasons.push("Perfil público enriquecido."); }
    if (person.recentSignals.length) { score += 2; reasons.push("Há sinais profissionais recentes para rapport."); }

    const boundedScore = Math.min(100, score);
    return {
      ...person,
      probableDecisionRole,
      fitScore: boundedScore,
      fit: fitFromScore(boundedScore),
      fitReasons: reasons.length ? reasons : ["Poucas evidências aderentes aos filtros; mantenha como hipótese de baixa prioridade."],
      confidence: person.profileSummary || person.recentSignals.length ? "confirmado" as const : "provável" as const,
      accessibility: person.professionalEmail || person.professionalPhone ? "Alta" as const : person.recentSignals.length ? "Média" as const : "Baixa" as const,
      rapport: buildRapport(person, unit.name, keywordMatches),
      nextBestAction: person.recentSignals.length
        ? "Validar o sinal recente e construir rapport antes de conectar a oferta."
        : boundedScore >= 70
          ? "Pesquisar publicações e prioridades atuais antes de considerar uma abordagem."
          : "Não abordar ainda; confirme responsabilidades e relevância para a oportunidade.",
    };
  }).sort((a, b) => b.fitScore - a.fitScore || a.name.localeCompare(b.name, "pt-BR"));
}

export function targetRolesNotFound(roles: string[], people: HuntingPerson[]) {
  return roles.filter((role) => {
    const normalized = normalizeText(role);
    const importantTerms = normalized.split(/\s+/).filter((term) => term.length > 3);
    return !people.some((person) => {
      const title = normalizeText(person.title);
      return title.includes(normalized) || importantTerms.some((term) => title.includes(term));
    });
  });
}

function buildRapport(person: HuntingPerson, unitName: string, keywordMatches: string[]) {
  const signal = person.recentSignals[0] || keywordMatches[0];
  return {
    context: signal
      ? `Há um sinal profissional sobre ${signal}; use-o apenas como contexto verificável para entender prioridades.`
      : `O vínculo com ${unitName} ainda é uma hipótese baseada em cargo e área, não em intenção declarada.`,
    safeOpening: signal
      ? `Comece perguntando como ${signal} aparece nas prioridades atuais da área, sem apresentar uma proposta de imediato.`
      : "Comece validando responsabilidades e desafios atuais antes de conectar qualquer oferta.",
    avoid: [
      "Não afirmar que a pessoa possui orçamento ou decisão final sem fonte.",
      "Não usar contato pessoal, dado sensível ou informação inferida como fato.",
      "Não transformar o primeiro contato em pitch automático.",
    ],
  };
}

function matchesSeniority(title: string, selected: PersonSearchInput["filters"]["seniority"]) {
  const normalized = normalizeText(title);
  return selected.some((level) => {
    if (level === "c_level") return /\b(ceo|cfo|cro|chro|cmo|cio|cto|chief|presidente)\b/.test(normalized);
    if (level === "owner") return /\b(owner|socio|sócio|partner|fundador)\b/.test(normalized);
    if (level === "vp") return /\b(vp|vice president)\b/.test(normalized);
    if (level === "director") return /\b(diretor|director|head)\b/.test(normalized);
    return /\b(gerente|manager|coordenador|lead|lider)\b/.test(normalized);
  });
}

function fitFromScore(score: number) {
  if (score >= 70) return "Alta" as const;
  if (score >= 42) return "Média" as const;
  return "Baixa" as const;
}

function compareFit(a: HuntingCompany, b: HuntingCompany) {
  const weight = { Alta: 3, Média: 2, Baixa: 1 };
  return weight[b.fit] - weight[a.fit] || a.name.localeCompare(b.name, "pt-BR");
}
