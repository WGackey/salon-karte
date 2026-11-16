// 画面を組み立てる小さな部品。
// いま使っている端末の呼び名（画面の説明に使う）。iPad は Mac のふりをすることがあるので、タッチできるかも見る
const ua = navigator.userAgent || '';
export const DEVICE = /iPhone|iPod/.test(ua) ? 'iPhone' : (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) ? 'iPad' : 'この端末';
export const HERE = DEVICE === 'この端末' ? 'この端末' : 'この ' + DEVICE; // 「この iPad」「この端末」
export const isPhone = () => matchMedia('(max-width: 700px)').matches;
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') { for (const [n, x] of Object.entries(v)) n.startsWith('--') ? el.style.setProperty(n, x) : (el.style[n] = x); }
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  add(el, kids); return el;
}
function add(el, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) add(el, k); else el.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
}
// 中身を入れ替える（null は入れない）
export function fill(el, ...kids) { el.replaceChildren(); add(el, kids); return el; }
export const btn = (label, onclick, cls = '') => h('button', { type: 'button', class: 'btn ' + cls, onclick }, label);

export function toast(msg) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = h('div', { class: 'toast', role: 'status' }, msg); document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}
// 下から出るパネル。close() で閉じる
export function sheet(title, content, { wide = false, onClose } = {}) {
  const close = () => { if (!wrap.isConnected) return; wrap.remove(); onClose && onClose(); };
  const wrap = h('div', { class: 'overlay', onclick: (e) => { if (e.target === wrap) close(); } },
    h('div', { class: 'sheet' + (wide ? ' wide' : '') },
      h('div', { class: 'sheet-head' }, h('h2', null, title), btn('とじる', close, 'ghost')),
      h('div', { class: 'sheet-body' }, content)));
  document.body.append(wrap); return { close, el: wrap };
}
export function confirmDlg(msg, okLabel = 'はい', danger = false) {
  return new Promise((res) => {
    const end = (v) => { wrap.remove(); res(v); };
    const wrap = h('div', { class: 'overlay center' },
      h('div', { class: 'dialog' }, h('p', null, msg),
        h('div', { class: 'row end' }, btn('やめる', () => end(false), 'ghost'), btn(okLabel, () => end(true), danger ? 'danger' : 'primary'))));
    document.body.append(wrap);
  });
}
// えらぶボタンの集まり。items: [{id,name,color?}] か文字の並び
export function chips(items, selected, { multi = true, onChange, cls = '' } = {}) {
  const sel = new Set(Array.isArray(selected) ? selected : selected ? [selected] : []);
  const wrap = h('div', { class: 'chips ' + cls });
  for (const it of items) {
    const id = typeof it === 'string' ? it : it.id; const name = typeof it === 'string' ? it : it.name;
    const b = h('button', { type: 'button', class: 'chip' + (sel.has(id) ? ' on' : ''), 'aria-pressed': sel.has(id) ? 'true' : 'false' },
      it.color ? h('span', { class: 'dot', style: { background: it.color } }) : null, name);
    b.onclick = () => {
      if (multi) { sel.has(id) ? sel.delete(id) : sel.add(id); } else { const was = sel.has(id); sel.clear(); if (!was) sel.add(id); }
      wrap.querySelectorAll('.chip').forEach((c, i) => {
        const cid = typeof items[i] === 'string' ? items[i] : items[i].id;
        c.classList.toggle('on', sel.has(cid)); c.setAttribute('aria-pressed', sel.has(cid) ? 'true' : 'false');
      });
      onChange && onChange(multi ? [...sel] : ([...sel][0] || ''));
    };
    wrap.append(b);
  }
  return wrap;
}
export const field = (label, input, hint) => h('label', { class: 'field' }, h('span', { class: 'label' }, label), input, hint ? h('span', { class: 'hint' }, hint) : null);
export const group = (label, content, hint) => h('div', { class: 'field' }, h('span', { class: 'label' }, label), content, hint ? h('span', { class: 'hint' }, hint) : null);
// obj[key] につながった入力らん
export function input(obj, key, { type = 'text', placeholder = '', onInput, inputmode, cls = '' } = {}) {
  const el = h('input', { type, class: 'input ' + cls, value: obj[key] ?? '', placeholder, inputmode, autocomplete: 'off' });
  el.oninput = () => { obj[key] = type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value; onInput && onInput(); };
  return el;
}
export function textarea(obj, key, { placeholder = '', onInput, rows = 3 } = {}) {
  const el = h('textarea', { class: 'input', rows, placeholder }); el.value = obj[key] ?? '';
  el.oninput = () => { obj[key] = el.value; onInput && onInput(); };
  return el;
}
// ひとつの画面のわく
export function page({ title, sub, back, actions, body, footer, cls = '', badgeEl }) {
  return h('div', { class: 'page ' + cls },
    h('header', { class: 'bar' },
      back ? h('a', { class: 'back', href: back, 'aria-label': 'もどる' }, '‹ もどる') : h('span', { class: 'back' }),
      h('div', { class: 'bar-title' }, h('h1', null, title), sub ? h('span', { class: 'sub' }, sub) : null, badgeEl || null),
      h('div', { class: 'bar-actions' }, actions || null)),
    h('main', { class: 'main' }, body),
    footer ? h('footer', { class: 'foot' }, footer) : null);
}
// 「自動で保存済み」のしるし。入力すると「保存しています…」→ 書き終わると「保存済み」に変わる
export function saveBadge() {
  const el = h('span', { class: 'savebadge' }, '✓ 自動で保存済み');
  let seen = false;
  const on = (e) => { if (el.isConnected) seen = true; else if (seen) { removeEventListener('savestate', on); return; } el.textContent = e.detail.busy ? '… 保存しています' : '✓ 自動で保存済み'; el.classList.toggle('busy', e.detail.busy); };
  addEventListener('savestate', on); return el;
}
export const AUTO_NOTE = () => h('p', { class: 'hint autosave' }, '✓ この画面は、直すとすぐ自動で保存されます（保存ボタンはありません）。');
export const card = (...kids) => h('section', { class: 'card' }, kids);
export const badge = (text, cls = '') => h('span', { class: 'badge ' + cls }, text);
export const go = (hash) => { location.hash = hash; };
