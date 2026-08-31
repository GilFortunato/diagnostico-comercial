import "server-only";
import { isAdminEmail } from "@/lib/auth/admin";
import { getSessionUser } from "@/lib/auth/sessionUser";

export async function hasAdminSession() {
  const user = await getSessionUser();
  return Boolean(user?.active && isAdminEmail(user.email));
}
