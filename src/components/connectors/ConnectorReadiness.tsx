"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Brain, CheckCircle2, ExternalLink, Link as LinkIcon, LockKeyhole, RefreshCw, Trash2 } from "lucide-react";

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

type ConnectorReadinessMode = "status" | "setup" | "admin";

export function ConnectorReadiness({ mode = "status" }: { mode?: ConnectorReadinessMode }) {
  const [status, setStatus] = useState<ConnectorStatus | null>(null);
  const [apifyToken, setApifyToken] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const response = await fetch("/api/connectors/status");
    const data = (await response.json()) as ConnectorStatus;
    setStatus(data);
  }, []);

  useEffect(() => {
    void refreshStatus().catch(() => setStatus(null));
  }, [refreshStatus]);

  async function connectApify() {
    if (!apifyToken.trim()) return;
    setIsSaving(true);
    setMessage(null);

    try {
      await connectCredential("/api/connectors/apify/credential", { token: apifyToken.trim() }, "fontes públicas");
      setApifyToken("");
      setMessage("Fontes públicas conectadas. A Share AI já pode consultar os dados necessários nos fluxos habilitados.");
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível conectar as fontes públicas.");
    } finally {
      setIsSaving(false);
    }
  }

  async function disconnectApify() {
    setIsSaving(true);
    setMessage(null);

    try {
      await fetch("/api/connectors/apify/credential", { method: "DELETE" });
      setMessage("Fontes públicas desconectadas deste usuário.");
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
          Verificando conexões
        </span>
      </section>
    );
  }

  const showSetup = mode === "setup" || mode === "admin";
  const showAdminDetails = mode === "admin";
  const analysisReady = status.google.connected && status.gemini.connected;

  return (
    <section className="share-card rounded-lg p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Conexões</p>
          <h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">IA e fontes do diagnóstico</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            O login Google identifica você. A inteligência Gemini é fornecida pela Share AI; você não precisa criar nem colar chave de IA. Fontes públicas adicionais podem ser ativadas quando o fluxo precisar delas.
          </p>
        </div>
        <span className={`rounded-md px-3 py-2 text-sm font-semibold ${analysisReady ? "bg-[#edf7eb] text-[var(--share-green-900)]" : "bg-amber-50 text-amber-900"}`}>
          {analysisReady ? "Inteligência pronta" : "IA indisponível"}
        </span>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <ConnectorTile
          icon={<CheckCircle2 className="h-4 w-4" />}
          title={status.google.label}
          description="Identifica o usuário e libera o cockpit."
          connected={status.google.connected}
        />
        <ConnectorTile
          icon={<Brain className="h-4 w-4" />}
          title={status.gemini.label}
          description={status.gemini.connected ? "A IA especialista já está disponível no projeto e não exige configuração individual." : "A IA do projeto está indisponível. A Share AI não gera diagnóstico, plano ou conteúdo especialista até a conexão voltar."}
          connected={status.gemini.connected}
        />
        <ConnectorTile
          icon={<LinkIcon className="h-4 w-4" />}
          title={status.linkedin.label}
          description={status.linkedin.connected ? "Dados públicos necessários podem ser consultados pela fonte conectada." : "Ative a fonte pública para enriquecer perfil, posts, empresas e decisores."}
          connected={status.linkedin.connected}
        />
      </div>

      {mode === "status" ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--share-line)] bg-[#fbfdf8] px-4 py-3">
          <p className="text-sm font-medium text-zinc-700">
            A IA não exige configuração individual. Gerencie apenas as fontes adicionais quando necessário.
          </p>
          <Link
            href="/conectores/configurar"
            className="inline-flex items-center gap-2 rounded-md border border-[var(--share-green-800)] bg-white px-3 py-2 text-sm font-semibold text-[var(--share-green-900)] hover:bg-[#edf7eb]"
          >
            Gerenciar fontes
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}

      {showSetup && !status.gemini.connected ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-950">Inteligência temporariamente indisponível</p>
          <p className="mt-1 text-sm leading-6 text-amber-900">
            Nenhuma chave precisa ser informada por você. A conexão Gemini é administrada pela Share AI. Enquanto ela estiver indisponível, os recursos especialistas ficam bloqueados em vez de gerar respostas genéricas.
          </p>
        </div>
      ) : null}

      {showSetup && !status.apify.connected ? (
        <div className="mt-4 grid gap-4 rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4 lg:grid-cols-[320px_1fr]">
          <div className="rounded-md border border-[var(--share-line)] bg-white p-4">
            <p className="text-sm font-semibold text-[var(--share-green-950)]">Ativar fontes públicas</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Esta conexão é usada apenas nos fluxos que precisam pesquisar informações públicas de perfil, empresa ou decisores.
            </p>
            <a
              href="https://console.apify.com/account/integrations"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-[#0a66c2]/40 px-3 py-2 text-sm font-semibold text-[#0a66c2] hover:bg-[#eef5ff]"
            >
              Abrir Apify
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <div className="grid content-start gap-3">
            <label className="grid gap-1.5">
              <span className="text-sm font-semibold text-[var(--share-green-950)]">Token da fonte pública</span>
              <input
                value={apifyToken}
                onChange={(event) => setApifyToken(event.target.value)}
                type="password"
                placeholder="apify_api_..."
                className="rounded-md border border-[var(--share-line)] bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[#0a66c2]"
              />
            </label>
            <button
              type="button"
              onClick={connectApify}
              disabled={isSaving || !apifyToken.trim()}
              className="share-button-primary inline-flex w-fit items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Conectar fonte
            </button>
          </div>
        </div>
      ) : null}

      {showSetup && status.apify.connected ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#0a66c2]/25 bg-[#f4f8ff] px-4 py-3">
          <p className="text-sm font-medium text-[var(--share-green-950)]">Fontes públicas prontas para perfil, posts, empresas e decisores.</p>
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

      {showAdminDetails ? (
        <div className="mt-4 grid gap-2">
          <p className="text-sm font-semibold text-[var(--share-green-950)]">Fontes técnicas preparadas</p>
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
      ) : null}

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
    throw new Error(result.error ?? `Não foi possível conectar ${label}.`);
  }
}

function stageLabel(stage: "authority" | "rapport" | "decision_maker") {
  if (stage === "authority") return "Autoridade";
  if (stage === "rapport") return "Rapport";
  return "Decisor";
}

function ConnectorTile({ icon, title, description, connected }: { icon: ReactNode; title: string; description: string; connected: boolean }) {
  const tone = connected
    ? "border-[var(--share-green-800)] bg-[#f2faef] text-[var(--share-green-950)]"
    : "border-amber-200 bg-white text-amber-900";

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
