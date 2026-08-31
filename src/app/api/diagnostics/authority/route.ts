import { NextResponse } from "next/server";
import { authorityInputSchema } from "@/lib/diagnostics/authority";
import { createAuthorityAssessmentWithProvider } from "@/lib/ai/authorityProvider";
import { extractLinkedInAuthorityWithApify } from "@/lib/connectors/apifyLinkedIn";
import { PlatformResourceUnavailableError } from "@/lib/connectors/errors";
import { executeAuthorityPipeline, InsufficientPublicProfileDataError } from "@/lib/diagnostics/authorityPipeline";
import { saveAuthorityAssessment } from "@/lib/repositories/authorityRepository";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { getProfessionalProfile, recordAuthorityProfileSnapshot, saveProfessionalLinkedInUrl } from "@/lib/profiles/professionalProfileRepository";

type AuthorityStage =
  | "load_profile"
  | "linkedin_extract"
  | "assessment_engine"
  | "save_assessment"
  | "save_profile_url"
  | "save_profile_snapshot";

export async function POST(request: Request) {
  const access = await authorizeModule("authority.personal");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Não foi possível gerar o diagnóstico com os dados informados." }, { status: 400 });
  }

  let savedProfile: Awaited<ReturnType<typeof getProfessionalProfile>>;
  try {
    savedProfile = await getProfessionalProfile(access.user.id);
  } catch (error) {
    logAuthorityFailure("load_profile", error);
    return internalErrorResponse();
  }

  const parsed = authorityInputSchema.safeParse({
    ...body,
    profileUrl: typeof body.profileUrl === "string" && body.profileUrl.trim()
      ? body.profileUrl.trim()
      : savedProfile?.linkedinUrl ?? "",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Não foi possível gerar o diagnóstico com os dados informados.", issues: parsed.error.flatten() }, { status: 400 });
  }

  let assessment: Awaited<ReturnType<typeof executeAuthorityPipeline>>;
  try {
    assessment = await executeAuthorityPipeline(parsed.data, {
      extractProfile: async (profileUrl) => {
        try {
          return await extractLinkedInAuthorityWithApify(profileUrl);
        } catch (error) {
          logAuthorityFailure("linkedin_extract", error);
          throw error;
        }
      },
      createAssessment: async (input, sources) => {
        try {
          return await createAuthorityAssessmentWithProvider(input, sources);
        } catch (error) {
          logAuthorityFailure("assessment_engine", error);
          throw error;
        }
      },
    });
  } catch (error) {
    if (error instanceof PlatformResourceUnavailableError) {
      return NextResponse.json({ error: error.publicMessage }, { status: 503 });
    }
    if (error instanceof InsufficientPublicProfileDataError) {
      return NextResponse.json({ error: "Não foi possível recuperar dados públicos suficientes deste perfil. Revise a URL ou tente novamente mais tarde." }, { status: 422 });
    }
    return internalErrorResponse();
  }

  try {
    await saveAuthorityAssessment(assessment, access.user);
  } catch (error) {
    logAuthorityFailure("save_assessment", error);
    return internalErrorResponse();
  }

  if (assessment.input.profileUrl) {
    try {
      await saveProfessionalLinkedInUrl(access.user.id, assessment.input.profileUrl);
    } catch (error) {
      logAuthorityFailure("save_profile_url", error, "warn");
    }
  }

  try {
    await recordAuthorityProfileSnapshot(
      access.user.id,
      assessment.input.profileUrl || null,
      assessment.input.linkedinSnapshot ?? null,
    );
  } catch (error) {
    logAuthorityFailure("save_profile_snapshot", error, "warn");
  }

  return NextResponse.json(assessment);
}

function internalErrorResponse() {
  return NextResponse.json({ error: "Não foi possível concluir o diagnóstico. Tente novamente mais tarde." }, { status: 500 });
}

function logAuthorityFailure(stage: AuthorityStage, error: unknown, severity: "error" | "warn" = "error") {
  const metadata = {
    event: "authority_diagnostic_stage_failure",
    stage,
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorCode: readErrorCode(error),
    databaseError: readDatabaseError(error),
  };
  if (severity === "warn") console.warn("[authority-diagnostic]", metadata);
  else console.error("[authority-diagnostic]", metadata);
}

function readErrorCode(error: unknown) {
  if (!isRecord(error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

function readDatabaseError(error: unknown) {
  if (!isRecord(error) || !isRecord(error.meta)) return undefined;
  const value = error.meta.database_error;
  if (typeof value !== "string") return undefined;
  return value.replace(/[\r\n\t]+/g, " ").slice(0, 240);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
