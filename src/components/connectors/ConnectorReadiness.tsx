"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Brain, CheckCircle2, ExternalLink, Link, LockKeyhole, RefreshCw, Trash2 } from "lucide-react";

type ConnectorStatus = {
  google: { connected: boolean; label: string };
  gemini: { connected: boolean; label: string; mode: string };
  linkedin: { connected: boolean; label: string; mode: string };
  apify: {
    connected: boolean;
    label: string;
    actorId: string;
    actors: Array<{
      key: string;
      actorId: string;
      label: string;
      purpose: string;
      stage: "authority" | "rapport" | "decision_maker";
    }>;
  };
};

export function ConnectorReadiness() {
  const [status, setStatus] = useState<ConnectorStatus | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [apifyToken, setApifyToken] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const response = await fetch("/api/connectors/status");
    const data = (await response.json()) as ConnectorStatus;
    setStatus(data);
  }, []);

  useEffect(() => {
    fetch("/api/connectors/status")
      .then((response) => response.json())
      .then((data: ConnectorStatus) => setStatus(data))
      .catch(() => setStatus(null));
  }, []);

  async function disconnectGemini() {
    setIsSaving(true);
    setMessage(null);

    try {
      await fetch("/api/connectors/gemini/credential", { method: "DELETE" });
      setMessage("Gemini desconectado deste usuario.");
      await refreshStatus();
    } finally {
      setIsSaving(false);
    }
  }

  async function connectWorkspace() {
    setIsSaving(true);
    setMessage(null);

    const tasks: Promise<void>[] = [];

    if (!status?.gemini.connected && geminiApiKey.trim()) {
      tasks.push(connectCredential("/api/connectors/gemini/credential", { apiKey: geminiApiKey.trim() }, "Gemini"));
    }

    if (!status?.apify.connected && apifyToken.trim()) {
      tasks.push(connectCredential("/api/connectors/apify/credential", { token: apifyToken.trim() }, "Apify"));
    }

    try {
      if (!tasks.length) {
        setMessage("Cole a chave Gemini e o token Apify para conectar a base completa.");
        return;
      }

      await Promise.all(tasks);
      setGeminiApiKey("");
      setApifyToken("");
      setMessage("Conexoes salvas. A plataforma ja sabe quando usar Gemini, perfil, posts, empresa e decisores.");
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel conectar tudo.");
    } finally {
      setIsSaving(false);
    }
  }

  async function disconnectApify() {
    setIsSaving(true);
    setMessage(null);

    try {
      await fetch("/api/connectors/apify/credential", { method: "DELETE" });
      setMessage("Apify desconectado deste usuario.");
      await refreshStatus();
    } finally {
      setIsSaving(false);
    }
  }

  if (!status) {
    return (
      <section className="share-card rounded-lg p-5">
        <span className="inline-flex items-center gap-2 text-sm text-zinc-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Verificando conexoes
        </span>
      </section>
    );
  }

  return (
    <section className="share-card rounded-lg p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Conexoes</p>
          <h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">Fontes e IA do diagnostico</h2>
        </div>
        <span className="rounded-md bg-[#edf7eb] px-3 py-2 text-sm font-semibold text-[var(--share-green-900)]">
          {status.gemini.connected && status.apify.connected ? "Analise pronta" : "Conecte as fontes"}
        </span>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <ConnectorTile
          icon={<CheckCircle2 className="h-4 w-4" />}
          title={status.google.label}
          description="Identifica o usuario e libera o cockpit."
          connected={status.google.connected}
        />
        <ConnectorTile
          icon={<Brain className="h-4 w-4" />}
          title={status.gemini.label}
          description={status.gemini.connected ? "As respostas do diagnostico passam pelo provider Gemini." : "A pessoa conecta a propria chave Gemini para liberar a IA."}
          connected={status.gemini.connected}
        />
        <ConnectorTile
          icon={<Link className="h-4 w-4" />}
          title={status.linkedin.label}
          description={status.linkedin.connected ? "Perfil, posts, empresa e decisores via Actors Apify." : "Conecte Apify para importar dados publicos pela URL."}
          connected={status.linkedin.connected}
        />
      </div>

      {!status.gemini.connected || !status.apify.connected ? (
        <div className="mt-4 grid gap-4 rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4 lg:grid-cols-[320px_1fr]">
          <div className="rounded-md border border-[var(--share-line)] bg-white p-4">
            <p className="text-sm font-semibold text-[var(--share-green-950)]">Ativar base completa</p>
            <ol className="mt-3 grid gap-2 text-sm leading-6 text-zinc-700">
              <li>1. Entre com Google no Share AI.</li>
              <li>2. Pegue a chave Gemini e o token Apify.</li>
              <li>3. Clique em Conectar tudo uma vez.</li>
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href="/ajuda/gemini"
                target="_blank"
                className="inline-flex items-center gap-2 rounded-md border border-[var(--share-green-800)] px-3 py-2 text-sm font-semibold text-[var(--share-green-900)] hover:bg-[#edf7eb]"
              >
                Gemini
                <ExternalLink className="h-4 w-4" />
              </a>
              <a
                href="https://console.apify.com/account/integrations"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-[#0a66c2]/40 px-3 py-2 text-sm font-semibold text-[#0a66c2] hover:bg-[#eef5ff]"
              >
                Apify
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
          <div className="grid content-start gap-3">
            {!status.gemini.connected ? (
              <label className="grid gap-1.5">
                <span className="text-sm font-semibold text-[var(--share-green-950)]">Chave Gemini deste usuario</span>
                <input
                  value={geminiApiKey}
                  onChange={(event) => setGeminiApiKey(event.target.value)}
                  type="password"
                  placeholder="AIza..."
                  className="rounded-md border border-[var(--share-line)] bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[var(--share-green-800)]"
                />
              </label>
            ) : null}
            {!status.apify.connected ? (
              <label className="grid gap-1.5">
                <span className="text-sm font-semibold text-[var(--share-green-950)]">Token Apify deste usuario</span>
                <input
                  value={apifyToken}
                  onChange={(event) => setApifyToken(event.target.value)}
                  type="password"
                  placeholder="apify_api_..."
                  className="rounded-md border border-[var(--share-line)] bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[#0a66c2]"
                />
              </label>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={connectWorkspace}
                disabled={isSaving || (!geminiApiKey.trim() && !apifyToken.trim())}
                className="share-button-primary inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Conectar tudo
              </button>
              <p className="text-sm leading-6 text-zinc-600">Depois disso, a plataforma usa cada conector quando o fluxo precisar.</p>
            </div>
          </div>
        </div>
      ) : null}
      {status.gemini.connected ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--share-line)] bg-[#f2faef] px-4 py-3">
          <p className="text-sm font-medium text-[var(--share-green-950)]">Gemini pronto para analisar os dados autorizados.</p>
          <button
            type="button"
            onClick={disconnectGemini}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-md border border-[var(--share-line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--share-green-900)] hover:bg-[#edf7eb] disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            Desconectar
          </button>
        </div>
      ) : null}
      {status.apify.connected ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#0a66c2]/25 bg-[#f4f8ff] px-4 py-3">
          <p className="text-sm font-medium text-[var(--share-green-950)]">Apify pronto para perfil, posts, empresa e decisores.</p>
          <button
            type="button"
            onClick={disconnectApify}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-md border border-[#0a66c2]/25 bg-white px-3 py-2 text-sm font-semibold text-[#0a66c2] hover:bg-[#eef5ff] disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            Desconectar
          </button>
        </div>
      ) : null}
      <div className="mt-4 grid gap-2">
        <p className="text-sm font-semibold text-[var(--share-green-950)]">Actors preparados</p>
        <div className="grid gap-2 md:grid-cols-2">
          {status.apify.actors.map((actor) => (
            <div key={actor.key} className="rounded-md border border-[var(--share-line)] bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-950">{actor.label}</p>
                <span className="rounded-md bg-[#edf7eb] px-2 py-1 text-xs font-semibold text-[var(--share-green-900)]">
                  {stageLabel(actor.stage)}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-zinc-500">{actor.actorId}</p>
              <p className="mt-2 text-xs leading-5 text-zinc-600">{actor.purpose}</p>
            </div>
          ))}
        </div>
      </div>
      {message ? <p className="mt-3 text-sm font-medium text-[var(--share-green-900)]">{message}</p> : null}
    </section>
  );
}

async function connectCredential(url: string, body: Record<string, string>, label: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as { error?: string };

  if (!response.ok) {
    throw new Error(result.error ?? `Nao foi possivel conectar ${label}.`);
  }
}

function stageLabel(stage: "authority" | "rapport" | "decision_maker") {
  if (stage === "authority") return "Autoridade";
  if (stage === "rapport") return "Rapport";
  return "Decisor";
}

function ConnectorTile({
  icon,
  title,
  description,
  connected,
  neutral = false,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  connected: boolean;
  neutral?: boolean;
}) {
  const tone = connected ? "border-[var(--share-green-800)] bg-[#f2faef] text-[var(--share-green-950)]" : neutral ? "border-[#0a66c2]/25 bg-white text-[#0a66c2]" : "border-amber-200 bg-white text-amber-900";

  return (
    <div className={`rounded-md border p-4 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </span>
        {connected ? <CheckCircle2 className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-600">{description}</p>
    </div>
  );
}
