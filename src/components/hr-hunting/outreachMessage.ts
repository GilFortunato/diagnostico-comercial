import type { HrCandidate, HrHuntingSearchSnapshot } from "@/lib/hr-hunting/types";

export function buildLinkedInOutreachMessage(candidate: HrCandidate, search: HrHuntingSearchSnapshot, accountName?: string | null) {
  const candidateFirstName = firstName(candidate.name) || candidate.name || "tudo bem";
  const senderName = firstName(accountName) || firstName(search.recruiterName) || "da equipe de recrutamento";
  const role = search.jobDna.title?.trim() || search.title.trim() || "uma oportunidade";
  const company = search.companyName?.trim();
  const jobUrl = search.jobUrl?.trim();
  const companyText = company ? ` para ${company}` : "";
  const profileSignal = candidate.currentTitle?.trim()
    ? `Seu perfil chamou minha atenção pela sua experiência como ${candidate.currentTitle.trim()}.`
    : "Seu perfil chamou minha atenção pela sua trajetória profissional.";
  const applicationText = jobUrl
    ? `\n\nVocê pode conhecer os detalhes da vaga e se candidatar por aqui: ${jobUrl}`
    : "";

  return [
    `Oi, ${candidateFirstName}! Tudo bem?`,
    "",
    `Eu sou ${senderName} e estou conduzindo uma oportunidade para ${role}${companyText}. ${profileSignal}`,
    "",
    "Achei que a oportunidade pode fazer sentido para o seu momento profissional e gostaria de te convidar para conhecer mais.",
    applicationText,
    "",
    "Se fizer sentido para você, fico à disposição para conversar por aqui.",
  ].join("\n").replace(/\n{3,}/g, "\n\n");
}

export function firstName(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) return "";
  const beforeAt = normalized.includes("@") ? normalized.split("@")[0] : normalized;
  const token = beforeAt.split(/[\s._-]+/).find(Boolean) || beforeAt;
  return token.charAt(0).toLocaleUpperCase("pt-BR") + token.slice(1);
}
