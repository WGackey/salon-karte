// からだの図（前・後ろ）。自分で描き起こした、かんたんな輪郭。
// なぞった線は「点の並び」で保存する（写真のような重いデータにしない）。
// 線の形：{ m: しるしの番号, w: 太さ, p: [x,y,x,y,...] }  図の大きさは 横300×縦640。
const NS = 'http://www.w3.org/2000/svg';
const HALF = [[162, 80], [164, 100], [186, 109], [209, 119], [221, 138], [226, 175], [230, 215], [237, 255], [243, 290], [249, 316], [249, 336], [240, 345], [231, 336], [229, 312], [222, 288], [213, 252], [206, 218], [201, 186], [199, 162],
  [198, 200], [194, 240], [197, 275], [204, 305], [207, 345], [204, 395], [197, 440], [199, 482], [196, 525], [188, 570], [187, 592], [198, 610], [195, 621], [171, 621], [166, 600], [169, 570], [168, 525], [164, 482], [166, 440], [160, 395], [151, 342]];
function smooth(pts) {
  // 点をなめらかにつなぐ（閉じた形）
  const n = pts.length; let d = '';
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    if (i === 0) d += `M${p1[0]} ${p1[1]}`;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return d + 'Z';
}
const OUTLINE = smooth([...HALF, ...HALF.map(([x, y]) => [300 - x, y]).reverse()]);
const DETAIL = {
  front: '<path d="M128 116q12 8 20 4M172 116q-12 8 -20 4M176 440q8 8 16 0M108 440q8 8 16 0M118 186q14 10 28 2M182 186q-14 10 -28 2"/><circle cx="150" cy="270" r="2.5"/>',
  back: '<path d="M150 96V300" stroke-dasharray="5 6"/><path d="M118 150q8 34 24 44M182 150q-8 34 -24 44M112 330q20 22 38 0q18 22 38 0M108 448h18M174 448h18"/>',
};
export const ZONES = { all: '15 5 270 628', top: '15 5 270 350', bottom: '15 290 270 343' };
export const FIGURES = [{ id: 'front', name: '前' }, { id: 'back', name: '後ろ' }];
function el(tag, attrs) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
const pathOf = (p) => { let d = `M${p[0]} ${p[1]}`; if (p.length === 2) d += `l0.1 0`; for (let i = 2; i < p.length; i += 2) d += `L${p[i]} ${p[i + 1]}`; return d; };

// kind: 'front' | 'back'。strokes をその場で書きかえる。getTool() → {mode:'draw'|'erase', mark, width}
export function bodyPad({ kind, strokes, marks, getTool, onChange, readOnly = false }) {
  const svg = el('svg', { viewBox: '15 5 270 628', class: 'bodypad' + (readOnly ? ' ro' : ''), role: 'img', 'aria-label': `からだの図（${kind === 'front' ? '前' : '後ろ'}）` });
  const left = kind === 'front' ? '右' : '左', right = kind === 'front' ? '左' : '右';
  svg.innerHTML = `<g transform="translate(150 0) scale(1.22 1) translate(-150 0)"><g class="fig"><ellipse cx="150" cy="47" rx="23" ry="34"/><path d="${OUTLINE}"/></g><g class="fig-detail">${DETAIL[kind]}</g></g>
    <text x="50" y="40" class="fig-lr">${left}</text><text x="250" y="40" class="fig-lr">${right}</text><g class="strokes"></g>`;
  const layer = svg.querySelector('.strokes');
  // 小さい画面用：上半身・下半身だけを大きく出す（線の位置は図の座標のままなので、ずれない）
  svg.setZone = (z) => svg.setAttribute('viewBox', ZONES[z] || ZONES.all);
  const color = (m) => (marks.find((x) => x.id === m) || { color: '#888' }).color;
  const drawOne = (s) => { const p = el('path', { d: pathOf(s.p), stroke: color(s.m), 'stroke-width': s.w }); layer.append(p); return p; };
  const redraw = () => { layer.replaceChildren(); strokes.forEach(drawOne); };
  redraw();
  if (readOnly) return svg;

  const pt = (e) => { const m = svg.getScreenCTM().inverse(); return [Math.round(e.clientX * m.a + e.clientY * m.c + m.e), Math.round(e.clientX * m.b + e.clientY * m.d + m.f)]; };
  let cur = null, curEl = null, activeId = null, penDown = false;
  const eraseAt = ([x, y]) => {
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i], r = s.w / 2 + 8;
      for (let j = 0; j < s.p.length; j += 2) if (Math.abs(s.p[j] - x) < r && Math.abs(s.p[j + 1] - y) < r) { strokes.splice(i, 1); redraw(); onChange({ type: 'erase', index: i, stroke: s }); return; }
    }
  };
  svg.addEventListener('pointerdown', (e) => {
    if (activeId != null) return;
    if (e.pointerType === 'touch' && penDown) return; // ペンで書いている間、手のひらは無視
    if (e.pointerType === 'pen') penDown = true;
    e.preventDefault(); activeId = e.pointerId; svg.setPointerCapture(e.pointerId);
    const tool = getTool(); const p = pt(e);
    if (tool.mode === 'erase') { cur = 'erase'; eraseAt(p); return; }
    cur = { m: tool.mark, w: tool.width, p: [...p] }; curEl = drawOne(cur);
  });
  svg.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activeId || !cur) return;
    for (const ev of (e.getCoalescedEvents ? e.getCoalescedEvents() : [e])) {
      const p = pt(ev.clientX ? ev : e);
      if (cur === 'erase') { eraseAt(p); continue; }
      const n = cur.p.length; if (Math.hypot(p[0] - cur.p[n - 2], p[1] - cur.p[n - 1]) < 3) continue;
      cur.p.push(p[0], p[1]);
    }
    if (cur !== 'erase') curEl.setAttribute('d', pathOf(cur.p));
  });
  const end = (e) => {
    if (e.pointerType === 'pen') penDown = false;
    if (e.pointerId !== activeId) return; activeId = null;
    if (cur && cur !== 'erase') { strokes.push(cur); onChange({ type: 'add', stroke: cur }); }
    cur = null; curEl = null;
  };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  svg.redraw = redraw;
  return svg;
}
