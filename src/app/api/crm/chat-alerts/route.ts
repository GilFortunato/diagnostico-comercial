import { z } from "zod";
import { isAdminUser } from "@/lib/auth/admin";
import { writeAppAuditLog } from "@/lib/audit/appAudit";
import { listCrmChatRecipients } from "@/lib/crm/googleChat";
import { getCrmChatSender, recipientSettings } from "@/lib/crm/googleChatConfig";
import { authorizeCrm, crmError, handleCrmError } from "@/lib/crm/http";
import { getPrisma } from "@/lib/db/prisma";

export async function PUT(request: Request) {
  const access = await authorizeCrm();
  if (!access.ok) return crmError(access.error, access.status);
  const origin = request.headers.get("origin");
  const configuredUrl = process.env.NEXTAUTH_URL;
  const trustedOrigin = origin === new URL(request.url).origin || (configuredUrl && origin === URL.parse(configuredUrl)?.origin);
  const sender = getCrmChatSender();
  if (!sender || access.user.email !== sender || !isAdminUser(access.user) || !trustedOrigin) {
    return crmError("Apenas a conta remetente pode configurar os alertas.", 403);
  }

  const input = z.discriminatedUnion("action", [
    z.object({ action: z.literal("save"), enabled: z.boolean(), recipients: recipientSettings(sender) }),
    z.object({ action: z.literal("disconnect") }),
  ]).safeParse(await request.json().catch(() => null));
  if (!input.success) return crmError("Confira os e-mails e os nomes. Use e-mails corporativos e vincule cada nome uma única vez.", 400);
  const senderId = access.user.id;
  try {
    const settings = getPrisma().crmChatSettings;
    if (input.data.action === "disconnect") {
      await settings.updateMany({ where: { senderId }, data: { credential: null, enabled: false } });
      await writeAppAuditLog({ actor: access.user, moduleKey: "humanship.crm", action: "chat.disconnected" });
      return Response.json({ connected: false, enabled: false });
    }

    const { enabled, recipients } = input.data;
    if (enabled) {
      if (!process.env.CRON_SECRET) return crmError("O agendamento ainda precisa ser configurado no servidor.", 409);
      if (!recipients.length) return crmError("Vincule pelo menos um responsável antes de ativar os alertas.", 400);
      const allowed = await listCrmChatRecipients(sender, recipients.map(({ email }) => email));
      if (allowed.length !== recipients.length) return crmError("Selecione contas corporativas ativas com acesso ao CRM.", 400);
      const saved = await settings.updateMany({ where: { senderId, credential: { not: null } }, data: { enabled, recipients } });
      if (!saved.count) return crmError("Conecte sua conta ao Google Chat antes de ativar os alertas.", 409);
    } else {
      await settings.upsert({ where: { senderId }, create: { senderId, enabled, recipients }, update: { enabled, recipients } });
    }
    await writeAppAuditLog({ actor: access.user, moduleKey: "humanship.crm", action: "chat.settings.saved", metadata: { enabled, recipients: recipients.length } });
    return Response.json({ enabled });
  } catch (error) {
    return handleCrmError(error);
  }
}
