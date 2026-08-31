import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { getProfessionalProfile, saveProfessionalLinkedInUrl } from "@/lib/profiles/professionalProfileRepository";
import { isLinkedInProfileUrl } from "@/lib/profiles/linkedinProfileUrl";

const linkedinSchema = z.string().url().refine(isLinkedInProfileUrl, "Informe uma URL válida de perfil do LinkedIn.");

export async function GET() {
  const access = await authorizeModule("authority.personal");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  return NextResponse.json({ profile: await getProfessionalProfile(access.user.id) });
}

export async function PATCH(request: Request) {
  const access = await authorizeModule("authority.personal");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = z.object({ linkedinUrl: linkedinSchema }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Informe uma URL válida de perfil do LinkedIn." }, { status: 400 });
  return NextResponse.json({ profile: await saveProfessionalLinkedInUrl(access.user.id, parsed.data.linkedinUrl) });
}
