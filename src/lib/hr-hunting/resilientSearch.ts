import "server-only";
import { getPrisma } from "@/lib/db/prisma";
import { executeHrHuntingSearch, findOwnedHrHuntingSearch } from "@/lib/hr-hunting/service";

type SearchInput = {
  quantity: number;
  currentTitle?: string;
  seniority: string[];
  location?: string;
  keywords: string[];
};

export async function executeResilientHrHuntingSearch(id: string, ownerId: string, input: SearchInput) {
  const exact = await executeHrHuntingSearch(id, ownerId, input);
  if (!exact || exact.status !== "no_results") return exact;

  const originalTitle = input.currentTitle?.trim() || exact.jobDna.title?.trim() || exact.title;
  const broaderTitle = simplifyFunctionalTitle(originalTitle);
  const canBroaden = Boolean(input.location?.trim()) || normalize(originalTitle) !== normalize(broaderTitle);
  if (!canBroaden) return exact;

  const broadened = await executeHrHuntingSearch(id, ownerId, {
    ...input,
    currentTitle: broaderTitle,
    location: undefined,
  });
  if (!broadened) return exact;

  const explanation = broadened.candidates.length
    ? `Nenhum perfil passou no recorte exato de cargo/localização. A busca foi ampliada para a família profissional “${broaderTitle}” sem bloquear por cidade; os resultados exibidos são os mais próximos e devem ser validados antes do contato.`
    : `A busca exata não trouxe perfis elegíveis e uma segunda rodada ampliada para a família profissional “${broaderTitle}” também não confirmou candidatos suficientes.`;

  await getPrisma().hrHuntingSearch.updateMany({
    where: { id, ownerId },
    data: { connectorWarnings: [...new Set([...broadened.connectorWarnings, explanation])] },
  });

  return findOwnedHrHuntingSearch(id, ownerId);
}

export function simplifyFunctionalTitle(title: string) {
  const cleaned = title
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(analista|analyst|assistente|assistant|gerente|manager|coordenador|coordinator|especialista|specialist|senior|sênior|sr|junior|júnior|jr|pleno|trainee|estagi[aá]ri[oa]|intern)\b/gi, " ")
    .replace(/\b(de|do|da|dos|das|em|na|no|para|the|of|and)\b/gi, " ")
    .replace(/\b[ivx]+\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 3 ? cleaned : title.trim();
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}
