"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, RefreshCw, ShieldCheck, Unplug } from "lucide-react";

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

export function ConnectorStatusSummary() {
  const [status, setStatus] = useState<ConnectorStatus | null>(null);

  useEffect(() => {
    fetch("/api/connectors/status")
      .then((response) => response.json())
      .then((data: ConnectorStatus) => setStatus(data))
      .catch(() => setStatus(null));
  }, []);

  const connectedCount = useMemo(() => {
    if (!status) return 0;
    return [status.google.connected, status.gemini.connected, status.apify.connected].filter(Boolean).length;
  }, [status]);

  const isReady = Boolean(status?.google.connected && status.gemini.connected && status.apify.connected);

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

  return (
    <section className="relative overflow-hidden rounded-lg border border-[var(--share-line)] bg-[var(--share-green-950)] p-5 text-white shadow-[0_24px_80px_rgb(0_63_46_/_0.16)]">
      <div className="absolute right-6 top-6 h-24 w-24 rounded-full border border-white/12" />
      <div className="absolute right-14 top-14 h-10 w-10 rounded-full border border-[var(--share-lime)]/50" />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className={`flex h-12 w-12 items-center justify-center rounded-md ${isReady ? "bg-[var(--share-lime)] text-[var(--share-green-950)]" : "bg-white/12 text-white"}`}>
            {isReady ? <CheckCircle2 className="h-6 w-6" /> : <Unplug className="h-6 w-6" />}
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-lime)]">Status dos conectores</p>
            <h2 className="mt-1 text-2xl font-semibold">{isReady ? "Conectores ligados" : "Conectores desligados"}</h2>
            <p className="mt-1 text-sm leading-6 text-white/72">
              {isReady
                ? "Google, Gemini e LinkedIn via Apify prontos para o diagnóstico."
                : "Falta ativar Gemini e/ou LinkedIn via Apify antes da analise completa."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white">
            {connectedCount}/3 ativos
          </span>
          <Link
            href="/conectores"
            className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-[var(--share-green-950)] transition hover:bg-[var(--share-lime)]"
          >
            Configurar
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <div className="relative mt-5 grid gap-2 sm:grid-cols-3">
        <CompactStep label="Google" connected={status.google.connected} />
        <CompactStep label="Gemini" connected={status.gemini.connected} />
        <CompactStep label="LinkedIn" connected={status.apify.connected} />
      </div>
    </section>
  );
}

function CompactStep({ label, connected }: { label: string; connected: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-white/12 bg-white/8 px-3 py-2">
      <span className="inline-flex items-center gap-2 text-sm font-medium text-white/86">
        <ShieldCheck className={connected ? "h-4 w-4 text-[var(--share-lime)]" : "h-4 w-4 text-white/40"} />
        {label}
      </span>
      <span className={connected ? "text-xs font-semibold text-[var(--share-lime)]" : "text-xs font-semibold text-white/45"}>
        {connected ? "Ligado" : "Desligado"}
      </span>
    </div>
  );
}
