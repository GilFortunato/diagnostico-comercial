"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, ExternalLink, FileArchive, LockKeyhole, Save, UploadCloud } from "lucide-react";

type LinkedInImportSummary = {
  collectedAt: string;
  filesUsed: string[];
  name: string;
  headline: string;
  experiences: number;
  education: number;
  certifications: number;
  skills: number;
  posts: number;
  commentsDetected: boolean;
};

type ProfileResponse = {
  profile?: {
    linkedinUrl: string | null;
    linkedinUpdatedAt: string | null;
    lastAuthorityAnalysisAt: string | null;
    linkedinImport?: LinkedInImportSummary | null;
  } | null;
  summary?: LinkedInImportSummary;
  error?: string;
};

const linkedinDownloadPage = "https://www.linkedin.com/mypreferences/d/download-my-data";
const linkedinDataHelp = "https://www.linkedin.com/help/linkedin/answer/a1339364";
const linkedinAnalyticsHelp = "https://www.linkedin.com/help/linkedin/answer/a705312";

export function ProfileExperience() {
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [lastAnalysis, setLastAnalysis] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<LinkedInImportSummary | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(true);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as ProfileResponse;
      if (!response.ok) setNotice(result.error ?? "Não foi possível carregar seu perfil.");
      setLinkedinUrl(result.profile?.linkedinUrl ?? "");
      setLastAnalysis(result.profile?.lastAuthorityAnalysisAt ?? null);
      setImportSummary(result.profile?.linkedinImport ?? null);
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
    if (response.ok) {
      setImportSummary(result.profile?.linkedinImport ?? importSummary);
      setNotice("Perfil profissional atualizado.");
    } else {
      setNotice(result.error ?? "Não foi possível atualizar o perfil.");
    }
  }

  async function importLinkedInData() {
    if (!selectedFile) {
      setNotice("Escolha o arquivo .zip recebido do LinkedIn antes de importar.");
      return;
    }
    if (!linkedinUrl.trim()) {
      setNotice("Informe e salve primeiro a URL do seu perfil do LinkedIn.");
      return;
    }

    setImporting(true);
    setNotice(null);
    const form = new FormData();
    form.append("file", selectedFile);
    form.append("linkedinUrl", linkedinUrl.trim());

    try {
      const response = await fetch("/api/profile/linkedin-import", { method: "POST", body: form });
      const result = await response.json() as ProfileResponse;
      if (!response.ok) {
        setNotice(result.error ?? "Não foi possível importar o arquivo do LinkedIn.");
        return;
      }
      setImportSummary(result.summary ?? null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setNotice("Dados oficiais do LinkedIn importados. Eles serão usados como camada adicional no diagnóstico avançado.");
    } catch {
      setNotice("Não foi possível importar o arquivo do LinkedIn.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <main className="share-shell min-h-screen px-5 py-10 text-[var(--share-ink)]">
      <section className="mx-auto max-w-4xl rounded-lg border border-[var(--share-line)] bg-white p-6 shadow-[0_18px_60px_rgb(0_63_46_/_0.08)] md:p-8">
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
        {notice ? <p className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#edf7eb] px-3 py-2 text-sm text-[var(--share-green-900)]"><CheckCircle2 className="h-4 w-4 shrink-0" />{notice}</p> : null}

        <div className="mt-9 border-t border-[var(--share-line)] pt-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Diagnóstico avançado</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--share-green-950)]">Importe seus dados oficiais do LinkedIn</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">O arquivo oficial aumenta a cobertura do diagnóstico porque traz dados que podem não estar visíveis no perfil público. Você não precisa informar senha nem autorizar acesso à sua conta.</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--share-line)] bg-[#fbfdf8] p-5">
              <div className="flex items-start gap-3">
                <span className="rounded-lg bg-[#edf7eb] p-2 text-[var(--share-green-900)]"><Download className="h-5 w-5" /></span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Passo 1</p>
                  <h3 className="mt-1 font-semibold text-[var(--share-green-950)]">Solicite o arquivo no LinkedIn</h3>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-600">No LinkedIn, acesse Configurações e privacidade → Privacidade de dados → Como o LinkedIn usa seus dados → Baixar seus dados. Você pode solicitar categorias específicas ou o arquivo maior.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={linkedinDownloadPage} target="_blank" rel="noreferrer" className="share-button-primary inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold"><ExternalLink className="h-4 w-4" />Solicitar arquivo no LinkedIn</a>
                <a href={linkedinDataHelp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-[var(--share-line)] px-4 py-2 text-sm font-semibold text-[var(--share-green-900)]"><ExternalLink className="h-4 w-4" />Ver instruções oficiais</a>
              </div>
              <p className="mt-3 text-xs leading-5 text-zinc-500">Para maior cobertura, inclua Perfil, Cargos/Positions, Formação/Education, Competências/Skills, Certificações e Publicações/Shares quando essas opções estiverem disponíveis.</p>
            </div>

            <div className="rounded-xl border border-[var(--share-line)] bg-white p-5 shadow-[0_8px_30px_rgb(0_63_46_/_0.05)]">
              <div className="flex items-start gap-3">
                <span className="rounded-lg bg-[#edf7eb] p-2 text-[var(--share-green-900)]"><UploadCloud className="h-5 w-5" /></span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--share-green-800)]">Passo 2</p>
                  <h3 className="mt-1 font-semibold text-[var(--share-green-950)]">Importe o arquivo recebido</h3>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-600">Envie o <strong>.zip</strong> que o LinkedIn disponibilizar. Também aceitamos um CSV individual exportado pelo LinkedIn.</p>
              <input ref={fileInputRef} type="file" accept=".zip,.csv,application/zip,text/csv" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} className="mt-4 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-[#edf7eb] file:px-4 file:py-2 file:font-semibold file:text-[var(--share-green-900)] hover:file:bg-[#e4f2e1]" />
              {selectedFile ? <p className="mt-2 inline-flex items-center gap-2 text-xs text-zinc-500"><FileArchive className="h-4 w-4" />{selectedFile.name}</p> : null}
              <button type="button" onClick={importLinkedInData} disabled={importing || !selectedFile} className="share-button-primary mt-4 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"><UploadCloud className="h-4 w-4" />{importing ? "Importando..." : "Importar dados do LinkedIn"}</button>
            </div>
          </div>

          {importSummary ? (
            <div className="mt-5 rounded-xl border border-[#b8d9b2] bg-[#f2f9f0] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--share-green-950)]"><CheckCircle2 className="h-4 w-4" />Dados do LinkedIn importados</p>
                  <p className="mt-1 text-xs text-zinc-500">Importado em {new Date(importSummary.collectedAt).toLocaleString("pt-BR")}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--share-green-800)]">Camada avançada ativa</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 md:grid-cols-6">
                <Metric label="Experiências" value={importSummary.experiences} />
                <Metric label="Formações" value={importSummary.education} />
                <Metric label="Certificações" value={importSummary.certifications} />
                <Metric label="Competências" value={importSummary.skills} />
                <Metric label="Publicações" value={importSummary.posts} />
                <Metric label="Comentários" value={importSummary.commentsDetected ? "detectados" : "—"} />
              </div>
            </div>
          ) : null}

          <p className="mt-5 inline-flex items-start gap-2 rounded-md bg-[#edf7eb] px-3 py-2 text-xs leading-5 text-[var(--share-green-900)]"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />O arquivo bruto não é mantido pela Share AI. A importação extrai somente os campos profissionais usados no diagnóstico. Mensagens e conexões não são usadas nem armazenadas.</p>

          <div className="mt-5 flex items-center gap-3 border-t border-[var(--share-line)] pt-5">
            <a href={linkedinAnalyticsHelp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--share-green-900)]"><ExternalLink className="h-4 w-4" />Entender seus Analytics do LinkedIn</a>
            <span className="text-xs text-zinc-500">Analytics continua sendo uma camada opcional adicional para medir audiência e descoberta reais.</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-md bg-white px-3 py-2"><p className="font-semibold text-[var(--share-green-950)]">{value}</p><p className="mt-0.5 text-zinc-500">{label}</p></div>;
}
