import { h, fill, page, card, btn, badge, go, chips, field, group, input, textarea, toast, confirmDlg, sheet, DEVICE, AUTO_NOTE } from '../ui.js';
import { S, saveSettings, saveMaster, deleteMaster, reload } from '../state.js';
import * as db from '../db.js';
import { todayStr, daysBetween, ymd, jpDate, TRAITS } from '../logic.js';
import { makeBackupText, readBackupHead, restoreBackup, handOver } from '../backup.js';
import { addSamples, removeSamples } from '../sample.js';
import { notFound } from './customer.js';
import { APP_VERSION } from '../version.js';

const link = (href, title, desc) => h('a', { class: 'row-link', href }, h('div', { class: 'grow' }, h('div', { class: 'name' }, title), h('div', { class: 'muted' }, desc)), h('span', { class: 'chev' }, '›'));
const fam = (id) => S.settings.families.find((f) => f.id === id) || { name: '', color: '#bbb' };
const numIn = (obj, key, opt = {}) => input(obj, key, { type: 'number', inputmode: 'decimal', cls: 'num', ...opt });
const DRAFT_NOTE = (from = '一般に言われている内容をまとめたもの') => h('div', { class: 'notice draft' }, `はじめから入っている中身は「下書き」です（${from}）。自分の資料で確かめて直し、「確かめた」にしるしをつけてください。`);
const AROMA_SRC = 'アロマテラピーを学んだときの資料をもとに入れたもの';

export function settingsView() {
  const own = S.oils.filter((o) => o.owned).length;
  return page({
    title: '設定', back: '#/', body: [
      card(h('h2', null, 'アロマ'), h('div', { class: 'list' },
        link('#/set/oils', '精油の一覧と手持ち', `${S.oils.length}本（手持ち ${own}本）`),
        link('#/set/carriers', 'キャリアオイルの一覧と手持ち', `${S.carriers.length}種類（手持ち ${S.carriers.filter((o) => o.owned).length}種類）`),
        link('#/set/limits', '濃度の目安・1滴の量', '部位ごと・お客さんの状態ごとの上限'),
        link('#/set/symacts', 'つらいところと作用のつながり（重み）', '候補の1段目：つらいところ → 作用。重みに差をつけられる'),
        link('#/set/actions', '作用（働き）の一覧', `${(S.settings.actions || []).length}個。資料の作用の名前をまとめたもの`),
        link('#/set/cats', '精油の成分の分類と成分（作用・気をつける状態）', '候補の2段目：作用 → 成分。分類ごとの注意'),
        link('#/set/rules', '外す決まり（割合・年齢）', `気をつける成分が ${S.settings.cautionPct ?? 10}％以上・割合が分からないとき・年齢`),
        link('#/set/fats', 'キャリアオイルの成分（向いている肌の状態）', 'キャリアオイルの候補を出すもとになる表'))),
      card(h('h2', null, 'カルテ'), h('div', { class: 'list' },
        link('#/set/menus', '施術メニュー', `${S.menus.length}個`),
        link('#/set/lists', 'えらぶ言葉を直す', '症状・肌の状態・アレルギー・目的・香りの好み・お仕事 など'),
        link('#/set/salon', 'お店の名前', S.settings.salonName || '（まだ入っていません）'))),
      card(h('h2', null, 'データ'), h('div', { class: 'list' },
        link('#/set/backup', 'バックアップ（書き出し・戻し）', `データは この ${DEVICE} の中だけにあります。こまめに書き出してね`),
        link('#/set/sample', '見本のデータ', '速さを試すための、作りもののお客さん'),
        link('#/set/about', 'このアプリについて', `版 ${APP_VERSION}`))),
    ],
  });
}

