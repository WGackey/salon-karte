// アプリ全体で使う「いまの中身」と、保存の決まりごと。
import * as db from './db.js';
import { DEFAULT_SETTINGS, DEFAULT_CATS, DEFAULT_OILS, DEFAULT_CARRIERS, DEFAULT_MENUS } from './seed.js';
import { todayStr, noTouchOf } from './logic.js';

export const S = { settings: null, people: [], oils: [], cats: [], carriers: [], menus: [], blends: [], newer: false };
const clone = (o) => JSON.parse(JSON.stringify(o));

export async function boot() {
  const mig = await db.migrateDb();
  S.newer = !!mig.newer;
  let settings = await db.getMeta('settings');
  if (!settings) {
    settings = clone(DEFAULT_SETTINGS);
    await db.setMeta('settings', settings);
    await db.bulkPut('cats', clone(DEFAULT_CATS));
    await db.bulkPut('oils', clone(DEFAULT_OILS));
    await db.bulkPut('carriers', clone(DEFAULT_CARRIERS));
    await db.bulkPut('menus', clone(DEFAULT_MENUS));
  }
  // あとから足した設定の項目は、足りない分だけ補う（使う人が直した値は上書きしない）
  S.settings = { ...clone(DEFAULT_SETTINGS), ...settings };
  await reload();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}
export async function reload() {
  S.settings = { ...clone(DEFAULT_SETTINGS), ...(await db.getMeta('settings')) };
  const t = performance.now();
  [S.people, S.oils, S.cats, S.carriers, S.menus, S.blends] = await Promise.all(['customers', 'oils', 'cats', 'carriers', 'menus', 'blends'].map((s) => db.all(s)));
  S.listMs = performance.now() - t;
  const ja = (a, b) => a.name.localeCompare(b.name, 'ja');
  S.carriers.sort(ja);
  // 成分の分類は資料の並び（炭化水素類 → アルコール類 → …）。自分で足した分類はうしろに
  const ord = (c) => { const i = DEFAULT_CATS.findIndex((d) => d.id === c.id); return i < 0 ? 99 : i; };
  S.cats.sort((a, b) => ord(a) - ord(b));
}
export const saveSettings = () => db.setMeta('settings', S.settings);

export async function saveMaster(store, obj) {
  await db.put(store, obj); const i = S[store].findIndex((x) => x.id === obj.id);
  if (i < 0) S[store].push(obj); else S[store][i] = obj;
}
export async function deleteMaster(store, id) { await db.del(store, id); S[store] = S[store].filter((x) => x.id !== id); }

// ---- お客さん ----
export function blankCustomer() {
  return {
    slim: { id: db.uid(), no: 0, name: '', kana: '', nextDate: '', lastVisit: '', visitCount: 0 },
    det: { life: {}, consents: [], gender: '', birth: '', zip: '', address: '', tel: '', email: '', job: '', firstVisit: todayStr(), history: '', conds: [], allergy: '', allergyTags: [], avoidOilIds: [], avoidCarrierIds: [], experience: '', memo: '' },
  };
}
export async function saveCustomer(slim, det) {
  if (!slim.no) { slim.no = (await db.getMeta('nextNo', 1)); await db.setMeta('nextNo', slim.no + 1); }
  const { _k, ...clean } = slim; clean.updatedAt = Date.now();
  await db.batch(['customers', 'details'], (os) => { os.customers.put(clean); if (det) os.details.put({ ...det, id: slim.id }); });
  delete slim._k;
  const i = S.people.findIndex((p) => p.id === slim.id);
  if (i < 0) S.people.push(slim); else S.people[i] = slim;
}
export async function deleteCustomer(id) {
  const vs = await db.byIndex('visits', 'customerId', id);
  await db.batch(['customers', 'details', 'visits'], (os) => { os.customers.delete(id); os.details.delete(id); for (const v of vs) os.visits.delete(v.id); });
  S.people = S.people.filter((p) => p.id !== id);
}
export const person = (id) => S.people.find((p) => p.id === id);

// ---- 来店 ----
export async function visitsOf(customerId) {
  const vs = await db.byIndex('visits', 'customerId', customerId);
  return vs.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt) || b.createdAt - a.createdAt);
}
// 新しい来店。問診は前回の中身を写しておく（変わったところだけ直す）
export async function newVisit(customerId) {
  const prev = (await visitsOf(customerId))[0];
  const v = {
    id: db.uid(), customerId, date: todayStr(), status: 'draft',
    scope: { type: 'whole' }, // 第2段で「部分（手・足など）」を足すための入れ物
    conds: prev ? prev.conds.filter((c) => !['c_sun', 'c_drive', 'c_drink'].includes(c)) : [], // その日だけのもの（屋外・運転・お酒）は写さない。妊娠の月数も写さない
    interview: prev ? { ...clone(prev.interview), memo: '' } : { life: '', purposes: [], moods: [], symptoms: [], skins: [], memo: '' },
    // 図の名前 → なぞった線。第2段で手・足の図を足せる。「触れないで（×）」の線は前回から写す
    figures: { front: [], back: [], ...JSON.parse(JSON.stringify(prev ? noTouchOf(prev.figures, S.settings.marks) : {})) },
    blend: { areaId: S.settings.areas[0]?.id || '', oils: [], carriers: [], memo: '' },
    menus: [], treat: { seitai: '', aroma: '' },
    after: { levels: {}, scent: '', note: '' }, nextDate: '',
    copied: !!prev, createdAt: Date.now(), updatedAt: Date.now(),
  };
  await db.put('visits', v);
  const p = person(customerId);
  if (p && p.nextDate && p.nextDate <= v.date) p.nextDate = ''; // 予定どおり来たので、予定を消す
  await recount(customerId);
  return v;
}
export async function saveVisit(v) { v.updatedAt = Date.now(); await db.put('visits', v); }
export async function deleteVisit(v) { await db.del('visits', v.id); await recount(v.customerId); }
// 回数と最後の来店日を数え直す
export async function recount(customerId) {
  const p = person(customerId); if (!p) return;
  const vs = await visitsOf(customerId);
  p.visitCount = vs.length; p.lastVisit = vs[0] ? vs[0].date : '';
  await saveCustomer(p, null);
}

// ---- 保存の後回し（入力のたびに書くと重いので、少しまとめて書く） ----
// 画面には「保存しています…／保存済み」を出す（saveState の合図）
let pending = null; let timer = null;
const tell = (busy) => dispatchEvent(new CustomEvent('savestate', { detail: { busy } }));
export function saveSoon(fn) { pending = fn; clearTimeout(timer); if (fn) { tell(true); timer = setTimeout(flush, 400); } else tell(false); }
export async function flush() { clearTimeout(timer); const f = pending; pending = null; if (f) { try { await f(); } finally { if (!pending) tell(false); } } }
addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
