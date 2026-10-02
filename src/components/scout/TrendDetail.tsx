"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, Copy, ExternalLink, ImageIcon, LoaderCircle, Sparkles } from "lucide-react";
import { getBrandContext } from "@/lib/scout/mkt/brands";
import type { BrandId, Signal, SourceStatus, Trend } from "@/lib/scout/mkt/types";
import type { ContentOpportunity, ScoutAnalysis, ScoutGeneration, VisualDirection } from "@/lib/scout/mkt/analysisTypes";
import type { ProviderState, VisualScoutImage } from "@/lib/scout/imageSearch";
import { formatScoutDate, safeScoutUrl, scoutRequest } from "./scoutClient";
import styles from "./MktScout.module.css";

type AnalysisResponse = { trend: Trend; analysis: ScoutAnalysis; persistent: boolean };
type ReferencesResponse = { results: VisualScoutImage[]; providers: ProviderState[]; query: string; notice?: string; message?: string };
type DetailProps = { trend: Trend; brandId: BrandId; query: string; sources: SourceStatus[]; visualSearchAvailable: boolean; onBack: () => void };

export function TrendDetail({ trend, brandId, query, sources, visualSearchAvailable, onBack }: DetailProps) {
  const [analysis, setAnalysis] = useState<ScoutAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisAttempt, setAnalysisAttempt] = useState(0);
  const [generation, setGeneration] = useState<ScoutGeneration | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [references, setReferences] = useState<ReferencesResponse | null>(null);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [referencesError, setReferencesError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const output = useRef<HTMLDivElement>(null);
  const generationController = useRef<AbortController | null>(null);
  const referencesController = useRef<AbortController | null>(null);
  const brand = getBrandContext(brandId);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ behavior: "instant", block: "start" });
    return () => { generationController.current?.abort(); referencesController.current?.abort(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    scoutRequest<AnalysisResponse>("/api/scout/analysis", controller.signal, { trendId: trend.id, brandId, query: query || undefined })
      .then((payload) => { if (!controller.signal.aborted) { setAnalysis(payload.analysis); setAnalysisError(null); } })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setAnalysisError(cause instanceof Error ? cause.message : "A análise não está disponível agora."); });
    return () => controller.abort();
  }, [trend.id, brandId, query, analysisAttempt]);

  async function generate(opportunity: ContentOpportunity) {
    generationController.current?.abort();
    const controller = new AbortController();
    generationController.current = controller;
    setGeneratingId(opportunity.id);
    setGenerationError(null);
    setGeneration(null);
    setCopyStatus("");
    try {
      const result = await scoutRequest<ScoutGeneration>("/api/scout/content", controller.signal, { trendId: trend.id, brandId, opportunityId: opportunity.id, query: query || undefined });
      if (!controller.signal.aborted) {
        setGeneration(result);
        requestAnimationFrame(() => { output.current?.scrollIntoView({ behavior: "instant", block: "start" }); output.current?.focus({ preventScroll: true }); });
      }
    } catch (cause) {
      if (!controller.signal.aborted) setGenerationError(cause instanceof Error ? cause.message : "Não foi possível gerar o conteúdo agora.");
    } finally {
      if (!controller.signal.aborted) setGeneratingId(null);
    }
  }

  async function findReferences() {
    referencesController.current?.abort();
    const controller = new AbortController();
    referencesController.current = controller;
    setReferencesLoading(true);
    setReferencesError(null);
    try {
      const result = await scoutRequest<ReferencesResponse>("/api/scout/references", controller.signal, { trendId: trend.id, brandId, query: query || undefined });
      if (!controller.signal.aborted) setReferences(result);
    } catch (cause) {
      if (!controller.signal.aborted) setReferencesError(cause instanceof Error ? cause.message : "A busca externa está indisponível neste momento. Use a direção visual abaixo.");
    } finally {
      if (!controller.signal.aborted) setReferencesLoading(false);
    }
  }

  async function copyContent() {
    if (!generation) return;
    try { await navigator.clipboard.writeText(`${generation.title}\n\n${generation.body}\n\nFontes:\n${generation.sourceUrls.join("\n")}`); setCopyStatus("Conteúdo copiado."); }
    catch { setCopyStatus("Não foi possível copiar automaticamente. Selecione o texto para copiar."); }
  }

  async function copyGenerationLink() {
    if (!generation) return;
    const url = new URL("/sharetrendintelligence", window.location.origin);
    url.searchParams.set("generation", generation.id);
    try { await navigator.clipboard.writeText(url.href); setCopyStatus("Link da geração copiado. O acesso é restrito à sua conta."); }
    catch { setCopyStatus("Não foi possível copiar o link automaticamente."); }
  }

  return (
    <div>
      <div className={styles.detailTop}><button type="button" className={styles.back} onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> Voltar ao radar</button><span className={styles.meta}>Leitura para {brand.name} · {trend.signals.length} evidências</span></div>
      <header className={styles.detailHeader}>
        <div><p className={styles.eyebrow}>Sinal em análise</p><h2 ref={heading} tabIndex={-1}>{trend.title}</h2><p>{trend.summary}</p><div className={`${styles.meta} mt-4`}>Primeira detecção: {formatScoutDate(trend.firstDetectedAt)}<br />Última detecção: {formatScoutDate(trend.lastDetectedAt)}</div></div>
        <div className={styles.detailScore}><p className={`${styles.eyebrow} mb-2`}>Score composto</p><strong>{Math.round(trend.score.value)}<span> / 100</span></strong><p>Força dos sinais disponíveis + aderência à marca. Veja o cálculo abaixo.</p></div>
      </header>
      {analysisError ? <div role="alert" className={styles.notice}>{analysisError}<div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => { setAnalysisError(null); setAnalysisAttempt((value) => value + 1); }}>Tentar análise novamente</button></div></div> : null}
      {!analysis && !analysisError ? <p className={styles.meta} role="status"><LoaderCircle size={14} className="animate-spin" aria-hidden="true" />Preparando a leitura editorial e a direção visual para {brand.name}…</p> : null}
      <div className={styles.detailLayout}>
        <div className={styles.mainSections}>
          <Panel number="01" title="O que aconteceu"><p className={styles.body}>{analysis?.whatHappened ?? trend.summary}</p></Panel>
          <Panel number="02" title="Evidências"><p className={`${styles.body} mb-4`}>Registros coletados nas fontes. As interpretações editoriais aparecem nas próximas seções.</p>{trend.signals.map((signal) => <Evidence key={signal.id} signal={signal} sourceName={sources.find((source) => source.id === signal.source)?.name ?? signal.source} />)}</Panel>
          <Panel number="03" title="Por que está crescendo"><p className={styles.body}>{trend.growthExplanation}</p>{analysis ? <div className="mt-4"><p className={styles.eyebrow}>Leitura editorial · Por que olhar agora</p><p className={`${styles.body} mt-2`}>{analysis.whyNow}</p></div> : null}<ScoreExplanation trend={trend} /></Panel>
        </div>
        <aside className={styles.aside}>
          <Panel number="04" title="Fontes"><p className={styles.body}>{trend.independentSourceCount} origem{trend.independentSourceCount !== 1 ? "s" : ""} {trend.independentSourceCount !== 1 ? "identificáveis" : "identificável"} neste grupo. A associação não comprova independência editorial.</p><ul className={styles.list}>{[...new Set(trend.signals.map((signal) => signal.source))].map((id) => { const source = sources.find((item) => item.id === id); return <li key={id}><strong>{source?.name ?? id}</strong>{source ? <><br /><span className="text-[10px]">Coleta: {formatScoutDate(source.collectedAt)}<br />{source.message}</span></> : null}</li>; })}</ul><p className={`${styles.meta} mt-4`}>Links e datas individuais estão em Evidências.</p></Panel>
          <Panel number="05" title={`Relevância para ${brand.name}`}><span className={styles.brandBadge}>{trend.brandRelevance.label} · {Math.round(trend.brandRelevance.score)}/100</span><p className={styles.body}>{analysis?.brandInterpretation ?? trend.brandRelevance.reason}</p><details className={styles.score}><summary>Contexto editorial aplicado</summary><p className={`${styles.body} mt-3`}>{brand.description}</p><p className={`${styles.body} mt-2`}><strong>Público:</strong> {brand.audience}</p><p className={`${styles.meta} mt-3`}>Contexto inicial de trabalho, sujeito à validação da marca.</p></details></Panel>
          <Panel number="06" title="Riscos de entrar no assunto">{analysis ? <ul className={styles.list}>{analysis.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul> : <p className={styles.body}>Valide a fonte original e a pertinência do tema antes de publicar. A avaliação contextual aparecerá após a análise.</p>}</Panel>
        </aside>
        <div className={styles.mainSections}>
          <Panel number="07" title="Oportunidades"><p className={styles.body}>Ângulos sugeridos para {brand.name}, a partir das evidências deste sinal.</p>{analysis ? analysis.opportunities.map((opportunity) => <Opportunity key={opportunity.id} opportunity={opportunity} generating={generatingId === opportunity.id} disabled={Boolean(generatingId)} onGenerate={() => void generate(opportunity)} />) : <p className={`${styles.body} mt-4`}>{analysisError ? "As oportunidades ficarão disponíveis quando a análise puder ser concluída." : "Preparando ângulos, públicos e formatos…"}</p>}</Panel>
          <Panel number="08" title="Ideias de conteúdo">
            <p className={styles.body}>Escolha uma oportunidade e clique em “Gerar conteúdo” para desenvolver a proposta com o contexto da marca e as evidências coletadas.</p>
            {generatingId ? <p role="status" className={`${styles.meta} mt-4`}><LoaderCircle size={15} className="animate-spin" aria-hidden="true" />Preparando conteúdo…</p> : null}
            {generationError ? <p className={styles.notice} role="alert">{generationError}</p> : null}
            {generation ? <div className={styles.contentOutput} ref={output} tabIndex={-1} aria-label="Conteúdo gerado"><p className={styles.eyebrow}>{generation.mode === "ai" ? "Rascunho gerado com IA" : "Rascunho editorial"} · {generation.cached ? "Versão reutilizada" : "Nova versão"}</p><h4>{generation.title}</h4><div className={styles.copy}>{generation.body}</div>{generation.notice ? <p className={styles.notice}>{generation.notice}</p> : null}<div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => void copyContent()}>{copyStatus === "Conteúdo copiado." ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />} Copiar conteúdo</button>{generation.persistent ? <button type="button" className={styles.secondary} onClick={() => void copyGenerationLink()}><ExternalLink size={13} aria-hidden="true" /> Copiar link</button> : null}<span className={styles.meta} role="status">{copyStatus}</span></div><p className={styles.contentMeta}>Gerado em {formatScoutDate(generation.createdAt)} · {brand.name}<br />{generation.persistent ? "Geração salva" : "Histórico disponível somente nesta sessão"} · ID: {generation.id}</p><details className={styles.score}><summary>Fontes preservadas no conteúdo</summary><ul className={styles.list}>{generation.sourceUrls.map((url) => safeScoutUrl(url) ? <li key={url}><a className={styles.sourceLink} href={safeScoutUrl(url)} target="_blank" rel="noopener noreferrer">{new URL(url).hostname}<ExternalLink size={11} aria-hidden="true" /></a></li> : null)}</ul></details></div> : null}
          </Panel>
          <Panel number="09" title="Direção visual">
            {analysis ? <VisualBrief visual={analysis.visual} /> : <p className={styles.body}>{analysisError ? "Tente a análise novamente para preparar a direção visual." : "Preparando conceito, composição e orientação por canal…"}</p>}
            {visualSearchAvailable && analysis ? <div className={styles.actions}><button type="button" className={styles.secondary} disabled={referencesLoading} onClick={() => void findReferences()}>{referencesLoading ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <ImageIcon size={14} aria-hidden="true" />}{referencesLoading ? "Buscando referências…" : "Buscar referências"}</button></div> : <p className={`${styles.meta} mt-5`}>A busca externa de referências não está disponível neste ambiente. A direção visual pode ser usada normalmente pela equipe de criação.</p>}
            {referencesError ? <p role="alert" className={styles.notice}>{referencesError}</p> : null}
            {references ? <VisualReferences references={references} /> : null}
          </Panel>
        </div>

      </div>
      {analysis ? <p className={`${styles.contentMeta} mt-5`}>Leitura editorial em {formatScoutDate(analysis.generatedAt)} · Referência: {analysis.id}</p> : null}
    </div>
  );
}

