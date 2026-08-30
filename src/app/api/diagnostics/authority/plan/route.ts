import { NextResponse } from "next/server";
import { z } from "zod";
import type { AuthorityAssessment } from "@/lib/diagnostics/authority";
import { createAuthorityThirtyDayPlanWithProvider } from "@/lib/ai/authorityProvider";
import { PlatformResourceUnavailableError } from "@/lib/connectors/errors";

const requestSchema = z.object({
  assessment: z.object({
    id: z.string().min(1),
    input: z.object({ businessUnitId: z.string().min(1), businessUnitName: z.string().min(1) }).passthrough(),
    overallScore: z.number(),
    authoritySellingScore: z.number().optional(),
    buAffinityScore: z.number().optional(),
    activationPotentialScore: z.number().optional(),
    dimensions: z.array(z.unknown()),
    gaps: z.array(z.string()),
    strengths: z.array(z.string()),
    bridgeOpportunities: z.array(z.unknown()),
    personalAuthorityPlan: z.unknown(),
    businessUnitActivationPlan: z.unknown(),
  }).passthrough(),
  history: z.array(z.unknown()).max(20).optional().default([]),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Não foi possível gerar o plano com os dados do diagnóstico." }, { status: 400 });
  }

  const assessment = parsed.data.assessment as AuthorityAssessment;
  const history = parsed.data.history.filter(isAssessment) as AuthorityAssessment[];
  try {
    const plan = await createAuthorityThirtyDayPlanWithProvider({ assessment, history });
    return NextResponse.json(plan);
  } catch (error) {
    if (error instanceof PlatformResourceUnavailableError) {
      return NextResponse.json({ error: error.publicMessage }, { status: 503 });
    }
    return NextResponse.json({ error: "Não foi possível gerar o plano neste momento." }, { status: 500 });
  }
}

function isAssessment(value: unknown): value is AuthorityAssessment {
  return value !== null && typeof value === "object" && "id" in value && "input" in value;
}
