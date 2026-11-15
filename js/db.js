// データの入れ物（端末の中の IndexedDB）。外へは何も送らない。
import { DEFAULT_CARRIERS, DEFAULT_CATS, DEFAULT_OILS, DEFAULT_SETTINGS, DEFAULT_SYM_ACTS, OLD_ONLY_OILS, SUN_NAME, SUN_NAME_OLD } from './seed.js';
// DATA_VERSION = データの形の版。形を変えたら 1 つ上げて MIGRATIONS に移し替えを足す。
export const DATA_VERSION = 4;
export const STORES = ['meta', 'customers', 'details', 'visits', 'oils', 'carriers', 'cats', 'menus', 'blends'];
const IDB_VERSION = 1;
let DB_NAME = 'salon-karte';
let _db = null;

// 移し替えの一覧。同じ一覧を「端末の中のデータ」と「戻すバックアップ」の両方に使う。
//   stores：入れ物ごとに、1件ずつ新しい形に直す
//   stores の関数が null を返したら、その1件を消す
//   add   ：入れ物ごとに、まだ無いもの（同じ番号が無いもの）だけ足す
const CAR = Object.fromEntries(DEFAULT_CARRIERS.map((c) => [c.id, c]));
const BLANK_CAR = { fatty: {}, traits: {}, skins: [], purposes: [], allergens: [], cautions: [], draft: false };
export const MIGRATIONS = [
  { // 版2：キャリアオイルを精油と同じ作りに（成分・特徴・候補）。問診に「肌の状態」、お客さんに「アレルギーのしるし」
    to: 2,
    stores: {
      // はじめから入っていたオイルには下書きの中身を足す（名前・手持ち・メモは使う人のものを残す）。自分で足したオイルは空のらんを足す
      carriers: (r) => { const d = CAR[r.id]; return d ? { ...d, ...r, note: r.note || d.note } : { ...BLANK_CAR, ...r }; },
      details: (r) => ({ allergyTags: [], avoidCarrierIds: [], ...r }),
      visits: (r) => ({ ...r, interview: { skins: [], ...(r.interview || {}) } }),
    },
    add: { carriers: DEFAULT_CARRIERS },
  },
  { // 版3：問診の言葉「このあと日に当たる」を分かりやすく。使う人が自分で直していたら、さわらない
    to: 3,
    stores: {
      meta: (r) => (r.key === 'settings' && r.value && Array.isArray(r.value.conds)
        ? { ...r, value: { ...r.value, conds: r.value.conds.map((c) => (c.id === 'c_sun' && SUN_NAME_OLD.includes(c.name) ? { ...c, name: SUN_NAME } : c)) } } : r),
    },
  },
  { // 版4：精油のデータを がっき〜の資料（30本）に合わせる。成分の分類を資料の7つに、香りの系統を3つに、作用（働き）と気をつける状態を足す
    to: 4,
    stores: {
      meta: (r) => (r.key === 'settings' && r.value ? { ...r, value: settingsV4(r.value) } : r),
      cats: (r) => {
        if (OLD_CAT[r.id]) return r.draft === false ? { ...r, subs: r.subs || [], warns: r.warns || [], tip: r.tip || '' } : null; // 下書きのままなら資料の分類にまとめる（消す）
        const d = CAT[r.id]; if (d) return r.draft === false ? { ...r, subs: r.subs || d.subs, warns: r.warns || d.warns, tip: r.tip ?? d.tip } : clone(d);
        return { subs: [], warns: [], tip: '', ...r }; // 自分で足した分類
      },
      oils: (r) => {
        const d = OIL[r.id];
        if (d && r.draft !== false) return { ...clone(d), owned: !!r.owned }; // 下書きのままなら資料のデータに入れかえる（手持ちは残す）
        const base = { subs: [], actions: [], okConds: [], warns: [], allergens: [], plant: '', ...r, components: mergeComp(r.components), family: famV4(r.family) };
        if (r.id in OLD_ONLY_OILS) return { ...base, ref: false, family: OLD_ONLY_OILS[r.id] };
        return base;
      },
      visits: (r) => ({ pregMonth: null, ...r, interview: { famLikes: [], ...(r.interview || {}) } }),
    },
    add: { cats: DEFAULT_CATS, oils: DEFAULT_OILS },
  },
];

