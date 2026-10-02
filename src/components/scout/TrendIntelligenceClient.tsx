"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDownRight, ArrowUpRight, Clock3, Radar, RefreshCw, Search } from "lucide-react";
import { BRANDS, getBrandContext } from "@/lib/scout/mkt/brands";
import type { BrandId, SourceStatus, Trend } from "@/lib/scout/mkt/types";
import { TrendDetail } from "./TrendDetail";
import { SavedGeneration } from "./SavedGeneration";
import { formatScoutDate, scoutRequest } from "./scoutClient";
import styles from "./MktScout.module.css";

export type RadarResponse = {
  trends: Trend[];
  sources: SourceStatus[];
  collectedAt: string;
  cache: { status: "fresh" | "cached" | "stale"; persistent: boolean; message?: string };
  visualSearchAvailable: boolean;
};
const sourceTypeLabels = { search: "Busca", news: "Notícias", community: "Comunidades", video: "Vídeo" };
const statusLabels = { ok: "Disponível", empty: "Sem sinais recentes", unavailable: "Indisponível", stale: "Coleta anterior" };

export function TrendIntelligenceClient({ initialGenerationId, initialQuery = "" }: { initialGenerationId?: string; initialQuery?: string } = {}) {
  const [savedGenerationId, setSavedGenerationId] = useState(initialGenerationId);
  const [brandId, setBrandId] = useState<BrandId>("share");
  const [query, setQuery] = useState(initialQuery);
  const [draft, setDraft] = useState(initialQuery);
  const [revision, setRevision] = useState(0);
  const [searchError, setSearchError] = useState<string | null>(null);
  const brand = getBrandContext(brandId);

  function search(event: FormEvent) {
    event.preventDefault();
    const term = draft.trim();
    if (term.length < 2) { setSearchError("Digite pelo menos 2 caracteres para pesquisar um tema."); return; }
    setSearchError(null);
    setQuery(term);
    setRevision((value) => value + 1);
  }

  return (
    <div className={styles.workspace}>
      {savedGenerationId ? <SavedGeneration id={savedGenerationId} onClose={() => { setSavedGenerationId(undefined); const url = new URL(window.location.href); url.searchParams.delete("generation"); window.history.replaceState(null, "", url); }} /> : null}
      <section className={styles.hero} aria-labelledby="scout-radar-heading">
        <div>
          <p className={styles.eyebrow}>Radar de sinais · Brasil e mundo</p>
          <h2 id="scout-radar-heading">O que está em<br className="hidden sm:block" /> movimento agora</h2>
          <p>Sinais recentes, contexto para a sua marca e caminhos para criar. Comece pelo que está acontecendo.</p>
        </div>
        <div className={styles.context}>
          <label htmlFor="scout-brand">Contexto da marca</label>
          <select id="scout-brand" value={brandId} onChange={(event) => setBrandId(event.target.value as BrandId)}>
            {BRANDS.filter((item) => item.id !== "ache").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <p>O mesmo sinal. Uma leitura para {brand.name}.</p>
        </div>
      </section>
      <div className={styles.toolbar}>
        <span className={styles.meta}><span className={styles.dot} /> Fontes públicas · Evidências rastreáveis</span>
        <button type="button" className={styles.secondary} onClick={() => setRevision((value) => value + 1)}><RefreshCw size={13} aria-hidden="true" /> Atualizar radar</button>
      </div>
      <details className={styles.search}>
        <summary><Search size={13} aria-hidden="true" className="mr-2 inline" />Pesquisar um tema específico</summary>
        <form onSubmit={search}>
          <label htmlFor="scout-query">Tema para investigar<input id="scout-query" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={120} placeholder="Ex.: inteligência artificial no trabalho" aria-describedby={searchError ? "scout-search-error" : undefined} /></label>
          <button className={styles.primary} type="submit"><Search size={14} aria-hidden="true" /> Pesquisar</button>
        </form>
        {searchError ? <p id="scout-search-error" role="alert" className={styles.notice}>{searchError}</p> : null}
      </details>
      {query ? <div className={styles.searchActive}><span>Investigando: <strong>{query}</strong></span><button className={styles.back} onClick={() => { setQuery(""); setDraft(""); }} type="button">Voltar ao radar geral</button></div> : null}
      <RadarWorkspace key={`${brandId}:${query}:${revision}`} brandId={brandId} query={query} retry={() => setRevision((value) => value + 1)} />
      <footer className={styles.footer}><span>MKT Scout · Da evidência à criação.</span><span>Horários de Brasília · Relevância editorial não comprova crescimento.</span></footer>
    </div>
  );
}

function RadarWorkspace({ brandId, query, retry }: { brandId: BrandId; query: string; retry: () => void }) {
  const [data, setData] = useState<RadarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Trend | null>(null);
  const selectedButton = useRef<HTMLButtonElement | null>(null);
  const brand = getBrandContext(brandId);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ brand: brandId });
    if (query) params.set("q", query);
    scoutRequest<RadarResponse>(`/api/scout/radar?${params}`, controller.signal)
      .then((payload) => { if (!controller.signal.aborted) setData(payload); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Não foi possível atualizar os sinais agora."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [brandId, query]);

  function closeDetail() {
    setSelected(null);
    // The radar cards stay mounted to preserve the keyboard user's return target.
    requestAnimationFrame(() => selectedButton.current?.focus());
  }

  const available = data?.sources.filter((source) => (source.status === "ok" || source.status === "empty")).length ?? 0;
  const allUnavailable = Boolean(data?.sources.length) && data!.sources.every((source) => source.status === "unavailable");

  return (
    <>
      <div role="status" className="sr-only" aria-live="polite">{loading ? "Consultando fontes do radar." : error ? error : `${data?.trends.length ?? 0} tendências encontradas para ${brand.name}.`}</div>
      <div hidden={Boolean(selected)} aria-busy={loading}>
        <div className={styles.sectionHeading}>
          <h2>{query ? "Sinais do tema" : "No radar"}{data ? <span className="ml-2 text-sm font-normal text-[#728269]">{data.trends.length.toString().padStart(2, "0")}</span> : null}</h2>
          {data ? <p>{available} de {data.sources.length} fontes disponíveis</p> : null}
        </div>
        {data ? <div className={`${styles.meta} mb-4`}><Clock3 size={12} aria-hidden="true" /><span>{data.trends.length ? "Última coleta com sinais" : "Última verificação"}: {formatScoutDate(data.collectedAt)}</span><span>·</span><span>{allUnavailable ? "Atualização indisponível" : data.cache.status === "stale" ? "Sinais da última coleta disponível" : data.cache.status === "cached" ? "Coleta recente reutilizada" : "Coleta atualizada"}</span></div> : null}
        {data?.cache.message ? <p className={styles.notice}>{data.cache.message}</p> : null}
        {loading ? <div className={styles.grid} aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <div key={index} className={styles.skeleton} />)}</div> : null}
        {error ? <div className={styles.empty} role="alert"><div className={styles.emptyIcon}><Radar size={22} /></div><h3>O radar não pôde ser atualizado</h3><p>{error}</p><button className={styles.primary} onClick={retry}>Tentar novamente</button></div> : null}
        {!loading && !error && !data?.trends.length ? <div className={styles.empty}><div className={styles.emptyIcon}><Radar size={22} /></div><h3>{allUnavailable ? "Não foi possível atualizar os sinais agora" : "Nenhum sinal confirmado neste recorte"}</h3><p>{allUnavailable ? "As fontes consultadas estão temporariamente indisponíveis. Tente atualizar em alguns instantes; o status de cada fonte está abaixo." : query ? "As fontes disponíveis não trouxeram sinais recentes para este tema. Experimente uma expressão mais ampla ou volte ao radar geral." : "As fontes disponíveis ainda não retornaram sinais recentes suficientes. Você pode atualizar a coleta ou investigar um tema específico."}</p><button className={styles.secondary} onClick={retry}><RefreshCw size={13} />Tentar novamente</button></div> : null}
        {data?.trends.length ? <div className={styles.grid}>{data.trends.map((trend) => {
          const types = [...new Set(trend.signals.map((signal) => sourceTypeLabels[signal.sourceType]))];
          return <button key={trend.id} type="button" className={styles.card} onClick={(event) => { selectedButton.current = event.currentTarget; setSelected(trend); }} aria-label={`Analisar ${trend.title}`}>
            <div className={styles.cardTop}><span className={styles.chip}><Radar size={11} aria-hidden="true" /> Sinal recente</span><span className={styles.scoreNumber}><strong>{Math.round(trend.score.value)}</strong>/100</span></div>
            <h3>{trend.title}</h3><p className={styles.cardSummary}>{trend.summary}</p>
            <div className={styles.cardBottom}><div className={styles.meta}>{types.join(" · ")}</div><div className={styles.cardRelevance}><span>Relevância para {brand.name}</span><strong>{trend.brandRelevance.label}</strong></div><div className={styles.cardFoot}><span>{trend.signals.length} evidência{trend.signals.length !== 1 ? "s" : ""} · {trend.independentSourceCount} fonte{trend.independentSourceCount !== 1 ? "s" : ""}</span><ArrowUpRight size={16} aria-hidden="true" /></div></div>
          </button>;
        })}</div> : null}
        {data ? <SourceHealth sources={data.sources} /> : null}
      </div>
      {selected && data ? <TrendDetail key={selected.id} trend={selected} brandId={brandId} query={query} sources={data.sources} visualSearchAvailable={data.visualSearchAvailable} onBack={closeDetail} /> : null}
    </>
  );
}

export function SourceHealth({ sources }: { sources: SourceStatus[] }) {
  return <details className={styles.sources} open={sources.every((source) => source.status !== "ok")}><summary><ArrowDownRight size={13} aria-hidden="true" className="mr-2 inline" />Fontes e disponibilidade · {sources.length} conectores</summary><div className={styles.sourceGrid}>{sources.map((source) => <article className={styles.source} key={source.id}><header><strong>{source.name}</strong><span className={`${styles.chip} ${source.status === "ok" ? styles.statusOk : styles.statusWarning}`}>{statusLabels[source.status]}</span></header><p>{source.message}</p><small>{source.count} sinais · {formatScoutDate(source.collectedAt)}</small></article>)}</div></details>;
}
