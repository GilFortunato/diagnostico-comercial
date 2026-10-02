import { NextResponse } from "next/server";
import { z } from "zod";
import { hasAdminSession } from "@/lib/auth/adminRequest";
import { isAdminEmail } from "@/lib/auth/admin";
import { platformModules, setUserModuleAccess } from "@/lib/auth/modulePermissions";
import { getPrisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { writeAppAuditLog } from "@/lib/audit/appAudit";

const updateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("account"), userId: z.string().min(1), active: z.boolean() }),
  z.object({ action: z.literal("admin"), userId: z.string().min(1), enabled: z.boolean() }),
  z.object({ action: z.literal("permission"), userId: z.string().min(1), moduleKey: z.enum(platformModules), enabled: z.boolean() }),
]);

export async function GET() {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  const users = await getPrisma().user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      isAdmin: true,
      createdAt: true,
      lastLoginAt: true,
      modulePermissions: { select: { moduleKey: true, enabled: true } },
    },
  });
  return NextResponse.json({
    users: users.map((user) => ({
      ...user,
      bootstrapAdmin: isAdminEmail(user.email),
    })),
    modules: platformModules.filter((moduleKey) => moduleKey !== "creative.visual-scout"),
  });
}

export async function PATCH(request: Request) {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  const actor = await getSessionUser();
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Alteração de usuário inválida." }, { status: 400 });

  const target = await getPrisma().user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, name: true, email: true, isAdmin: true },
  });
  if (!target) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  if (parsed.data.action === "admin") {
    if (isAdminEmail(target.email) && !parsed.data.enabled) {
      return NextResponse.json({ error: "Este administrador é fixo pelo ambiente e não pode ser removido aqui." }, { status: 400 });
    }
    if (actor?.id === target.id && !parsed.data.enabled) {
      return NextResponse.json({ error: "Você não pode remover o próprio acesso ADM." }, { status: 400 });
    }
    await getPrisma().user.update({ where: { id: target.id }, data: { isAdmin: parsed.data.enabled } });
    await writeAppAuditLog({
      actor,
      moduleKey: "admin",
      action: parsed.data.enabled ? "user.admin.enabled" : "user.admin.disabled",
      entityType: "user",
      entityId: target.id,
      severity: "security",
      retentionDays: 30,
      metadata: { targetEmail: target.email, targetName: target.name },
    });
  } else if (parsed.data.action === "account") {
    await getPrisma().user.update({ where: { id: parsed.data.userId }, data: { active: parsed.data.active } });
    await writeAppAuditLog({
      actor,
      moduleKey: "admin",
      action: parsed.data.active ? "user.account.enabled" : "user.account.disabled",
      entityType: "user",
      entityId: target.id,
      severity: "security",
      retentionDays: 30,
      metadata: { targetEmail: target.email, targetName: target.name },
    });
  } else {
    await setUserModuleAccess(parsed.data.userId, parsed.data.moduleKey, parsed.data.enabled);
    await writeAppAuditLog({
      actor,
      moduleKey: "admin",
      action: parsed.data.enabled ? "user.module.enabled" : "user.module.disabled",
      entityType: "user",
      entityId: target.id,
      severity: "security",
      retentionDays: 30,
      metadata: { targetEmail: target.email, targetName: target.name, moduleKey: parsed.data.moduleKey },
    });
  }
  return NextResponse.json({ updated: true });
}
