import { NextResponse } from "next/server";
import { authorityInputSchema } from "@/lib/diagnostics/authority";
import { createAuthorityAssessmentWithProvider } from "@/lib/ai/authorityProvider";
import { extractLinkedInAuthorityWithApify } from "@/lib/connectors/apifyLinkedIn";
import { PlatformResourceUnavailableError } from "@/lib/connectors/errors";
import { executeAuthorityPipeline, InsufficientPublicProfileDataError } from "@/lib/diagnostics/authorityPipeline";
import { saveAuthorityAssessment } from "@/lib/repositories/authorityRepository";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { getProfessionalProfile, recordAuthorityProfileSnapshot, saveProfessionalLinkedInUrl } from "@/lib/profiles/professionalProfileRepository";

export async function POST(request: Request) {
  const access = await authorizeModule("authority.personal");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json();
  const savedProfile = await getProfessionalProfile(access.user.id);
  const parsed = authorityInputSchema.safeParse({
    ...body,
    profileUrl: typeof body?.profileUrl === "string" && body.profileUrl.trim()
      ? body.profileUrl.trim()
      : savedProfile?.linkedinUrl ?? "",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Não foi possível gerar o diagnóstico com os dados informados.", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const assessment = await executeAuthorityPipeline(parsed.data, {
      extractProfile: extractLinkedInAuthorityWithApify,
      createAssessment: createAuthorityAssessmentWithProvider,
    });
    await saveAuthorityAssessment(assessment, access.user);
    if (assessment.input.profileUrl) {
      await saveProfessionalLinkedInUrl(access.user.id, assessment.input.profileUrl);
    }
    await recordAuthorityProfileSnapshot(
      access.user.id,
      assessment.input.profileUrl || null,
      assessment.input.linkedinSnapshot ?? null,
    );
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
