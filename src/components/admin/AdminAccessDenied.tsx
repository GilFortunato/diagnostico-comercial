import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { LoginButton } from "@/components/auth/LoginButton";

export function AdminAccessDenied() {
  return (
    <main className="share-shell min-h-screen text-[var(--share-ink)]">
      <header className="border-b border-white/15 bg-[var(--share-green-950)]/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-3">
          <Link href="/" className="inline-flex items-center gap-3 text-white">
            <span className="share-wordmark text-4xl">share</span>
            <span className="pb-1 text-xs font-semibold uppercase leading-3 text-[var(--share-lime)]">AI</span>
          </Link>
          <LoginButton />
        </div>
      </header>

      <section className="mx-auto grid min-h-[70vh] max-w-2xl place-items-center px-5">
        <div className="share-card rounded-lg p-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-amber-50 text-amber-700">
            <ShieldAlert className="h-6 w-6" />
          </span>
          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Acesso admin</p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--share-green-950)]">área restrita</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Esta tela mostra configuracoes internas da Share AI e fica disponível apenas para perfis administradores.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex rounded-md border border-[var(--share-green-800)] px-4 py-2 text-sm font-semibold text-[var(--share-green-900)] hover:bg-[#edf7eb]"
          >
            Voltar ao cockpit
          </Link>
        </div>
      </section>
    </main>
  );
}
