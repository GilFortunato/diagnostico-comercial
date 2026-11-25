"use client";

import { useEffect, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";

export function CommercialPanel() {
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [output, setOutput] = useState<{url:string; name:string; count:number; cities:number; skipped:string[]}>();
  useEffect(() => () => { if (output) URL.revokeObjectURL(output.url); }, [output]);

  async function process() {
    if (!file || busy) return;
    setError("");
    setBusy(true);
    try {
      const { prioritizeWorkbook } = await import("@/lib/decision-makers/commercialWorkbook");
      const {bytes,count,cities,skipped} = await prioritizeWorkbook(await file.arrayBuffer());
      const blob = new Blob([new Uint8Array(bytes)], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
      setOutput({url:URL.createObjectURL(blob),name:file.name.replace(/\.xlsx$/i,"") + "-weekend.xlsx",count,cities,skipped});
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      setError(/^(Nenhum registro|Esta é a lista de saída)/.test(message) ? message : "Não foi possível ler o arquivo. Selecione uma planilha .xlsx válida e sem senha.");
    } finally { setBusy(false); }
  }

  return <section className="rounded-2xl border border-[var(--share-line)] bg-white p-6">
    <p className="text-xs font-bold uppercase tracking-wide text-[var(--share-green-800)]">B2B Hunting</p>
    <h1 className="mt-2 text-3xl font-semibold text-[var(--share-green-950)]">Comercial</h1>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">Importe a planilha do Humanship Dinner para identificar quem tem prioridade de atendimento, quais contatos podem ser redistribuídos e o que precisa de conferência no Pipedrive.</p>
    <label className="mt-6 grid gap-2 text-sm font-semibold">Planilha de leads (.xlsx)
      <input type="file" accept=".xlsx" disabled={busy} className="w-full max-w-xl rounded-lg border border-[var(--share-line)] p-3 text-sm" onChange={event => {
        setFile(event.target.files?.[0]); setOutput(undefined); setError("");
      }} />
    </label>
    <button type="button" disabled={!file || busy || !!output} onClick={() => void process()} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--share-green-950)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><FileSpreadsheet size={16}/>{busy ? "Analisando planilha…" : "Gerar prioridades"}</button>
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    {output && <div role="status" className="mt-5 rounded-lg bg-green-50 p-4 text-sm">
      <p>{output.count.toLocaleString("pt-BR")} registros analisados em {output.cities} abas. A aba <strong>Weekend</strong> mostra primeiro as ações prioritárias e agrupa os responsáveis dentro de cada nível. Consulte a prioridade e a próxima ação em <strong>Obs</strong>.</p>
      {output.skipped.length > 0 && <p className="mt-1">Abas sem cabeçalho reconhecido: {output.skipped.join(", ")}.</p>}
      <a href={output.url} download={output.name} className="mt-3 inline-flex items-center gap-2 font-bold text-[var(--share-green-800)] underline"><Download size={16}/> Baixar planilha priorizada</a>
    </div>}
  </section>;
}
