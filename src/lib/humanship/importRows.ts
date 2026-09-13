import ExcelJS from "exceljs";
import type { ImportedHumanshipRow } from "@/lib/humanship/types";

const ignoredHeaders = [/^cpf$/i, /autorizo o tratamento/i, /consent/i];
const nameAliases = ["nome completo", "nome e sobrenome", "nome", "full name", "name", "participante", "participant", "candidato", "candidate"];

export async function parseHumanshipFile(buffer: ArrayBuffer, filename: string) {
  const lower = filename.toLocaleLowerCase("pt-BR");
  if (lower.endsWith(".csv")) return parseHumanshipCsv(buffer);
  if (lower.endsWith(".xlsx")) return parseHumanshipExcel(buffer);
  throw new Error("Formato não suportado. Envie um arquivo .xlsx ou .csv.");
}

export async function parseHumanshipExcel(buffer: ArrayBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(new Uint8Array(buffer)) as never);
  const worksheets = workbook.worksheets.filter((sheet) => sheet.actualRowCount > 0);
  if (!worksheets.length) return [];

  let lastError: Error | null = null;
  for (const worksheet of worksheets) {
    const rows: unknown[][] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = Array.isArray(row.values) ? row.values : [];
      rows.push(values.slice(1).map(cellValue));
    });
    try {
      const normalized = normalizeHumanshipRows(rows);
      if (normalized.length) return normalized;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Não foi possível interpretar a aba da planilha.");
    }
  }
  if (lastError) throw lastError;
  return [];
}

export function parseHumanshipCsv(buffer: ArrayBuffer) {
  const text = new TextDecoder("utf-8").decode(new Uint8Array(buffer)).replace(/^\uFEFF/, "");
  if (!text.trim()) return [];
  const delimiter = detectDelimiter(text);
  return normalizeHumanshipRows(parseDelimited(text, delimiter));
}

export function normalizeHumanshipRows(rows: unknown[][]): ImportedHumanshipRow[] {
  const table = rows.map((row) => row.map((value) => cellValue(value)));
  const headerIndex = table.findIndex((row) => row.some((value) => matchesHeader(value, nameAliases)));
  if (headerIndex < 0) throw new Error("Não encontrei a linha de cabeçalho. Inclua uma coluna como Nome, Nome completo, Participante ou Full name.");

  const headers = table[headerIndex].map((value, index) => value || `Coluna ${index + 1}`);
  const nameIndex = findHeader(headers, nameAliases);
  const emailIndex = findHeader(headers, ["e mail", "email", "e-mail", "email pessoal", "email corporativo"]);
  const companyIndex = findHeader(headers, ["empresa", "company", "organizacao", "organização", "empresa atual"]);
  const titleIndex = findHeader(headers, ["cargo", "funcao", "função", "job title", "title", "cargo atual"]);
  const phoneIndex = findHeader(headers, ["telefone", "celular", "phone", "whatsapp", "telefone celular"]);

  if (nameIndex < 0) throw new Error("A planilha precisa ter uma coluna de nome.");

  const output: ImportedHumanshipRow[] = [];
  const seen = new Set<string>();
  for (let index = headerIndex + 1; index < table.length; index += 1) {
    const row = table[index];
    const fullName = clean(row[nameIndex]);
    if (!fullName || looksLikeFooter(fullName)) continue;
    const email = clean(indexValue(row, emailIndex));
    const company = clean(indexValue(row, companyIndex));
    const jobTitle = clean(indexValue(row, titleIndex));
    const phone = clean(indexValue(row, phoneIndex));
    const sourceKey = stableSourceKey(email, fullName, company);
    if (seen.has(sourceKey)) continue;
    seen.add(sourceKey);

    const sourcePayload: Record<string, string> = {};
    headers.forEach((header, columnIndex) => {
      if (!header || ignoredHeaders.some((pattern) => pattern.test(header))) return;
      const value = clean(row[columnIndex]);
      if (value) sourcePayload[header] = value;
    });

    output.push({
      sourceKey,
      sourceRow: index + 1,
      fullName,
      email: email || undefined,
      company: company || undefined,
      jobTitle: jobTitle || undefined,
      phone: phone || undefined,
      sourcePayload,
    });
  }
  return output;
}

function findHeader(headers: string[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.findIndex((header) => {
    const normalized = normalizeHeader(header);
    return normalizedAliases.some((alias) => normalized === alias || normalized.includes(alias));
  });
}

function matchesHeader(value: string, aliases: string[]) {
  const normalized = normalizeHeader(value);
  return aliases.map(normalizeHeader).some((alias) => normalized === alias || normalized.includes(alias));
}

function stableSourceKey(email: string, name: string, company: string) {
  if (email) return `email:${normalize(email)}`;
  return `person:${normalize(name)}|${normalize(company)}`;
}

function indexValue(row: string[], index: number) {
  return index >= 0 ? row[index] : "";
}

function cellValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const record = value as { text?: string; result?: unknown; richText?: Array<{ text?: string }>; hyperlink?: string };
    if (typeof record.text === "string") return record.text.trim();
    if (record.result != null) return String(record.result).trim();
    if (Array.isArray(record.richText)) return record.richText.map((item) => item.text || "").join("").trim();
    if (typeof record.hyperlink === "string") return record.hyperlink.trim();
  }
  return String(value).trim();
}

function clean(value: unknown) {
  return cellValue(value).replace(/\s+/g, " ").trim();
}

function normalizeHeader(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}

function looksLikeFooter(value: string) {
  const normalized = normalize(value);
  return /^(total|totais|observacao|observacoes|obs|fim)$/.test(normalized);
}

function detectDelimiter(text: string) {
  const sample = text.split(/\r?\n/).filter(Boolean).slice(0, 8).join("\n");
  const candidates = [";", ",", "\t"];
  return candidates
    .map((delimiter) => ({ delimiter, score: countOutsideQuotes(sample, delimiter) }))
    .sort((a, b) => b.score - a.score)[0]?.delimiter || ",";
}

function countOutsideQuotes(text: string, delimiter: string) {
  let quoted = false;
  let count = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && char === delimiter) count += 1;
  }
  return count;
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
      continue;
    }
    if (!quoted && char === delimiter) {
      row.push(field);
      field = "";
      continue;
    }
    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += char;
  }
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}