// ---- 精油 ----
export function oilsView() {
  const list = h('div', { class: 'list' });
  const draw = () => fill(list, ...[...S.oils].sort((a, b) => a.name.localeCompare(b.name, 'ja')).map((o) => {
    const sw = h('button', { type: 'button', class: 'mini big' + (o.owned ? ' on' : ''), 'aria-pressed': String(!!o.owned) }, o.owned ? '✓ 手持ち' : '持っていない');
    sw.onclick = async () => { o.owned = !o.owned; await saveMaster('oils', o); draw(); };
    return h('div', { class: 'row-link', style: { '--fam': fam(o.family).color } },
      h('a', { class: 'grow famline', href: `#/set/oil/${o.id}` }, h('div', { class: 'name' }, o.name, ' ', o.ref === false ? badge('資料にない', 'amber') : o.draft ? badge('下書き', 'draft') : badge('確かめた', 'ok')), h('div', { class: 'muted' }, [fam(o.family).name || '系統は未記入', o.plant].filter(Boolean).join('・'))), sw);
  }));
  draw();
  return page({ title: '精油の一覧と手持ち', back: '#/set', actions: h('a', { class: 'btn', href: '#/set/oil/new' }, '＋ 足す'),
    body: [h('div', { class: 'notice draft' }, 'はじめの30本は、アロマテラピーを学んだときの資料をもとに入れたものです（「下書き」のしるしつき）。自分の資料で確かめたら、中身の画面で「確かめた」にしるしをつけてください。「資料にない」は前の下書きにあった精油で、候補の点数には入れていません。'),
      h('p', { class: 'hint' }, '持っている精油の右のボタンを押すと「手持ち」になります（すぐ保存されます）。名前を押すと中身を直せます。'), list] });
}
export function oilEditView(id) {
  const isNew = id === 'new'; const st = S.settings;
  const o = isNew ? { id: db.uid(), name: '', family: '', plant: '', components: {}, subs: [], actions: [], uses: [], okConds: [], cautions: [], warns: [], allergens: [], note: '', owned: true, draft: false } : JSON.parse(JSON.stringify(S.oils.find((x) => x.id === id) || null));
  if (!o) return notFound();
  o.components = o.components || {}; for (const k of ['subs', 'actions', 'uses', 'okConds', 'cautions', 'warns', 'allergens']) o[k] = o[k] || [];
  const has = (k) => Object.prototype.hasOwnProperty.call(o.components, k);
  const total = h('span', { class: 'muted' });
  const sum = () => { const t = S.cats.reduce((s2, c) => s2 + (typeof o.components[c.id] === 'number' ? o.components[c.id] : 0), 0); total.textContent = `わかっている割合の合計 ${t}％${t > 100 ? '（100をこえています）' : ''}`; };
  // 成分の分類1つぶん：なし／入っている（割合を入れる・空けておける）／微量
  const compRow = (c) => {
    const box = h('div', { class: 'comprow' });
    const draw = () => {
      const state = !has(c.id) ? 'none' : o.components[c.id] === 'tr' ? 'tr' : 'yes';
      const num = h('input', { type: 'number', inputmode: 'decimal', class: 'input num', placeholder: '未記入', value: typeof o.components[c.id] === 'number' ? o.components[c.id] : '', disabled: state !== 'yes' });
      num.oninput = () => { o.components[c.id] = num.value === '' ? null : Number(num.value); sum(); };
      fill(box, h('div', { class: 'grow' }, c.name),
        chips([{ id: 'none', name: 'なし' }, { id: 'yes', name: '入っている' }, { id: 'tr', name: '微量' }], state, { multi: false, onChange: (x) => {
          if (!x || x === 'none') delete o.components[c.id]; else if (x === 'tr') o.components[c.id] = 'tr'; else if (!has(c.id) || o.components[c.id] === 'tr') o.components[c.id] = null;
          draw(); sum(); } }),
        h('span', { class: 'row tight' }, num, '％'));
    };
    draw(); return box;
  };
  sum();
  const save = async () => {
    if (!o.name.trim()) { toast('名前を入れてね'); return; }
    await saveMaster('oils', o); toast('保存しました'); go('#/set/oils');
  };
  const confirmBox = h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !o.draft, onchange: (e) => { o.draft = !e.target.checked; } }), '自分の資料で確かめた（「下書き」のしるしを外す）');
  const refBox = h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: o.ref !== false, onchange: (e) => { if (e.target.checked) delete o.ref; else o.ref = false; } }), '候補の点数に入れる（はずすと「資料にない」になり、気をつける点だけ見ます）');
  const condItems = st.conds;
  return page({
    title: isNew ? '精油を足す' : o.name, back: '#/set/oils', body: [
      o.draft ? DRAFT_NOTE(o.ref === false ? undefined : AROMA_SRC) : null,
      card(field('名前', input(o, 'name')), group('香りの系統', chips(st.families, o.family || '', { multi: false, onChange: (v) => { o.family = v || ''; } }), 'もう一度押すと外れます（未記入）'),
        field('植物の科（資料の「種類」）', input(o, 'plant', { placeholder: '未記入' })),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: o.owned, onchange: (e) => { o.owned = e.target.checked; } }), '手持ち（持っている）')),
      card(h('h2', null, '成分の分類と割合'), h('p', { class: 'hint' }, '資料に割合がないときは「入っている」にして、数字は空けたままに（もっともらしく埋めない）。'),
        S.cats.map(compRow), total),
      card(h('h2', null, '入っている成分（アロマ表）'), h('p', { class: 'hint' }, 'えらんだ成分の作用が、候補の「なぜ出たか」になります。'),
        S.cats.filter((c) => (c.subs || []).length).map((c) => group(c.name, chips(c.subs, o.subs, { onChange: (v) => { o.subs = [...o.subs.filter((x) => !c.subs.some((sb) => sb.id === x)), ...v]; } })))),
      card(group('この精油の作用（資料の「効能」）', chips(st.actions || [], o.actions, { onChange: (v) => { o.actions = v; } })),
        group('向いている場面（資料の「OK」・使いどころ）', chips(st.symptoms, o.uses, { onChange: (v) => { o.uses = v; } })),
        group('向いている状態（資料の「OK」）', chips(condItems, o.okConds, { onChange: (v) => { o.okConds = v; } }), '候補の「なぜ出たか」に出します。外す判定には使いません')),
      card(group('使わない状態（資料の「NG」）', chips(condItems, o.cautions, { onChange: (v) => { o.cautions = v; } }), 'あてはまるお客さんには、候補から外して理由を見せます'),
        group('気をつける状態（外さずに ⚠ をつける）', chips(condItems, o.warns, { onChange: (v) => { o.warns = v; } }), '例：「敏感肌（うすめればよい）」「アトピー（注意）」'),
        group('植物アレルギー（資料の「NG」）', chips(st.allergens, o.allergens, { onChange: (v) => { o.allergens = v; } })),
        field('メモ・注意', textarea(o, 'note'))),
      card(confirmBox, refBox),
      isNew ? null : h('div', { class: 'row end' }, btn('この精油を消す', async () => { if (await confirmDlg(`「${o.name}」を一覧から消します。これまでのカルテの記録は残ります。`, '消す', true)) { await deleteMaster('oils', o.id); go('#/set/oils'); } }, 'danger ghost')),
    ], footer: btn('保存する', save, 'primary big wide'),
  });
}

