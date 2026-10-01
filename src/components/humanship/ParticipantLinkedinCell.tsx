"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { manualLinkedinSchema } from "@/lib/humanship/manualLinkedin";
import type { HumanshipParticipant } from "@/lib/humanship/types";

export function ParticipantLinkedinCell({ participant, disabled, onSaved }: {
  participant: HumanshipParticipant;
  disabled: boolean;
  onSaved: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    const parsed = manualLinkedinSchema.safeParse({ action: "linkedin", linkedinUrl: url });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setSaving(true); setError(null);
    try {
      const response = await fetch(`/api/humanship/participants/${participant.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Não foi possível salvar o LinkedIn.");
      await onSaved();
      setEditing(false); setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o LinkedIn.");
    } finally { setSaving(false); }
  }

  return <td className="p-3">
    <div className="grid gap-2">
      {participant.linkedinUrl ? <>
        <a href={participant.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[var(--share-green-900)]">Abrir perfil <ExternalLink className="h-3.5 w-3.5" /></a>
        {participant.searchStatus === "probable" ? <span className="text-xs text-amber-800">Correspondência provável · validar</span> : null}
        {participant.searchStatus === "manual" ? <span className="text-xs text-[var(--share-green-800)]">Informado manualmente</span> : null}
        {participant.linkedinName && participant.linkedinName !== participant.fullName ? <span className="text-xs text-zinc-500">Encontrado como: {participant.linkedinName}</span> : null}
      </> : <span className="text-zinc-500">{participant.searchStatus === "searching" ? "Pesquisando..." : participant.searchStatus === "error" ? "Fonte indisponível" : participant.searchStatus === "not_found" ? "Não confirmado" : "Aguardando busca"}</span>}
      {editing ? <form className="grid min-w-56 gap-2" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <label htmlFor={`linkedin-${participant.id}`} className="text-xs font-semibold">LinkedIn de {participant.fullName}</label>
        <input id={`linkedin-${participant.id}`} type="text" inputMode="url" autoFocus autoComplete="off" maxLength={2048} value={url} onChange={(e) => { setUrl(e.target.value); setError(null); }} placeholder="https://www.linkedin.com/in/nome" disabled={saving} aria-invalid={Boolean(error)} aria-describedby={error ? `linkedin-error-${participant.id}` : undefined} className="w-full rounded-md border border-[var(--share-line)] px-2 py-2 text-sm" />
        <p className="text-xs text-zinc-500">Cole o link do perfil. A aprovação da pessoa continua nas ações ao lado.</p>
        <div className="flex gap-2">
          <button type="submit" disabled={saving || disabled || !url.trim()} className="rounded-md bg-[var(--share-green-950)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{saving ? "Salvando..." : "Salvar LinkedIn"}</button>
          <button type="button" disabled={saving} onClick={() => { setEditing(false); setError(null); }} className="rounded-md border border-[var(--share-line)] px-3 py-1.5 text-xs">Cancelar</button>
        </div>
        {error ? <p id={`linkedin-error-${participant.id}`} role="alert" className="text-xs text-red-700">{error}</p> : null}
      </form> : <button type="button" disabled={disabled} onClick={() => { setUrl(participant.linkedinUrl || ""); setError(null); setSaved(false); setEditing(true); }} className="w-fit rounded-md border border-[var(--share-green-800)] px-2 py-1 text-xs font-semibold text-[var(--share-green-900)] disabled:opacity-50">{participant.linkedinUrl ? "Editar LinkedIn" : "Inserir LinkedIn"}</button>}
      {saved ? <p role="status" className="text-xs text-emerald-800">LinkedIn salvo.</p> : null}
    </div>
  </td>;
}
