import "server-only";
import { executeSafeStrategicHrHuntingSearch } from "@/lib/hr-hunting/safeStrategicSearch";

type LoadMoreInput = {
  quantity: number;
  currentTitle?: string;
  seniority: string[];
  location?: string;
  keywords: string[];
  batchSize: number;
};

export async function loadMoreHrHuntingCandidates(id: string, ownerId: string, input: LoadMoreInput) {
  const { batchSize, ...filters } = input;
  return executeSafeStrategicHrHuntingSearch(id, ownerId, {
    ...filters, quantity: Math.min(25, Math.max(5, batchSize)),
  }, { append: true });
}
