"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { ArrowLeft, KeyRound, Network, ShieldCheck } from "lucide-react";
import { LoginButton } from "@/components/auth/LoginButton";
import { ConnectorReadiness } from "@/components/connectors/ConnectorReadiness";

export function ConnectorsPageExperience() {
  return (
    <main className="share-shell min-h-screen text-[var(--share-ink)]">
      <header className="border-b border-white/15 bg-[var(--share-green-950)]/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-3">
          <Link href="/" className="inline-flex items-center gap-3 text-white">
            <ArrowLeft className="h-4 w-4 text-[var(--share-lime)]" />
            <span className="share-wordmark text-4xl">share</span>
            <span className="pb-1 text-xs font-semibold uppercase leading-3 text-[var(--share-lime)]">AI</span>
          </Link>
          <LoginButton />
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8">
        <section className="relative overflow-hidden rounded-lg bg-[var(--share-green-950)] p-6 text-white shadow-[0_28px_90px_rgb(0_63_46_/_0.18)] md:p-8">
          <div className="absolute right-10 top-8 h-32 w-32 rounded-full border border-white/10" />
          <div className="absolute right-24 top-20 h-14 w-14 rounded-full border border-[var(--share-lime)]/45" />
          <div className="relative max-w-3xl">
            <div className="h-2 w-56 rounded-r-md bg-[var(--share-lime)]" />
            <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-[var(--share-lime)]">Centro de conexoes</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl">Ative as fontes uma vez. A Share AI decide quando usar.</h1>
            <p className="mt-5 text-base leading-7 text-white/74">
              Google identifica a pessoa. Gemini interpreta os dados autorizados. Apify habilita os conectores publicos de LinkedIn para perfil, posts, empresa e decisores.
            </p>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <ConnectorPrinciple icon={ShieldCheck} title="Consentimento separado" text="Login Google nao vira autorizacao Gemini automaticamente." />
          <ConnectorPrinciple icon={KeyRound} title="Credencial da pessoa" text="Cada usuario informa sua propria chave e pode revogar depois." />
          <ConnectorPrinciple icon={Network} title="Capacidades plugaveis" text="A skill pede dados; o fornecedor pode mudar sem reescrever o fluxo." />
        </section>

        <ConnectorReadiness />
      </div>
    </main>
  );
}

function ConnectorPrinciple({
  icon: Icon,
  title,
  text,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <article className="rounded-lg border border-[var(--share-line)] bg-white p-4 shadow-[0_16px_44px_rgb(0_63_46_/_0.06)]">
      <Icon className="h-5 w-5 text-[var(--share-green-800)]" />
      <h2 className="mt-3 text-base font-semibold text-[var(--share-green-950)]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{text}</p>
    </article>
  );
}
