"use client";

import Link from "next/link";
import Image from "next/image";
import { LoginButton } from "@/components/auth/LoginButton";

export function ScoutHeader({ active }: { active: "visual" | "trend" }) {
  const item = (href: string, label: string, key: "visual" | "trend") => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`relative px-2 py-5 text-sm font-semibold ${active === key ? "text-[var(--share-green-950)]" : "text-zinc-600"}`}
    >
      {label}
      {active === key ? <span className="absolute inset-x-2 bottom-0 h-1 rounded-t bg-[var(--share-lime)]" /> : null}
    </Link>
  );

  return (
    <header className="border-b border-[var(--share-line)] bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between flex-wrap gap-x-5 gap-y-0 px-5 py-1">
        <Link href="/" className="flex items-end gap-2 py-3" aria-label="Voltar ao Share Hub">
          <Image
            src="/brand/share-wordmark-green.svg"
            alt="Share"
            width={118}
            height={38}
            className="h-auto w-[108px] md:w-[118px]"
            priority
          />
          <span className="pb-1 text-xs font-semibold uppercase text-[var(--share-green-800)]">AI</span>
        </Link>
        <nav aria-label="MKT Scout" className="flex items-center gap-5">
          {item("/sharetrendintelligence", "Trend Intelligence", "trend")}
          {item("/sharevisualscout", "Visual Scout", "visual")}
        </nav>
        <LoginButton variant="light" label="Entrar" />
      </div>
    </header>
  );
}
