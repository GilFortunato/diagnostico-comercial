"use client";

import { useEffect, useState } from "react";
import { LogIn, LogOut, UserCircle } from "lucide-react";
import { getProviders, signIn, signOut, useSession } from "next-auth/react";

export function LoginButton({ variant = "dark", label = "Entrar com Google" }: { variant?: "dark" | "light"; label?: string }) {
  const { data: session, status } = useSession();
  const [hasGoogleProvider, setHasGoogleProvider] = useState(true);
  const isLight = variant === "light";

  useEffect(() => {
    getProviders().then((providers) => {
      setHasGoogleProvider(Boolean(providers?.google));
    });
  }, []);

  if (status === "loading") {
    return <span className={`rounded-md border px-3 py-2 text-sm ${isLight ? "border-[var(--share-line)] text-zinc-500" : "border-white/15 text-white/70"}`}>Carregando acesso</span>;
  }

  if (session?.user) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${isLight ? "border-[var(--share-line)] bg-white text-[var(--share-green-950)]" : "border-white/15 text-white/85"}`}>
          <UserCircle className="h-4 w-4 text-[var(--share-lime)]" />
          {session.user.name ?? session.user.email}
        </span>
        <button
          type="button"
          onClick={() => signOut()}
          className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${isLight ? "border-[var(--share-line)] bg-white text-[var(--share-green-950)] hover:bg-[#edf7eb]" : "border-white/15 text-white hover:bg-white/10"}`}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => hasGoogleProvider && signIn("google")}
      disabled={!hasGoogleProvider}
      title={!hasGoogleProvider ? "O acesso com Google está temporariamente indisponível." : undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        isLight
          ? "bg-[var(--share-green-950)] text-white hover:bg-[var(--share-green-800)]"
          : "bg-white text-[var(--share-green-950)] hover:bg-[var(--share-lime)] disabled:bg-white/60 disabled:text-white/60"
      }`}
    >
      <LogIn className="h-4 w-4" />
      {hasGoogleProvider ? label : "Login com Google indisponível"}
    </button>
  );
}
