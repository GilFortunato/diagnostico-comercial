import "server-only";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { getUserModuleAccess, type PlatformModule } from "@/lib/auth/modulePermissions";

export async function authorizeModule(moduleKey: PlatformModule) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, status: 401 as const, error: "Entre com sua conta Google para continuar." };
  const allowed = await getUserModuleAccess(user, moduleKey).catch(() => false);
  if (!allowed) return { ok: false as const, status: 403 as const, error: "Este módulo não está liberado para sua conta." };
  return { ok: true as const, user };
}
