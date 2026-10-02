"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Clipboard,
  FileSpreadsheet,
  LoaderCircle,
  MessageCircleMore,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Upload,
  UserRoundX,
} from "lucide-react";
import type { WhatsCampaignView, WhatsColumnMapping, WhatsImportRow } from "@/lib/whats-generator/types";

type CampaignSummary = {
  id: string;
  ownerId: string;
  ownerName: string;
  mine: boolean;
  title: string;
  tone: string;
  status: string;
  sourceFileName: string | null;
  totalRecipients: number;
  generatedCount: number;
  sentCount: number;
  updatedAt: string;
};

type ImportPreview = {
  fileName: string;
  headers: string[];
  rows: WhatsImportRow[];
  truncated: boolean;
  suggestedMapping: WhatsColumnMapping;
};

const CHUNK_SIZE = 20;

export function WhatsGeneratorExperience() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [active, setActive] = useState<WhatsCampaignView | null>(null);
  const [newMode, setNewMode] = useState(true);
  const [imported, setImported] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<WhatsColumnMapping>({ name: "", phone: "", job: "" });
  const [title, setTitle] = useState("");
  const [tone, setTone] = useState("Profissional e acolhedor");
  const [baseText, setBaseText] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => { void refreshCampaigns(); }, []);

  const mappedRecipients = useMemo(() => {
    if (!imported || !mapping.name || !mapping.phone || !mapping.job) return [];
    return imported.rows.flatMap((row, index) => {
      const name = row[mapping.name]?.trim();
      const phone = row[mapping.phone]?.trim();
      const job = row[mapping.job]?.trim();
      if (!name || !phone || !job) return [];
      return [{ rowNumber: index + 2, name, phone, job, rawData: row }];
    });
  }, [imported, mapping]);

  const ignoredRows = imported ? imported.rows.length - mappedRecipients.length : 0;

  async function refreshCampaigns() {
    try {
      const response = await fetch("/api/whats-generator/campaigns", { cache: "no-store" });
      const body = await response.json() as { campaigns?: CampaignSummary[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Não foi possível carregar as campanhas.");
      setCampaigns(body.campaigns || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as campanhas.");
    }
  }

  async function handleFile(file: File) {
    setBusy("import");
    setError(null);
    setNotice(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/whats-generator/import", { method: "POST", body: form });
      const body = await response.json() as ImportPreview & { error?: string };
      if (!response.ok) throw new Error(body.error || "Não foi possível ler a planilha.");
      setImported(body);
      setMapping(body.suggestedMapping);
      if (!title.trim()) setTitle(body.fileName.replace(/\.(xlsx|csv)$/i, ""));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível ler a planilha.");
    } finally {
      setBusy(null);
    }
  }

  async function createCampaign() {
    if (!imported || !mappedRecipients.length || !title.trim() || baseText.trim().length < 10) return;
    setBusy("create");
    setError(null);
    try {
      const response = await fetch("/api/whats-generator/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          tone,
          baseText,
          sourceFileName: imported.fileName,
          mapping,
          recipients: mappedRecipients,
        }),
      });
      const body = await response.json() as { campaignId?: string; error?: string };
      if (!response.ok || !body.campaignId) throw new Error(body.error || "Não foi possível criar a campanha.");
      await refreshCampaigns();
      await openCampaign(body.campaignId);
      setNotice("Campanha criada. Agora você pode gerar uma mensagem individual para cada contato.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar a campanha.");
    } finally {
      setBusy(null);
    }
  }

  async function openCampaign(id: string) {
    setBusy("open");
    setError(null);
    try {
      const response = await fetch(`/api/whats-generator/campaigns/${id}`, { cache: "no-store" });
      const body = await response.json() as { campaign?: WhatsCampaignView; error?: string };
      if (!response.ok || !body.campaign) throw new Error(body.error || "Não foi possível abrir a campanha.");
      setActive(body.campaign);
      setDrafts(Object.fromEntries(body.campaign.recipients.map((recipient) => [recipient.id, recipient.message || ""])));
      setNewMode(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível abrir a campanha.");
    } finally {
      setBusy(null);
    }
  }

  async function generateAll() {
    if (!active) return;
    const recipients = active.recipients.filter((recipient) => recipient.status !== "do_not_contact" && recipient.status !== "sent");
    if (!recipients.length) return;
    setBusy("generate-all");
    setGenerationProgress({ done: 0, total: recipients.length });
    setError(null);

    try {
      let latest = active;
      for (let offset = 0; offset < recipients.length; offset += CHUNK_SIZE) {
        const batch = recipients.slice(offset, offset + CHUNK_SIZE);
        const body = await generateBatch(active.id, batch.map((recipient) => recipient.id));
        if (body.campaign) latest = body.campaign;
        setGenerationProgress({ done: Math.min(offset + batch.length, recipients.length), total: recipients.length });
      }
      setActive(latest);
      setDrafts(Object.fromEntries(latest.recipients.map((recipient) => [recipient.id, recipient.message || ""])));
      await refreshCampaigns();
      setNotice("Mensagens individualizadas geradas para a campanha.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A geração foi interrompida.");
    } finally {
      setBusy(null);
      setGenerationProgress(null);
    }
  }

  async function regenerateOne(recipientId: string) {
    if (!active) return;
    setBusy(`generate:${recipientId}`);
    setError(null);
    try {
      const body = await generateBatch(active.id, [recipientId]);
      if (body.campaign) {
        setActive(body.campaign);
        setDrafts(Object.fromEntries(body.campaign.recipients.map((recipient) => [recipient.id, recipient.message || ""])));
      }
      await refreshCampaigns();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível regenerar a mensagem.");
    } finally {
      setBusy(null);
    }
  }

  async function generateBatch(campaignId: string, recipientIds: string[]) {
    const response = await fetch(`/api/whats-generator/campaigns/${campaignId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientIds }),
    });
    const body = await response.json() as { generated?: number; campaign?: WhatsCampaignView | null; error?: string };
    if (!response.ok) throw new Error(body.error || "Não foi possível gerar as mensagens.");
    return body;
  }

  async function patchRecipient(recipientId: string, patch: { message?: string; status?: "pending" | "generated" | "sent" | "do_not_contact" }) {
    if (!active) return;
    setBusy(`patch:${recipientId}`);
    setError(null);
    try {
      const response = await fetch(`/api/whats-generator/campaigns/${active.id}/recipients/${recipientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await response.json() as { updated?: boolean; error?: string };
      if (!response.ok) throw new Error(body.error || "Não foi possível salvar.");
      await openCampaign(active.id);
      await refreshCampaigns();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteCampaign(item: CampaignSummary) {
    if (!item.mine || !window.confirm(`Excluir a campanha "${item.title}"?`)) return;
    setBusy("delete");
    try {
      const response = await fetch(`/api/whats-generator/campaigns/${item.id}`, { method: "DELETE" });
      const body = await response.json() as { deleted?: boolean; error?: string };
      if (!response.ok || !body.deleted) throw new Error(body.error || "Não foi possível excluir.");
      if (active?.id === item.id) {
        setActive(null);
        setNewMode(true);
      }
      await refreshCampaigns();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível excluir.");
    } finally {
      setBusy(null);
    }
  }

  function startNew() {
    setNewMode(true);
    setActive(null);
    setImported(null);
    setMapping({ name: "", phone: "", job: "" });
    setTitle("");
    setTone("Profissional e acolhedor");
    setBaseText("");
    setNotice(null);
    setError(null);
  }

  return (
    <main className="share-shell min-h-screen text-[var(--share-ink)]">
      <div className="mx-auto max-w-[1600px] px-5 py-7">
        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="self-start rounded-2xl bg-[var(--share-green-950)] p-4 text-white lg:sticky lg:top-24">
            <p className="px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--share-lime)]">Gerador Whats</p>
            <button type="button" onClick={startNew} className={`mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-3 text-sm font-bold ${newMode ? "bg-[var(--share-lime)] text-[var(--share-green-950)]" : "bg-white text-[var(--share-green-950)]"}`}>
              <Plus className="h-4 w-4" /> Nova campanha
            </button>
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Campanhas</p>
              <div className="mt-2 max-h-[62vh] space-y-1 overflow-y-auto">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className={`group rounded-xl ${active?.id === campaign.id ? "bg-white/15" : "hover:bg-white/10"}`}>
                    <div className="flex items-start gap-1">
                      <button type="button" onClick={() => void openCampaign(campaign.id)} className="min-w-0 flex-1 px-3 py-3 text-left">
                        <strong className="block truncate text-xs">{campaign.title}</strong>
                        <span className="mt-1 block text-[10px] text-white/50">{campaign.generatedCount}/{campaign.totalRecipients} geradas · {campaign.sentCount} enviadas</span>
                        <span className="mt-1 block truncate text-[9px] uppercase tracking-wide text-[var(--share-lime)]/70">{campaign.ownerName}</span>
                      </button>
                      {campaign.mine ? <button type="button" onClick={() => void deleteCampaign(campaign)} className="mt-2 mr-2 rounded-lg p-2 text-white/35 opacity-0 hover:bg-white/10 hover:text-red-200 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button> : null}
                    </div>
                  </div>
                ))}
                {!campaigns.length ? <p className="px-2 py-5 text-xs leading-5 text-white/45">Nenhuma campanha criada ainda.</p> : null}
              </div>
            </div>
          </aside>

          <div className="min-w-0 space-y-5">
            <section className="rounded-2xl bg-[var(--share-green-950)] p-6 text-white">
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/10 text-[var(--share-lime)]"><MessageCircleMore className="h-6 w-6" /></span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--share-lime)]">Comunicação individualizada</p>
                  <h1 className="mt-1 text-3xl font-semibold">Mensagens para WhatsApp em escala, uma pessoa por vez.</h1>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-white/70">Suba a base, defina o texto-base e o Gemini cria uma redação individual para cada contato preservando os fatos da campanha.</p>
                </div>
              </div>
            </section>

            {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
            {notice ? <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</p> : null}

            {newMode ? (
              <NewCampaign
                title={title}
                setTitle={setTitle}
                tone={tone}
                setTone={setTone}
                baseText={baseText}
                setBaseText={setBaseText}
                imported={imported}
                mapping={mapping}
                setMapping={setMapping}
                validCount={mappedRecipients.length}
                ignoredRows={ignoredRows}
                busy={busy}
                onFile={handleFile}
                onCreate={createCampaign}
              />
            ) : active ? (
              <CampaignWorkspace
                campaign={active}
                drafts={drafts}
                setDrafts={setDrafts}
                busy={busy}
                generationProgress={generationProgress}
                onGenerateAll={generateAll}
                onRegenerate={regenerateOne}
                onSave={(recipientId) => patchRecipient(recipientId, { message: drafts[recipientId] || "" })}
                onSent={(recipientId) => patchRecipient(recipientId, { status: "sent" })}
                onDoNotContact={(recipientId) => patchRecipient(recipientId, { status: "do_not_contact" })}
              />
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

function NewCampaign(props: {
  title: string; setTitle: (value: string) => void;
  tone: string; setTone: (value: string) => void;
  baseText: string; setBaseText: (value: string) => void;
  imported: ImportPreview | null;
  mapping: WhatsColumnMapping; setMapping: (value: WhatsColumnMapping) => void;
  validCount: number; ignoredRows: number; busy: string | null;
  onFile: (file: File) => void; onCreate: () => void;
}) {
  const { title, setTitle, tone, setTone, baseText, setBaseText, imported, mapping, setMapping, validCount, ignoredRows, busy, onFile, onCreate } = props;
  const ready = Boolean(imported && mapping.name && mapping.phone && mapping.job && validCount && title.trim() && baseText.trim().length >= 10);

  return <section className="rounded-2xl border border-[var(--share-line)] bg-white p-6">
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--share-green-800)]">1. Campanha</p><h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">Defina a comunicação</h2></div>
        <Field label="Nome da campanha" value={title} onChange={setTitle} placeholder="Ex.: Convocação Propagandista Trainee" />
        <Field label="Tom" value={tone} onChange={setTone} placeholder="Profissional e acolhedor" />
        <label className="grid gap-1 text-xs font-semibold text-zinc-600">Texto-base
          <textarea value={baseText} onChange={(event) => setBaseText(event.target.value)} rows={11} placeholder={"Olá, {nome}! Tudo bem? Estou entrando em contato sobre a oportunidade de {vaga}..."} className="rounded-xl border border-[var(--share-line)] p-4 text-sm font-normal leading-6" />
        </label>
        <p className="text-xs leading-5 text-zinc-500">Links, datas, horários e informações obrigatórias do texto-base são preservados. O Gemini individualiza a redação sem criar fatos sobre o contato.</p>
      </div>

      <div className="space-y-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--share-green-800)]">2. Base de contatos</p><h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">Importe e mapeie a planilha</h2></div>
        <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--share-line)] bg-[#fbfdf8] p-6 text-center hover:border-[var(--share-green-700)]">
          {busy === "import" ? <LoaderCircle className="h-7 w-7 animate-spin text-[var(--share-green-800)]" /> : <Upload className="h-7 w-7 text-[var(--share-green-800)]" />}
          <strong className="mt-2 text-sm">{imported ? imported.fileName : "Selecionar .xlsx ou .csv"}</strong>
          <span className="mt-1 text-xs text-zinc-500">Primeira linha deve conter os nomes das colunas · até 1.500 contatos</span>
          <input type="file" accept=".xlsx,.csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); }} />
        </label>

        {imported ? <>
          <div className="grid gap-3 sm:grid-cols-3">
            <ColumnSelect label="Nome" headers={imported.headers} value={mapping.name} onChange={(value) => setMapping({ ...mapping, name: value })} />
            <ColumnSelect label="Telefone" headers={imported.headers} value={mapping.phone} onChange={(value) => setMapping({ ...mapping, phone: value })} />
            <ColumnSelect label="Vaga" headers={imported.headers} value={mapping.job} onChange={(value) => setMapping({ ...mapping, job: value })} />
          </div>
          <div className="rounded-xl bg-[#f4f8ef] p-4 text-sm">
            <strong>{validCount} contato(s) prontos</strong>
            {ignoredRows ? <span className="ml-2 text-amber-700">· {ignoredRows} linha(s) sem Nome, Telefone ou Vaga serão ignoradas</span> : null}
            {imported.truncated ? <p className="mt-1 text-xs text-amber-700">A prévia foi limitada a 1.500 linhas nesta versão.</p> : null}
          </div>
          <PreviewTable imported={imported} mapping={mapping} />
        </> : null}
      </div>
    </div>

    <div className="mt-6 flex justify-end border-t border-[var(--share-line)] pt-5">
      <button type="button" disabled={!ready || busy === "create"} onClick={onCreate} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--share-green-950)] px-5 text-sm font-bold text-white disabled:opacity-40">
        {busy === "create" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
        Criar campanha com {validCount || 0} contatos
      </button>
    </div>
  </section>;
}

function CampaignWorkspace(props: {
  campaign: WhatsCampaignView;
  drafts: Record<string, string>;
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  busy: string | null;
  generationProgress: { done: number; total: number } | null;
  onGenerateAll: () => void;
  onRegenerate: (id: string) => void;
  onSave: (id: string) => void;
  onSent: (id: string) => void;
  onDoNotContact: (id: string) => void;
}) {
  const { campaign, drafts, setDrafts, busy, generationProgress, onGenerateAll, onRegenerate, onSave, onSent, onDoNotContact } = props;

  return <section className="rounded-2xl border border-[var(--share-line)] bg-white">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--share-line)] p-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--share-green-800)]">Campanha de {campaign.ownerName}</p>
        <h2 className="mt-1 text-2xl font-semibold text-[var(--share-green-950)]">{campaign.title}</h2>
        <p className="mt-2 text-sm text-zinc-500">{campaign.totalRecipients} contatos · {campaign.generatedCount} mensagens geradas · {campaign.sentCount} enviadas</p>
      </div>
      <button type="button" onClick={onGenerateAll} disabled={busy === "generate-all"} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--share-green-950)] px-5 text-sm font-bold text-white disabled:opacity-50">
        {busy === "generate-all" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MessageCircleMore className="h-4 w-4" />}
        {campaign.generatedCount ? "Gerar mensagens pendentes" : "Gerar mensagens"}
      </button>
    </div>

    {generationProgress ? <div className="border-b border-[var(--share-line)] bg-[#fbfdf8] px-6 py-4"><div className="flex justify-between text-xs font-semibold text-zinc-600"><span>Gerando mensagens individualizadas...</span><span>{generationProgress.done}/{generationProgress.total}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200"><div className="h-full rounded-full bg-[var(--share-green-700)] transition-all" style={{ width: `${Math.round((generationProgress.done / Math.max(1, generationProgress.total)) * 100)}%` }} /></div></div> : null}

    <div className="divide-y divide-[var(--share-line)]">
      {campaign.recipients.map((recipient) => {
        const draft = drafts[recipient.id] ?? recipient.message ?? "";
        const patchBusy = busy === `patch:${recipient.id}`;
        const regenerateBusy = busy === `generate:${recipient.id}`;
        return <article key={recipient.id} className={`grid gap-4 p-5 xl:grid-cols-[220px_minmax(0,1fr)_190px] ${recipient.status === "do_not_contact" ? "bg-zinc-50 opacity-65" : ""}`}>
          <div>
            <div className="flex items-center gap-2"><strong className="text-[var(--share-green-950)]">{recipient.name}</strong><StatusBadge status={recipient.status} /></div>
            <p className="mt-1 text-sm text-zinc-600">{recipient.job}</p>
            <p className="mt-1 text-xs text-zinc-400">{formatPhone(recipient.phone)}</p>
          </div>
          <div>
            <textarea value={draft} disabled={recipient.status === "do_not_contact"} onChange={(event) => setDrafts((current) => ({ ...current, [recipient.id]: event.target.value }))} rows={5} placeholder="A mensagem individual aparecerá aqui após a geração." className="w-full rounded-xl border border-[var(--share-line)] p-3 text-sm leading-6 disabled:bg-zinc-100" />
            <div className="mt-2 flex flex-wrap gap-2">
              <SmallButton icon={RefreshCw} label={regenerateBusy ? "Gerando..." : "Regenerar"} disabled={Boolean(busy) || recipient.status === "do_not_contact" || recipient.status === "sent"} onClick={() => onRegenerate(recipient.id)} />
              <SmallButton icon={Check} label={patchBusy ? "Salvando..." : "Salvar edição"} disabled={patchBusy || !draft.trim() || recipient.status === "do_not_contact" || recipient.status === "sent"} onClick={() => onSave(recipient.id)} />
              <SmallButton icon={Clipboard} label="Copiar" disabled={!draft.trim()} onClick={() => void navigator.clipboard.writeText(draft)} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button type="button" disabled={!draft.trim() || recipient.status === "do_not_contact" || recipient.status === "sent"} onClick={() => openWhatsApp(recipient.phone, draft)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 text-xs font-bold text-white disabled:opacity-40"><Send className="h-4 w-4" /> Abrir WhatsApp</button>
            <button type="button" disabled={patchBusy || recipient.status === "do_not_contact" || recipient.status === "sent"} onClick={() => onSent(recipient.id)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--share-line)] px-3 text-xs font-bold text-[var(--share-green-900)] disabled:opacity-40"><CheckCircle2 className="h-4 w-4" /> Marcar enviado</button>
            <button type="button" disabled={patchBusy || recipient.status === "do_not_contact"} onClick={() => onDoNotContact(recipient.id)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 disabled:opacity-40"><UserRoundX className="h-4 w-4" /> Não contatar</button>
          </div>
        </article>;
      })}
    </div>
  </section>;
}

function PreviewTable({ imported, mapping }: { imported: ImportPreview; mapping: WhatsColumnMapping }) {
  const preview = imported.rows.slice(0, 5);
  return <div className="overflow-hidden rounded-xl border border-[var(--share-line)]"><table className="w-full text-left text-xs"><thead className="bg-[#f4f8ef] text-[var(--share-green-900)]"><tr><th className="p-2">Nome</th><th className="p-2">Telefone</th><th className="p-2">Vaga</th></tr></thead><tbody>{preview.map((row, index) => <tr key={index} className="border-t border-[var(--share-line)]"><td className="p-2">{mapping.name ? row[mapping.name] : "—"}</td><td className="p-2">{mapping.phone ? row[mapping.phone] : "—"}</td><td className="p-2">{mapping.job ? row[mapping.job] : "—"}</td></tr>)}</tbody></table></div>;
}

function ColumnSelect({ label, headers, value, onChange }: { label: string; headers: string[]; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-1 text-xs font-semibold text-zinc-600">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-xl border border-[var(--share-line)] bg-white px-3 text-sm font-normal"><option value="">Selecionar coluna</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="grid gap-1 text-xs font-semibold text-zinc-600">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 rounded-xl border border-[var(--share-line)] px-3 text-sm font-normal" /></label>;
}

function SmallButton({ icon: Icon, label, disabled, onClick }: { icon: typeof RefreshCw; label: string; disabled?: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="inline-flex items-center gap-1 rounded-lg border border-[var(--share-line)] px-2.5 py-1.5 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"><Icon className="h-3.5 w-3.5" />{label}</button>;
}

function StatusBadge({ status }: { status: string }) {
  const label = status === "sent" ? "Enviado" : status === "generated" ? "Gerado" : status === "do_not_contact" ? "Não contatar" : "Pendente";
  return <span className="rounded-full bg-[#eef6e8] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-[#52712b]">{label}</span>;
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) {
    const local = digits.slice(2);
    return `+${digits.slice(0, 2)} (${local.slice(0, 2)}) ${local.slice(2, -4)}-${local.slice(-4)}`;
  }
  return value;
}

function openWhatsApp(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits || !message.trim()) return;
  window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
}