// ---- 名前だけの一覧を直す共通の画面（キャリアオイル・メニューなど） ----
function simpleList({ title, back, items, fields, blank, onSave, onDelete, hint, extra }) {
  const list = h('div');
  const draw = () => fill(list, ...items().map((it) => h('div', { class: 'edit-row' },
    fields.map((f) => f(it, () => onSave(it))),
    btn('×', async () => { if (await confirmDlg(`「${it.name || '（名前なし）'}」を消します。`, '消す', true)) { await onDelete(it); draw(); } }, 'ghost round'))));
  draw();
  return page({ title, back, body: [AUTO_NOTE(), hint ? h('p', { class: 'hint' }, hint) : null, list, h('div', { class: 'row' }, btn('＋ 足す', async () => { await onSave(blank()); draw(); })), extra || null] });
}
const nameField = (ph) => (it, save) => input(it, 'name', { placeholder: ph, onInput: save, cls: 'grow' });

// ---- キャリアオイル（精油と同じ作り） ----
export function carriersView() {
  const list = h('div', { class: 'list' });
  const draw = () => fill(list, ...[...S.carriers].sort((a, b) => a.name.localeCompare(b.name, 'ja')).map((o) => {
    const sw = h('button', { type: 'button', class: 'mini big' + (o.owned ? ' on' : ''), 'aria-pressed': String(!!o.owned) }, o.owned ? '✓ 手持ち' : '持っていない');
    sw.onclick = async () => { o.owned = !o.owned; await saveMaster('carriers', o); draw(); };
    return h('div', { class: 'row-link' },
      h('a', { class: 'grow', href: `#/set/carrier/${o.id}` }, h('div', { class: 'name' }, o.name || '（名前なし）', ' ', o.draft ? badge('下書き', 'draft') : badge('確かめた', 'ok')),
        h('div', { class: 'muted' }, TRAITS.map((t) => t.opts[((o.traits || {})[t.id] || 0) - 1]).filter(Boolean).join('・'))), sw);
  }));
  draw();
  return page({ title: 'キャリアオイルの一覧と手持ち', back: '#/set', actions: h('a', { class: 'btn', href: '#/set/carrier/new' }, '＋ 足す'),
    body: [DRAFT_NOTE(), h('p', { class: 'hint' }, '持っているオイルの右のボタンを押すと「手持ち」になります（すぐ保存されます）。名前を押すと中身を直せます。'), list] });
}
export function carrierEditView(id) {
  const isNew = id === 'new';
  const o = isNew ? { id: db.uid(), name: '', fatty: {}, traits: {}, skins: [], purposes: [], allergens: [], cautions: [], note: '', owned: true, draft: false } : JSON.parse(JSON.stringify(S.carriers.find((x) => x.id === id) || null));
  if (!o) return notFound();
  for (const k of ['fatty', 'traits']) o[k] = o[k] || {}; for (const k of ['skins', 'purposes', 'allergens', 'cautions']) o[k] = o[k] || [];
  const st = S.settings;
  const total = h('span', { class: 'muted' });
  const sum = () => { const t = st.fats.reduce((s, c) => s + (Number(o.fatty[c.id]) || 0), 0); total.textContent = `合計 ${t}％${t > 100 ? '（100をこえています）' : ''}`; };
  sum();
  const save = async () => {
    if (!o.name.trim()) { toast('名前を入れてね'); return; }
    for (const k of Object.keys(o.fatty)) if (o.fatty[k] == null || o.fatty[k] === '') delete o.fatty[k];
    await saveMaster('carriers', o); toast('保存しました'); go('#/set/carriers');
  };
  // 目的は言葉そのもので覚えている。言葉を直す前の古いものが残っていたら、外せるように一緒に出す
  const purposeItems = [...new Set([...st.purposes, ...o.purposes])];
  return page({
    title: isNew ? 'キャリアオイルを足す' : o.name, back: '#/set/carriers', body: [
      o.draft ? DRAFT_NOTE() : null,
      card(field('名前', input(o, 'name')),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: o.owned, onchange: (e) => { o.owned = e.target.checked; } }), '手持ち（持っている）')),
      card(h('h2', null, '成分ごとの割合（％）'), h('p', { class: 'hint' }, 'おおよその値でかまいません。産地や作り方でも変わります。分からないところは空けたままに。'),
        h('div', { class: 'grid2' }, st.fats.map((c) => field(c.name, numIn(o.fatty, c.id, { onInput: sum })))), total),
      card(h('h2', null, '特徴'), h('p', { class: 'hint' }, '分からないものは、えらばずに空けておけます（もう一度押すと外れます）。'),
        TRAITS.map((t) => group(t.name, chips(t.opts.map((name, i) => ({ id: i + 1, name })), o.traits[t.id] || '', { multi: false, onChange: (v) => { o.traits[t.id] = v || null; } })))),
      card(group('このオイルならではの「向いている肌の状態」', chips(st.skins, o.skins, { onChange: (v) => { o.skins = v; } })),
        group('向いている目的', chips(purposeItems, o.purposes, { onChange: (v) => { o.purposes = v; } }), '「えらぶ言葉」で目的の言葉を直したときは、ここもえらび直してね'),
        group('アレルギーのしるし（あてはまるお客さんには候補から外して知らせる）', chips(st.allergens, o.allergens, { onChange: (v) => { o.allergens = v; } })),
        group('気をつける状態（あてはまるお客さんには候補から外して知らせる）', chips(st.conds, o.cautions, { onChange: (v) => { o.cautions = v; } })),
        field('メモ・注意', textarea(o, 'note'))),
      card(h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !o.draft, onchange: (e) => { o.draft = !e.target.checked; } }), '自分の資料で確かめた（「下書き」のしるしを外す）')),
      isNew ? null : h('div', { class: 'row end' }, btn('このオイルを消す', async () => { if (await confirmDlg(`「${o.name}」を一覧から消します。これまでのカルテの記録は残ります。`, '消す', true)) { await deleteMaster('carriers', o.id); go('#/set/carriers'); } }, 'danger ghost')),
    ], footer: btn('保存する', save, 'primary big wide'),
  });
}
// キャリアオイルの成分（脂肪酸など）× 向いている肌の状態
export function fatsView() {
  const st = S.settings; const save = () => saveSettings();
  const box = h('div', { class: 'step' });
  const draw = () => fill(box, ...st.fats.map((c) => h('details', { class: 'card fold' }, h('summary', null, c.name || '（名前なし）', ' ', c.draft ? badge('下書き', 'draft') : badge('確かめた', 'ok')),
    field('名前', input(c, 'name', { onInput: save })),
    group('向いている肌の状態', chips(st.skins, c.uses, { onChange: (v) => { c.uses = v; save(); } })),
    field('メモ', textarea(c, 'note', { onInput: save, rows: 2 })),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !c.draft, onchange: (e) => { c.draft = !e.target.checked; save(); } }), '自分の資料で確かめた'),
    h('div', { class: 'row end' }, btn('この成分を消す', async () => { if (await confirmDlg(`「${c.name}」を消します。オイルごとに入れた割合は残りますが、候補には使われなくなります。`, '消す', true)) { st.fats = st.fats.filter((x) => x !== c); save(); draw(); } }, 'danger ghost')))),
  h('div', { class: 'row' }, btn('＋ 成分を足す', () => { st.fats.push({ id: db.uid(), name: '', uses: [], note: '', draft: false }); save(); draw(); })));
  draw();
  return page({
    title: 'キャリアオイルの成分', back: '#/set', body: [
      DRAFT_NOTE(), AUTO_NOTE(),
      h('p', { class: 'hint' }, '「向いている肌の状態」にえらんだものが問診にあると、その成分が多いキャリアオイルが候補に上がります。オイルごとの割合は 設定 → キャリアオイルの一覧 で直せます。'),
      box,
    ],
  });
}
export const menusView = () => simpleList({
  title: '施術メニュー', back: '#/set', items: () => S.menus, hint: 'メニューの名前と時間（分）を入れます。来店ごとにいくつでもえらべます。料金は入れません。',
  fields: [nameField('メニューの名前'), (it, save) => h('span', { class: 'row tight' }, numIn(it, 'minutes', { onInput: save }), '分')],
  blank: () => ({ id: db.uid(), name: '', minutes: 60 }), onSave: (it) => saveMaster('menus', it), onDelete: (it) => deleteMaster('menus', it.id),
});

