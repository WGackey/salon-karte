// 経過のページ。お客さんごとに、つらさ（前→後）・使ったブレンド・濃度・メニュー・部位を、回ごとに並べて見る。
// 図（線）は自分で描く（外の部品は読みこまない）。色だけにたよらない：前＝輪・後＝ぬった丸、凡例つき、下に同じ中身の一覧。
import { h, fill, page, card, btn, badge, chips } from '../ui.js';
import { S, person, visitsOf } from '../state.js';
import { jpDate, progressRows, blendGroups, limitFor, limitLevel } from '../logic.js';
import { isPart, scopeText } from '../parts.js';
import { notFound } from './customer.js';

const NS = 'http://www.w3.org/2000/svg';
const C_BEFORE = '#c8622e', C_AFTER = '#2f6fb5'; // 見分けやすさを道具で確かめた2色（色の見え方がちがう人にも）
const el = (tag, attrs, text) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; };
const md = (s) => { const [, m, d] = s.split('-').map(Number); return `${m}/${d}`; };
const sgn = (n) => (n > 0 ? `▼${n}` : n < 0 ? `▲${-n}` : '±0');

// つらさの動きの図。rows：古い順。symId：見る症状。onPick(row)：回を押したとき
function chart(rows, symId, picked, onPick) {
  const pts = rows.map((r) => ({ r, s: r.syms.find((x) => x.id === symId) })).filter((x) => x.s);
  if (!pts.length) return h('p', { class: 'muted' }, 'この症状の記録はまだありません');
  const L = 40, R = 26, T = 22, B = 46, H = 230;
  const step = Math.max(62, Math.min(130, (Math.min(innerWidth, 1100) - 90 - L - R - 20) / Math.max(pts.length - 1, 1))); // 回が少ないときは横に広げる。多いときは横にめくる const W = L + R + Math.max(pts.length - 1, 1) * step + 20;
  const W = L + R + Math.max(pts.length - 1, 1) * step + 20;
  const x = (i) => L + 10 + (pts.length === 1 ? 0 : i * step), y = (v) => T + (H - T - B) * (1 - v / 10);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'pchart', role: 'img', 'aria-label': 'つらさの動き（前と後）' });
  for (const g of [0, 5, 10]) { svg.append(el('line', { x1: L - 6, x2: W - 8, y1: y(g), y2: y(g), class: 'pgrid' + (g === 0 ? ' base' : '') })); svg.append(el('text', { x: L - 12, y: y(g) + 5, class: 'paxis', 'text-anchor': 'end' }, String(g))); }
  const line = (get, cls, color) => { // 記録のない回をまたいでも、線はつなぐ（その症状を聞いた回どうし）
    const ps = pts.map((p, i) => [x(i), get(p)]).filter((p) => p[1] != null); if (ps.length < 2) return;
    svg.append(el('path', { d: ps.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${y(p[1])}`).join(''), class: 'pline ' + cls, stroke: color }));
  };
  pts.forEach((p, i) => { if (p.s.after != null && p.s.after !== p.s.before) svg.append(el('line', { x1: x(i), x2: x(i), y1: y(p.s.before), y2: y(p.s.after), class: 'pdrop' })); });
  line((p) => p.s.before, 'before', C_BEFORE); line((p) => p.s.after, 'after', C_AFTER);
  pts.forEach((p, i) => {
    const on = picked && picked.id === p.r.id;
    if (on) svg.append(el('rect', { x: x(i) - step / 2 + 4, y: 4, width: step - 8, height: H - 8, rx: 10, class: 'ppick' }));
    svg.append(el('circle', { cx: x(i), cy: y(p.s.before), r: 6, class: 'pdot before', stroke: C_BEFORE }));
    if (p.s.after != null) svg.append(el('circle', { cx: x(i), cy: y(p.s.after), r: 6, class: 'pdot after', fill: C_AFTER }));
    svg.append(el('text', { x: x(i), y: H - B + 20, class: 'pxl', 'text-anchor': 'middle' }, md(p.r.date)));
    svg.append(el('text', { x: x(i), y: H - B + 36, class: 'pxl sub', 'text-anchor': 'middle' }, `${p.r.nth}回目`));
    if (on || i === pts.length - 1) { // 数字は、えらんだ回と いちばん新しい回だけ（全部には書かない）
      svg.append(el('text', { x: x(i) + 10, y: y(p.s.before) - 8, class: 'pval' }, String(p.s.before)));
      if (p.s.after != null && p.s.after !== p.s.before) svg.append(el('text', { x: x(i) + 10, y: y(p.s.after) + 16, class: 'pval' }, String(p.s.after)));
    }
    const hit = el('rect', { x: x(i) - step / 2, y: 0, width: step, height: H, fill: 'transparent', class: 'phit' }); hit.addEventListener('click', () => onPick(p.r)); svg.append(hit);
  });
  const wrap = h('div', { class: 'pscroll' }, svg);
  requestAnimationFrame(() => { wrap.scrollLeft = wrap.scrollWidth; }); // 新しい回（右はし）が見えるように
  return wrap;
}

export async function progressView(id) {
  const p = person(id); if (!p) return notFound();
  const visits = await visitsOf(id); const st = S.settings; const dropMl = st.dropMl || 0.05;
  const rows = progressRows(visits, dropMl); // 古い順
  const symName = (sid) => (st.symptoms.find((c) => c.id === sid) || {}).name || '（消した症状）';
  // 出てくる症状を、回数の多い順に
  const cnt = {}; for (const r of rows) for (const s of r.syms) cnt[s.id] = (cnt[s.id] || 0) + 1;
  const symIds = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
  let sym = symIds[0] || ''; let picked = null; let sort = 'new';
  const chartBox = h('div'); const pickBox = h('div'); const listBox = h('div', { class: 'plist' });
  const blendOf = (r) => [r.oils.map((o) => `${o.name} ${o.drops}滴`).join('・'), r.carriers.map((c) => `${c.name} ${c.ml}ml`).join('・')].filter(Boolean);
  const pctEl = (r) => { if (r.pct == null) return null; const lv = limitLevel(r.pct, limitFor(st, r.areaId, []).max); return h('span', { class: 'hpct ' + lv }, `${r.pct.toFixed(1)}％`); };
  const symLine = (s) => h('div', { class: 'psym' + (s.id === sym ? ' on' : '') }, h('span', { class: 'pname' }, symName(s.id)), h('b', null, `${s.before}${s.after != null ? ' → ' + s.after : ''}`),
    s.after != null ? h('span', { class: s.after < s.before ? 'down' : s.after > s.before ? 'up' : 'muted' }, ' ' + sgn(s.before - s.after)) : h('span', { class: 'muted small' }, '（後は未記入）'));
  const drawPick = () => fill(pickBox, picked ? h('div', { class: 'ppicked' },
    h('div', { class: 'row' }, h('b', null, jpDate(picked.date)), h('span', { class: 'muted' }, `${picked.nth}回目`), isPart(picked.scope) ? badge(scopeText(st, picked.scope), 'part') : null),
    picked.syms.map(symLine),
    blendOf(picked).length ? h('div', null, h('span', { class: 'muted small' }, 'ブレンド　'), blendOf(picked).join(' ／ '), ' ', pctEl(picked)) : h('div', { class: 'muted' }, 'ブレンドの記録なし'),
    h('div', { class: 'row' }, h('a', { class: 'btn', href: `#/v/${picked.id}/monshin` }, 'この回のカルテを開く ›'), h('a', { class: 'btn ghost', href: `#/c/${id}?k=${rows.length - picked.nth}` }, 'この回を「これまでの記録」で見る'))) : h('p', { class: 'hint' }, '図の中の回を押すと、その回のつらさ・ブレンドが下に出ます。'));
  const drawChart = () => fill(chartBox, chart(rows, sym, picked, (r) => { picked = picked && picked.id === r.id ? null : r; drawChart(); drawPick(); }));
  const rowEl = (r) => h('a', { class: 'prow', href: `#/v/${r.id}/monshin` },
    h('div', { class: 'pc date' }, h('b', null, jpDate(r.date, false)), h('div', { class: 'muted small' }, `${r.date.slice(0, 4)}年・${r.nth}回目`),
      h('div', { class: 'chips tight' }, isPart(r.scope) ? badge(scopeText(st, r.scope), 'part') : badge('全身', 'draft'), r.status === 'draft' ? badge('書きかけ', 'amber') : null)),
    h('div', { class: 'pc sym' }, h('span', { class: 'plabel' }, 'つらさ（前→後）'), r.syms.length ? r.syms.map(symLine) : h('span', { class: 'muted' }, '—'),
      r.drop != null && r.syms.length > 1 ? h('div', { class: 'ptotal' }, '合わせて ', h('span', { class: r.drop > 0 ? 'down' : r.drop < 0 ? 'up' : 'muted' }, sgn(r.drop))) : null),
    h('div', { class: 'pc blend' }, h('span', { class: 'plabel' }, 'ブレンド'), blendOf(r).length ? blendOf(r).map((t) => h('div', null, t)) : h('span', { class: 'muted' }, '—'), r.pct != null ? h('div', null, h('span', { class: 'muted small' }, '濃度 '), pctEl(r)) : null),
    h('div', { class: 'pc etc' }, h('span', { class: 'plabel' }, 'メニュー・施術後'), r.menus.length ? h('div', null, r.menus.map((m) => `${m.name}${m.minutes ? m.minutes + '分' : ''}`).join('・')) : null,
      r.scent ? h('div', { class: 'small' }, `香り：${r.scent}`) : null, r.note ? h('div', { class: 'small muted pnote' }, r.note) : null, !r.menus.length && !r.scent && !r.note ? h('span', { class: 'muted' }, '—') : null),
    h('span', { class: 'chev' }, '›'));
  const drawList = () => {
    const arr = sort === 'new' ? [...rows].reverse() : [...rows].filter((r) => r.drop != null).sort((a, b) => b.drop - a.drop || b.date.localeCompare(a.date));
    fill(listBox, ...arr.map(rowEl), arr.length ? null : h('p', { class: 'muted' }, '施術後のつらさが入っている回が、まだありません'));
  };
  drawChart(); drawPick(); drawList();
  const groups = blendGroups(rows);
  return page({
    title: `${p.name} さんの経過`, sub: `ぜんぶで ${rows.length}回`, back: `#/c/${id}`, cls: 'progress',
    body: rows.length === 0 ? h('p', { class: 'muted pad' }, 'まだ来店の記録がありません') : [
      card(h('h2', null, 'つらさの動き'),
        symIds.length ? [h('p', { class: 'hint' }, '見たい症状をえらびます（左が古い回・右が新しい回。0＝つらさなし、10＝とてもつらい）'),
          chips(symIds.map((sid) => ({ id: sid, name: `${symName(sid)}（${cnt[sid]}回）` })), sym, { multi: false, cls: 'tight symsel', onChange: (x) => { if (x) sym = x; drawAll(); } }),
          h('div', { class: 'plegend' }, h('span', null, h('i', { class: 'lgd before', style: { borderColor: C_BEFORE } }), '施術の前'), h('span', null, h('i', { class: 'lgd after', style: { background: C_AFTER } }), '施術の後'), h('span', { class: 'muted small' }, 'たての線＝その回で変わった分')),
          chartBox, pickBox] : h('p', { class: 'muted' }, '問診で「つらいところ」をえらぶと、ここに動きが出ます。')),
      groups.length ? card(h('h2', null, 'ブレンドごとのまとめ'), h('p', { class: 'hint' }, '同じ精油の組み合わせの回をまとめています（滴数はちがってもいっしょ）。つらさの変化は、その日の体調や施術でも変わるので、目安として見てね。'),
        h('div', { class: 'pgroups' }, groups.slice(0, 8).map((g) => h('div', { class: 'pgroup' },
          h('div', { class: 'grow' }, h('b', null, g.names.join('・')), h('div', { class: 'muted small' }, `${g.n}回（いちばん新しい：${jpDate(g.last, false)}）${g.pcts.length ? `・濃度 ${Math.min(...g.pcts).toFixed(1)}${Math.max(...g.pcts) - Math.min(...g.pcts) > 0.05 ? '〜' + Math.max(...g.pcts).toFixed(1) : ''}％` : ''}`)),
          h('div', { class: 'pavg' }, g.avg == null ? h('span', { class: 'muted small' }, '施術後は未記入') : [h('span', { class: 'muted small' }, 'つらさの変化（1回あたり）'), h('b', { class: g.avg > 0 ? 'down' : g.avg < 0 ? 'up' : 'muted' }, g.avg > 0 ? `▼${g.avg.toFixed(1)}` : g.avg < 0 ? `▲${(-g.avg).toFixed(1)}` : '±0')])))),
        groups.length > 8 ? h('p', { class: 'muted small' }, `ほか ${groups.length - 8} 通り`) : null) : null,
      card(h('h2', null, '回ごとの一覧'),
        chips([{ id: 'new', name: '新しい順' }, { id: 'drop', name: 'つらさが下がった順' }], sort, { multi: false, cls: 'tight sortsel', onChange: (x) => { sort = x || 'new'; sortFix(); drawList(); } }),
        listBox),
    ],
  });
  // えらぶボタンは「もう一度押しても外れない」ように、見た目を合わせ直す
  function drawAll() { document.querySelectorAll('.symsel .chip').forEach((c, i) => c.classList.toggle('on', symIds[i] === sym)); picked = null; drawChart(); drawPick(); drawList(); }
  function sortFix() { document.querySelectorAll('.sortsel .chip').forEach((c, i) => c.classList.toggle('on', ['new', 'drop'][i] === sort)); }
}