// ---- 版4 の移し替えで使う部品 ----
const clone = (o) => JSON.parse(JSON.stringify(o));
const CAT = Object.fromEntries(DEFAULT_CATS.map((c) => [c.id, c]));
const OIL = Object.fromEntries(DEFAULT_OILS.map((o) => [o.id, o]));
// 前の下書きの分類 → 資料の分類（割合は足し合わせる）
const OLD_CAT = { mth: 'hyd', sth: 'hyd', sqa: 'alc', eth: 'phe', lac: null };
function mergeComp(c = {}) {
  const out = {};
  for (const [k, v] of Object.entries(c || {})) {
    const to = k in OLD_CAT ? OLD_CAT[k] : k; if (!to) continue;
    const n = Number(v); out[to] = typeof out[to] === 'number' && Number.isFinite(n) ? out[to] + n : (v === null || v === '' ? (out[to] ?? null) : v);
  }
  return out;
}
const FAM_NAME = { f_tree: ['樹木', '樹木系'], f_flower: ['花', '花穂系'], f_citrus: ['柑橘', '柑橘系'] };
const OLD_FAM = { f_herb: 'f_flower', f_spice: '', f_resin: 'f_tree', f_exotic: 'f_flower' };
const famV4 = (f) => (f in OLD_FAM ? OLD_FAM[f] : f || '');
const byId = (arr) => Object.fromEntries((arr || []).map((x) => [x.id, x]));
function settingsV4(v) {
  const n = { ...v };
  // 香りの系統：資料の3つ（樹木系・花穂系・柑橘系）。名前を直していなければ資料の呼び方に。自分で足した系統は残す
  const fam = byId(v.families);
  n.families = [...DEFAULT_SETTINGS.families.map((d) => (fam[d.id] ? { ...fam[d.id], name: fam[d.id].name === FAM_NAME[d.id][0] ? FAM_NAME[d.id][1] : fam[d.id].name } : clone(d))),
    ...(v.families || []).filter((f) => !FAM_NAME[f.id] && !(f.id in OLD_FAM))];
  // 気をつける状態：はじめの並びに、足りないものを入れる。名前を直したものはそのまま。自分で足したもの（あれば）はうしろに
  const cd = byId(v.conds);
  n.conds = [...DEFAULT_SETTINGS.conds.map((d) => cd[d.id] || clone(d)), ...(v.conds || []).filter((c) => !DEFAULT_SETTINGS.conds.some((d) => d.id === c.id))];
  const al = byId(v.allergens);
  n.allergens = [...(v.allergens || []), ...DEFAULT_SETTINGS.allergens.filter((d) => !al[d.id]).map(clone)];
  // つらいところ → 作用 の重み。はじめからある言葉にだけ下書きを入れる（自分で足した言葉は空のまま）
  n.symptoms = (v.symptoms || []).map((s) => (s.acts ? s : { ...s, acts: { ...(DEFAULT_SYM_ACTS[s.id] || {}) } }));
  if (!n.actions) n.actions = clone(DEFAULT_SETTINGS.actions);
  if (!n.ageRules) n.ageRules = clone(DEFAULT_SETTINGS.ageRules);
  if (!(n.marks || []).some((m) => m.id === 'm_notouch')) n.marks = [...(n.marks || []), ...DEFAULT_SETTINGS.marks.filter((m) => m.id === 'm_notouch').map(clone)];
  if (!n.unknownPct) n.unknownPct = DEFAULT_SETTINGS.unknownPct;
  return n;
}

const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = (tx) => new Promise((res, rej) => {
  tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('中断'));
});

export function useDbName(name) { if (_db) _db.close(); _db = null; DB_NAME = name; }

export async function openDb() {
  if (_db) return _db;
  const r = indexedDB.open(DB_NAME, IDB_VERSION);
  r.onupgradeneeded = (e) => {
    const db = r.result;
    if (e.oldVersion < 1) {
      db.createObjectStore('meta', { keyPath: 'key' });
      db.createObjectStore('customers', { keyPath: 'id' }); // 一覧用（名前など軽いものだけ）
      db.createObjectStore('details', { keyPath: 'id' }); // くわしい中身（開いた人の分だけ読む）
      const v = db.createObjectStore('visits', { keyPath: 'id' });
      v.createIndex('customerId', 'customerId');
      v.createIndex('date', 'date');
      for (const s of ['oils', 'carriers', 'cats', 'menus', 'blends']) db.createObjectStore(s, { keyPath: 'id' });
    }
  };
  _db = await req(r);
  _db.onversionchange = () => { _db.close(); _db = null; };
  return _db;
}