// ---- 濃度の目安 ----
export function limitsView() {
  const st = S.settings; const save = () => saveSettings();
  const areaBox = h('div');
  const drawAreas = () => fill(areaBox, ...st.areas.map((a) => h('div', { class: 'edit-row' },
    input(a, 'name', { onInput: save, cls: 'grow', placeholder: '部位の名前' }),
    h('span', { class: 'row tight' }, numIn(a, 'max', { onInput: () => { delete a.draft; save(); }, placeholder: '空き' }), '％まで'),
    a.draft ? badge('下書き', 'draft') : null,
    btn('×', async () => { if (st.areas.length > 1 && await confirmDlg(`「${a.name}」を消します。`, '消す', true)) { st.areas = st.areas.filter((x) => x !== a); save(); drawAreas(); } }, 'ghost round'))));
  drawAreas();
  return page({
    title: '濃度の目安・1滴の量', back: '#/set', body: [
      AUTO_NOTE(),
      h('div', { class: 'notice draft' }, '濃度の目安は、流派や資料によってちがいます。はじめの「体 1％・顔 0.5％」は、よく言われている目安の下書きです。自分の資料で確かめて直してください（数字を直すと「下書き」のしるしが外れます）。空けたところは「目安なし」になります。'),
      card(h('h2', null, '濃度の出し方'), h('p', null, '濃度（％）＝ 精油の量 ÷ キャリアオイルの量 × 100'), h('p', { class: 'hint' }, '例：キャリアオイル 30ml に、精油 6滴（1滴 0.05ml なら 0.3ml）→ 1％。「この量なら○滴まで」も同じ式で出しています。')),
      card(h('h2', null, '部位ごとの上限'), areaBox, h('div', { class: 'row' }, btn('＋ 部位を足す', () => { st.areas.push({ id: db.uid(), name: '', max: null }); save(); drawAreas(); }))),
      card(h('h2', null, 'お客さんの状態ごとの上限'), h('p', { class: 'hint' }, 'あてはまるお客さんでは、部位の上限とくらべて低いほうを使います。はじめは空けてあります。'),
        st.conds.map((c) => h('div', { class: 'edit-row' }, h('div', { class: 'grow' }, c.name), h('span', { class: 'row tight' }, numIn(st.stateLimits, c.id, { onInput: () => { if (st.stateLimits[c.id] == null) delete st.stateLimits[c.id]; save(); }, placeholder: '空き' }), '％まで')))),
      card(h('h2', null, '1滴の量'), h('div', { class: 'row tight' }, numIn(st, 'dropMl', { onInput: () => { if (!(st.dropMl > 0)) return; save(); } }), 'ml'), h('p', { class: 'hint' }, 'びんの口（ドロッパー）によってちがいます。はじめは 0.05ml。')),
    ],
  });
}

