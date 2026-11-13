"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { activityKinds, alertFor, brl, channels, daysBetween, installmentPlan, priorities, reactions, results, stages, temperatures, todayInBrazil, type CrmDetail } from "@/lib/crm/model";
import { crmButton, crmControl, dateLabel, requestCrm } from "./controls";

type Detail = CrmDetail & { version: string };
type Action = "opportunity" | "account" | "contact" | "activity";
const historyHeaders = [
  "Menu", "SLA operacional", "Nº de cadastro", "Contrato fechado", "Contato", "Empresa / marca", "Segmento", "Atenção / Relacionamento", "LinkedIn", "Site / fonte",
  "1º contato", "2º contato", "3º contato", "4º contato", "5º contato", "Temperatura", "Origem", "Nome do contato", "Cargo", "E-mail", "Telefone / WhatsApp", "Canal",
  "Evento / projeto", "Tipo de patrocínio", ...Array.from({ length: 9 }, (_, i) => "Evento " + (i + 1)), "Etapa do funil", "Data para envio da proposta",
  "Data da reunião agendada", "Reunião feita", "Data da reunião realizada", "Resultado", "Prioridade", "Responsável", "Último contato", "Próxima ação", "Data da próxima ação",
  "Evolução / Detalhe do Follow-up", "Histórico de Interações", "Valor proposto", "Valor vendido", "Data da venda", "Observações", "Dias sem contato", "Alerta",
  "Forma de pagamento", "Valor de entrada", "Saldo a parcelar", "Nº de parcelas", "Valor da parcela", ...Array.from({ length: 12 }, (_, i) => "Parcela " + (i + 1)), "Coluna 70",
];

function sourceHeader(column: string) {
  const index = [...column].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
  return historyHeaders[index] ?? column;
}

const field = (form: FormData, key: string) => String(form.get(key) ?? "").trim() || null;
const moneyField = (form: FormData, key: string) => field(form, key) === null ? null : Number(form.get(key));

function Field({ name, label, value, type = "text", required, options, long }: {
  name: string; label: string; value?: string | number | null; type?: string; required?: boolean; options?: readonly string[]; long?: boolean;
}) {
  const selectOptions = options ? [...new Set([...options, ...(typeof value === "string" && value ? [value] : [])])] : [];
  return <label className={"grid gap-1 text-xs font-semibold text-zinc-700 " + (long ? "sm:col-span-2" : "")}>{label}
    {options ? <select name={name} defaultValue={value ?? ""} required={required} className={crmControl}>
      <option value="">Selecionar</option>{selectOptions.map((item) => <option key={item}>{item}</option>)}
    </select> : long ? <textarea name={name} rows={3} defaultValue={value ?? ""} required={required} className={crmControl} />
      : <input name={name} type={type} defaultValue={value ?? ""} required={required} className={crmControl} step={type === "number" ? (name === "installmentCount" ? "1" : "0.01") : undefined} min={type === "number" ? (name === "installmentCount" ? 1 : 0) : undefined} />}
  </label>;
}

function Section({ title, children, open }: { title: string; children: ReactNode; open?: boolean }) {
  return <details open={open} className="rounded-xl border border-[var(--share-line)] bg-white">
    <summary className="cursor-pointer p-4 font-semibold text-[var(--share-green-950)]">{title}</summary>
    <div className="border-t border-[var(--share-line)] p-4">{children}</div>
  </details>;
}

function safeUrl(value: string | null) {
  if (!value) return null;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}

