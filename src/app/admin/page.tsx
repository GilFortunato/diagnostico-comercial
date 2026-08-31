import Link from "next/link";
import { Blocks, DatabaseZap, UsersRound } from "lucide-react";
import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { AppHeader } from "@/components/app/AppHeader";
import { hasAdminSession } from "@/lib/auth/adminRequest";

const areas = [
  { href: "/admin/users", title: "Usuários e permissões", description: "Ative contas e defina os módulos disponíveis para cada pessoa.", icon: UsersRound },
  { href: "/admin/business-units", title: "Business Units", description: "Revise o DNA, os territórios e o contexto estratégico das unidades.", icon: Blocks },
  { href: "/admin/connectors", title: "Conexões globais", description: "Gerencie a disponibilidade de Gemini e das fontes públicas autorizadas.", icon: DatabaseZap },
];

export default async function AdminPage() {
  if (!(await hasAdminSession())) return <AdminAccessDenied />;
  return <><AppHeader isAdmin /><main className="share-shell min-h-screen px-5 py-10"><section className="mx-auto max-w-6xl"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Administração</p><h1 className="mt-2 text-3xl font-semibold text-[var(--share-green-950)]">Central administrativa</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">Configurações internas separadas da experiência normal do cockpit.</p><div className="mt-7 grid gap-4 md:grid-cols-3">{areas.map(({ href, title, description, icon: Icon }) => <Link key={href} href={href} className="rounded-lg border border-[var(--share-line)] bg-white p-5 shadow-[0_12px_40px_rgb(0_63_46_/_0.06)] transition hover:border-[var(--share-green-800)]"><Icon className="h-5 w-5 text-[var(--share-green-800)]" /><h2 className="mt-4 text-lg font-semibold text-[var(--share-green-950)]">{title}</h2><p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p></Link>)}</div></section></main></>;
}
