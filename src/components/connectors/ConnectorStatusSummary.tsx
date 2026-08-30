"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, RefreshCw, ShieldCheck, Unplug } from "lucide-react";

type ConnectorStatus = {
  google: { connected: boolean; label: string };
  intelligence: { available: boolean; label: string };
  publicSources: { available: boolean; label: string };
};

export function ConnectorStatusSummary() {
  const [status, setStatus] = useState<ConnectorStatus | null>(null);

  useEffect(() => {
    fetch("/api/connectors/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: ConnectorStatus) => setStatus(data))
      .catch(() => setStatus(null));
  }, []);

  if (!status) {
    return <section className="share-card rounded-lg p-5"><span className="inline-flex items-center gap-2 text-sm text-zinc-500"><RefreshCw className="h-4 w-4 animate-spin" />Verificando a disponibilidade</span></section>;
  }

  const availableCount = [status.google.connected, status.intelligence.available, status.publicSources.available].filter(Boolean).length;
  const isReady = availableCount === 3;

  return (
    <section className="rounded-lg border border-[var(--share-line)] bg-[var(--share-green-950)] p-5 text-white shadow-[0_24px_80px_rgb(0_63_46_/_0.16)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className={`flex h-12 w-12 items-center justify-center rounded-md ${isReady ? "bg-[var(--share-lime)] text-[var(--share-green-950)]" : "bg-white/12 text-white"}`}>
            {isReady ? <CheckCircle2 className="h-6 w-6" /> : <Unplug className="h-6 w-6" />}
          </span>
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--share-lime)]">Disponibilidade da plataforma</p>
            <h2 className="mt-1 text-2xl font-semibold">{isReady ? "Recursos disponíveis" : "Alguns recursos estão indisponíveis"}</h2>
            <p className="mt-1 text-sm leading-6 text-white/72">{isReady ? "A Share AI está pronta para pesquisar dados públicos e gerar análises." : "Você pode tentar novamente mais tarde. A configuração técnica é cuidada pela administração."}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold">{availableCount}/3 disponíveis</span>
          <Link href="/conectores" className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-[var(--share-green-950)] transition hover:bg-[var(--share-lime)]">Ver status<ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <CompactStep label="Acesso" available={status.google.connected} />
        <CompactStep label="Análise especialista" available={status.intelligence.available} />
        <CompactStep label="Fontes públicas" available={status.publicSources.available} />
      </div>
    </section>
  );
}

function CompactStep({ label, available }: { label: string; available: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-white/12 bg-white/8 px-3 py-2">
      <span className="inline-flex items-center gap-2 text-sm font-medium text-white/86"><ShieldCheck className={available ? "h-4 w-4 text-[var(--share-lime)]" : "h-4 w-4 text-white/40"} />{label}</span>
      <span className={available ? "text-xs font-semibold text-[var(--share-lime)]" : "text-xs font-semibold text-white/45"}>{available ? "Disponível" : "Indisponível"}</span>
    </div>
  );
}