export function CrmOpportunityDrawer({ id, onClose, onSelect, onUpdated, eventNames }: {
  id: string; onClose: () => void; onSelect: (id: string) => void; onUpdated: () => void; eventNames: string[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [activityKind, setActivityKind] = useState("Contato");
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    requestCrm<Detail>("/api/crm/" + encodeURIComponent(id), { signal: controller.signal }).then(setDetail).catch((cause: Error) => {
      if (cause.name !== "AbortError") { setFeedback(cause.message); setFailed(true); }
    });
    return () => controller.abort();
  }, [id]);

  async function submit(action: Action, payload: Record<string, unknown>) {
    setFeedback("");
    setBusy(true);
    try {
      const saved = await requestCrm<Detail>("/api/crm/" + encodeURIComponent(id), {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, data: payload }),
      });
      setDetail(saved);
      setRevision((value) => value + 1);
      setFailed(false);
      setFeedback("Alteração salva.");
      onUpdated();
    } catch (cause) {
      setFailed(true);
      setFeedback(cause instanceof Error ? cause.message : "Falha ao salvar.");
    } finally { setBusy(false); }
  }

  const save = (action: Action, build: (form: FormData) => Record<string, unknown>) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit(action, build(new FormData(event.currentTarget)));
  };

  const row = detail?.row;
  const plan = detail && row ? installmentPlan(row.soldValue ?? row.proposedValue, detail.downPayment, detail.installmentCount) : null;
  const today = todayInBrazil();
  const profileFields = ["title", "seniority", "email", "phone", "linkedinUrl", "location"];
  const opportunityFields = ["priority", "contactStatus", "relationship", "owner", "origin", "channel", "project", "sponsorship", "nextAction", "nextActionDate", "proposalDueDate", "saleDate", "paymentMethod", "notes", "followUp", "historicalNotes"];
  const textFields = (form: FormData, keys: string[]) => Object.fromEntries(keys.map((key) => [key, field(form, key)]));
  return <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); onClose(); }} aria-labelledby="crm-drawer-title" className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-[49rem] bg-[#f5f8f3] p-0 text-[var(--share-ink)] shadow-2xl backdrop:bg-black/40">
    <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--share-line)] bg-white p-4 sm:p-6">
      <div><p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">{row?.legacyId ? "Ficha 360° · #" + row.legacyId : "Ficha 360°"}</p><h2 id="crm-drawer-title" className="mt-1 text-2xl font-semibold">{row?.name || "Oportunidade"}</h2>{row && <p className="mt-1 text-sm text-zinc-600">{[row.stage, row.temperature, alertFor(row, today).label].join(" · ")}</p>}</div>
      <button type="button" onClick={onClose} aria-label="Fechar ficha" className="rounded-lg p-2 hover:bg-zinc-100"><X className="h-5 w-5" /></button>
    </header>
    <div className="grid gap-4 p-4 sm:p-6">
      {!detail && !feedback && <p role="status">Carregando a ficha…</p>}
      {feedback && <p role={failed ? "alert" : "status"} className={"sticky top-28 z-10 rounded-lg p-3 text-sm " + (failed ? "bg-red-100 text-red-900" : "bg-emerald-100 text-emerald-900")}>{feedback}</p>}
      {detail && row && <>
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-white p-4 text-sm sm:grid-cols-3">
          <div><p className="text-zinc-600">Último contato</p><strong>{dateLabel(row.lastContact)}</strong>{row.lastContact && <p className="text-xs text-zinc-600">{daysBetween(row.lastContact, today)} dias sem contato</p>}</div>
          <div><p className="text-zinc-600">Próxima ação</p><strong>{dateLabel(row.nextActionDate)}</strong><p className="line-clamp-2 text-xs">{row.nextAction}</p></div>
          <div><p className="text-zinc-600">Valor proposto</p><strong>{row.proposedValue === null ? "—" : brl(row.proposedValue)}</strong></div>
        </div>
        <Section title="Oportunidade e próxima ação" open>
          <form key={"opp:" + revision} onSubmit={save("opportunity", (form) => ({
            ...textFields(form, opportunityFields), version: detail.version,
            stage: field(form, "stage"), temperature: field(form, "temperature"),
            ...(field(form, "result") !== row.result ? { result: field(form, "result") } : {}),
            events: [...new Set((field(form, "events") ?? "").split("\n").map((value) => value.trim()).filter(Boolean))],
            proposedValue: moneyField(form, "proposedValue"), soldValue: moneyField(form, "soldValue"),
            downPayment: moneyField(form, "downPayment"), installmentCount: moneyField(form, "installmentCount"),
          }))} className="grid gap-3 sm:grid-cols-2">
            <Field name="stage" label="Etapa" value={row.stage} options={stages} required />
            <Field name="temperature" label="Temperatura" value={row.temperature} options={temperatures} required />
            <Field name="priority" label="Prioridade" value={row.priority} options={priorities} />
            <Field name="owner" label="Responsável" value={row.owner} />
            <Field name="nextAction" label="Próxima ação" value={row.nextAction} long />
            <Field name="nextActionDate" label="Data da próxima ação" type="date" value={row.nextActionDate} />
            <Field name="proposalDueDate" label="Prazo para enviar proposta" type="date" value={detail.proposalDueDate} />
            <Field name="origin" label="Origem" value={detail.origin} />
            <Field name="channel" label="Canal de prospecção" value={row.channel} options={channels} />
            <Field name="contactStatus" label="Contato realizado" value={detail.contactStatus} options={["Feito", "Não feito"]} />
            <Field name="result" label="Resultado" value={row.result} options={results} required />
            <label className="grid gap-1 text-xs font-semibold">Evento / projeto<input className={crmControl} name="project" list="crm-events" defaultValue={row.project ?? ""} /><datalist id="crm-events">{eventNames.map((name) => <option key={name} value={name} />)}</datalist></label>
            <Field name="sponsorship" label="Tipo de patrocínio" value={detail.sponsorship} options={["Cota Ouro", "Cota Prata", "Cota Bronze", "Cota Anual"]} />
            <Field name="events" label="Eventos do pacote, um por linha" value={row.events.join("\n")} long />
            <Field name="relationship" label="Atenção / Relacionamento" value={row.relationship} long />
            <Field name="notes" label="Observações" value={detail.notes} long />
            <Field name="followUp" label="Evolução / Detalhe do Follow-up" value={detail.followUp} long />
            <Field name="historicalNotes" label="Histórico de Interações" value={detail.historicalNotes} long />
            <h3 className="border-t border-[var(--share-line)] pt-3 font-semibold sm:col-span-2">Proposta, venda e parcelamento</h3>
            <p className="text-sm text-zinc-600 sm:col-span-2">Contrato {row.contractClosed ? "fechado" : "em aberto"}</p>
            <Field name="proposedValue" label="Valor proposto (R$)" value={row.proposedValue} type="number" />
            <Field name="soldValue" label="Valor vendido (R$)" value={row.soldValue} type="number" />
            <Field name="saleDate" label="Data da venda" value={row.saleDate} type="date" />
            <Field name="paymentMethod" label="Forma de pagamento" value={detail.paymentMethod} options={["À Vista", "Boleto", "Cartão de Crédito", "PIX", "Transferência"]} />
            <Field name="downPayment" label="Valor de entrada (R$)" value={detail.downPayment} type="number" />
            <Field name="installmentCount" label="Nº de parcelas" value={detail.installmentCount} type="number" />
            {plan && <div className="rounded-lg bg-[#f1f6ee] p-3 text-sm sm:col-span-2"><strong>Saldo a parcelar {brl(plan.balance)}</strong>
              {plan.installments.length > 0 && <ol className="mt-2 grid grid-cols-2 gap-x-5 gap-y-1 text-xs sm:grid-cols-3">{plan.installments.map((value, i) => <li key={i}>Parcela {i + 1} · {brl(value)}</li>)}</ol>}
            </div>}
            <div className="sm:col-span-2"><button type="submit" className={crmButton} disabled={busy}>Salvar oportunidade</button></div>
          </form>
        </Section>
        <Section title="Linha do tempo">
          <form key={"act:" + revision} onSubmit={save("activity", (form) => ({
            ...textFields(form, ["date", "channel", "reaction", "note"]), kind: field(form, "kind"),
          }))} className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold">Tipo de interação<select name="kind" className={crmControl} value={activityKind} onChange={(e) => setActivityKind(e.target.value)}>{activityKinds.filter((kind) => kind !== "Mudança de etapa").map((kind) => <option key={kind}>{kind}</option>)}</select></label>
            <Field name="date" label="Data" value={today} type="date" required />
            <Field name="channel" label="Canal" options={channels} />
            {activityKind === "Reação" && <Field name="reaction" label="Tipo de reação" options={reactions} required />}
            <Field name="note" label="Registro ou desdobramento" long />
            <div className="sm:col-span-2"><button type="submit" className={crmButton} disabled={busy}>Registrar atividade</button></div>
          </form>
          <ol className="mt-5 grid divide-y divide-[var(--share-line)]">
            {detail.activities.map((activity) => <li key={activity.id} className="py-3 text-sm"><p className="font-semibold">{[dateLabel(activity.date), activity.kind, activity.attempt ? activity.attempt + "º contato" : "", activity.reaction].filter(Boolean).join(" · ")}</p><p className="text-xs text-zinc-600">{[activity.channel, activity.actor].filter(Boolean).join(" · ")}</p>{activity.note && <p className="mt-1 whitespace-pre-wrap">{activity.note}</p>}</li>)}
          </ol>
        </Section>
        <Section title="Empresa e decisores">
          <form key={"account:" + revision} onSubmit={save("account", (form) => textFields(form, ["name", "legalName", "segment", "employeeRange", "website", "linkedinUrl", "location"]))} className="grid gap-3 sm:grid-cols-2">
            <Field name="name" label="Empresa / marca" value={detail.account.name} required />
            <Field name="legalName" label="Razão social" value={detail.account.legalName} />
            <Field name="segment" label="Segmento" value={detail.account.segment} />
            <Field name="employeeRange" label="Porte" value={detail.account.employeeRange} />
            <Field name="website" label="Site / fonte" value={detail.account.website} />
            <Field name="linkedinUrl" label="LinkedIn da empresa" value={detail.account.linkedinUrl} />
            <Field name="location" label="Localização" value={detail.account.location} />
            <div className="sm:col-span-2"><button type="submit" className={crmButton} disabled={busy}>Salvar empresa</button></div>
          </form>
          {[...detail.contacts, null].map((contact) => {
            const linkedin = safeUrl(contact?.linkedinUrl ?? null);
            const digits = contact?.phone?.replace(/\D/g, "") ?? "";
            const phone = digits.length === 10 || digits.length === 11 ? "55" + digits : digits;
            return <form key={(contact?.id ?? "new") + revision} onSubmit={save("contact", (form) => ({
              ...(contact ? { id: contact.id } : {}), ...textFields(form, ["name", ...profileFields]),
            }))} className="mt-5 grid gap-3 border-t border-[var(--share-line)] pt-4 sm:grid-cols-2">
              <h3 className="font-semibold sm:col-span-2">{contact?.name ?? "Adicionar decisor"}</h3>
              <Field name="name" label="Nome" value={contact?.name} required />
              <Field name="title" label="Cargo" value={contact?.title} />
              <Field name="seniority" label="Nível hierárquico" value={contact?.seniority} />
              <Field name="email" label="E-mail" value={contact?.email} />
              <Field name="phone" label="Telefone / WhatsApp" value={contact?.phone} />
              <Field name="linkedinUrl" label="LinkedIn do decisor" value={contact?.linkedinUrl} />
              <Field name="location" label="Localização" value={contact?.location} />
              <div className="flex flex-wrap items-center gap-3 text-sm sm:col-span-2">
                <button type="submit" className={crmButton} disabled={busy}>{contact ? "Salvar decisor" : "Adicionar decisor"}</button>
                {linkedin && <a className="underline" target="_blank" rel="noreferrer" href={linkedin}>LinkedIn</a>}
                {contact?.email && <a className="underline" href={"mailto:" + encodeURIComponent(contact.email)}>E-mail</a>}
                {phone.length >= 11 && <a className="underline" target="_blank" rel="noreferrer" href={"https://wa.me/" + phone}>WhatsApp</a>}
              </div>
            </form>;
          })}
        </Section>
        {detail.related.length > 0 && <Section title="Outras oportunidades da empresa">
          <ul className="grid gap-3 text-sm">{detail.related.map((item) => <li key={item.id}><button type="button" className="text-left font-semibold underline" onClick={() => onSelect(item.id)}>{[item.project, item.sponsorship, item.stage, item.contacts.join(", ")].filter(Boolean).join(" · ")}</button></li>)}</ul>
        </Section>}
        {detail.source.length > 0 && <Section title="Origem B2B Hunting"><ul className="grid gap-3 text-sm">{detail.source.map((source) => {
          const context = source.context as { source?: string; fit?: string; fitReasons?: string[] } | null;
          return <li key={source.leadId}><p className="font-semibold">{[context?.source, context?.fit].filter(Boolean).join(" · ") || "B2B Hunting"}</p>{context?.fitReasons?.map((reason, index) => <p key={index}>{reason}</p>)}{source.searchId && <p className="text-xs text-zinc-600">Pesquisa {source.searchId}</p>}</li>;
        })}</ul></Section>}
        {detail.history.map((record) => <Section key={record.rowNumber} title={"Registro original · " + record.sheet + " · linha " + record.rowNumber}>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">{Object.entries(record.data).map(([column, value]) => <div key={column}><dt className="font-semibold">{sourceHeader(column)}</dt><dd className="break-words whitespace-pre-wrap text-zinc-600">{String(value)}</dd></div>)}</dl>
        </Section>)}
      </>}
    </div>
  </dialog>;
}
