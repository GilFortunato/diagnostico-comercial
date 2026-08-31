import "server-only";
import { isAdminEmail } from "@/lib/auth/admin";
import type { SessionUser } from "@/lib/auth/sessionUser";
import { getPrisma } from "@/lib/db/prisma";
import { platformModules, resolveUserModuleAccess, type PlatformModule } from "@/lib/auth/moduleAccessPolicy";

export { platformModules, resolveModuleAccess, resolveUserModuleAccess, type PlatformModule } from "@/lib/auth/moduleAccessPolicy";

export async function getUserModuleAccess(user: SessionUser, moduleKey: PlatformModule) {
  const admin = isAdminEmail(user.email);
  if (!user.active || admin) return resolveUserModuleAccess(moduleKey, { active: user.active, admin });
  const permission = await getPrisma().userModulePermission.findUnique({
    where: { userId_moduleKey: { userId: user.id, moduleKey } },
    select: { enabled: true },
  });
  return resolveUserModuleAccess(moduleKey, { active: user.active, admin, explicitValue: permission?.enabled });
}

export async function listUserModuleAccess(user: SessionUser) {
  const rows = await getPrisma().userModulePermission.findMany({
    where: { userId: user.id },
    select: { moduleKey: true, enabled: true },
  });
  const explicit = new Map(rows.map((row) => [row.moduleKey, row.enabled]));
  return Object.fromEntries(platformModules.map((moduleKey) => [
    moduleKey,
    resolveUserModuleAccess(moduleKey, { active: user.active, admin: isAdminEmail(user.email), explicitValue: explicit.get(moduleKey) }),
  ])) as Record<PlatformModule, boolean>;
}

export async function setUserModuleAccess(userId: string, moduleKey: PlatformModule, enabled: boolean) {
  return getPrisma().userModulePermission.upsert({
    where: { userId_moduleKey: { userId, moduleKey } },
    create: { userId, moduleKey, enabled },
    update: { enabled },
  });
}
