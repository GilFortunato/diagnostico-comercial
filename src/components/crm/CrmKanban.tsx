"use client";

import { DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { GripVertical, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { brl, needsNextAction, stages, type CrmDetail, type CrmRow, type CrmStage } from "@/lib/crm/model";
import { crmButton, crmControl, CrmRequestError, dateLabel, requestCrm } from "./controls";
import { CrmAlertLabel } from "./CrmAlertLabel";

type Move = { row: CrmRow; stage?: CrmStage };
type NextAction = { nextAction: string; nextActionDate: string };

function isCrmStage(value: string | undefined): value is CrmStage {
  return stages.some((stage) => stage === value);
}

export function CrmKanban({ rows, today, onOpen, onMoved, onRefresh }: {
  rows: CrmRow[];
  today: string;
  onOpen: (id: string) => void;
  onMoved: (detail: CrmDetail) => void;
  onRefresh: () => Promise<void>;
}) {
  const [draggingId, setDraggingId] = useState<string>();
  const [move, setMove] = useState<Move>();
  const [savingId, setSavingId] = useState<string>();
  const [message, setMessage] = useState<{ text: string; error: boolean }>();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );
  const columns = new Map<string, CrmRow[]>(stages.map((stage) => [stage, []]));
  for (const row of rows) {
    const group = columns.get(row.stage);
    if (group) group.push(row);
    else columns.set(row.stage, [row]);
  }
  const dragged = rows.find((row) => row.id === draggingId);

  async function saveMove(row: CrmRow, stage: CrmStage, action?: NextAction) {
    if (savingId || row.stage === stage) return;
    setSavingId(row.id);
    setMessage(undefined);
    try {
      const detail = await requestCrm<CrmDetail>("/api/crm/" + encodeURIComponent(row.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "opportunity", data: { stage, version: row.version, ...action } }),
      });
      onMoved(detail);
      setMove(undefined);
      setMessage({ text: row.name + " foi movida para " + stage + ".", error: false });
    } catch (error) {
      if (error instanceof CrmRequestError && error.status === 409) {
        setMove(undefined);
        await onRefresh();
      }
      setMessage({ text: error instanceof Error ? error.message : "Não foi possível mover a oportunidade.", error: true });
    } finally {
      setSavingId(undefined);
    }
  }

  function endDrag({ active, over }: DragEndEvent) {
    setDraggingId(undefined);
    const row = rows.find((item) => item.id === active.id);
    const stage = over?.data.current?.stage;
    if (!row || !isCrmStage(stage) || row.stage === stage || savingId) return;
    setMessage(undefined);
    if (needsNextAction(row, stage)) setMove({ row, stage });
    else void saveMove(row, stage);
  }

  return <>
    <p className="text-sm text-zinc-600">Arraste um card para mudar de etapa ou use o botão Mover no card.</p>
    {message && !move && <p role={message.error ? "alert" : "status"} className={"rounded-lg px-3 py-2 text-sm " + (message.error ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-900")}>{message.text}</p>}
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={({ active }) => { setDraggingId(String(active.id)); setMessage(undefined); }}
      onDragEnd={endDrag}
      onDragCancel={() => setDraggingId(undefined)}
    >
      <div className="flex min-h-64 gap-3 overflow-x-auto pb-3" aria-label="Kanban do pipeline">
        {[...columns].map(([stage, group]) =>
          <KanbanColumn key={stage} stage={stage} rows={group} today={today} onOpen={onOpen}
            onMove={(row) => { setMessage(undefined); setMove({ row }); }}
            draggedStage={dragged?.stage} savingId={savingId} />)}
      </div>
      <DragOverlay dropAnimation={null}>
        {dragged && <div aria-hidden className="share-card w-60 rounded-lg p-3 text-sm shadow-xl ring-2 ring-emerald-600"><CardContents row={dragged} today={today} /></div>}
      </DragOverlay>
    </DndContext>
    {move && <MoveDialog move={move} busy={Boolean(savingId)} error={message?.error ? message.text : undefined}
      onClose={() => { setMove(undefined); setMessage(undefined); }} onSave={saveMove} />}
  </>;
}

function KanbanColumn({ stage, rows, today, onOpen, onMove, draggedStage, savingId }: {
  stage: string; rows: CrmRow[]; today: string; onOpen: (id: string) => void;
  onMove: (row: CrmRow) => void; draggedStage?: string; savingId?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "stage:" + stage, data: { stage },
    disabled: stage === draggedStage || !isCrmStage(stage) || Boolean(savingId),
  });
  return <section ref={setNodeRef} aria-label={stage} className={"w-64 shrink-0 rounded-xl border p-3 transition-colors " + (isOver ? "border-emerald-600 bg-emerald-100 ring-1 ring-inset ring-emerald-600" : "border-[var(--share-line)] bg-[#edf3ed]")}>
    <h2 className="text-sm font-semibold">{stage} <span className="text-zinc-600">· {rows.length}</span></h2>
    <p className="my-2 text-xs text-zinc-600">{brl(rows.reduce((sum, row) => sum + (row.proposedValue ?? 0), 0))}</p>
    <div className="grid max-h-[34rem] gap-2 overflow-y-auto">
      {rows.map((row) => <KanbanCard key={row.id} row={row} today={today} onOpen={onOpen} onMove={onMove}
        disabled={Boolean(savingId)} saving={row.id === savingId} />)}
    </div>
  </section>;
}

function KanbanCard({ row, today, onOpen, onMove, disabled, saving }: {
  row: CrmRow; today: string; onOpen: (id: string) => void; onMove: (row: CrmRow) => void; disabled: boolean; saving: boolean;
}) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: row.id, disabled });
  return <article ref={setNodeRef} {...listeners}
    className={"share-card flex cursor-grab items-start rounded-lg text-sm hover:border-emerald-600 active:cursor-grabbing " + (isDragging ? "opacity-35" : "")}>
    <button type="button" onClick={() => onOpen(row.id)} disabled={saving} className="min-w-0 flex-1 cursor-inherit rounded-l-lg p-3 text-left">
      <CardContents row={row} today={today} />
    </button>
    <button type="button" onClick={() => onMove(row)} disabled={disabled} title="Mover card" aria-label={"Mover " + row.name}
      className="mr-1 mt-1 touch-none cursor-grab rounded-md p-2 text-zinc-600 hover:bg-emerald-50 active:cursor-grabbing disabled:cursor-wait">
      <GripVertical aria-hidden className="h-4 w-4" />
    </button>
  </article>;
}

