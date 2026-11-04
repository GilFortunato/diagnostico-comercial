import { NextResponse } from "next/server";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { findPublicAffirmativeJobs } from "@/lib/hr-hunting/affirmativeJobs";
import { affirmativeJobSearchSchema } from "@/lib/hr-hunting/types";

export const maxDuration = 60;

export async function GET(request: Request) {
  const access = await authorizeModule("hr.hunting");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const params = new URL(request.url).searchParams;
  const parsed = affirmativeJobSearchSchema.safeParse({
    title: params.get("title") || "",
    location: params.get("location") || "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Informe um cargo para buscar vagas afirmativas." }, { status: 400 });
  }

  try {
    const jobs = await findPublicAffirmativeJobs(parsed.data.title, parsed.data.location);
    return NextResponse.json({ jobs }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "A fonte de vagas públicas está indisponível. Tente novamente em alguns minutos." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
