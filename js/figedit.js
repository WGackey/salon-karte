// からだの図をなぞる画面（道具つき）。お客さんの「気になるところ」と、施術する人の「所見」の両方で使う。
//   figures：{ front:[線], back:[線] } をその場で書きかえる
//   layer  ：'guest'＝お客さんの図（つぶつぶの線）／'staff'＝施術する人の図（ぬった線）
//   under  ：重ねて見せるだけの、もう片方の図 { figures, layer, label }（なくてもよい）
//   simple ：お客さんに渡すとき用。道具を少なく・ボタンを大きく
//   お客さんの図も施術する人の図も、だれでも書き足せて、まちがえた線は消しゴム・ひとつ戻すで消せる（11/16 がっき〜。0.9.0 の「見るだけ（lock）」はやめた）
// 書くのは、いつも画面いっぱい（2026-11-15 がっき〜の決定）。来店の流れの中には小さな図（見るだけ）を置き、押すと画面いっぱいで開く
import { h, fill, btn, chips, toast, confirmDlg, isPhone } from './ui.js';
import { bodyPad, FIGURES } from './bodymap.js';
import { hasReflex, reflexSvg, reflexZones } from './parts.js';

const WIDTHS = [[6, '細い'], [14, 'ふつう'], [26, '太い']];
export const hasLines = (figs) => Object.values(figs || {}).some((a) => (a || []).length > 0);

