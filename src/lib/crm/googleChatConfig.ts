import { z } from "zod";
import { normalize } from "./model";

export const crmChatPath = "/diagnostico/crm/alertas";
export const chatScopes = [
  "https://www.googleapis.com/auth/chat.spaces.create",
  "https://www.googleapis.com/auth/chat.messages.create",
];

export function getCrmChatSender() {
  const email = z.email().safeParse(process.env.CRM_CHAT_SENDER_EMAIL?.trim().toLowerCase());
  return email.success ? email.data : null;
}

export function isCrmChatSender(email: string | null | undefined) {
  const sender = getCrmChatSender();
  return Boolean(sender && email?.trim().toLowerCase() === sender);
}

const recipient = z.object({
  email: z.email().max(254).transform((email) => email.toLowerCase()),
  aliases: z.array(z.string().trim().min(1).max(120).refine((alias) => !alias.includes("/"))).min(1).max(20),
});

export const crmChatDomain = (sender: string) => sender.slice(sender.lastIndexOf("@"));

export function recipientSettings(sender: string) {
  const domain = crmChatDomain(sender);
  return z.array(recipient).max(50).superRefine((recipients, context) => {
    const emails = recipients.map(({ email }) => email);
    const aliases = recipients.flatMap(({ aliases }) => aliases.map(normalize));
    if (emails.some((email) => !email.endsWith(domain) || email === sender)) {
      context.addIssue({ code: "custom", message: "Use o e-mail corporativo do responsável." });
    }
    if (new Set(emails).size !== emails.length || new Set(aliases).size !== aliases.length || aliases.includes("")) {
      context.addIssue({ code: "custom", message: "Cada e-mail e nome de responsável deve aparecer uma única vez." });
    }
  });
}

export type ChatRecipient = z.infer<typeof recipient>;
export const splitOwners = (owner: string | null) => (owner ?? "").split("/").map((name) => name.trim()).filter(Boolean);
