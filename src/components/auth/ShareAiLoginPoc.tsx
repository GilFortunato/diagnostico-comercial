"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";
import { BarChart3, Building2, FileText, Heart, UsersRound } from "lucide-react";
import { NexusBackground } from "@/components/app/NexusBackground";
import { NexusCore } from "@/components/app/NexusCore";
import styles from "./ShareAiLoginPoc.module.css";

const workspaces = [
  { name: "HR Hunting", icon: UsersRound },
  { name: "B2B Hunting", icon: Building2 },
  { name: "MKT Scout", icon: BarChart3 },
  { name: "Humanship", icon: Heart },
  { name: "Diagnóstico Comercial", icon: FileText },
];

export function ShareAiLoginPoc() {
  const logo = "/brand/share-nexus-logo.png";
  const logoAlt = "Share";

  return (
    <main className={styles.page}>
      <div className={styles.background} aria-hidden="true"><NexusBackground /></div>
      <div className={styles.orbits} aria-hidden="true">
        <div className={styles.outerOrbit} />
        <div className={styles.middleOrbit} />
        <div className={styles.innerOrbit} />
        <NexusCore />
      </div>

      <div className={styles.layout}>
        <section className={styles.intro} aria-labelledby="login-poc-headline">
          <Image className={styles.heroLogo} src={logo} alt={logoAlt} width={6226} height={2189} sizes="(max-width: 760px) 225px, 320px" preload />
          <h1 id="login-poc-headline">Inteligência para<br /><span>pessoas e negócios</span></h1>
          <p className={styles.description}>
            Um hub unificado com IA para potencializar pessoas, equipes e resultados, conectando todos os nossos workspaces em um só lugar.
          </p>
          <ul className={styles.chips} aria-label="Workspaces Share AI">
            {workspaces.map(({ name, icon: Icon }) => (
              <li key={name}><Icon size={21} strokeWidth={1.6} aria-hidden="true" /><span>{name}</span></li>
            ))}
          </ul>
        </section>

        <section className={styles.card} aria-labelledby="login-poc-title">
          <Image className={styles.cardLogo} src={logo} alt={logoAlt} width={6226} height={2189} sizes="(max-width: 760px) 225px, 320px" preload />
          <div className={styles.sparkle} aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="currentColor"><path d="M24 3C21 16 16 21 3 24c13 3 18 8 21 21 3-13 8-18 21-21C32 21 27 16 24 3Z" /></svg>
          </div>
          <h2 id="login-poc-title">Entrar na Share AI</h2>
          <p className={styles.cardDescription}>Use sua conta Google autorizada para acessar os workspaces liberados para você.</p>
          <button className={styles.googleButton} type="button" onClick={() => signIn("google", { callbackUrl: "/" })}>
            <Image src="/brand/google-g.png" alt="" width={22} height={22} />
            Continuar com Google
          </button>
        </section>
      </div>
    </main>
  );
}
