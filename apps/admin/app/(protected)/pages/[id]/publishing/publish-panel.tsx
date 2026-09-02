"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PageSeo } from "@growth-os/page-engine";
import { assignPageDomain, publishPage, rollbackPage, saveSeoDraft, unpublishPage } from "./actions";

type VersionRow = { id: string; number: number; createdAt: string; publishNote: string | null; author: string | null };
type DomainRow = { id: string; hostname: string; status: string; isPrimary: boolean };

export function PublishPanel({ pageId, initialRevision, initialSeo, versions, currentVersionId, initialDomainId, domains }: { pageId: string; initialRevision: number; initialSeo: PageSeo; versions: VersionRow[]; currentVersionId: string | null; initialDomainId: string | null; domains: DomainRow[] }) {
  const router = useRouter();
  const [revision, setRevision] = useState(initialRevision);
  const [seo, setSeo] = useState(initialSeo);
  const [domainId, setDomainId] = useState(initialDomainId ?? "");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [findings, setFindings] = useState<Array<{ path: string; message: string }>>([]);
  const [pending, startTransition] = useTransition();
  const selectedDomain = domains.find((domain) => domain.id === domainId) ?? null;
  const domainLabel = selectedDomain ? `${selectedDomain.hostname} (${selectedDomain.status})` : "not assigned";

  const run = (job: () => Promise<{ ok: boolean; message?: string; error?: string; revision?: number; findings?: Array<{ path: string; message: string }> }>) => startTransition(async () => {
    setFindings([]); setMessage("Working…");
    const result = await job();
    setMessage(result.ok ? result.message || "Done." : result.error || "Action failed.");
    if (result.findings) setFindings(result.findings);
    if (result.revision) setRevision(result.revision);
    if (result.ok) router.refresh();
  });

  return <div className="publishing-grid">
    <section className="settings-card">
      <div><p className="eyebrow">SEO draft</p><h2>Search & social metadata</h2><p>Publishing snapshots these fields into an immutable page version.</p></div>
      <label>Title <span>{seo.title.length}/70</span><input value={seo.title} onChange={(event) => setSeo({ ...seo, title: event.target.value })} /></label>
      <label>Description <span>{seo.description.length}/180</span><textarea value={seo.description} onChange={(event) => setSeo({ ...seo, description: event.target.value })} /></label>
      <label>Canonical URL<input value={seo.canonicalUrl ?? ""} onChange={(event) => setSeo({ ...seo, canonicalUrl: event.target.value || null })} placeholder="Optional; defaults to resolved page URL" /></label>
      <label>Social asset ID<input value={seo.socialAssetId ?? ""} onChange={(event) => setSeo({ ...seo, socialAssetId: event.target.value || null })} placeholder="Asset UUID" /></label>
      <label>Social title<input value={seo.socialTitle} onChange={(event) => setSeo({ ...seo, socialTitle: event.target.value })} /></label>
      <label>Social description<textarea value={seo.socialDescription} onChange={(event) => setSeo({ ...seo, socialDescription: event.target.value })} /></label>
      <label className="check-label"><input type="checkbox" checked={seo.index} onChange={(event) => setSeo({ ...seo, index: event.target.checked })} /> Allow search indexing after publish</label>
      <button type="button" disabled={pending} onClick={() => run(() => saveSeoDraft({ pageId, expectedRevision: revision, seo }))}>Save SEO draft</button>
    </section>

    <section className="settings-card publish-card">
      <div><p className="eyebrow">Publication</p><h2>{currentVersionId ? "Published" : "Not published"}</h2><p>Public domain: {domainLabel}. Select the hostname this page should resolve on before publishing.</p></div>
      <label>Domain
        <select value={domainId} disabled={pending} onChange={(event) => setDomainId(event.target.value)}>
          <option value="">Not assigned</option>
          {domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.hostname}{domain.isPrimary ? " · primary" : ""} · {domain.status}</option>)}
        </select>
      </label>
      <button type="button" disabled={pending} onClick={() => run(() => assignPageDomain({ pageId, expectedRevision: revision, domainId: domainId || null }))}>Save domain</button>
      {selectedDomain?.status === "pending" ? <p className="publish-hint">This domain is still marked Pending DNS. Publishing will remain blocked until it is verified.</p> : null}
      <label>Publish note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional change summary" /></label>
      <button className="primary-button" type="button" disabled={pending} onClick={() => run(() => publishPage({ pageId, expectedRevision: revision, publishNote: note }))}>Publish immutable version</button>
      {currentVersionId ? <button type="button" disabled={pending} onClick={() => run(() => unpublishPage({ pageId, expectedCurrentVersionId: currentVersionId }))}>Unpublish</button> : null}
      <Link className="preview-link" href={`/preview/pages/${pageId}`} target="_blank" rel="noreferrer">Open secure draft preview ↗</Link>
      {message ? <div className="publish-message">{message}</div> : null}
      {findings.length ? <div className="validation"><strong>Publication blockers</strong>{findings.map((finding, index) => <div key={`${finding.path}-${index}`}><code>{finding.path}</code> {finding.message}</div>)}</div> : null}
    </section>

    <section className="settings-card version-history">
      <div><p className="eyebrow">Version history</p><h2>Immutable releases</h2></div>
      {versions.length === 0 ? <p>No versions yet.</p> : versions.map((version) => <article key={version.id} className={version.id === currentVersionId ? "current-version" : ""}>
        <div><strong>Version {version.number}{version.id === currentVersionId ? " · LIVE" : ""}</strong><span>{new Date(version.createdAt).toLocaleString()} · {version.author || "unknown author"}</span>{version.publishNote ? <p>{version.publishNote}</p> : null}</div>
        {version.id !== currentVersionId ? <button type="button" disabled={pending} onClick={() => run(() => rollbackPage({ pageId, versionId: version.id, expectedCurrentVersionId: currentVersionId }))}>Activate this version</button> : null}
      </article>)}
    </section>
  </div>;
}
