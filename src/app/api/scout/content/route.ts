import { z } from "zod";
import { authorizeScout, contentRequestSchema, handleScoutError, json, readBody } from "@/lib/scout/mkt/http";
import { getContentGenerator } from "@/lib/scout/mkt/generation";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const auth = await authorizeScout();
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  try {
    const input = contentRequestSchema.parse(await readBody(request));
    return json(await getContentGenerator().generate({ ...input, userId: auth.user.id }));
  } catch (error) { return handleScoutError(error); }
}
export async function GET(request: Request) {
  const auth = await authorizeScout();
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  try {
    const id = z.string().uuid().parse(new URL(request.url).searchParams.get("id"));
    return json(await getContentGenerator().get(id, auth.user.id));
  } catch (error) { return handleScoutError(error); }
}
