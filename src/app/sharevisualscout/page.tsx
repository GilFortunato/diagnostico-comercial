import { redirect } from "next/navigation";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// The visual search implementation remains available internally to MKT Scout.
export default async function ShareVisualScoutPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  redirect(query ? `/sharetrendintelligence?q=${encodeURIComponent(query)}` : "/sharetrendintelligence");
}
