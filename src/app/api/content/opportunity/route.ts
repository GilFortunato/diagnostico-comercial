import { NextResponse } from "next/server";
import { contentOpportunitySchema, createContentOpportunity } from "@/lib/content/intelligence";

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = contentOpportunitySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Informe BU e objetivo editorial para gerar oportunidade." }, { status: 400 });
  }

  return NextResponse.json(createContentOpportunity(parsed.data));
}
