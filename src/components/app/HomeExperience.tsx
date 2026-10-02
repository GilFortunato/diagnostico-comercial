"use client";

import Link from "next/link";
import {
  BrainCircuit,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ImageSearch,
  Search,
  Sparkles,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { AppHeader } from "@/components/app/AppHeader";
import { LoginButton } from "@/components/auth/LoginButton";
import { NeuralNetworkVisual } from "@/components/app/NeuralNetworkVisual";
import type { PlatformModule } from "@/lib/auth/moduleAccessPolicy";

type AccessMap = Partial<Record<PlatformModule, boolean>>;

type Product = {
  title: string;
  eyebrow: string;
  description: string;
  href: string;
  module: PlatformModule;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

const products: Product[] = [
  {
    title: "Diagnóstico Comercial",
    eyebrow: "Autoridade",
    description: "Leia posicionamento, autoridade, lacunas e próximos passos para transformar presença digital em ação.",
    href: "/diagnostico",
    module: "authority.personal",
    icon: BrainCircuit,
  },
  {
    title: "B2B Hunting",
    eyebrow: "Comercial",
    description: "Mapeie empresas, decisores e oportunidades para orientar prospecção e estratégia comercial.",
    href: "/mapa-decisores",
    module: "decision.makers",
    icon: Building2,
  },
  {
    title: "HR Hunting",
    eyebrow: "Pessoas",
    description: "Busque, filtre e organize perfis para acelerar recrutamento e construção de shortlists.",
    href: "/hr-hunting",
    module: "hr.hunting",
    icon: Search,
  },
  {
    title: "Humanship",
    eyebrow: "Pessoas",
    description: "Transforme contexto humano, relacionamento e dados de pessoas em inteligência acionável.",
    href: "/humanship",
    module: "humanship.r1ship",
    icon: UsersRound,
  },
  {
    title: "Share Visual Scout",
    eyebrow: "Criatividade",
    description: "Encontre e selecione imagens aderentes ao briefing em múltiplos bancos visuais.",
    href: "/sharevisualscout",
    module: "creative.visual-scout",
    icon: ImageSearch,
    badge: "Novo",
  },
  {
    title: "Share Trend Intelligence",
    eyebrow: "Criatividade",
    description: "Descubra sinais em alta, gere pautas e envie o briefing visual direto para o Visual Scout.",
    href: "/sharetrendintelligence",
    module: "creative.trend-intelligence",
    icon: TrendingUp,
    badge: "Novo",
  },
];

export function HomeExperience({
  isAdmin = false,
  access = {},
  userName,
}: {
  isAdmin?: boolean;
  access?: AccessMap;
  userName?: string | null;
}) {
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user);

  if (!isAuthenticated) {
    return (
      <main className="share-shell min-h-screen text-[var(--share-ink)]">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-5 py-8">
          <div className="mb-6 flex items-end gap-3">
            <span className="share-wordmark text-5xl text-[var(--share-green-950)]">share</span>
            <span className="pb-1 text-xs font-semibold uppercase text-[var(--share-green-800)]">AI</span>
          </div>

          <section className="relative overflow-hidden rounded-2xl bg-[var(--share-green-950)] text-white shadow-[0_28px_90px_rgb(0_63_46_/_0.18)]">
            <NeuralNetworkVisual />
            <div className="relative z-10 grid min-h-[520px] lg:grid-cols-[1fr_390px]">
              <div className="flex flex-col justify-center p-8 md:p-12">
                <div className="h-2 w-52 rounded-r bg-[var(--share-lime)]" />
                <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--share-lime)]">Share AI Workspace</p>
                <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
                  Inteligência conectada para transformar contexto em ação.
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-7 text-white/75">
                  Diagnóstico, hunting, inteligência comercial e criatividade em uma única plataforma, com acesso organizado por produto.
                </p>
              </div>

              <aside className="m-6 flex flex-col justify-between rounded-2xl border border-white/15 bg-white/10 p-7 backdrop-blur-md lg:m-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-lime)]">Acesso com Google</p>
                  <h2 className="mt-3 text-3xl font-semibold">Entre no seu workspace</h2>
                  <div className="mt-6 grid gap-3 text-sm leading-6 text-white/75">
                    <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[var(--share-lime)]" />Um login para todos os produtos liberados</span>
                    <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[var(--share-lime)]" />Permissões individuais por módulo</span>
                    <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[var(--share-lime)]" />Experiências especializadas conectadas pela Share AI</span>
                  </div>
                </div>
                <div className="mt-8"><LoginButton label="Acessar Share AI" /></div>
              </aside>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const available = products.filter((product) => isAdmin || access[product.module]);

  return (
    <main className="share-shell min-h-screen text-[var(--share-ink)]">
      <AppHeader isAdmin={isAdmin} />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="relative overflow-hidden rounded-2xl bg-[var(--share-green-950)] text-white shadow-[0_26px_80px_rgb(0_63_46_/_0.16)]">
          <NeuralNetworkVisual />
          <div className="relative z-10 grid min-h-[310px] items-center gap-8 p-7 md:p-10 lg:grid-cols-[1fr_360px]">
            <div>
              <div className="h-2 w-56 rounded-r bg-[var(--share-lime)]" />
              <p className="mt-7 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--share-lime)]">Share AI Workspace</p>
              <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">
                {userName ? `Olá, ${firstName(userName)}.` : "Olá."} O que você quer fazer hoje?
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/75">
                Escolha um produto e entre direto no workspace. A Home agora é o ponto de partida de toda a inteligência da Share.
              </p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md">
              <Sparkles className="h-5 w-5 text-[var(--share-lime)]" />
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-white/60">Seu ambiente</p>
              <p className="mt-2 text-3xl font-semibold">{available.length}</p>
              <p className="mt-1 text-sm text-white/70">produto{available.length === 1 ? "" : "s"} liberado{available.length === 1 ? "" : "s"} para sua conta</p>
              <p className="mt-5 text-xs leading-5 text-white/55">A administração de acessos continua centralizada e cada pessoa visualiza apenas o que foi liberado.</p>
            </div>
          </div>
        </section>

        <section className="mt-9">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--share-green-800)]">Seus produtos</p>
              <h2 className="mt-2 text-3xl font-semibold text-[var(--share-green-950)]">Escolha um workspace</h2>
              <p className="mt-2 text-sm text-zinc-600">Cada produto concentra sua própria jornada, dados e ferramentas.</p>
            </div>
            {isAdmin ? (
              <Link href="/admin/users" className="rounded-xl border border-[var(--share-line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--share-green-900)] hover:border-[var(--share-green-700)]">
                Gerenciar acessos
              </Link>
            ) : null}
          </div>

          {available.length ? (
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {available.map((product) => <ProductCard key={product.href} product={product} />)}
            </div>
          ) : (
            <div className="share-card mt-6 rounded-2xl p-8">
              <BriefcaseBusiness className="h-7 w-7 text-[var(--share-green-700)]" />
              <h3 className="mt-4 text-xl font-semibold text-[var(--share-green-950)]">Nenhum produto liberado ainda</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">Seu login está ativo, mas um administrador precisa liberar ao menos um workspace para sua conta.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ProductCard({ product }: { product: Product }) {
  const Icon = product.icon;
  return (
    <Link href={product.href} className="group share-product-card relative overflow-hidden rounded-2xl border border-[var(--share-line)] bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#edf7eb] text-[var(--share-green-800)] transition group-hover:bg-[var(--share-lime)] group-hover:text-[var(--share-green-950)]">
          <Icon className="h-5 w-5" />
        </span>
        {product.badge ? <span className="rounded-full bg-[var(--share-mint)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--share-green-950)]">{product.badge}</span> : null}
      </div>
      <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--share-green-700)]">{product.eyebrow}</p>
      <h3 className="mt-2 text-xl font-semibold text-[var(--share-green-950)]">{product.title}</h3>
      <p className="mt-3 min-h-16 text-sm leading-6 text-zinc-600">{product.description}</p>
      <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--share-green-800)]">
        Abrir workspace <span className="transition-transform group-hover:translate-x-1">→</span>
      </span>
    </Link>
  );
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || value;
}
