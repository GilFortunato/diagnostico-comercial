import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { enhanceHumanshipEventWithDeepSearch } from "@/lib/humanship/deepSearchService";
import { getHumanshipEvent, runHumanshipLinkedinSearch } from "@/lib/humanship/service";

const schema = z.object({ rescan: z.boolean().optional().default(false) });

export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("humanship.r1ship");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });

  const eventId = (await params).id;
  const direct = await runHumanshipLinkedinSearch(access.user.id, eventId, parsed.data);
  if (!direct) return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });

  const deepSearch = await enhanceHumanshipEventWithDeepSearch(access.user.id, direct);
  const event = await getHumanshipEvent(access.user.id, eventId);

  return NextResponse.json({
    event,
    deepSearch: {
      attempted: deepSearch.attempted,
      improved: deepSearch.improved,
      warnings: deepSearch.warnings,
    },
  });
}
