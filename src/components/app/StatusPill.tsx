import { clsx } from "clsx";

type StatusPillProps = {
  children: React.ReactNode;
  tone?: "ready" | "warning" | "neutral";
};

export function StatusPill({ children, tone = "neutral" }: StatusPillProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        tone === "ready" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-800",
        tone === "neutral" && "border-zinc-200 bg-white text-zinc-600",
      )}
    >
      {children}
    </span>
  );
}
