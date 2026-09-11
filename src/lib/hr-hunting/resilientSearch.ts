import "server-only";
import { getPrisma } from "@/lib/db/prisma";
import { findOwnedHrHuntingSearch } from "@/lib/hr-hunting/service";
import { executeSafeStrategicHrHuntingSearch } from "@/lib/hr-hunting/safeStrategicSearch";
import { simplifyFunctionalTitle } from "@/lib/hr-hunting/strategicSearch";

type SearchInput = {
  quantity: number;
  currentTitle?: string;
  seniority: string[];
  location?: string;
  keywords: string[];
};

export async function executeResilientHrHuntingSearch(id: string, ownerId: string, input: SearchInput) {
  try {
    return await executeSafeStrategicHrHuntingSearch(id, ownerId, input);
  } catch (error) {
    console.error("[hr-hunting] repeat-safe strategic search failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message.slice(0, 240) : "unknown",
    });

    const current = await findOwnedHrHuntingSearch(id, ownerId);
    if (!current) return null;
    const warning = "A busca encontrou uma falha interna antes de concluir a persistência. Os resultados anteriores foram preservados; tente novamente sem alterar a vaga.";
    await getPrisma().hrHuntingSearch.updateMany({
      where: { id, ownerId },
      data: { status: "connector_error", connectorWarnings: [...new Set([...current.connectorWarnings, warning])] },
    });
    return findOwnedHrHuntingSearch(id, ownerId);
  }
}

export { simplifyFunctionalTitle };
