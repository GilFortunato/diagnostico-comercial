import { ArrowLeft, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const steps = [
  {
    title: "Abra a área de chaves",
    description: "Entre no Google AI Studio e acesse Chaves de API. Se não houver projeto importado, clique em Importar projetos ou crie uma nova chave.",
    image: "/guides/gemini/gemini-step-1.png",
    width: 1830,
    height: 679,
  },
  {
    title: "Crie ou escolha um projeto",
    description: "Dê um nome simples ao projeto. Esse projeto será usado pelo Google para organizar a chave e o uso da API.",
    image: "/guides/gemini/gemini-step-2.png",
    width: 568,
    height: 229,
  },
  {
    title: "Crie a chave de API",
    description: "Nomeie a chave, selecione o projeto importado e confirme em Criar chave.",
    image: "/guides/gemini/gemini-step-3.png",
    width: 600,
    height: 361,
  },
  {
    title: "Copie a chave",
    description: "Clique em Copiar chave e volte ao Share AI para colar no campo Conectar Gemini.",
    image: "/guides/gemini/gemini-step-4.png",
    width: 633,
    height: 633,
  },
];

export default function GeminiHelpPage() {
  return (
    <main className="share-shell min-h-screen text-[var(--share-ink)]">
      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2 rounded-md border border-[var(--share-line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--share-green-900)] hover:bg-[#edf7eb]">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <a
            href="https://aistudio.google.com/api-keys"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-[var(--share-green-950)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--share-green-800)]"
          >
            Abrir Google AI Studio
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <section className="share-green-panel rounded-lg p-6 text-white md:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-lime)]">Conectar Gemini</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-semibold leading-tight">Como pegar sua chave Gemini</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-white/78">
            Cada usuário conecta a própria chave. Ela é validada no Google e guardada de forma protegida na Share AI.
          </p>
        </section>

        <div className="grid gap-5">
          {steps.map((step, index) => (
            <article key={step.title} className="share-card overflow-hidden rounded-lg">
              <div className="grid gap-0 lg:grid-cols-[300px_1fr]">
                <div className="p-5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[var(--share-lime)] text-sm font-bold text-[var(--share-green-950)]">
                    {index + 1}
                  </span>
                  <h2 className="mt-4 text-2xl font-semibold text-[var(--share-green-950)]">{step.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-zinc-600">{step.description}</p>
                </div>
                <div className="border-t border-[var(--share-line)] bg-[#111] lg:border-l lg:border-t-0">
                  <Image src={step.image} alt={step.title} width={step.width} height={step.height} className="h-full w-full object-contain" />
                </div>
              </div>
            </article>
          ))}
        </div>

        <section className="share-card rounded-lg p-5">
          <h2 className="text-xl font-semibold text-[var(--share-green-950)]">Depois de copiar</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Volte ao Share AI, cole a chave no card Conectar Gemini e clique em Conectar Gemini. Se o Google aceitar a chave, o diagnóstico passa a usar Gemini.
          </p>
        </section>
      </div>
    </main>
  );
}
