"use client";

import { useRef, useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { crmButton, crmControl, requestCrm } from "./controls";

const fields = [
  ["company", "Empresa / marca"], ["contact", "Decisor"], ["segment", "Segmento"],
  ["origin", "Origem"], ["project", "Evento / projeto"], ["sponsorship", "Cota"], ["owner", "Responsável"],
] as const;

export function CrmCreateOpportunity({ onCreated }: { onCreated: (id: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const requestId = useRef("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function open() {
    requestId.current = crypto.randomUUID();
    setError("");
    form.current?.reset();
    dialog.current?.showModal();
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await requestCrm<{ id: string }>("/api/crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: requestId.current, ...data }) });
      dialog.current?.close();
      onCreated(result.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao criar oportunidade."); }
    finally { setBusy(false); }
  }
  return <>
    <button type="button" onClick={open} className="inline-flex items-center gap-2 rounded-lg border border-white/40 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"><Plus className="h-4 w-4" />Nova oportunidade</button>
    <dialog ref={dialog} aria-labelledby="crm-create-title" className="m-auto w-[min(92vw,34rem)] rounded-xl bg-white p-5 text-[var(--share-ink)] shadow-xl backdrop:bg-black/40">
      <header className="flex items-center justify-between"><h2 id="crm-create-title" className="text-xl font-semibold">Nova oportunidade</h2><button type="button" aria-label="Fechar" onClick={() => dialog.current?.close()} className="rounded-lg p-2 hover:bg-zinc-100"><X className="h-5 w-5" /></button></header>
      <form ref={form} onSubmit={(event) => void create(event)} className="mt-4 grid gap-3 sm:grid-cols-2">
        {fields.map(([name, label]) => <label key={name} className="grid gap-1 text-xs font-semibold">{label}<input name={name} required={name === "company"} maxLength={300} className={crmControl} /></label>)}
        {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p>}
        <button type="submit" disabled={busy} className={crmButton + " sm:col-span-2"}>{busy ? "Salvando…" : "Criar oportunidade"}</button>
      </form>
    </dialog>
  </>;
}
