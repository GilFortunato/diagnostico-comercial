"use client";

import { useId, type ReactNode } from "react";
import { brl, stages, type CrmRow } from "@/lib/crm/model";
import type { commercialMetrics } from "@/lib/crm/analytics";

type Metrics = ReturnType<typeof commercialMetrics>;
type Series = { label: string; value: number; secondary?: number; tertiary?: number; detail?: string };
const colors = ["#14765a", "#3978a6", "#b17a20"];
const funnelColors = ["#125941", "#17684c", "#1b7758", "#28775f"];
const palette = ["#14765a", "#3978a6", "#b17a20", "#795b9d", "#477d8b", "#a65343", "#54772c", "#a25777", "#4271c5", "#567067", "#84591d", "#4d617f", "#807066", "#247c79"];
const count = (value: number) => value.toLocaleString("pt-BR");
const percent = (value: number) => value.toLocaleString("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const valuesOf = (row: Series) => [row.value, row.secondary, row.tertiary];
const seriesMaximum = (rows: Series[]) => Math.max(1, ...rows.flatMap((row) => valuesOf(row).map((value) => value ?? 0)));

function ChartPanel({ title, children, empty, className = "" }: {
  title: string; children: ReactNode; empty?: boolean; className?: string;
}) {
  const id = useId();
  return <section aria-labelledby={id} className={"share-card min-w-0 rounded-xl p-4 sm:p-5 " + className}>
    <h2 id={id} className="text-base font-semibold text-[var(--share-green-950)] sm:text-lg">{title}</h2>
    {empty ? <p className="mt-5 text-sm text-zinc-600">Sem registros para estes filtros.</p> : children}
  </section>;
}

function Legend({ labels }: { labels: string[] }) {
  return <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-600">
    {labels.map((label, index) => <li key={label} className="flex items-center gap-1.5">
      <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colors[index] }} />{label}
    </li>)}
  </ul>;
}

function HorizontalBars({ title, rows, legends = [], format = count, onSelect }: {
  title: string; rows: Series[]; legends?: string[]; format?: (value: number) => string; onSelect?: (label: string) => void;
}) {
  const max = seriesMaximum(rows);
  return <ChartPanel title={title} empty={!rows.length}>
    {legends.length > 0 && <Legend labels={legends} />}
    <ul className="mt-4 grid gap-3">
      {rows.map((row) => <li key={row.label}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          {onSelect ? <button type="button" onClick={() => onSelect(row.label)} className="text-left text-sm font-semibold text-[var(--share-green-800)] hover:underline">{row.label}</button> : <span className="text-sm font-semibold">{row.label}</span>}
          {row.detail && <span className="text-xs text-zinc-600">{row.detail}</span>}
        </div>
        {valuesOf(row).map((value, index) => value === undefined ? null : <div key={index} className="mt-1 flex items-center gap-2">
          <div className="h-2 min-w-0 flex-1 rounded-sm bg-zinc-100" aria-hidden>
            <div className="h-full rounded-sm" style={{ width: (value / max * 100) + "%", backgroundColor: colors[index] }} />
          </div>
          <span className="min-w-8 text-right text-xs tabular-nums text-zinc-600"><span className="sr-only">{legends[index]} </span>{format(value)}</span>
        </div>)}
      </li>)}
    </ul>
  </ChartPanel>;
}

function Funnel({ rows }: { rows: Series[] }) {
  const max = seriesMaximum(rows);
  return <ChartPanel title="Conversão dos leads contatados no período" empty={!rows[0]?.value}>
    <ol className="mt-5 grid gap-3">
      {rows.map((row, index) => <li key={row.label}>
        <div className="flex flex-wrap justify-between gap-1 text-xs">
          <span className="font-semibold text-[var(--share-green-950)]">{row.label}</span>
          {row.detail && <span className="text-zinc-600">{row.detail}</span>}
        </div>
        <div className="mt-1 flex justify-center rounded-md bg-[#f0f5f1] py-0.5">
          <div className="grid min-w-8 place-items-center rounded-md px-1 py-1.5 text-xs font-semibold tabular-nums text-white"
            style={{ width: (row.value / max * 100) + "%", backgroundColor: row.value ? funnelColors[index] : "#55645c" }}>
            {count(row.value)}
          </div>
        </div>
      </li>)}
    </ol>
  </ChartPanel>;
}