// ---- 成分の分類（大分類）と成分（小分類） ----
export function catsView() {
  const st = S.settings; const acts = st.actions || [];
  return page({
    title: '成分の分類と成分', back: '#/set', body: [
      DRAFT_NOTE(AROMA_SRC), AUTO_NOTE(),
      h('p', { class: 'hint' }, '資料「アロマ表」の分け方です。成分ごとに「作用」をえらびます（候補の「作用 ← 成分」になります）。「使わない状態」にあてはまるお客さんには、その分類が入っている精油を外して理由を見せます。外す割合の決まりは 設定 → 外す決まり。'),
      S.cats.map((c) => {
        c.subs = c.subs || []; c.cautions = c.cautions || []; c.warns = c.warns || [];
        const save = () => saveMaster('cats', c);
        const subBox = h('div');
        const drawSubs = () => fill(subBox, ...c.subs.map((sb) => h('div', { class: 'subrow' },
          h('div', { class: 'row' }, input(sb, 'name', { onInput: save, cls: 'grow' }),
            btn('×', async () => { if (await confirmDlg(`成分「${sb.name}」を消します。精油ごとの「入っている成分」からも使われなくなります。`, '消す', true)) { c.subs = c.subs.filter((x) => x !== sb); save(); drawSubs(); } }, 'ghost round')),
          chips(acts, sb.actions || [], { onChange: (v) => { sb.actions = v; save(); } }))),
        h('div', { class: 'row' }, btn('＋ 成分を足す', () => { c.subs.push({ id: db.uid(), name: '', actions: [] }); save(); drawSubs(); })));
        drawSubs();
        return h('details', { class: 'card fold' }, h('summary', null, c.name, ' ', c.draft ? badge('下書き', 'draft') : badge('確かめた', 'ok')),
          field('名前', input(c, 'name', { onInput: save })),
          group('使わない状態（外す）', chips(st.conds, c.cautions, { onChange: (v) => { c.cautions = v; save(); } })),
          group('気をつける状態（外さずに ⚠）', chips(st.conds, c.warns, { onChange: (v) => { c.warns = v; save(); } })),
          field('だれに使うときも出す注意', input(c, 'tip', { onInput: save, placeholder: '例：かならずうすめて使う' })),
          field('メモ', textarea(c, 'note', { onInput: save, rows: 2 })),
          h('h3', null, '成分（小分類）と作用'), subBox,
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !c.draft, onchange: (e) => { c.draft = !e.target.checked; save(); } }), '自分の資料で確かめた'));
      }),
    ],
  });
}
// ---- 外す決まり（割合・年齢） ----
export function rulesView() {
  const st = S.settings; const save = () => saveSettings();
  st.ageRules = st.ageRules || { infant: null, child: null, old: null };
  const ar = st.ageRules;
  return page({
    title: '外す決まり', back: '#/set', body: [
      AUTO_NOTE(),
      card(h('h2', null, '成分の割合'), h('div', { class: 'row tight' }, '気をつける成分が', numIn(st, 'cautionPct', { onInput: save }), '％以上入っている精油を外す'),
        group('割合が分からないとき（資料に「入っている」とだけある）', chips([{ id: 'block', name: '外す（安全側）' }, { id: 'warn', name: '外さずに ⚠ をつける' }], st.unknownPct || 'block', { multi: false, onChange: (v) => { st.unknownPct = v || 'block'; save(); } }),
          'はじめは「外す」。資料に割合がない精油が多いので、⚠ にすると候補に残るものが増えます'),
        h('p', { class: 'hint' }, '「微量」と書いた成分では外しません。')),
      card(h('h2', null, '年齢で自動でつける状態'), h('p', { class: 'hint' }, 'お客さんの生年月日から、その日の年齢でつけます。資料に数字がないので、はじめは未記入（自動でつけない）です。入れると自動でつきます。'),
        h('div', { class: 'edit-row' }, h('div', { class: 'grow' }, '乳幼児'), h('span', { class: 'row tight' }, numIn(ar, 'infant', { onInput: () => { delete ar.draft; save(); }, placeholder: '未記入' }), '歳まで')),
        h('div', { class: 'edit-row' }, h('div', { class: 'grow' }, '子ども'), h('span', { class: 'row tight' }, numIn(ar, 'child', { onInput: () => { delete ar.draft; save(); }, placeholder: '未記入' }), '歳まで')),
        h('div', { class: 'edit-row' }, h('div', { class: 'grow' }, '高齢'), h('span', { class: 'row tight' }, numIn(ar, 'old', { onInput: () => { delete ar.draft; save(); }, placeholder: '未記入' }), '歳から')),
        null),
    ],
  });
}
// ---- 作用（働き）の一覧 ----
export function actionsView() {
  const st = S.settings; st.actions = st.actions || []; const save = () => saveSettings();
  const box = h('div');
  const draw = () => fill(box, ...st.actions.map((a) => h('div', { class: 'card' },
    h('div', { class: 'row' }, input(a, 'name', { onInput: save, cls: 'grow', placeholder: '作用の名前（ふだんの言葉で）' }),
      btn('×', async () => { if (await confirmDlg(`作用「${a.name}」を消します。成分・精油・つらいところとのつながりも使われなくなります。`, '消す', true)) { st.actions = st.actions.filter((x) => x !== a); save(); draw(); } }, 'ghost round')),
    field('資料での呼び方', input(a, 'terms', { onInput: save, placeholder: '例：鎮静・神経安定' })))),
  h('div', { class: 'row' }, btn('＋ 作用を足す', () => { st.actions.push({ id: db.uid(), name: '', terms: '' }); save(); draw(); })));
  draw();
  return page({ title: '作用（働き）の一覧', back: '#/set', body: [AUTO_NOTE(),
    h('p', { class: 'hint' }, '資料にある作用の名前を、ふだんの言葉のまとまりに分けたものです。「こんな働きがあると言われる」という分け方で、「効く」という意味ではありません。お客さんに見せる言葉にも使います。'), box] });
}
// ---- つらいところ → 作用 の重み ----
export function symActsView() {
  const st = S.settings; const acts = st.actions || []; const save = () => saveSettings();
  const W = [{ id: '0', name: 'なし' }, { id: '1', name: '少し' }, { id: '2', name: 'とても' }];
  return page({ title: 'つらいところと作用', back: '#/set', body: [AUTO_NOTE(),
    h('div', { class: 'notice draft' }, 'はじめの重みは下書きです。「とても」は「少し」の2倍の点になります。触ってみて、候補の並びがしっくりこなければ直してね。'),
    st.symptoms.map((sy) => {
      sy.acts = sy.acts || {};
      const sumEl = h('span', { class: 'muted small sumline' });
      const upd = () => { sumEl.textContent = acts.filter((a) => sy.acts[a.id] > 0).map((a) => `${a.name}${sy.acts[a.id] >= 2 ? '◎' : '○'}`).join('・') || 'まだつながっていません'; };
      upd();
      return h('details', { class: 'card fold' }, h('summary', { class: 'wrap' }, h('span', null, sy.name || '（名前なし）'), sumEl),
        acts.map((a) => h('div', { class: 'edit-row' }, h('div', { class: 'grow' }, a.name),
          chips(W, String(sy.acts[a.id] || 0), { multi: false, onChange: (v) => { if (Number(v) > 0) sy.acts[a.id] = Number(v); else delete sy.acts[a.id]; save(); upd(); } }))));
    })] });
}

