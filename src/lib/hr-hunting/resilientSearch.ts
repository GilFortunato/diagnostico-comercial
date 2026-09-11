import "server-only";
import { getPrisma } from "@/lib/db/prisma";
import { executeHrHuntingSearch, findOwnedHrHuntingSearch } from "@/lib/hr-hunting/service";
import { executeStrategicHrHuntingSearch, simplifyFunctionalTitle } from "@/lib/hr-hunting/strategicSearch";

type SearchInput = {
  quantity: number;
  currentTitle?: string;
  seniority: string[];
  location?: string;
  keywords: string[];
};

export async function executeResilientHrHuntingSearch(id: string, ownerId: string, input: SearchInput) {
  try {
    return await executeStrategicHrHuntingSearch(id, ownerId, input);
  } catch (error) {
    console.warn("[hr-hunting] strategic sourcing failed; activating conservative search", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return executeConservativeFallback(id, ownerId, input);
  }
}

async function executeConservativeFallback(id: string, ownerId: string, input: SearchInput) {
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
    ? `A estratégia inteligente ficou indisponível nesta execução. A busca foi ampliada de forma conservadora para a família profissional “${broaderTitle}” sem bloquear por cidade; valide os resultados antes do contato.`
    : `A estratégia inteligente ficou indisponível e a expansão conservadora para a família profissional “${broaderTitle}” também não confirmou candidatos suficientes.`;

  await getPrisma().hrHuntingSearch.updateMany({
    where: { id, ownerId },
    data: { connectorWarnings: [...new Set([...broadened.connectorWarnings, explanation])] },
  });

  return findOwnedHrHuntingSearch(id, ownerId);
}

export { simplifyFunctionalTitle };

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}
