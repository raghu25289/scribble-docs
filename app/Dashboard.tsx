'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type DocRow = {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  gated: boolean;
  viewCount: number;
  lastViewedAt?: number;
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
  const [openAnalyticsFor, setOpenAnalyticsFor] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<View[] | null>(null);
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
            {docs.map((d) => (
              <div
                key={d.id}
                className="border border-border rounded-lg p-4 hover:border-muted transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">{d.title}</h3>
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
            ))}
          </div>
        )}
      </main>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onCreated={(doc) => {
            startTransition(() => {
              setDocs((d) => [{ ...doc, viewCount: 0 }, ...d]);
              setShowUpload(false);
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
    </div>
  );
}

function UploadModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (doc: DocRow) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [html, setHtml] = useState('');
  const [gated, setGated] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function onFile(file: File) {
    if (!file) return;
    const text = await file.text();
    setHtml(text);
    if (!title) setTitle(file.name.replace(/\.html?$/i, ''));
  }

  async function submit() {
    if (!title.trim() || !html.trim()) {
      setError('Title and HTML are required.');
      return;
    }
    setSubmitting(true);
    setError('');
    const res = await fetch('/api/docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, html, gated }),
    });
    if (!res.ok) {
      setError('Failed to create.');
      setSubmitting(false);
      return;
    }
    const doc = await res.json();
    onCreated(doc);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-panel border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="font-medium">New doc</h2>
          <button className="text-muted text-sm hover:text-white" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4">
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
        <div className="p-5 border-t border-border flex justify-end gap-2">
          <button className="btn" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create & get link'}
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
  const sorted = views ? [...views].sort((a, b) => b.openedAt - a.openedAt) : null;
  const totalViews = sorted?.length ?? 0;
  const uniqueViewers = sorted ? new Set(sorted.map((v) => v.email || v.sessionId)).size : 0;
  const avgDuration = sorted && sorted.length > 0 ? sorted.reduce((a, v) => a + v.duration, 0) / sorted.length : 0;
  const avgScroll = sorted && sorted.length > 0 ? sorted.reduce((a, v) => a + v.maxScroll, 0) / sorted.length : 0;

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
          <Stat label="Avg scroll" value={`${Math.round(avgScroll)}%`} />
        </div>

        <div className="p-5">
          <h3 className="text-xs uppercase tracking-wider text-muted mb-3">Sessions</h3>
          {!sorted ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted">No views yet.</p>
          ) : (
            <div className="space-y-2">
              {sorted.map((v) => (
                <div key={v.sessionId} className="border border-border rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium text-sm">
                      {v.email || <span className="text-muted">Anonymous</span>}
                      {v.name && <span className="text-muted ml-2">({v.name})</span>}
                    </div>
                    <div className="text-xs text-muted">{fmt(v.openedAt)}</div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted">
                    <span>⏱ {fmtDuration(v.duration)}</span>
                    <span>↕ {Math.round(v.maxScroll)}% scroll</span>
                    {(v.city || v.country) && (
                      <span>
                        📍 {[v.city, v.country].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
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
