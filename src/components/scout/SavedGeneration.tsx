"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink, LoaderCircle } from "lucide-react";
import { getBrandContext } from "@/lib/scout/mkt/brands";
import type { ScoutGeneration } from "@/lib/scout/mkt/analysisTypes";
import { formatScoutDate, safeScoutUrl, scoutRequest } from "./scoutClient";
import styles from "./MktScout.module.css";

export function SavedGeneration({ id, onClose }: { id: string; onClose: () => void }) {
  const [generation, setGeneration] = useState<ScoutGeneration | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    scoutRequest<ScoutGeneration>(`/api/scout/content?id=${encodeURIComponent(id)}`, controller.signal)
      .then((payload) => { if (!controller.signal.aborted) setGeneration(payload); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Esta geração não está disponível para sua conta."); });
    return () => controller.abort();
  }, [id]);

  async function copy() {
    if (!generation) return;
    try { await navigator.clipboard.writeText(`${generation.title}\n\n${generation.body}\n\nFontes:\n${generation.sourceUrls.join("\n")}`); setCopyStatus("Conteúdo copiado."); }
    catch { setCopyStatus("Selecione o texto para copiar."); }
  }

  return <section className={`${styles.panel} mb-6`} aria-label="Geração salva"><div className={styles.sectionHeading}><h2>Conteúdo salvo</h2><button type="button" onClick={onClose} className={styles.back}>Fechar conteúdo salvo</button></div>{error ? <p role="alert" className={styles.notice}>{error}</p> : !generation ? <p className={styles.meta} role="status"><LoaderCircle size={14} className="animate-spin" aria-hidden="true" />Recuperando conteúdo…</p> : <><p className={styles.eyebrow}>{getBrandContext(generation.brandId).name} · {generation.mode === "ai" ? "Rascunho gerado com IA" : "Rascunho editorial"}</p><h3 className="my-4 text-xl font-semibold">{generation.title}</h3><div className={styles.copy}>{generation.body}</div>{generation.notice ? <p className={styles.notice}>{generation.notice}</p> : null}<div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => void copy()}><Copy size={13} aria-hidden="true" />Copiar conteúdo</button><span className={styles.meta} role="status">{copyStatus}</span></div><p className={styles.contentMeta}>Gerado em {formatScoutDate(generation.createdAt)} · ID: {generation.id}<br />O conteúdo preserva as evidências da geração original; o radar atual pode ter mudado.</p><details className={styles.score}><summary>Fontes originais</summary><ul className={styles.list}>{generation.sourceUrls.map((url) => safeScoutUrl(url) ? <li key={url}><a className={styles.sourceLink} href={safeScoutUrl(url)} target="_blank" rel="noopener noreferrer">{new URL(url).hostname}<ExternalLink size={11} aria-hidden="true" /></a></li> : null)}</ul></details></>}</section>;
}
