"use client";

import { signIn } from "next-auth/react";
import { CheckCircle2, Search, TrendingUp } from "lucide-react";

export default function ShareScoutLoginPage() {
  function callbackUrl() {
    const requested = new URLSearchParams(window.location.search).get("next");
    return requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/sharetrendintelligence";
  }

  return (
    <main className="share-shell min-h-screen text-[var(--share-ink)]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-5 py-8">
        <div className="mb-6 flex items-end gap-3">
          <span className="share-wordmark text-5xl text-[var(--share-green-950)]">share</span>
          <span className="pb-1 text-xs font-semibold uppercase text-[var(--share-green-800)]">MKT Scout</span>
        </div>

        <section className="overflow-hidden rounded-2xl border border-[var(--share-line)] bg-white shadow-[0_28px_90px_rgb(0_63_46_/_0.12)]">
          <div className="grid lg:grid-cols-[1fr_440px]">
            <div className="p-8 md:p-10">
              <div className="h-2 w-64 rounded-r bg-[var(--share-lime)]" />
              <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Inteligência criativa da Share</p>
              <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight text-[var(--share-green-950)] md:text-5xl">
                Do que está acontecendo ao que sua marca pode criar.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-600">
                Um workspace para descobrir sinais recentes, entender sua relevância e transformar evidências em conteúdo e direção visual.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <Feature icon={Search} title="Radar" text="Sinais + fontes" />
                <Feature icon={TrendingUp} title="Estratégia" text="Marca + contexto" />
                <Feature icon={CheckCircle2} title="Criação" text="Conteúdo + visual" />
              </div>
            </div>

            <aside className="share-green-panel flex min-h-[460px] flex-col justify-between p-8 text-white">
              <div>
                <div className="h-2 w-44 rounded-r bg-[var(--share-lime)]" />
                <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-[var(--share-lime)]">Acesso com Google</p>
                <h2 className="mt-3 text-3xl font-semibold">Entre no MKT Scout</h2>
                <p className="mt-4 text-sm leading-6 text-white/75">
                  Use sua conta da plataforma para acessar o MKT Scout.
                </p>
                <div className="mt-7 grid gap-3 text-sm text-white/80">
                  <span className="rounded-full bg-white px-4 py-2 font-semibold text-[var(--share-green-950)]">MKT Scout</span>

                </div>
              </div>

              <button
                type="button"
                onClick={() => signIn("google", { callbackUrl: callbackUrl() })}
                className="rounded-lg bg-[var(--share-lime)] px-4 py-3 text-sm font-bold text-[var(--share-green-950)] hover:bg-[#b6ff2e]"
              >
                Continuar com Google
              </button>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function Feature({ icon: Icon, title, text }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-[var(--share-line)] bg-white p-4">
      <Icon className="h-4 w-4 text-[var(--share-green-700)]" />
      <p className="mt-3 text-xs font-semibold uppercase text-[var(--share-green-800)]">{title}</p>
      <p className="mt-2 text-lg font-semibold text-[var(--share-green-950)]">{text}</p>
    </div>
  );
}
