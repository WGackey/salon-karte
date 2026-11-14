// データの入れ物（端末の中の IndexedDB）。外へは何も送らない。
import { DEFAULT_CARRIERS } from './seed.js';
// DATA_VERSION = データの形の版。形を変えたら 1 つ上げて MIGRATIONS に移し替えを足す。
export const DATA_VERSION = 2;
export const STORES = ['meta', 'customers', 'details', 'visits', 'oils', 'carriers', 'cats', 'menus', 'blends'];
const IDB_VERSION = 1;
let DB_NAME = 'salon-karte';
let _db = null;

// 移し替えの一覧。同じ一覧を「端末の中のデータ」と「戻すバックアップ」の両方に使う。
//   stores：入れ物ごとに、1件ずつ新しい形に直す
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
];

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
    for (const [name, fn] of Object.entries(m.stores || {})) stores[name] = (stores[name] || []).map(fn);
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
      os.openCursor().onsuccess = (e) => { const c = e.target.result; if (c) { c.update(fn(c.value)); c.continue(); } };
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
