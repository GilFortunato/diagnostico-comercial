"use client";

import { brl, stages, type CrmRow } from "@/lib/crm/model";
import type { commercialMetrics } from "@/lib/crm/analytics";

type Metrics = ReturnType<typeof commercialMetrics>;
type Series = { label: string; value: number; secondary?: number; tertiary?: number; detail?: string };

const colors = ["#286052", "#7aa951", "#b08c33"];
const count = (value: number) => value.toLocaleString("pt-BR");

function BarChart({ title, rows, legends = [], format = count, onSelect }: {
  title: string; rows: Series[]; legends?: string[]; format?: (number: number) => string; onSelect?: (label: string) => void;
}) {
  const max = Math.max(1, ...rows.flatMap(({ value, secondary, tertiary }) => [value, secondary ?? 0, tertiary ?? 0]));
  return <section className="share-card min-w-0 rounded-xl p-5">
    <h2 className="text-lg font-semibold text-[var(--share-green-950)]">{title}</h2>
    {legends.length > 0 && <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-600">
      {legends.map((label, index) => <li key={label} className="flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colors[index] }} />{label}</li>)}
    </ul>}
    {rows.length === 0 ? <p className="mt-6 text-sm text-zinc-500">Sem registros para estes filtros.</p> : <ul className="mt-4 grid gap-3">
      {rows.map(({ label, value, secondary, tertiary, detail }) => <li key={label}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          {onSelect ? <button type="button" onClick={() => onSelect(label)} className="text-left text-sm font-semibold text-[var(--share-green-800)] hover:underline">{label}</button> : <span className="text-sm font-semibold">{label}</span>}
          {detail && <span className="text-xs text-zinc-600">{detail}</span>}
        </div>
        {[value, secondary, tertiary].map((v, i) => v === undefined ? null : <div key={i} className="mt-1 flex items-center gap-2">
          <div className="h-2 min-w-0 flex-1 rounded-full bg-zinc-100" aria-hidden><div className="h-full rounded-full" style={{ width: (v / max * 100) + "%", backgroundColor: colors[i] }} /></div>
          <span className="min-w-8 text-right text-xs tabular-nums text-zinc-600"><span className="sr-only">{legends[i] ?? label} </span>{format(v)}</span>
        </div>)}
      </li>)}
    </ul>}
  </section>;
}

export function CrmCharts({ metrics, rows, onOwner, onSegment, onEvent, onChannel }: {
  metrics: Metrics; rows: CrmRow[]; onOwner: (owner: string) => void;
  onSegment: (segment: string) => void; onEvent: (event: string) => void; onChannel: (channel: string) => void;
}) {
  const funnelStages = [...new Set([...stages, ...rows.map((row) => row.stage)])];
  const current = funnelStages.map((label) => ({ label, value: rows.filter((row) => row.stage === label).length })).filter((row) => row.value);
  return <div className="grid gap-4 lg:grid-cols-2">
    <BarChart title="Funil comercial · etapas registradas" rows={metrics.funnel} />
    <BarChart title="Conversão dos leads contatados no período" rows={metrics.conversion} />
    <BarChart title="Carteira por etapa atual" rows={current} />
    <BarChart title="Prospecção por semana" rows={metrics.weekly} legends={["Contatados", "Reagiram", "Reuniões realizadas"]} />
    <BarChart title="Retorno por canal" rows={metrics.byChannel} legends={["Contatados", "Reagiram", "Positivas"]} onSelect={onChannel} />
    <BarChart title="Cobertura por segmento" rows={metrics.segments} legends={["No pipeline", "Contatados", "Em reunião realizada"]} onSelect={onSegment} />
    <BarChart title="Propostas e patrocínios por evento" rows={metrics.eventGroups} legends={["Propostas abertas", "Em negociação", "Vendido"]} format={brl} onSelect={onEvent} />
    <BarChart title="Follow-ups por responsável" rows={metrics.byOwner} legends={["Atrasados", "Hoje", "Sem data"]} onSelect={onOwner} />
  </div>;
}
