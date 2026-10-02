import { NextResponse } from "next/server";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { listGlobalCandidateProfiles } from "@/lib/hr-hunting/candidateMemory";

export async function GET() {
  const access = await authorizeModule("hr.hunting");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  return NextResponse.json({ candidates: await listGlobalCandidateProfiles() });
}
