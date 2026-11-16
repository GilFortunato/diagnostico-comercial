"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { chatScopes, crmChatPath, type ChatRecipient } from "@/lib/crm/googleChatConfig";
import { crmButton, crmControl, requestCrm } from "./controls";

const secondary = "rounded-lg border border-[var(--share-line)] bg-white px-3.5 py-2 text-sm font-semibold text-[var(--share-green-900)] hover:bg-green-50 disabled:opacity-50";

export function CrmChatSettings({ sender, connected, enabled, recipients, owners, accounts, returnedFromGoogle, canSchedule }: {
  sender: string; connected: boolean; enabled: boolean; recipients: ChatRecipient[]; owners: string[];
  accounts: { email: string; name: string | null }[]; returnedFromGoogle: boolean; canSchedule: boolean;
}) {
  const [authorized, setAuthorized] = useState(connected);
  const [rows, setRows] = useState(recipients.map(({ email, aliases }, id) => ({ id, email, aliases: aliases.join(", ") })));
  const [nextId, setNextId] = useState(recipients.length);
  const [scheduled, setScheduled] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(returnedFromGoogle && !connected ? "Autorize as duas permissões do Google Chat para conectar a conta." : "");

  async function connect() {
    setBusy(true);
    try {
      await signIn("google", { callbackUrl: `${crmChatPath}?google=volta` }, {
        scope: `openid email profile ${chatScopes.join(" ")}`,
        access_type: "offline", prompt: "consent", login_hint: sender,
      });
    } catch {
      setFeedback("Não foi possível abrir a autorização do Google.");
      setBusy(false);
    }
  }

  async function changeSettings(action: "save" | "disconnect") {
    setBusy(true);
    setFeedback("");
    try {
      const result = await requestCrm<{ enabled: boolean }>("/api/crm/chat-alerts", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "disconnect" ? { action } : { action, enabled: scheduled,
          recipients: rows.map(({ email, aliases }) => ({ email: email.trim(), aliases: aliases.split(",").map((alias) => alias.trim()).filter(Boolean) })),
        }),
      });
      if (action === "disconnect") setAuthorized(false);
      setScheduled(result.enabled);
      setFeedback(action === "disconnect" ? "Conta desconectada e envios pausados." : "Preferências salvas.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar os alertas.");
    } finally { setBusy(false); }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void changeSettings("save");
  }

  return <div className="mt-5 grid gap-4">
    <section aria-labelledby="chat-sender" className="share-card flex flex-wrap items-center justify-between gap-3 rounded-xl p-5">
      <div><h2 id="chat-sender" className="font-semibold">Conta remetente</h2><p className="mt-1 break-all text-sm">{sender}</p><p className="mt-1 text-xs text-zinc-600">{authorized ? "Conectada ao Google Chat" : "Aguardando autorização"}</p></div>
      {authorized
        ? <button type="button" className={secondary} disabled={busy} onClick={() => void changeSettings("disconnect")}>Desconectar</button>
        : <button type="button" className={crmButton} disabled={busy} onClick={() => void connect()}>Conectar Google Chat</button>}
    </section>
    <form onSubmit={save} className="share-card grid gap-4 rounded-xl p-5">
      <div><h2 className="font-semibold">Responsáveis que recebem alertas</h2><p className="mt-1 text-sm text-zinc-600">Vincule os nomes que aparecem no CRM ao e-mail corporativo de cada pessoa. Separe os nomes por vírgula.</p></div>
      {!accounts.length && <p className="text-sm text-amber-800">Nenhuma outra conta corporativa ativa tem acesso ao CRM.</p>}
      {owners.length > 0 && <details className="text-sm text-zinc-600"><summary className="cursor-pointer font-semibold text-[var(--share-green-900)]">Ver nomes cadastrados no CRM</summary><p className="mt-2 break-words">{owners.join(" · ")}</p></details>}
      {rows.map((row) => <div key={row.id} className="grid items-end gap-2 rounded-lg border border-[var(--share-line)] p-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="grid gap-1 text-sm">Conta corporativa
          <select value={row.email} required disabled={busy} className={crmControl} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, email: event.target.value } : item))}>
            <option value="">Selecione uma conta</option>
            {row.email && !accounts.some(({ email }) => email === row.email) && <option value={row.email}>{row.email} (sem acesso ao CRM)</option>}
            {accounts.map(({ email, name }) => <option key={email} value={email} disabled={row.email !== email && rows.some((item) => item.email === email)}>{name ? `${name} (${email})` : email}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Nomes no CRM<input value={row.aliases} required disabled={busy} className={crmControl} placeholder="Ricardo, Ricardo Moretto" onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, aliases: event.target.value } : item))} /></label>
        <button type="button" className={secondary} disabled={busy} onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}>Remover</button>
      </div>)}
      <div><button type="button" className={secondary} disabled={busy || rows.length >= Math.min(50, accounts.length)} onClick={() => { setRows((current) => [...current, { id: nextId, email: "", aliases: "" }]); setNextId(nextId + 1); }}>Adicionar responsável</button></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--share-line)] pt-4">
        <label className="inline-flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={scheduled} disabled={busy || (!scheduled && (!authorized || !canSchedule))} onChange={(event) => setScheduled(event.target.checked)} /> Enviar alertas automáticos</label>
        <button type="submit" className={crmButton} disabled={busy}>Salvar preferências</button>
      </div>
    </form>
    <p role="status" className="text-sm font-medium text-[var(--share-green-950)]">{feedback}</p>
  </div>;
}
