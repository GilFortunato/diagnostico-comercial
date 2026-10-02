"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  Camera,
  ChevronDown,
  ImageIcon,
  LineChart,
  LockKeyhole,
  MessageSquareText,
  Search,
  Sparkles,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { signIn, signOut } from "next-auth/react";
import { useMemo, useState } from "react";
import { NexusBackground } from "@/components/app/NexusBackground";
import { NexusCore } from "@/components/app/NexusCore";
import type { PlatformModule } from "@/lib/auth/moduleAccessPolicy";

type AccessMap = Partial<Record<PlatformModule, boolean>>;

type Workspace = {
  key: string;
  title: string;
  shortTitle: string;
  category: string;
  href: string;
  module: PlatformModule;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  summary: string;
  features: string[];
  brand?: "humanship";
  new?: boolean;
};

const workspaces: Workspace[] = [
  {
    key: "diagnostico",
    title: "Diagnóstico Comercial",
    shortTitle: "Diagnóstico\nComercial",
    category: "Autoridade",
    href: "/diagnostico",
    module: "authority.personal",
    icon: BarChart3,
    description: "Autoridade, posicionamento e plano de ação com apoio da IA.",
    summary: "Leia presença digital, identifique lacunas e transforme posicionamento em próximos passos.",
    features: ["Diagnóstico de autoridade", "Leitura de posicionamento", "Plano de ação", "Evidências e fontes"],
  },
  {
    key: "b2b",
    title: "Diagnóstico B2B",
    shortTitle: "Diagnóstico\nB2B",
    category: "Comercial",
    href: "/mapa-decisores",
    module: "decision.makers",
    icon: LineChart,
    description: "Empresas, decisores e oportunidades comerciais em um só fluxo.",
    summary: "Mapeie empresas e pessoas-chave para transformar inteligência comercial em prospecção.",
    features: ["Mapa de decisores", "Sinais de oportunidade", "Empresas-alvo", "Próximos passos"],
  },
  {
    key: "hr",
    title: "HR Hunting",
    shortTitle: "HR\nHunting",
    category: "Pessoas",
    href: "/hr-hunting",
    module: "hr.hunting",
    icon: UsersRound,
    description: "Busca, triagem e inteligência aplicada ao recrutamento.",
    summary: "Transforme uma vaga em DNA de busca, encontre perfis e organize sua shortlist.",
    features: ["Job DNA", "Busca de perfis", "Fit de candidatos", "Shortlist"],
  },
  {
    key: "humanship",
    title: "Humanship",
    shortTitle: "Humanship",
    category: "Pessoas",
    href: "/humanship",
    module: "humanship.r1ship",
    icon: UsersRound,
    description: "Pessoas, cultura e liderança com apoio da IA.",
    summary: "Desenvolva líderes, conecte pessoas e fortaleça uma cultura mais humana e estratégica.",
    features: ["Diagnósticos de liderança", "Desenvolvimento de pessoas", "Jornadas e programas", "Eventos e comunidade"],
    brand: "humanship",
  },
  {
    key: "events",
    title: "Eventos & Comunidade",
    shortTitle: "Eventos\n& Comunidade",
    category: "Pessoas",
    href: "/humanship",
    module: "humanship.r1ship",
    icon: CalendarDays,
    description: "Agenda, comunidade e jornadas conectadas ao ecossistema Humanship.",
    summary: "Organize experiências, acompanhe eventos e conecte os próximos movimentos da comunidade.",
    features: ["Próximos eventos", "Jornadas", "Participantes", "Comunidade"],
  },
  {
    key: "rapport",
    title: "Rapport",
    shortTitle: "Rapport",
    category: "Relacionamento",
    href: "/rapport",
    module: "rapport.pre-meeting",
    icon: MessageSquareText,
    description: "Contexto e inteligência para conversas mais relevantes.",
    summary: "Chegue às interações com contexto, sinais e pontos de conexão preparados.",
    features: ["Contexto da pessoa", "Pontos de conexão", "Preparação de conversa", "Recomendações"],
  },
  {
    key: "trends",
    title: "Share Trend Intelligence",
    shortTitle: "Trend\nIntelligence",
    category: "Criatividade",
    href: "/sharetrendintelligence",
    module: "creative.trend-intelligence",
    icon: TrendingUp,
    description: "Tendências para seu próximo movimento.",
    summary: "Transforme sinais recentes em pauta, contexto, oportunidades de publicação e briefing visual.",
    features: ["Assuntos em alta", "Palavras relacionadas", "Ideias de conteúdo", "Briefing para o Scout"],
    new: true,
  },
  {
    key: "meetings",
    title: "Inteligência de Reuniões",
    shortTitle: "Inteligência\nde Reuniões",
    category: "Relacionamento",
    href: "/meeting-intelligence",
    module: "meeting.intelligence",
    icon: Camera,
    description: "Contexto, preparação e próximos passos para reuniões.",
    summary: "Reúna sinais, contexto e inteligência para chegar melhor preparado às conversas.",
    features: ["Briefing pré-reunião", "Contexto", "Pontos de atenção", "Próximos passos"],
  },
  {
    key: "visual",
    title: "Share Visual Scout",
    shortTitle: "Share\nVisual Scout",
    category: "Criatividade",
    href: "/sharevisualscout",
    module: "creative.visual-scout",
    icon: ImageIcon,
    description: "Pesquisa e curadoria inteligente de imagens.",
    summary: "Cole o briefing e encontre referências visuais em múltiplos bancos com curadoria e ranking.",
    features: ["Busca multi-banco", "Curadoria visual", "Briefing semântico", "Coleções"],
    new: true,
  },
];

