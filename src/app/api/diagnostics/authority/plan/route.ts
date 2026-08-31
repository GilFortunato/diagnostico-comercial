import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorityThirtyDayPlanWithProvider } from "@/lib/ai/authorityProvider";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { PlatformResourceUnavailableError } from "@/lib/connectors/errors";
import { createStructuredAuthorityThirtyDayPlan } from "@/lib/diagnostics/authorityPlan";
import {
  findOwnedAuthorityAssessmentSnapshot,
  listAuthorityAssessments,
  saveAuthorityPlanSnapshot,
} from "@/lib/repositories/authorityRepository";

const requestSchema = z.object({
  assessmentId: z.string().min(1).optional(),
  assessment: z.object({ id: z.string().min(1) }).passthrough().optional(),
}).refine((value) => Boolean(value.assessmentId || value.assessment?.id));

export async function GET(request: Request) {
  const access = await authorizeModule("authority.personal");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const assessmentId = new URL(request.url).searchParams.get("assessmentId");
  if (!assessmentId) return NextResponse.json({ error: "Informe o diagnóstico." }, { status: 400 });
  const snapshot = await findOwnedAuthorityAssessmentSnapshot(assessmentId, access.user.id);
  if (!snapshot) return NextResponse.json({ error: "Diagnóstico não encontrado." }, { status: 404 });
  return NextResponse.json({ plan: snapshot.plan30Days });
}

export async function POST(request: Request) {
  const access = await authorizeModule("authority.personal");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Não foi possível identificar o diagnóstico." }, { status: 400 });

  const assessmentId = parsed.data.assessmentId ?? parsed.data.assessment?.id;
  const snapshot = await findOwnedAuthorityAssessmentSnapshot(assessmentId!, access.user.id);
  if (!snapshot) return NextResponse.json({ error: "O diagnóstico não pertence a esta conta ou não está mais disponível." }, { status: 403 });

  const history = await listAuthorityAssessments(snapshot.businessUnitId, access.user.id);
  let plan;
  try {
    plan = await createAuthorityThirtyDayPlanWithProvider({ assessment: snapshot.assessment, history });
  } catch (error) {
    if (!(error instanceof PlatformResourceUnavailableError)) {
      return NextResponse.json({ error: "Não foi possível gerar o plano neste momento." }, { status: 500 });
    }
    plan = createStructuredAuthorityThirtyDayPlan({ assessment: snapshot.assessment, history });
  }

  await saveAuthorityPlanSnapshot(snapshot.id, access.user.id, plan);
  return NextResponse.json(plan);
}
