import { authorizeScout, handleScoutError, json, readBody, selectionSchema } from "@/lib/scout/mkt/http";
import { getScoutService } from "@/lib/scout/mkt/service";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const auth = await authorizeScout();
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  try {
    const input = selectionSchema.parse(await readBody(request));
    return json(await getScoutService().analysis(input.trendId, input.brandId));
  } catch (error) { return handleScoutError(error); }
}