function Panel({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return <section className={styles.panel} style={{ order: Number(number) }}><h3 className={styles.panelTitle}><span className={styles.index} aria-hidden="true">{number}</span>{title}</h3>{children}</section>;
}

function Evidence({ signal, sourceName }: { signal: Signal; sourceName: string }) {
  const url = safeScoutUrl(signal.url);
  const labels: Record<string, string> = { approximateSearchesLowerBound: "Buscas aproximadas (limite inferior)", searchVolume: "Volume de busca", approximateTraffic: "Buscas aproximadas", views: "Visualizações", likes: "Curtidas", comments: "Comentários", points: "Pontos", score: "Pontos", viewsPerDay: "Média de visualizações/dia", traffic: "Buscas aproximadas", commentsCount: "Comentários", viewCount: "Visualizações", likeCount: "Curtidas", commentCount: "Comentários" };
  return <article className={styles.evidence}><div className={styles.meta}><span className={styles.chip}>{sourceName}</span><span>{signal.geography === "BR" ? "Brasil" : "Global"}</span><span>Confiança heurística: {Math.round(signal.confidence * 100)}%</span></div><h4>{signal.title}</h4><ul>{signal.evidence.map((evidence, index) => <li key={`${signal.id}-${index}`}>{evidence}</li>)}</ul><div className={styles.metrics}>{Object.entries(signal.rawMetrics).length ? Object.entries(signal.rawMetrics).map(([key, value]) => <span key={key}>{labels[key] ?? key}: {new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)}</span>) : <span>Esta fonte não informa métricas quantitativas.</span>}</div>{url ? <a href={url} target="_blank" rel="noopener noreferrer">Ver fonte original <ExternalLink size={11} aria-hidden="true" /></a> : <small>A fonte não forneceu um link individual.</small>}<small>{signal.publisher ? `${signal.publisher} · ` : ""}Publicação: {formatScoutDate(signal.publishedAt)}<br />Detectado em: {formatScoutDate(signal.detectedAt)}</small></article>;
}

