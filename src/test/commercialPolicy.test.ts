import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {classifyLead, stamp, type CommercialLead} from "../lib/decision-makers/commercialPolicy";
import {prioritizeWorkbook} from "../lib/decision-makers/commercialWorkbook";

const base: CommercialLead = {origin:"", dinner:true, organizer:"Paula", status:"Confirmado", presence:"", inPipe:"", newLead:"", opening:"", lastSale:"", hasSale:"", lastActivity:"", interaction:"", scheduled:"", deadline:"", firstCompleted:"", completed:""};
const reference = stamp("23/11/2026 12:00")!;
const decide = (fields:Partial<CommercialLead>, now=reference) => classifyLead({...base,...fields},now);
test("jantar exige cadastro, comparecimento e histórico, incluindo convite", () => {
  assert.equal(decide({}).owner,"");
  assert.equal(decide({newLead:"Sim"}).owner,"Paula");
  const existing = {inPipe:"Sim",lastActivity:"23/05/2026 12:00"};
  assert.equal(decide(existing,reference+1000).owner,"");
  assert.equal(decide({...existing,presence:"Sim"}).owner,"");
  assert.equal(decide({...existing,presence:"Sim"},reference+1000).owner,"Paula");
});
test("redistribuição exige evidência de ausência e respeita os limites da política", () => {
  const open = {opening:"25/08/2026 12:00",hasSale:"Não",interaction:"Não",scheduled:"Não"};
  assert.equal(decide(open).decision,"Redistribuir por inatividade");
  assert.notEqual(decide(open,reference-1000).decision,"Redistribuir por inatividade");
  assert.notEqual(decide({...open,scheduled:""}).decision,"Redistribuir por inatividade");
  const client = {lastSale:"23/11/2025 12:00",interaction:"Não",scheduled:"Não"};
  assert.notEqual(decide(client).decision,"Liberar para reativação");
  assert.equal(decide(client,reference+1000).decision,"Liberar para reativação");
  assert.notEqual(decide({...client,lastActivity:"30/11/2025"},reference+1000).decision,"Liberar para reativação");
});
test("SLA por origem reconhece somente conclusão formal e vencimento informado", () => {
  const ref = {origin:"Indicação direta",deadline:"23/11/2026 11:00"};
  assert.equal(decide(ref).sla,"24 horas úteis");
  assert.equal(decide({origin:"Grandes eventos"}).sla,"5 dias úteis");
  assert.equal(decide({...ref, completed:"Não"}).decision,"Redistribuir por SLA");
  assert.equal(decide({...ref, firstCompleted:"23/11/2026 10:59"}).slaState,"Cumprido");
  assert.equal(decide({...ref, firstCompleted:"23/11/2026 11:01"}).decision,"Revisar redistribuição por SLA");
  assert.equal(decide(ref).slaState,"Verificar atividade concluída");
});
test("importação mantém linhas e abas de origem e permite reprocessar a saída", async () => {
  const book = new ExcelJS.Workbook();
  book.addWorksheet("Geral").addRows([["Cidade","Comercial"],["POA","Ana"]]);
  book.addWorksheet("PORTO ALEGRE").addRows([["Empresa","Nome","Status","Status","Pipe"],["Exemplo","Maria","","Confirmada","Não"],["Nome","Empresa","Compareceu","Pipe","Última atividade"],["Joana","Outra","Sim","Sim","01/01/2025"]]);
  const run = async (input:ArrayBuffer) => prioritizeWorkbook(input,new Date("2026-11-23T15:00:00Z"));
  const first = await run(new Uint8Array(await book.xlsx.writeBuffer()).buffer);
  const second = await run(new Uint8Array(first.bytes).buffer);
  assert.equal(second.count,2);
  const output = new ExcelJS.Workbook(); await output.xlsx.load(second.bytes.buffer);
  const sheet = output.getWorksheet("Prioridades comerciais")!;
  assert.equal(output.worksheets.length,4);
  assert.equal(sheet.getCell("I2").text,"Ana");
  assert.equal(sheet.getCell("E2").text,"Confirmada");
  assert.equal(sheet.getCell("C3").text,"Outra");
});
