'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type DocRow = {
  id: string;
  title: string;
  description?: string;
  kind?: 'html' | 'pdf';
  pdfPages?: number;
  createdAt: number;
  gated: boolean;
  viewCount: number;
  lastViewedAt?: number;
  version?: number;
  updatedAt?: number;
};

type View = {
  sessionId: string;
  email?: string;
  name?: string;
  openedAt: number;
  lastSeenAt: number;
  closedAt?: number;
  maxScroll: number;
  duration: number;
  country?: string;
  city?: string;
  sections?: Record<string, number>;
  pagesViewed?: Record<number, number>;
  maxPage?: number;
  docVersion?: number;
};

function fmt(ts?: number) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

function fmtDuration(s: number) {
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const rest = Math.round(s % 60);
  return `${m}m ${rest}s`;
}

export default function Dashboard({ initialDocs }: { initialDocs: DocRow[] }) {
  const router = useRouter();
  const [docs, setDocs] = useState(initialDocs);
  const [showUpload, setShowUpload] = useState(false);
  const [updateFor, setUpdateFor] = useState<string | null>(null);
  const [openAnalyticsFor, setOpenAnalyticsFor] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<View[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  async function openAnalytics(id: string) {
    setOpenAnalyticsFor(id);
    setAnalyticsData(null);
    const res = await fetch(`/api/docs/${id}/analytics`);
    const data = await res.json();
    setAnalyticsData(data.views);
  }

  async function copyLink(id: string) {
    const url = `${baseUrl}/v/${id}`;
    await navigator.clipboard.writeText(url);
  }

  async function deleteDoc(id: string) {
    if (!confirm('Delete this doc and all view data?')) return;
    await fetch(`/api/docs/${id}`, { method: 'DELETE' });
    setDocs((d) => d.filter((x) => x.id !== id));
    if (openAnalyticsFor === id) setOpenAnalyticsFor(null);
  }

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-accent" />
          <h1 className="text-lg font-medium">Scribble Docs</h1>
          <span className="text-xs text-muted">{docs.length} docs</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
            + New doc
          </button>
          <button className="btn text-muted" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {docs.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-border rounded-lg">
            <p className="text-muted text-sm">No docs yet.</p>
            <button className="btn btn-primary mt-4" onClick={() => setShowUpload(true)}>
              Upload your first HTML
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map((d) => {
              const version = d.version ?? 1;
              const showUpdated = d.updatedAt && d.updatedAt !== d.createdAt;
              return (
                <div
                  key={d.id}
                  className="border border-border rounded-lg p-4 hover:border-muted transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">{d.title}</h3>
                        <span className="text-[10px] uppercase tracking-wider text-muted border border-border rounded px-1.5 py-0.5">
                          {d.kind === 'pdf' ? 'PDF' : 'HTML'}
                        </span>
                        {version > 1 && (
                          <span className="text-[10px] uppercase tracking-wider text-muted border border-border rounded px-1.5 py-0.5">
                            v{version}
                          </span>
                        )}
                        {d.gated && (
                          <span className="text-[10px] uppercase tracking-wider text-accent border border-accent/40 rounded px-1.5 py-0.5">
                            Gated
                          </span>
                        )}
                      </div>
                      {d.description && (
                        <p className="text-sm text-muted truncate mb-2">{d.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted">
                        <span>Created {fmt(d.createdAt)}</span>
                        {showUpdated && (
                          <>
                            <span>•</span>
                            <span>Updated {fmt(d.updatedAt)}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>
                          {d.viewCount} {d.viewCount === 1 ? 'view' : 'views'}
                        </span>
                        {d.lastViewedAt && (
                          <>
                            <span>•</span>
                            <span>Last viewed {fmt(d.lastViewedAt)}</span>
                          </>
                        )}
                      </div>
                      <div className="mt-2">
                        <code className="text-xs bg-panel border border-border rounded px-2 py-1 text-muted">
                          {baseUrl}/v/{d.id}
                        </code>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button className="btn text-xs" onClick={() => copyLink(d.id)}>
                        Copy link
                      </button>
                      <button className="btn text-xs" onClick={() => setUpdateFor(d.id)}>
                        Update
                      </button>
                      <a className="btn text-xs" href={`/v/${d.id}`} target="_blank" rel="noreferrer">
                        Preview
                      </a>
                      <button className="btn text-xs" onClick={() => openAnalytics(d.id)}>
                        Analytics
                      </button>
                      <button
                        className="btn text-xs text-red-400 border-red-900/50 hover:border-red-500"
                        onClick={() => deleteDoc(d.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showUpload && (
        <UploadModal
          mode="create"
          onClose={() => setShowUpload(false)}
          onSaved={(doc) => {
            startTransition(() => {
              setDocs((d) => [{ ...doc, viewCount: 0 }, ...d]);
              setShowUpload(false);
            });
          }}
        />
      )}

      {updateFor && (
        <UploadModal
          mode="update"
          docId={updateFor}
          onClose={() => setUpdateFor(null)}
          onSaved={(doc) => {
            startTransition(() => {
              setDocs((d) =>
                d.map((x) =>
                  x.id === doc.id
                    ? { ...x, ...doc, viewCount: x.viewCount, lastViewedAt: x.lastViewedAt }
                    : x,
                ),
              );
              setUpdateFor(null);
              setToast(`Updated to v${doc.version ?? 1}`);
              setTimeout(() => setToast(null), 2500);
            });
          }}
        />
      )}

      {openAnalyticsFor && (
        <AnalyticsDrawer
          docId={openAnalyticsFor}
          views={analyticsData}
          doc={docs.find((d) => d.id === openAnalyticsFor)}
          onClose={() => setOpenAnalyticsFor(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-panel border border-accent/40 text-accent text-sm rounded-md px-4 py-2 shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

function UploadModal({
  mode,
  docId,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'update';
  docId?: string;
  onClose: () => void;
  onSaved: (doc: DocRow) => void;
}) {
  const [kind, setKind] = useState<'html' | 'pdf'>('html');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [html, setHtml] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [gated, setGated] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(mode === 'update');
  const [error, setError] = useState('');

  useEffect(() => {
    if (mode !== 'update' || !docId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/docs/${docId}`);
      if (!res.ok) {
        if (!cancelled) {
          setError('Failed to load doc.');
          setLoading(false);
        }
        return;
      }
      const doc = await res.json();
      if (cancelled) return;
      setTitle(doc.title ?? '');
      setDescription(doc.description ?? '');
      setHtml(doc.html ?? '');
      setKind(doc.kind === 'pdf' ? 'pdf' : 'html');
      setGated(Boolean(doc.gated));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, docId]);

  async function onFile(file: File) {
    if (!file) return;
    const text = await file.text();
    setHtml(text);
    if (!title) setTitle(file.name.replace(/\.html?$/i, ''));
  }

  function onPdfFile(file: File) {
    if (!file) return;
    setPdfFile(file);
    if (!title) setTitle(file.name.replace(/\.pdf$/i, ''));
  }

  async function submit() {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (kind === 'html' && !html.trim()) {
      setError('HTML is required.');
      return;
    }
    if (kind === 'pdf' && !pdfFile && mode === 'create') {
      setError('A PDF file is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    const url = mode === 'create' ? '/api/docs' : `/api/docs/${docId}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';
    const form = new FormData();
    form.set('title', title);
    form.set('description', description);
    form.set('gated', String(gated));
    if (kind === 'pdf') {
      if (pdfFile) form.set('pdf', pdfFile);
    } else {
      form.set('html', html);
    }
    const res = await fetch(url, { method, body: form });
    if (!res.ok) {
      setError(mode === 'create' ? 'Failed to create.' : 'Failed to update.');
      setSubmitting(false);
      return;
    }
    const doc = await res.json();
    onSaved(doc);
  }

  const heading = mode === 'create' ? 'New doc' : 'Update doc';
  const submitLabel = mode === 'create'
    ? (submitting ? 'Creating…' : 'Create & get link')
    : (submitting ? 'Updating…' : 'Save changes');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-panel border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="font-medium">{heading}</h2>
          <button className="text-muted text-sm hover:text-white" onClick={onClose}>
            ✕
          </button>
        </div>
        {loading ? (
          <div className="p-5 text-sm text-muted">Loading current doc…</div>
        ) : (
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="flex gap-1 border border-border rounded-md p-1 w-fit">
            <button
              type="button"
              className={`px-3 py-1.5 text-xs rounded transition ${
                kind === 'html' ? 'bg-accent text-black' : 'text-muted hover:text-white'
              }`}
              onClick={() => setKind('html')}
            >
              HTML
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-xs rounded transition ${
                kind === 'pdf' ? 'bg-accent text-black' : 'text-muted hover:text-white'
              }`}
              onClick={() => setKind('pdf')}
            >
              PDF
            </button>
          </div>
          <div>
            <label className="label">Title</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="RocketX × Scribble proposal"
            />
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Sent to Aksh on May 12"
            />
          </div>
          {kind === 'html' ? (
            <div>
              <label className="label">HTML</label>
              <div className="flex items-center gap-2 mb-2">
                <label className="btn text-xs cursor-pointer">
                  Upload .html file
                  <input
                    type="file"
                    accept=".html,text/html"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                  />
                </label>
                <span className="text-xs text-muted">or paste below</span>
              </div>
              <textarea
                className="input font-mono text-xs h-48"
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                placeholder="<!doctype html>..."
              />
              <p className="text-xs text-muted mt-1">
                {html.length > 0 ? `${(html.length / 1024).toFixed(1)} KB` : 'Empty'}
              </p>
            </div>
          ) : (
            <div>
              <label className="label">PDF</label>
              <label className="btn text-xs cursor-pointer w-fit">
                Choose .pdf file
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && onPdfFile(e.target.files[0])}
                />
              </label>
              <p className="text-xs text-muted mt-2">
                {pdfFile
                  ? `${pdfFile.name} · ${(pdfFile.size / 1024 / 1024).toFixed(2)} MB`
                  : mode === 'update'
                    ? 'Leave empty to keep the current PDF.'
                    : 'No file selected.'}
              </p>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={gated}
              onChange={(e) => setGated(e.target.checked)}
              className="accent-accent"
            />
            Require email before viewing
          </label>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        )}
        <div className="p-5 border-t border-border flex justify-end gap-2">
          <button className="btn" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={submitting || loading}>
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function AnalyticsDrawer({
  docId,
  doc,
  views,
  onClose,
}: {
  docId: string;
  doc?: DocRow;
  views: View[] | null;
  onClose: () => void;
}) {
  const isPdf = doc?.kind === 'pdf';
  const sorted = views ? [...views].sort((a, b) => b.openedAt - a.openedAt) : null;
  const totalViews = sorted?.length ?? 0;
  const uniqueViewers = sorted ? new Set(sorted.map((v) => v.email || v.sessionId)).size : 0;
  const avgDuration = sorted && sorted.length > 0 ? sorted.reduce((a, v) => a + v.duration, 0) / sorted.length : 0;
  const avgScroll = sorted && sorted.length > 0 ? sorted.reduce((a, v) => a + v.maxScroll, 0) / sorted.length : 0;
  const avgPagesViewed =
    sorted && sorted.length > 0
      ? sorted.reduce((a, v) => a + Object.keys(v.pagesViewed || {}).length, 0) / sorted.length
      : 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-stretch justify-end z-50" onClick={onClose}>
      <div
        className="bg-panel border-l border-border w-full max-w-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-medium">{doc?.title}</h2>
            <p className="text-xs text-muted">{docId}</p>
          </div>
          <button className="text-muted text-sm hover:text-white" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="p-5 grid grid-cols-4 gap-3 border-b border-border">
          <Stat label="Views" value={totalViews.toString()} />
          <Stat label="Unique" value={uniqueViewers.toString()} />
          <Stat label="Avg time" value={fmtDuration(avgDuration)} />
          {isPdf ? (
            <Stat label="Avg pages viewed" value={avgPagesViewed.toFixed(1)} />
          ) : (
            <Stat label="Avg scroll" value={`${Math.round(avgScroll)}%`} />
          )}
        </div>

        <div className="p-5">
          <h3 className="text-xs uppercase tracking-wider text-muted mb-3">Sessions</h3>
          {!sorted ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted">No views yet.</p>
          ) : (
            <div className="space-y-2">
              {sorted.map((v) => {
                const sectionEntries = v.sections
                  ? Object.entries(v.sections).sort((a, b) => b[1] - a[1])
                  : [];
                const pageCount = doc?.pdfPages ?? (v.pagesViewed ? Math.max(...Object.keys(v.pagesViewed).map(Number), v.maxPage ?? 0) : 0);
                const pageEntries = isPdf && pageCount > 0
                  ? Array.from({ length: pageCount }, (_, i) => i + 1).map((pn) => ({
                      page: pn,
                      dwellMs: v.pagesViewed?.[pn] ?? 0,
                    }))
                  : [];
                return (
                  <div key={v.sessionId} className="border border-border rounded p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-medium text-sm">
                        {v.email || <span className="text-muted">Anonymous</span>}
                        {v.name && <span className="text-muted ml-2">({v.name})</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <span className="border border-border rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                          v{v.docVersion ?? 1}
                        </span>
                        <span>{fmt(v.openedAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted">
                      <span>⏱ {fmtDuration(v.duration)}</span>
                      {isPdf ? (
                        <span>
                          📄 {Object.keys(v.pagesViewed || {}).length}/{pageCount || '?'} pages
                        </span>
                      ) : (
                        <span>↕ {Math.round(v.maxScroll)}% scroll</span>
                      )}
                      {(v.city || v.country) && (
                        <span>
                          📍 {[v.city, v.country].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>
                    {isPdf && pageEntries.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="text-[10px] uppercase tracking-wider text-muted mb-2">
                          Pages viewed
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {pageEntries.map(({ page, dwellMs }) => {
                            const opacity = Math.min(1, dwellMs / 60000);
                            return (
                              <div key={page} className="flex flex-col items-center gap-1">
                                <div
                                  className="w-5 h-5 rounded-sm border border-border"
                                  style={{ backgroundColor: `rgba(196, 255, 0, ${opacity})` }}
                                  title={`Page ${page}: ${fmtDuration(dwellMs / 1000)}`}
                                />
                                <span className="text-[9px] text-muted">{page}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {!isPdf && sectionEntries.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="text-[10px] uppercase tracking-wider text-muted mb-2">
                          Sections viewed
                        </div>
                        <div className="space-y-1">
                          {sectionEntries.map(([id, ms]) => (
                            <div key={id} className="flex items-center justify-between text-xs">
                              <span className="truncate pr-3 text-white/80">{id}</span>
                              <span className="text-muted shrink-0">{fmtDuration(ms / 1000)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded p-3">
      <div className="text-xs text-muted uppercase tracking-wider">{label}</div>
      <div className="text-lg font-medium mt-1">{value}</div>
    </div>
  );
}
