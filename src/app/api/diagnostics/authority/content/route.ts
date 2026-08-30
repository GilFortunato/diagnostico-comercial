import { NextResponse } from "next/server";
import { z } from "zod";
import type { AuthorityAssessment } from "@/lib/diagnostics/authority";
import { createAuthorityContentDraftWithProvider, type AuthorityContentBrief } from "@/lib/ai/authorityContentProvider";
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
  }).passthrough(),
  brief: z.object({
    objective: z.enum(["Autoridade", "Conversa", "Provocação", "Valor prático", "Storytelling", "Relacionamento", "Ativação da BU"]),
    bridgeId: z.string().optional(),
    humanContext: z.string().max(2500).optional().default(""),
    strategy: z.enum(["Recomendada", "Autoridade", "Mais pessoal", "Mais provocativo", "Mais prático", "Mais conversacional"]),
  }),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Não foi possível criar o conteúdo com os dados informados." }, { status: 400 });
  }

  try {
    const assessment = parsed.data.assessment as AuthorityAssessment;
    const brief = parsed.data.brief as AuthorityContentBrief;
    const draft = await createAuthorityContentDraftWithProvider(assessment, brief);
    return NextResponse.json(draft);
  } catch (error) {
    if (error instanceof PlatformResourceUnavailableError) {
      return NextResponse.json({ error: error.publicMessage }, { status: 503 });
    }
    return NextResponse.json(
      { error: "Não foi possível gerar um rascunho com qualidade suficiente. Tente novamente." },
      { status: 500 },
    );
  }
}
