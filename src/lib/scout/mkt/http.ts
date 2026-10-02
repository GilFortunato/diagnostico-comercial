import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { brandIdSchema } from "./types";
import { ScoutError } from "./service";

export const selectionSchema = z.object({
  trendId: z.string().min(1).max(100), brandId: brandIdSchema,
  query: z.string().trim().max(120).optional(),
}).strict();
export const contentRequestSchema = selectionSchema.extend({ opportunityId: z.string().min(1).max(80) });
export const radarRequestSchema = z.object({
  brand: brandIdSchema.default("share"), q: z.string().trim().max(120).default(""),
}).refine((data) => data.q.length === 0 || data.q.length >= 2, "Informe ao menos 2 caracteres para pesquisar.");

export async function authorizeScout() { return authorizeModule("creative.trend-intelligence"); }
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}
export async function readBody(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new ScoutError("Origem da solicitação inválida.", 403);
  if (Number(request.headers.get("content-length") ?? 0) > 4096) throw new ScoutError("Solicitação muito grande.", 413);
  const body = await request.text();
  if (body.length > 4096) throw new ScoutError("Solicitação muito grande.", 413);
  try { return JSON.parse(body) as unknown; } catch { throw new ScoutError("Envie uma solicitação JSON válida."); }
}
export function handleScoutError(error: unknown) {
  if (error instanceof z.ZodError) return json({ error: "Revise a marca, o tema e a oportunidade selecionados." }, 400);
  if (error instanceof ScoutError) return json({ error: error.message }, error.status);
  return json({ error: "Não foi possível concluir agora. Tente novamente em instantes." }, 503);
}
