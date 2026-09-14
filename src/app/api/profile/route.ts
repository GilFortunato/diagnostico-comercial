import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { summarizeLinkedInSnapshot } from "@/lib/connectors/linkedinArchive";
import { normalizedLinkedInSnapshotSchema } from "@/lib/connectors/linkedinNormalization";
import { getProfessionalProfile, readLinkedInImportMetadata, saveProfessionalLinkedInUrl } from "@/lib/profiles/professionalProfileRepository";
import { isLinkedInProfileUrl } from "@/lib/profiles/linkedinProfileUrl";

const linkedinSchema = z.string().url().refine(isLinkedInProfileUrl, "Informe uma URL válida de perfil do LinkedIn.");

export async function GET() {
  const access = await authorizeModule("authority.personal");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const profile = await getProfessionalProfile(access.user.id);
  return NextResponse.json({ profile: toPublicProfile(profile) });
}

export async function PATCH(request: Request) {
  const access = await authorizeModule("authority.personal");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = z.object({ linkedinUrl: linkedinSchema }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Informe uma URL válida de perfil do LinkedIn." }, { status: 400 });
  const profile = await saveProfessionalLinkedInUrl(access.user.id, parsed.data.linkedinUrl);
  return NextResponse.json({ profile: toPublicProfile(profile) });
}

function toPublicProfile(profile: Awaited<ReturnType<typeof getProfessionalProfile>>) {
  if (!profile) return null;
  const parsedSnapshot = normalizedLinkedInSnapshotSchema.safeParse(profile.latestLinkedinSnapshot);
  const importMetadata = readLinkedInImportMetadata(profile.latestLinkedinSnapshot);
  const importedSummary = parsedSnapshot.success && importMetadata
    ? { ...summarizeLinkedInSnapshot(parsedSnapshot.data, importMetadata.filesUsed, parsedSnapshot.data.userCommentsAvailable), collectedAt: importMetadata.importedAt }
    : null;
  return {
    id: profile.id,
    linkedinUrl: profile.linkedinUrl,
    linkedinUpdatedAt: profile.linkedinUpdatedAt,
    lastAuthorityAnalysisAt: profile.lastAuthorityAnalysisAt,
    linkedinImport: importedSummary,
  };
}
