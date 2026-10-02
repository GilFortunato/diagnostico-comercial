"use client";

import { useEffect, useMemo, useState } from "react";
import { ParticipantLinkedinCell } from "./ParticipantLinkedinCell";
import { CalendarDays, Check, Clipboard, ExternalLink, FileSpreadsheet, LoaderCircle, MessageCircle, Pencil, Plus, Search, ShieldCheck, Trash2, UsersRound, X } from "lucide-react";
import type { HumanshipClassification, HumanshipDecision, HumanshipEvent, HumanshipParticipant, HumanshipRestrictionSnapshot, HumanshipRoleRule, HumanshipRoleRuleDecision } from "@/lib/humanship/types";
import { buildWhatsAppLink } from "@/lib/humanship/whatsapp";

type Pending = "load" | "create" | "rename" | "delete" | "upload" | "search" | "decision" | "role" | "copy" | "restrictions" | "apply_restrictions" | null;
type Tab = "source" | "results" | "restrictions";
type Filter = "all" | HumanshipClassification | "approved" | "rejected";
type RestrictionConfig = HumanshipRestrictionSnapshot & { updatedByName?: string; createdAt?: string };

export function HumanshipR1ShipExperience({ accountName, canManageHumanship = false }: { accountName: string; canManageHumanship?: boolean }) {
  const [events, setEvents] = useState<HumanshipEvent[]>([]);
  const [event, setEvent] = useState<HumanshipEvent | null>(null);
  const [eventName, setEventName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [draftEventName, setDraftEventName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [tab, setTab] = useState<Tab>("source");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<HumanshipParticipant | null>(null);
  const [pending, setPending] = useState<Pending>("load");
  const [error, setError] = useState<string | null>(null);
  const [workspaceRestrictions, setWorkspaceRestrictions] = useState<RestrictionConfig | null>(null);

  async function loadEvents(selectId?: string) {
    const response = await fetch("/api/humanship/events", { cache: "no-store" });
    const body = await response.json() as { events?: HumanshipEvent[]; error?: string };
    if (!response.ok) throw new Error(body.error || "Não foi possível carregar os eventos.");
    const next = body.events || [];
    setEvents(next);
    const target = selectId || event?.id || next[0]?.id;
    if (target) await loadEvent(target);
    else setEvent(null);
  }

  async function loadEvent(id: string, resetTab = false) {
    const response = await fetch(`/api/humanship/events/${id}`, { cache: "no-store" });
    const body = await response.json() as { event?: HumanshipEvent; error?: string };
    if (!response.ok || !body.event) throw new Error(body.error || "Não foi possível abrir o evento.");
    setEvent(body.event);
    setDraftEventName(body.event.name);
    if (resetTab) setTab(body.event.sourceRowCount > 0 ? "results" : "source");
    setSelected((current) => current ? body.event?.participants.find((item) => item.id === current.id) || null : null);
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/humanship/events", { cache: "no-store" })
      .then(async (response) => ({ response, body: await response.json() as { events?: HumanshipEvent[]; error?: string } }))
      .then(async ({ response, body }) => {
        if (cancelled) return;
        if (!response.ok) throw new Error(body.error || "Não foi possível carregar os eventos.");
        const next = body.events || [];
        setEvents(next);
        if (next[0]?.id) await loadEvent(next[0].id, true);
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Não foi possível carregar os eventos."); })
      .finally(() => { if (!cancelled) setPending(null); });
    return () => { cancelled = true; };
  }, []);

  async function createEvent() {
    if (eventName.trim().length < 2) return;
    setPending("create"); setError(null);
    try {
      const response = await fetch("/api/humanship/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: eventName }) });
      const body = await response.json() as { event?: HumanshipEvent; error?: string };
      if (!response.ok || !body.event) throw new Error(body.error || "Não foi possível criar o evento.");
      setEventName(""); setEvent(body.event); setTab("source");
      await loadEvents(body.event.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível criar o evento."); }
    finally { setPending(null); }
  }

  async function renameEvent() {
    if (!event || draftEventName.trim().length < 2) return;
    setPending("rename"); setError(null);
    try {
      const response = await fetch(`/api/humanship/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draftEventName }),
      });
      const body = await response.json() as { event?: HumanshipEvent; error?: string };
      if (!response.ok || !body.event) throw new Error(body.error || "Não foi possível renomear o evento.");
      setEvent(body.event);
      setEditingName(false);
      await loadEvents(body.event.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível renomear o evento.");
    } finally {
      setPending(null);
    }
  }

  async function deleteEvent() {
    if (!event || !canManageHumanship) return;
    if (!window.confirm(`Excluir definitivamente o evento "${event.name}" e todos os participantes vinculados? Essa ação não pode ser desfeita.`)) return;
    setPending("delete"); setError(null);
    try {
      const response = await fetch(`/api/humanship/events/${event.id}`, { method: "DELETE" });
      const body = await response.json() as { deleted?: boolean; error?: string };
      if (!response.ok || !body.deleted) throw new Error(body.error || "Não foi possível excluir o evento.");
      setSelected(null);
      setEvent(null);
      await loadEvents();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível excluir o evento.");
    } finally {
      setPending(null);
    }
  }

  function chooseSpreadsheet(nextFile: File | null) {
    setError(null);
    if (!nextFile) { setFile(null); return; }
    const lower = nextFile.name.toLocaleLowerCase("pt-BR");
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".csv")) {
      setFile(null); setError("Formato não suportado. Escolha um arquivo .xlsx ou .csv."); return;
    }
    if (nextFile.size > 12 * 1024 * 1024) {
      setFile(null); setError("O arquivo excede o limite de 12 MB."); return;
    }
    setFile(nextFile);
  }

  async function uploadExcel() {
    if (!event) { setError("Crie ou selecione um evento antes de importar a planilha."); return; }
    if (!file) { setError("Escolha uma planilha .xlsx ou .csv antes de importar."); return; }
    setPending("upload"); setError(null);
    try {
      const form = new FormData(); form.append("file", file, file.name);
      const response = await fetch(`/api/humanship/events/${event.id}/import`, { method: "POST", body: form });
      const contentType = response.headers.get("content-type") || "";
      const body = contentType.includes("application/json")
        ? await response.json() as { event?: HumanshipEvent; error?: string }
        : { error: await response.text() };
      if (!response.ok || !body.event) throw new Error(body.error || "Não foi possível importar a planilha.");
      setEvent(body.event); setFile(null); setTab("results"); await loadEvents(body.event.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível importar a planilha."); }
    finally { setPending(null); }
  }

  async function searchLinkedin(rescan = false) {
    if (!event) return;
    setPending("search"); setError(null);
    try {
      const response = await fetch(`/api/humanship/events/${event.id}/search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rescan }) });
      const body = await response.json() as { event?: HumanshipEvent; error?: string };
      if (!response.ok || !body.event) throw new Error(body.error || "Não foi possível pesquisar os perfis.");
      setEvent(body.event); await loadEvents(body.event.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível pesquisar os perfis."); }
    finally { setPending(null); }
  }

  async function decide(participant: HumanshipParticipant, decision: HumanshipDecision) {
    setPending("decision"); setError(null);
    try {
      const response = await fetch(`/api/humanship/participants/${participant.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "decision", decision }) });
      if (!response.ok) throw new Error("Não foi possível salvar a decisão.");
      if (event) await loadEvent(event.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar a decisão."); }
    finally { setPending(null); }
  }

  async function decideRole(participant: HumanshipParticipant, decision: HumanshipRoleRuleDecision) {
    if (!event) return;
    setPending("role"); setError(null);
    try {
      const response = await fetch(`/api/humanship/participants/${participant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "role_rule", decision }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Não foi possível salvar a regra do cargo.");
      await loadEvent(event.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar a regra do cargo."); }
    finally { setPending(null); }
  }

  async function copyMessage(participant: HumanshipParticipant, message: 1 | 2) {
    if (!event) return;
    const text = message === 1 ? buildMessage1(accountName, event, participant) : buildMessage2(accountName, event, participant);
    setPending("copy"); setError(null);
    try {
      await navigator.clipboard.writeText(text);
      await fetch(`/api/humanship/participants/${participant.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "copied", message }) });
      await loadEvent(event.id);
    } catch { setError("Não foi possível copiar a mensagem automaticamente. Selecione o texto e copie manualmente."); }
    finally { setPending(null); }
  }

  async function openRestrictions() {
    setTab("restrictions");
    if (workspaceRestrictions) return;
    setPending("restrictions");
    setError(null);
    try {
      const response = await fetch("/api/humanship/restrictions", { cache: "no-store" });
      const body = await response.json() as { restrictions?: RestrictionConfig; error?: string };
      if (!response.ok || !body.restrictions) throw new Error(body.error || "Não foi possível carregar as restrições.");
      setWorkspaceRestrictions(body.restrictions);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as restrições.");
    } finally {
      setPending(null);
    }
  }

  async function saveRestrictions(next: RestrictionConfig) {
    if (!canManageHumanship) return;
    setPending("restrictions");
    setError(null);
    try {
      const response = await fetch("/api/humanship/restrictions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyGroups: next.companyGroups, roleReferences: next.roleReferences }),
      });
      const body = await response.json() as { restrictions?: RestrictionConfig; error?: string };
      if (!response.ok || !body.restrictions) throw new Error(body.error || "Não foi possível salvar as restrições.");
      setWorkspaceRestrictions(body.restrictions);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar as restrições.");
    } finally {
      setPending(null);
    }
  }

  async function applyRestrictionsToEvent() {
    if (!event || !canManageHumanship) return;
    setPending("apply_restrictions");
    setError(null);
    try {
      const response = await fetch(`/api/humanship/events/${event.id}/restrictions`, { method: "POST" });
      const body = await response.json() as { event?: HumanshipEvent; restrictions?: RestrictionConfig; error?: string };
      if (!response.ok || !body.event) throw new Error(body.error || "Não foi possível aplicar as restrições ao evento.");
      setEvent(body.event);
      if (body.restrictions) setWorkspaceRestrictions(body.restrictions);
      await loadEvents(body.event.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível aplicar as restrições ao evento.");
    } finally {
      setPending(null);
    }
  }

  const counts = useMemo(() => {
    const list = event?.participants || [];
    return {
      all: list.length,
      eligible: list.filter((item) => item.classification === "eligible").length,
      validate: list.filter((item) => item.classification === "validate").length,
      possible_rejected: list.filter((item) => item.classification === "possible_rejected").length,
      approved: list.filter((item) => item.humanDecision === "approved").length,
      rejected: list.filter((item) => item.humanDecision === "rejected").length,
    };
  }, [event]);

  const visible = useMemo(() => {
    const list = event?.participants || [];
    if (filter === "all") return list;
    if (filter === "approved" || filter === "rejected") return list.filter((item) => item.humanDecision === filter);
    return list.filter((item) => item.classification === filter);
  }, [event, filter]);

  return (
    <main className="min-h-screen bg-[#eef4e9] text-[var(--share-ink)]">
      <div className="w-full px-4 py-5 xl:px-6">
        <header className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--share-green-800)]">Humanship</p>
          <h1 className="mt-1 text-3xl font-semibold text-[var(--share-green-950)]">R1 Ship</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Selecione um evento para importar a base, trabalhar os participantes e acompanhar as regras aplicadas.
          </p>
        </header>

        {error ? <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</p> : null}

        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="self-start rounded-2xl border border-[#cbdcc9] bg-[#003f2c] p-4 text-white shadow-sm lg:sticky lg:top-[76px] lg:min-h-[calc(100vh-96px)]">
            <div className="px-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d8ef55]">Workspace Humanship</p>
              <h2 className="mt-1 text-lg font-semibold">Eventos</h2>
              <p className="mt-1 text-xs leading-5 text-white/55">Cada evento mantém sua própria base de participantes e histórico operacional.</p>
            </div>

            <div className="mt-4 max-h-[48vh] space-y-2 overflow-y-auto pr-1">
              {events.map((item) => {
                const active = item.id === event?.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setPending("load");
                      setSelected(null);
                      loadEvent(item.id, true)
                        .catch((cause) => setError(cause instanceof Error ? cause.message : "Erro ao abrir evento."))
                        .finally(() => setPending(null));
                    }}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${active ? "border-[#dcef55] bg-[#dcef55] text-[#173b28]" : "border-white/10 bg-white/5 text-white hover:bg-white/10"}`}
                  >
                    <div className="flex items-start gap-2">
                      <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <strong className="block truncate text-sm">{item.name}</strong>
                        <span className={`mt-1 block text-[11px] ${active ? "text-[#173b28]/65" : "text-white/50"}`}>
                          {item.sourceRowCount} participante{item.sourceRowCount === 1 ? "" : "s"} · {formatCompactDate(item.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {!events.length ? <p className="rounded-xl border border-dashed border-white/15 px-3 py-5 text-center text-xs text-white/45">Nenhum evento criado ainda.</p> : null}
            </div>

            <div className="my-5 h-px bg-white/10" />

            <div className="px-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">Novo evento</p>
              <input
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Nome do evento"
                className="mt-2 h-10 w-full rounded-xl border border-white/15 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#dcef55]"
              />
              <button
                type="button"
                onClick={createEvent}
                disabled={pending === "create" || eventName.trim().length < 2}
                className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white px-3 text-sm font-bold text-[#003f2c] disabled:opacity-40"
              >
                {pending === "create" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Criar evento
              </button>
            </div>
          </aside>

          <section className="min-w-0">
            {pending === "load" ? (
              <div className="rounded-3xl border border-[#cbdcc9] bg-white p-8">
                <p className="inline-flex items-center gap-2 text-sm text-zinc-600"><LoaderCircle className="h-4 w-4 animate-spin" /> Carregando R1 Ship...</p>
              </div>
            ) : null}

            {event ? (
              <>
                <article className="rounded-3xl border border-[#cbdcc9] bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--share-green-800)]">Evento atual</p>
                      {editingName ? (
                        <div className="mt-2 flex max-w-2xl flex-wrap gap-2">
                          <input
                            autoFocus
                            value={draftEventName}
                            onChange={(e) => setDraftEventName(e.target.value)}
                            className="h-11 min-w-[260px] flex-1 rounded-xl border border-[#b8ceb5] px-4 text-lg font-semibold text-[#003f2c] outline-none focus:border-[#006142]"
                          />
                          <button
                            type="button"
                            onClick={() => void renameEvent()}
                            disabled={pending === "rename" || draftEventName.trim().length < 2}
                            className="rounded-xl bg-[#006142] px-4 text-sm font-bold text-white disabled:opacity-50"
                          >
                            {pending === "rename" ? "Salvando..." : "Salvar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingName(false); setDraftEventName(event.name); }}
                            className="rounded-xl border border-[#d6e2d4] px-4 text-sm font-semibold text-zinc-600"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="mt-1 flex items-center gap-2">
                          <h2 className="truncate text-2xl font-semibold text-[var(--share-green-950)]">{event.name}</h2>
                          <button
                            type="button"
                            onClick={() => { setDraftEventName(event.name); setEditingName(true); }}
                            className="rounded-lg p-2 text-[#006142] hover:bg-[#eef6ea]"
                            aria-label="Editar nome do evento"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-500">
                        <span><strong className="text-[#003f2c]">{event.sourceRowCount}</strong> participantes</span>
                        <span>Restrições {event.restrictionVersion}</span>
                        {event.sourceName ? <span>Base: {event.sourceName}</span> : null}
                      </div>
                    </div>

                    {canManageHumanship ? (
                      <button
                        type="button"
                        onClick={() => void deleteEvent()}
                        disabled={pending === "delete"}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {pending === "delete" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Excluir evento
                      </button>
                    ) : null}
                  </div>
                </article>

                <nav className="mt-4 flex flex-wrap gap-2 rounded-2xl border border-[#cbdcc9] bg-white p-2 shadow-sm">
                  <button type="button" onClick={() => setTab("results")} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${tab === "results" ? "bg-[#003f2c] text-white" : "text-[#006142] hover:bg-[#eef6ea]"}`}>
                    <UsersRound className="h-4 w-4" /> Participantes
                  </button>
                  <button type="button" onClick={() => setTab("source")} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${tab === "source" ? "bg-[#003f2c] text-white" : "text-[#006142] hover:bg-[#eef6ea]"}`}>
                    <FileSpreadsheet className="h-4 w-4" /> Importar base
                  </button>
                  <button type="button" onClick={() => void openRestrictions()} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${tab === "restrictions" ? "bg-[#003f2c] text-white" : "text-[#006142] hover:bg-[#eef6ea]"}`}>
                    <ShieldCheck className="h-4 w-4" /> Restrições aplicadas
                  </button>
                </nav>

                <div className="mt-5">
                  {tab === "source" ? <SourceTab event={event} file={file} onFile={chooseSpreadsheet} pending={pending} onUpload={uploadExcel} /> : null}
                  {tab === "results" ? <ResultsTab event={event} visible={visible} counts={counts} filter={filter} setFilter={setFilter} pending={pending} onSearch={searchLinkedin} onDecision={decide} onRoleRule={decideRole} onMessages={setSelected} onLinkedinSaved={() => loadEvent(event.id)} /> : null}
                  {tab === "restrictions" ? <RestrictionsTab key={`${event.id}:${event.restrictionVersion}:${workspaceRestrictions?.version ?? "snapshot"}`} event={event} current={workspaceRestrictions} canManage={canManageHumanship} pending={pending} onSave={saveRestrictions} onApply={applyRestrictionsToEvent} /> : null}
                </div>
              </>
            ) : pending !== "load" ? (
              <div className="rounded-3xl border border-dashed border-[#b9ceb6] bg-white/65 px-6 py-14 text-center">
                <p className="text-sm font-semibold text-[#003f2c]">Nenhum evento selecionado.</p>
                <p className="mt-1 text-sm text-zinc-500">Crie um evento na lateral. Depois dele criado, você poderá importar a base e trabalhar os participantes.</p>
              </div>
            ) : null}
          </section>
        </div>

        {selected && event ? <MessageDrawer participant={selected} event={event} accountName={accountName} pending={pending === "copy"} onClose={() => setSelected(null)} onCopy={copyMessage} /> : null}
      </div>
    </main>
  );}

function formatCompactDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(value));
}

function SourceTab({ event, file, onFile, pending, onUpload }: { event: HumanshipEvent; file: File | null; onFile: (v: File | null) => void; pending: Pending; onUpload: () => void }) {
  return <section>
    <article className="rounded-3xl border border-[#cbdcc9] bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="rounded-md bg-[#edf7eb] p-2 text-[var(--share-green-900)]"><FileSpreadsheet className="h-5 w-5" /></span>
        <div>
          <h3 className="font-semibold text-[var(--share-green-950)]">Importar planilha</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-600">Escolha um arquivo .xlsx ou .csv de até 12 MB para alimentar os participantes deste evento.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input id="humanship-spreadsheet-upload" type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={(e) => onFile(e.currentTarget.files?.[0] || null)} className="sr-only" />
        <label htmlFor="humanship-spreadsheet-upload" className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[var(--share-green-800)] bg-white px-4 py-2 text-sm font-semibold text-[var(--share-green-900)] hover:bg-[#fbfdf8]"><FileSpreadsheet className="h-4 w-4" />Escolher planilha</label>
        <span className="min-w-0 flex-1 truncate text-sm text-zinc-600">{file ? file.name : "Nenhum arquivo selecionado"}</span>
      </div>
      <button type="button" onClick={onUpload} disabled={pending === "upload" || !file} className="mt-4 inline-flex items-center gap-2 rounded-md bg-[var(--share-green-950)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">{pending === "upload" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}{pending === "upload" ? "Importando..." : "Importar planilha"}</button>
      {event.sourceKind === "excel" ? <p className="mt-4 rounded-md bg-[#fbfdf8] p-3 text-sm text-zinc-600"><strong>Arquivo atual:</strong> {event.sourceName}<br />Importado: {formatDate(event.lastSyncedAt)}</p> : null}
    </article>
  </section>;
}

function ResultsTab({ event, visible, counts, filter, setFilter, pending, onSearch, onDecision, onRoleRule, onMessages, onLinkedinSaved }: {
  event: HumanshipEvent;
  visible: HumanshipParticipant[];
  counts: Record<string, number>;
  filter: Filter;
  setFilter: (v: Filter) => void;
  pending: Pending;
  onSearch: (rescan?: boolean) => void;
  onDecision: (p: HumanshipParticipant, d: HumanshipDecision) => void;
  onRoleRule: (p: HumanshipParticipant, d: HumanshipRoleRuleDecision) => void;
  onMessages: (p: HumanshipParticipant) => void;
  onLinkedinSaved: () => Promise<void>;
}) {
  const hasSearchResults = event.participants.some((item) => item.searchStatus === "found" || item.searchStatus === "probable");
  return <section className="mt-5 rounded-lg border border-[var(--share-line)] bg-white">
    <div className="flex flex-wrap items-end justify-between gap-4 p-5"><div><p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Resultado operacional</p><h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">Participantes e validação</h2><p className="mt-1 text-sm text-zinc-600">Cargos semelhantes podem ser ensinados ao Humanship: ao aceitar ou reprovar um cargo, essa decisão passa a valer nas próximas análises.</p></div><div className="flex gap-2"><button type="button" onClick={() => onSearch(false)} disabled={pending === "search" || !event.participants.length} className="inline-flex items-center gap-2 rounded-md bg-[var(--share-green-950)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending === "search" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{pending === "search" ? "Pesquisando LinkedIn" : "Encontrar no LinkedIn"}</button>{hasSearchResults ? <button type="button" onClick={() => onSearch(true)} disabled={pending === "search"} className="rounded-md border border-[var(--share-line)] px-3 py-2 text-sm">Refazer busca</button> : null}</div></div>
    <div className="flex flex-wrap gap-2 border-y border-[var(--share-line)] bg-[#fbfdf8] p-4">{(["all", "eligible", "validate", "possible_rejected", "approved", "rejected"] as Filter[]).map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === item ? "bg-[var(--share-green-950)] text-white" : "border border-[var(--share-line)] bg-white text-zinc-600"}`}>{filterLabel(item)} · {counts[item] || 0}</button>)}</div>
    <div className="overflow-x-auto"><table className="w-full min-w-[1280px] text-left text-sm"><thead className="text-xs uppercase text-[var(--share-green-800)]"><tr><th className="p-3">Pessoa</th><th className="p-3">Empresa</th><th className="p-3">Cargo</th><th className="p-3">LinkedIn</th><th className="p-3">Classificação</th><th className="p-3">Motivo</th><th className="p-3">Decisão humana</th><th className="p-3">Ações</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id} className="border-t border-[var(--share-line)] align-top">
      <td className="p-3"><strong>{item.fullName}</strong><p className="mt-1 text-xs text-zinc-500">{item.email || "E-mail não informado"}</p><p className="mt-1 text-xs text-zinc-500">{item.phone || "Celular não informado"}</p></td>
      <td className="p-3">{item.linkedinCompany || item.company || "Não informada"}{item.companyRestriction ? <p className="mt-1 text-xs font-semibold text-red-700">Restrição identificada</p> : null}</td>
      <RoleCell participant={item} event={event} pending={pending === "role"} onRoleRule={onRoleRule} />
      <ParticipantLinkedinCell participant={item} disabled={pending !== null} onSaved={onLinkedinSaved} />
      <td className="p-3"><StatusBadge value={item.classification} /></td>
      <td className="max-w-[320px] p-3 text-xs leading-5 text-zinc-600">{item.classificationReason || "Aguardando análise."}</td>
      <td className="p-3"><DecisionBadge value={item.humanDecision} />{item.decisionByName ? <p className="mt-1 text-xs text-zinc-500">por {item.decisionByName}</p> : null}</td>
      <td className="p-3"><div className="flex flex-wrap gap-1.5"><button type="button" onClick={() => onDecision(item, "approved")} disabled={pending === "decision"} className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-800">Aprovar</button><button type="button" onClick={() => onDecision(item, "review")} disabled={pending === "decision"} className="rounded-md border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-800">Validar</button><button type="button" onClick={() => onDecision(item, "rejected")} disabled={pending === "decision"} className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-800">Reprovar</button><button type="button" onClick={() => onMessages(item)} className="rounded-md bg-[var(--share-green-950)] px-2 py-1 text-xs font-semibold text-white">Mensagens</button></div></td>
    </tr>)}</tbody></table>{!visible.length ? <p className="p-8 text-center text-sm text-zinc-500">Nenhuma pessoa neste filtro.</p> : null}</div>
  </section>;
}

function RoleCell({ participant, event, pending, onRoleRule }: { participant: HumanshipParticipant; event: HumanshipEvent; pending: boolean; onRoleRule: (p: HumanshipParticipant, d: HumanshipRoleRuleDecision) => void }) {
  const title = participant.linkedinTitle || participant.jobTitle || "";
  const rule = findRoleRule(event.roleRules, title);
  const tone = roleTone(participant, rule);
  const learnable = Boolean(title) && (Boolean(rule) || participant.roleScore == null || participant.roleScore < 100);
  return <td className="p-3" data-role-tone={tone}>
    <div className="font-bold">{title || "Não informado"}</div>
    {participant.roleReference ? <p className="mt-1 text-xs">Próximo de: {participant.roleReference}{participant.roleScore != null ? ` · ${participant.roleScore}%` : ""}</p> : null}
    {rule ? <p className={`mt-1 text-[11px] font-semibold ${rule.decision === "accepted" ? "text-emerald-800" : "text-red-800"}`}>{rule.decision === "accepted" ? "Cargo aprendido como aceito" : "Cargo aprendido como reprovado"}</p> : null}
    {learnable ? <div className="mt-2 flex flex-wrap gap-1.5">
      <button type="button" disabled={pending} onClick={() => onRoleRule(participant, "accepted")} className={`rounded-md border px-2 py-1 text-[11px] font-semibold disabled:opacity-50 ${rule?.decision === "accepted" ? "border-emerald-800 bg-emerald-800 text-white" : "border-emerald-300 bg-white text-emerald-800"}`}>Aceitar cargo</button>
      <button type="button" disabled={pending} onClick={() => onRoleRule(participant, "rejected")} className={`rounded-md border px-2 py-1 text-[11px] font-semibold disabled:opacity-50 ${rule?.decision === "rejected" ? "border-red-800 bg-red-800 text-white" : "border-red-300 bg-white text-red-800"}`}>Reprovar cargo</button>
    </div> : null}
  </td>;
}

function RestrictionsTab({
  event,
  current,
  canManage,
  pending,
  onSave,
  onApply,
}: {
  event: HumanshipEvent;
  current: RestrictionConfig | null;
  canManage: boolean;
  pending: Pending;
  onSave: (next: RestrictionConfig) => Promise<void>;
  onApply: () => Promise<void>;
}) {
  const eventSnapshot = event.restrictionSnapshot;
  const base: RestrictionConfig = current || eventSnapshot || {
    version: event.restrictionVersion,
    companyGroups: [],
    roleReferences: [],
  };
  const [draft, setDraft] = useState<RestrictionConfig>(base);

  const accepted = (event.roleRules ?? []).filter((rule) => rule.decision === "accepted");
  const rejected = (event.roleRules ?? []).filter((rule) => rule.decision === "rejected");
  const saving = pending === "restrictions";
  const applying = pending === "apply_restrictions";
  const currentVersion = current?.version || base.version;
  const eventUsesCurrent = currentVersion === event.restrictionVersion;

  function updateGroup(index: number, patch: Partial<RestrictionConfig["companyGroups"][number]>) {
    setDraft((value) => ({
      ...value,
      companyGroups: value.companyGroups.map((group, position) => position === index ? { ...group, ...patch } : group),
    }));
  }

  return (
    <section className="grid gap-5">
      <article className="rounded-2xl border border-[var(--share-line)] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-[#edf7eb] p-2 text-[var(--share-green-900)]"><ShieldCheck className="h-5 w-5" /></span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#006142]">Restrições do Humanship</p>
              <h2 className="mt-1 text-xl font-semibold text-[#003f2c]">Regras versionadas</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                Cada evento mantém a versão usada na análise. Alterar a configuração cria uma nova versão e não muda eventos antigos automaticamente.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-[#eef6e8] px-3 py-1.5 font-bold text-[#52712b]">Evento: {event.restrictionVersion}</span>
            <span className="rounded-full bg-zinc-100 px-3 py-1.5 font-bold text-zinc-600">Atual: {currentVersion}</span>
          </div>
        </div>

        {canManage ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onSave(draft)}
              disabled={saving || !draft.companyGroups.length || !draft.roleReferences.length}
              className="rounded-xl bg-[#006142] px-4 py-2 text-sm font-bold text-white disabled:opacity-45"
            >
              {saving ? "Salvando nova versão..." : "Salvar nova versão"}
            </button>
            <button
              type="button"
              onClick={() => void onApply()}
              disabled={applying || eventUsesCurrent}
              className="rounded-xl border border-[#b8ceb5] px-4 py-2 text-sm font-bold text-[#006142] disabled:opacity-45"
            >
              {applying ? "Aplicando..." : eventUsesCurrent ? "Evento já usa a versão atual" : "Aplicar versão atual ao evento"}
            </button>
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-[#dce6d9] bg-[#f8fbf6] px-4 py-3 text-sm text-zinc-600">
            Somente usuários com permissão <strong>ADM Humanship</strong> podem alterar as restrições. A equipe continua visualizando a versão aplicada ao evento.
          </p>
        )}
      </article>

      <article className="rounded-2xl border border-[var(--share-line)] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#006142]">Restrição 01</p>
            <h3 className="mt-1 text-xl font-semibold text-[#003f2c]">Empresas e grupos restritos</h3>
          </div>
          {canManage ? (
            <button
              type="button"
              onClick={() => setDraft((value) => ({
                ...value,
                companyGroups: [...value.companyGroups, { reference: "", category: "", companies: [] }],
              }))}
              className="inline-flex items-center gap-2 rounded-xl border border-[#b8ceb5] px-3 py-2 text-xs font-bold text-[#006142]"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar grupo
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {draft.companyGroups.map((group, index) => (
            <div key={`${index}-${group.reference}-${group.category}`} className="rounded-xl border border-[#dce6d9] bg-[#fbfdf9] p-4">
              {canManage ? (
                <>
                  <div className="flex items-start gap-2">
                    <div className="grid min-w-0 flex-1 gap-2">
                      <input
                        value={group.reference}
                        onChange={(e) => updateGroup(index, { reference: e.target.value })}
                        placeholder="Referência / patrocinador"
                        className="h-10 rounded-lg border border-[#cbdcc9] bg-white px-3 text-sm font-semibold text-[#003f2c]"
                      />
                      <input
                        value={group.category}
                        onChange={(e) => updateGroup(index, { category: e.target.value })}
                        placeholder="Categoria da restrição"
                        className="h-10 rounded-lg border border-[#cbdcc9] bg-white px-3 text-sm text-zinc-700"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setDraft((value) => ({
                        ...value,
                        companyGroups: value.companyGroups.filter((_, position) => position !== index),
                      }))}
                      className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                      aria-label="Remover grupo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={group.companies.join("\n")}
                    onChange={(e) => updateGroup(index, {
                      companies: e.target.value.split(/\n|,/).map((item) => item.trim()).filter(Boolean),
                    })}
                    placeholder="Uma empresa por linha"
                    className="mt-3 w-full rounded-lg border border-[#cbdcc9] bg-white p-3 text-sm text-zinc-700"
                  />
                </>
              ) : (
                <>
                  <p className="font-semibold text-[#003f2c]">{group.reference}</p>
                  <p className="mt-1 text-xs text-zinc-500">{group.category}</p>
                  <p className="mt-3 text-sm leading-6 text-zinc-700">{group.companies.join(" · ")}</p>
                </>
              )}
            </div>
          ))}
          {!draft.companyGroups.length ? <p className="text-sm text-zinc-500">Nenhum grupo restrito cadastrado.</p> : null}
        </div>
      </article>

      <article className="rounded-2xl border border-[var(--share-line)] bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#006142]">Restrição 02</p>
        <h3 className="mt-1 text-xl font-semibold text-[#003f2c]">Cargos executivos de RH e Pessoas</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Esta lista é usada como referência de senioridade e proximidade. Os cargos aprendidos manualmente continuam registrados separadamente.
        </p>
        {canManage ? (
          <textarea
            rows={10}
            value={draft.roleReferences.join("\n")}
            onChange={(e) => setDraft((value) => ({
              ...value,
              roleReferences: e.target.value.split("\n").map((item) => item.trim()).filter(Boolean),
            }))}
            className="mt-4 w-full rounded-xl border border-[#cbdcc9] bg-[#fbfdf9] p-4 text-sm leading-6 text-zinc-700"
            placeholder="Um cargo por linha"
          />
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {draft.roleReferences.map((role) => (
              <span key={role} className="rounded-full border border-[var(--share-line)] bg-[#fbfdf8] px-3 py-1.5 text-xs font-medium text-zinc-700">{role}</span>
            ))}
          </div>
        )}
      </article>

      <div className="grid gap-5 lg:grid-cols-2">
        <RoleRuleList title={`Cargos aceitos · ${accepted.length}`} rules={accepted} empty="Nenhum cargo adicional foi aprovado ainda." tone="accepted" />
        <RoleRuleList title={`Cargos reprovados · ${rejected.length}`} rules={rejected} empty="Nenhum cargo adicional foi reprovado ainda." tone="rejected" />
      </div>
    </section>
  );
}

function RoleRuleList({ title, rules, empty, tone }: { title: string; rules: HumanshipRoleRule[]; empty: string; tone: HumanshipRoleRuleDecision }) {
  const style = tone === "accepted" ? "border-emerald-200 bg-emerald-50/50 text-emerald-950" : "border-red-200 bg-red-50/50 text-red-950";
  return <article className={`rounded-lg border p-5 ${style}`}><h3 className="font-semibold">{title}</h3>{rules.length ? <div className="mt-3 grid gap-2">{rules.map((rule) => <div key={rule.id} className="rounded-md border border-current/15 bg-white/75 px-3 py-2"><p className="text-sm font-semibold">{rule.title}</p><p className="mt-1 text-[11px] opacity-70">Decisão: {rule.decidedByName || "time Humanship"} · {formatDate(rule.updatedAt)}</p></div>)}</div> : <p className="mt-3 text-sm opacity-70">{empty}</p>}</article>;
}

function MessageDrawer({ participant, event, accountName, pending, onClose, onCopy }: { participant: HumanshipParticipant; event: HumanshipEvent; accountName: string; pending: boolean; onClose: () => void; onCopy: (p: HumanshipParticipant, message: 1 | 2) => void }) {
  const message1 = buildMessage1(accountName, event, participant);
  const message2 = buildMessage2(accountName, event, participant);
  const whatsapp1 = buildWhatsAppLink(participant.phone, message1);
  const whatsapp2 = buildWhatsAppLink(participant.phone, message2);
  return <div className="fixed inset-0 z-50 bg-black/35" onMouseDown={onClose}><aside className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Mensagens · {event.name}</p><h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">{participant.fullName}</h2><p className="mt-1 text-sm text-zinc-600">Assinatura automática: {firstName(accountName)}</p><p className="mt-1 text-sm text-zinc-600">WhatsApp: {participant.phone || "celular não informado na planilha"}</p></div><button type="button" onClick={onClose}><X className="h-5 w-5" /></button></div><MessageCard number={1} title="Confirmação / contato" text={message1} copiedAt={participant.message1CopiedAt} pending={pending} whatsappUrl={whatsapp1} onCopy={() => onCopy(participant, 1)} /><MessageCard number={2} title="Link de pagamento" text={message2} copiedAt={participant.message2CopiedAt} pending={pending} whatsappUrl={whatsapp2} onCopy={() => onCopy(participant, 2)} />{participant.linkedinUrl ? <a href={participant.linkedinUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-md border border-[var(--share-green-800)] px-4 py-2 text-sm font-semibold text-[var(--share-green-900)]">Abrir LinkedIn <ExternalLink className="h-4 w-4" /></a> : null}</aside></div>;
}

function MessageCard({ number, title, text, copiedAt, pending, whatsappUrl, onCopy }: { number: number; title: string; text: string; copiedAt?: string; pending: boolean; whatsappUrl: string | null; onCopy: () => void }) {
  return <section className="mt-5 rounded-lg border border-[var(--share-line)] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Mensagem {number}</p><h3 className="font-semibold">{title}</h3></div><div className="flex flex-wrap gap-2"><button type="button" disabled={pending} onClick={onCopy} className="inline-flex items-center gap-2 rounded-md border border-[var(--share-green-800)] px-3 py-2 text-sm font-semibold text-[var(--share-green-900)] disabled:opacity-60"><Clipboard className="h-4 w-4" />Copiar</button>{whatsappUrl ? <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md bg-[var(--share-green-950)] px-3 py-2 text-sm font-semibold text-white"><MessageCircle className="h-4 w-4" />Abrir no WhatsApp</a> : null}</div></div><div className="mt-3 whitespace-pre-wrap rounded-md bg-[#fbfdf8] p-4 text-sm leading-6 text-zinc-700">{text}</div>{copiedAt ? <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><Check className="h-3.5 w-3.5" />Copiada em {formatDate(copiedAt)}</p> : null}{!whatsappUrl ? <p className="mt-2 text-xs text-amber-800">Sem link de WhatsApp: confira se a planilha possui um número de celular válido.</p> : null}</section>;
}

function buildMessage1(accountName: string, event: HumanshipEvent, participant: HumanshipParticipant) {
  const person = firstName(participant.fullName);
  const sender = firstName(accountName);
  const role = participant.linkedinTitle || participant.jobTitle;
  const company = participant.linkedinCompany || participant.company;
  const context = role && company ? ` como ${role} na ${company}` : role ? ` como ${role}` : company ? ` na ${company}` : "";
  return `Oi, ${person}! Tudo bem?\n\nEu sou ${sender}, da Share. Estou entrando em contato para confirmar sua participação no ${event.name}. Encontrei seu perfil profissional${context} e queria validar se essas informações seguem atuais.\n\nVocê consegue me confirmar por aqui? Assim damos continuidade ao seu atendimento no evento.`;
}

function buildMessage2(accountName: string, event: HumanshipEvent, participant: HumanshipParticipant) {
  return `Oi, ${firstName(participant.fullName)}! Tudo bem?\n\nEu sou ${firstName(accountName)}, da Share. Estamos dando continuidade à sua participação no ${event.name} e, neste momento, estamos gerando o seu link de pagamento.\n\nAssim que ele estiver pronto, envio por aqui para você concluir a etapa. Se precisar de alguma informação enquanto isso, pode falar comigo por esta conversa.`;
}

function StatusBadge({ value }: { value: HumanshipClassification }) {
  const styles = value === "eligible" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : value === "validate" ? "bg-amber-50 text-amber-800 border-amber-200" : value === "possible_rejected" ? "bg-red-50 text-red-800 border-red-200" : "bg-zinc-50 text-zinc-600 border-zinc-200";
  const label = value === "eligible" ? "Elegível" : value === "validate" ? "Validar" : value === "possible_rejected" ? "Possível reprovado" : "Pendente";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${styles}`}>{label}</span>;
}

function DecisionBadge({ value }: { value: HumanshipDecision }) {
  const label = value === "approved" ? "Aprovado" : value === "review" ? "Validar" : value === "rejected" ? "Reprovado" : "Sem decisão";
  return <span className="text-xs font-semibold text-zinc-700">{label}</span>;
}

function findRoleRule(rules: HumanshipRoleRule[] | undefined, title: string) {
  const normalized = normalizeTitleClient(title);
  return (rules ?? []).find((rule) => rule.normalizedTitle === normalized);
}

function roleTone(participant: HumanshipParticipant, rule?: HumanshipRoleRule): HumanshipClassification {
  if (rule?.decision === "accepted") return "eligible";
  if (rule?.decision === "rejected") return "possible_rejected";
  if (participant.roleScore != null) {
    if (participant.roleScore >= 88) return "eligible";
    if (participant.roleScore >= 55) return "validate";
    return "possible_rejected";
  }
  return participant.classification;
}

function normalizeTitleClient(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/&/g, " e ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function filterLabel(value: Filter) {
  if (value === "all") return "Todos";
  if (value === "eligible") return "Elegíveis";
  if (value === "validate") return "Validar";
  if (value === "possible_rejected") return "Possíveis reprovados";
  if (value === "approved") return "Aprovados";
  return "Reprovados";
}


function firstName(value: string) { return value.trim().split(/\s+/)[0] || value; }
function formatDate(value?: string) { return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Ainda não registrado"; }
