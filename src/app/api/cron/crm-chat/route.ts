import { timingSafeEqual } from "node:crypto";
import { runCrmChatAlerts } from "@/lib/crm/googleChat";

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return Response.json({ error: "Acesso restrito." }, { status: 401 });
  }
  try {
    const result = await runCrmChatAlerts();
    return Response.json(result, { status: "failed" in result && result.failed ? 502 : 200 });
  } catch (error) {
    console.error("[crm-chat] scheduled run failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "Não foi possível processar os alertas." }, { status: 503 });
  }
}
