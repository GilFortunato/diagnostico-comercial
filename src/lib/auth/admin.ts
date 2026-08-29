export function parseAdminEmails(value = process.env.SHARE_ADMIN_EMAILS ?? process.env.NEXT_PUBLIC_SHARE_ADMIN_EMAILS ?? "") {
  return value
    .split(",")
    .map((email) => email.trim().toLocaleLowerCase("pt-BR"))
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null, value?: string) {
  if (!email) return false;
  return parseAdminEmails(value).includes(email.toLocaleLowerCase("pt-BR"));
}
