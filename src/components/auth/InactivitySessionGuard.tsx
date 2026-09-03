"use client";

import { useEffect, useRef, useState } from "react";
import { Clock3 } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { clearShareAiClientState, markShareAiActivity, readShareAiLastActivity } from "@/lib/auth/clientSession";

const idleTimeoutMs = 30 * 60 * 1000;
const warningWindowMs = 2 * 60 * 1000;
const activityThrottleMs = 15_000;

export function InactivitySessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [warning, setWarning] = useState(false);
  const lastWriteRef = useRef(0);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;

    const now = Date.now();
    if (!window.localStorage.getItem("share-ai:last-activity")) markShareAiActivity(now);

    const recordActivity = () => {
      const current = Date.now();
      if (current - lastWriteRef.current < activityThrottleMs) return;
      lastWriteRef.current = current;
      markShareAiActivity(current);
      setWarning(false);
    };

    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));

    const interval = window.setInterval(async () => {
      const idleFor = Date.now() - readShareAiLastActivity();
      if (idleFor >= idleTimeoutMs) {
        clearShareAiClientState();
        await signOut({ callbackUrl: "/" });
        return;
      }
      setWarning(idleFor >= idleTimeoutMs - warningWindowMs);
    }, 15_000);

    const onStorage = (event: StorageEvent) => {
      if (event.key === "share-ai:last-activity") setWarning(false);
    };
    window.addEventListener("storage", onStorage);

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
      window.removeEventListener("storage", onStorage);
      window.clearInterval(interval);
    };
  }, [session?.user, status]);

  return (
    <>
      {children}
      {warning ? (
        <div className="fixed bottom-5 right-5 z-[80] max-w-sm rounded-lg border border-amber-200 bg-white p-4 shadow-[0_18px_60px_rgb(0_0_0_/_0.18)]">
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <p className="font-semibold text-[var(--share-green-950)]">Sua sessão será encerrada em breve</p>
              <p className="mt-1 text-sm leading-6 text-zinc-600">Por segurança, a Share AI encerra a sessão após 30 minutos sem atividade.</p>
              <button type="button" onClick={() => { markShareAiActivity(); setWarning(false); }} className="mt-3 rounded-md border border-[var(--share-green-800)] px-3 py-2 text-sm font-semibold text-[var(--share-green-900)] hover:bg-[#edf7eb]">
                Continuar conectado
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
