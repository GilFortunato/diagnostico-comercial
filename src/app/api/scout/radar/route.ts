import { authorizeScout, handleScoutError, json, radarRequestSchema } from "@/lib/scout/mkt/http";
import { getScoutService } from "@/lib/scout/mkt/service";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const auth = await authorizeScout();
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  try {
    const params = new URL(request.url).searchParams;
    const input = radarRequestSchema.parse({ brand: params.get("brand") ?? undefined, q: params.get("q") ?? undefined });
    return json(await getScoutService().radar(input.brand, input.q));
  } catch (error) { return handleScoutError(error); }
}
