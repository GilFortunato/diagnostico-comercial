"use client";

import { useCallback, useEffect, useState } from "react";
import type { ComponentType } from "react";
import { Bot, BrainCircuit, CheckCircle2, DatabaseZap, ExternalLink, KeyRound, RefreshCw, ShieldCheck, Trash2, XCircle } from "lucide-react";
import type { PlatformCredentialHealth, PlatformCredentialSource, PlatformProvider, PublicPlatformCredentialStatus } from "@/lib/connectors/platformCredentialCore";

type ConnectorStatus = {
  google: { connected: boolean; label: string };
  intelligence: { available: boolean; label: string };
  publicSources: { available: boolean; label: string };
  admin?: {
    gemini: PublicPlatformCredentialStatus;
    apify: PublicPlatformCredentialStatus;
    manus: PublicPlatformCredentialStatus;
  };
};

export function ConnectorReadiness({ mode = "status" }: { mode?: "status" | "setup" | "admin" }) {
  const [status, setStatus] = useState<ConnectorStatus | null>(null);
  const [pageMessage, setPageMessage] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const response = await fetch("/api/connectors/status", { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível verificar a disponibilidade da plataforma.");
    setStatus((await response.json()) as ConnectorStatus);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/connectors/status", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<ConnectorStatus>;
      })
      .then((data) => {
        if (active) setStatus(data);
      })
      .catch(() => {
        if (active) setPageMessage("Não foi possível verificar a disponibilidade da plataforma.");
      });
    return () => { active = false; };
  }, []);

  if (!status) {
    return (
      <section className="py-8">
        <span className="inline-flex items-center gap-2 text-sm text-zinc-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Verificando a disponibilidade
        </span>
        {pageMessage ? <p className="mt-3 text-sm text-red-700">{pageMessage}</p> : null}
      </section>
    );
  }

  if (mode !== "admin") {
    return (
      <section className="grid gap-3 md:grid-cols-3">
        <AvailabilityTile icon={ShieldCheck} title="Identidade" description={status.google.label} available={status.google.connected} />
        <AvailabilityTile icon={BrainCircuit} title="Análise especialista" description={status.intelligence.label} available={status.intelligence.available} />
        <AvailabilityTile icon={DatabaseZap} title="Pesquisa de dados públicos" description={status.publicSources.label} available={status.publicSources.available} />
      </section>
    );
  }

  if (!status.admin) {
    return <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">A sessão administrativa não pôde ser confirmada.</p>;
  }

  return (
    <section className="grid gap-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <AdminConnectorCard provider="gemini" eyebrow="Inteligência da Share AI" name="Google Gemini" credentialLabel="Chave da API Gemini" status={status.admin.gemini} icon={BrainCircuit} onChanged={refreshStatus} />
        <AdminConnectorCard provider="apify" eyebrow="Fonte estruturada" name="Apify" credentialLabel="Token da Apify" status={status.admin.apify} icon={DatabaseZap} onChanged={refreshStatus} />
        <AdminConnectorCard provider="manus" eyebrow="Agente de pesquisa" name="Manus" credentialLabel="Chave da API Manus" status={status.admin.manus} icon={Bot} onChanged={refreshStatus} />
      </div>
      <div className="flex items-start gap-3 rounded-md border border-[var(--share-line)] bg-[#fbfdf8] px-4 py-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--share-green-800)]" />
        <p className="text-sm leading-6 text-zinc-600">
          As credenciais são globais, criptografadas e usadas somente no servidor. No Hunting, Manus é a pesquisa principal e o Apify direto permanece como fallback quando necessário.
        </p>
      </div>
    </section>
  );
}

