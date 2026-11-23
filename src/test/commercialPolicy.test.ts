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
test("lista Weekend consolida seis colunas e aplica a política dentro de cada grupo", async () => {
  const book = new ExcelJS.Workbook();
  book.addWorksheet("Geral").addRows([["Cidade","Comercial"],["POA","Ana"]]);
  book.addWorksheet("PORTO ALEGRE").addRows([
    ["Empresa","Nome","Cargo","Status","Status","Pipe","Responsável","Telefone","E-mail","Observações"],
    ["Primeira","Maria","Head","","Confirmada","","Ana","(11) 98765-4321","m@example.org","Prefere ligação"],
    ["Segunda","Joana","Diretora","","","Não","Outro","","j@example.org",""],
    ["Terceira","Lia","Gerente"],
  ]);
  const {bytes,count} = await prioritizeWorkbook(new Uint8Array(await book.xlsx.writeBuffer()).buffer);
  const output = new ExcelJS.Workbook(); await output.xlsx.load(bytes.buffer);
  const sheet = output.worksheets[0];
  assert.equal(count,3);
  assert.equal(output.worksheets.length,1);
  assert.equal(sheet.name,"Weekend");
  assert.deepEqual(sheet.getRow(1).values, [, "Empresa","Nome","Cargo","Contato","Obs","Responsável"]);
  assert.equal(sheet.actualColumnCount,6);
  assert.equal(sheet.getCell("A2").text,"Segunda");
  assert.equal(sheet.getCell("C2").text,"Diretora");
  assert.equal(sheet.getCell("D2").text,"j@example.org");
  assert.match(sheet.getCell("E2").text,/Prioridade do organizador/);
  assert.equal(sheet.getCell("F2").text,"Ana");
  assert.equal(sheet.getCell("D3").text,"(11) 98765-4321");
  assert.match(sheet.getCell("E3").text,/Prefere ligação/);
  assert.equal(sheet.getCell("F4").text,"");
});
test("modelo com Tal no cabeçalho mantém o responsável e reconhece o telefone", async () => {
  const book = new ExcelJS.Workbook();
  book.addWorksheet("Página1").addRows([["Empresa","Nome ","Cargo","Contato","Obs","Tal"],["Exemplo","Maria","CEO","011 98765-4321","Retornar sexta","Ale"]]);
  const {bytes} = await prioritizeWorkbook(new Uint8Array(await book.xlsx.writeBuffer()).buffer);
  const output = new ExcelJS.Workbook(); await output.xlsx.load(bytes.buffer);
  assert.equal(output.worksheets[0].getCell("F2").text,"Ale");
  assert.equal(output.worksheets[0].getCell("D2").text,"011 98765-4321");
});
