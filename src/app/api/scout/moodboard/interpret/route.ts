import { NextResponse } from "next/server";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { moodboardInputSchema, interpretMoodboardBrief } from "@/lib/scout/moodboard";

export const maxDuration = 60;

export async function POST(request: Request) {
  const access = await authorizeModule("creative.trend-intelligence");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const parsed = moodboardInputSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Revise o briefing e os dados do projeto." }, { status: 400 });

  const result = await interpretMoodboardBrief(parsed.data);
  return NextResponse.json(result);
}
