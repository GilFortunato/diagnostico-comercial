"use client";

import { useEffect, useState } from "react";
import { LogIn, LogOut, UserCircle } from "lucide-react";
import { getProviders, signIn, signOut, useSession } from "next-auth/react";

export function LoginButton() {
  const { data: session, status } = useSession();
  const [hasGoogleProvider, setHasGoogleProvider] = useState(true);

  useEffect(() => {
    getProviders().then((providers) => {
      setHasGoogleProvider(Boolean(providers?.google));
    });
  }, []);

  if (status === "loading") {
    return <span className="rounded-md border border-white/15 px-3 py-2 text-sm text-white/70">Carregando acesso</span>;
  }

  if (session?.user) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-2 text-sm text-white/85">
          <UserCircle className="h-4 w-4 text-[var(--share-lime)]" />
          {session.user.name ?? session.user.email}
        </span>
        <button
          type="button"
          onClick={() => signOut()}
          className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
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
      title={!hasGoogleProvider ? "Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET na Vercel." : undefined}
      className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-[var(--share-green-950)] hover:bg-[var(--share-lime)] disabled:cursor-not-allowed disabled:bg-white/60 disabled:text-white/60"
    >
      <LogIn className="h-4 w-4" />
      {hasGoogleProvider ? "Entrar com Google" : "Google Login indisponivel"}
    </button>
  );
}