// ---- えらぶ言葉 ----
export function listsView() {
  const st = S.settings;
  const plain = (key, title, hint) => {
    const o = { text: st[key].join('\n') };
    return h('details', { class: 'card fold' }, h('summary', null, title), h('p', { class: 'hint' }, hint || '1行に1つずつ書きます。'),
      textarea(o, 'text', { rows: Math.max(4, st[key].length + 1), onInput: () => { st[key] = o.text.split('\n').map((s) => s.trim()).filter(Boolean); saveSettings(); } }));
  };
  const named = (key, title, hint, makeBlank) => {
    const box = h('div');
    const draw = () => fill(box, ...st[key].map((it) => h('div', { class: 'edit-row' },
      it.color ? h('span', { class: 'dot big', style: { background: it.color } }) : null,
      input(it, 'name', { onInput: () => saveSettings(), cls: 'grow' }),
      'words' in it ? input(it, 'words', { onInput: () => saveSettings(), cls: 'grow2', placeholder: 'あてはまる言葉（、で区切る）' }) : null,
      makeBlank ? btn('×', async () => { if (await confirmDlg(key === 'symptoms' ? `「${it.name}」を消します。これまでのカルテでは「（消した症状）」と出ます。` : `「${it.name}」を消します。`, '消す', true)) { st[key] = st[key].filter((x) => x !== it); saveSettings(); draw(); } }, 'ghost round') : null)),
    makeBlank ? h('div', { class: 'row' }, btn('＋ 足す', () => { st[key].push(makeBlank()); saveSettings(); draw(); })) : null);
    draw();
    return h('details', { class: 'card fold' }, h('summary', null, title), hint ? h('p', { class: 'hint' }, hint) : null, box);
  };
  return page({
    title: 'えらぶ言葉を直す', back: '#/set', body: [
      AUTO_NOTE(),
      named('symptoms', 'つらいところ（症状）', '足した症状は、設定 → つらいところと作用のつながり で作用をえらぶと、候補に使われます。', () => ({ id: db.uid(), name: '' })),
      named('skins', '肌の状態', '問診でえらぶ言葉。足したものは、設定 → キャリアオイルの成分 や キャリアオイル で「向いている肌の状態」にえらぶと、候補に使われます。', () => ({ id: db.uid(), name: '' })),
      named('allergens', 'アレルギーのしるし', '右のらんは「アレルギーの欄にこの言葉が書いてあったら、あてはまるとみなす」言葉です（「、」で区切る）。', () => ({ id: db.uid(), name: '', words: '' })),
      named('conds', '気をつける状態', '名前だけ直せます。「妊娠初期・中期・後期」は、問診の妊娠の月数から自動でつきます。', null),
      named('marks', 'からだの図のしるし（色ごとの意味）', '名前だけ直せます。', null),
      named('families', '香りの系統', '名前だけ直せます。資料の3つ（樹木系・花穂系・柑橘系）。色は 樹＝緑・花＝ピンク・柑橘＝オレンジ。', null),
      plain('purposes', '今日の目的'), plain('moods', '香りの好み・気分'), plain('scents', '香りの感想'), plain('jobs', 'お仕事'),
    ],
  });
}
export function salonView() {
  return page({ title: 'お店の名前', back: '#/set', body: [AUTO_NOTE(), card(field('ホームの上に出る名前', input(S.settings, 'salonName', { onInput: () => saveSettings(), placeholder: '例：〇〇サロン' })))] });
}

