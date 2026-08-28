"use client";

import { useEffect, useState } from "react";
import { Brain, CheckCircle2, Link, LockKeyhole, RefreshCw } from "lucide-react";

type ConnectorStatus = {
  google: { connected: boolean; label: string };
  gemini: { connected: boolean; label: string; mode: string };
  linkedin: { connected: boolean; label: string; mode: string };
};

export function ConnectorReadiness() {
  const [status, setStatus] = useState<ConnectorStatus | null>(null);

  useEffect(() => {
    fetch("/api/connectors/status")
      .then((response) => response.json())
      .then((data: ConnectorStatus) => setStatus(data))
      .catch(() => setStatus(null));
  }, []);

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
          description={status.gemini.connected ? "As respostas do diagnostico passam pelo provider Gemini." : "Adicione GEMINI_API_KEY na Vercel e faca redeploy."}
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
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Para o Gemini analisar de verdade, salve `GEMINI_API_KEY` nas variaveis da Vercel. Sem isso, o sistema usa o motor local de diagnostico.
        </div>
      ) : null}
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
