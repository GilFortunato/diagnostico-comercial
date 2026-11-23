import ExcelJS from "exceljs";
import { classifyLead, normalized, stamp } from "./commercialPolicy";

const names = {
  company: ["empresa", "empresas", "conta", "organização"], person: ["nome", "pessoa", "nome do líder", "nome do líder de RH", "nome do contato"],
  status: ["status", "status do evento"], responsible: ["responsável", "resposalvel", "executivo", "titular atual"],
  organizer: ["organizador", "organizador do jantar"], origin: ["origem", "origem do lead"],
  presence: ["compareceu", "presença", "compareceu ao jantar"], inPipe: ["pipe", "no pipedrive", "já consta no pipedrive"],
  newLead: ["lead novo", "novo lead", "novo lead do jantar"], opening: ["data de abertura", "data de criação"],
  lastSale: ["última venda", "data da última venda"], hasSale: ["houve venda", "venda concluída"],
  lastActivity: ["última atividade incluindo convite", "última atividade no pipedrive", "última atividade"],
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

const reportHeaders = ["Aba de origem", "Linha", "Empresa", "Pessoa", "Status na origem", "Responsável na origem", "Comercial do jantar", "Decisão comercial", "Titular prioritário", "Fundamento", "Próxima ação", "SLA da origem", "Situação do SLA"];
const reportName = "Prioridades comerciais";
const guideName = "Critérios comerciais";

function style(sheet: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((width,i) => { sheet.getColumn(i+1).width = width; });
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const top = sheet.getRow(1);
  top.height = 27;
  top.eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: {argb:"FF084A39"} };
    cell.font = {bold:true,color:{argb:"FFFFFFFF"}};
  });
  sheet.autoFilter = {from:{row:1,column:1},to:{row:sheet.rowCount,column:widths.length}};
}

export function saoPauloTime(date: Date) {
  const parts = new Intl.DateTimeFormat("sv-SE", {timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).format(date);
  return stamp(parts)!;
}

export async function prioritizeWorkbook(input: ArrayBuffer, at = new Date()) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(input);
  const now = saoPauloTime(at);
  const directory = book.worksheets.find(s => normalized(s.name) === "geral");
  const byCity = organizers(directory);
  const entries: { order: number; values: (string|number)[] }[] = [];
  const skipped: string[] = [];
  let cities = 0;
  for (const sheet of book.worksheets) {
    if (sheet === directory) continue;
    // Only remove generated tabs when their signatures also match.
    if ((sheet.name === reportName && text(sheet.getCell("A1")) === reportHeaders[0]) ||
        (sheet.name === guideName && text(sheet.getCell("A1")) === "Regra ou campo")) {
      book.removeWorksheet(sheet.id);
      continue;
    }
    if (sheet.name === reportName || sheet.name === guideName) throw new Error("Renomeie a aba " + sheet.name + " antes de importar. Esse nome é usado na saída.");
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
      if (next) { mapping = next; return; }
      // Curitiba has a header within the list, after existing contact records.
      if (i < firstHeader && !(cityKey(sheet.name) === "curitiba" && firstHeader > 1)) return;
      const cols = mapping ?? initial;
      const get = (key: Field) => (cols.get(key) ?? []).map(index => text(row.getCell(index))).find(Boolean) ?? "";
      const company = get("company"), person = get("person");
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
      entries.push({order: decision.order, values:[sheet.name, i, company, person, lead.status, lead.responsible, owner, decision.decision, decision.owner, decision.reason, decision.action, decision.sla, decision.slaState]});
      count++;
    });
    if (count) cities++;
  }
  if (!entries.length) throw new Error("Nenhum registro encontrado. Inclua colunas de empresa e nome da pessoa nas abas de dados.");
  const report = book.addWorksheet(reportName);
  report.addRow(reportHeaders);
  for (const entry of entries.sort((a,b) => a.order-b.order)) report.addRow(entry.values);
  style(report,[21,9,32,32,22,24,24,34,25,78,84,20,35]);
  const guide = book.addWorksheet(guideName);
  guide.addRows([
    ["Regra ou campo", "Aplicação"],
    ["Referência da análise", new Date(now).toISOString().slice(0,19).replace("T"," ") + " (São Paulo)"],
    ["Indicação direta", "Primeiro atendimento em até 24 horas úteis. Grande evento tem prazo de 5 dias úteis. Somente atividade concluída no Pipedrive comprova a abordagem."],
    ["SLA vencido", "Sem abordagem concluída, retornar à fila geral ou redistribuir. Preencha o vencimento calculado pelo calendário comercial do Pipedrive."],
    ["Lead sem venda", "Redistribuir após 90 dias de abertura sem nenhuma interação nem atividade agendada."],
    ["Cliente de carteira", "Liberar para reativação após mais de um ano desde a última venda sem novas interações nem tarefas."],
    ["Novo lead do jantar", "O organizador tem prioridade. A aba Geral relaciona cidade e comercial. Organizador do jantar na linha tem precedência."],
    ["Contato existente no jantar", "Transferir ao organizador somente com presença comprovada e mais de seis meses sem atividade. A última atividade deve incluir eventual registro do convite."],
    ["Status e histórico", "Convite e confirmação não comprovam presença. Campo Pipe vazio requer conferência. As decisões são recomendações para execução no CRM."],
    ["Como completar os dados", "Acrescente os campos abaixo à aba da cidade e importe novamente. Use Sim ou Não para indicadores. Para datas, use células de data do Excel ou dd/mm/aaaa, com hora quando disponível."],
    ...(["origin","inPipe","newLead","organizer","presence","opening","hasSale","lastSale","interaction","lastActivity","scheduled","deadline","completed","firstCompleted"] as const).map(key => [names[key][0], {
      origin:"Indicação direta, Grande evento ou Humanship Dinner.", inPipe:"O contato já consta no Pipedrive?", newLead:"É um novo lead desta origem?", organizer:"Nome do organizador, se diferente do mapa por cidade.", presence:"Comparecimento efetivo ao jantar.", opening:"Data de abertura do lead no CRM.", hasSale:"Existe venda concluída?", lastSale:"Data da última venda concluída.", interaction:"Alguma interação consta no histórico?", lastActivity:"Data da atividade mais recente, incluindo convite registrado.", scheduled:"Existe atividade futura agendada?", deadline:"Data e hora limite do primeiro atendimento no calendário da empresa.", completed:"Existe atividade de abordagem marcada como concluída no CRM?", firstCompleted:"Data e hora da primeira atividade de abordagem concluída no Pipedrive.",
    }[key]]),
    ...(skipped.length ? [["Abas sem cabeçalho reconhecido", skipped.join(", ")]] : []),
  ]);
  style(guide,[40,105]);
  guide.getColumn(2).alignment = {wrapText:true,vertical:"middle"};
  guide.eachRow(row => { if (row.number>1) row.height=32; });
  book.views = [{x:0,y:0,width:16000,height:9000,firstSheet:0,activeTab:book.worksheets.indexOf(report),visibility:"visible"}];
  return {bytes: new Uint8Array(await book.xlsx.writeBuffer()), count:entries.length, cities, skipped};
}
