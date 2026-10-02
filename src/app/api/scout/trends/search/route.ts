import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { getUserModuleAccess } from "@/lib/auth/modulePermissions";
import { searchTrendIntelligence } from "@/lib/scout/trendSearch";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const allowed = await getUserModuleAccess(user, "creative.trend-intelligence");
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const days = Number(url.searchParams.get("days") ?? 7);

  if (query.length < 2) {
    return NextResponse.json({ error: "Informe um tema com pelo menos 2 caracteres." }, { status: 400 });
  }
  if (query.length > 120) {
    return NextResponse.json({ error: "O tema deve ter no máximo 120 caracteres." }, { status: 400 });
  }
  if (![1, 7, 30].includes(days)) {
    return NextResponse.json({ error: "Período inválido." }, { status: 400 });
  }

  try {
    const result = await searchTrendIntelligence(query, days);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao consultar tendências." },
      { status: 502 },
    );
  }
}
