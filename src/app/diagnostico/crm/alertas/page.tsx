import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/app/AppHeader";
import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { CrmChatSettings } from "@/components/crm/CrmChatSettings";
import { isAdminUser } from "@/lib/auth/admin";
import { authorizeCrm } from "@/lib/crm/http";
import { listCrmChatRecipients } from "@/lib/crm/googleChat";
import { getCrmChatSender, recipientSettings, splitOwners } from "@/lib/crm/googleChatConfig";
import { crmPath } from "@/lib/crm/model";
import { getPrisma } from "@/lib/db/prisma";

export default async function CrmChatPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const access = await authorizeCrm();
  const sender = getCrmChatSender();
  if (!access.ok || !sender || !isAdminUser(access.user) || access.user.email !== sender) return <AdminAccessDenied />;

  const prisma = getPrisma();
  const [settings, connected, opportunities, tasks, accounts, { google }] = await Promise.all([
    prisma.crmChatSettings.findUnique({ where: { senderId: access.user.id }, select: { enabled: true, recipients: true } }),
    prisma.crmChatSettings.count({ where: { senderId: access.user.id, credential: { not: null } } }),
    prisma.crmOpportunity.findMany({ where: { owner: { not: null } }, distinct: ["owner"], select: { owner: true } }),
    prisma.crmTask.findMany({ where: { owner: { not: null }, status: "Pendente" }, distinct: ["owner"], select: { owner: true } }),
    listCrmChatRecipients(sender),
    searchParams,
  ]);
  const owners = [...new Set([...opportunities, ...tasks].flatMap(({ owner }) => splitOwners(owner)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const recipients = recipientSettings(sender).safeParse(settings?.recipients);
  const canSchedule = Boolean(process.env.CRON_SECRET);

  return <>
    <AppHeader isAdmin canUseCrm fullWidth />
    <main className="share-shell min-h-screen px-4 py-7 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link href={crmPath} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--share-green-900)] hover:underline"><ArrowLeft className="h-4 w-4" /> Voltar ao CRM</Link>
        <h1 className="mt-4 text-3xl font-semibold text-[var(--share-green-950)]">Alertas no Google Chat</h1>
        <p className="mt-2 text-sm text-zinc-600">De segunda a sexta, a partir das 9h de Brasília, cada responsável recebe no privado um resumo das suas tarefas vencidas.</p>
        {google === "conta" && <p role="alert" className="mt-3 text-sm text-red-700">Escolha a conta corporativa indicada abaixo para autorizar o envio.</p>}
        {!canSchedule && <p className="mt-3 text-sm text-amber-800">O agendamento dos alertas ainda precisa ser configurado no servidor.</p>}
        <CrmChatSettings sender={sender} connected={connected > 0} enabled={settings?.enabled ?? false} recipients={recipients.success ? recipients.data : []} owners={owners} accounts={accounts.map(({ name, email }) => ({ email, name }))} returnedFromGoogle={google === "volta"} canSchedule={canSchedule} />
      </div>
    </main>
  </>;
}
