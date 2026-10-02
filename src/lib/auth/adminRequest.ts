import "server-only";
import { isAdminUser } from "@/lib/auth/admin";
import { getSessionUser } from "@/lib/auth/sessionUser";

export async function hasAdminSession() {
  const user = await getSessionUser();
  return Boolean(user?.active && isAdminUser(user));
}
