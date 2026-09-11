import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { markHumanshipMessageCopied, updateHumanshipDecision } from "@/lib/humanship/service";

const decisionSchema = z.object({ action: z.literal("decision"), decision: z.enum(["pending", "approved", "review", "rejected"]) });
const copiedSchema = z.object({ action: z.literal("copied"), message: z.union([z.literal(1), z.literal(2)]) });
const schema = z.discriminatedUnion("action", [decisionSchema, copiedSchema]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("humanship.r1ship");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  const participantId = (await params).id;
  const ok = parsed.data.action === "decision"
    ? await updateHumanshipDecision({ ownerId: access.user.id, participantId, decision: parsed.data.decision, decisionByName: access.user.name || access.user.email || "Usuário" })
    : await markHumanshipMessageCopied({ ownerId: access.user.id, participantId, message: parsed.data.message });
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Participante não encontrado." }, { status: 404 });
}
