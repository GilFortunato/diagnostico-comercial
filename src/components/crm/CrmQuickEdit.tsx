"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { isActive, meetingNextAction, needsNextAction, stageOutcome, stages, type ActivitySummary, type CrmDetail, type CrmRow, type CrmStage } from "@/lib/crm/model";
import { crmButton, crmControl, CrmRequestError, requestCrm } from "./controls";

export type QuickEdit = {
  row: CrmRow;
  mode: "stage" | "action" | "schedule" | "held" | "cancelMeeting" | "proposal" | "outcome";
  meeting?: ActivitySummary;
};

export function CrmQuickEdit({ edit, today, onClose, onSaved, onRefresh }: {
  edit: QuickEdit;
  today: string;
  onClose: () => void;
  onSaved: (detail: CrmDetail, message: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const { row, mode, meeting } = edit;
  const [outcome, setOutcome] = useState<"Fechado" | "Perdido">("Fechado");
  const dialog = useRef<HTMLDialogElement>(null);
  const [stage, setStage] = useState<CrmStage | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const scheduling = mode === "schedule";
  const held = mode === "held";
  const cancelling = mode === "cancelMeeting";
  const proposal = mode === "proposal";
  const closing = mode === "outcome";
  const meetingMode = scheduling || held;
  const meetingKind = scheduling ? "Reunião agendada" : "Reunião realizada";
  const canAdvanceMeeting = ["Mapeado", "Primeiro contato", "Em conversa", "Agendar Reunião", "Reunião agendada"].includes(row.stage);
  const target = cancelling ? row.stage === "Reunião agendada" && "Agendar Reunião"
    : proposal ? row.stage === "Negociação" ? "Negociação" : "Proposta enviada"
    : closing ? outcome : meetingMode ? canAdvanceMeeting && meetingKind : stage;
  const showAction = mode === "action" || Boolean(target && !scheduling && !cancelling && needsNextAction(row, target));
  const actionWasMeeting = row.nextAction === meetingNextAction && row.nextActionDate === meeting?.date;
  const recordFollowUp = held && isActive(target ? stageOutcome(row, target) : row) && (actionWasMeeting || !row.nextAction?.trim() || !row.nextActionDate);

  const titles = {
    stage: "Alterar etapa",
    action: row.nextAction ? "Editar próxima ação" : "Cadastrar próxima ação",
    schedule: meeting?.date ? "Reagendar reunião" : "Agendar reunião",
    held: "Registrar reunião realizada",
    cancelMeeting: "Cancelar reunião",
    proposal: "Registrar envio de proposta",
    outcome: "Registrar resultado da proposta",
  };

  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || stale) return;
    const fields = new FormData(event.currentTarget);
    const text = (key: string) => String(fields.get(key) ?? "").trim();
    const nextAction = text("nextAction");
    const nextActionDate = text("nextActionDate");
    if ((showAction || recordFollowUp) && !nextAction) { setError("Informe a próxima ação."); return; }
    if (cancelling && !text("note")) { setError("Informe o motivo do cancelamento."); return; }
    if (closing && outcome === "Perdido" && !text("outcomeNote")) { setError("Informe o motivo da perda."); return; }
    setBusy(true);
    setError("");
    try {
      const detail = await requestCrm<CrmDetail>("/api/crm/" + encodeURIComponent(row.id), {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "opportunity", data: {
          version: row.version,
          ...(target ? { stage: target } : {}),
          ...(showAction || recordFollowUp ? { nextAction, nextActionDate } : {}),
          ...(proposal ? { proposedValue: Number(text("value")), proposal: { sentOn: text("proposalDate"), note: text("note") || undefined } } : {}),
          ...(closing ? { result: outcome === "Fechado" ? "Vendido" : "Não vendido", outcomeNote: text("outcomeNote") || undefined, ...(outcome === "Fechado" ? { soldValue: Number(text("value")), saleDate: text("proposalDate") } : {}) } : {}),
          ...(cancelling ? { meeting: { id: meeting?.id, kind: "Reunião cancelada", note: text("note") } } : {}),
          ...(meetingMode ? { meeting: {
            id: meeting?.id, kind: meetingKind, date: text("meetingDate"), note: text("note") || undefined,
          } } : {}),
        } }),
      });
      onSaved(detail, cancelling ? "Reunião cancelada." : proposal ? "Envio da proposta registrado." : closing ? "Resultado atualizado." : scheduling ? meeting?.date ? "Reunião reagendada." : "Reunião agendada." : held ? "Reunião registrada como realizada." : mode === "action" ? "Próxima ação salva." : "Etapa atualizada.");
    } catch (cause) {
      if (cause instanceof CrmRequestError && cause.status === 409) {
        setStale(true);
        await onRefresh();
      }
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a alteração.");
    } finally {
      setBusy(false);
    }
  }

  return <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} aria-labelledby="crm-quick-title"
    className="m-auto max-h-[90dvh] w-[min(92vw,29rem)] rounded-xl bg-white p-5 text-[var(--share-ink)] shadow-xl backdrop:bg-black/40">
    <div className="flex items-center justify-between gap-3">
      <h2 id="crm-quick-title" className="text-xl font-semibold">{titles[mode]}</h2>
      <button type="button" aria-label="Fechar" className="rounded-lg p-2 hover:bg-zinc-100" disabled={busy} onClick={onClose}><X className="h-5 w-5" /></button>
    </div>
    <p className="mt-1 text-sm text-zinc-600">{row.name} · {row.stage}</p>
    <form onSubmit={(event) => void submit(event)} className="mt-4 grid gap-3">
      {mode === "stage" && <label className="grid gap-1 text-xs font-semibold">Nova etapa
        <select className={crmControl} required disabled={busy} value={stage} onChange={(event) => setStage(event.target.value as CrmStage | "")}>
          <option value="">Selecionar etapa</option>
          {stages.filter((item) => item !== row.stage).map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>}
      {meetingMode && <>
        <label className="grid gap-1 text-xs font-semibold">{scheduling ? "Data da reunião" : "Data em que ocorreu"}
          <input className={crmControl} name="meetingDate" type="date" max={held ? today : undefined} required disabled={busy} defaultValue={held ? today : meeting?.date ?? ""} />
        </label>
        <label className="grid gap-1 text-xs font-semibold">Observações<textarea className={crmControl} name="note" rows={2} maxLength={12000} disabled={busy} /></label>
      </>}
      {cancelling && <label className="grid gap-1 text-xs font-semibold">Motivo do cancelamento<textarea className={crmControl} name="note" rows={3} maxLength={12000} required disabled={busy} /></label>}
      {closing && <label className="grid gap-1 text-xs font-semibold">Resultado
        <select aria-label="Resultado" className={crmControl} value={outcome} disabled={busy} onChange={(event) => setOutcome(event.target.value === "Perdido" ? "Perdido" : "Fechado")}>
          <option value="Fechado">Ganha</option><option value="Perdido">Perdida</option>
        </select>
      </label>}
      {(proposal || (closing && outcome === "Fechado")) && <>
        <label className="grid gap-1 text-xs font-semibold">{proposal ? "Valor proposto (R$)" : "Valor vendido (R$)"}
          <input className={crmControl} name="value" type="number" min={0} step="0.01" required disabled={busy} defaultValue={proposal ? row.proposedValue ?? "" : row.soldValue ?? row.proposedValue ?? ""} />
        </label>
        <label className="grid gap-1 text-xs font-semibold">{proposal ? "Data de envio" : "Data do fechamento"}
          <input className={crmControl} name="proposalDate" type="date" defaultValue={today} required disabled={busy} max={today} />
        </label>
      </>}
      {proposal && <label className="grid gap-1 text-xs font-semibold">Observações<textarea className={crmControl} name="note" rows={2} maxLength={12000} disabled={busy} /></label>}
      {closing && <label className="grid gap-1 text-xs font-semibold">{outcome === "Perdido" ? "Motivo da perda" : "Observações"}
        <textarea className={crmControl} name="outcomeNote" rows={2} maxLength={4000} disabled={busy} required={outcome === "Perdido"} />
      </label>}
      {(showAction || recordFollowUp) && <>
        <label className="grid gap-1 text-xs font-semibold">{held ? "Próxima ação após a reunião" : "Próxima ação"}
          <textarea aria-label={held ? "Próxima ação após a reunião" : "Próxima ação"} className={crmControl} name="nextAction" defaultValue={held && actionWasMeeting ? "" : row.nextAction ?? ""} rows={3} maxLength={4000} required disabled={busy} />
        </label>
        <label className="grid gap-1 text-xs font-semibold">Prazo da próxima ação
          <input className={crmControl} name="nextActionDate" defaultValue={held && actionWasMeeting ? "" : row.nextActionDate ?? ""} type="date" required disabled={busy} />
        </label>
      </>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={busy} className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100">Cancelar</button>
        <button type="submit" disabled={busy || stale || (mode === "stage" && !stage)} className={crmButton}>{busy ? "Salvando…" : "Salvar"}</button>
      </div>
    </form>
  </dialog>;
}
