import { h, fill, page, card, btn, badge, go, chips, field, group, input, textarea, toast, confirmDlg, sheet } from '../ui.js';
import { S, saveSettings, saveMaster, deleteMaster, reload } from '../state.js';
import * as db from '../db.js';
import { todayStr, daysBetween, ymd, jpDate } from '../logic.js';
import { makeBackupText, readBackupHead, restoreBackup, handOver } from '../backup.js';
import { addSamples, removeSamples } from '../sample.js';
import { notFound } from './customer.js';
import { APP_VERSION } from '../version.js';

const link = (href, title, desc) => h('a', { class: 'row-link', href }, h('div', { class: 'grow' }, h('div', { class: 'name' }, title), h('div', { class: 'muted' }, desc)), h('span', { class: 'chev' }, '›'));
const fam = (id) => S.settings.families.find((f) => f.id === id) || { name: '', color: '#bbb' };
const numIn = (obj, key, opt = {}) => input(obj, key, { type: 'number', inputmode: 'decimal', cls: 'num', ...opt });
const DRAFT_NOTE = () => h('div', { class: 'notice draft' }, 'はじめから入っている中身は「下書き」です（一般に言われている内容をまとめたもの）。自分の資料で確かめて直し、「確かめた」にしるしをつけてください。');

export function settingsView() {
  const own = S.oils.filter((o) => o.owned).length;
  return page({
    title: '設定', back: '#/', body: [
      card(h('h2', null, 'アロマ'), h('div', { class: 'list' },
        link('#/set/oils', '精油の一覧と手持ち', `${S.oils.length}本（手持ち ${own}本）`),
        link('#/set/carriers', 'キャリアオイルの一覧と手持ち', `${S.carriers.length}種類`),
        link('#/set/limits', '濃度の目安・1滴の量', '部位ごと・お客さんの状態ごとの上限'),
        link('#/set/cats', '成分の分類（向いている場面・気をつける状態）', '精油の候補を出すもとになる表'))),
      card(h('h2', null, 'カルテ'), h('div', { class: 'list' },
        link('#/set/menus', '施術メニュー', `${S.menus.length}個`),
        link('#/set/lists', 'えらぶ言葉を直す', '症状・目的・香りの好み・お仕事 など'),
        link('#/set/salon', 'お店の名前', S.settings.salonName || '（まだ入っていません）'))),
      card(h('h2', null, 'データ'), h('div', { class: 'list' },
        link('#/set/backup', 'バックアップ（書き出し・戻し）', 'データは この iPad の中だけにあります。こまめに書き出してね'),
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
      h('a', { class: 'grow famline', href: `#/set/oil/${o.id}` }, h('div', { class: 'name' }, o.name, ' ', o.draft ? badge('下書き', 'draft') : badge('確かめた', 'ok')), h('div', { class: 'muted' }, fam(o.family).name)), sw);
  }));
  draw();
  return page({ title: '精油の一覧と手持ち', back: '#/set', actions: h('a', { class: 'btn', href: '#/set/oil/new' }, '＋ 足す'),
    body: [DRAFT_NOTE(), h('p', { class: 'hint' }, '持っている精油の右のボタンを押すと「手持ち」になります。名前を押すと中身を直せます。'), list] });
}
export function oilEditView(id) {
  const isNew = id === 'new';
  const o = isNew ? { id: db.uid(), name: '', family: S.settings.families[0].id, components: {}, uses: [], cautions: [], note: '', owned: true, draft: false } : JSON.parse(JSON.stringify(S.oils.find((x) => x.id === id) || null));
  if (!o) return notFound();
  const total = h('span', { class: 'muted' });
  const sum = () => { const t = S.cats.reduce((s, c) => s + (Number(o.components[c.id]) || 0), 0); total.textContent = `合計 ${t}％${t > 100 ? '（100をこえています）' : ''}`; };
  sum();
  const save = async () => {
    if (!o.name.trim()) { toast('名前を入れてね'); return; }
    for (const k of Object.keys(o.components)) if (o.components[k] == null || o.components[k] === '') delete o.components[k];
    await saveMaster('oils', o); toast('保存しました'); go('#/set/oils');
  };
  const confirmBox = h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !o.draft, onchange: (e) => { o.draft = !e.target.checked; } }), '自分の資料で確かめた（「下書き」のしるしを外す）');
  return page({
    title: isNew ? '精油を足す' : o.name, back: '#/set/oils', body: [
      o.draft ? DRAFT_NOTE() : null,
      card(field('名前', input(o, 'name')), group('香りの系統', chips(S.settings.families, o.family, { multi: false, onChange: (v) => { if (v) o.family = v; } })),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: o.owned, onchange: (e) => { o.owned = e.target.checked; } }), '手持ち（持っている）')),
      card(h('h2', null, '成分の分類ごとの割合（％）'), h('p', { class: 'hint' }, 'おおよその値でかまいません。分からないところは空けたままに。'),
        h('div', { class: 'grid2' }, S.cats.map((c) => field(c.name, numIn(o.components, c.id, { onInput: sum })))), total),
      card(group('この精油ならではの「向いている場面」', chips(S.settings.symptoms, o.uses, { onChange: (v) => { o.uses = v; } })),
        group('気をつける状態（あてはまるお客さんには候補から外して知らせる）', chips(S.settings.conds, o.cautions, { onChange: (v) => { o.cautions = v; } })),
        field('メモ・注意', textarea(o, 'note'))),
      card(confirmBox),
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
  return page({ title, back, body: [hint ? h('p', { class: 'hint' }, hint) : null, list, h('div', { class: 'row' }, btn('＋ 足す', async () => { await onSave(blank()); draw(); })), extra || null] });
}
const nameField = (ph) => (it, save) => input(it, 'name', { placeholder: ph, onInput: save, cls: 'grow' });