// ---- バックアップ ----
export async function backupView() {
  const last = await db.getMeta('lastBackupAt');
  const o = { pass: '', pass2: '', rpass: '' };
  const doExport = async () => {
    if (o.pass !== o.pass2) { toast('合言葉が2つでちがっています'); return; }
    if (!o.pass && !(await confirmDlg('合言葉なしで書き出します。ファイルを開けば、だれでも中身を読めます。よいですか？', '合言葉なしで書き出す', true))) return;
    try {
      fill(ready, h('div', { class: 'notice' }, 'バックアップを作っています…'));
      const text = await makeBackupText(o.pass);
      // iPad・iPhone の「共有」の画面は、ボタンを押したその場でしか出せないので、できあがってからもう一度押してもらう
      fill(ready, h('div', { class: 'notice ok' }, 'バックアップができました。下のボタンで保存先をえらんでね。'),
        btn('保存先をえらぶ', async () => {
          if (await handOver(text, `カルテのバックアップ_${todayStr()}.json`)) { await db.setMeta('lastBackupAt', Date.now()); toast('書き出しました'); go('#/set/backup?' + Date.now()); }
        }, 'primary big wide'));
    } catch (e) { fill(ready); toast('書き出せませんでした：' + e.message); }
  };
  const ready = h('div', { class: 'step' });
  const file = h('input', { type: 'file', class: 'input', 'aria-label': 'バックアップのファイル' });
  const info = h('div');
  let head = null;
  file.onchange = async () => {
    head = null; fill(info, ); if (!file.files[0]) return;
    try {
      head = readBackupHead(await file.files[0].text());
      fill(info, h('div', { class: 'notice' }, `${jpDate(ymd(new Date(head.savedAt)))} に書き出したバックアップ。お客さん ${head.counts?.customers ?? '?'}人・来店 ${head.counts?.visits ?? '?'}件。${head.locked ? '合言葉つき。' : '合言葉なし。'}`),
        head.locked ? field('合言葉', input(o, 'rpass', { type: 'password' })) : null,
        btn('このバックアップに入れ替える', doRestore, 'danger wide'));
    } catch (e) { fill(info, h('div', { class: 'notice red' }, e.message)); }
  };
  const doRestore = async () => {
    if (!head) return;
    if (!(await confirmDlg(`いま この ${DEVICE} の中にあるデータ（お客さん ${S.people.length}人）を、このバックアップの中身に入れ替えます。いまのデータは消えます（混ぜることはできません）。`, '入れ替える', true))) return;
    try { await restoreBackup(head, o.rpass); await reload(); toast('バックアップから戻しました'); go('#/'); }
    catch (e) { toast(e.message); }
  };
  const days = last ? daysBetween(ymd(new Date(last)), todayStr()) : null;
  return page({
    title: 'バックアップ', back: '#/set', body: [
      h('div', { class: 'notice ' + (days == null || days >= 30 ? 'red' : days >= 7 ? 'amber' : 'ok') }, days == null ? 'まだバックアップしていません' : days === 0 ? '今日バックアップ済み' : `前のバックアップから ${days} 日`),
      card(h('h2', null, '書き出す'), h('p', { class: 'hint' }, `お客さん・カルテ・設定をまるごと1つのファイルにします。iPad・iPhone では「ファイルに保存」をえらんで、iCloud Drive など ${DEVICE} の外にも置いておくと安心です。`),
        h('div', { class: 'grid2' }, field('合言葉（カギ）', input(o, 'pass', { type: 'password' })), field('合言葉（もう一度）', input(o, 'pass2', { type: 'password' }))),
        h('p', { class: 'hint' }, '⚠ 合言葉を忘れると、そのファイルは二度と開けません。どこにも送らないので、こちらで調べることもできません。'),
        btn('バックアップを作る', doExport, 'big wide'), ready),
      card(h('h2', null, '戻す'), h('p', { class: 'hint' }, '書き出したファイルをえらぶと、中身を確かめてから入れ替えます。古い版で書き出したファイルも、いまの形に直して読みこみます。'), file, info),
      card(h('h2', null, 'iPad と iPhone のあいだで移す'),
        h('p', { class: 'hint' }, 'データは端末ごとに別々です。iPad と iPhone で自動的にそろうことはありません。移したいときは、バックアップを使います。'),
        h('ol', { class: 'plain' },
          h('li', null, 'もとの端末で「バックアップを作る」→「保存先をえらぶ」→「ファイルに保存」で iCloud Drive に置く（AirDrop で送ってもよい）'),
          h('li', null, '移す先の端末でこのアプリを開き、この画面の「戻す」でそのファイルをえらぶ'),
          h('li', null, '合言葉つきなら、同じ合言葉を入れて「入れ替える」')),
        h('p', { class: 'hint' }, '⚠ 戻すと、移す先に入っていたデータは消えて入れ替わります（2台の中身を混ぜることはできません）。2台で別々に書き足すと、片方の分がなくなります。カルテを書く端末は1台に決めておくのがおすすめです。')),
    ],
  });
}

