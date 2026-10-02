import { authorizeScout, handleScoutError, json, readBody, selectionSchema } from "@/lib/scout/mkt/http";
import { getScoutService, visualSearchAvailable } from "@/lib/scout/mkt/service";
import { getScoutStore, isFresh } from "@/lib/scout/mkt/store";
import { searchVisualScoutImages } from "@/lib/scout/imageSearch";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const auth = await authorizeScout();
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  try {
    const input = selectionSchema.parse(await readBody(request));
    const { analysis } = await getScoutService().analysis(input.trendId, input.brandId);
    if (!visualSearchAvailable()) return json({
      query: analysis.visual.searchTerms.join(" "), rawCount: 0, prefilteredCount: 0, batchSize: 12, results: [], providers: [],
      message: "A busca externa de referências não está disponível. A direção visual continua pronta para usar.",
    });
    const store = getScoutStore();
    const cached = await store.get("references", analysis.id);
    if (isFresh(cached)) return json(cached!.record.payload);
    const result = await searchVisualScoutImages(analysis.visual.searchTerms.join(" ").slice(0, 500));
    await store.put("references", analysis.id, result, { ttlMs: 60 * 60_000 });
    return json(result);
  } catch (error) { return handleScoutError(error); }
}
