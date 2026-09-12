import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { readHumanshipGoogleSheet } from "@/lib/humanship/googleSheets";
import { getHumanshipEvent, syncHumanshipRows } from "@/lib/humanship/service";

const schema = z.object({ sheetUrl: z.string().trim().max(2_000).optional().or(z.literal("")) });

export const maxDuration = 120;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("humanship.r1ship");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const eventId = (await params).id;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Informe um link válido do Google Sheets." }, { status: 400 });
  const existing = await getHumanshipEvent(access.user.id, eventId);
  if (!existing) return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
  const reference = parsed.data.sheetUrl?.trim() || existing.sourceExternalId || "";
  if (!reference) return NextResponse.json({ error: "Cole o link da planilha do Google Sheets." }, { status: 400 });

  try {
    const sheet = await readHumanshipGoogleSheet(access.user.id, reference);
    if (!sheet.rows.length) return NextResponse.json({ error: "Não encontrei participantes válidos na planilha." }, { status: 400 });
    const event = await syncHumanshipRows({
      ownerId: access.user.id,
      eventId,
      rows: sheet.rows,
      sourceKind: "google_sheets",
      sourceName: sheet.spreadsheetTitle,
      sourceExternalId: sheet.spreadsheetId,
      sourceSheetName: sheet.sheetName,
    });
    return NextResponse.json({ event });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível sincronizar o Google Sheets." }, { status: 400 });
  }
}
