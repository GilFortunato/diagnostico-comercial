import { NextResponse } from "next/server";
import { contentOpportunitySchema } from "@/lib/content/intelligence";
import { createContentOpportunityWithProvider } from "@/lib/ai/contentOpportunityProvider";
import { PlatformResourceUnavailableError } from "@/lib/connectors/errors";

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = contentOpportunitySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Informe BU e objetivo editorial para gerar oportunidade." }, { status: 400 });
  }

  try {
    return NextResponse.json(await createContentOpportunityWithProvider(parsed.data));
  } catch (error) {
    if (error instanceof PlatformResourceUnavailableError) {
      return NextResponse.json({ error: error.publicMessage }, { status: 503 });
    }
    return NextResponse.json({ error: "Não foi possível criar o conteúdo neste momento." }, { status: 500 });
  }
}
