"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain, CheckCircle2, ExternalLink, Link, LockKeyhole, RefreshCw, Trash2 } from "lucide-react";

type ConnectorStatus = {
  google: { connected: boolean; label: string };
  gemini: { connected: boolean; label: string; mode: string };
  linkedin: { connected: boolean; label: string; mode: string };
};

export function ConnectorReadiness() {
  const [status, setStatus] = useState<ConnectorStatus | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState("");
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

  async function connectGemini() {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/connectors/gemini/credential", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: geminiApiKey.trim() }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Nao foi possivel conectar Gemini.");
      }

      setGeminiApiKey("");
      setMessage("Gemini conectado para este usuario.");
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel conectar Gemini.");
    } finally {
      setIsSaving(false);
    }
  }

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
          {status.gemini.connected ? "IA ativa" : "IA pendente"}
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
          description={status.linkedin.connected ? "Pronto para evoluir para consentimento LinkedIn." : "Analise por URL publica e conteudo autorizado, sem scraping proibido."}
          connected={status.linkedin.connected}
          neutral={!status.linkedin.connected}
        />
      </div>

      {!status.gemini.connected ? (
        <div className="mt-4 grid gap-4 rounded-md border border-amber-200 bg-amber-50 p-4 lg:grid-cols-[320px_1fr]">
          <div className="rounded-md border border-amber-200 bg-white p-4">
            <p className="text-sm font-semibold text-amber-950">Onde pegar a chave Gemini</p>
            <ol className="mt-3 grid gap-2 text-sm leading-6 text-zinc-700">
              <li>1. Abra o Google AI Studio.</li>
              <li>2. Clique em Create API key.</li>
              <li>3. Copie a chave gerada e cole aqui.</li>
            </ol>
            <a
              href="/ajuda/gemini"
              target="_blank"
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-[var(--share-green-800)] px-3 py-2 text-sm font-semibold text-[var(--share-green-900)] hover:bg-[#edf7eb]"
            >
              Ver passo a passo
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <div className="grid content-start gap-3">
            <label className="grid gap-1.5">
              <span className="text-sm font-semibold text-amber-950">Cole a chave Gemini deste usuario</span>
              <input
                value={geminiApiKey}
                onChange={(event) => setGeminiApiKey(event.target.value)}
                type="password"
                placeholder="AIza..."
                className="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[var(--share-green-800)]"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={connectGemini}
                disabled={isSaving || geminiApiKey.trim().length < 20}
                className="share-button-primary inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                Conectar Gemini
              </button>
              <p className="text-sm leading-6 text-amber-900">A chave e validada no Google e guardada protegida no backend deste navegador.</p>
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
      {message ? <p className="mt-3 text-sm font-medium text-[var(--share-green-900)]">{message}</p> : null}
    </section>
  );
}

function ConnectorTile({
  icon,
  title,
  description,
  connected,
  neutral = false,
}: {
  icon: React.ReactNode;
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
