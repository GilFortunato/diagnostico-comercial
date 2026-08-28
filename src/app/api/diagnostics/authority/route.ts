import { NextResponse } from "next/server";
import { createAuthorityAssessment, authorityInputSchema } from "@/lib/diagnostics/authority";
import { saveAuthorityAssessment } from "@/lib/repositories/authorityRepository";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = authorityInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid authority assessment input.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const assessment = createAuthorityAssessment(parsed.data);
  await saveAuthorityAssessment(assessment);
  return NextResponse.json(assessment);
}
