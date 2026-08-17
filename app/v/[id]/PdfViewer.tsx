'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function genSessionId(): string {
  return 'sid_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const HEARTBEAT_MS = 5000;
const PAGE_DWELL_MIN_MS = 500;

export default function PdfViewer({
  docId,
  pdfUrl,
  pdfPages,
  email,
  name,
  title,
}: {
  docId: string;
  pdfUrl: string;
  pdfPages?: number;
  email?: string;
  name?: string;
  title: string;
}) {
  const [sessionId] = useState(() => genSessionId());
  const [numPages, setNumPages] = useState(pdfPages ?? 0);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const startRef = useRef<number>(Date.now());
  const maxScrollRef = useRef(0);
  const openedRef = useRef(false);
  const pageEnterRef = useRef<Record<number, number>>({});
  const currentPageRef = useRef<number | null>(null);

  const sendTrack = useCallback(
    (payload: Record<string, unknown>, useBeacon = false) => {
      const body = JSON.stringify({ sessionId, docId, ...payload });
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    },
    [sessionId, docId]
  );

  const sendPageDwell = useCallback(
    (pageNumber: number, dwellMs: number, useBeacon = false) => {
      if (dwellMs < PAGE_DWELL_MIN_MS) return;
      sendTrack({ action: 'page', pageNumber, dwell: dwellMs }, useBeacon);
    },
    [sendTrack]
  );

  const scrollPct = useCallback(() => {
    const el = containerRef.current;
    if (!el) return 0;
    const sh = el.scrollHeight;
    const ch = el.clientHeight;
    if (sh <= ch) return 100;
    return Math.min(100, Math.round(((el.scrollTop + ch) / sh) * 100));
  }, []);

  const tick = useCallback(
    (action: 'heartbeat' | 'close', useBeacon = false) => {
      const p = scrollPct();
      if (p > maxScrollRef.current) maxScrollRef.current = p;
      const duration = (Date.now() - startRef.current) / 1000;
      sendTrack({ action, email, name, maxScroll: maxScrollRef.current, duration }, useBeacon);
    },
    [scrollPct, sendTrack, email, name]
  );

  const flushCurrentPage = useCallback(
    (useBeacon: boolean) => {
      const pn = currentPageRef.current;
      if (pn == null) return;
      const enter = pageEnterRef.current[pn];
      if (!enter) return;
      const dwell = Date.now() - enter;
      pageEnterRef.current[pn] = 0;
      sendPageDwell(pn, dwell, useBeacon);
    },
    [sendPageDwell]
  );

  useEffect(() => {
    if (!openedRef.current) {
      openedRef.current = true;
      sendTrack({ action: 'open', email, name });
    }

    const el = containerRef.current;
    function onScroll() {
      tick('heartbeat');
    }
    el?.addEventListener('scroll', onScroll, { passive: true });

    const interval = setInterval(() => tick('heartbeat'), HEARTBEAT_MS);

    function onBeforeUnload() {
      flushCurrentPage(true);
      tick('close', true);
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        flushCurrentPage(true);
        tick('close', true);
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibilityChange);

    tick('heartbeat');

    return () => {
      el?.removeEventListener('scroll', onScroll);
      clearInterval(interval);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      flushCurrentPage(false);
      tick('close');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, sessionId]);

  useEffect(() => {
    function updateWidth() {
      if (containerRef.current) setContainerWidth(containerRef.current.clientWidth);
    }
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  useEffect(() => {
    if (!numPages || !containerRef.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pn = Number((entry.target as HTMLElement).dataset.page);
          if (!pn) return;
          if (entry.isIntersecting) {
            if (!pageEnterRef.current[pn]) pageEnterRef.current[pn] = Date.now();
            currentPageRef.current = pn;
          } else {
            const enter = pageEnterRef.current[pn];
            if (enter) {
              const dwell = Date.now() - enter;
              pageEnterRef.current[pn] = 0;
              sendPageDwell(pn, dwell);
            }
          }
        });
      },
      { threshold: 0.5, root: containerRef.current }
    );
    Object.values(pageRefs.current).forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [numPages, sendPageDwell]);

  const pages = Array.from({ length: numPages }, (_, i) => i + 1);
  const pageWidth = containerWidth ? Math.min(containerWidth - 32, 900) : undefined;

  return (
    <div className="w-screen h-screen bg-neutral-900 relative">
      <div ref={containerRef} className="w-full h-full overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col items-center gap-4 py-8 px-4">
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            loading={<div className="text-neutral-400 text-sm py-24">Loading PDF…</div>}
            error={<div className="text-red-400 text-sm py-24">Failed to load PDF.</div>}
          >
            {pages.map((pn) => (
              <div
                key={pn}
                data-page={pn}
                ref={(el) => {
                  pageRefs.current[pn] = el;
                }}
                className="relative border border-white/10 shadow-lg"
              >
                <Page
                  pageNumber={pn}
                  width={pageWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
                <span className="absolute bottom-2 right-2 text-[10px] text-white/70 bg-black/50 rounded px-1.5 py-0.5">
                  {pn} / {numPages || pdfPages || '?'}
                </span>
              </div>
            ))}
          </Document>
        </div>
      </div>
      <a
        href={`/raw/${docId}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'fixed',
          top: '12px',
          right: '12px',
          padding: '5px 10px',
          background: 'rgba(0,0,0,0.55)',
          color: '#fff',
          fontSize: '12px',
          borderRadius: '4px',
          textDecoration: 'none',
          opacity: 0.35,
          transition: 'opacity 0.15s',
          zIndex: 9999,
          lineHeight: '1.4',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = '1')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = '0.35')}
      >
        Open in new tab
      </a>
    </div>
  );
}
