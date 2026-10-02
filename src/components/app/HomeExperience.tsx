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
  Lightbulb,
  LineChart,
  Megaphone,
  MessageCircleMore,
  LockKeyhole,
  MessageSquareText,
  Search,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { signIn, signOut } from "next-auth/react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NexusBackground } from "@/components/app/NexusBackground";
import { NexusCore } from "@/components/app/NexusCore";
import type { PlatformModule } from "@/lib/auth/moduleAccessPolicy";

type AccessMap = Partial<Record<PlatformModule, boolean>>;

type Workspace = {
  key: string;
  title: string;
  shortTitle: string;
  ringDescription: string;
  category: string;
  href?: string;
  module: PlatformModule;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  summary: string;
  features: string[];
  brand?: "humanship";
  new?: boolean;
  status?: "construction";
};

const workspaces: Workspace[] = [
  {
    key: "diagnostico",
    title: "Diagnóstico Comercial",
    shortTitle: "Diagnóstico\nComercial",
    ringDescription: "Análises e insights\nde mercado",
    category: "Autoridade",
    href: "/diagnostico",
    module: "authority.personal",
    icon: BarChart3,
    description: "Autoridade, posicionamento e plano de ação com apoio da IA.",
    summary: "Leia presença digital, identifique lacunas e transforme posicionamento em próximos passos.",
    features: ["Diagnóstico de autoridade", "Leitura de posicionamento", "Plano de ação", "Evidências e fontes"],
  },
  {
    key: "hr",
    title: "HR Hunting",
    shortTitle: "HR\nHunting",
    ringDescription: "Talentos para\no seu time",
    category: "Pessoas",
    href: "/hr-hunting",
    module: "hr.hunting",
    icon: UsersRound,
    description: "Busca, triagem e inteligência aplicada ao recrutamento.",
    summary: "Transforme uma vaga em DNA de busca, encontre perfis e organize sua shortlist.",
    features: ["Job DNA", "Busca de perfis", "Fit de candidatos", "Shortlist"],
  },
  {
    key: "b2b",
    title: "B2B Hunting",
    shortTitle: "B2B\nHunting",
    ringDescription: "Empresas e decisores\npara novos negócios",
    category: "Comercial",
    href: "/mapa-decisores",
    module: "decision.makers",
    icon: LineChart,
    description: "Empresas, decisores e oportunidades comerciais em um só fluxo.",
    summary: "Mapeie empresas e pessoas-chave para transformar inteligência comercial em prospecção.",
    features: ["Mapa de decisores", "Sinais de oportunidade", "Empresas-alvo", "Próximos passos"],
  },
  {
    key: "mkt-scout",
    title: "MKT Scout",
    shortTitle: "MKT Scout",
    ringDescription: "Tendências e\ninspiração",
    category: "Marketing",
    href: "/sharetrendintelligence",
    module: "creative.trend-intelligence",
    icon: Megaphone,
    description: "Tendências, sinais e inspiração para marketing.",
    summary: "Transforme movimentos de mercado em pautas, campanhas, conteúdo e direção visual.",
    features: ["Tendências de mercado", "Sinais recentes", "Ideias de conteúdo", "Direção visual"],
    new: true,
  },
  {
    key: "whats-generator",
    title: "Gerador Whats",
    shortTitle: "Gerador Whats",
    ringDescription: "Mensagens individualizadas\npara WhatsApp",
    category: "Marketing",
    href: "/gerador-whats",
    module: "communication.whats-generator",
    icon: MessageCircleMore,
    description: "Mensagens individualizadas para campanhas e contatos pelo WhatsApp.",
    summary: "Importe sua base, defina a comunicação e gere uma mensagem própria para cada contato, com revisão e abertura direta no WhatsApp Web.",
    features: ["Mensagens individualizadas", "Upload de base", "WhatsApp Web", "Histórico de campanhas"],
    new: true,
  },
  {
    key: "events",
    title: "Eventos & Comunidade",
    shortTitle: "Eventos\ne Comunidade",
    ringDescription: "Agenda, encontros\ne networking",
    category: "Pessoas",
    href: "/humanship/eventos",
    module: "humanship.r1ship",
    icon: CalendarDays,
    description: "Agenda, comunidade e jornadas conectadas ao ecossistema Humanship.",
    summary: "Organize experiências, acompanhe eventos e conecte os próximos movimentos da comunidade.",
    features: ["Próximos eventos", "Jornadas", "Participantes", "Comunidade"],
  },
  {
    key: "meetings",
    title: "Inteligência de Reuniões",
    shortTitle: "Inteligência\nde Reuniões",
    ringDescription: "Transcrições e insights\nautomáticos",
    category: "Relacionamento",
    module: "meeting.intelligence",
    icon: Camera,
    description: "Contexto, preparação e próximos passos para reuniões.",
    summary: "Reúna sinais, contexto e inteligência para chegar melhor preparado às conversas.",
    features: ["Briefing pré-reunião", "Contexto", "Pontos de atenção", "Próximos passos"],
    status: "construction",
  },
  {
    key: "rapport",
    title: "Rapport",
    shortTitle: "Rapport",
    ringDescription: "Relatórios e\napresentações",
    category: "Relacionamento",
    module: "rapport",
    icon: MessageSquareText,
    description: "Contexto e inteligência para conversas mais relevantes.",
    summary: "Chegue às interações com contexto, sinais e pontos de conexão preparados.",
    features: ["Contexto da pessoa", "Pontos de conexão", "Preparação de conversa", "Recomendações"],
  },
  {
    key: "humanship",
    title: "Humanship",
    shortTitle: "Humanship",
    ringDescription: "Pessoas, cultura\ne desenvolvimento",
    category: "Pessoas",
    href: "/humanship",
    module: "humanship.r1ship",
    icon: Lightbulb,
    description: "Pessoas, cultura e liderança com apoio da IA.",
    summary: "Desenvolva líderes, conecte pessoas e fortaleça uma cultura mais humana e estratégica.",
    features: ["Diagnósticos de liderança", "Desenvolvimento de pessoas", "Jornadas e programas", "Eventos e comunidade"],
    brand: "humanship",
  },
];

