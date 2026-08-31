"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, RefreshCw, ShieldCheck, UserRoundCog } from "lucide-react";
import type { PlatformModule } from "@/lib/auth/modulePermissions";

type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  modulePermissions: Array<{ moduleKey: string; enabled: boolean }>;
};

const moduleLabels: Record<PlatformModule, string> = {
  "authority.personal": "Diagnóstico pessoal",
  "authority.company": "Diagnóstico de empresas",
  "authority.leader": "Diagnóstico de líderes",
  "content.intelligence": "Inteligência de conteúdo",
  "decision.makers": "Mapa de decisores",
  "hr.hunting": "HR Hunting",
  rapport: "Rapport",
  "meeting.intelligence": "Inteligência de reuniões",
};

async function fetchAdminUsers() {
  const response = await fetch("/api/admin/users", { cache: "no-store" });
  const result = (await response.json()) as { users?: AdminUser[]; modules?: PlatformModule[]; error?: string };
  if (!response.ok) throw new Error(result.error || "Não foi possível carregar os usuários.");
  return result;
}

export function AdminUsersExperience() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [modules, setModules] = useState<PlatformModule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function load() {
    const result = await fetchAdminUsers();
    setUsers(result.users ?? []);
    setModules(result.modules ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    fetchAdminUsers().then((result) => {
      if (cancelled) return;
      setUsers(result.users ?? []);
      setModules(result.modules ?? []);
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : "Não foi possível carregar os usuários.");
    });
    return () => { cancelled = true; };
  }, []);

  function update(payload: Record<string, unknown>) {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        setError(result.error || "Não foi possível salvar a alteração.");
        return;
      }
      await load();
    });
  }

  return (
    <main className="share-shell min-h-screen text-[var(--share-ink)]">
      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--share-line)] pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Administração</p>
            <h1 className="mt-1 text-3xl font-semibold text-[var(--share-green-950)]">Usuários e permissões</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">Gerencie o acesso às áreas da plataforma sem alterar a autenticação Google nem expor credenciais.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-md bg-[#edf7eb] px-3 py-2 text-sm font-semibold text-[var(--share-green-900)]">
            <ShieldCheck className="h-4 w-4" /> Controle no servidor
          </span>
        </div>

        {error ? <p className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        {!users.length && !error ? <p className="mt-8 inline-flex items-center gap-2 text-sm text-zinc-600"><RefreshCw className="h-4 w-4 animate-spin" /> Carregando usuários...</p> : null}

        <div className="mt-6 grid gap-4">
          {users.map((user) => {
            const explicit = new Map(user.modulePermissions.map((permission) => [permission.moduleKey, permission.enabled]));
            return (
              <article key={user.id} className="rounded-lg border border-[var(--share-line)] bg-white p-5 shadow-[0_12px_40px_rgb(0_63_46_/_0.06)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#edf7eb] text-[var(--share-green-900)]"><UserRoundCog className="h-5 w-5" /></span>
                    <div><h2 className="font-semibold text-zinc-950">{user.name || "Nome não informado"}</h2><p className="text-sm text-zinc-600">{user.email}</p><p className="mt-1 text-xs text-zinc-500">Cadastro: {formatDate(user.createdAt)} · Último acesso: {formatDate(user.lastLoginAt)}</p></div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-700">
                    <input type="checkbox" checked={user.active} disabled={isPending} onChange={(event) => update({ action: "account", userId: user.id, active: event.target.checked })} />
                    {user.active ? "Conta ativa" : "Conta desativada"}
                  </label>
                </div>
                <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {modules.map((moduleKey) => {
                    const enabled = explicit.get(moduleKey) ?? ["authority.personal", "content.intelligence", "decision.makers", "hr.hunting"].includes(moduleKey);
                    return <label key={moduleKey} className="flex items-center gap-2 rounded-md border border-[var(--share-line)] bg-[#fbfdf8] px-3 py-3 text-sm text-zinc-700"><input type="checkbox" checked={enabled} disabled={isPending || !user.active} onChange={(event) => update({ action: "permission", userId: user.id, moduleKey, enabled: event.target.checked })} /><span>{moduleLabels[moduleKey]}</span>{enabled ? <CheckCircle2 className="ml-auto h-4 w-4 text-[var(--share-green-800)]" /> : null}</label>;
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Ainda não registrado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