function Donut({ rows, onSelect }: { rows: Series[]; onSelect: (stage: string) => void }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const slices = [];
  let start = 0;
  for (const [index, row] of rows.entries()) {
    const end = start + row.value / total * 100;
    slices.push({ ...row, color: palette[index % palette.length], stop: start + "% " + end + "%" });
    start = end;
  }
  const fill = slices.map(({ color, stop }) => color + " " + stop).join(", ");
  return <ChartPanel title="Carteira por etapa atual" empty={!total}>
    <div className="mt-5 grid items-center gap-5 sm:grid-cols-[minmax(8rem,2fr)_3fr]">
      <div className="relative mx-auto grid aspect-square w-full max-w-44 place-items-center rounded-full" style={{ background: "conic-gradient(" + fill + ")" }}>
        <div className="grid h-[72%] w-[72%] content-center rounded-full bg-white text-center">
          <strong className="text-2xl font-semibold tabular-nums text-[var(--share-green-950)]">{count(total)}</strong>
          <span className="text-[11px] text-zinc-600">Oportunidades</span>
        </div>
      </div>
      <ul className="grid gap-1.5">
        {slices.map((row) => <li key={row.label}>
          <button type="button" onClick={() => onSelect(row.label)} className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-emerald-50">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: row.color }} />
            <span className="flex-1">{row.label}</span>
            <span className="shrink-0 tabular-nums font-semibold">{count(row.value)}</span>
            <span className="min-w-12 shrink-0 text-right tabular-nums text-zinc-600">{percent(row.value / total)}</span>
          </button>
        </li>)}
      </ul>
    </div>
  </ChartPanel>;
}

function ColumnChart({ title, rows, labels = [], className }: { title: string; rows: Series[]; labels?: string[]; className?: string }) {
  const step = Math.ceil(seriesMaximum(rows) / 4);
  const ceiling = step * 4;
  return <ChartPanel title={title} empty={!rows.length} className={className}>
    {labels.length > 0 && <Legend labels={labels} />}
    <div className="mt-5 grid grid-cols-[2rem_minmax(0,1fr)] gap-2">
      <div aria-hidden className="relative h-44 text-right text-[10px] tabular-nums text-zinc-600">
        {[4, 3, 2, 1, 0].map((tick) => <span key={tick} className="absolute right-0 translate-y-1/2" style={{ bottom: (tick * 25) + "%" }}>{count(tick * step)}</span>)}
      </div>
      <div className="overflow-x-auto" tabIndex={0} aria-label={title}>
        <ol className="grid grid-flow-col gap-2" style={{ gridAutoColumns: "minmax(2.5rem, 1fr)" }}>
          {rows.map((row) => {
            const values = valuesOf(row);
            const summary = values.flatMap((value, index) => value === undefined ? [] : [[labels[index], count(value)].filter(Boolean).join(" ")]);
            return <li key={row.label} tabIndex={0} aria-label={[row.label, ...summary].join(", ")} className="group relative rounded-sm focus-visible:outline-2 focus-visible:outline-emerald-700">
              <div className="relative flex h-44 items-end justify-center gap-0.5 border-b border-zinc-300">
                {[25, 50, 75, 100].map((tick) => <div key={tick} className="pointer-events-none absolute inset-x-[-4px] border-t border-zinc-200" aria-hidden style={{ bottom: tick + "%" }} />)}
                {values.map((value, index) => value === undefined ? null : <div key={index} aria-hidden className="relative z-0 w-full max-w-5 rounded-t-sm" style={{ height: (value / ceiling * 100) + "%", backgroundColor: colors[index] }} />)}
              </div>
              <p aria-hidden className="py-2 text-center text-[10px] tabular-nums text-zinc-700">{row.label}</p>
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 hidden justify-center group-hover:flex group-focus:flex">
                <div className="whitespace-nowrap rounded bg-[#173a31] px-2 py-1 text-[10px] font-semibold text-white">{values.filter((value) => value !== undefined).map(count).join(" / ")}</div>
              </div>
            </li>;
          })}
        </ol>
      </div>
    </div>
  </ChartPanel>;
}

export function CrmCharts({ metrics, rows, onOwner, onSegment, onEvent, onChannel, onStage }: {
  metrics: Metrics; rows: CrmRow[]; onOwner: (owner: string) => void;
  onSegment: (segment: string) => void; onEvent: (event: string) => void; onChannel: (channel: string) => void;
  onStage: (stage: string) => void;
}) {
  const totals = new Map<string, number>(stages.map((stage) => [stage, 0]));
  for (const row of rows) totals.set(row.stage, (totals.get(row.stage) ?? 0) + 1);
  const current = [...totals].flatMap(([label, value]) => value ? [{ label, value }] : []);
  return <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
    <ColumnChart title="Prospecção por semana" rows={metrics.weekly} labels={["Contatados", "Reagiram", "Reuniões realizadas"]} className="xl:col-span-2" />
    <Donut rows={current} onSelect={onStage} />
    <Funnel rows={metrics.conversion} />
    <HorizontalBars title="Retorno por canal" rows={metrics.byChannel} legends={["Contatados", "Reagiram", "Positivas"]} onSelect={onChannel} />
    <HorizontalBars title="Cobertura por segmento" rows={metrics.segments} legends={["No pipeline", "Contatados", "Em reunião realizada"]} onSelect={onSegment} />
    <HorizontalBars title="Propostas e patrocínios por evento" rows={metrics.eventGroups} legends={["Propostas abertas", "Em negociação", "Vendido"]} format={brl} onSelect={onEvent} />
    <HorizontalBars title="Follow-ups por responsável" rows={metrics.byOwner} legends={["Atrasados", "Hoje", "Sem data"]} onSelect={onOwner} />
    <div className="lg:col-span-2 xl:col-span-4"><HorizontalBars title="Etapas registradas no funil" rows={metrics.funnel[0]?.value ? metrics.funnel : []} /></div>
  </div>;
}
