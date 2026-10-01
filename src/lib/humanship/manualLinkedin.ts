import { z } from "zod";
import { classifyHumanshipParticipant } from "./restrictions";

export function normalizeManualLinkedinUrl(value: string): string | null {
  const text = value.trim();
  if (!text || text.length > 2048) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.port) return null;
    if (!/^(?:www\.|[a-z]{2}\.)?linkedin\.com$/i.test(url.hostname)) return null;
    if (!/^\/in\/[\p{L}\p{N}_%\-]+\/?$/u.test(url.pathname)) return null;
    return `https://www.linkedin.com${url.pathname.replace(/\/$/, "")}`;
  } catch { return null; }
}

export const manualLinkedinSchema = z.object({
  action: z.literal("linkedin"),
  linkedinUrl: z.string().transform((value, ctx) => {
    const normalized = normalizeManualLinkedinUrl(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Informe um link de perfil válido: linkedin.com/in/nome." });
      return z.NEVER;
    }
    return normalized;
  }),
});

export function classifyManualLinkedin(input: Omit<Parameters<typeof classifyHumanshipParticipant>[0], "linkedinFound">) {
  const result = classifyHumanshipParticipant({ ...input, linkedinFound: true });
  return {
    ...result,
    classification: result.classification === "eligible" ? "validate" as const : result.classification,
    reason: `LinkedIn informado manualmente; valide o perfil antes da decisão final. ${result.reason}`,
  };
}

export function shouldSearchHumanshipParticipant(status: string, rescan = false) {
  return status !== "manual" && (rescan || !["found", "probable"].includes(status));
}
