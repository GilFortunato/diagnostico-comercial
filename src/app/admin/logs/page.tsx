import Link from "next/link";
import { AlertTriangle, ArrowLeft, CircleAlert, Clock3, Info, ShieldAlert } from "lucide-react";
import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { AppHeader } from "@/components/app/AppHeader";
import { hasAdminSession } from "@/lib/auth/adminRequest";
import { listAppAuditLogs } from "@/lib/audit/appAudit";

const moduleOptions = [
  ["all", "Todos os módulos"],
  ["auth", "Autenticação"],
  ["admin", "Admin"],
  ["humanship", "Humanship"],
  ["hr.hunting", "HR Hunting"],
  ["b2b.hunting", "B2B Hunting"],
  ["creative.trend-intelligence", "Trend Intelligence"],
  ["creative.visual-scout", "Visual Scout"],
];

const severityOptions = [
  ["all", "Todas"],
  ["info", "Info"],
  ["attention", "Atenção"],
  ["error", "Erro"],
  ["security", "Segurança"],
];

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; module?: string; severity?: string; actor?: string }>;
}) {
  if (!(await hasAdminSession())) return <AdminAccessDenied />;

  const query = await searchParams;
  const days = query.days === "30" ? 30 : 7;
  const moduleKey = query.module || "all";
  const severity = query.severity || "all";
  const actor = query.actor || "";
  const logs = await listAppAuditLogs({ days, moduleKey, severity, actor, take: 300 });

  const counts = logs.reduce(
    (acc, log) => {
      acc.total += 1;
      if (log.severity === "error") acc.error += 1;
      if (log.severity === "security") acc.security += 1;
      if (log.severity === "attention") acc.attention += 1;
      return acc;
    },
    { total: 0, error: 0, security: 0, attention: 0 },
  );

  return (
    <>
      <AppHeader isAdmin />
      <main className="min-h-screen bg-[#eef4e9] px-5 py-8 text-[#173b28]">
        <section className="mx-auto max-w-[1440px]">
          <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-[#006142] hover:underline">
            <ArrowLeft className="h-4 w-4" /> Voltar à administração
          </Link>

          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006142]">Administração</p>
              <h1 className="mt-1 text-3xl font-semibold text-[#003f2c]">Logs & Auditoria</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                Atividade operacional fica disponível por 7 dias. Auditoria, segurança e erros relevantes ficam por 30 dias.
              </p>
            </div>
            <div className="flex rounded-xl border border-[#cbdcc9] bg-white p-1 shadow-sm">
              <Link href={buildHref({ ...query, days: "7" })} className={`rounded-lg px-4 py-2 text-sm font-bold ${days === 7 ? "bg-[#003f2c] text-white" : "text-[#006142]"}`}>7 dias</Link>
              <Link href={buildHref({ ...query, days: "30" })} className={`rounded-lg px-4 py-2 text-sm font-bold ${days === 30 ? "bg-[#003f2c] text-white" : "text-[#006142]"}`}>30 dias</Link>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Registros" value={counts.total} icon={Clock3} />
            <MetricCard label="Atenção" value={counts.attention} icon={AlertTriangle} />
            <MetricCard label="Erros" value={counts.error} icon={CircleAlert} />
            <MetricCard label="Segurança" value={counts.security} icon={ShieldAlert} />
          </div>

          <form className="mt-6 grid gap-3 rounded-2xl border border-[#cbdcc9] bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr_1.2fr_auto]">
            <input type="hidden" name="days" value={days} />
            <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-[#006142]">
              Módulo
              <select name="module" defaultValue={moduleKey} className="h-10 rounded-lg border border-[#d7e2d5] bg-white px-3 text-sm font-medium normal-case tracking-normal text-zinc-700">
                {moduleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-[#006142]">
              Severidade
              <select name="severity" defaultValue={severity} className="h-10 rounded-lg border border-[#d7e2d5] bg-white px-3 text-sm font-medium normal-case tracking-normal text-zinc-700">
                {severityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-[#006142]">
              Usuário
              <input name="actor" defaultValue={actor} placeholder="Nome ou e-mail" className="h-10 rounded-lg border border-[#d7e2d5] px-3 text-sm font-normal normal-case tracking-normal text-zinc-700" />
            </label>
            <button type="submit" className="self-end rounded-lg bg-[#006142] px-5 py-2.5 text-sm font-bold text-white">Filtrar</button>
          </form>

          <div className="mt-5 overflow-hidden rounded-2xl border border-[#cbdcc9] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-[#e0e8de] bg-[#f8fbf6] text-[11px] uppercase tracking-wide text-[#006142]">
                  <tr>
                    <th className="p-4">Quando</th>
                    <th className="p-4">Nível</th>
                    <th className="p-4">Usuário</th>
                    <th className="p-4">Módulo</th>
                    <th className="p-4">Ação</th>
                    <th className="p-4">Objeto</th>
                    <th className="p-4">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-[#edf1eb] align-top">
                      <td className="whitespace-nowrap p-4 text-xs text-zinc-500">{formatDate(log.createdAt)}</td>
                      <td className="p-4"><SeverityBadge severity={log.severity} /></td>
                      <td className="p-4">
                        <strong className="block text-[#003f2c]">{log.actorName || "Sistema"}</strong>
                        {log.actorEmail ? <span className="text-xs text-zinc-400">{log.actorEmail}</span> : null}
                      </td>
                      <td className="p-4 font-medium text-zinc-700">{labelModule(log.moduleKey)}</td>
                      <td className="p-4 font-semibold text-[#003f2c]">{humanize(log.action)}</td>
                      <td className="p-4 text-xs text-zinc-500">{[log.entityType, log.entityId].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="max-w-[380px] p-4 text-xs leading-5 text-zinc-500">{metadataSummary(log.metadata)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!logs.length ? <p className="p-10 text-center text-sm text-zinc-500">Nenhum log encontrado para os filtros selecionados.</p> : null}
          </div>

          <p className="mt-4 text-xs leading-5 text-zinc-400">
            Os logs registram contexto operacional mínimo. Credenciais, tokens, cookies, currículos completos e payloads sensíveis não são armazenados nesta trilha.
          </p>
        </section>
      </main>
    </>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Info }) {
  return <div className="rounded-2xl border border-[#cbdcc9] bg-white p-4 shadow-sm"><Icon className="h-4 w-4 text-[#006142]" /><strong className="mt-3 block text-2xl text-[#003f2c]">{value}</strong><span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</span></div>;
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    info: "bg-sky-50 text-sky-700",
    attention: "bg-amber-50 text-amber-700",
    error: "bg-red-50 text-red-700",
    security: "bg-violet-50 text-violet-700",
  };
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${styles[severity] || "bg-zinc-100 text-zinc-600"}`}>{severity === "attention" ? "Atenção" : severity === "security" ? "Segurança" : severity === "error" ? "Erro" : "Info"}</span>;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(value);
}

function labelModule(key: string) {
  return moduleOptions.find(([value]) => value === key)?.[1] || key;
}

function humanize(value: string) {
  return value.replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function metadataSummary(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "—";
  const entries = Object.entries(value as Record<string, unknown>).slice(0, 6);
  if (!entries.length) return "—";
  return entries.map(([key, item]) => `${humanize(key)}: ${String(item)}`).join(" · ");
}

function buildHref(query: { days?: string; module?: string; severity?: string; actor?: string }) {
  const params = new URLSearchParams();
  if (query.days) params.set("days", query.days);
  if (query.module) params.set("module", query.module);
  if (query.severity) params.set("severity", query.severity);
  if (query.actor) params.set("actor", query.actor);
  return `/admin/logs?${params.toString()}`;
}
