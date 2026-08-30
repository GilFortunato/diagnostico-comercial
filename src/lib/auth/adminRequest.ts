import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { adminAccessStatus } from "@/lib/auth/admin";

export async function hasAdminSession() {
  const session = await getServerSession(authOptions);
  return adminAccessStatus(session?.user?.email) === 200;
}
