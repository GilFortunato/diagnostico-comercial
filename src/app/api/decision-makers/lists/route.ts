import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { createB2BLeadList, listB2BWorkspace } from "@/lib/decision-makers/workspace";

const schema = z.object({ name: z.string().trim().min(2).max(120) });

export async function GET() {
  const access = await authorizeModule("decision.makers");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const workspace = await listB2BWorkspace(access.user.id);
  return NextResponse.json({ lists: workspace.lists });
}

export async function POST(request: Request) {
  const access = await authorizeModule("decision.makers");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Informe um nome para a lista." }, { status: 400 });

  const list = await createB2BLeadList({ actor: access.user, name: parsed.data.name });
  return NextResponse.json({ list }, { status: 201 });
}
