const VIEWPORT_META = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">';

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

  // Section dwell tracking
  function sectionId(el){
    var ds = el.getAttribute('data-section');
    if (ds) return ds;
    if (el.id) return el.id;
    var t = (el.textContent || '').trim().replace(/\\s+/g, ' ');
    return t.slice(0, 60);
  }
  function flush(el){
    var enter = el.__dsEnter;
    if (!enter) return;
    var dwell = Date.now() - enter;
    el.__dsEnter = 0;
    if (dwell < 500) return;
    var id = sectionId(el);
    if (!id) return;
    parent.postMessage({ __ds: true, action: 'section', id: id, dwell: dwell }, '*');
  }
  function initSections(){
    var els = document.querySelectorAll('section[data-section], section[id], [data-section], h2[id]');
    if (!els.length || typeof IntersectionObserver === 'undefined') return;
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        var el = e.target;
        if (e.isIntersecting) {
          if (!el.__dsEnter) el.__dsEnter = Date.now();
        } else {
          flush(el);
        }
      });
    }, { threshold: 0.5 });
    els.forEach(function(el){ io.observe(el); });
    window.addEventListener('beforeunload', function(){
      els.forEach(function(el){ flush(el); });
    });
    document.addEventListener('visibilitychange', function(){
      if (document.visibilityState === 'hidden') els.forEach(function(el){ flush(el); });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSections);
  } else {
    initSections();
  }
})();
</script>
`;

export function injectViewport(html: string): string {
  if (/(<meta[^>]+name=["']viewport["'][^>]*>)/i.test(html)) {
    return html;
  }
  if (/<head>/i.test(html)) {
    return html.replace(/<head>/i, `<head>${VIEWPORT_META}`);
  }
  return `<!doctype html><html><head>${VIEWPORT_META}</head><body>${html}</body></html>`;
}

export function injectTrackScript(html: string): string {
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, TRACK_SCRIPT + '</body>');
  }
  return html + TRACK_SCRIPT;
}

export function injectAll(html: string): string {
  return injectTrackScript(injectViewport(html));
}