//   figs   ：出す図の並び（全身＝前・後ろ／部分＝手のひら・手の甲 など。parts.js の figsOf）
export function figureEditor({ figures, figs = FIGURES, layer = 'staff', under = null, marks: allMarks, onSave, simple = false, markLabel = '症状（色）', hints = [], reflex = null, openLabel = '' }) {
  // reflex：反射区（足の裏の区分け）を重ねるとき { get: () => settings.reflex, save }。足の裏の図があるときだけボタンが出る。はじめは出さない
  const rfOn = () => !!reflex && hasReflex(figs) && !!(reflex.get() || {}).show;
  const FIGURES_ = figs; const whole = figs.every((f) => !f.box); const many = figs.length > 2;
  const marks = allMarks;
  const tool = { mode: 'draw', mark: (marks[0] || allMarks[0]).id, width: 14 };
  const pads = {}; let view = figs.length < 2 || isPhone() ? figs[0].id : 'both'; let zone = 'all'; let full = false;
  let showUnder = !!under && figs.some((f) => ((under.figures || {})[f.id] || []).length > 0);
  const copy = () => JSON.parse(JSON.stringify(Object.fromEntries(FIGURES_.map((f) => [f.id, figures[f.id] || []]))));
  const atOpen = copy(); // この画面を開いたときの図（「開く前に戻す」用）
  // したことの記録（「ひとつ戻す」用）。かいた・消しゴムで消した・ぜんぶ消した・開く前に戻した、のどれも1手として戻せる
  const hist = [];
  const root = h('div', { class: 'zu ' + layer + (simple ? ' simple' : '') });
  const padBox = h('div', { class: 'pads' });
  const drawPads = () => {
    if (!full) { fill(padBox); drawPrev(); return; } // 小さな図のあいだは、なぞれる図を作らない
    padBox.className = 'pads ' + (view === 'both' ? 'both' : 'one ' + view) + (many ? ' many' : '') + (whole ? '' : ' pt');
    fill(padBox, ...FIGURES_.filter((f) => view === 'both' || view === f.id).map((f) => {
      figures[f.id] = figures[f.id] || [];
      pads[f.id] = bodyPad({ kind: f.id, strokes: figures[f.id], marks: allMarks, layer, getTool: () => tool, overlaySvg: rfOn() ? reflexSvg(f.id, reflex.get()) : '',
        under: showUnder ? [{ strokes: under.figures[f.id] || [], layer: under.layer }] : [],
        onChange: (act) => { hist.push({ ...act, fig: f.id }); sync(); onSave(); } });
      pads[f.id].setZone(view === 'both' ? 'all' : zone);
      return h('div', { class: 'padwrap' }, h('div', { class: 'padname' }, f.name), pads[f.id]);
    }));
    drawLegend();
  };
  // 反射区の名前の一覧（番号 ＝ 図の中の番号）。名前を押すと、その区分けが少しのあいだ濃くなる
  const legend = h('div', { class: 'rzlegend' });
  const drawLegend = () => {
    if (!rfOn()) { fill(legend); legend.hidden = true; return; }
    const r = reflex.get(); legend.hidden = false;
    fill(legend, h('span', { class: 'rznote' }, r.checked ? '反射区' : '反射区（下書き・確かめていません）'),
      reflexZones(r).map((z) => h('button', { type: 'button', class: 'rzkey', style: { '--c': z.color }, onclick: () => {
        root.querySelectorAll('.rz').forEach((g) => g.classList.toggle('hi', g.dataset.z === z.id));
        legend.querySelectorAll('.rzkey').forEach((b) => b.classList.remove('on')); const me = legend.querySelector(`[data-z="${z.id}"]`); me && me.classList.add('on');
        clearTimeout(legend._t); legend._t = setTimeout(() => { root.querySelectorAll('.rz.hi').forEach((g) => g.classList.remove('hi')); me && me.classList.remove('on'); }, 2500);
      }, 'data-z': z.id }, h('b', null, z.no), z.name || '（名前なし）')));
  };
  // えらぶボタン（もう一度押しても外れない）。しるし＝色つきの丸いボタン、太さ＝線の太さが見える四角いボタン、と形を変えてある
  const markBtns = marks.map((m) => h('button', { type: 'button', class: 'markbtn', style: { '--c': m.color }, onclick: () => { tool.mark = m.id; tool.mode = 'draw'; sync(); } }, h('span', { class: 'dot' }), m.name));
  const widthBtns = WIDTHS.map(([w, name]) => h('button', { type: 'button', class: 'widthbtn', onclick: () => { tool.width = w; tool.mode = 'draw'; sync(); } }, h('span', { class: 'wline', style: { height: Math.round(w * 0.6) + 'px' } }), name));
  const now = h('div', { class: 'pennow' });
  const eraser = btn('消しゴム（線をえらぶ）', () => { tool.mode = tool.mode === 'erase' ? 'draw' : 'erase'; sync(); }, 'chip');
  const doUndo = () => {
    const a = hist.pop(); if (!a) return;
    if (a.type === 'add') { const arr = figures[a.fig]; const i = arr.lastIndexOf(a.stroke); if (i >= 0) arr.splice(i, 1); }
    else if (a.type === 'erase') figures[a.fig].splice(Math.min(a.index, figures[a.fig].length), 0, a.stroke); // 消しゴムで消した線を、元の場所に戻す
    else if (a.type === 'all') for (const f of FIGURES_) figures[f.id] = a.before[f.id];
    drawPads(); sync(); onSave();
    toast(a.type === 'add' ? 'かいた線を1本、取り消しました' : a.type === 'erase' ? '消しゴムで消した線を戻しました' : '元に戻しました');
  };
  const undo = btn('↩ ひとつ戻す', doUndo, 'chip nofull'); const undoFull = btn('↩ 戻す', doUndo, 'chip undofull');
  const replaceAll = (next) => { hist.push({ type: 'all', before: copy() }); for (const f of FIGURES_) figures[f.id] = next[f.id]; drawPads(); sync(); onSave(); };
  const clear = btn('ぜんぶ消す', async () => {
    if (!(await confirmDlg('図にかいた線をぜんぶ消します。（「ひとつ戻す」で元に戻せます）', '消す', true))) return;
    replaceAll(Object.fromEntries(FIGURES_.map((f) => [f.id, []]))); }, 'chip');
  const revert = btn('開く前に戻す', async () => {
    if (!(await confirmDlg('この画面を開いたあとにかいた・消した分をやめて、開く前の図に戻します。（「ひとつ戻す」で元に戻せます）', '開く前に戻す', true))) return;
    replaceAll(JSON.parse(JSON.stringify(atOpen))); }, 'chip');
  const sync = () => {
    const er = tool.mode === 'erase'; const m = marks.find((x) => x.id === tool.mark) || marks[0];
    markBtns.forEach((b, i) => b.classList.toggle('on', !er && marks[i].id === tool.mark));
    widthBtns.forEach((b, i) => b.classList.toggle('on', !er && WIDTHS[i][0] === tool.width));
    eraser.classList.toggle('on', er); eraser.textContent = er ? '✓ 消しゴム中（線にさわる）' : '消しゴム（線をえらぶ）';
    undo.disabled = undoFull.disabled = hist.length === 0; root.classList.toggle('erasing', er);
    fill(now, er ? h('b', null, 'いま：消しゴム') : [h('span', { class: 'small' }, 'いまのペン'), h('span', { class: 'penline', style: { background: m.color, height: Math.round(tool.width * 0.6) + 'px' } }), h('b', null, m.name)]);
  };
  // 見え方（ならべる・前だけ・後ろだけ）と、大きくするところ（全体・上半身・下半身）。画面いっぱいのときは、前・後ろの切りかえを上の帯にも出す
  const viewBox = h('div', { class: 'viewtools' }); const fullView = h('div', { class: 'fullview' });
  const setView = (x) => { view = x || view; if (view === 'both') zone = 'all'; drawView(); drawPads(); };
  const drawView = () => {
    fill(viewBox,
      figs.length > 1 ? chips([{ id: 'both', name: 'ならべる' }, ...figs.map((f) => ({ id: f.id, name: whole ? f.name + 'だけ' : f.name }))], view, { multi: false, cls: 'viewsel', onChange: setView }) : null,
      whole ? chips([{ id: 'all', name: '全体' }, { id: 'top', name: '上半身' }, { id: 'bottom', name: '下半身' }], zone, { multi: false, cls: 'zonesel', onChange: (z) => { zone = z || 'all'; if (zone !== 'all' && view === 'both') view = 'front'; drawView(); drawPads(); } }) : null,
      under ? chips([{ id: 'on', name: under.label }], showUnder ? ['on'] : [], { cls: 'undersel', onChange: (x) => { showUnder = x.length > 0; drawPads(); } }) : null,
      reflex && hasReflex(figs) ? chips([{ id: 'on', name: '反射区を重ねる' }], rfOn() ? ['on'] : [], { cls: 'rzsel', onChange: (x) => { reflex.get().show = x.length > 0; reflex.save(); drawPads(); } }) : null);
    fill(fullView, figs.length > 1 ? chips([...(isPhone() ? [] : [{ id: 'both', name: 'ならべる' }]), ...figs.map((f) => ({ id: f.id, name: f.name }))], view, { multi: false, cls: 'seg', onChange: setView }) : h('b', null, figs[0].name));
  };
  // 小さな図（見るだけ）。押すと画面いっぱいで開く。この上ではなぞれない
  const prevPads = h('div', { class: 'prevpads' + (whole ? '' : ' pt') + (many ? ' many' : '') });
  const prevNote = h('div', { class: 'prevnote' });
  const prevBox = h('button', { type: 'button', class: 'zuprev', 'aria-label': '図を画面いっぱいで開いて書く' }, prevPads,
    h('span', { class: 'prevtag' }, openLabel || (simple ? '✎ ここを押して、図に書く' : '✎ 押すと画面いっぱいで書けます')), prevNote);
  prevBox.onclick = () => setFull(true);
  const drawPrev = () => {
    fill(prevPads, ...FIGURES_.map((f) => h('div', { class: 'padwrap' }, h('div', { class: 'padname' }, f.name),
      bodyPad({ kind: f.id, strokes: figures[f.id] || [], marks: allMarks, layer, readOnly: true,
        under: showUnder ? [{ strokes: (under.figures || {})[f.id] || [], layer: under.layer }] : [] }))));
    const n = FIGURES_.reduce((a, f) => a + (figures[f.id] || []).length, 0);
    prevNote.textContent = n ? `なぞった線：${n}本` : 'まだ何もかいていません';
  };
  const setFull = (on) => {
    full = on; root.classList.toggle('full', on); document.documentElement.classList.toggle('noscroll', on);
    if (on && isPhone() && view === 'both') view = figs[0].id;
    if (on) fill(prevPads); // 小さな図は、とじたときに描き直す（同じ線が2か所に出ないように）
    drawView(); drawPads();
    if (on) sync();
    if (!on) root.scrollIntoView({ block: 'nearest' });
  };
  root.closeFull = () => { if (full) setFull(false); };
  addEventListener('keydown', function esc(e) { if (!root.isConnected) { if (hist.length || full) removeEventListener('keydown', esc); return; } if (e.key === 'Escape' && full) setFull(false); });
  drawPads(); drawView(); sync();
  const label = (t) => h('div', { class: 'tlabel' }, t);
  fill(root,
    // 画面いっぱいのときだけ出る上の帯：左に、はっきりした「もどる（とじる）」。ノッチにかからない位置（css の safe-area）
    h('div', { class: 'fullbar' }, btn('‹ もどる（とじる）', () => setFull(false), 'closefull'), fullView, undoFull),
    h('div', { class: 'toolbar' },
      h('div', { class: 'trow' }, label(markLabel), h('div', { class: 'chips' }, markBtns)),
      h('div', { class: 'trow' }, label('ペンの太さ'), h('div', { class: 'chips widths' }, widthBtns), label('直す'), h('div', { class: 'chips fixes' }, undo, eraser, simple ? null : clear, simple ? null : revert)),
      h('div', { class: 'trow' }, label('見え方'), viewBox)),
    h('div', { class: 'zu-main' }, now, padBox, legend),
    prevBox, h('div', { class: 'zuhints' }, hints.map((t) => h('p', { class: 'hint center' }, t))));
  return root;
}
