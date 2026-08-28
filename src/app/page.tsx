import { Bot, Building2, CalendarDays, Database, KeyRound, Layers3, LockKeyhole, ShieldCheck, Target, TrendingUp, Workflow } from "lucide-react";
import { AuthorityDiagnostic } from "@/components/diagnostics/AuthorityDiagnostic";
import { connectorCatalog } from "@/lib/connectors/capabilities";
import { aiProviders } from "@/lib/ai/providers";

const foundations = [
  { label: "Next.js + TypeScript", detail: "App Router, API routes e dominio separado.", icon: Layers3 },
  { label: "Vercel", detail: "Projeto pronto para preview/producao via Git ou CLI.", icon: Workflow },
  { label: "PostgreSQL/Neon", detail: "Schema inicial em Prisma para multi-org e historico.", icon: Database },
  { label: "Google Auth", detail: "Login configurado sem assumir autorizacao Gemini.", icon: KeyRound },
  { label: "Credenciais protegidas", detail: "Criptografia backend para conectores.", icon: LockKeyhole },
  { label: "Human-in-the-loop", detail: "Acoes externas exigem aprovacao humana.", icon: ShieldCheck },
];

export default function Home() {
  return (
    <main className="share-shell min-h-screen text-[var(--share-ink)]">
      <header className="sticky top-0 z-20 border-b border-white/15 bg-[var(--share-green-950)]/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-3">
          <div>
            <div className="flex items-end gap-3">
              <span className="share-wordmark text-4xl">share</span>
              <span className="pb-1 text-xs font-semibold uppercase leading-3 text-[var(--share-lime)]">AI</span>
            </div>
            <p className="mt-1 text-sm text-white/72">Sistema operacional de produtividade comercial</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-white/80">
            <span className="rounded-md border border-white/15 px-3 py-2">MVP 0.1</span>
            <span className="rounded-md border border-white/15 px-3 py-2">Autoridade comercial</span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8">
        <section className="share-green-panel overflow-hidden rounded-lg text-white">
          <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-[1fr_420px]">
            <div>
              <div className="h-2 w-64 max-w-full rounded-r-md bg-[var(--share-lime)]" />
              <p className="mt-8 text-sm font-semibold uppercase tracking-wide text-[var(--share-lime)]">Share People Hub</p>
              <h2 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">
                Transforme objetivos comerciais em execução guiada.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-white/78">
                O usuário escolhe a BU, informa o objetivo e a plataforma orquestra contexto, fontes, diagnóstico e próximos passos com aprovação humana nas ações críticas.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <button className="share-button-primary rounded-md px-4 py-2 text-sm font-semibold" type="button">
                  O que devo fazer agora?
                </button>
                <button className="rounded-md border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10" type="button">
                  Ver conectores
                </button>
              </div>
            </div>
            <div className="grid content-between rounded-lg border border-white/15 bg-white/10 p-5">
              <div>
                <p className="text-sm font-medium text-white/70">Cockpit desta semana</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <HeroMetric icon={TrendingUp} label="Score" value="0-100" />
                  <HeroMetric icon={Target} label="Prioridade" value="Perfil" />
                  <HeroMetric icon={CalendarDays} label="Plano" value="30 dias" />
                  <HeroMetric icon={ShieldCheck} label="Aprovacao" value="Ativa" />
                </div>
              </div>
              <p className="mt-6 text-sm leading-6 text-white/70">
                Visual inspirado na apresentacao institucional: verde Share, alto contraste, numeros grandes e acentos por marca.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {foundations.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="share-card rounded-lg p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--share-green-950)] text-[var(--share-lime)]">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 font-semibold">{item.label}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{item.detail}</p>
              </article>
            );
          })}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="share-card rounded-lg p-5">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[var(--share-green-800)]" />
              <h2 className="text-lg font-semibold">Dashboard orientado a acao</h2>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <Metric label="Autoridade atual" value="0-100" detail="Atualizado por diagnostico" />
              <Metric label="Proxima acao" value="Perfil" detail="Headline, Sobre ou prova" />
              <Metric label="Pendencias" value="2" detail="Gemini e fonte publica" />
            </div>
            <button type="button" className="share-button-primary mt-5 rounded-md px-4 py-2 text-sm font-semibold">
              O que devo fazer agora?
            </button>
          </div>

          <div className="share-card rounded-lg p-5">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-[var(--share-green-800)]" />
              <h2 className="text-lg font-semibold">Conectores e providers</h2>
            </div>
            <div className="mt-4 space-y-3">
              {connectorCatalog.map((connector) => (
                <div key={connector.key} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{connector.name}</p>
                    <span className="text-xs text-zinc-500">{connector.status}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-zinc-600">
                    {connector.requiresSeparateConsent ? "Requer consentimento separado." : "Nao substitui consentimentos de outros providers."}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-zinc-500">
              Provider inicial: {aiProviders[0].label}. Resolvido por capacidade, nao hardcoded em skills.
            </p>
          </div>
        </section>

        <AuthorityDiagnostic />
      </div>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md bg-[#f0f6ed] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--share-green-950)]">{value}</p>
      <p className="mt-1 text-sm text-zinc-600">{detail}</p>
    </div>
  );
}

function HeroMetric({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-md bg-white p-4 text-[var(--share-green-950)]">
      <Icon className="h-4 w-4 text-[var(--share-green-700)]" />
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
