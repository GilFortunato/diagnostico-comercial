import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { addB2BLeadToList, getB2BLeadList } from "@/lib/decision-makers/workspace";

const schema = z.object({ leadId: z.string().min(1) });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("decision.makers");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const list = await getB2BLeadList((await params).id);
  return list ? NextResponse.json({ list }) : NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeModule("decision.makers");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Lead inválido." }, { status: 400 });

  const item = await addB2BLeadToList({
    actor: access.user,
    listId: (await params).id,
    leadId: parsed.data.leadId,
  });
  return item ? NextResponse.json({ item }) : NextResponse.json({ error: "Lista ou lead não encontrado." }, { status: 404 });
}
