'use client';

import { useEffect, useRef, useState } from 'react';

const TRACK_SCRIPT = `
<script>
(function(){
  var start = Date.now();
  var maxScroll = 0;
  function pct(){
    var d = document.documentElement;
    var b = document.body;
    var sh = Math.max(d.scrollHeight, b.scrollHeight);
    var ch = window.innerHeight;
    var st = window.scrollY || d.scrollTop;
    if (sh <= ch) return 100;
    return Math.min(100, Math.round(((st + ch) / sh) * 100));
  }
  function tick(action){
    var p = pct();
    if (p > maxScroll) maxScroll = p;
    var duration = (Date.now() - start) / 1000;
    parent.postMessage({ __ds: true, action: action, maxScroll: maxScroll, duration: duration }, '*');
  }
  window.addEventListener('scroll', function(){ tick('heartbeat'); }, { passive: true });
  setInterval(function(){ tick('heartbeat'); }, 5000);
  window.addEventListener('beforeunload', function(){ tick('close'); });
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'hidden') tick('close');
  });
  // initial
  tick('heartbeat');
})();
</script>
`;

function injectScript(html: string): string {
  // Try to inject before </body>, fallback to append
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, TRACK_SCRIPT + '</body>');
  }
  return html + TRACK_SCRIPT;
}

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

  const enrichedHtml = injectScript(html);

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
      const { action, maxScroll, duration } = e.data;
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
    <div className="w-screen h-screen bg-white">
      <iframe
        ref={iframeRef}
        srcDoc={enrichedHtml}
        title={title}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}