function ScoreExplanation({ trend }: { trend: Trend }) {
  return <details className={styles.score}><summary>Como o score de {Math.round(trend.score.value)}/100 foi calculado</summary><p className={`${styles.body} mt-3`}>{trend.score.explanation}</p>{trend.score.components.map((component) => <div key={component.key} className={styles.scoreRow}><div><span>{component.label} · peso aplicado {Math.round(component.weight * 100)}%</span><span>{component.value === null ? "Não disponível" : `${Math.round(component.value)}/100`}</span></div><p>{component.explanation}</p></div>)}</details>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <dl className={styles.field}><dt>{label}</dt><dd>{children}</dd></dl>;
}

function Opportunity({ opportunity, generating, disabled, onGenerate }: { opportunity: ContentOpportunity; generating: boolean; disabled: boolean; onGenerate: () => void }) {
  return <article className={styles.opportunity}><span className={styles.chip}>{opportunity.channel} · {opportunity.format}</span><h4>{opportunity.title}</h4><Field label="Ângulo">{opportunity.angle}</Field><div className={styles.fieldGrid}><Field label="Público">{opportunity.audience}</Field><Field label="Objetivo">{opportunity.objective}</Field></div><p className={styles.eyebrow}>Hook sugerido</p><blockquote className={styles.hook}>{opportunity.hook}</blockquote><Field label="Estrutura"><ol className={styles.list}>{opportunity.structure.map((step, index) => <li key={index}>{step}</li>)}</ol></Field><Field label="CTA sugerido">{opportunity.cta}</Field><Field label="Por que este formato">{opportunity.rationale}</Field><button type="button" className={styles.primary} disabled={disabled} onClick={onGenerate}>{generating ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : <Sparkles size={13} aria-hidden="true" />}{generating ? "Gerando conteúdo…" : "Gerar conteúdo"}<span className="sr-only">: {opportunity.title}</span></button></article>;
}