// ---- 見本のデータ ----
export function sampleView() {
  const out = h('div'); const n = () => S.people.filter((p) => p.sample).length;
  const status = h('p');
  const upd = () => { status.textContent = `いま入っている見本：${n()}人（ぜんぶで ${S.people.length}人）`; };
  upd();
  const busy = async (label, fn) => { fill(out, h('div', { class: 'notice' }, label)); await new Promise((r) => setTimeout(r, 30)); const r = await fn(); upd(); return r; };
  return page({
    title: '見本のデータ', back: '#/set', body: [
      card(h('p', null, '作りものの名前のお客さん 1,000人と、その来店の記録を入れて、重くならないか試せます。見本だけを消すこともできます（本物のデータはさわりません）。'), status,
        h('div', { class: 'row' },
          btn('見本を 1,000人 入れる', async () => { const r = await busy('入れています…', () => addSamples(1000)); fill(out, h('div', { class: 'notice ok' }, `入れました：お客さん ${r.customers}人・来店 ${r.visits}件。かかった時間 ${(r.ms / 1000).toFixed(1)}秒。一覧の読みこみ ${S.listMs.toFixed(0)}ミリ秒。`)); }, 'primary'),
          btn('見本をぜんぶ消す', async () => { if (!(await confirmDlg('見本のお客さんと来店の記録を消します。', '消す', true))) return; const c = await busy('消しています…', removeSamples); fill(out, h('div', { class: 'notice ok' }, `見本 ${c}人を消しました。`)); }, 'danger ghost')), out),
    ],
  });
}
export async function aboutView() {
  let est = ''; try { const e = await navigator.storage.estimate(); est = `${(e.usage / 1048576).toFixed(1)} MB`; } catch { /* 出せない端末もある */ }
  const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
  return page({
    title: 'このアプリについて', back: '#/set', body: [
      card(h('p', null, `版 ${APP_VERSION}（データの形 ${db.DATA_VERSION}）`), est ? h('p', null, `使っている容量：${est}`) : null,
        h('p', null, persisted ? 'データは「消されにくい保存」になっています。' : 'ホーム画面に追加したアイコンから開くと、データが消されにくくなります。')),
      card(h('h2', null, 'データについて'), h('ul', { class: 'plain' },
        h('li', null, `お客さんのデータは、この ${DEVICE} の中だけに保存します。インターネットのどこにも送りません。`),
        h('li', null, 'Safari の「履歴とWebサイトデータを消去」をすると、カルテも消えます。バックアップをこまめに。'),
        h('li', null, 'Safari で開いたときと、ホーム画面のアイコンから開いたときでは、データの置き場がちがいます。いつもホーム画面のアイコンから開いてください。'),
        h('li', null, 'iPad と iPhone の両方で使えますが、データは端末ごとに別々です。移すときは 設定 → バックアップ の「iPad と iPhone のあいだで移す」を見てね。'))),
      card(h('h2', null, '精油のデータについて'), h('ul', { class: 'plain' },
        h('li', null, '精油・成分の分類・作用・気をつける状態は、アロマテラピーを学んだときの資料をもとに入れたものです。キャリアオイル・濃度の目安・つらいところと作用の重みは「下書き」です。自分の資料で確かめてから使ってください。'),
        h('li', null, '候補は「こんな場面で選ばれることが多い」という目安です。作用は「こんな働きがあると言われる」という分け方で、病気を治したり診断したりするものではありません。'),
        h('li', null, '最後に決めるのは施術する人です。'))),
    ],
  });
}
