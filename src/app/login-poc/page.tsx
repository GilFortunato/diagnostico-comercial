"use client";

import Image from "next/image";
import { ArrowRight, LockKeyhole, Sparkles } from "lucide-react";
import { signIn } from "next-auth/react";
import { NexusBackground } from "@/components/app/NexusBackground";

export default function LoginPocPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#021812] text-white">
      <NexusBackground />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_30%,rgba(21,120,79,.2),transparent_34rem),linear-gradient(120deg,rgba(0,18,13,.12),rgba(0,18,13,.7))]" />

      <div className="relative z-10 mx-auto grid min-h-screen max-w-7xl items-center gap-14 px-6 py-10 lg:grid-cols-[1.12fr_.88fr] lg:px-10">
        <section className="max-w-3xl">
          <div className="mb-12 flex items-center gap-4">
            <Image
              src="/brand/share-people-hub-white.svg"
              alt="Share People Hub"
              width={190}
              height={92}
              priority
              className="h-auto w-[160px] opacity-90"
            />
          </div>

          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-[.22em] text-[#cce95b]">Share AI</p>
            <p className="mt-2 text-sm text-white/58">A hub da Share People Hub</p>
          </div>

          <h1 className="max-w-3xl font-serif text-[clamp(48px,6vw,82px)] font-bold leading-[.94] tracking-[-.045em]">
            Inteligência para
            <br />
            <span className="text-[#d9ef74]">pessoas e negócios.</span>
          </h1>

          <p className="mt-7 max-w-xl text-base leading-7 text-white/68 md:text-lg">
            Um único acesso para conectar recrutamento, negócios, marketing, relacionamento e desenvolvimento em workspaces inteligentes.
          </p>

          <div className="mt-9 flex flex-wrap gap-3 text-sm text-white/70">
            {["HR Hunting","B2B Hunting","MKT Scout","Humanship"].map((item) => (
              <span key={item} className="rounded-full border border-white/10 bg-white/[.045] px-4 py-2">{item}</span>
            ))}
          </div>
        </section>

        <section className="relative">
          <div className="absolute -inset-8 rounded-[42px] bg-[#7bd993]/[.06] blur-3xl" />
          <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#06291f]/92 shadow-[0_35px_100px_rgba(0,0,0,.34)] backdrop-blur-xl">
            <div className="border-b border-white/8 px-8 py-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#cce95b]">Acesso</p>
                  <h2 className="mt-2 text-3xl font-semibold">Entrar na Share AI</h2>
                </div>
                <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[.045]">
                  <Sparkles className="h-5 w-5 text-[#d9ef74]" />
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-white/58">
                Use sua conta Google autorizada para acessar os workspaces liberados para você.
              </p>
            </div>

            <div className="px-8 py-8">
              <button
                type="button"
                onClick={() => signIn("google", { callbackUrl: "/" })}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#d9ef74] px-5 py-4 text-sm font-bold text-[#073122] transition hover:bg-[#e7f79a]"
              >
                Continuar com Google
                <ArrowRight className="h-4 w-4" />
              </button>

              <div className="mt-6 flex items-start gap-3 rounded-xl border border-white/8 bg-white/[.035] p-4 text-xs leading-5 text-white/48">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-white/55" />
                <p>Seu acesso respeita as permissões dos workspaces disponíveis para sua conta.</p>
              </div>
            </div>

            <div className="border-t border-white/8 px-8 py-5 text-center text-xs text-white/34">
              Share AI · uma experiência Share People Hub
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
