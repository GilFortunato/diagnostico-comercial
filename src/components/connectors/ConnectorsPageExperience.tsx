"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, LockKeyhole, Network, ShieldCheck } from "lucide-react";
import { LoginButton } from "@/components/auth/LoginButton";
import { ConnectorReadiness } from "@/components/connectors/ConnectorReadiness";

export function ConnectorsPageExperience({ mode = "status", isAdminUser = false }: { mode?: "status" | "setup" | "admin"; isAdminUser?: boolean }) {
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
          <p className="mt-8 text-xs font-semibold uppercase text-[var(--share-lime)]">{isAdmin ? "Administração da plataforma" : "Recuperação de conexão"}</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight md:text-5xl">
            {isAdmin ? "Conexões globais da Share AI." : "Teste novamente antes de interromper seu trabalho."}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-white/74">
            {isAdmin
              ? "Valide e gerencie as credenciais usadas pela inteligência e pelas fontes públicas, sem depender de novo deploy."
              : "Esta tela não expõe chaves nem configurações técnicas. Você pode testar novamente os recursos da plataforma e continuar assim que a conexão for restabelecida."}
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

        {!isAdmin && isAdminUser ? (
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--share-line)] bg-white p-5">
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Acesso administrativo</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--share-green-950)]">Precisa substituir uma chave?</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-600">A troca de credenciais fica restrita ao Admin.</p>
            </div>
            <Link href="/admin/connectors" className="inline-flex items-center gap-2 rounded-md border border-[var(--share-green-800)] px-4 py-2 text-sm font-semibold text-[var(--share-green-900)] hover:bg-[#edf7eb]">
              Ir para Admin <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        ) : null}
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
