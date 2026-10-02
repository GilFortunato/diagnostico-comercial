"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ExternalLink, LoaderCircle, Search, Sparkles } from "lucide-react";
import { BRANDS } from "@/lib/scout/mkt/brands";
import type { BrandId } from "@/lib/scout/mkt/types";

type PaletteColor = { name: string; hex: string };
type Direction = {
  id: string; name: string; concept: string; composition: string; photographicStyle: string;
  typography: string; palette: PaletteColor[]; keywords: string[]; searchQuery: string;
};
type Interpretation = {
  objective: string; coreMessage: string; audienceReading: string; ambiguities: string[];
  guardrails: string[]; directions: Direction[];
};
type ScoutImage = {
  id: string; provider: string; providerLabel: string; title: string; previewUrl: string; fullUrl: string;
  sourceUrl: string; width: number; height: number; author: string; score: number; attribution: string;
};
type SearchResponse = { results: ScoutImage[]; rawCount: number; prefilteredCount: number; searchQueries: string[]; error?: string };

const visualTransferKey = "share:mkt-scout:visual-selection";

export function BriefingMoodboardClient() {
  const [projectName, setProjectName] = useState("");
  const [brandId, setBrandId] = useState<BrandId>("share");
  const [briefing, setBriefing] = useState("");
  const [audience, setAudience] = useState("");
  const [deliverable, setDeliverable] = useState("");
  const [mustHave, setMustHave] = useState("");
  const [avoid, setAvoid] = useState("");
  const [approvedHistory, setApprovedHistory] = useState("");
  const [interpretation, setInterpretation] = useState<Interpretation | null>(null);
  const [mode, setMode] = useState<"ai" | "fallback" | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<Direction | null>(null);
  const [images, setImages] = useState<ScoutImage[]>([]);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<"interpret" | "images" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(visualTransferKey);
      if (!raw) return;
      const transfer = JSON.parse(raw) as { query?: string; images?: ScoutImage[] };
      if (transfer.query) setBriefing((current) => current || transfer.query || "");
      if (transfer.images?.length) {
        const transferQuery = transfer.query || "Referências selecionadas no Visual Scout";
        setImages(transfer.images);
        setSelectedImageIds(transfer.images.map((image) => image.id));
        setSelectedDirection({
          id: "visual-scout-transfer",
          name: "Seleção do Visual Scout",
          concept: "Referências selecionadas diretamente no Visual Scout para compor e validar o moodboard.",
          composition: "A composição será refinada a partir das referências selecionadas.",
          photographicStyle: "Derivado da seleção visual atual.",
          typography: "A definir após validação da direção.",
          palette: [{ name: "Verde", hex: "#0B4A39" }, { name: "Lime", hex: "#D8F04A" }, { name: "Neutro", hex: "#F4F7EF" }],
          keywords: transferQuery.split(/[|,]/).map((item) => item.trim()).filter(Boolean).slice(0, 8),
          searchQuery: transferQuery.slice(0, 300),
        });
      }
      sessionStorage.removeItem(visualTransferKey);
    } catch {
      // Optional handoff only.
    }
  }, []);

  const selectedImages = useMemo(() => images.filter((image) => selectedImageIds.includes(image.id)), [images, selectedImageIds]);

  async function interpret() {
    if (projectName.trim().length < 2 || briefing.trim().length < 20) {
      setError("Preencha o nome do projeto e um briefing com contexto suficiente.");
      return;
    }
    setLoading("interpret");
    setError(null);
    setInterpretation(null);
    setSelectedDirection(null);
    setImages([]);
    setSelectedImageIds([]);
    try {
      const response = await fetch("/api/scout/moodboard/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, brandId, briefing, audience, deliverable, mustHave, avoid, approvedHistory }),
      });
      const body = await response.json() as { interpretation?: Interpretation; mode?: "ai" | "fallback"; error?: string };
      if (!response.ok || !body.interpretation) throw new Error(body.error || "Não foi possível interpretar o briefing.");
      setInterpretation(body.interpretation);
      setMode(body.mode || "fallback");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível interpretar o briefing.");
    } finally {
      setLoading(null);
    }
  }

  async function searchDirection(direction: Direction) {
    setSelectedDirection(direction);
    setLoading("images");
    setError(null);
    setImages([]);
    setSelectedImageIds([]);
    try {
      const query = [direction.searchQuery, ...direction.keywords.slice(0, 5)].join(" | ").slice(0, 480);
      const response = await fetch(`/api/scout/images/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const body = await response.json() as SearchResponse;
      if (!response.ok) throw new Error(body.error || "Não foi possível buscar as referências.");
      setImages(body.results || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível buscar as referências.");
    } finally {
      setLoading(null);
    }
  }

  function toggleImage(id: string) {
    setSelectedImageIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length >= 9 ? current : [...current, id]);
  }

  const visualScoutHref = selectedDirection
    ? `/sharevisualscout?q=${encodeURIComponent([selectedDirection.searchQuery, ...selectedDirection.keywords.slice(0, 5)].join(" | ").slice(0, 480))}`
    : "/sharevisualscout";

  return <div className="space-y-6">
    <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
      <div className="share-card rounded-2xl p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--share-green-800)]">1. Briefing do projeto</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Nome do projeto" value={projectName} onChange={setProjectName} placeholder="Ex.: Campanha Potenc.IA" />
          <label className="grid gap-1 text-xs font-semibold text-zinc-600">Marca
            <select value={brandId} onChange={(event) => setBrandId(event.target.value as BrandId)} className="h-11 rounded-xl border border-[var(--share-line)] bg-white px-3 text-sm font-normal">
              {BRANDS.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </select>
          </label>
          <Field label="Público" value={audience} onChange={setAudience} placeholder="Quem precisa ser impactado?" />
          <Field label="Peça / canal" value={deliverable} onChange={setDeliverable} placeholder="Ex.: carrossel, KV, apresentação, landing page" />
        </div>
        <label className="mt-4 grid gap-1 text-xs font-semibold text-zinc-600">Briefing
          <textarea value={briefing} onChange={(event) => setBriefing(event.target.value)} rows={8} maxLength={6000} placeholder="Cole o briefing completo: objetivo, mensagem, contexto, tom, referências desejadas..." className="rounded-xl border border-[var(--share-line)] p-4 text-sm font-normal leading-6" />
        </label>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TextArea label="Obrigatórios" value={mustHave} onChange={setMustHave} placeholder="Logo, cores, pessoas, produto, texto, enquadramento..." />
          <TextArea label="Evitar" value={avoid} onChange={setAvoid} placeholder="Clichês, estilos, elementos proibidos..." />
        </div>
        <label className="mt-4 grid gap-1 text-xs font-semibold text-zinc-600">Aprendizados de projetos aprovados <span className="font-normal text-zinc-400">(opcional)</span>
          <textarea value={approvedHistory} onChange={(event) => setApprovedHistory(event.target.value)} rows={3} maxLength={1800} placeholder="Cole aqui referências, padrões ou decisões visuais já aprovadas pela equipe." className="rounded-xl border border-[var(--share-line)] p-3 text-sm font-normal leading-6" />
        </label>
        <button type="button" disabled={loading === "interpret"} onClick={() => void interpret()} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--share-green-950)] px-5 text-sm font-bold text-white disabled:opacity-50">
          {loading === "interpret" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Interpretar briefing
        </button>
      </div>

      <aside className="rounded-2xl bg-[var(--share-green-950)] p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--share-lime)]">Fluxo</p>
        <h2 className="mt-2 text-2xl font-semibold">Menos pesquisa manual, mais validação de direção.</h2>
        <div className="mt-6 space-y-4 text-sm text-white/70">
          {["A IA estrutura objetivo, mensagem e restrições.","Você escolhe uma rota visual, sem comprometer o projeto inteiro.","O Visual Scout busca referências rastreáveis em fontes disponíveis.","Você seleciona até 9 imagens e monta o painel preliminar."].map((item,index)=><div key={item} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold text-[var(--share-lime)]">{index+1}</span><p>{item}</p></div>)}
        </div>
        <p className="mt-6 border-t border-white/10 pt-5 text-xs leading-5 text-white/45">Pinterest e Behance não são tratados como dependências do fluxo. A busca usa o mesmo motor do Visual Scout.</p>
      </aside>
    </section>

    {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

    {interpretation ? <section className="share-card rounded-2xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--share-green-800)]">2. Leitura criativa</p><h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">O briefing virou caminhos visuais.</h2></div>
        <span className="rounded-full bg-[#eef6e8] px-3 py-2 text-xs font-semibold text-[#52712b]">{mode === "ai" ? "Interpretado pelo Gemini" : "Fallback estruturado"}</span>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <SummaryCard title="Objetivo" text={interpretation.objective} />
        <SummaryCard title="Mensagem central" text={interpretation.coreMessage} />
        <SummaryCard title="Leitura do público" text={interpretation.audienceReading} />
      </div>
      {interpretation.ambiguities.length ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><strong className="text-sm text-amber-900">Pontos para validar antes de produzir</strong><ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-amber-800">{interpretation.ambiguities.map((item)=><li key={item}>{item}</li>)}</ul></div> : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {interpretation.directions.map((direction) => <article key={direction.id} className={`rounded-2xl border p-5 ${selectedDirection?.id === direction.id ? "border-[var(--share-green-700)] bg-[#f8fbf5]" : "border-[var(--share-line)]"}`}>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--share-green-800)]">Rota visual</p>
          <h3 className="mt-1 text-xl font-semibold text-[var(--share-green-950)]">{direction.name}</h3>
          <p className="mt-3 text-sm leading-6 text-zinc-600">{direction.concept}</p>
          <dl className="mt-4 space-y-3 text-xs"><Info label="Composição" value={direction.composition} /><Info label="Fotografia" value={direction.photographicStyle} /><Info label="Tipografia" value={direction.typography} /></dl>
          <div className="mt-4 flex gap-2">{direction.palette.map((color)=><span key={color.hex} title={`${color.name} ${color.hex}`} className="h-7 w-7 rounded-full border border-black/10" style={{backgroundColor:color.hex}} />)}</div>
          <div className="mt-4 flex flex-wrap gap-1.5">{direction.keywords.map((word)=><span key={word} className="rounded-full bg-[#eef5ec] px-2 py-1 text-[10px] font-semibold text-[var(--share-green-900)]">{word}</span>)}</div>
          <button type="button" onClick={() => void searchDirection(direction)} disabled={loading === "images"} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--share-lime)] px-4 py-3 text-sm font-bold text-[var(--share-green-950)] disabled:opacity-50">{loading === "images" && selectedDirection?.id === direction.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar referências</button>
        </article>)}
      </div>
    </section> : null}

    {selectedDirection && images.length ? <section className="share-card rounded-2xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--share-green-800)]">3. Visual Scout</p><h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">Escolha as referências do painel</h2><p className="mt-2 text-sm text-zinc-500">Selecione até 9 imagens. {selectedImageIds.length} selecionada(s).</p></div>
        <Link href={visualScoutHref} className="inline-flex items-center gap-2 rounded-xl border border-[var(--share-line)] px-4 py-2 text-xs font-bold text-[var(--share-green-900)]">Abrir busca completa no Visual Scout <ArrowRight className="h-3.5 w-3.5" /></Link>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {images.slice(0,16).map((image) => {
          const active=selectedImageIds.includes(image.id);
          return <article key={image.id} className={`overflow-hidden rounded-xl border bg-white ${active ? "border-[var(--share-green-700)] ring-2 ring-[var(--share-mint)]" : "border-[var(--share-line)]"}`}>
            <button type="button" onClick={()=>toggleImage(image.id)} className="block w-full text-left">
              <div className="relative h-40 bg-[#e9efe7] bg-cover bg-center" style={{backgroundImage:`url("${image.previewUrl.replace(/"/g,"%22")}")`}}>{active ? <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-[var(--share-green-950)] text-white"><Check className="h-4 w-4" /></span> : null}</div>
              <div className="p-3"><p className="line-clamp-2 text-xs font-semibold text-[var(--share-green-950)]">{image.title}</p><p className="mt-1 text-[10px] text-zinc-400">{image.providerLabel} · {image.score}%</p></div>
            </button>
          </article>;
        })}
      </div>
    </section> : null}

    {selectedDirection && selectedImages.length ? <section className="overflow-hidden rounded-2xl border border-[var(--share-line)] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--share-green-950)] p-5 text-white"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--share-lime)]">4. Moodboard preliminar</p><h2 className="mt-1 text-2xl font-semibold">{projectName || "Projeto"}</h2></div><span className="text-xs text-white/55">{selectedDirection.name} · {selectedImages.length} referências</span></div>
      <div className="grid gap-0 md:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-r border-[var(--share-line)] bg-[#f7faf4] p-5">
          <p className="text-xs font-bold uppercase text-[var(--share-green-800)]">Direção</p><h3 className="mt-2 text-xl font-semibold text-[var(--share-green-950)]">{selectedDirection.name}</h3><p className="mt-3 text-sm leading-6 text-zinc-600">{selectedDirection.concept}</p>
          <div className="mt-5 flex gap-2">{selectedDirection.palette.map((color)=><div key={color.hex}><span className="block h-8 w-8 rounded-full border border-black/10" style={{backgroundColor:color.hex}}/><span className="mt-1 block text-[9px] text-zinc-400">{color.hex}</span></div>)}</div>
          <p className="mt-5 text-xs leading-5 text-zinc-500">{selectedDirection.composition}</p>
        </aside>
        <div className="grid auto-rows-[180px] grid-cols-2 gap-2 p-2 md:grid-cols-3">
          {selectedImages.map((image,index)=><figure key={image.id} className={`group relative overflow-hidden rounded-lg ${index===0 ? "col-span-2 row-span-2" : ""}`}><img src={image.previewUrl} alt={image.title} className="h-full w-full object-cover" /><figcaption className="absolute inset-x-0 bottom-0 translate-y-full bg-black/70 p-2 text-[10px] text-white transition group-hover:translate-y-0"><span>{image.attribution}</span><a href={image.sourceUrl} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 underline">Fonte <ExternalLink className="h-3 w-3"/></a></figcaption></figure>)}
        </div>
      </div>
    </section> : null}
  </div>;
}

function Field({label,value,onChange,placeholder}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string}) {
  return <label className="grid gap-1 text-xs font-semibold text-zinc-600">{label}<input value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} className="h-11 rounded-xl border border-[var(--share-line)] px-3 text-sm font-normal" /></label>;
}
function TextArea({label,value,onChange,placeholder}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string}) {
  return <label className="grid gap-1 text-xs font-semibold text-zinc-600">{label}<textarea value={value} onChange={(e)=>onChange(e.target.value)} rows={3} placeholder={placeholder} className="rounded-xl border border-[var(--share-line)] p-3 text-sm font-normal leading-5" /></label>;
}
function SummaryCard({title,text}:{title:string;text:string}) { return <div className="rounded-xl bg-[#f5f8f2] p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-[var(--share-green-800)]">{title}</p><p className="mt-2 text-sm leading-6 text-zinc-600">{text}</p></div>; }
function Info({label,value}:{label:string;value:string}) { return <div><dt className="font-bold uppercase tracking-wide text-[var(--share-green-800)]">{label}</dt><dd className="mt-1 leading-5 text-zinc-600">{value}</dd></div>; }
