"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ExternalLink,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import type {
  HumanshipAgendaEvent,
  HumanshipAgendaEventFormat,
  HumanshipAgendaEventStatus,
} from "@/lib/humanship/agendaTypes";

type FormState = {
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  location: string;
  format: HumanshipAgendaEventFormat;
  eventUrl: string;
  coverUrl: string;
  status: "draft" | "published";
  featured: boolean;
};

const emptyForm: FormState = {
  title: "",
  description: "",
  startAt: "",
  endAt: "",
  location: "",
  format: "presencial",
  eventUrl: "",
  coverUrl: "",
  status: "draft",
  featured: false,
};

export function HumanshipAgendaManager() {
  const [events, setEvents] = useState<HumanshipAgendaEvent[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>("load");
  const [error, setError] = useState<string | null>(null);

  const [referenceTime, setReferenceTime] = useState(0);

  const upcoming = useMemo(
    () => events.filter((event) => new Date(event.endAt || event.startAt).getTime() >= referenceTime),
    [events, referenceTime],
  );

  const past = useMemo(
    () => events.filter((event) => new Date(event.endAt || event.startAt).getTime() < referenceTime),
    [events, referenceTime],
  );

  async function loadEvents() {
    try {
      const snapshot = await fetchAgendaEvents();
      setReferenceTime(snapshot.collectedAt);
      setEvents(snapshot.events);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar a agenda.");
    } finally {
      setPending(null);
    }
  }

  useEffect(() => {
    let active = true;
    fetchAgendaEvents().then((snapshot) => {
      if (!active) return;
      setReferenceTime(snapshot.collectedAt);
      setEvents(snapshot.events);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar a agenda.");
    }).finally(() => {
      if (active) setPending(null);
    });
    return () => { active = false; };
  }, []);

  function editEvent(event: HumanshipAgendaEvent) {
    setEditingId(event.id);
    setForm({
      title: event.title,
      description: event.description || "",
      startAt: toLocalInput(event.startAt),
      endAt: event.endAt ? toLocalInput(event.endAt) : "",
      location: event.location || "",
      format: event.format,
      eventUrl: event.eventUrl || "",
      coverUrl: event.coverUrl || "",
      status: event.status === "published" ? "published" : "draft",
      featured: event.featured,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  async function saveEvent() {
    if (form.title.trim().length < 2 || !form.startAt) {
      setError("Preencha pelo menos o nome e a data de início do evento.");
      return;
    }

    setPending("save");
    setError(null);
    try {
      const payload = {
        ...form,
        startAt: new Date(form.startAt).toISOString(),
        endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
        description: form.description || undefined,
        location: form.location || undefined,
        eventUrl: form.eventUrl || undefined,
        coverUrl: form.coverUrl || undefined,
      };

      const response = await fetch(
        editingId ? `/api/humanship/agenda/${editingId}` : "/api/humanship/agenda",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = await response.json() as { event?: HumanshipAgendaEvent; error?: string };
      if (!response.ok || !body.event) throw new Error(body.error || "Não foi possível salvar o evento.");
      resetForm();
      await loadEvents();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o evento.");
      setPending(null);
    }
  }

  async function patchEvent(id: string, patch: Partial<{
    status: HumanshipAgendaEventStatus;
    featured: boolean;
  }>) {
    setPending(id);
    setError(null);
    try {
      const response = await fetch(`/api/humanship/agenda/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await response.json() as { event?: HumanshipAgendaEvent; error?: string };
      if (!response.ok || !body.event) throw new Error(body.error || "Não foi possível atualizar o evento.");
      await loadEvents();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o evento.");
      setPending(null);
    }
  }

  async function removeEvent(id: string) {
    if (!window.confirm("Excluir este evento da agenda?")) return;
    setPending(id);
    setError(null);
    try {
      const response = await fetch(`/api/humanship/agenda/${id}`, { method: "DELETE" });
      const body = await response.json() as { deleted?: boolean; error?: string };
      if (!response.ok || !body.deleted) throw new Error(body.error || "Não foi possível excluir o evento.");
      if (editingId === id) resetForm();
      await loadEvents();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível excluir o evento.");
      setPending(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#eef4e9] text-[#003f2c]">
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#006142] hover:underline">
              <ArrowLeft className="h-4 w-4" /> Voltar ao Share Hub
            </Link>
            <p className="mt-7 text-xs font-bold uppercase tracking-[0.18em] text-[#006142]">Humanship · Eventos & Comunidade</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[#003f2c]">Agenda de eventos</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              Cadastre os próximos eventos do Humanship. Eventos publicados alimentam automaticamente o card de próximo evento da Home.
            </p>
          </div>

          <div className="rounded-2xl border border-[#cbdcc9] bg-white px-5 py-4 text-sm shadow-sm">
            <strong className="block text-[#003f2c]">{upcoming.length} próximo{upcoming.length === 1 ? "" : "s"} evento{upcoming.length === 1 ? "" : "s"}</strong>
            <span className="mt-1 block text-zinc-500">Apenas publicados aparecem na Home.</span>
          </div>
        </div>

        {error ? (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-3xl border border-[#cbdcc9] bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006142]">{editingId ? "Editando evento" : "Novo evento"}</p>
                <h2 className="mt-1 text-2xl font-semibold text-[#003f2c]">{editingId ? form.title || "Evento" : "Adicionar à agenda"}</h2>
              </div>
              {editingId ? (
                <button type="button" onClick={resetForm} className="rounded-full border border-[#d9e4d7] px-4 py-2 text-sm font-semibold text-[#006142]">
                  Cancelar edição
                </button>
              ) : null}
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#006142]">Nome do evento</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Ex.: Humanship Festival"
                  className="w-full rounded-xl border border-[#cbdcc9] bg-[#fbfdf9] px-4 py-3 outline-none focus:border-[#006142]"
                />
              </label>

              <label>
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#006142]">Início</span>
                <input
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(event) => setForm((current) => ({ ...current, startAt: event.target.value }))}
                  className="w-full rounded-xl border border-[#cbdcc9] bg-[#fbfdf9] px-4 py-3 outline-none focus:border-[#006142]"
                />
              </label>

              <label>
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#006142]">Término · opcional</span>
                <input
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(event) => setForm((current) => ({ ...current, endAt: event.target.value }))}
                  className="w-full rounded-xl border border-[#cbdcc9] bg-[#fbfdf9] px-4 py-3 outline-none focus:border-[#006142]"
                />
              </label>

              <label>
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#006142]">Formato</span>
                <select
                  value={form.format}
                  onChange={(event) => setForm((current) => ({ ...current, format: event.target.value as HumanshipAgendaEventFormat }))}
                  className="w-full rounded-xl border border-[#cbdcc9] bg-[#fbfdf9] px-4 py-3 outline-none focus:border-[#006142]"
                >
                  <option value="presencial">Presencial</option>
                  <option value="online">Online</option>
                  <option value="hibrido">Híbrido</option>
                </select>
              </label>

              <label>
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#006142]">Local</span>
                <input
                  value={form.location}
                  onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                  placeholder="Ex.: São Paulo · SP"
                  className="w-full rounded-xl border border-[#cbdcc9] bg-[#fbfdf9] px-4 py-3 outline-none focus:border-[#006142]"
                />
              </label>

              <label className="md:col-span-2">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#006142]">Descrição</span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  rows={4}
                  placeholder="Uma frase curta para contextualizar o evento."
                  className="w-full resize-none rounded-xl border border-[#cbdcc9] bg-[#fbfdf9] px-4 py-3 outline-none focus:border-[#006142]"
                />
              </label>

              <label>
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#006142]">Link do evento · opcional</span>
                <input
                  type="url"
                  value={form.eventUrl}
                  onChange={(event) => setForm((current) => ({ ...current, eventUrl: event.target.value }))}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-[#cbdcc9] bg-[#fbfdf9] px-4 py-3 outline-none focus:border-[#006142]"
                />
              </label>

              <label>
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#006142]">Capa · opcional</span>
                <input
                  type="url"
                  value={form.coverUrl}
                  onChange={(event) => setForm((current) => ({ ...current, coverUrl: event.target.value }))}
                  placeholder="URL da imagem"
                  className="w-full rounded-xl border border-[#cbdcc9] bg-[#fbfdf9] px-4 py-3 outline-none focus:border-[#006142]"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#e3ebe1] pt-5">
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-[#003f2c]">
                  <input
                    type="checkbox"
                    checked={form.status === "published"}
                    onChange={(event) => setForm((current) => ({ ...current, status: event.target.checked ? "published" : "draft" }))}
                    className="h-4 w-4 accent-[#006142]"
                  />
                  Publicar
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-[#003f2c]">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(event) => setForm((current) => ({ ...current, featured: event.target.checked }))}
                    className="h-4 w-4 accent-[#006142]"
                  />
                  Destacar na Home
                </label>
              </div>

              <button
                type="button"
                onClick={() => void saveEvent()}
                disabled={pending === "save"}
                className="inline-flex min-w-44 items-center justify-center gap-2 rounded-xl bg-[#006142] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {pending === "save" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingId ? "Salvar alterações" : "Criar evento"}
              </button>
            </div>
          </div>

          <aside className="rounded-3xl border border-[#cbdcc9] bg-[#003f2c] p-6 text-white shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#d8ef55]">Como funciona</p>
            <h2 className="mt-2 text-2xl font-semibold">Da agenda para a Home</h2>
            <div className="mt-6 space-y-5 text-sm leading-6 text-white/75">
              <p><strong className="text-white">Rascunho:</strong> fica salvo apenas nesta área de gestão.</p>
              <p><strong className="text-white">Publicado:</strong> passa a concorrer ao card “Próximo evento” da Home.</p>
              <p><strong className="text-white">Destaque:</strong> tem prioridade sobre os demais eventos futuros publicados.</p>
              <p>Se nenhum evento estiver destacado, a Home usa automaticamente o próximo pela data.</p>
            </div>
          </aside>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006142]">Calendário</p>
              <h2 className="mt-1 text-2xl font-semibold text-[#003f2c]">Próximos eventos</h2>
            </div>
            {pending === "load" ? <LoaderCircle className="h-5 w-5 animate-spin text-[#006142]" /> : null}
          </div>

          {!upcoming.length && pending !== "load" ? (
            <div className="rounded-2xl border border-dashed border-[#b9ceb6] bg-white/60 px-6 py-10 text-center text-sm text-zinc-500">
              Nenhum evento futuro cadastrado ainda.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {upcoming.map((event) => (
                <AgendaCard
                  key={event.id}
                  event={event}
                  pending={pending === event.id}
                  onEdit={() => editEvent(event)}
                  onPatch={(patch) => void patchEvent(event.id, patch)}
                  onDelete={() => void removeEvent(event.id)}
                />
              ))}
            </div>
          )}
        </section>

        {past.length ? (
          <section className="mt-10 border-t border-[#cbdcc9] pt-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">Histórico</p>
            <h2 className="mt-1 text-xl font-semibold text-[#003f2c]">Eventos anteriores</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {past.map((event) => (
                <AgendaCard
                  key={event.id}
                  event={event}
                  pending={pending === event.id}
                  onEdit={() => editEvent(event)}
                  onPatch={(patch) => void patchEvent(event.id, patch)}
                  onDelete={() => void removeEvent(event.id)}
                  compact
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function AgendaCard({
  event,
  pending,
  onEdit,
  onPatch,
  onDelete,
  compact = false,
}: {
  event: HumanshipAgendaEvent;
  pending: boolean;
  onEdit: () => void;
  onPatch: (patch: Partial<{ status: HumanshipAgendaEventStatus; featured: boolean }>) => void;
  onDelete: () => void;
  compact?: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-[#cbdcc9] bg-white shadow-sm">
      <div className="border-b border-[#e3ebe1] bg-[#eff8eb] px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                event.status === "published" ? "bg-[#dff4c6] text-[#006142]" : "bg-zinc-100 text-zinc-500"
              }`}>
                {event.status === "published" ? "Publicado" : "Rascunho"}
              </span>
              {event.featured ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#eff06a] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#334215]">
                  <Star className="h-3 w-3 fill-current" /> Destaque
                </span>
              ) : null}
            </div>
            <h3 className="mt-3 text-lg font-semibold text-[#003f2c]">{event.title}</h3>
          </div>
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin text-[#006142]" /> : null}
        </div>
      </div>

      <div className="px-5 py-5">
        <div className="space-y-2 text-sm text-zinc-600">
          <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#006142]" /> {formatEventRange(event)}</p>
          {event.location ? <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#006142]" /> {event.location}</p> : null}
        </div>
        {!compact && event.description ? <p className="mt-4 text-sm leading-6 text-zinc-600">{event.description}</p> : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-lg border border-[#d4e2d2] px-3 py-2 text-xs font-bold text-[#006142]">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
          {event.status !== "published" ? (
            <button type="button" onClick={() => onPatch({ status: "published" })} className="inline-flex items-center gap-1.5 rounded-lg bg-[#006142] px-3 py-2 text-xs font-bold text-white">
              <Check className="h-3.5 w-3.5" /> Publicar
            </button>
          ) : (
            <button type="button" onClick={() => onPatch({ status: "draft" })} className="rounded-lg border border-[#d4e2d2] px-3 py-2 text-xs font-bold text-zinc-600">
              Voltar a rascunho
            </button>
          )}
          {!event.featured ? (
            <button type="button" onClick={() => onPatch({ featured: true })} className="inline-flex items-center gap-1.5 rounded-lg border border-[#d4e2d2] px-3 py-2 text-xs font-bold text-[#6a7315]">
              <Star className="h-3.5 w-3.5" /> Destacar
            </button>
          ) : (
            <button type="button" onClick={() => onPatch({ featured: false })} className="rounded-lg border border-[#d4e2d2] px-3 py-2 text-xs font-bold text-zinc-600">
              Remover destaque
            </button>
          )}
          {event.eventUrl ? (
            <a href={event.eventUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[#d4e2d2] px-3 py-2 text-xs font-bold text-[#006142]">
              <ExternalLink className="h-3.5 w-3.5" /> Abrir link
            </a>
          ) : null}
          <button type="button" onClick={onDelete} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
        </div>
      </div>
    </article>
  );
}

function toLocalInput(value: string) {
  const date = new Date(value);
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatEventRange(event: HumanshipAgendaEvent) {
  const start = new Date(event.startAt);
  const end = event.endAt ? new Date(event.endAt) : null;
  const date = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(start);

  if (!end) return date;

  const endText = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(end);
  return `${date} → ${endText}`;
}

async function fetchAgendaEvents() {
  const response = await fetch("/api/humanship/agenda", { cache: "no-store" });
  const body = await response.json() as { events?: HumanshipAgendaEvent[]; error?: string };
  if (!response.ok) throw new Error(body.error || "Não foi possível carregar a agenda.");
  return { events: body.events || [], collectedAt: Date.now() };
}
