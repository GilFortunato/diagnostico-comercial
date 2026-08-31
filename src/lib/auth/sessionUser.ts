import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { findActiveUserByIdentity } from "@/lib/auth/userRepository";

export type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  active: boolean;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim() || null;
  const sessionId = session?.user?.id?.trim() || null;
  if (!sessionId && !email) return null;
  const user = await findActiveUserByIdentity(sessionId, email).catch(() => null);
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name, active: user.active };
}
