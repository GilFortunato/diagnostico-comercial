"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bookmark, Check, ImageIcon, Search } from "lucide-react";

const sources = ["Pexels", "Unsplash", "Pixabay", "Pexels", "Unsplash", "Pixabay"];
const notes = [
  "espaço negativo à esquerda",
  "boa diversidade e naturalidade",
  "composição limpa 16:9",
  "bom contexto corporativo",
  "estética humana",
  "boa área para headline",
];

export function VisualScoutClient() {
  const params = useSearchParams();
  const initial = params.get("q") || "";
  const [query, setQuery] = useState(initial);
  const [searched, setSearched] = useState(Boolean(initial));
  const [selected, setSelected] = useState<number[]>([]);

  const results = useMemo(
    () => Array.from({ length: 6 }, (_, i) => ({ id: i + 1, source: sources[i], score: 94 - i * 3, note: notes[i] })),
    []
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    setSearched(true);
  }

  function toggle(id: number) {
    setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  return (
    <>
      <form onSubmit={submit} className="share-card rounded-2xl p-6">
        <label className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Briefing visual</label>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px]">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
            placeholder="Ex.: mulher em tecnologia, ambiente corporativo natural, diversidade, horizontal 16:9 e espaço negativo à esquerda..."
            className="resize-none rounded-xl border border-[var(--share-line)] bg-[#fafcf8] px-4 py-3 text-sm outline-none focus:border-[var(--share-green-700)]"
          />
          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--share-lime)] px-5 py-3 text-sm font-bold text-[var(--share-green-950)]">
            <Search className="h-4 w-4" />
            Buscar referências
          </button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          MVP: a experiência de busca já está pronta; os bancos externos entram na próxima etapa via conectores/API.
        </p>
      </form>

      {searched ? (
        <section className="mt-8">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold text-[var(--share-green-950)]">Resultados recomendados</h2>
            <span className="rounded-full bg-[#edf7eb] px-3 py-2 text-xs font-semibold text-[var(--share-green-900)]">Pexels + Unsplash + Pixabay</span>
            <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-zinc-600">Horizontal</span>
            <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-zinc-600">Natural</span>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {results.map((item) => {
              const active = selected.includes(item.id);
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  className={`overflow-hidden rounded-2xl border bg-white text-left transition ${active ? "border-[var(--share-green-700)] ring-2 ring-[var(--share-mint)]" : "border-[var(--share-line)]"}`}
                >
                  <div className="m-3 flex h-36 items-center justify-center rounded-xl bg-gradient-to-br from-[#d7e7dd] to-[#e8ece5]">
                    <ImageIcon className="h-8 w-8 text-[var(--share-green-700)]" />
                  </div>
                  <div className="p-4 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-[var(--share-mint)] px-3 py-1 text-xs font-bold text-[var(--share-green-950)]">{item.score}%</span>
                      {active ? <Check className="h-5 w-5 text-[var(--share-green-700)]" /> : null}
                    </div>
                    <p className="mt-3 text-sm font-semibold text-[var(--share-green-950)]">{item.source}</p>
                    <p className="mt-1 text-xs text-zinc-500">{item.note}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="sticky bottom-4 mt-7 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--share-green-950)] p-4 text-white shadow-xl">
            <span className="text-sm font-semibold">{selected.length} referências selecionadas</span>
            <button className="inline-flex items-center gap-2 rounded-lg bg-[var(--share-lime)] px-4 py-2 text-sm font-bold text-[var(--share-green-950)]">
              <Bookmark className="h-4 w-4" /> Salvar coleção
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
