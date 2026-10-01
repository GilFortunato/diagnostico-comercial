import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { markHumanshipMessageCopied, saveHumanshipRoleRule, updateHumanshipDecision, saveHumanshipLinkedin } from "@/lib/humanship/service";
import { manualLinkedinSchema } from "@/lib/humanship/manualLinkedin";

const decisionSchema = z.object({ action: z.literal("decision"), decision: z.enum(["pending", "approved", "review", "rejected"]) });
const copiedSchema = z.object({ action: z.literal("copied"), message: z.union([z.literal(1), z.literal(2)]) });
const roleRuleSchema = z.object({ action: z.literal("role_rule"), decision: z.enum(["accepted", "rejected"]) });
const schema = z.discriminatedUnion("action", [decisionSchema, copiedSchema, roleRuleSchema, manualLinkedinSchema]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("humanship.r1ship");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Ação inválida." }, { status: 400 });
  const participantId = (await params).id;
  const decidedByName = access.user.name || access.user.email || "Usuário";
  const ok = parsed.data.action === "linkedin"
    ? await saveHumanshipLinkedin({ ownerId: access.user.id, participantId, linkedinUrl: parsed.data.linkedinUrl, savedByName: decidedByName })
    : parsed.data.action === "decision"
    ? await updateHumanshipDecision({ ownerId: access.user.id, participantId, decision: parsed.data.decision, decisionByName: decidedByName })
    : parsed.data.action === "role_rule"
      ? await saveHumanshipRoleRule({ ownerId: access.user.id, participantId, decision: parsed.data.decision, decidedByName })
      : await markHumanshipMessageCopied({ ownerId: access.user.id, participantId, message: parsed.data.message });
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Participante ou cargo não encontrado." }, { status: 404 });
}
