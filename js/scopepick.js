// 「今日のメニュー」と「施術するところ（全身／部分）」をえらぶ部品。来店の問診の上と、お客さんに渡す前の確かめで使う。
import { h, fill, chips } from './ui.js';
import { S } from './state.js';
import { PART_FIGS, FIGS, isPart, scopeParts, scopeText, figIdsOf, areaForScope, scopeFromMenus } from './parts.js';

const WHOLE = { type: 'whole' };
const partItems = () => Object.keys(PART_FIGS).map((id) => ({ id, name: (S.settings.parts.find((p) => p.id === id) || { name: id }).name }));
// 全身／部位のボタン。none=true なら「決めない」も選べる（メニューの設定用）。onChange(scope か null)
export function scopeChips(scope, onChange, { none = false } = {}) {
  const wrap = h('div', { class: 'chips scopesel' }); let cur = scope && (scope.type === 'whole' || isPart(scope)) ? scope : (none ? null : WHOLE);
  const set = (next) => { cur = next; draw(); onChange(cur); };
  const draw = () => {
    const parts = scopeParts(cur);
    const mk = (name, on, fn, cls = '') => { const b = h('button', { type: 'button', class: 'chip ' + cls + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false' }, name); b.onclick = fn; return b; };
    fill(wrap,
      none ? mk('決めない', !cur, () => set(null), 'ghostchip') : null,
      mk('全身', !!cur && cur.type === 'whole', () => set(none && cur && cur.type === 'whole' ? null : WHOLE), 'wholechip'),
      h('span', { class: 'small muted' }, '部分：'),
      partItems().map((p) => mk(p.name, parts.includes(p.id), () => {
        const next = parts.includes(p.id) ? parts.filter((x) => x !== p.id) : Object.keys(PART_FIGS).filter((x) => x === p.id || parts.includes(x));
        set(next.length ? { type: 'part', parts: next } : (none ? null : WHOLE));
      })));
  };
  draw();
  wrap.set = (sc) => { cur = sc; draw(); };
  return wrap;
}
// target：{ menus:[{id,name,minutes}], scope }（来店そのもの、または渡す前の仮の入れ物）。変えると onChange(scope が変わったか)
export function scopePicker(target, onChange) {
  target.menus = target.menus || []; target.scope = target.scope || WHOLE;
  const info = h('p', { class: 'hint scopeinfo' });
  const same = (a, b) => JSON.stringify(figIdsOf(a)) === JSON.stringify(figIdsOf(b));
  const tell = () => {
    const area = S.settings.areas.find((a) => a.id === areaForScope(S.settings, target.scope));
    fill(info, isPart(target.scope) ? [h('b', null, `部分（${scopeText(S.settings, target.scope)}）`), `　図：${figIdsOf(target.scope).map((id) => FIGS[id].name).join('・')}`,
      area ? `　／　濃度の目安：${area.name}${area.max != null ? `（${area.max}％まで）` : '（目安なし）'}` : '', '　／　問診は短い版になります']
      : [h('b', null, '全身'), '　図：前・後ろ']);
  };
  const setScope = (sc) => { const changed = !same(sc, target.scope); target.scope = sc; sc_.set(sc); tell(); onChange(changed); };
  const menuBox = h('div', { class: 'chips' });
  const drawMenus = () => fill(menuBox, ...S.menus.map((m) => {
    const on = target.menus.some((x) => x.id === m.id);
    const b = h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false' }, `${m.name}${m.minutes ? ` ${m.minutes}分` : ''}`, m.scope ? h('span', { class: 'chipsub' }, scopeText(S.settings, m.scope)) : null);
    b.onclick = () => {
      target.menus = on ? target.menus.filter((x) => x.id !== m.id) : [...target.menus, { id: m.id, name: m.name, minutes: m.minutes }];
      drawMenus();
      const sc = scopeFromMenus(target.menus.map((x) => S.menus.find((y) => y.id === x.id)).filter(Boolean)); // メニューに「施術するところ」が決めてあれば、それに合わせる
      if (sc) setScope(sc); else onChange(false);
    };
    return b;
  }), S.menus.length ? null : h('span', { class: 'muted' }, 'メニューは 設定 → 施術メニュー で作れます'));
  const sc_ = scopeChips(target.scope, (sc) => setScope(sc || WHOLE));
  drawMenus(); tell();
  return h('div', { class: 'scopepick' },
    h('div', { class: 'field' }, h('span', { class: 'label' }, '今日のメニュー'), menuBox),
    h('div', { class: 'field' }, h('span', { class: 'label' }, '施術するところ'), sc_, info));
}
