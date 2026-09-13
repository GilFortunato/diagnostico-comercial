"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clipboard, ExternalLink, FileSpreadsheet, LoaderCircle, Plus, Search, ShieldCheck, X } from "lucide-react";
import { humanshipCompanyRestrictionGroups, humanshipRestrictionVersion, humanshipRoleReferences } from "@/lib/humanship/restrictions";
import type { HumanshipClassification, HumanshipDecision, HumanshipEvent, HumanshipParticipant } from "@/lib/humanship/types";

type Pending = "load" | "create" | "upload" | "search" | "decision" | "copy" | null;
type Tab = "source" | "results" | "restrictions";
type Filter = "all" | HumanshipClassification | "approved" | "rejected";

export function HumanshipR1ShipExperience({ accountName }: { accountName: string }) {
  const [events, setEvents] = useState<HumanshipEvent[]>([]);
  const [event, setEvent] = useState<HumanshipEvent | null>(null);
  const [eventName, setEventName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [tab, setTab] = useState<Tab>("source");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<HumanshipParticipant | null>(null);
  const [pending, setPending] = useState<Pending>("load");
  const [error, setError] = useState<string | null>(null);

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

  async function loadEvent(id: string) {
    const response = await fetch(`/api/humanship/events/${id}`, { cache: "no-store" });
    const body = await response.json() as { event?: HumanshipEvent; error?: string };
    if (!response.ok || !body.event) throw new Error(body.error || "Não foi possível abrir o evento.");
    setEvent(body.event);
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
        if (next[0]?.id) await loadEvent(next[0].id);
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

  function chooseSpreadsheet(nextFile: File | null) {
    setError(null);
    if (!nextFile) {
      setFile(null);
      return;
    }
    const lower = nextFile.name.toLocaleLowerCase("pt-BR");
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".csv")) {
      setFile(null);
      setError("Formato não suportado. Escolha um arquivo .xlsx ou .csv.");
      return;
    }
    if (nextFile.size > 12 * 1024 * 1024) {
      setFile(null);
      setError("O arquivo excede o limite de 12 MB.");
      return;
    }
    setFile(nextFile);
  }

  async function uploadExcel() {
    if (!event) {
      setError("Crie ou selecione um evento antes de importar a planilha.");
      return;
    }
    if (!file) {
      setError("Escolha uma planilha .xlsx ou .csv antes de importar.");
      return;
    }
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
    <main className="share-shell min-h-screen text-[var(--share-ink)]">
      <div className="mx-auto max-w-7xl px-5 py-8">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--share-line)] pb-5">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Humanship</p><h1 className="mt-1 text-3xl font-semibold text-[var(--share-green-950)]">R1 Ship</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">Centralize eventos, confirme participantes no LinkedIn, aplique as restrições vigentes e deixe a decisão final com o time.</p></div>
          {events.length ? <select value={event?.id || ""} onChange={(e) => { setPending("load"); loadEvent(e.target.value).catch((cause) => setError(cause instanceof Error ? cause.message : "Erro ao abrir evento.")).finally(() => setPending(null)); }} className="h-10 rounded-md border border-[var(--share-line)] bg-white px-3 text-sm"><option value="">Escolha um evento</option>{events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select> : null}
        </header>

        {error ? <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</p> : null}

        <section className="mt-6 rounded-lg border border-[var(--share-line)] bg-white p-5">
          <div className="flex flex-wrap items-end gap-3"><div className="min-w-[260px] flex-1"><label className="text-sm font-semibold text-zinc-700">Novo evento</label><input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Ex.: Humanship Talks · Ipiranga" className="mt-1 h-10 w-full rounded-md border border-[var(--share-line)] px-3" /></div><button type="button" onClick={createEvent} disabled={pending === "create" || eventName.trim().length < 2} className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--share-green-950)] px-4 text-sm font-semibold text-white disabled:opacity-60">{pending === "create" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Criar evento</button></div>
        </section>

        {pending === "load" ? <p className="mt-8 inline-flex items-center gap-2 text-sm text-zinc-600"><LoaderCircle className="h-4 w-4 animate-spin" /> Carregando R1 Ship...</p> : null}

        {event ? <>
          <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--share-line)] bg-white p-4"><div><p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Evento atual</p><h2 className="text-xl font-semibold text-[var(--share-green-950)]">{event.name}</h2><p className="text-sm text-zinc-500">{event.sourceRowCount} participante(s) · restrições {event.restrictionVersion}</p></div><div className="flex gap-2">{(["source", "results", "restrictions"] as Tab[]).map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-md px-3 py-2 text-sm font-semibold ${tab === item ? "bg-[var(--share-green-950)] text-white" : "border border-[var(--share-line)] text-zinc-700"}`}>{item === "source" ? "Fonte de dados" : item === "results" ? "Resultados" : "Restrições"}</button>)}</div></section>

          {tab === "source" ? <SourceTab event={event} file={file} onFile={chooseSpreadsheet} pending={pending} onUpload={uploadExcel} /> : null}
          {tab === "results" ? <ResultsTab event={event} visible={visible} counts={counts} filter={filter} setFilter={setFilter} pending={pending} onSearch={searchLinkedin} onDecision={decide} onMessages={setSelected} /> : null}
          {tab === "restrictions" ? <RestrictionsTab /> : null}
        </> : null}

        {selected && event ? <MessageDrawer participant={selected} event={event} accountName={accountName} pending={pending === "copy"} onClose={() => setSelected(null)} onCopy={copyMessage} /> : null}
      </div>
    </main>
  );
}

