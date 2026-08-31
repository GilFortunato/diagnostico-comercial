"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Save } from "lucide-react";

type ProfileResponse = {
  profile?: { linkedinUrl: string | null; linkedinUpdatedAt: string | null; lastAuthorityAnalysisAt: string | null } | null;
  error?: string;
};

export function ProfileExperience() {
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [lastAnalysis, setLastAnalysis] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as ProfileResponse;
      if (!response.ok) setNotice(result.error ?? "Não foi possível carregar seu perfil.");
      setLinkedinUrl(result.profile?.linkedinUrl ?? "");
      setLastAnalysis(result.profile?.lastAuthorityAnalysisAt ?? null);
      setPending(false);
    }).catch(() => { setNotice("Não foi possível carregar seu perfil."); setPending(false); });
  }, []);

  async function save() {
    setPending(true);
    setNotice(null);
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkedinUrl }),
    });
    const result = await response.json() as ProfileResponse;
    setPending(false);
    setNotice(response.ok ? "Perfil profissional atualizado." : result.error ?? "Não foi possível atualizar o perfil.");
  }

  return (
    <main className="share-shell min-h-screen px-5 py-10 text-[var(--share-ink)]">
      <section className="mx-auto max-w-3xl rounded-lg border border-[var(--share-line)] bg-white p-6 shadow-[0_18px_60px_rgb(0_63_46_/_0.08)] md:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Perfil profissional</p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--share-green-950)]">Seu LinkedIn na Share AI</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">A URL fica salva para os próximos diagnósticos. Alterá-la não modifica os snapshots anteriores.</p>
        <label className="mt-7 grid gap-2">
          <span className="text-sm font-semibold text-zinc-800">URL do perfil no LinkedIn</span>
          <input value={linkedinUrl} onChange={(event) => setLinkedinUrl(event.target.value)} placeholder="https://www.linkedin.com/in/seu-perfil" className="rounded-md border border-[var(--share-line)] bg-[#fbfdf8] px-4 py-3 text-sm outline-none focus:border-[var(--share-green-800)]" />
        </label>
        {lastAnalysis ? <p className="mt-3 text-sm text-zinc-500">Última análise: {new Date(lastAnalysis).toLocaleString("pt-BR")}</p> : null}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={pending} className="share-button-primary inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"><Save className="h-4 w-4" />{pending ? "Salvando..." : "Salvar perfil"}</button>
          {linkedinUrl ? <a href={linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-[var(--share-line)] px-4 py-2 text-sm font-semibold text-[var(--share-green-900)]"><ExternalLink className="h-4 w-4" />Abrir LinkedIn</a> : null}
        </div>
        {notice ? <p className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#edf7eb] px-3 py-2 text-sm text-[var(--share-green-900)]"><CheckCircle2 className="h-4 w-4" />{notice}</p> : null}
      </section>
    </main>
  );
}
