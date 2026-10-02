import { NextResponse } from "next/server";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { listB2BWorkspace } from "@/lib/decision-makers/workspace";

export async function GET() {
  const access = await authorizeModule("decision.makers");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  return NextResponse.json(await listB2BWorkspace(access.user.id));
}
