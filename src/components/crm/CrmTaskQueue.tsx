"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CalendarClock, Check, Plus, RotateCcw, X } from "lucide-react";
import type { CrmDetail, CrmRow, CrmTask } from "@/lib/crm/model";
import { crmButton, crmControl, CrmRequestError, dateLabel, requestCrm } from "./controls";

export type TaskSelection = { row?: CrmRow; task?: CrmTask; command?: "complete" | "cancel" | "reopen" };

export function TaskQueue({ rows, tasks, today, onOpen, onTask, onMeeting }: {
  rows: CrmRow[]; tasks: CrmTask[]; today: string;
  onOpen: (id: string) => void; onTask: (selection: TaskSelection) => void; onMeeting: () => void;
}) {
  const [view, setView] = useState("Pendentes");
  const [owner, setOwner] = useState("");
  const byId = new Map(rows.map((row) => [row.id, row]));
  const visible = tasks.filter((task) => byId.has(task.opportunityId) && (!owner || (task.owner ?? "Sem responsável") === owner));
  const owners = [...new Set(tasks.filter((task) => byId.has(task.opportunityId)).map((task) => task.owner ?? "Sem responsável"))].sort();
  const pending = visible.filter((task) => task.status === "Pendente");
  const views = [
    { label: "Pendentes", items: pending },
    { label: "Atrasadas", items: pending.filter((task) => task.dueDate && task.dueDate < today) },
    { label: "Hoje", items: pending.filter((task) => task.dueDate === today) },
    { label: "Sem prazo", items: pending.filter((task) => !task.dueDate) },
    { label: "Concluídas", items: visible.filter((task) => task.status === "Concluída") },
    { label: "Canceladas", items: visible.filter((task) => task.status === "Cancelada") },
  ];
  const items = views.find((item) => item.label === view)?.items ?? pending;
  return <section className="share-card min-w-0 rounded-xl p-4 sm:p-5" aria-label="Fila de tarefas">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h2 className="text-lg font-semibold">Fila de tarefas</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs font-semibold">Responsável pela tarefa
          <select aria-label="Responsável pela tarefa" className={crmControl} value={owner} onChange={(event) => setOwner(event.target.value)}>
            <option value="">Todos</option>{owners.map((name) => <option key={name}>{name}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => onTask({})} className={crmButton} disabled={!rows.length}><Plus size={16} aria-hidden /> Nova tarefa</button>
      </div>
    </div>
    <div className="mt-4 flex flex-wrap gap-2" aria-label="Situação das tarefas">
      {views.map(({ label, items }) => <button key={label} type="button" onClick={() => setView(label)} aria-pressed={view === label}
        className="rounded-lg border border-[var(--share-line)] px-3 py-2 text-xs font-semibold aria-pressed:border-emerald-700 aria-pressed:bg-emerald-50">{label} · {items.length}</button>)}
    </div>
    {!items.length ? <p className="mt-4 text-sm text-zinc-600">Nenhuma tarefa nesta visão.</p> :
      <div className="mt-3 max-h-[28rem] overflow-auto">
        <table className="w-full min-w-[670px] text-left text-sm">
          <thead className="sticky top-0 bg-[#f3f7f2] text-xs"><tr>{["Tarefa", "Oportunidade", "Responsável", "Prazo", "Ações"].map((column) => <th key={column} scope="col" className="p-3">{column}</th>)}</tr></thead>
          <tbody>{items.map((task) => {
            const row = byId.get(task.opportunityId)!;
            return <tr key={task.id} className="border-t border-[var(--share-line)] align-top">
              <td className="max-w-96 whitespace-pre-wrap break-words p-3">
                <strong className="font-semibold">{task.title}</strong>
                {task.resolvedAt && <span className="mt-1 block text-xs text-zinc-600">{task.status} em {dateLabel(task.resolvedAt.slice(0, 10))}{task.resolvedBy ? " · " + task.resolvedBy : ""}</span>}
              </td>
              <td className="p-3"><button type="button" onClick={() => onOpen(row.id)} className="font-semibold text-[var(--share-green-800)] hover:underline">{row.name}</button></td>
              <td className="p-3">{task.owner || "Sem responsável"}</td>
              <td className={"whitespace-nowrap p-3 " + (task.status === "Pendente" && task.dueDate && task.dueDate < today ? "font-semibold text-red-700" : "")}>{dateLabel(task.dueDate)}</td>
              <td className="p-3"><TaskActions task={task} onTask={(selection) => onTask({ ...selection, row })} onMeeting={onMeeting} /></td>
            </tr>;
          })}</tbody>
        </table>
      </div>}
  </section>;
}

export function TaskActions({ task, onTask, onMeeting }: {
  task: CrmTask; onTask: (selection: TaskSelection) => void; onMeeting: () => void;
}) {
  const action = "inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-semibold text-[var(--share-green-800)] hover:bg-emerald-50";
  if (task.meetingId) return <button type="button" className={action} onClick={onMeeting}><CalendarClock size={14} aria-hidden /> Ver reuniões</button>;
  if (task.status !== "Pendente") return <button type="button" className={action} onClick={() => onTask({ task, command: "reopen" })}><RotateCcw size={14} aria-hidden /> Reabrir</button>;
  return <div className="flex flex-wrap gap-1">
    <button type="button" className={action} onClick={() => onTask({ task })}>Editar</button>
    <button type="button" className={action} onClick={() => onTask({ task, command: "complete" })}><Check size={14} aria-hidden /> Concluir</button>
    <button type="button" className={action} onClick={() => onTask({ task, command: "cancel" })}>Cancelar</button>
  </div>;
}

export function CrmTaskDialog({ selection, rows, owners, onClose, onSaved, onRefresh }: {
  selection: TaskSelection; rows: CrmRow[]; owners: string[];
  onClose: () => void; onSaved: (detail: CrmDetail) => void; onRefresh: () => Promise<void>;
}) {
  const { task, command } = selection;
  const [rowId, setRowId] = useState(selection.row?.id ?? "");
  const row = selection.row ?? rows.find((item) => item.id === rowId);
  const title = command ? { complete: "Concluir tarefa", cancel: "Cancelar tarefa", reopen: "Reabrir tarefa" }[command] : task ? "Editar tarefa" : "Nova tarefa";
  const dialog = useRef<HTMLDialogElement>(null);
  const requestId = useRef("");
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!row || busy || stale) return;
    const data = new FormData(event.currentTarget);
    requestId.current ||= crypto.randomUUID();
    const fields = { title: String(data.get("title") ?? "").trim(), owner: String(data.get("owner") ?? "").trim(), dueDate: data.get("dueDate") };
    if (!command && (!fields.title || !fields.owner)) { setError("Informe a tarefa e o responsável."); return; }
    const mutation = command ? { kind: command, id: task?.id }
      : task ? { kind: "edit", id: task.id, ...fields } : { kind: "create", requestId: requestId.current, ...fields };
    setBusy(true);
    setError("");
    try {
      onSaved(await requestCrm<CrmDetail>("/api/crm/" + encodeURIComponent(row.id), {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "task", data: { version: row.version, task: mutation } }),
      }));
      onClose();
    } catch (cause) {
      if (cause instanceof CrmRequestError && cause.status === 409) { setStale(true); await onRefresh(); }
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar a tarefa.");
    } finally { setBusy(false); }
  }

  return <dialog ref={dialog} aria-labelledby="crm-task-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    className="m-auto max-h-[90dvh] w-[min(92vw,30rem)] rounded-xl bg-white p-5 shadow-xl backdrop:bg-black/40">
    <header className="flex items-center justify-between gap-3">
      <h2 id="crm-task-title" className="text-xl font-semibold">{title}</h2>
      <button type="button" onClick={onClose} disabled={busy} aria-label="Fechar" className="rounded-lg p-2 hover:bg-zinc-100"><X size={18} /></button>
    </header>
    <form onSubmit={(event) => void save(event)} className="mt-4 grid gap-3">
      {selection.row ? <p className="text-sm text-zinc-600">{row?.name}</p> : <label className="grid gap-1 text-xs font-semibold">Oportunidade
        <select className={crmControl} value={rowId} onChange={(event) => setRowId(event.target.value)} required disabled={busy}>
          <option value="">Selecionar oportunidade</option>
          {rows.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.project || item.stage}{item.legacyId ? " · #" + item.legacyId : ""}</option>)}
        </select>
      </label>}
      {command ? <p className="whitespace-pre-wrap break-words rounded-lg bg-[#f3f7f2] p-3 text-sm">{task?.title}</p> :
        <div className="grid gap-3" key={rowId}>
          <label className="grid gap-1 text-xs font-semibold">Descrição
            <textarea name="title" aria-label="Descrição" className={crmControl} rows={3} defaultValue={task?.title ?? ""} required maxLength={4000} disabled={busy} />
          </label>
          <label className="grid gap-1 text-xs font-semibold">Responsável
            <input name="owner" maxLength={300} list="crm-task-owners" className={crmControl} defaultValue={task?.owner ?? row?.owner ?? ""} required disabled={busy} />
            <datalist id="crm-task-owners">{owners.map((name) => <option value={name} key={name} />)}</datalist>
          </label>
          <label className="grid gap-1 text-xs font-semibold">Prazo
            <input name="dueDate" type="date" className={crmControl} defaultValue={task?.dueDate ?? ""} required disabled={busy} />
          </label>
        </div>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={busy} className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-zinc-100">Voltar</button>
        <button type="submit" className={crmButton} disabled={!row || busy || stale}>{busy ? "Salvando…" : command ? title : "Salvar tarefa"}</button>
      </div>
    </form>
  </dialog>;
}
