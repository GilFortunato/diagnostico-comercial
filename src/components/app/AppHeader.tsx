"use client";

import Link from "next/link";
import Image from "next/image";
import { LoginButton } from "@/components/auth/LoginButton";
import { getAppNavigation } from "@/lib/auth/navigation";

export function AppHeader({ isAdmin = false }: { isAdmin?: boolean }) {
  const navigation = getAppNavigation(isAdmin);
  return (
    <header className="sticky top-0 z-30 border-b border-white/15 bg-[var(--share-green-950)]/95 text-white backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex items-end gap-2" aria-label="Share AI - Home">
          <Image
            src="/brand/share-wordmark-white.svg"
            alt="Share"
            width={118}
            height={38}
            className="h-auto w-[108px] md:w-[118px]"
            priority
          />
          <span className="pb-1 text-xs font-semibold uppercase leading-3 text-[var(--share-lime)]">AI</span>
        </Link>
        <nav aria-label="Navegação principal" className="order-3 flex w-full items-center gap-1 overflow-x-auto text-sm font-semibold md:order-none md:w-auto">
          {navigation.map((item) => <Link key={item.href} href={item.href} className="rounded-md px-3 py-2 hover:bg-white/10">{item.label}</Link>)}
        </nav>
        <LoginButton />
      </div>
    </header>
  );
}
