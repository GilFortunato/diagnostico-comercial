import { NextResponse } from "next/server";
import { authorityInputSchema } from "@/lib/diagnostics/authority";
import { createAuthorityAssessmentWithProvider } from "@/lib/ai/authorityProvider";
import { extractLinkedInProfileWithApify } from "@/lib/connectors/apifyLinkedIn";
import { getUserApifyToken } from "@/lib/connectors/userApifyCredential";
import { saveAuthorityAssessment } from "@/lib/repositories/authorityRepository";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = authorityInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Não foi possível gerar o diagnóstico com os dados informados.", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const apifyToken = await getUserApifyToken();
    const linkedinExtraction = parsed.data.profileUrl && apifyToken ? await extractLinkedInProfileWithApify(parsed.data.profileUrl, apifyToken) : null;
    const enrichedInput = {
      ...parsed.data,
      headline: linkedinExtraction?.input.headline || parsed.data.headline,
      about: linkedinExtraction?.input.about || parsed.data.about,
      themes: linkedinExtraction?.input.themes || parsed.data.themes,
      proofPoints: linkedinExtraction?.input.proofPoints || parsed.data.proofPoints,
      recentContent: linkedinExtraction?.input.recentContent || parsed.data.recentContent,
      interactionSignals: linkedinExtraction?.input.interactionSignals || parsed.data.interactionSignals,
    };
    const assessment = await createAuthorityAssessmentWithProvider(enrichedInput, linkedinExtraction ? [linkedinExtraction.source] : []);
    await saveAuthorityAssessment(assessment);
    return NextResponse.json(assessment);
  } catch (error) {
    console.error("authority-diagnostic-provider-error", error);
    return NextResponse.json(
      { error: "A inteligência da Share AI está indisponível no momento. Para preservar a qualidade, nenhum diagnóstico especialista foi gerado. Tente novamente em alguns minutos." },
      { status: 503 },
    );
  }
}
