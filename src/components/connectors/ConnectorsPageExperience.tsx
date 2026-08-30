"use client";

import Link from "next/link";
import { ArrowLeft, LockKeyhole, Network, ShieldCheck } from "lucide-react";
import { LoginButton } from "@/components/auth/LoginButton";
import { ConnectorReadiness } from "@/components/connectors/ConnectorReadiness";

export function ConnectorsPageExperience({ mode = "status" }: { mode?: "status" | "setup" | "admin" }) {
  const isAdmin = mode === "admin";

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
        <section className="rounded-lg bg-[var(--share-green-950)] p-6 text-white shadow-[0_28px_90px_rgb(0_63_46_/_0.18)] md:p-8">
          <div className="h-2 w-56 rounded-r-md bg-[var(--share-lime)]" />
          <p className="mt-8 text-xs font-semibold uppercase text-[var(--share-lime)]">{isAdmin ? "Administração da plataforma" : "Disponibilidade"}</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight md:text-5xl">
            {isAdmin ? "Conexões globais da Share AI." : "A plataforma cuida das conexões para você."}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-white/74">
            {isAdmin
              ? "Valide e gerencie as credenciais usadas pela inteligência e pelas fontes públicas, sem depender de novo deploy."
              : "Aqui você acompanha apenas se os recursos necessários estão disponíveis. Chaves e fornecedores ficam protegidos na administração."}
          </p>
        </section>

        {isAdmin ? (
          <section className="grid gap-3 md:grid-cols-3">
            <Principle icon={ShieldCheck} title="Uso global" text="Uma configuração segura atende todos os usuários autorizados." />
            <Principle icon={LockKeyhole} title="Segredo protegido" text="O valor completo nunca retorna ao navegador depois de salvo." />
            <Principle icon={Network} title="Troca imediata" text="Uma credencial validada entra em uso sem novo deploy." />
          </section>
        ) : null}

        <ConnectorReadiness mode={isAdmin ? "admin" : "status"} />
      </div>
    </main>
  );
}

function Principle({ icon: Icon, title, text }: { icon: typeof ShieldCheck; title: string; text: string }) {
  return (
    <article className="rounded-lg border border-[var(--share-line)] bg-white p-4 shadow-[0_16px_44px_rgb(0_63_46_/_0.06)]">
      <Icon className="h-5 w-5 text-[var(--share-green-800)]" />
      <h2 className="mt-3 text-base font-semibold text-[var(--share-green-950)]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{text}</p>
    </article>
  );
}
