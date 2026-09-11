import { NextResponse } from "next/server";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { parseHumanshipExcel } from "@/lib/humanship/importRows";
import { syncHumanshipRows } from "@/lib/humanship/service";

export const maxDuration = 120;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("humanship.r1ship");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Selecione um arquivo Excel .xlsx." }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".xlsx")) return NextResponse.json({ error: "Use um arquivo .xlsx." }, { status: 400 });
  if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: "O arquivo excede o limite de 12 MB." }, { status: 400 });

  try {
    const rows = await parseHumanshipExcel(await file.arrayBuffer());
    if (!rows.length) return NextResponse.json({ error: "Não encontrei participantes válidos no arquivo." }, { status: 400 });
    const event = await syncHumanshipRows({ ownerId: access.user.id, eventId: (await params).id, rows, sourceKind: "excel", sourceName: file.name });
    return event ? NextResponse.json({ event }) : NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível importar a planilha." }, { status: 400 });
  }
}
