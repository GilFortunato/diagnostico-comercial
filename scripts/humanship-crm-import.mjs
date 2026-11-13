import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { XMLParser } from "fast-xml-parser";

const [filename, output] = process.argv.slice(2);
if (!filename || !output) throw new Error("Uso: node scripts/humanship-crm-import.mjs planilha.xlsx diretório-privado");
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(filename);
const pipeline = workbook.getWorksheet("Pipeline");
if (!pipeline || pipeline.getCell("C1").text !== "Nº de Cadastro" || pipeline.getCell("F1").text !== "Empresa / marca") {
  throw new Error("Cabeçalho do Pipeline Humanship não reconhecido.");
}

const normalize = (value) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase().replace(/\s+/g, " ");
const id = (scope, key) => scope + "_" + createHash("sha256").update(key).digest("hex").slice(0, 28);

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: false, isArray: (name) => ["sheet", "Relationship", "row", "c"].includes(name) });
const xml = (name) => parser.parse(execFileSync("unzip", ["-p", filename, name], { maxBuffer: 32 * 1024 * 1024 }).toString());
const paths = new Map(xml("xl/_rels/workbook.xml.rels").Relationships.Relationship.map((item) => [item["@_Id"], item["@_Target"]]));
const caches = new Map();
for (const sheet of xml("xl/workbook.xml").workbook.sheets.sheet) {
  const path = paths.get(sheet["@_r:id"]);
  if (!path) continue;
  const cells = new Map();
  const rows = xml(path.startsWith("/") ? path.slice(1) : "xl/" + path).worksheet.sheetData?.row ?? [];
  for (const row of rows) for (const cell of row.c ?? []) {
    if (cell["@_t"] === "str" && typeof cell.v === "string") cells.set(cell["@_r"], cell.v);
  }
  caches.set(sheet["@_name"], cells);
}

function value(cell, sheetName) {
  const entry = cell.value;
  const originalText = caches.get(sheetName)?.get(cell.address);
  if (originalText !== undefined) return originalText;
  if (entry instanceof Date) return Number.isFinite(+entry) ? entry.toISOString().slice(0, 10) : null;
  if (entry && typeof entry === "object") {
    if ("result" in entry) {
      return entry.result instanceof Date ? (Number.isFinite(+entry.result) ? entry.result.toISOString().slice(0, 10) : null)
        : entry.result?.error ?? entry.result ?? null;
    }
    if ("hyperlink" in entry) return entry.hyperlink;
    if ("richText" in entry) return entry.richText.map((part) => part.text).join("");
    if ("error" in entry) return entry.error;
    return null;
  }
  return entry ?? null;
}

function isoDay(entry) {
  if (typeof entry !== "string") return null;
  const parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(entry.trim());
  const date = parts ? parts[3] + "-" + parts[2] + "-" + parts[1] : entry.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(date);
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === date ? date : null;
}

const accounts = new Map();
const contacts = new Map();
const opportunities = [];
const links = [];
const activities = [];
const raw = [];
const opportunityByRow = new Map();
const seen = new Set();
const channelOf = (item) => ["LinkedIn", "WhatsApp", "E-mail", "Telefone", "Evento", "Google Meet", "Indicação", "Outro"].includes(item) ? item : null;

