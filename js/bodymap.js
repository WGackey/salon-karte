// からだの図（前・後ろ）。自分で描き起こした、かんたんな輪郭。
// なぞった線は「点の並び」で保存する（写真のような重いデータにしない）。
// 線の形：{ m: しるしの番号, w: 太さ, p: [x,y,x,y,...] }（0.9.0〜0.10.0 の線には by:'staff' がついていることがある。画面では使わない・消さない）  図の大きさは 横300×縦640。
import { FIGS } from './parts.js';
const NS = 'http://www.w3.org/2000/svg';
const HALF = [[159, 40], [161, 74], [162, 92], [170, 103], [186, 109], [209, 119], [221, 138], [226, 175], [230, 215], [237, 255], [243, 290], [249, 316], [249, 336], [240, 345], [231, 336], [229, 312], [222, 288], [213, 252], [206, 218], [201, 186], [199, 162],
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
  // 後ろの肩甲骨：内側のふち → 下の角 → 外側のふち と、上の骨の出っぱり（0.11.0。前の「（ ）」の形は不自然だったので直した。りんかくは同じ）
  back: '<path d="M150 96V300" stroke-dasharray="5 6"/><path d="M134 132C132 150 132 166 135 182C128 176 120 166 113 152M166 132C168 150 168 166 165 182C172 176 180 166 187 152"/><path d="M134 140C126 135 116 132 106 131M166 140C174 135 184 132 194 131" opacity=".8"/><path d="M112 330q20 22 38 0q18 22 38 0M108 448h18M174 448h18"/>',
};
// 頭と体を1つのりんかくに見せる（0.14.1 がっき〜：首と頭を分ける線を消す）：ふち色で太く → 中の色だけ の2回重ね（parts.js の union と同じやり方）
const HEADBODY = (edge) => `<g${edge ? ' style="stroke-width:4"' : ' style="stroke:none"'}><ellipse cx="150" cy="47" rx="23" ry="34"/><path d="${OUTLINE}"/></g>`;
export const ZONES = { all: '15 5 270 628', top: '15 5 270 350', bottom: '15 290 270 343' };
export const FIGURES = [FIGS.front, FIGS.back]; // 全身の図。部位の図は parts.js の FIGS
function el(tag, attrs) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
const pathOf = (p) => { let d = `M${p[0]} ${p[1]}`; if (p.length === 2) d += `l0.1 0`; for (let i = 2; i < p.length; i += 2) d += `L${p[i]} ${p[i + 1]}`; return d; };

// kind: 図の番号（'front' | 'back' | 'hand_palm_r' …）。strokes をその場で書きかえる。getTool() → {mode:'draw'|'erase', mark, width}
// layer：だれの図か。'staff'＝施術する人の所見（ぬった線）／'guest'＝お客さんの気になるところ（つぶつぶの線）
// under：下に重ねて見せるだけの図 [{ strokes, layer }]（なぞれない）
export function bodyPad({ kind, strokes, marks, getTool, onChange, readOnly = false, layer = 'staff', under = [], overlaySvg = '' }) {
  const def = FIGS[kind] || FIGS.front; const part = !!def.box; // part＝部位の図（手・足など）
  const svg = el('svg', { viewBox: part ? def.box.join(' ') : ZONES.all, class: 'bodypad' + (part ? ' pt' : '') + (readOnly ? ' ro' : ''), role: 'img', 'aria-label': `からだの図（${def.name}）` });
  if (part) {
    // 重ねる層（反射区など・第3段）は、図のすぐ上・なぞった線の下に入る
    svg.innerHTML = def.svg + (overlaySvg ? `<g class="fig-overlay">${overlaySvg}</g>` : '');
    svg.setZone = () => {};
  } else {
    const left = kind === 'front' ? '右' : '左', right = kind === 'front' ? '左' : '右';
    svg.innerHTML = `<g transform="translate(150 0) scale(1.22 1) translate(-150 0)"><g class="fig">${HEADBODY(1)}${HEADBODY(0)}</g><g class="fig-detail">${DETAIL[kind]}</g></g>
    <text x="50" y="40" class="fig-lr">${left}</text><text x="250" y="40" class="fig-lr">${right}</text>`;
    // 小さい画面用：上半身・下半身だけを大きく出す（線の位置は図の座標のままなので、ずれない）
    svg.setZone = (z) => svg.setAttribute('viewBox', ZONES[z] || ZONES.all);
  }
  const color = (m) => (marks.find((x) => x.id === m) || { color: '#888' }).color;
  const isX = (m) => !!(marks.find((x) => x.id === m) || {}).x;
  // 「触れないで」のしるしは、なぞった線を点線にして、まん中に大きな × を出す
  const xMark = (s, g) => {
    const xs = s.p.filter((_, i) => i % 2 === 0), ys = s.p.filter((_, i) => i % 2 === 1);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, r = 14;
    g.append(el('path', { d: `M${cx - r} ${cy - r}L${cx + r} ${cy + r}M${cx + r} ${cy - r}L${cx - r} ${cy + r}`, stroke: color(s.m), 'stroke-width': 6, class: 'xmark' }));
    return [cx, cy, r];
  };
  const drawOne = (s, to, ly) => {
    if (!isX(s.m)) {
      // お客さんの線は「つぶつぶ」（丸い点のつらなり）、施術する人の線は「ぬった線」
      const a = { d: pathOf(s.p), stroke: color(s.m), 'stroke-width': s.w }; if (ly === 'guest') a['stroke-dasharray'] = `0.1 ${Math.round(s.w * 1.3)}`;
      const p = el('path', a); to.append(p); return p;
    }
    const g = el('g', { class: 'notouch' }); const p = el('path', { d: pathOf(s.p), stroke: color(s.m), 'stroke-width': Math.min(s.w, 8), 'stroke-dasharray': '6 6' });
    g.append(p); xMark(s, g);
    to.append(g); return p;
  };
  for (const u of under) { const g = el('g', { class: 'strokes under ' + u.layer }); svg.append(g); (u.strokes || []).forEach((s) => drawOne(s, g, u.layer)); }
  const layerEl = el('g', { class: 'strokes own ' + layer }); svg.append(layerEl);
  const redraw = () => { layerEl.replaceChildren(); strokes.forEach((s) => drawOne(s, layerEl, layer)); };
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
    cur = { m: tool.mark, w: tool.width, p: [...p] }; curEl = drawOne(cur, layerEl, layer);
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
    if (cur && cur !== 'erase') { strokes.push(cur); if (isX(cur.m)) redraw(); onChange({ type: 'add', stroke: cur }); }
    cur = null; curEl = null;
  };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  // すばやく払うように書き終えると、ブラウザが「払う動き」とみなして、すぐ次の1回押しを飲みこむことがある。
  // 指の動きをここで引き受けて、ブラウザに払う動きとして扱わせない（書いたあとのボタンが1回で押せるように）
  for (const t of ['touchstart', 'touchmove', 'touchend']) svg.addEventListener(t, (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  svg.redraw = redraw;
  return svg;
}
