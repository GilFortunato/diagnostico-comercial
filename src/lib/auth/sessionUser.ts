import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim() || null;
  const id = session?.user?.id?.trim() || email;

  if (!id) return null;

  return {
    id,
    email,
    name: session?.user?.name?.trim() || null,
  };
}