function CardContents({ row, today }: { row: CrmRow; today: string }) {
  return <span className="grid gap-2">
    <strong className="break-words">{row.name}</strong>
    <span className="text-xs text-zinc-600">{[row.owner, row.temperature, row.nextActionDate && dateLabel(row.nextActionDate)].filter(Boolean).join(" · ")}</span>
    <span><CrmAlertLabel row={row} today={today} /></span>
  </span>;
}

function MoveDialog({ move, busy, error, onClose, onSave }: {
  move: Move; busy: boolean; error?: string; onClose: () => void;
  onSave: (row: CrmRow, stage: CrmStage, action?: NextAction) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [stage, setStage] = useState<CrmStage | "">(move.stage ?? "");
  const { row } = move;
  const requiresAction = Boolean(stage && needsNextAction(row, stage));

  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stage || busy) return;
    const fields = new FormData(event.currentTarget);
    const action = requiresAction ? { nextAction: String(fields.get("nextAction")).trim(), nextActionDate: String(fields.get("nextActionDate")) } : undefined;
    void onSave(row, stage, action);
  }

  return <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} aria-labelledby="crm-move-title"
    className="m-auto w-[min(92vw,28rem)] rounded-xl bg-white p-5 text-[var(--share-ink)] shadow-xl backdrop:bg-black/40">
    <div className="flex items-center justify-between gap-3">
      <h2 id="crm-move-title" className="text-xl font-semibold">Mover oportunidade</h2>
      <button type="button" onClick={onClose} disabled={busy} aria-label="Fechar" className="rounded-lg p-2 hover:bg-zinc-100"><X className="h-5 w-5" /></button>
    </div>
    <p className="mt-1 text-sm text-zinc-600">{row.name} · {row.stage}</p>
    <form onSubmit={submit} className="mt-4 grid gap-3">
      <label className="grid gap-1 text-xs font-semibold">Nova etapa
        <select className={crmControl} value={stage} onChange={(event) => { const value = event.target.value; setStage(isCrmStage(value) ? value : ""); }} required disabled={busy}>
          <option value="">Selecionar etapa</option>
          {stages.filter((item) => item !== row.stage).map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      {requiresAction && <>
        <p className="text-sm text-zinc-600">Para mover para uma etapa ativa, informe a próxima ação e a data.</p>
        <label className="grid gap-1 text-xs font-semibold">Próxima ação<input className={crmControl} name="nextAction" defaultValue={row.nextAction ?? ""} required maxLength={4000} disabled={busy} /></label>
        <label className="grid gap-1 text-xs font-semibold">Data da próxima ação<input className={crmControl} name="nextActionDate" type="date" defaultValue={row.nextActionDate ?? ""} required disabled={busy} /></label>
      </>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={!stage || busy} className={crmButton}>{busy ? "Movendo…" : "Mover oportunidade"}</button>
    </form>
  </dialog>;
}
