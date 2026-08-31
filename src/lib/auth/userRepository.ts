import "server-only";
import { getPrisma } from "@/lib/db/prisma";

export type PersistedSessionUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  active: boolean;
};

export async function ensureGoogleUser(input: {
  email: string;
  name?: string | null;
  image?: string | null;
  recordLogin?: boolean;
}): Promise<PersistedSessionUser> {
  const email = input.email.trim().toLocaleLowerCase("pt-BR");
  const user = await getPrisma().user.upsert({
    where: { email },
    create: {
      email,
      name: input.name?.trim() || null,
      image: input.image?.trim() || null,
      lastLoginAt: input.recordLogin ? new Date() : null,
    },
    update: {
      name: input.name?.trim() || undefined,
      image: input.image?.trim() || undefined,
      ...(input.recordLogin ? { lastLoginAt: new Date() } : {}),
    },
    select: { id: true, email: true, name: true, image: true, active: true },
  });
  return user;
}

export async function findActiveUserByIdentity(id: string | null, email: string | null) {
  const user = await getPrisma().user.findFirst({
    where: email ? { email: email.toLocaleLowerCase("pt-BR") } : { id: id ?? "" },
    select: { id: true, email: true, name: true, image: true, active: true },
  });
  return user?.active ? user : null;
}