export async function get(store, id) { const db = await openDb(); return req(db.transaction(store).objectStore(store).get(id)); }
export async function all(store) { const db = await openDb(); return req(db.transaction(store).objectStore(store).getAll()); }
export async function count(store) { const db = await openDb(); return req(db.transaction(store).objectStore(store).count()); }
export async function byIndex(store, index, key) {
  const db = await openDb(); return req(db.transaction(store).objectStore(store).index(index).getAll(key));
}
export async function put(store, obj) {
  const db = await openDb(); const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(obj); return done(tx);
}
export async function bulkPut(store, arr) {
  const db = await openDb(); const tx = db.transaction(store, 'readwrite'); const os = tx.objectStore(store);
  for (const o of arr) os.put(o); return done(tx);
}
export async function del(store, id) {
  const db = await openDb(); const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).delete(id); return done(tx);
}
// いくつかの入れ物をまとめて書く（途中で失敗したら全部なかったことになる）
export async function batch(stores, fn) {
  const db = await openDb(); const tx = db.transaction(stores, 'readwrite');
  fn(Object.fromEntries(stores.map((s) => [s, tx.objectStore(s)]))); return done(tx);
}
export async function getMeta(key, fallback = null) { const r = await get('meta', key); return r ? r.value : fallback; }
export async function setMeta(key, value) { return put('meta', { key, value }); }

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

// ---- 版の移し替え ----
// バックアップ（書き出した形）を新しい版へ
export function migrateDump(dump, list = MIGRATIONS, target = DATA_VERSION) {
  let ver = dump.dataVersion || 1;
  if (ver > target) throw new Error('このバックアップは、いまのアプリより新しい版で作られています。アプリを新しくしてから戻してください。');
  const stores = { ...dump.stores };
  for (const m of [...list].sort((a, b) => a.to - b.to)) {
    if (m.to <= ver || m.to > target) continue;
    for (const [name, fn] of Object.entries(m.stores || {})) stores[name] = (stores[name] || []).map(fn).filter((x) => x != null);
    for (const [name, rows] of Object.entries(m.add || {})) {
      const have = new Set((stores[name] || []).map((r) => r.id));
      stores[name] = [...(stores[name] || []), ...rows.filter((r) => !have.has(r.id)).map((r) => JSON.parse(JSON.stringify(r)))];
    }
    ver = m.to;
  }
  return { ...dump, dataVersion: ver, stores };
}
// 端末の中のデータを新しい版へ（1つの版ごとに、全部できるか・何も変わらないかのどちらか）
export async function migrateDb(list = MIGRATIONS, target = DATA_VERSION) {
  const db = await openDb();
  let ver = await getMeta('dataVersion');
  if (ver == null) { await setMeta('dataVersion', target); return { from: null, to: target }; }
  const from = ver;
  if (ver > target) return { from, to: ver, newer: true };
  for (const m of [...list].sort((a, b) => a.to - b.to)) {
    if (m.to <= ver || m.to > target) continue;
    const tx = db.transaction(STORES, 'readwrite');
    for (const [name, fn] of Object.entries(m.stores || {})) {
      const os = tx.objectStore(name);
      // 変わらなかったものは書き直さない。版の番号の行にはさわらない（下で書く新しい番号を、古い値で上書きしないため）
      os.openCursor().onsuccess = (e) => { const c = e.target.result; if (!c) return; if (!(name === 'meta' && c.value.key === 'dataVersion')) { const nv = fn(c.value); if (nv == null) c.delete(); else if (nv !== c.value) c.update(nv); } c.continue(); };
    }
    for (const [name, rows] of Object.entries(m.add || {})) for (const r of rows) tx.objectStore(name).add(JSON.parse(JSON.stringify(r))).onerror = (e) => { e.preventDefault(); e.stopPropagation(); }; // もうあるものはそのまま
    tx.objectStore('meta').put({ key: 'dataVersion', value: m.to });
    await done(tx);
    ver = m.to;
  }
  return { from, to: ver };
}

// ---- まるごと書き出し・まるごと入れ替え（バックアップ用） ----
export async function dumpAll() {
  const stores = {};
  for (const s of STORES) stores[s] = await all(s);
  return { app: 'salon-karte', dataVersion: await getMeta('dataVersion', DATA_VERSION), stores };
}
export async function restoreAll(dump) {
  const d = migrateDump(dump);
  const db = await openDb(); const tx = db.transaction(STORES, 'readwrite');
  for (const s of STORES) { const os = tx.objectStore(s); os.clear(); for (const o of d.stores[s] || []) os.put(o); }
  tx.objectStore('meta').put({ key: 'dataVersion', value: d.dataVersion });
  return done(tx);
}
