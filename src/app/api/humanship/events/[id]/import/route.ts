import { NextResponse } from "next/server";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { parseHumanshipFile } from "@/lib/humanship/importRows";
import { syncHumanshipRows } from "@/lib/humanship/service";

export const maxDuration = 120;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("humanship.r1ship");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const form = await request.formData();
    const candidate = form.get("file");
    if (!isUpload(candidate)) return NextResponse.json({ error: "Selecione uma planilha .xlsx ou .csv." }, { status: 400 });

    const filename = candidate.name || "planilha.xlsx";
    const lower = filename.toLocaleLowerCase("pt-BR");
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".csv")) {
      return NextResponse.json({ error: "Formato não suportado. Exporte a planilha como .xlsx ou .csv." }, { status: 400 });
    }
    if (candidate.size > 12 * 1024 * 1024) return NextResponse.json({ error: "O arquivo excede o limite de 12 MB." }, { status: 400 });

    const rows = await parseHumanshipFile(await candidate.arrayBuffer(), filename);
    if (!rows.length) return NextResponse.json({ error: "Não encontrei participantes válidos. Confirme se existe uma coluna de Nome/Nome completo e pelo menos uma linha preenchida." }, { status: 400 });

    const event = await syncHumanshipRows({ ownerId: access.user.id, eventId: (await params).id, rows, sourceKind: "excel", sourceName: filename });
    return event
      ? NextResponse.json({ event, importedRows: rows.length })
      : NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
  } catch (error) {
    console.warn("[humanship] spreadsheet import failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível importar a planilha." }, { status: 400 });
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
