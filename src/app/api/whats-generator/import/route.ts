import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { Workbook } from "exceljs";
import { authorizeModule } from "@/lib/auth/moduleRequest";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_ROWS = 1500;

export async function POST(request: Request) {
  const access = await authorizeModule("communication.whats-generator");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Envie uma planilha .xlsx ou .csv." }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "A planilha deve ter no máximo 8 MB." }, { status: 400 });

  const lower = file.name.toLocaleLowerCase("pt-BR");
  if (!lower.endsWith(".xlsx") && !lower.endsWith(".csv")) {
    return NextResponse.json({ error: "Formato não suportado. Use .xlsx ou .csv." }, { status: 400 });
  }

  try {
    const workbook = new Workbook();
    const arrayBuffer = await file.arrayBuffer();

    if (lower.endsWith(".csv")) {
      await workbook.csv.read(Readable.from([Buffer.from(arrayBuffer)]));
    } else {
      // ExcelJS 4.4.0 types its load input as an ArrayBuffer-like Buffer.
      // Passing the browser-standard ArrayBuffer avoids the Node Buffer generic mismatch.
      await workbook.xlsx.load(arrayBuffer);
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) return NextResponse.json({ error: "A planilha não possui uma aba legível." }, { status: 400 });

    const width = Math.max(sheet.columnCount, 1);
    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    const used = new Set<string>();

    for (let column = 1; column <= width; column += 1) {
      const original = cellText(headerRow.getCell(column)).trim() || `Coluna ${column}`;
      let header = original;
      let suffix = 2;
      while (used.has(header)) header = `${original} (${suffix++})`;
      used.add(header);
      headers.push(header);
    }

    const rows: Record<string, string>[] = [];
    const lastRow = Math.min(sheet.rowCount, MAX_ROWS + 1);
    for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const record: Record<string, string> = {};
      let hasValue = false;
      for (let column = 1; column <= headers.length; column += 1) {
        const value = cellText(row.getCell(column)).trim();
        record[headers[column - 1]] = value;
        if (value) hasValue = true;
      }
      if (hasValue) rows.push(record);
    }

    if (!rows.length) return NextResponse.json({ error: "A planilha não contém contatos abaixo do cabeçalho." }, { status: 400 });

    return NextResponse.json({
      fileName: file.name,
      headers,
      rows,
      truncated: sheet.rowCount - 1 > MAX_ROWS,
      suggestedMapping: inferMapping(headers),
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível ler a planilha. Confirme se o arquivo é um .xlsx ou .csv válido." }, { status: 400 });
  }
}

function cellText(cell: { text: string; value: unknown }) {
  if (cell.text) return cell.text;
  if (cell.value == null) return "";
  return String(cell.value);
}

function inferMapping(headers: string[]) {
  const normalized = headers.map((header) => ({ header, value: normalize(header) }));
  return {
    name: find(normalized, ["nome", "candidato", "candidata", "name", "nome candidato"]),
    phone: find(normalized, ["telefone", "celular", "whatsapp", "whats", "phone", "fone"]),
    job: find(normalized, ["vaga", "cargo", "oportunidade", "job", "position", "posicao"]),
  };
}

function find(items: Array<{ header: string; value: string }>, candidates: string[]) {
  return items.find((item) => candidates.some((candidate) => item.value === candidate || item.value.includes(candidate)))?.header || "";
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();
}
