import ExcelJS from "exceljs";
import { classifyLead, normalized, stamp } from "./commercialPolicy";

const names = {
  company: ["empresa", "empresas", "conta", "organização"], person: ["nome", "pessoa", "nome do líder", "nome do líder de RH", "nome do contato"],
  role: ["cargo", "função", "job title"], phone: ["telefone", "celular", "whatsapp", "fone"],
  contact: ["contato"], email: ["email", "e-mail", "email profissional", "e-mail profissional"],
  notes: ["obs", "observação", "observações", "observações estratégicas (RH e Estrutura)", "relevância / atividade"],
  status: ["status", "status do evento"], responsible: ["responsável", "resposalvel", "executivo", "titular atual"],
  organizer: ["organizador", "organizador do jantar"], origin: ["origem", "origem do lead"],
  presence: ["compareceu", "presença", "compareceu ao jantar"], inPipe: ["pipe", "no pipedrive", "já consta no pipedrive"],
  newLead: ["lead novo", "novo lead", "novo lead do jantar"], opening: ["data de abertura", "data de criação"],
  lastSale: ["última venda", "data da última venda"], hasSale: ["houve venda", "venda concluída"],
  lastActivity: ["última atividade incluindo convite", "última atividade no pipedrive", "última atividade"],
  recordedInvitation: ["data do convite registrado no pipedrive", "data da atividade de convite no pipedrive"],
  interaction: ["houve interação", "houve interação no pipedrive"], scheduled: ["atividade agendada", "há atividade agendada"],
  deadline: ["vencimento do sla", "prazo do primeiro atendimento"], firstCompleted: ["data do primeiro atendimento concluído", "primeira atividade concluída"],
  completed: ["primeiro atendimento concluído", "atividade de abordagem concluída"],
} as const;
type Field = keyof typeof names;
const fieldByHeader = new Map(Object.entries(names).flatMap(([key, aliases]) => aliases.map(alias => [normalized(alias), key as Field] as const)));
const cityAliases: Record<string, string> = { "r p": "rp", floripa: "florianopolis", curit: "curitiba", indaiat: "indaiatuba", poa: "porto alegre" };
const cityKey = (s: string) => cityAliases[normalized(s)] ?? normalized(s);

function text(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (value instanceof Date) return value.toISOString().slice(0,19).replace("T"," ").replace(/ 00:00:00$/, "");
  if (value && typeof value === "object" && "error" in value) return "";
  return String(cell.text ?? "").trim();
}

function header(row: ExcelJS.Row) {
  const map = new Map<Field, number[]>();
  row.eachCell((cell, index) => {
    const key = fieldByHeader.get(normalized(text(cell)));
    if (key) map.set(key, [...(map.get(key) ?? []), index]);
  });
  // The Weekend example uses a salesperson's name as its sixth header.
  const firstFive = ["empresa", "nome", "cargo", "contato", "obs"];
  if (firstFive.every((label, i) => normalized(text(row.getCell(i + 1))) === label) &&
      normalized(text(row.getCell(6))) === "tal") map.set("responsible", [6]);
  return map.has("company") && map.has("person") ? map : undefined;
}

function organizers(sheet?: ExcelJS.Worksheet) {
  const map = new Map<string,string>();
  let city = 0, owner = 0;
  sheet?.eachRow(row => {
    if (!city || !owner) {
      row.eachCell((cell,index) => {
        if (normalized(text(cell)) === "cidade") city = index;
        if (["comercial","organizador"].includes(normalized(text(cell)))) owner = index;
      });
    } else if (text(row.getCell(city)) && text(row.getCell(owner))) map.set(cityKey(text(row.getCell(city))), text(row.getCell(owner)));
  });
  return map;
}

const weekendHeaders = ["Empresa", "Nome", "Cargo", "Contato", "Obs", "Responsável"];
const exportSubject = "B2B Hunting · Lista comercial Weekend";

function contactValue(phone: string, contact: string, email: string) {
  // Some city sheets use "Contato" for the commercial representative.
  const phoneValue = [phone, contact].find(value => /\d[\s().+/-]*\d/.test(value) && value.replace(/\D/g, "").length >= 8);
  return phoneValue || [email, contact].find(value => /[^\s@]+@[^\s@]+\.[^\s@]+/.test(value)) || "";
}

