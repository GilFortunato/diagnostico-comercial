import "server-only";
import { createHash } from "node:crypto";
import { getPrisma } from "@/lib/db/prisma";
import { isAdminUser } from "@/lib/auth/admin";
import { resolveUserModuleAccess } from "@/lib/auth/moduleAccessPolicy";
import { writeAppAuditLog } from "@/lib/audit/appAudit";
import { crmChatDomain, getCrmChatSender, recipientSettings, splitOwners, type ChatRecipient } from "./googleChatConfig";
import { getCrmChatAccessToken } from "./googleChatAuthorization";
import { crmPath, isActive, normalize, todayInBrazil } from "./model";

const chatApi = "https://chat.googleapis.com/v1";
const crmUrl = new URL(crmPath, "https://diagnostico-comercial-two.vercel.app");
const excludedMarkup = /[<>|&*~_`\r\n]/g;
const plain = (value: string, max: number) => value.replace(excludedMarkup, " ").replace(/\s+/g, " ").trim().slice(0, max);

type OverdueTask = { title: string; owner: string | null; dueDate: Date | null; opportunityId: string; opportunity: {
  owner: string | null; stage: string; contractClosed: boolean; result: string; account: { name: string };
} };

export async function listCrmChatRecipients(sender: string, emails?: string[]) {
  const users = await getPrisma().user.findMany({
    where: { active: true, email: { endsWith: crmChatDomain(sender), not: sender, in: emails } },
    select: {
      id: true, email: true, name: true, active: true, isAdmin: true,
      modulePermissions: { where: { moduleKey: "humanship.crm" }, select: { enabled: true } },
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
  return users.filter((user) => resolveUserModuleAccess("humanship.crm", {
    active: user.active, admin: isAdminUser(user), explicitValue: user.modulePermissions[0]?.enabled,
  }));
}

export function groupCrmChatTasks(tasks: OverdueTask[], recipients: ChatRecipient[]) {
  const lookup = new Map(recipients.flatMap(({ email, aliases }) => aliases.map((alias) => [normalize(alias), email] as const)));
  const grouped = new Map<string, OverdueTask[]>();
  const unmapped = new Set<string>();
  for (const task of tasks) {
    if (!isActive(task.opportunity)) continue;
    const emails = new Set<string>();
    for (const owner of splitOwners(task.owner?.trim() || task.opportunity.owner)) {
      const email = lookup.get(normalize(owner));
      if (email) emails.add(email);
      else unmapped.add(owner);
    }
    for (const email of emails) {
      const group = grouped.get(email) ?? [];
      group.push(task);
      grouped.set(email, group);
    }
  }
  return { grouped, unmapped: [...unmapped] };
}

export function crmChatDigest(tasks: OverdueTask[]) {
  const heading = tasks.length === 1 ? "Você tem 1 tarefa em atraso no CRM Humanship." : `Você tem ${tasks.length} tarefas em atraso no CRM Humanship.`;
  const items = tasks.slice(0, 8).map(({ title, opportunity, opportunityId, dueDate }) => {
    const url = new URL(crmUrl);
    url.searchParams.set("lead", opportunityId);
    const deadline = dueDate?.toISOString().slice(0, 10).split("-").reverse().join("/");
    return `• <${url}|${plain(opportunity.account.name, 100) || "Abrir oportunidade"}> · ${plain(title, 160)} · Venceu em ${deadline}`;
  });
  const more = tasks.length > items.length ? [`Mais ${tasks.length - items.length} tarefas no CRM.`] : [];
  return [heading, "", ...items, ...more, "", `<${crmUrl}|Abrir CRM Humanship>`].join("\n");
}

async function postChat(path: string, token: string, body: object) {
  return fetch(`${chatApi}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
}

export async function sendCrmChatDigest(email: string, token: string, day: string, text: string) {
  const dm = await postChat("spaces:setup", token, {
    space: { spaceType: "DIRECT_MESSAGE", singleUserBotDm: false },
    memberships: [{ member: { name: `users/${email}`, type: "HUMAN" } }],
  });
  if (!dm.ok) throw new Error(`Google Chat DM setup failed (${dm.status})`);
  const space = await dm.json() as { name?: string; spaceType?: string };
  if (space.spaceType !== "DIRECT_MESSAGE" || !space.name || !/^spaces\/[a-z0-9_-]+$/i.test(space.name)) {
    throw new Error("Google Chat did not return a direct message");
  }

  const key = createHash("sha256").update(`${email}:${day}`).digest("hex").slice(0, 32);
  const response = await postChat(`${space.name}/messages?messageId=client-crm-${key}`, token, { text });
  if (response.ok) return "sent";
  const body = await response.json().catch(() => null) as { error?: { status?: string } } | null;
  if (response.status === 409 && body?.error?.status === "ALREADY_EXISTS") return "alreadySent";
  throw new Error(`Google Chat message failed (${response.status})`);
}

export async function runCrmChatAlerts(now = new Date()) {
  const day = todayInBrazil(now);
  if ([0, 6].includes(new Date(day).getUTCDay())) return { status: "weekend" };
  const sender = getCrmChatSender();
  if (!sender) return { status: "inactive" };

  const prisma = getPrisma();
  const settings = await prisma.crmChatSettings.findFirst({ where: { sender: { email: sender, active: true }, enabled: true }, include: { sender: true } });
  const recipients = recipientSettings(sender).safeParse(settings?.recipients);
  if (!settings?.credential || !recipients.success || !recipients.data.length || !isAdminUser(settings.sender)) {
    return { status: "inactive" };
  }

  const tasks = await prisma.crmTask.findMany({
    where: { status: "Pendente", dueDate: { lt: new Date(day) } },
    select: { title: true, owner: true, dueDate: true, opportunityId: true, opportunity: {
      select: { owner: true, stage: true, result: true, contractClosed: true, account: { select: { name: true } } },
    } },
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
  });
  const { grouped, unmapped } = groupCrmChatTasks(tasks, recipients.data);
  if (!grouped.size) return { status: "no-tasks", unmapped: unmapped.length };

  const token = await getCrmChatAccessToken(settings.credential);
  if (!token) {
    await prisma.crmChatSettings.updateMany({ where: { senderId: settings.senderId, credential: settings.credential }, data: { credential: null, enabled: false } });
    await writeAppAuditLog({ actor: settings.sender, moduleKey: "humanship.crm", action: "chat.reconnect.required", severity: "attention" });
    return { status: "reconnect" };
  }

  const results = { sent: 0, alreadySent: 0, skipped: 0, failed: 0, unmapped: unmapped.length };
  const users = await listCrmChatRecipients(sender, [...grouped.keys()]);
  results.skipped = grouped.size - users.length;
  for (let index = 0; index < users.length; index += 5) {
    await Promise.all(users.slice(index, index + 5).map(async (user) => {
      try {
        results[await sendCrmChatDigest(user.email, token, day, crmChatDigest(grouped.get(user.email) ?? []))]++;
      } catch (error) {
        results.failed++;
        console.error("[crm-chat] delivery failed", { recipientId: user.id, error: error instanceof Error ? error.message : "unknown" });
      }
    }));
  }
  if (results.sent || results.failed || results.skipped) {
    await writeAppAuditLog({ actor: settings.sender, moduleKey: "humanship.crm", action: "chat.digest", severity: results.failed || results.skipped ? "attention" : "info", metadata: results });
  }
  return { status: "processed", ...results };
}
