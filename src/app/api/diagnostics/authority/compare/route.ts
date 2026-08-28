import { NextResponse } from "next/server";
import { compareAuthorityAssessments } from "@/lib/diagnostics/authority";
import { listAuthorityAssessments } from "@/lib/repositories/authorityRepository";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const businessUnitId = url.searchParams.get("businessUnitId");

  if (!businessUnitId) {
    return NextResponse.json({ error: "businessUnitId is required." }, { status: 400 });
  }

  const items = await listAuthorityAssessments(businessUnitId);
  return NextResponse.json(compareAuthorityAssessments(items));
}
