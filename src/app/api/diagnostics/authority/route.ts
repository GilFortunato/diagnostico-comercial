import { NextResponse } from "next/server";
import { authorityInputSchema } from "@/lib/diagnostics/authority";
import { createAuthorityAssessmentWithProvider } from "@/lib/ai/authorityProvider";
import { extractLinkedInProfileWithApify } from "@/lib/connectors/apifyLinkedIn";
import { PlatformResourceUnavailableError } from "@/lib/connectors/errors";
import { executeAuthorityPipeline, InsufficientPublicProfileDataError } from "@/lib/diagnostics/authorityPipeline";
import { saveAuthorityAssessment } from "@/lib/repositories/authorityRepository";
import { getSessionUser } from "@/lib/auth/sessionUser";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Entre com sua conta Google para gerar o diagnóstico." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = authorityInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Não foi possível gerar o diagnóstico com os dados informados.", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const assessment = await executeAuthorityPipeline(parsed.data, {
      extractProfile: extractLinkedInProfileWithApify,
      createAssessment: createAuthorityAssessmentWithProvider,
    });
    await saveAuthorityAssessment(assessment, user);
    return NextResponse.json(assessment);
  } catch (error) {
    if (error instanceof PlatformResourceUnavailableError) {
      return NextResponse.json({ error: error.publicMessage }, { status: 503 });
    }
    if (error instanceof InsufficientPublicProfileDataError) {
      return NextResponse.json({ error: "Não foi possível recuperar dados públicos suficientes deste perfil. Revise a URL ou tente novamente mais tarde." }, { status: 422 });
    }
    return NextResponse.json({ error: "Não foi possível concluir o diagnóstico. Tente novamente mais tarde." }, { status: 500 });
  }
}
