// サインを書くところ。線は「点の並び」で保存する（画像にしない）。図の大きさは 横600×縦220。
// 線の形：[x,y,x,y,...] の並び
const NS = 'http://www.w3.org/2000/svg';
const W = 600, H = 220;
const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const pathOf = (p) => { let d = `M${p[0]} ${p[1]}`; if (p.length === 2) d += 'l0.1 0'; for (let i = 2; i < p.length; i += 2) d += `L${p[i]} ${p[i + 1]}`; return d; };

export function signPad({ strokes, onChange, readOnly = false }) {
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'signpad' + (readOnly ? ' ro' : ''), role: 'img', 'aria-label': 'サイン' });
  if (!readOnly) svg.append(el('line', { x1: 30, y1: H - 50, x2: W - 30, y2: H - 50, class: 'signline' }));
  const layer = el('g', { class: 'signstrokes' }); svg.append(layer);
  const drawOne = (p) => { const e = el('path', { d: pathOf(p) }); layer.append(e); return e; };
  const redraw = () => { layer.replaceChildren(); strokes.forEach(drawOne); };
  redraw(); svg.redraw = redraw;
  if (readOnly) return svg;
  const pt = (e) => { const m = svg.getScreenCTM().inverse(); return [Math.round(e.clientX * m.a + e.clientY * m.c + m.e), Math.round(e.clientX * m.b + e.clientY * m.d + m.f)]; };
  let cur = null, curEl = null, id = null;
  svg.addEventListener('pointerdown', (e) => { if (id != null) return; e.preventDefault(); id = e.pointerId; svg.setPointerCapture(id); cur = pt(e); curEl = drawOne(cur); });
  svg.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id || !cur) return;
    for (const ev of (e.getCoalescedEvents ? e.getCoalescedEvents() : [e])) { const p = pt(ev.clientX ? ev : e); const n = cur.length; if (Math.hypot(p[0] - cur[n - 2], p[1] - cur[n - 1]) >= 2) cur.push(p[0], p[1]); }
    curEl.setAttribute('d', pathOf(cur));
  });
  const end = (e) => { if (e.pointerId !== id) return; id = null; if (cur) { strokes.push(cur); onChange && onChange(); } cur = null; curEl = null; };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  return svg;
}