export const carriersView = () => simpleList({
  title: 'キャリアオイル', back: '#/set', items: () => S.carriers, hint: '持っているものに「手持ち」のしるしをつけます。',
  fields: [nameField('名前'), (it, save) => { const b = h('button', { type: 'button', class: 'mini big' + (it.owned ? ' on' : '') }, it.owned ? '✓ 手持ち' : '持っていない'); b.onclick = () => { it.owned = !it.owned; b.classList.toggle('on', it.owned); b.textContent = it.owned ? '✓ 手持ち' : '持っていない'; save(); }; return b; }],
  blank: () => ({ id: db.uid(), name: '', owned: true, note: '' }), onSave: (it) => saveMaster('carriers', it), onDelete: (it) => deleteMaster('carriers', it.id),
});
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
      h('div', { class: 'notice draft' }, '濃度の目安は、流派や資料によってちがいます。はじめの「体 1％・顔 0.5％」は、よく言われている目安の下書きです。自分の資料で確かめて直してください（数字を直すと「下書き」のしるしが外れます）。空けたところは「目安なし」になります。'),
      card(h('h2', null, '部位ごとの上限'), areaBox, h('div', { class: 'row' }, btn('＋ 部位を足す', () => { st.areas.push({ id: db.uid(), name: '', max: null }); save(); drawAreas(); }))),
      card(h('h2', null, 'お客さんの状態ごとの上限'), h('p', { class: 'hint' }, 'あてはまるお客さんでは、部位の上限とくらべて低いほうを使います。はじめは空けてあります。'),
        st.conds.map((c) => h('div', { class: 'edit-row' }, h('div', { class: 'grow' }, c.name), h('span', { class: 'row tight' }, numIn(st.stateLimits, c.id, { onInput: () => { if (st.stateLimits[c.id] == null) delete st.stateLimits[c.id]; save(); }, placeholder: '空き' }), '％まで')))),
      card(h('h2', null, '1滴の量'), h('div', { class: 'row tight' }, numIn(st, 'dropMl', { onInput: () => { if (!(st.dropMl > 0)) return; save(); } }), 'ml'), h('p', { class: 'hint' }, 'びんの口（ドロッパー）によってちがいます。はじめは 0.05ml。')),
    ],
  });
}

