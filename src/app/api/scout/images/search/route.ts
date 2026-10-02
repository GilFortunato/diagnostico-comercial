import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { getUserModuleAccess } from "@/lib/auth/modulePermissions";
import { searchVisualScoutImages } from "@/lib/scout/imageSearch";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const allowed = await getUserModuleAccess(user, "creative.trend-intelligence");
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (query.length < 3) {
    return NextResponse.json({ error: "Informe um briefing com pelo menos 3 caracteres." }, { status: 400 });
  }
  if (query.length > 500) {
    return NextResponse.json({ error: "O briefing deve ter no máximo 500 caracteres." }, { status: 400 });
  }

  const result = await searchVisualScoutImages(query);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