function VisualBrief({ visual }: { visual: VisualDirection }) {
  return <><div className={styles.visualConcept}><p>Conceito</p><h4>{visual.concept}</h4></div><Field label="Composição">{visual.composition}</Field><div className={styles.visualGrid}><Field label="Clima visual">{visual.mood}</Field><Field label="Fotografia / ilustração">{visual.medium}</Field><Field label="Paleta conceitual">{visual.palette.join(" · ")}</Field><Field label="Enquadramento">{visual.framing}</Field></div><Field label="Negative space · área livre para copy">{visual.negativeSpace}</Field><div className={styles.visualGrid}><Field label="Elementos que devem aparecer"><ul className={styles.list}>{visual.include.map((item) => <li key={item}>{item}</li>)}</ul></Field><Field label="Evitar · elementos e clichês"><ul className={styles.list}>{visual.avoid.map((item) => <li key={item}>{item}</li>)}</ul></Field></div><Field label="Texto que não deve aparecer na imagem"><ul className={styles.list}>{visual.noText.map((item) => <li key={item}>{item}</li>)}</ul></Field><p className={`${styles.eyebrow} mt-5`}>Orientação por canal</p><div className={styles.channels}>{visual.channels.map((channel) => <div key={`${channel.channel}-${channel.format}`} className={styles.channel}><strong>{channel.channel} · {channel.format}</strong><p>{channel.guidance}</p></div>)}</div><Field label="Termos para buscar referências">{visual.searchTerms.join(" · ")}</Field></>;
}

function VisualReferences({ references }: { references: ReferencesResponse }) {
  const usable = references.results.filter((item) => safeScoutUrl(item.previewUrl) && safeScoutUrl(item.sourceUrl));
  return <div aria-live="polite">{references.notice || references.message ? <p className={styles.notice}>{references.notice ?? references.message}</p> : null}{references.providers.some((provider) => provider.configured && !provider.ok) ? <p className={styles.meta}>Algumas fontes visuais estão indisponíveis. Exibindo as referências encontradas nas demais.</p> : null}{usable.length ? <div className={styles.references}>{usable.slice(0, 6).map((item) => <figure key={item.id} className={styles.reference}><Image src={item.previewUrl} alt={item.title} width={640} height={426} unoptimized loading="lazy" /><figcaption>{item.attribution}<br /><a href={safeScoutUrl(item.sourceUrl)} target="_blank" rel="noopener noreferrer">Ver em {item.providerLabel} <ExternalLink size={10} className="inline" aria-hidden="true" /></a></figcaption></figure>)}</div> : <p className={styles.notice}>Nenhuma referência externa foi encontrada nesta consulta. A direção visual continua disponível para orientar a criação.</p>}</div>;
}
