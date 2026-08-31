import "server-only";
import ExcelJS from "exceljs";
import type { HrHuntingSearchSnapshot } from "@/lib/hr-hunting/types";

const colors = { green: "003F2E", greenLight: "EAF6EC", lime: "9CFF00", white: "FFFFFF", ink: "08251D", line: "D7E4D8" };

export async function buildHrHuntingWorkbook(search: HrHuntingSearchSnapshot, scope: "all" | "selected" | "shortlist") {
  const candidates = scope === "all" ? search.candidates : search.candidates.filter((candidate) => candidate.shortlisted);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Share AI";
  workbook.company = "Share People Hub";
  workbook.created = new Date(search.updatedAt);
  workbook.subject = "Snapshot de HR Hunting";
  workbook.title = `HR Hunting - ${search.title}`;

  const ranking = workbook.addWorksheet("Ranking", { views: [{ state: "frozen", ySplit: 1 }] });
  ranking.columns = [
    { header: "Ranking", key: "ranking", width: 10 }, { header: "Nome", key: "name", width: 28 }, { header: "Cargo atual", key: "title", width: 30 }, { header: "Empresa atual", key: "company", width: 28 }, { header: "Localização", key: "location", width: 22 }, { header: "Aderência", key: "score", width: 12 }, { header: "Classificação", key: "classification", width: 24 }, { header: "LinkedIn", key: "linkedin", width: 30 }, { header: "E-mail profissional", key: "email", width: 30 }, { header: "Telefone profissional", key: "phone", width: 22 }, { header: "Status", key: "status", width: 16 }, { header: "Principais sinais", key: "signals", width: 44 }, { header: "Pontos a validar", key: "validate", width: 44 }, { header: "Fonte", key: "source", width: 30 }, { header: "Confiança", key: "confidence", width: 18 },
  ];
  candidates.forEach((candidate, index) => {
    const row = ranking.addRow({ ranking: index + 1, name: candidate.name, title: candidate.currentTitle || "Não informado pela fonte", company: candidate.currentCompany || "Não informada pela fonte", location: candidate.location || "Não informada pela fonte", score: `${candidate.fitScore}%`, classification: candidate.fitClassification, linkedin: candidate.profileUrl ? { text: "Abrir perfil", hyperlink: candidate.profileUrl } : "LinkedIn não encontrado", email: candidate.contacts.find((contact) => contact.type === "e-mail profissional")?.value || "Não informado pela fonte", phone: candidate.contacts.find((contact) => contact.type === "telefone profissional")?.value || "Não informado pela fonte", status: candidate.shortlisted ? "Shortlist" : "Em análise", signals: candidate.evidence.filter((item) => item.result === "atende").map((item) => item.criterion).join(" | ") || "Nenhuma evidência confirmada", validate: candidate.pointsToValidate.join(" | ") || "Sem pontos adicionais", source: candidate.sourceName, confidence: candidate.confidence });
    styleHyperlink(row.getCell("linkedin"));
  });

  const assessment = workbook.addWorksheet("Avaliação", { views: [{ state: "frozen", ySplit: 1 }] });
  assessment.columns = [{ header: "Candidato", key: "candidate", width: 28 }, { header: "Critério", key: "criterion", width: 34 }, { header: "Tipo do critério", key: "type", width: 18 }, { header: "Resultado", key: "result", width: 18 }, { header: "Evidência", key: "evidence", width: 54 }, { header: "Fonte", key: "source", width: 30 }, { header: "Confiança", key: "confidence", width: 18 }];
  candidates.flatMap((candidate) => candidate.evidence.map((evidence) => ({ candidate, evidence }))).forEach(({ candidate, evidence }) => assessment.addRow({ candidate: candidate.name, criterion: evidence.criterion, type: evidence.criterionType, result: evidence.result, evidence: evidence.evidence || "Não verificado na fonte consultada.", source: evidence.source, confidence: evidence.confidence }));

  const shortlist = workbook.addWorksheet("Shortlist", { views: [{ state: "frozen", ySplit: 1 }] });
  shortlist.columns = [{ header: "Nome", key: "name", width: 28 }, { header: "Cargo", key: "title", width: 30 }, { header: "Empresa", key: "company", width: 28 }, { header: "Aderência", key: "score", width: 12 }, { header: "Pontos fortes", key: "strengths", width: 46 }, { header: "Pontos a validar", key: "validate", width: 46 }, { header: "LinkedIn", key: "linkedin", width: 30 }, { header: "E-mail", key: "email", width: 30 }, { header: "Telefone", key: "phone", width: 22 }, { header: "Próxima etapa", key: "nextStep", width: 30 }, { header: "Observações", key: "notes", width: 42 }];
  search.candidates.filter((candidate) => candidate.shortlisted).forEach((candidate) => { const row = shortlist.addRow({ name: candidate.name, title: candidate.currentTitle || "Não informado pela fonte", company: candidate.currentCompany || "Não informada pela fonte", score: `${candidate.fitScore}%`, strengths: candidate.evidence.filter((item) => item.result === "atende").map((item) => item.criterion).join(" | ") || "Nenhuma evidência confirmada", validate: candidate.pointsToValidate.join(" | ") || "Sem pontos adicionais", linkedin: candidate.profileUrl ? { text: "Abrir perfil", hyperlink: candidate.profileUrl } : "LinkedIn não encontrado", email: candidate.contacts.find((contact) => contact.type === "e-mail profissional")?.value || "Não informado pela fonte", phone: candidate.contacts.find((contact) => contact.type === "telefone profissional")?.value || "Não informado pela fonte", nextStep: candidate.shortlist?.nextStep || "A definir", notes: candidate.shortlist?.notes || "" }); styleHyperlink(row.getCell("linkedin")); });

  for (const worksheet of workbook.worksheets) styleSheet(worksheet);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function styleSheet(sheet: ExcelJS.Worksheet) {
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
  sheet.getRow(1).height = 28;
  sheet.getRow(1).eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.green } }; cell.font = { bold: true, color: { argb: colors.white }, size: 10 }; cell.alignment = { vertical: "middle", wrapText: true }; cell.border = { bottom: { style: "medium", color: { argb: colors.lime } } }; });
  sheet.eachRow((row, rowNumber) => { if (rowNumber === 1) return; row.height = 34; row.eachCell((cell) => { cell.alignment = { vertical: "top", wrapText: true }; cell.font = { ...cell.font, color: cell.font?.color ?? { argb: colors.ink }, size: 9 }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowNumber % 2 === 0 ? colors.greenLight : colors.white } }; cell.border = { bottom: { style: "thin", color: { argb: colors.line } } }; }); });
}
function styleHyperlink(cell: ExcelJS.Cell) { if (typeof cell.value === "object") cell.font = { color: { argb: "006D46" }, underline: true, bold: true }; }
