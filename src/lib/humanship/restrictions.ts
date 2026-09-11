export const humanshipRestrictionVersion = "2026-09-11-v1";

export const humanshipCompanyRestrictionGroups = [
  { reference: "Share People Hub", category: "Consultorias de recrutamento e seleção", companies: ["Michael Page", "Hays", "Robert Half"] },
  { reference: "Share People Hub", category: "Consultorias de RH (cultura, clima, engajamento, remuneração, etc.)", companies: ["Hay Group", "Consultores independentes"] },
  { reference: "Share People Hub", category: "Educação corporativa (desenvolvimento de líderes, treinamentos comportamentais)", companies: ["Novi", "Escola do Caos"] },
  { reference: "Share People Hub", category: "Educação digital, upskilling/reskilling, letramento em IA", companies: ["Alura"] },
  { reference: "Flash", category: "Benefícios alimentação / refeição", companies: ["Alelo", "VR", "Ticket", "Pluxee", "Swile", "Caju"] },
  { reference: "TotalPass", category: "Plataforma wellness", companies: ["Wellhub (Gympass)"] },
  { reference: "Pipo Saúde", category: "Corretora de planos de saúde", companies: ["Alper", "AON", "Marsh", "Qualicorp"] },
  { reference: "Tera", category: "Educação em IA", companies: ["Alura"] },
  { reference: "Digaí", category: "IA para R&S / ATS", companies: ["Inhire", "Gupy", "Pandapé / Infojobs"] },
  { reference: "Eureca", category: "Programas de estágio e trainee", companies: ["Cia de Talentos", "99 jobs", "Across"] },
  { reference: "Leapy", category: "Atração, seleção e desenvolvimento de jovens aprendizes", companies: ["CIEE", "Espro", "Nube"] },
  { reference: "Pin People", category: "Plataforma de pesquisa com colaboradores e employee experience", companies: ["Gupy", "Pulses"] },
] as const;

export const humanshipRoleReferences = [
  "CHRO",
  "Chief Human Resources Officer",
  "Chief People Officer",
  "CPO",
  "Chief People & Culture",
  "VP Human Resources",
  "VP People",
  "Vice President Human Resources",
  "Vice-Presidente de RH",
  "Vice-Presidente de Pessoas",
  "EVP Human Resources",
  "SVP Human Resources",
  "Diretor de RH",
  "Diretora de RH",
  "Diretor de Pessoas",
  "Diretora de Pessoas",
  "Diretor de Gente e Gestão",
  "Diretor de Pessoas e Cultura",
  "Head of HR",
  "Head of People",
  "Head of People & Culture",
  "HR Director",
  "People Director",
] as const;

export type HumanshipClassification = "eligible" | "validate" | "possible_rejected" | "pending";

export type RoleAssessment = {
  classification: Exclude<HumanshipClassification, "pending">;
  reference: string | null;
  score: number;
  reason: string;
};

export type CompanyAssessment = {
  restricted: boolean;
  matchedCompany: string | null;
  reference: string | null;
  category: string | null;
  reason: string;
};

export function currentRestrictionSnapshot() {
  return {
    version: humanshipRestrictionVersion,
    companyGroups: humanshipCompanyRestrictionGroups,
    roleReferences: humanshipRoleReferences,
  };
}

export function assessCompanyRestriction(company: string | undefined | null): CompanyAssessment {
  const value = normalize(company || "");
  if (!value) return { restricted: false, matchedCompany: null, reference: null, category: null, reason: "Empresa não informada para comparação." };

  for (const group of humanshipCompanyRestrictionGroups) {
    for (const restrictedCompany of group.companies) {
      const candidate = normalize(restrictedCompany);
      if (sameOrganization(value, candidate)) {
        return {
          restricted: true,
          matchedCompany: restrictedCompany,
          reference: group.reference,
          category: group.category,
          reason: `Empresa próxima de uma restrição vigente: ${restrictedCompany} (${group.reference} · ${group.category}).`,
        };
      }
    }
  }

  return { restricted: false, matchedCompany: null, reference: null, category: null, reason: "Nenhuma restrição de empresa identificada." };
}

