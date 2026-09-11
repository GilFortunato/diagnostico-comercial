import "server-only";
import ExcelJS from "exceljs";
import type { ImportedHumanshipRow } from "@/lib/humanship/types";

const ignoredHeaders = [/^cpf$/i, /autorizo o tratamento/i, /consent/i];

export async function parseHumanshipExcel(buffer: ArrayBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(new Uint8Array(buffer)) as never);
  const worksheet = workbook.worksheets.find((sheet) => sheet.actualRowCount > 0) || workbook.worksheets[0];
  if (!worksheet) return [];
  const rows: unknown[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = Array.isArray(row.values) ? row.values : [];
    rows.push(values.slice(1).map(cellValue));
  });
  return normalizeHumanshipRows(rows);
}

export function normalizeHumanshipRows(rows: unknown[][]): ImportedHumanshipRow[] {
  const table = rows.map((row) => row.map((value) => cellValue(value)));
  const headerIndex = table.findIndex((row) => row.some((value) => normalizeHeader(value).includes("nome")));
  if (headerIndex < 0) throw new Error("Não encontrei a linha de cabeçalho com o nome das pessoas.");

  const headers = table[headerIndex].map((value, index) => value || `Coluna ${index + 1}`);
  const nameIndex = findHeader(headers, ["nome completo", "nome", "full name", "participante"]);
  const emailIndex = findHeader(headers, ["e mail", "email", "e-mail"]);
  const companyIndex = findHeader(headers, ["empresa", "company", "organizacao", "organização"]);
  const titleIndex = findHeader(headers, ["cargo", "funcao", "função", "job title", "title"]);
  const phoneIndex = findHeader(headers, ["telefone", "celular", "phone", "whatsapp"]);

  if (nameIndex < 0) throw new Error("A planilha precisa ter uma coluna de nome.");

  const output: ImportedHumanshipRow[] = [];
  const seen = new Set<string>();
  for (let index = headerIndex + 1; index < table.length; index += 1) {
    const row = table[index];
    const fullName = clean(row[nameIndex]);
    if (!fullName) continue;
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
    const record = value as { text?: string; result?: unknown; richText?: Array<{ text?: string }> };
    if (typeof record.text === "string") return record.text.trim();
    if (record.result != null) return String(record.result).trim();
    if (Array.isArray(record.richText)) return record.richText.map((item) => item.text || "").join("").trim();
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