function SourceTab({ event, file, onFile, pending, onUpload }: { event: HumanshipEvent; file: File | null; onFile: (v: File | null) => void; pending: Pending; onUpload: () => void }) {
  return <section className="mt-5">
    <article className="rounded-lg border border-[var(--share-line)] bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="rounded-md bg-[#edf7eb] p-2 text-[var(--share-green-900)]"><FileSpreadsheet className="h-5 w-5" /></span>
        <div>
          <h3 className="font-semibold text-[var(--share-green-950)]">Importar planilha</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-600">Escolha um arquivo .xlsx ou .csv de até 12 MB. A conexão com Google Sheets fica somente no bloco superior da página.</p>
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

function ResultsTab({ event, visible, counts, filter, setFilter, pending, onSearch, onDecision, onMessages }: { event: HumanshipEvent; visible: HumanshipParticipant[]; counts: Record<string, number>; filter: Filter; setFilter: (v: Filter) => void; pending: Pending; onSearch: (rescan?: boolean) => void; onDecision: (p: HumanshipParticipant, d: HumanshipDecision) => void; onMessages: (p: HumanshipParticipant) => void }) {
  return <section className="mt-5 rounded-lg border border-[var(--share-line)] bg-white"><div className="flex flex-wrap items-end justify-between gap-4 p-5"><div><p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Resultado operacional</p><h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">Participantes e validação</h2><p className="mt-1 text-sm text-zinc-600">A classificação automática recomenda; a aprovação ou reprovação final é sempre manual.</p></div><div className="flex gap-2"><button type="button" onClick={() => onSearch(false)} disabled={pending === "search" || !event.participants.length} className="inline-flex items-center gap-2 rounded-md bg-[var(--share-green-950)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending === "search" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{pending === "search" ? "Pesquisando LinkedIn" : "Encontrar no LinkedIn"}</button>{event.participants.some((item) => item.searchStatus === "found") ? <button type="button" onClick={() => onSearch(true)} disabled={pending === "search"} className="rounded-md border border-[var(--share-line)] px-3 py-2 text-sm">Refazer busca</button> : null}</div></div><div className="flex flex-wrap gap-2 border-y border-[var(--share-line)] bg-[#fbfdf8] p-4">{(["all", "eligible", "validate", "possible_rejected", "approved", "rejected"] as Filter[]).map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === item ? "bg-[var(--share-green-950)] text-white" : "border border-[var(--share-line)] bg-white text-zinc-600"}`}>{filterLabel(item)} · {counts[item] || 0}</button>)}</div><div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-left text-sm"><thead className="text-xs uppercase text-[var(--share-green-800)]"><tr><th className="p-3">Pessoa</th><th className="p-3">Empresa</th><th className="p-3">Cargo</th><th className="p-3">LinkedIn</th><th className="p-3">Classificação</th><th className="p-3">Motivo</th><th className="p-3">Decisão humana</th><th className="p-3">Ações</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id} className="border-t border-[var(--share-line)] align-top"><td className="p-3"><strong>{item.fullName}</strong><p className="mt-1 text-xs text-zinc-500">{item.email || "E-mail não informado"}</p></td><td className="p-3">{item.linkedinCompany || item.company || "Não informada"}{item.companyRestriction ? <p className="mt-1 text-xs font-semibold text-red-700">Restrição identificada</p> : null}</td><td className="p-3">{item.linkedinTitle || item.jobTitle || "Não informado"}{item.roleReference ? <p className="mt-1 text-xs text-zinc-500">Próximo de: {item.roleReference}{item.roleScore != null ? ` · ${item.roleScore}%` : ""}</p> : null}</td><td className="p-3">{item.linkedinUrl ? <a href={item.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[var(--share-green-900)]">Abrir perfil <ExternalLink className="h-3.5 w-3.5" /></a> : <span className="text-zinc-500">{searchLabel(item.searchStatus)}</span>}</td><td className="p-3"><StatusBadge value={item.classification} /></td><td className="max-w-[320px] p-3 text-xs leading-5 text-zinc-600">{item.classificationReason || "Aguardando análise."}</td><td className="p-3"><DecisionBadge value={item.humanDecision} />{item.decisionByName ? <p className="mt-1 text-xs text-zinc-500">por {item.decisionByName}</p> : null}</td><td className="p-3"><div className="flex flex-wrap gap-1.5"><button type="button" onClick={() => onDecision(item, "approved")} disabled={pending === "decision"} className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-800">Aprovar</button><button type="button" onClick={() => onDecision(item, "review")} disabled={pending === "decision"} className="rounded-md border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-800">Validar</button><button type="button" onClick={() => onDecision(item, "rejected")} disabled={pending === "decision"} className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-800">Reprovar</button><button type="button" onClick={() => onMessages(item)} className="rounded-md bg-[var(--share-green-950)] px-2 py-1 text-xs font-semibold text-white">Mensagens</button></div></td></tr>)}</tbody></table>{!visible.length ? <p className="p-8 text-center text-sm text-zinc-500">Nenhuma pessoa neste filtro.</p> : null}</div></section>;
}

function RestrictionsTab() {
  return <section className="mt-5 grid gap-5"><div className="rounded-lg border border-[var(--share-line)] bg-white p-5"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[var(--share-green-800)]" /><div><h2 className="font-semibold text-[var(--share-green-950)]">Restrições vigentes</h2><p className="text-sm text-zinc-600">Versão {humanshipRestrictionVersion}. Cada evento guarda a versão utilizada para preservar a auditoria.</p></div></div></div><div className="rounded-lg border border-[var(--share-line)] bg-white p-5"><p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Restrição 01</p><h3 className="mt-1 text-xl font-semibold text-[var(--share-green-950)]">Concorrentes e patrocinadores</h3><div className="mt-4 grid gap-3 md:grid-cols-2">{humanshipCompanyRestrictionGroups.map((group) => <article key={`${group.reference}-${group.category}`} className="rounded-md border border-[var(--share-line)] p-3"><p className="font-semibold">{group.reference}</p><p className="mt-1 text-xs text-zinc-500">{group.category}</p><p className="mt-2 text-sm text-zinc-700">{group.companies.join(" · ")}</p></article>)}</div></div><div className="rounded-lg border border-[var(--share-line)] bg-white p-5"><p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Restrição 02</p><h3 className="mt-1 text-xl font-semibold text-[var(--share-green-950)]">Cargos executivos de RH e Pessoas</h3><p className="mt-2 text-sm leading-6 text-zinc-600">O motor não exige texto literal: títulos equivalentes entram como elegíveis; cargos de liderança próximos entram para validação; demais permanecem como possível reprovado para decisão humana.</p><div className="mt-4 flex flex-wrap gap-2">{humanshipRoleReferences.map((role) => <span key={role} className="rounded-full border border-[var(--share-line)] bg-[#fbfdf8] px-3 py-1.5 text-xs font-medium text-zinc-700">{role}</span>)}</div></div></section>;
}

function MessageDrawer({ participant, event, accountName, pending, onClose, onCopy }: { participant: HumanshipParticipant; event: HumanshipEvent; accountName: string; pending: boolean; onClose: () => void; onCopy: (p: HumanshipParticipant, message: 1 | 2) => void }) {
  const message1 = buildMessage1(accountName, event, participant);
  const message2 = buildMessage2(accountName, event, participant);
  return <div className="fixed inset-0 z-50 bg-black/35" onMouseDown={onClose}><aside className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Mensagens · {event.name}</p><h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">{participant.fullName}</h2><p className="mt-1 text-sm text-zinc-600">Assinatura automática: {firstName(accountName)}</p></div><button type="button" onClick={onClose}><X className="h-5 w-5" /></button></div><MessageCard number={1} title="Confirmação / contato" text={message1} copiedAt={participant.message1CopiedAt} pending={pending} onCopy={() => onCopy(participant, 1)} /><MessageCard number={2} title="Link de pagamento" text={message2} copiedAt={participant.message2CopiedAt} pending={pending} onCopy={() => onCopy(participant, 2)} />{participant.linkedinUrl ? <a href={participant.linkedinUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-md border border-[var(--share-green-800)] px-4 py-2 text-sm font-semibold text-[var(--share-green-900)]">Abrir LinkedIn <ExternalLink className="h-4 w-4" /></a> : null}</aside></div>;
}

function MessageCard({ number, title, text, copiedAt, pending, onCopy }: { number: number; title: string; text: string; copiedAt?: string; pending: boolean; onCopy: () => void }) {
  return <section className="mt-5 rounded-lg border border-[var(--share-line)] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Mensagem {number}</p><h3 className="font-semibold">{title}</h3></div><button type="button" disabled={pending} onClick={onCopy} className="inline-flex items-center gap-2 rounded-md bg-[var(--share-green-950)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"><Clipboard className="h-4 w-4" />Copiar mensagem</button></div><div className="mt-3 whitespace-pre-wrap rounded-md bg-[#fbfdf8] p-4 text-sm leading-6 text-zinc-700">{text}</div>{copiedAt ? <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><Check className="h-3.5 w-3.5" />Copiada em {formatDate(copiedAt)}</p> : null}</section>;
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

function filterLabel(value: Filter) {
  if (value === "all") return "Todos";
  if (value === "eligible") return "Elegíveis";
  if (value === "validate") return "Validar";
  if (value === "possible_rejected") return "Possíveis reprovados";
  if (value === "approved") return "Aprovados";
  return "Reprovados";
}

function searchLabel(value: HumanshipParticipant["searchStatus"]) {
  if (value === "searching") return "Pesquisando...";
  if (value === "not_found") return "Não confirmado";
  if (value === "error") return "Fonte indisponível";
  return "Aguardando busca";
}

function firstName(value: string) { return value.trim().split(/\s+/)[0] || value; }
function formatDate(value?: string) { return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Ainda não registrado"; }