pipeline.eachRow((row, rowNumber) => {
  const read = (col) => value(row.getCell(col), pipeline.name);
  const string = (col) => { const val = read(col); return val === null ? null : String(val).trim() || null; };
  const num = (col) => { const val = read(col); return typeof val === "number" && Number.isFinite(val) ? val : null; };
  const date = (col) => isoDay(read(col));
  const name = string("F");
  if (rowNumber < 2 || !name) return;
  const legacyId = string("C");
  if (!legacyId || seen.has(legacyId)) throw new Error("Nº de cadastro ausente ou duplicado na linha " + rowNumber);
  seen.add(legacyId);
  const sourceKey = "humanship-pipeline-2026:" + legacyId;
  const opportunityId = id("crmopp", sourceKey);
  opportunityByRow.set(rowNumber, opportunityId);
  const identityKey = normalize(name);
  const accountId = id("crma", identityKey);
  const linkedin = string("I");
  const companyLinkedin = linkedin && /linkedin\.com\/(company|school)\//i.test(linkedin) ? linkedin : null;
  const contactLinkedin = linkedin && /linkedin\.com\/in\//i.test(linkedin) ? linkedin : null;
  const account = accounts.get(accountId) ?? { id: accountId, identityKey, name };
  account.segment ||= string("G");
  account.website ||= string("J");
  account.linkedinUrl ||= companyLinkedin;
  accounts.set(accountId, account);
  const contactName = string("R");
  if (contactName) {
    const key = normalize(contactName);
    const contactId = id("crmc", accountId + ":" + key);
    const contact = contacts.get(contactId) ?? { id: contactId, accountId, identityKey: key, name: contactName };
    contact.title ||= string("S");
    contact.email ||= string("T");
    contact.phone ||= string("U");
    contact.linkedinUrl ||= contactLinkedin;
    contacts.set(contactId, contact);
    links.push({ opportunityId, contactId });
  }
  const stage = string("AH") ?? "Mapeado";
  const result = string("AM") ?? "Em aberto";
  const owner = string("AO");
  const channel = string("V");
  const events = [...new Set(["Y","Z","AA","AB","AC","AD","AE","AF","AG"].map(string).filter(Boolean))];
  opportunities.push({
    id: opportunityId, sourceKey, legacyId, accountId, stage, result,
    contractClosed: string("D") === "Sim", contactStatus: string("E"), relationship: string("H"),
    temperature: ["Quente","Morno","Frio"].find((v) => string("P")?.includes(v)) ?? "Frio",
    origin: string("Q"), channel, project: string("W"), sponsorship: string("X"), events,
    priority: string("AN"), owner, nextAction: string("AQ"), nextActionDate: date("AR"),
    proposalDueDate: date("AI"), proposedValue: num("AU"), soldValue: num("AV"), saleDate: date("AW"),
    notes: string("AX"), paymentMethod: string("BA"), downPayment: num("BB"),
    installmentCount: Number(/^([0-9]{1,2})x$/i.exec(string("BD") ?? "")?.[1]) || null,
    followUp: string("AS"), historicalNotes: string("AT"),
  });
  function add(code, kind, day, extra = {}) {
    if (!day && !extra.note) return;
    const key = sourceKey + ":" + code;
    activities.push({ id: id("crmact", key), sourceKey: key, opportunityId, kind, date: day, actor: owner, ...extra });
  }
  const attempts = ["K","L","M","N","O"].map(date);
  attempts.forEach((day, index) => add("attempt-" + index, "Contato", day, { attempt: index + 1, channel: channelOf(channel) }));
  const last = date("AP");
  if (last && !attempts.includes(last)) add("last-contact", "Contato", last, { channel: channelOf(channel), note: "Último contato informado na planilha." });
  add("meeting-scheduled", "Reunião agendada", date("AJ"), { note: date("AJ") ? null : stage === "Reunião agendada" ? "Reunião agendada na base, sem data válida." : null });
  add("meeting-held", "Reunião realizada", date("AL"), { note: date("AL") ? null : string("AK") === "Sim" ? "Reunião realizada na base, sem data válida." : null });
  if (stage === "Proposta enviada") add("proposal-snapshot", "Proposta enviada", null, { note: "Proposta enviada na base. A data de envio não está confirmada." });
});

for (const sheet of workbook.worksheets) {
  sheet.eachRow((row, rowNumber) => {
    const data = {};
    row.eachCell((cell) => {
      const val = value(cell, sheet.name);
      if (val !== null && val !== "") data[cell.address.replace(/\d+$/, "")] = val;
    });
    if (Object.keys(data).length) raw.push({ sheet: sheet.name, rowNumber, opportunityId: sheet.name === "Pipeline" ? opportunityByRow.get(rowNumber) ?? null : null, data });
  });
}

const tables = [
  ["CrmAccount", [...accounts.values()], "id identityKey name segment website linkedinUrl", "identityKey"],
  ["CrmContact", [...contacts.values()], "id accountId identityKey name title email phone linkedinUrl", "accountId identityKey"],
  ["CrmOpportunity", opportunities, "id sourceKey legacyId accountId stage result contractClosed contactStatus relationship temperature origin channel project sponsorship events priority owner nextAction nextActionDate proposalDueDate proposedValue soldValue saleDate notes paymentMethod downPayment installmentCount followUp historicalNotes", "sourceKey"],
  ["CrmOpportunityContact", links, "opportunityId contactId", "opportunityId contactId"],
  ["CrmActivity", activities, "id sourceKey opportunityId kind date actor attempt channel note", "sourceKey"],
  ["CrmImportRow", raw, "sheet rowNumber opportunityId data", "sheet rowNumber"],
];

await mkdir(output, { recursive: true, mode: 0o700 });
const statements = [];
const quote = (name) => '"' + name + '"';
for (const [table, rows, fields, conflict] of tables) {
  const columns = fields.split(" ").map(quote).join(", ");
  const updatedAt = ["CrmAccount", "CrmContact", "CrmOpportunity"].includes(table);
  const conflictCols = conflict.split(" ").map(quote).join(", ");
  for (let offset = 0; offset < rows.length; offset += 30) {
    const data = JSON.stringify(rows.slice(offset, offset + 30)).replaceAll("'", "''");
    statements.push("INSERT INTO " + quote(table) + " (" + columns + (updatedAt ? ', "updatedAt"' : "") + ") SELECT " + columns + (updatedAt ? ", CURRENT_TIMESTAMP" : "") + " FROM jsonb_populate_recordset(NULL::" + quote(table) + ", '" + data + "'::jsonb) ON CONFLICT (" + conflictCols + ") DO NOTHING");
  }
}
const manifest = { counts: Object.fromEntries(tables.map(([table, rows]) => [table, rows.length])), statements: statements.length };
await writeFile(join(output, "statements.json"), JSON.stringify(statements), { mode: 0o600 });
await writeFile(join(output, "manifest.json"), JSON.stringify(manifest), { mode: 0o600 });
console.log(JSON.stringify(manifest));
