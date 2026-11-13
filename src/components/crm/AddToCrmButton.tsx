"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { crmPath } from "@/lib/crm/model";
import { crmButton, crmControl, requestCrm } from "./controls";

type Choice = { id: string; stage: string; project: string | null; sponsorship: string | null; contacts: string[] };
type Result = { id: string } | { choices: Choice[]; company: string };

export function AddToCrmButton({ leadId, searchId }: { leadId?: string; searchId?: string }) {
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [choices, setChoices] = useState<Extract<Result, { choices: Choice[] }> | null>(null);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (choices) node?.showModal();
    return () => node?.close();
  }, [choices]);

  async function add(values: Record<string, unknown> = {}) {
    if (!leadId) return;
    setBusy(true);
    setError("");
    try {
      const result = await requestCrm<Result>("/api/crm/hunting", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, searchId, ...values }),
      });
      if ("id" in result) { setSaved(result.id); setChoices(null); }
      else setChoices(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível adicionar ao CRM."); }
    finally { setBusy(false); }
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void add({ createNew: true, project: form.get("project"), sponsorship: form.get("sponsorship") });
  }

  if (saved) return <Link className="rounded-md px-2 py-1 text-xs font-semibold text-emerald-800 underline" href={crmPath + "?lead=" + encodeURIComponent(saved)}>Ver no CRM</Link>;
  return <div className="grid gap-1">
    <button type="button" onClick={() => void add()} disabled={!leadId || busy} title={!leadId ? "Abra uma pesquisa salva para recuperar o lead." : undefined} className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-emerald-900 disabled:opacity-40">
      <Plus className="h-3.5 w-3.5" />{busy ? "Salvando…" : "Adicionar ao CRM"}
    </button>
    {error && !choices && <span role="alert" className="max-w-44 text-xs text-red-700">{error}</span>}
    {choices && <dialog ref={dialog} onCancel={(e) => { e.preventDefault(); setChoices(null); }} aria-label="Selecionar oportunidade no CRM" className="m-auto w-[min(92vw,34rem)] rounded-xl bg-white p-5 text-left shadow-xl backdrop:bg-black/45">
      <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">{choices.company}</h2><button type="button" onClick={() => setChoices(null)} aria-label="Fechar" className="rounded p-1 hover:bg-zinc-100"><X className="h-5 w-5" /></button></div>
      <p className="mt-2 text-sm text-zinc-600">Vincule o lead ou abra uma nova oportunidade.</p>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      <ul className="my-4 grid max-h-64 gap-2 overflow-auto">{choices.choices.map((item) => <li key={item.id}>
        <button type="button" onClick={() => void add({ opportunityId: item.id })} disabled={busy} className={crmControl + " text-left hover:bg-green-50 disabled:opacity-50"}>
          <strong>{[item.project, item.sponsorship, item.stage].filter(Boolean).join(" · ")}</strong>
          {item.contacts.length > 0 && <span className="block text-xs text-zinc-600">{item.contacts.join(", ")}</span>}
        </button>
      </li>)}</ul>
      <form onSubmit={create} className="grid gap-2 border-t pt-4 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-semibold">Evento / projeto<input name="project" className={crmControl} maxLength={300} /></label>
        <label className="grid gap-1 text-xs font-semibold">Cota<input name="sponsorship" className={crmControl} maxLength={300} /></label>
        <button type="submit" disabled={busy} className={crmButton + " sm:col-span-2"}>Criar nova oportunidade</button>
      </form>
    </dialog>}
  </div>;
}
