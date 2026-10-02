import type { SessionUser } from "@/lib/auth/sessionUser";

const DEFAULT_DELETE_MANAGER_NAMES = new Set(["gil fortunato", "vitor morgato"]);

function normalize(value?: string | null) {
  return (value || "").trim().toLocaleLowerCase("pt-BR");
}

function configuredDeleteEmails() {
  return new Set(
    (process.env.HUMANSHIP_EVENT_DELETE_EMAILS || "")
      .split(",")
      .map((value) => normalize(value))
      .filter(Boolean),
  );
}

export function canDeleteHumanshipEvents(user?: Pick<SessionUser, "name" | "email"> | null) {
  if (!user) return false;
  const email = normalize(user.email);
  if (email && configuredDeleteEmails().has(email)) return true;
  return DEFAULT_DELETE_MANAGER_NAMES.has(normalize(user.name));
}
