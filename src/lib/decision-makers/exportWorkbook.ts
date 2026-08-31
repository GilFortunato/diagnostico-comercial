import "server-only";
import ExcelJS from "exceljs";
import type { DecisionMakerResult } from "@/lib/decision-makers/search";

const colors = {
  green: "003F2E",
  greenLight: "EAF6EC",
  lime: "9CFF00",
  mint: "BFFFD2",
  white: "FFFFFF",
  ink: "08251D",
  line: "D7E4D8",
};

export async function buildDecisionMakerWorkbook(result: DecisionMakerResult) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Share AI";
  workbook.company = "Share People Hub";
  workbook.created = new Date(result.generatedAt);
  workbook.modified = new Date(result.generatedAt);
  workbook.subject = "Snapshot de Hunting Intelligence";
  workbook.title = `Mapa de decisores - ${result.businessUnitName}`;

  const companies = workbook.addWorksheet("Empresas", { views: [{ state: "frozen", ySplit: 1 }] });
  companies.columns = [
    { header: "Empresa", key: "name", width: 30 },
    { header: "Aderência", key: "fit", width: 14 },
    { header: "Setor", key: "industry", width: 26 },
    { header: "Localização", key: "location", width: 24 },
    { header: "Funcionários", key: "employeeRange", width: 16 },
    { header: "Receita", key: "revenueRange", width: 16 },
    { header: "Domínio", key: "domain", width: 24 },
    { header: "Site", key: "website", width: 30 },
    { header: "LinkedIn", key: "linkedin", width: 34 },
    { header: "Por que entrou no mapa", key: "reasons", width: 58 },
    { header: "Confiança", key: "confidence", width: 16 },
    { header: "Fonte", key: "source", width: 34 },
    { header: "Data da pesquisa", key: "researchDate", width: 18 },
  ];
  for (const company of result.companies) {
    const row = companies.addRow({
      name: company.name,
      fit: company.fit,
      industry: company.industry ?? "Não informado",
      location: company.location ?? "Não informada",
      employeeRange: company.employeeRange ?? "Não informada",
      revenueRange: company.revenueRange ?? "Não informada",
      domain: company.domain ?? company.website ?? "Não informado",
      website: company.website ? { text: "Abrir site", hyperlink: company.website } : "Não informado",
      linkedin: company.linkedinUrl ? { text: "Abrir página", hyperlink: company.linkedinUrl } : "Não informado",
      reasons: company.fitReasons.join(" "),
      confidence: company.confidence,
      source: company.source,
      researchDate: result.generatedAt.slice(0, 10),
    });
    styleHyperlink(row.getCell("website"));
    styleHyperlink(row.getCell("linkedin"));
  }

  const people = workbook.addWorksheet("Pessoas", { views: [{ state: "frozen", ySplit: 1 }] });
  people.columns = [
    { header: "Pessoa", key: "name", width: 28 },
    { header: "Cargo", key: "title", width: 32 },
    { header: "Senioridade", key: "seniority", width: 20 },
    { header: "Área", key: "department", width: 22 },
    { header: "Empresa", key: "company", width: 28 },
    { header: "Papel provável", key: "decisionRole", width: 22 },
    { header: "Aderência", key: "fit", width: 14 },
    { header: "Evidências da aderência", key: "reasons", width: 60 },
    { header: "Confiança", key: "confidence", width: 16 },
    { header: "Acessibilidade", key: "accessibility", width: 17 },
    { header: "Localização", key: "location", width: 23 },
    { header: "LinkedIn", key: "linkedin", width: 34 },
    { header: "E-mail profissional", key: "email", width: 30 },
    { header: "Status do e-mail", key: "emailStatus", width: 18 },
    { header: "Telefone profissional", key: "phone", width: 22 },
    { header: "Status do telefone", key: "phoneStatus", width: 20 },
    { header: "Fonte do contato", key: "contactSource", width: 30 },
    { header: "Sinais recentes", key: "signals", width: 60 },
    { header: "Rapport seguro", key: "rapport", width: 60 },
    { header: "Próxima melhor ação", key: "nextBestAction", width: 54 },
  ];
  for (const person of result.people) {
    const row = people.addRow({
      name: person.name,
      title: person.title,
      seniority: person.seniority ?? "Não informada",
      department: person.department ?? "Não informada",
      company: person.company,
      decisionRole: person.probableDecisionRole,
      fit: person.fit,
      reasons: person.fitReasons.join(" "),
      confidence: person.confidence,
      accessibility: person.accessibility,
      location: person.location ?? "Não informada",
      linkedin: { text: "Abrir perfil", hyperlink: person.linkedinUrl },
      email: person.professionalEmail ?? "Não informado pela fonte",
      emailStatus: person.emailStatus,
      phone: person.professionalPhone ?? "Não informado pela fonte",
      phoneStatus: person.phoneStatus,
      contactSource: person.contactSource ?? "Não se aplica",
      signals: person.recentSignals.join(" | ") || "Sem sinal recente confirmado",
      rapport: `${person.rapport.context} ${person.rapport.safeOpening}`,
      nextBestAction: person.nextBestAction,
    });
    styleHyperlink(row.getCell("linkedin"));
  }

  const intelligence = workbook.addWorksheet("Inteligência Share AI", { views: [{ state: "frozen", ySplit: 1 }] });
  intelligence.columns = [
    { header: "Empresa", key: "company", width: 28 },
    { header: "Pessoa", key: "person", width: 28 },
    { header: "Território", key: "territory", width: 26 },
    { header: "Persona / papel", key: "role", width: 24 },
    { header: "Por que priorizar", key: "why", width: 55 },
    { header: "Evidências", key: "evidence", width: 58 },
    { header: "Sinais públicos", key: "signals", width: 58 },
    { header: "Recomendação", key: "recommendation", width: 52 },
    { header: "Risco", key: "risk", width: 48 },
    { header: "Próximo movimento", key: "nextMove", width: 52 },
  ];
  if (result.people.length) {
    intelligence.addRows(result.people.map((person) => ({
      company: person.company,
      person: person.name,
      territory: result.businessUnitName,
      role: person.probableDecisionRole,
      why: person.fitReasons.join(" "),
      evidence: person.profileSummary ?? "Evidências básicas de cargo, empresa e perfil público.",
      signals: person.recentSignals.join(" | ") || "Sem sinal público recente confirmado.",
      recommendation: person.rapport.safeOpening,
      risk: person.rapport.avoid.join(" "),
      nextMove: person.nextBestAction,
    })));
  } else {
    intelligence.addRows(result.companies.map((company) => ({
      company: company.name,
      person: "Ainda não pesquisada",
      territory: result.businessUnitName,
      role: "Conta-alvo",
      why: company.fitReasons.join(" "),
      evidence: company.signals.join(", ") || "Evidência corporativa básica.",
      signals: company.description ?? "Sem descrição pública confirmada.",
      recommendation: result.nextBestAction.reason,
      risk: "Aderência ainda não confirma intenção de compra.",
      nextMove: result.nextBestAction.title,
    })));
  }

  for (const sheet of workbook.worksheets) styleSheet(sheet);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function styleSheet(sheet: ExcelJS.Worksheet) {
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
  sheet.getRow(1).height = 28;
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.green } };
    cell.font = { bold: true, color: { argb: colors.white }, size: 10 };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: colors.lime } } };
  });
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.height = 34;
    row.eachCell((cell) => {
      cell.alignment = { vertical: "top", wrapText: true };
      cell.font = { ...cell.font, color: cell.font?.color ?? { argb: colors.ink }, size: 9 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowNumber % 2 === 0 ? colors.greenLight : colors.white } };
      cell.border = { bottom: { style: "thin", color: { argb: colors.line } } };
    });
  });
}

function styleHyperlink(cell: ExcelJS.Cell) {
  if (typeof cell.value !== "object") return;
  cell.font = { color: { argb: "006D46" }, underline: true, bold: true };
}