// ---- 成分の分類 ----
export function catsView() {
  const st = S.settings;
  return page({
    title: '成分の分類', back: '#/set', body: [
      DRAFT_NOTE(),
      h('p', { class: 'hint' }, '「向いている場面」にえらんだ症状が問診にあると、その成分が多い精油が候補に上がります。「気をつける状態」にあてはまるお客さんには、その成分が多い精油を外して理由を見せます。'),
      card(h('div', { class: 'row tight' }, '気をつける成分が', numIn(st, 'cautionPct', { onInput: () => saveSettings() }), '％以上入っている精油を外す')),
      S.cats.map((c) => {
        const save = () => saveMaster('cats', c);
        return h('details', { class: 'card fold' }, h('summary', null, c.name, ' ', c.draft ? badge('下書き', 'draft') : badge('確かめた', 'ok')),
          field('名前', input(c, 'name', { onInput: save })),
          group('向いている場面', chips(st.symptoms, c.uses, { onChange: (v) => { c.uses = v; save(); } })),
          group('気をつける状態', chips(st.conds, c.cautions, { onChange: (v) => { c.cautions = v; save(); } })),
          field('メモ', textarea(c, 'note', { onInput: save, rows: 2 })),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !c.draft, onchange: (e) => { c.draft = !e.target.checked; save(); } }), '自分の資料で確かめた'));
      }),
    ],
  });
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
      makeBlank ? btn('×', async () => { if (await confirmDlg(`「${it.name}」を消します。これまでのカルテでは「（消した症状）」と出ます。`, '消す', true)) { st[key] = st[key].filter((x) => x !== it); saveSettings(); draw(); } }, 'ghost round') : null)),
    makeBlank ? h('div', { class: 'row' }, btn('＋ 足す', () => { st[key].push(makeBlank()); saveSettings(); draw(); })) : null);
    draw();
    return h('details', { class: 'card fold' }, h('summary', null, title), hint ? h('p', { class: 'hint' }, hint) : null, box);
  };
  return page({
    title: 'えらぶ言葉を直す', back: '#/set', body: [
      named('symptoms', 'つらいところ（症状）', '足した症状は、設定 → 成分の分類 や 精油 で「向いている場面」にえらぶと、候補に使われます。', () => ({ id: db.uid(), name: '' })),
      named('conds', '気をつける状態', '名前だけ直せます。', null),
      named('marks', 'からだの図のしるし（色ごとの意味）', '名前だけ直せます。', null),
      named('families', '香りの系統', '名前だけ直せます。', null),
      plain('purposes', '今日の目的'), plain('moods', '香りの好み・気分'), plain('scents', '香りの感想'), plain('jobs', 'お仕事'),
    ],
  });
}
export function salonView() {
  return page({ title: 'お店の名前', back: '#/set', body: card(field('ホームの上に出る名前', input(S.settings, 'salonName', { onInput: () => saveSettings(), placeholder: '例：〇〇サロン' }))) });
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
      // iPad の「共有」の画面は、ボタンを押したその場でしか出せないので、できあがってからもう一度押してもらう
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
    if (!(await confirmDlg(`いま iPad の中にあるデータ（お客さん ${S.people.length}人）を、このバックアップの中身に入れ替えます。いまのデータは消えます。`, '入れ替える', true))) return;
    try { await restoreBackup(head, o.rpass); await reload(); toast('バックアップから戻しました'); go('#/'); }
    catch (e) { toast(e.message); }
  };
  const days = last ? daysBetween(ymd(new Date(last)), todayStr()) : null;
  return page({
    title: 'バックアップ', back: '#/set', body: [
      h('div', { class: 'notice ' + (days == null || days >= 30 ? 'red' : days >= 7 ? 'amber' : 'ok') }, days == null ? 'まだバックアップしていません' : days === 0 ? '今日バックアップ済み' : `前のバックアップから ${days} 日`),
      card(h('h2', null, '書き出す'), h('p', { class: 'hint' }, 'お客さん・カルテ・設定をまるごと1つのファイルにします。iPad では「ファイルに保存」をえらんで、iCloud や USB メモリなど iPad の外にも置いておくと安心です。'),
        h('div', { class: 'grid2' }, field('合言葉（カギ）', input(o, 'pass', { type: 'password' })), field('合言葉（もう一度）', input(o, 'pass2', { type: 'password' }))),
        h('p', { class: 'hint' }, '⚠ 合言葉を忘れると、そのファイルは二度と開けません。どこにも送らないので、こちらで調べることもできません。'),
        btn('バックアップを作る', doExport, 'big wide'), ready),
      card(h('h2', null, '戻す'), h('p', { class: 'hint' }, '書き出したファイルをえらぶと、中身を確かめてから入れ替えます。古い版で書き出したファイルも、いまの形に直して読みこみます。'), file, info),
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
        h('li', null, 'お客さんのデータは、この iPad の中だけに保存します。インターネットのどこにも送りません。'),
        h('li', null, 'Safari の「履歴とWebサイトデータを消去」をすると、カルテも消えます。バックアップをこまめに。'),
        h('li', null, 'Safari で開いたときと、ホーム画面のアイコンから開いたときでは、データの置き場がちがいます。いつもホーム画面のアイコンから開いてください。'))),
      card(h('h2', null, '精油のデータについて'), h('ul', { class: 'plain' },
        h('li', null, 'はじめから入っている精油・成分・気をつける状態・濃度の目安は「下書き」です。自分の資料で確かめてから使ってください。'),
        h('li', null, '候補は「こんな場面で選ばれることが多い」という目安です。病気を治したり診断したりするものではありません。'),
        h('li', null, '最後に決めるのは施術する人です。'))),
    ],
  });
}