function AdminConnectorCard({ provider, eyebrow, name, credentialLabel, status, icon: Icon, onChanged }: {
  provider: PlatformProvider;
  eyebrow: string;
  name: string;
  credentialLabel: string;
  status: PublicPlatformCredentialStatus;
  icon: ComponentType<{ className?: string }>;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(!status.configured);
  const [credential, setCredential] = useState("");
  const [busyAction, setBusyAction] = useState<"save" | "test" | "remove" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function request(action: "save" | "test" | "remove") {
    setBusyAction(action);
    setMessage(null);
    try {
      const endpoint = `/api/admin/connectors/${provider}/${action === "test" ? "test" : "credential"}`;
      const response = await fetch(endpoint, {
        method: action === "remove" ? "DELETE" : "POST",
        headers: action === "save" ? { "Content-Type": "application/json" } : undefined,
        body: action === "save" ? JSON.stringify({ credential }) : undefined,
      });
      const payload = (await response.json()) as { message?: string; error?: string };
      setMessage(payload.message ?? payload.error ?? (response.ok ? "Operação concluída." : "Não foi possível concluir a operação."));
      if (response.ok) {
        setCredential("");
        setEditing(false);
        await onChanged();
      }
    } catch {
      setMessage("O serviço está temporariamente indisponível.");
    } finally {
      setBusyAction(null);
    }
  }

  const isBusy = busyAction !== null;
  const connected = status.available;

  return (
    <article className="rounded-lg border border-[var(--share-line)] bg-white p-5 shadow-[0_16px_44px_rgb(0_63_46_/_0.07)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">{eyebrow}</p>
          <h2 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-[var(--share-green-950)]"><Icon className="h-5 w-5" />{name}</h2>
        </div>
        <StatusBadge status={status.status} available={connected} />
      </div>

      <dl className="mt-5 grid gap-2 border-y border-[var(--share-line)] py-4 text-sm">
        <StatusDetail label="Origem" value={sourceLabel(status.source)} />
        <StatusDetail label="Credencial" value={status.masked ?? "Não cadastrada"} />
        <StatusDetail label="Última verificação" value={formatDate(status.lastValidatedAt)} />
      </dl>

      {editing ? (
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-[var(--share-green-950)]">{credentialLabel}</span>
            <input value={credential} onChange={(event) => setCredential(event.target.value)} type="password" autoComplete="off" spellCheck={false} placeholder={credentialPlaceholder(provider)} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] px-3 py-2.5 text-sm outline-none focus:border-[var(--share-green-800)] focus:bg-white" />
          </label>
          <p className="text-xs leading-5 text-zinc-500">Esta credencial será usada pela Share AI para todos os usuários e ficará armazenada de forma criptografada.</p>
          <ProviderLink provider={provider} />
          {provider === "manus" ? (
            <p className="rounded-md bg-[#f3f8f1] px-3 py-2 text-xs leading-5 text-zinc-600">
              Para o fluxo Manus → Apify, mantenha também o conector Apify autorizado na sua conta Manus. Se ele não estiver disponível, a Share AI continua com o Apify direto como fallback.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => request("save")} disabled={isBusy || credential.trim().length < 8} className="share-button-primary inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-50">
              {busyAction === "save" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Validar e ativar
            </button>
            {status.configured ? <button type="button" onClick={() => { setEditing(false); setCredential(""); }} disabled={isBusy} className="rounded-md border border-[var(--share-line)] px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">Cancelar</button> : null}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => request("test")} disabled={isBusy || !status.configured} className="inline-flex items-center gap-2 rounded-md border border-[var(--share-green-800)] px-3 py-2 text-sm font-semibold text-[var(--share-green-900)] hover:bg-[#edf7eb] disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busyAction === "test" ? "animate-spin" : ""}`} />Testar conexão</button>
          <button type="button" onClick={() => setEditing(true)} disabled={isBusy} className="inline-flex items-center gap-2 rounded-md border border-[var(--share-line)] px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"><KeyRound className="h-4 w-4" />{status.configured ? `Trocar ${provider === "apify" ? "token" : "chave"}` : "Adicionar credencial"}</button>
          {status.source === "managed" ? <button type="button" onClick={() => request("remove")} disabled={isBusy} className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4" />Remover</button> : null}
        </div>
      )}

      {message ? <p className="mt-3 rounded-md bg-[#f3f8f1] px-3 py-2 text-sm leading-6 text-[var(--share-green-950)]">{message}</p> : null}
      {status.lastError ? <p className="mt-3 text-sm leading-6 text-amber-800">{status.lastError}</p> : null}
    </article>
  );
}

function ProviderLink({ provider }: { provider: PlatformProvider }) {
  if (provider === "gemini") {
    return <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-[var(--share-green-800)] hover:underline">Abrir o Google AI Studio<ExternalLink className="h-3.5 w-3.5" /></a>;
  }
  if (provider === "apify") {
    return <a href="https://console.apify.com/account/integrations" target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-[var(--share-green-800)] hover:underline">Abrir a área de tokens<ExternalLink className="h-3.5 w-3.5" /></a>;
  }
  return <a href="https://manus.im/app" target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-[var(--share-green-800)] hover:underline">Abrir o Manus<ExternalLink className="h-3.5 w-3.5" /></a>;
}

function credentialPlaceholder(provider: PlatformProvider) {
  if (provider === "gemini") return "AIza...";
  if (provider === "apify") return "apify_api_...";
  return "Cole a chave criada no Manus";
}

function AvailabilityTile({ icon: Icon, title, description, available }: { icon: ComponentType<{ className?: string }>; title: string; description: string; available: boolean }) {
  return (
    <article className={`rounded-lg border p-5 ${available ? "border-[var(--share-green-800)] bg-[#f2faef]" : "border-amber-200 bg-white"}`}>
      <div className="flex items-center justify-between gap-3"><Icon className={`h-5 w-5 ${available ? "text-[var(--share-green-800)]" : "text-amber-700"}`} />{available ? <CheckCircle2 className="h-4 w-4 text-[var(--share-green-800)]" /> : <XCircle className="h-4 w-4 text-amber-700" />}</div>
      <h2 className="mt-4 text-lg font-semibold text-[var(--share-green-950)]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
    </article>
  );
}

function StatusBadge({ status, available }: { status: PlatformCredentialHealth; available: boolean }) {
  const label = available ? "Conectado" : status === "limit_reached" ? "Limite atingido" : status === "error" ? "Erro" : "Desconectado";
  const tone = available ? "bg-[#edf7eb] text-[var(--share-green-900)]" : status === "error" || status === "limit_reached" ? "bg-amber-50 text-amber-800" : "bg-zinc-100 text-zinc-600";
  return <span className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${tone}`}>{label}</span>;
}

function StatusDetail({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><dt className="text-zinc-500">{label}</dt><dd className="text-right font-medium text-zinc-800">{value}</dd></div>;
}

function sourceLabel(source: PlatformCredentialSource) {
  if (source === "managed") return "Credencial administrada";
  if (source === "environment") return "Configuração de emergência";
  return "Sem configuração";
}

function formatDate(value: Date | string | null) {
  if (!value) return "Ainda não verificada";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}
