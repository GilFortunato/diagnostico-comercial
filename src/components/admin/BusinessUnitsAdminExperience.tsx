"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ComponentType } from "react";
import { ArrowLeft, CheckCircle2, Copy, Eye, FileText, Layers3, Pencil, Plus, Radio, ShieldCheck } from "lucide-react";
import { LoginButton } from "@/components/auth/LoginButton";
import { businessUnitCatalog, defaultBusinessUnitId, type BusinessUnitDna } from "@/lib/business-units/dna";

const wizardSteps = ["Identidade", "Posicionamento", "Oferta", "Mercado", "Autoridade", "Conteudo", "Conhecimento", "Revisao", "Publicacao"];

export function BusinessUnitsAdminExperience() {
  const [selectedId, setSelectedId] = useState(defaultBusinessUnitId);
  const selectedBu = useMemo(() => businessUnitCatalog.find((unit) => unit.id === selectedId) ?? businessUnitCatalog[0], [selectedId]);

  return (
    <main className="share-shell min-h-screen text-[var(--share-ink)]">
      <header className="border-b border-white/15 bg-[var(--share-green-950)]/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-3">
          <Link href="/" className="inline-flex items-center gap-3 text-white">
            <ArrowLeft className="h-4 w-4 text-[var(--share-lime)]" />
            <span className="share-wordmark text-4xl">share</span>
            <span className="pb-1 text-xs font-semibold uppercase leading-3 text-[var(--share-lime)]">AI</span>
          </Link>
          <LoginButton />
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8">
        <section className="relative overflow-hidden rounded-lg bg-[var(--share-green-950)] p-6 text-white shadow-[0_28px_90px_rgb(0_63_46_/_0.18)] md:p-8">
          <div className="absolute right-8 top-8 h-40 w-40 rounded-full border border-white/10" />
          <div className="absolute right-24 top-20 h-16 w-16 rounded-full border border-[var(--share-lime)]/45" />
          <div className="relative max-w-3xl">
            <div className="h-2 w-56 rounded-r-md bg-[var(--share-lime)]" />
            <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-[var(--share-lime)]">Admin Share AI</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl">Business Units sao DNA de mercado, nao telas separadas.</h1>
            <p className="mt-5 text-base leading-7 text-white/74">
              A Share continua sendo a marca-mae. Cada BU configura contexto, posicionamento, oferta, ICP, personas, territorios, conteudo, claims e documentos usados pelas skills.
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <aside className="share-card rounded-lg p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Business Units</p>
                <h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">Central de BUs</h2>
              </div>
              <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--share-lime)] text-[var(--share-green-950)]">
                <Plus className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 grid gap-3">
              {businessUnitCatalog.map((unit) => (
                <button
                  key={unit.id}
                  type="button"
                  onClick={() => setSelectedId(unit.id)}
                  className={`rounded-md border p-4 text-left transition ${
                    unit.id === selectedId ? "border-[var(--share-green-950)] bg-[var(--share-green-950)] text-white" : "border-[var(--share-line)] bg-white text-zinc-700 hover:border-[var(--share-green-800)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{unit.name}</p>
                      <p className={unit.id === selectedId ? "mt-1 text-xs text-white/68" : "mt-1 text-xs text-zinc-500"}>{unit.description}</p>
                    </div>
                    <span className="h-3 w-10 rounded-full" style={{ backgroundColor: unit.brandPack.accent }} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge status={unit.status} active={unit.id === selectedId} />
                    <SmallMetric label="Produtos" value={unit.products.length} active={unit.id === selectedId} />
                    <SmallMetric label="ICP" value={unit.icps.length} active={unit.id === selectedId} />
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <div className="grid gap-6">
            <BusinessUnitOverview unit={selectedBu} />
            <BusinessUnitWizardPreview unit={selectedBu} />
            <BusinessUnitDnaPanels unit={selectedBu} />
          </div>
        </section>
      </div>
    </main>
  );
}

function BusinessUnitOverview({ unit }: { unit: BusinessUnitDna }) {
  const knowledgeHealth = calculateKnowledgeHealth(unit);

  return (
    <section className="share-card rounded-lg p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">BU DNA</p>
          <h2 className="mt-1 text-3xl font-semibold text-[var(--share-green-950)]">{unit.name}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">{unit.tagline}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminButton icon={Pencil} label="Editar" />
          <AdminButton icon={Eye} label="Visualizar como usuario" />
          <AdminButton icon={Copy} label="Duplicar" />
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <HealthTile label="Status" value={unit.status === "published" ? "Ativa" : unit.status} icon={CheckCircle2} />
        <HealthTile label="Documentos" value={String(unit.documents.length)} icon={FileText} />
        <HealthTile label="Brand Pack" value="Configurado" icon={Layers3} />
        <HealthTile label="Knowledge Health" value={`${knowledgeHealth}%`} icon={ShieldCheck} />
      </div>
      <div className="mt-5 rounded-md p-4" style={{ backgroundColor: unit.brandPack.surface }}>
        <p className="text-sm font-semibold text-[var(--share-green-950)]">Posicionamento publicado</p>
        <p className="mt-2 text-sm leading-6 text-zinc-700">{unit.positioning.whatWeAre}</p>
      </div>
    </section>
  );
}

function BusinessUnitWizardPreview({ unit }: { unit: BusinessUnitDna }) {
  return (
    <section className="share-card rounded-lg p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Criacao guiada</p>
          <h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">Wizard de nova BU</h2>
        </div>
        <button type="button" className="share-button-primary inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold">
          <Plus className="h-4 w-4" />
          Nova Business Unit
        </button>
      </div>
      <div className="mt-5 grid gap-2 md:grid-cols-3">
        {wizardSteps.map((step, index) => (
          <div key={step} className="flex items-center gap-3 rounded-md border border-[var(--share-line)] bg-[#fbfdf8] px-3 py-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold" style={{ backgroundColor: index === 0 ? unit.brandPack.accent : "#edf7eb", color: "var(--share-green-950)" }}>
              {index + 1}
            </span>
            <span className="text-sm font-medium text-zinc-700">{step}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm leading-6 text-zinc-600">
        Nesta fase o wizard esta estruturado como fundacao visual e contrato de campos. Persistencia e RBAC de escrita entram quando ligarmos o Admin ao banco.
      </p>
    </section>
  );
}

function BusinessUnitDnaPanels({ unit }: { unit: BusinessUnitDna }) {
  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <DnaPanel title="Produtos e solucoes" items={unit.products.map((product) => ({ title: product.name, text: product.description, meta: product.keywords.join(", ") }))} />
      <DnaPanel title="ICP" items={unit.icps.map((icp) => ({ title: icp.name, text: icp.problems.join("; "), meta: icp.buyingAreas.join(", ") }))} />
      <DnaPanel title="Personas" items={unit.personas.map((persona) => ({ title: persona.name, text: persona.pains.join("; "), meta: persona.relatedProducts.join(", ") }))} />
      <DnaPanel title="Territorios de autoridade" items={unit.authorityTerritories.map((territory) => ({ title: territory.name, text: territory.description, meta: territory.keywords.join(", ") }))} />
      <DnaPanel title="Claims aprovados" items={unit.contentDna.approvedClaims.map((claim) => ({ title: claim.claim, text: claim.source, meta: "Confirmado por fonte cadastrada" }))} />
      <DnaPanel title="Claims proibidos" items={unit.contentDna.forbiddenClaims.map((claim) => ({ title: claim, text: "Nao pode ser usado pela IA sem evidencia.", meta: "Governanca" }))} />
    </section>
  );
}

function DnaPanel({ title, items }: { title: string; items: Array<{ title: string; text: string; meta: string }> }) {
  return (
    <article className="share-card rounded-lg p-5">
      <h3 className="text-lg font-semibold text-[var(--share-green-950)]">{title}</h3>
      <div className="mt-4 grid gap-3">
        {items.length ? (
          items.map((item) => (
            <div key={`${title}-${item.title}`} className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-3">
              <p className="text-sm font-semibold text-zinc-950">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{item.text}</p>
              <p className="mt-2 text-xs font-medium text-[var(--share-green-800)]">{item.meta}</p>
            </div>
          ))
        ) : (
          <p className="rounded-md border border-dashed border-[var(--share-line)] bg-[#fbfdf8] p-3 text-sm text-zinc-500">Ainda nao configurado para esta BU.</p>
        )}
      </div>
    </article>
  );
}

function AdminButton({ icon: Icon, label }: { icon: ComponentType<{ className?: string }>; label: string }) {
  return (
    <button type="button" className="inline-flex items-center gap-2 rounded-md border border-[var(--share-line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--share-green-900)] hover:bg-[#edf7eb]">
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function HealthTile({ label, value, icon: Icon }: { label: string; value: string; icon: ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] p-4">
      <Icon className="h-4 w-4 text-[var(--share-green-800)]" />
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[var(--share-green-950)]">{value}</p>
    </div>
  );
}

function StatusBadge({ status, active }: { status: BusinessUnitDna["status"]; active: boolean }) {
  return (
    <span className={active ? "rounded-md bg-white/14 px-2 py-1 text-xs font-semibold text-white" : "rounded-md bg-[#edf7eb] px-2 py-1 text-xs font-semibold text-[var(--share-green-900)]"}>
      {status === "published" ? "Ativa" : status}
    </span>
  );
}

function SmallMetric({ label, value, active }: { label: string; value: number; active: boolean }) {
  return (
    <span className={active ? "inline-flex items-center gap-1 rounded-md bg-white/14 px-2 py-1 text-xs text-white/78" : "inline-flex items-center gap-1 rounded-md bg-[#fbfdf8] px-2 py-1 text-xs text-zinc-500"}>
      <Radio className="h-3 w-3" />
      {label}: {value}
    </span>
  );
}

function calculateKnowledgeHealth(unit: BusinessUnitDna) {
  const checks = [
    unit.products.length > 0,
    unit.icps.length > 0,
    unit.personas.length > 0,
    unit.authorityTerritories.length > 0,
    unit.contentDna.approvedClaims.length > 0,
    unit.documents.some((document) => document.status === "available"),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
