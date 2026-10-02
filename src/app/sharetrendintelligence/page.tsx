import Link from "next/link";
import { redirect } from "next/navigation";
import { ScoutHeader } from "@/components/scout/ScoutHeader";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { getUserModuleAccess } from "@/lib/auth/modulePermissions";

const ideas = [
  ["Carrossel", "5 formas de usar IA sem perder autenticidade", "LinkedIn / Instagram"],
  ["Post", "O que a IA já mudou na rotina corporativa", "LinkedIn"],
  ["Vídeo curto", "IA substitui ou potencializa profissionais?", "Reels / Shorts"],
];

export default async function ShareTrendIntelligencePage() {
  const user = await getSessionUser();
  if (!user) redirect("/share-scout/login?next=/sharetrendintelligence");

  const allowed = await getUserModuleAccess(user, "creative.trend-intelligence");
  if (!allowed) return <AccessDenied />;

  const visualBrief = "Ambiente corporativo moderno, pessoa usando notebook, presença humana, tecnologia sem estética futurista exagerada, diversidade e espaço negativo à esquerda.";

  return (
    <main className="share-shell min-h-screen text-[var(--share-ink)]">
      <ScoutHeader active="trend" />
      <div className="mx-auto max-w-7xl px-5 py-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Share Scout</p>
            <h1 className="mt-2 text-4xl font-semibold text-[var(--share-green-950)]">Share Trend Intelligence</h1>
            <p className="mt-2 max-w-3xl text-zinc-600">Descubra temas relevantes agora e transforme sinais em pautas acionáveis.</p>
          </div>
          <span className="rounded-full border border-[var(--share-line)] bg-white px-4 py-2 text-xs font-semibold text-[var(--share-green-800)]">/sharetrendintelligence</span>
        </div>

        <section className="share-card mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-[#edf7eb] px-4 py-2 text-xs font-semibold text-[var(--share-green-900)]">Brasil</span>
            <span className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-zinc-600">Últimos 7 dias</span>
            <span className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-zinc-600">Marketing</span>
          </div>
          <span className="rounded-lg bg-[var(--share-lime)] px-5 py-3 text-sm font-bold text-[var(--share-green-950)]">MVP de inteligência</span>
        </section>

        <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_420px]">
          <section className="share-green-panel rounded-2xl p-7 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-lime)]">Tendência em destaque</p>
            <h2 className="mt-5 text-4xl font-semibold">IA no ambiente de trabalho</h2>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-white/80">
              Crescimento consistente em buscas e conteúdos sobre produtividade, agentes e uso prático de IA no dia a dia profissional.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {["Em crescimento", "Carreira", "Tecnologia"].map((x) => <span key={x} className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-[var(--share-green-950)]">{x}</span>)}
            </div>
          </section>

          <section className="share-card rounded-2xl p-6">
            <p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Trend Score</p>
            <div className="mt-3 flex items-end gap-5">
              <span className="text-6xl font-semibold text-[var(--share-green-950)]">87</span>
              <p className="pb-2 text-sm text-zinc-600">Alta aderência para conteúdos de Share / Prosper</p>
            </div>
            <div className="mt-6 grid gap-3 text-xs">
              {["Crescimento 92", "Relevância 95", "Aderência 90", "Timing 88"].map((x) => <div key={x} className="rounded-lg bg-[#eef5ec] px-3 py-2 font-semibold text-[var(--share-green-900)]">{x}</div>)}
            </div>
          </section>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_420px]">
          <section>
            <h2 className="text-xl font-semibold text-[var(--share-green-950)]">Oportunidades de publicação</h2>
            <div className="mt-4 grid gap-3">
              {ideas.map(([type, title, channel]) => (
                <article key={title} className="share-card flex flex-wrap items-center justify-between gap-4 rounded-xl p-5">
                  <div className="flex items-center gap-4">
                    <span className="rounded-full bg-[#edf7eb] px-3 py-2 text-xs font-semibold text-[var(--share-green-900)]">{type}</span>
                    <div><p className="font-semibold text-[var(--share-green-950)]">{title}</p><p className="mt-1 text-xs text-zinc-500">{channel}</p></div>
                  </div>
                  <button className="rounded-lg border border-[var(--share-line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--share-green-950)]">Criar pauta</button>
                </article>
              ))}
            </div>
          </section>

          <aside className="share-card rounded-2xl p-6">
            <p className="text-xs font-semibold uppercase text-[var(--share-green-800)]">Do insight à imagem</p>
            <h2 className="mt-4 text-2xl font-semibold text-[var(--share-green-950)]">Briefing visual sugerido</h2>
            <p className="mt-4 text-sm leading-6 text-zinc-600">{visualBrief}</p>
            <p className="mt-6 text-xs font-semibold uppercase text-[var(--share-green-800)]">Termos de busca</p>
            <p className="mt-2 text-sm font-medium text-[var(--share-green-950)]">AI workplace · modern office technology · human centered AI</p>
            <Link
              href={`/sharevisualscout?q=${encodeURIComponent(visualBrief)}`}
              className="mt-6 block rounded-xl bg-[var(--share-lime)] px-4 py-3 text-center text-sm font-bold text-[var(--share-green-950)]"
            >
              Buscar no Visual Scout
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}

function AccessDenied() {
  return (
    <main className="share-shell grid min-h-screen place-items-center p-6">
      <div className="share-card max-w-lg rounded-2xl p-8">
        <h1 className="text-2xl font-semibold text-[var(--share-green-950)]">Módulo ainda não liberado</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">Seu login está ativo, mas sua conta ainda não tem acesso ao Share Trend Intelligence.</p>
      </div>
    </main>
  );
}