function polar(cx:number, cy:number, radius:number, angle:number) {
  const rad = (angle - 90) * Math.PI / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

function annularSectorPath(index:number, total:number, inner=31, outer=47) {
  const gap = 2.4;
  const step = 360 / total;
  const start = index * step + gap;
  const end = (index + 1) * step - gap;
  const o1 = polar(50,50,outer,start);
  const o2 = polar(50,50,outer,end);
  const i2 = polar(50,50,inner,end);
  const i1 = polar(50,50,inner,start);
  const large = end-start > 180 ? 1 : 0;
  return [
    `M ${o1.x.toFixed(3)} ${o1.y.toFixed(3)}`,
    `A ${outer} ${outer} 0 ${large} 1 ${o2.x.toFixed(3)} ${o2.y.toFixed(3)}`,
    `L ${i2.x.toFixed(3)} ${i2.y.toFixed(3)}`,
    `A ${inner} ${inner} 0 ${large} 0 ${i1.x.toFixed(3)} ${i1.y.toFixed(3)}`,
    "Z",
  ].join(" ");
}

export function HomeExperience({
  isAdmin = false,
  access = {},
  userName,
  authenticated = false,
}: {
  isAdmin?: boolean;
  access?: AccessMap;
  userName?: string | null;
  authenticated?: boolean;
}) {
  const available = useMemo(
    () => workspaces.map((workspace) => ({
      ...workspace,
      allowed: isAdmin || Boolean(access[workspace.module]),
    })),
    [access, isAdmin],
  );

  const defaultKey = available.find((workspace) => workspace.key === "humanship" && workspace.allowed)?.key
    ?? available.find((workspace) => workspace.allowed)?.key
    ?? "humanship";
  const [selectedKey, setSelectedKey] = useState(defaultKey);
  const selected = available.find((workspace) => workspace.key === selectedKey) ?? available[0];

  const name = firstName(userName || "Gil");
  const unlocked = available.filter((workspace) => workspace.allowed).length;

  return (
    <main className="share-hub-home">
      <NexusBackground />
      <div className="share-hub-vignette" />
      <div className="share-hub-shell">
        <header className="share-hub-header">
          <div className="share-hub-brand">
            <Image
              src="/brand/share-people-hub-white.svg"
              alt="Share People Hub"
              width={220}
              height={112}
              priority
            />
          </div>

          {authenticated ? (
            <div className="share-hub-userbar">
              <button type="button" className="share-hub-icon-button" aria-label="Buscar"><Search /></button>
              <button type="button" className="share-hub-icon-button share-hub-notification" aria-label="Notificações"><Bell /></button>
              <div className="share-hub-avatar">{name.slice(0,1).toUpperCase()}</div>
              <span className="share-hub-username">{userName || "Usuário"}</span>
              <button type="button" className="share-hub-chevron" aria-label="Sair" onClick={() => signOut({ callbackUrl:"/" })}>
                <ChevronDown />
              </button>
            </div>
          ) : (
            <button type="button" className="share-hub-login" onClick={() => signIn("google")}>Entrar com Google</button>
          )}
        </header>

        <div className="share-hub-main-grid">
          <section className="share-hub-intro">
            <p className="share-hub-eyebrow"><span />{authenticated ? `Bem-vinda, ${name}` : "Share People Hub"}</p>
            <h1>O que você<br />quer fazer hoje?</h1>
            <p className="share-hub-intro-copy">
              Escolha um workspace e explore todo o potencial da nossa IA para pessoas e negócios.
            </p>
            {!authenticated ? (
              <button type="button" className="share-hub-login share-hub-login-large" onClick={() => signIn("google")}>
                Acessar Share Hub <ArrowRight />
              </button>
            ) : null}
          </section>

          <section className="share-hub-nexus-wrap" aria-label="Workspaces Share Hub">
            <div className="share-hub-nexus">
              <svg viewBox="0 0 100 100" className="share-hub-ring" aria-hidden="true">
                <circle cx="50" cy="50" r="49" className="share-hub-ring-outer" />
                <circle cx="50" cy="50" r="30" className="share-hub-ring-inner" />
                {available.map((workspace,index) => (
                  <path
                    key={workspace.key}
                    d={annularSectorPath(index, available.length)}
                    className={[
                      "share-hub-sector",
                      workspace.key === selected.key ? "is-selected" : "",
                      workspace.allowed ? "is-enabled" : "is-locked",
                    ].join(" ")}
                  />
                ))}
              </svg>

              {available.map((workspace,index) => {
                const angle = -90 + index * (360 / available.length) + (180 / available.length);
                const p = polar(50,50,39,angle);
                const Icon = workspace.icon;
                const selectedNow = workspace.key === selected.key;
                return (
                  <button
                    key={workspace.key}
                    type="button"
                    disabled={!workspace.allowed && authenticated}
                    onClick={() => setSelectedKey(workspace.key)}
                    className={`share-hub-sector-label ${selectedNow ? "is-selected" : ""} ${workspace.allowed ? "" : "is-locked"}`}
                    style={{ left:`${p.x}%`, top:`${p.y}%` }}
                    aria-label={workspace.allowed ? `Selecionar ${workspace.title}` : `${workspace.title} bloqueado`}
                  >
                    <span className="share-hub-sector-icon">{workspace.allowed ? <Icon /> : <LockKeyhole />}</span>
                    <span>{workspace.shortTitle.split("\n").map((line,i)=><span key={i}>{line}</span>)}</span>
                  </button>
                );
              })}

              <div className="share-hub-core">
                <NexusCore />
                <div className="share-hub-core-brand">
                  <Image src="/brand/share-wordmark-white.svg" alt="share" width={200} height={62} priority />
                  <span>hub</span>
                </div>
              </div>
            </div>
          </section>

          <aside className="share-hub-detail">
            <div className={`share-hub-detail-brand ${selected.brand === "humanship" ? "is-humanship" : ""}`}>
              {selected.brand === "humanship" ? (
                <Image src="/brand/humanship-logo.svg" alt="Humanship" width={280} height={40} />
              ) : (
                <>
                  <span>{selected.category}</span>
                  <strong>{selected.title}</strong>
                </>
              )}
            </div>

            <div className="share-hub-detail-body">
              <h2>{selected.title}</h2>
              <p className="share-hub-detail-lead">{selected.description}</p>
              <p className="share-hub-detail-copy">{selected.summary}</p>
              <div className="share-hub-detail-divider" />
              <ul>
                {selected.features.map((feature) => (
                  <li key={feature}><span className="share-hub-feature-dot" />{feature}</li>
                ))}
              </ul>

              {selected.allowed || !authenticated ? (
                <Link href={authenticated ? selected.href : "#"} onClick={(event) => { if (!authenticated) { event.preventDefault(); void signIn("google"); } }} className="share-hub-open">
                  Abrir workspace <ArrowRight />
                </Link>
              ) : (
                <button type="button" className="share-hub-open is-disabled" disabled><LockKeyhole /> Workspace não liberado</button>
              )}
            </div>
          </aside>
        </div>

        <section className="share-hub-bottom-cards">
          <Link href="/humanship" className="share-hub-bottom-card">
            <span className="share-hub-bottom-icon"><CalendarDays /></span>
            <span className="share-hub-bottom-content">
              <small>Próximo evento</small>
              <strong>Humanship Festival</strong>
              <span>16 e 17 de outubro</span>
            </span>
            <ArrowRight className="share-hub-bottom-arrow" />
          </Link>

          <Link href="/hr-hunting" className="share-hub-bottom-card">
            <span className="share-hub-bottom-icon"><MessageSquareText /></span>
            <span className="share-hub-bottom-content">
              <small>Continue de onde parou</small>
              <strong>HR Hunting</strong>
              <span>Última atividade: triagem de perfis</span>
            </span>
            <ArrowRight className="share-hub-bottom-arrow" />
          </Link>

          <Link href="/sharetrendintelligence" className="share-hub-bottom-card">
            <span className="share-hub-bottom-icon share-hub-spark"><Sparkles /></span>
            <span className="share-hub-bottom-content">
              <small>Novidade</small>
              <strong>Share Trend Intelligence</strong>
              <span>Tendências para seu próximo movimento</span>
            </span>
            <ArrowRight className="share-hub-bottom-arrow" />
          </Link>
        </section>

        {authenticated ? (
          <div className="share-hub-access-note">{unlocked} workspace{unlocked === 1 ? "" : "s"} liberado{unlocked === 1 ? "" : "s"} para sua conta.</div>
        ) : null}
      </div>
    </main>
  );
}

function firstName(value:string) {
  return value.trim().split(/\s+/)[0] || value;
}
