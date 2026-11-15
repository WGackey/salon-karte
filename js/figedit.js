// からだの図をなぞる画面（道具つき）。お客さんの「気になるところ」と、施術する人の「所見」の両方で使う。
//   figures：{ front:[線], back:[線] } をその場で書きかえる
//   layer  ：'guest'＝お客さんの図（つぶつぶの線）／'staff'＝施術する人の図（ぬった線）
//   under  ：重ねて見せるだけの、もう片方の図 { figures, layer, label }（なくてもよい）
//   simple ：お客さんに渡すとき用。道具を少なく・ボタンを大きく
import { h, fill, btn, chips, toast, confirmDlg, isPhone } from './ui.js';
import { bodyPad, FIGURES } from './bodymap.js';

const WIDTHS = [[6, '細い'], [14, 'ふつう'], [26, '太い']];
export const hasLines = (figs) => FIGURES.some((f) => ((figs || {})[f.id] || []).length > 0);

export function figureEditor({ figures, layer = 'staff', under = null, marks, onSave, simple = false, markLabel = '症状（色）', hints = [] }) {
  const tool = { mode: 'draw', mark: marks[0].id, width: 14 };
  const pads = {}; let view = isPhone() ? 'front' : 'both'; let zone = 'all'; let full = false;
  let showUnder = !!under && hasLines(under.figures);
  const copy = () => JSON.parse(JSON.stringify(Object.fromEntries(FIGURES.map((f) => [f.id, figures[f.id] || []]))));
  const atOpen = copy(); // この画面を開いたときの図（「開く前に戻す」用）
  // したことの記録（「ひとつ戻す」用）。かいた・消しゴムで消した・ぜんぶ消した・開く前に戻した、のどれも1手として戻せる
  const hist = [];
  const root = h('div', { class: 'zu ' + layer + (simple ? ' simple' : '') });
  const padBox = h('div', { class: 'pads' });
  const drawPads = () => {
    padBox.className = 'pads ' + view;
    fill(padBox, ...FIGURES.filter((f) => view === 'both' || view === f.id).map((f) => {
      figures[f.id] = figures[f.id] || [];
      pads[f.id] = bodyPad({ kind: f.id, strokes: figures[f.id], marks, layer, getTool: () => tool,
        under: showUnder ? [{ strokes: under.figures[f.id] || [], layer: under.layer }] : [],
        onChange: (act) => { hist.push({ ...act, fig: f.id }); sync(); onSave(); } });
      pads[f.id].setZone(view === 'both' ? 'all' : zone);
      return h('div', { class: 'padwrap' }, h('div', { class: 'padname' }, f.name), pads[f.id]);
    }));
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
    else if (a.type === 'all') for (const f of FIGURES) figures[f.id] = a.before[f.id];
    drawPads(); sync(); onSave();
    toast(a.type === 'add' ? 'かいた線を1本、取り消しました' : a.type === 'erase' ? '消しゴムで消した線を戻しました' : '元に戻しました');
  };
  const undo = btn('↩ ひとつ戻す', doUndo, 'chip nofull'); const undoFull = btn('↩ 戻す', doUndo, 'chip undofull');
  const replaceAll = (next) => { hist.push({ type: 'all', before: copy() }); for (const f of FIGURES) figures[f.id] = next[f.id]; drawPads(); sync(); onSave(); };
  const clear = btn('ぜんぶ消す', async () => {
    if (!(await confirmDlg('図にかいた線をぜんぶ消します。（「ひとつ戻す」で元に戻せます）', '消す', true))) return;
    replaceAll(Object.fromEntries(FIGURES.map((f) => [f.id, []]))); }, 'chip nofull');
  const revert = btn('開く前に戻す', async () => {
    if (!(await confirmDlg('この画面を開いたあとにかいた・消した分をやめて、開く前の図に戻します。（「ひとつ戻す」で元に戻せます）', '開く前に戻す', true))) return;
    replaceAll(JSON.parse(JSON.stringify(atOpen))); }, 'chip nofull');
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
      chips([{ id: 'both', name: 'ならべる' }, { id: 'front', name: '前だけ' }, { id: 'back', name: '後ろだけ' }], view, { multi: false, cls: 'viewsel', onChange: setView }),
      chips([{ id: 'all', name: '全体' }, { id: 'top', name: '上半身' }, { id: 'bottom', name: '下半身' }], zone, { multi: false, cls: 'zonesel', onChange: (z) => { zone = z || 'all'; if (zone !== 'all' && view === 'both') view = 'front'; drawView(); drawPads(); } }),
      under ? chips([{ id: 'on', name: under.label }], showUnder ? ['on'] : [], { cls: 'undersel', onChange: (x) => { showUnder = x.length > 0; drawPads(); } }) : null);
    fill(fullView, chips([...(isPhone() ? [] : [{ id: 'both', name: 'ならべる' }]), { id: 'front', name: '前' }, { id: 'back', name: '後ろ' }], view, { multi: false, cls: 'seg', onChange: setView }));
  };
  const fullBtn = btn('⤢ 画面いっぱいでかく', () => setFull(true), 'chip fullbtn');
  const setFull = (on) => {
    full = on; root.classList.toggle('full', on); document.documentElement.classList.toggle('noscroll', on);
    if (on && isPhone() && view === 'both') view = 'front';
    drawView(); drawPads();
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
      h('div', { class: 'trow' }, label('ペンの太さ'), h('div', { class: 'chips widths' }, widthBtns), label('直す'), h('div', { class: 'chips fixes' }, undo, simple ? null : eraser, clear, simple ? null : revert)),
      h('div', { class: 'trow' }, label('見え方'), h('div', { class: 'chips fullwrap' }, fullBtn), viewBox)),
    h('div', { class: 'zu-main' }, btn('⤢ 画面いっぱいでかく（なぞりやすい）', () => setFull(true), 'primary wide openfull'), now, padBox,
      hints.map((t) => h('p', { class: 'hint center' }, t))));
  return root;
}