const NEXUS_ROTATION = -80;

function polar(cx:number, cy:number, radius:number, angle:number) {
  const rad = (angle - 90) * Math.PI / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

function annularSectorPath(index:number, total:number, inner=31, outer=47) {
  const gap = 2.4;
  const step = 360 / total;
  const start = NEXUS_ROTATION + index * step + gap;
  const end = NEXUS_ROTATION + (index + 1) * step - gap;
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
  nextEvent = null,
}: {
  isAdmin?: boolean;
  access?: AccessMap;
  userName?: string | null;
  authenticated?: boolean;
  nextEvent?: { title: string; startAt: string; endAt?: string } | null;
}) {
  const router = useRouter();
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
                const step = 360 / available.length;
                const angle = NEXUS_ROTATION + index * step + step / 2;
                const p = polar(50,50,35.8,angle);
                const Icon = workspace.icon;
                const selectedNow = workspace.key === selected.key;
                return (
                  <button
                    key={workspace.key}
                    type="button"
                    disabled={!workspace.allowed && authenticated}
                    onClick={() => setSelectedKey(workspace.key)}
                    onDoubleClick={() => {
                      if (!workspace.href) return;
                      if (!authenticated) {
                        void signIn("google", { callbackUrl: workspace.href });
                        return;
                      }
                      if (workspace.allowed) router.push(workspace.href);
                    }}
                    className={`share-hub-sector-label is-${workspace.key} ${selectedNow ? "is-selected" : ""} ${workspace.allowed ? "" : "is-locked"}`}
                    style={{ left:`${p.x}%`, top:`${p.y}%` }}
                    aria-label={workspace.allowed ? `Selecionar ${workspace.title}` : `${workspace.title} bloqueado`}
                  >
                    <span className="share-hub-sector-icon">{workspace.allowed ? <Icon /> : <LockKeyhole />}</span>
                    {workspace.status === "construction" ? <span className="share-hub-sector-badge">Em construção</span> : null}
                    <span className="share-hub-sector-title">{workspace.shortTitle.split("\n").map((line,i)=><span key={i}>{line}</span>)}</span>
                    <span className="share-hub-sector-description">{workspace.ringDescription.split("\n").map((line,i)=><span key={i}>{line}</span>)}</span>
                  </button>
                );
              })}

              <div className="share-hub-core">
                <NexusCore />
                <div className="share-hub-core-brand">
                  <strong
                    aria-label="share"
                    style={{
                      fontFamily: 'Georgia, "Times New Roman", serif',
                      fontSize: "clamp(46px, 5.2vw, 66px)",
                      lineHeight: 0.78,
                      fontWeight: 800,
                      letterSpacing: "-0.045em",
                      color: "white",
                    }}
                  >
                    share
                  </strong>
                  <span
                    style={{
                      marginTop: 10,
                      fontSize: "clamp(22px, 2vw, 30px)",
                      lineHeight: 1,
                      fontWeight: 800,
                      color: "white",
                    }}
                  >
                    hub
                  </span>
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
              {selected.status === "construction" ? (
                <span className="share-hub-status-badge">Em construção</span>
              ) : null}
              <p className="share-hub-detail-lead">{selected.description}</p>
              <p className="share-hub-detail-copy">{selected.summary}</p>
              <div className="share-hub-detail-divider" />
              <ul>
                {selected.features.map((feature) => (
                  <li key={feature}><span className="share-hub-feature-dot" />{feature}</li>
                ))}
              </ul>

              {!selected.href ? (
                <button type="button" className="share-hub-open is-disabled" disabled>
                  {selected.status === "construction" ? "Em construção" : "Workspace em preparação"}
                </button>
              ) : selected.allowed || !authenticated ? (
                <Link
                  href={authenticated ? selected.href : "#"}
                  onClick={(event) => {
                    if (!authenticated) {
                      event.preventDefault();
                      void signIn("google");
                    }
                  }}
                  className="share-hub-open"
                >
                  Abrir workspace <ArrowRight />
                </Link>
              ) : (
                <button type="button" className="share-hub-open is-disabled" disabled><LockKeyhole /> Workspace não liberado</button>
              )}
            </div>
          </aside>
        </div>

        <section className="share-hub-bottom-cards">
          <Link href="/humanship/eventos" className="share-hub-bottom-card">
            <span className="share-hub-bottom-icon"><CalendarDays /></span>
            <span className="share-hub-bottom-content">
              <small>Próximo evento</small>
              <strong>{nextEvent?.title || "Agenda Humanship"}</strong>
              <span>{nextEvent ? formatHomeEventDate(nextEvent.startAt, nextEvent.endAt) : "Cadastre os próximos eventos"}</span>
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
              <strong>MKT Scout</strong>
              <span>Tendências e sinais para seu próximo movimento</span>
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


function formatHomeEventDate(startAt: string, endAt?: string) {
  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : null;
  const day = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    timeZone: "America/Sao_Paulo",
  }).format(start);

  if (!end) return day;

  const sameMonth = new Intl.DateTimeFormat("pt-BR", {
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(start) === new Intl.DateTimeFormat("pt-BR", {
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(end);

  if (sameMonth) {
    const startDay = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: "America/Sao_Paulo" }).format(start);
    const endDay = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: "America/Sao_Paulo" }).format(end);
    const month = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" }).format(start);
    return `${startDay} e ${endDay} de ${month}`;
  }

  return `${day} → ${new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    timeZone: "America/Sao_Paulo",
  }).format(end)}`;
}
