import { NextResponse } from "next/server";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { parseLinkedInArchive } from "@/lib/connectors/linkedinArchive";
import { isLinkedInProfileUrl } from "@/lib/profiles/linkedinProfileUrl";
import { getProfessionalProfile, saveImportedLinkedInSnapshot } from "@/lib/profiles/professionalProfileRepository";

export const maxDuration = 60;

export async function POST(request: Request) {
  const access = await authorizeModule("authority.personal");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const form = await request.formData();
    const candidate = form.get("file");
    if (!isUpload(candidate)) {
      return NextResponse.json({ error: "Selecione o arquivo .zip recebido do LinkedIn." }, { status: 400 });
    }

    const savedProfile = await getProfessionalProfile(access.user.id);
    const formUrl = typeof form.get("linkedinUrl") === "string" ? String(form.get("linkedinUrl")).trim() : "";
    const linkedinUrl = formUrl || savedProfile?.linkedinUrl || "";
    if (!isLinkedInProfileUrl(linkedinUrl)) {
      return NextResponse.json({ error: "Salve primeiro a URL do seu perfil do LinkedIn para vincular o arquivo ao diagnóstico." }, { status: 400 });
    }

    const filename = candidate.name || "linkedin-data.zip";
    const lower = filename.toLocaleLowerCase("pt-BR");
    if (!lower.endsWith(".zip") && !lower.endsWith(".csv")) {
      return NextResponse.json({ error: "Formato não suportado. Envie o .zip recebido do LinkedIn ou um CSV exportado por ele." }, { status: 400 });
    }
    if (candidate.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "O arquivo excede o limite de 25 MB." }, { status: 400 });
    }

    const { snapshot, summary } = parseLinkedInArchive(await candidate.arrayBuffer(), filename, linkedinUrl);
    await saveImportedLinkedInSnapshot(access.user.id, linkedinUrl, snapshot, summary.filesUsed);

    return NextResponse.json({ summary });
  } catch (error) {
    console.warn("[linkedin-import] import failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível importar os dados do LinkedIn." }, { status: 400 });
  }
}

type UploadLike = { name: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> };

function isUpload(value: FormDataEntryValue | null): value is FormDataEntryValue & UploadLike {
  return Boolean(
    value
    && typeof value === "object"
    && "arrayBuffer" in value
    && typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function"
    && "name" in value
    && typeof (value as { name?: unknown }).name === "string"
    && "size" in value
    && typeof (value as { size?: unknown }).size === "number",
  );
}
