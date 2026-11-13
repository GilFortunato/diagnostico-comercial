"use client";

import { useEffect, useState, type FormEvent } from "react";
import { normalize, type CrmImportReview as Review, type CrmRow } from "@/lib/crm/model";
import { crmButton, crmControl, requestCrm } from "./controls";

export function CrmImportReview({ opportunities, onOpen }: { opportunities: CrmRow[]; onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<Review[]>();
  const [selected, setSelected] = useState<number>();
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    requestCrm<Review[]>("/api/crm/import-review", { signal: controller.signal }).then(setRows).catch((error: Error) => {
      if (error.name !== "AbortError") setError(error.message);
    });
    return () => controller.abort();
  }, []);
  const item = rows?.find((row) => row.rowNumber === selected);
  return <section className="share-card min-w-0 rounded-xl p-4">
    <h3 className="text-base font-semibold">Página3 · registros importados</h3>
    {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : !rows ? <p role="status" className="mt-3 text-sm">Carregando registros…</p> :
      <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_2fr]">
        <div>
          <p className="mb-2 text-xs font-semibold text-zinc-600">{rows.filter((row) => !row.reviewedAt).length} aguardando conferência</p>
          <ul className="max-h-[28rem] divide-y divide-[var(--share-line)] overflow-y-auto">
            {rows.map((row) => <li key={row.rowNumber}>
              <button type="button" aria-pressed={selected === row.rowNumber} onClick={() => setSelected(row.rowNumber)} className="w-full rounded px-2 py-2 text-left text-sm hover:bg-emerald-50 aria-pressed:bg-emerald-50">
                <span className="font-semibold">{String(row.data.C || "Linha " + row.rowNumber)}</span>
                <span className="block text-xs text-zinc-600">{row.reviewedAt ? row.opportunityId ? "Vinculada" : "Conferida" : "Pendente"} · linha {row.rowNumber}</span>
              </button>
            </li>)}
          </ul>
        </div>
        {item ? <ReviewForm key={item.rowNumber + ":" + item.reviewedAt} item={item} opportunities={opportunities}
          onSaved={setRows} onOpen={onOpen} /> : <p className="text-sm text-zinc-600">Selecione um registro para comparar e registrar a conferência.</p>}
      </div>}
  </section>;
}

function ReviewForm({ item, opportunities, onSaved, onOpen }: {
  item: Review; opportunities: CrmRow[]; onSaved: (rows: Review[]) => void; onOpen: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [match, setMatch] = useState(item.opportunityId ?? "");
  const company = typeof item.data.C === "string" ? normalize(item.data.C) : "";
  const full = opportunities.filter((row) => row.id === match || !query || normalize([row.name, row.project, row.legacyId].join(" ")).includes(normalize(query)));
  const suggested = full.filter((row) => company && normalize(row.name) === company);
  const choices = [...suggested, ...full.filter((row) => !suggested.includes(row))];

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const reviewNote = String(new FormData(event.currentTarget).get("note") ?? "").trim();
    if (!reviewNote) { setError("Informe a decisão da conferência."); return; }
    setBusy(true);
    setError("");
    try {
      onSaved(await requestCrm<Review[]>("/api/crm/import-review", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowNumber: item.rowNumber, opportunityId: match || null, reviewNote, reviewedAt: item.reviewedAt }),
      }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao salvar a conferência."); }
    finally { setBusy(false); }
  }

  return <form onSubmit={(event) => void save(event)} className="grid min-w-0 gap-3">
    <dl className="grid gap-2 rounded-lg bg-[#f3f7f2] p-3 text-sm">
      {Object.entries(item.data).map(([column, value]) => <div key={column} className="flex gap-2"><dt className="min-w-16 font-semibold">Coluna {column}</dt><dd className="whitespace-pre-wrap break-words">{String(value ?? "")}</dd></div>)}
    </dl>
    <label className="grid gap-1 text-xs font-semibold">Buscar oportunidade
      <input className={crmControl} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Empresa, projeto ou cadastro" />
    </label>
    <label className="grid gap-1 text-xs font-semibold">Vincular a uma oportunidade
      <select aria-label="Vincular a uma oportunidade" className={crmControl} value={match} onChange={(event) => setMatch(event.target.value)}>
        <option value="">Registrar conferência sem vínculo</option>
        {choices.map((row) => <option key={row.id} value={row.id}>{row.name} · {row.project || row.stage}{row.legacyId ? " · #" + row.legacyId : ""}{suggested.includes(row) ? " · nome correspondente" : ""}</option>)}
      </select>
    </label>
    {match && <button type="button" onClick={() => onOpen(match)} className="w-fit text-sm font-semibold text-[var(--share-green-800)] hover:underline">Ver ficha selecionada</button>}
    <label className="grid gap-1 text-xs font-semibold">Decisão da conferência
      <textarea className={crmControl} name="note" defaultValue={item.reviewNote ?? ""} rows={2} maxLength={4000} required />
    </label>
    {item.reviewedBy && <p className="text-xs text-zinc-600">Revisado por {item.reviewedBy}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button className={crmButton + " w-fit"} type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar conferência"}</button>
  </form>;
}