export function saoPauloTime(date: Date) {
  const parts = new Intl.DateTimeFormat("sv-SE", {timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).format(date);
  return stamp(parts)!;
}

export async function prioritizeWorkbook(input: ArrayBuffer, at = new Date()) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(input);
  if (book.subject === exportSubject && book.worksheets.length === 1) {
    throw new Error("Esta é a lista de saída. Para recalcular as prioridades, importe a base de leads com os dados do Pipedrive.");
  }
  const now = saoPauloTime(at);
  const directory = book.worksheets.find(s => normalized(s.name) === "geral");
  const byCity = organizers(directory);
  const entries: { order: number; owner: string; values: string[] }[] = [];
  const skipped: string[] = [];
  let cities = 0;
  for (const sheet of book.worksheets) {
    if (sheet === directory) continue;
    // Previous exports include their source tabs, plus two generated summaries.
    if ((sheet.name === "Prioridades comerciais" && text(sheet.getCell("A1")) === "Aba de origem") ||
        (sheet.name === "Critérios comerciais" && text(sheet.getCell("A1")) === "Regra ou campo")) continue;
    let mapping: ReturnType<typeof header>;
    let firstHeader = 0;
    sheet.eachRow((row, i) => {
      if (!firstHeader) {
        const found = header(row);
        if (found) { firstHeader = i; mapping = found; }
      }
    });
    if (!mapping) { skipped.push(sheet.name); continue; }
    const initial = mapping;
    const mealOwner = byCity.get(cityKey(sheet.name)) ?? "";
    let count = 0;
    sheet.eachRow((row, i) => {
      const next = header(row);
      if (next) { mapping = i === firstHeader ? initial : next; return; }
      // Curitiba has a header within the list, after existing contact records.
      if (i < firstHeader && !(cityKey(sheet.name) === "curitiba" && firstHeader > 1)) return;
      const cols = mapping ?? initial;
      const get = (key: Field) => (cols.get(key) ?? []).map(index => text(row.getCell(index))).find(Boolean) ?? "";
      // In Recife's company block, "Responsável" is the company's contact.
      // In its invitee block, "Contato" identifies the salesperson.
      const recife = cityKey(sheet.name) === "recife";
      const companyBlock = recife && cols.has("responsible") && !cols.has("contact") &&
        normalized(text(sheet.getRow(firstHeader).getCell(cols.get("person")![0]))) === "pessoa" && cols === initial;
      const inviteeBlock = recife && cols.has("contact") && cols.has("phone") && !cols.has("responsible");
      const company = get("company");
      const person = get("person") || (companyBlock && get("role") ? get("responsible") : "");
      if (!company && !person) return;
      // A pasted invitation or a free-standing note below a city list is not a lead.
      if (!person && /^(ol[áa][ ,!]|bom dia\b|boa tarde\b)/i.test(company) && company.includes("\n")) return;
      if (!company && row.actualCellCount === 1 && i > firstHeader + 1 && !sheet.getRow(i - 1).hasValues) return;
      const owner = get("organizer") || mealOwner;
      const lead = Object.fromEntries((Object.keys(names) as Field[]).map(key => [key,get(key)])) as Record<Field,string>;
      const decision = classifyLead({...lead, organizer:owner, dinner:!!mealOwner || !!get("organizer")}, now);
      if (!person && decision.decision === "Validar cadastro") {
        decision.decision = "Identificar contato";
        decision.reason = "A linha identifica uma empresa sem informar o nome do contato.";
        decision.action = "Identificar o contato e conferir seu cadastro no Pipedrive.";
      }
      const contact = contactValue(get("phone"), inviteeBlock ? "" : get("contact"), get("email"));
      const currentOwner = companyBlock ? "" : inviteeBlock ? get("contact") : lead.responsible;
      const assigned = decision.owner || (decision.order <= 1 ? "" : currentOwner);
      const observations = [
        decision.decision + ". " + decision.reason + " " + decision.action,
        decision.decision === "Validar indicação e SLA" && !person && "Identificar a pessoa indicada.",
        normalized(lead.status) === "nao convidar" && "Orientação registrada para este jantar: não convidar.",
        decision.sla && ("SLA de " + decision.sla + ". " + decision.slaState + "."),
        lead.notes,
        [sheet.name, lead.status, !assigned && owner ? "Comercial do jantar: " + owner : ""].filter(Boolean).join(" · "),
      ].filter(Boolean).join("\n");
      entries.push({ order: decision.order, owner: assigned, values: [company, person, lead.role, contact, observations, assigned] });
      count++;
    });
    if (count) cities++;
  }
  if (!entries.length) throw new Error("Nenhum registro encontrado. Inclua colunas de empresa e nome da pessoa nas abas de dados.");
  const output = new ExcelJS.Workbook();
  output.subject = exportSubject;
  const report = output.addWorksheet("Weekend", {views: [{state: "frozen", ySplit: 1}]});
  report.addRow(weekendHeaders);
  const collator = new Intl.Collator("pt-BR", {sensitivity: "base"});
  entries.sort((a, b) => a.order - b.order || Number(!a.owner) - Number(!b.owner) || collator.compare(a.owner, b.owner));
  for (const entry of entries) report.addRow(entry.values);
  [32, 32, 42, 32, 78, 22].forEach((width, i) => { report.getColumn(i + 1).width = width; });
  report.getColumn(4).numFmt = "@";
  report.getColumn(5).alignment = {wrapText: true, vertical: "top"};
  report.getRow(1).font = {bold: true};
  report.autoFilter = {from: "A1", to: "F" + report.rowCount};
  return {bytes: new Uint8Array(await output.xlsx.writeBuffer()), count: entries.length, cities, skipped};
}
