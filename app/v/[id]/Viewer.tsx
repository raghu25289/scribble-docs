'use client';

import { useEffect, useRef, useState } from 'react';
import { injectAll } from '@/lib/inject';

function genSessionId(): string {
  return 'sid_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function Viewer({
  docId,
  html,
  email,
  name,
  title,
}: {
  docId: string;
  html: string;
  email?: string;
  name?: string;
  title: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [sessionId] = useState(() => genSessionId());
  const lastSentRef = useRef<{ maxScroll: number; duration: number }>({ maxScroll: 0, duration: 0 });
  const openedRef = useRef(false);

  const enrichedHtml = injectAll(html);

  useEffect(() => {
    // Fire open event
    if (!openedRef.current) {
      openedRef.current = true;
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open', sessionId, docId, email, name }),
        keepalive: true,
      }).catch(() => {});
    }

    function onMessage(e: MessageEvent) {
      if (!e.data || !e.data.__ds) return;
      const { action } = e.data;
      if (action === 'section') {
        const { id, dwell } = e.data;
        const payload = JSON.stringify({ action, sessionId, docId, id, dwell });
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }));
        } else {
          fetch('/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
        return;
      }
      const { maxScroll, duration } = e.data;
      lastSentRef.current = { maxScroll, duration };
      const payload = JSON.stringify({ action, sessionId, docId, email, name, maxScroll, duration });
      // Use sendBeacon when available for reliability on unload
      if (action === 'close' && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/track', blob);
      } else {
        fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    }

    window.addEventListener('message', onMessage);

    // Also fire close on parent unload
    function onUnload() {
      const { maxScroll, duration } = lastSentRef.current;
      const payload = JSON.stringify({
        action: 'close',
        sessionId,
        docId,
        email,
        name,
        maxScroll,
        duration,
      });
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/track', blob);
      }
    }
    window.addEventListener('beforeunload', onUnload);

    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('beforeunload', onUnload);
      onUnload();
    };
  }, [docId, sessionId, email, name]);

  return (
    <div className="w-screen h-screen bg-white relative">
      <iframe
        ref={iframeRef}
        srcDoc={enrichedHtml}
        title={title}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
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
