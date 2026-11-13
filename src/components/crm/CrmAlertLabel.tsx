import { alertFor, type CrmRow } from "@/lib/crm/model";

export function CrmAlertLabel({ row, today }: { row: CrmRow; today: string }) {
  const alert = alertFor(row, today);
  const colors: Record<string, string> = { danger: "bg-red-50 text-red-800", warning: "bg-amber-50 text-amber-900", ok: "bg-emerald-50 text-emerald-900", neutral: "bg-zinc-100 text-zinc-700" };
  return <span className={"inline-block rounded-full px-2 py-1 text-xs font-semibold " + colors[alert.tone]}>{alert.label}</span>;
}