export function assessRole(title: string | undefined | null): RoleAssessment {
  const raw = (title || "").trim();
  const value = normalize(raw);
  if (!value) return { classification: "possible_rejected", reference: null, score: 0, reason: "Cargo não informado." };

  const exact = humanshipRoleReferences.find((reference) => normalize(reference) === value);
  if (exact && normalize(exact) !== "cpo") {
    return { classification: "eligible", reference: exact, score: 100, reason: `Cargo corresponde diretamente à diretriz: ${exact}.` };
  }

  const domain = hasPeopleDomain(value);
  const executive = /\b(chro|chief|evp|svp|vp|vice president|vice-presidente|diretor|diretora|director|head)\b/.test(value);
  const nearExecutive = /\b(executivo|executiva|executive|gerente|manager|coordenador|coordenadora|coordinator)\b/.test(value);

  if (value === "cpo") {
    return { classification: "validate", reference: "Chief People Officer", score: 72, reason: "CPO é ambíguo e pode significar People, Product ou Procurement; precisa de validação pelo contexto do perfil." };
  }

  if (executive && domain) {
    const reference = closestRole(raw);
    return { classification: "eligible", reference, score: Math.max(88, roleSimilarity(raw, reference || raw)), reason: `Senioridade executiva e domínio de RH/Pessoas compatíveis${reference ? ` com ${reference}` : ""}.` };
  }

  if (nearExecutive && domain) {
    const reference = closestRole(raw);
    return { classification: "validate", reference, score: Math.max(62, roleSimilarity(raw, reference || raw)), reason: "Cargo está na liderança de RH/Pessoas, mas abaixo ou ao lado da faixa executiva principal; exige validação humana." };
  }

  const reference = closestRole(raw);
  const similarity = roleSimilarity(raw, reference || "");
  if (domain && similarity >= 55) {
    return { classification: "validate", reference, score: similarity, reason: `Cargo profissionalmente próximo da diretriz${reference ? ` (${reference})` : ""}, mas não é uma equivalência executiva clara.` };
  }

  return { classification: "possible_rejected", reference, score: similarity, reason: domain ? "Cargo está em RH/Pessoas, porém a senioridade aparenta ficar fora da diretriz atual." : "Cargo não aponta proximidade suficiente com liderança executiva de RH/Pessoas." };
}

export function classifyHumanshipParticipant(input: {
  sourceCompany?: string | null;
  sourceTitle?: string | null;
  linkedinCompany?: string | null;
  linkedinTitle?: string | null;
  linkedinFound: boolean;
}) {
  const company = input.linkedinCompany || input.sourceCompany || "";
  const title = input.linkedinTitle || input.sourceTitle || "";
  const companyAssessment = assessCompanyRestriction(company);
  const roleAssessment = assessRole(title);

  if (companyAssessment.restricted) {
    return {
      classification: "possible_rejected" as const,
      reason: `${companyAssessment.reason} ${roleAssessment.reason}`,
      roleAssessment,
      companyAssessment,
    };
  }

  if (!input.linkedinFound) {
    return {
      classification: roleAssessment.classification === "possible_rejected" ? "possible_rejected" as const : "validate" as const,
      reason: `LinkedIn ainda não confirmado. ${roleAssessment.reason}`,
      roleAssessment,
      companyAssessment,
    };
  }

  return {
    classification: roleAssessment.classification,
    reason: `${roleAssessment.reason} ${companyAssessment.reason}`,
    roleAssessment,
    companyAssessment,
  };
}

function closestRole(title: string) {
  let best: string | null = null;
  let score = 0;
  for (const reference of humanshipRoleReferences) {
    if (normalize(reference) === "cpo") continue;
    const current = roleSimilarity(title, reference);
    if (current > score) { score = current; best = reference; }
  }
  return best;
}

function roleSimilarity(a: string, b: string) {
  const left = roleTokens(a);
  const right = roleTokens(b);
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((item) => right.has(item)).length;
  const union = new Set([...left, ...right]).size;
  const jaccard = union ? intersection / union : 0;
  const domainBonus = hasPeopleDomain(normalize(a)) && hasPeopleDomain(normalize(b)) ? 0.2 : 0;
  return Math.min(100, Math.round((jaccard + domainBonus) * 100));
}

function roleTokens(value: string) {
  return new Set(normalize(value).split(/[^a-z0-9]+/).filter((token) => token.length >= 2 && !["de", "da", "do", "of", "and", "the"].includes(token)));
}

function hasPeopleDomain(value: string) {
  return /\b(rh|human resources|recursos humanos|people|pessoas|gente|people culture|people & culture|gente gestao|gente e gestao|pessoas cultura|pessoas e cultura|talent|recrutamento|selecao)\b/.test(value);
}

function sameOrganization(a: string, b: string) {
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const left = organizationTokens(a);
  const right = organizationTokens(b);
  const intersection = [...left].filter((item) => right.has(item)).length;
  return intersection >= 1 && intersection / Math.max(left.size, right.size) >= 0.6;
}

function organizationTokens(value: string) {
  return new Set(value.split(/[^a-z0-9]+/).filter((token) => token.length >= 3 && !["brasil", "group", "grupo", "sa", "ltda", "inc"].includes(token)));
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/&/g, " e ").replace(/\s+/g, " ").trim();
}
