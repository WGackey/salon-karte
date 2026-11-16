// アプリ全体で使う「いまの中身」と、保存の決まりごと。
import * as db from './db.js';
import { DEFAULT_SETTINGS, DEFAULT_CATS, DEFAULT_OILS, DEFAULT_CARRIERS, DEFAULT_MENUS } from './seed.js';
import { todayStr, noTouchOf } from './logic.js';

export const S = { settings: null, people: [], oils: [], cats: [], carriers: [], menus: [], blends: [], appts: [], newer: false, guest: null };
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
  S.guest = await db.getMeta('guest'); // お客さんに渡している途中なら、開き直してもお客さん用の画面のまま
  askPersist(); // 開くたびに頼む（端末が、頼まれたことを覚えていないことがあるため）
}
// 「消されにくい保存」を頼んで、いま効いているかどうかを返す（頼めない端末・ことわられたときは false）
export async function askPersist() {
  try {
    const st = navigator.storage; if (!st) return false;
    if (st.persisted && await st.persisted()) return true;
    return st.persist ? !!(await st.persist()) : false;
  } catch { return false; }
}
export async function reload() {
  S.settings = { ...clone(DEFAULT_SETTINGS), ...(await db.getMeta('settings')) };
  const t = performance.now();
  [S.people, S.oils, S.cats, S.carriers, S.menus, S.blends, S.appts] = await Promise.all(['customers', 'oils', 'cats', 'carriers', 'menus', 'blends', 'appts'].map((s) => db.all(s)));
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
    det: { life: {}, consents: [], intakeAt: '', gender: '', birth: '', zip: '', address: '', tel: '', email: '', job: '', firstVisit: todayStr(), history: '', conds: [], allergy: '', allergyTags: [], avoidOilIds: [], avoidCarrierIds: [], experience: '', memo: '' },
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
  const vs = await db.byIndex('visits', 'customerId', id); const ap = S.appts.filter((a) => a.customerId === id);
  await db.batch(['customers', 'details', 'visits', 'appts'], (os) => { os.customers.delete(id); os.details.delete(id); for (const v of vs) os.visits.delete(v.id); for (const a of ap) os.appts.delete(a.id); });
  S.appts = S.appts.filter((a) => a.customerId !== id);
  S.people = S.people.filter((p) => p.id !== id);
}
export const person = (id) => S.people.find((p) => p.id === id);

// ---- 来店 ----
export async function visitsOf(customerId) {
  const vs = await db.byIndex('visits', 'customerId', customerId);
  return vs.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt) || b.createdAt - a.createdAt);
}
// 新しい来店。問診は前回の中身を写しておく（変わったところだけ直す）
export async function newVisit(customerId, { by = '' } = {}) {
  const prev = (await visitsOf(customerId))[0];
  const v = {
    id: db.uid(), customerId, date: todayStr(), status: 'draft',
    scope: { type: 'whole' }, // 施術するところ。全身＝{type:'whole'}／部分＝{type:'part', parts:['hand','foot']}。毎回 全身から始めて、メニューか部位をえらぶと変わる
    conds: prev ? prev.conds.filter((c) => !['c_sun', 'c_drive', 'c_drink'].includes(c)) : [], // その日だけのもの（屋外・運転・お酒）は写さない。妊娠の月数も写さない
    interview: prev ? { ...clone(prev.interview), memo: '', wish: '' } : { life: '', purposes: [], moods: [], symptoms: [], skins: [], memo: '', wish: '' },
    // 図は2つ。guestFigures＝お客さんの「気になるところ」／figures＝施術する人の「所見」。図の名前 → なぞった線（第2段で手・足の図を足せる）
    // 「触れないで（×）」の線だけは、それぞれ前回から写す
    guestFigures: { front: [], back: [], ...clone(prev ? noTouchOf(prev.guestFigures, S.settings.marks) : {}) },
    figures: { front: [], back: [], ...clone(prev ? noTouchOf(prev.figures, S.settings.marks) : {}) },
    intake: by ? { by, at: new Date().toISOString() } : null, // 前半（問診・気になるところ）をだれが書いたか：{ by:'guest'|'staff', at }。お客さんに渡すときは、書き終えたときに 'guest'
    staffEdits: {}, // お客さんが書いて返したあとに、施術する人が直した問診のらん → 時刻（0.9.0）
    blend: { areaId: S.settings.areas[0]?.id || '', oils: [], carriers: [], memo: '' },
    menus: [], treat: { seitai: '', aroma: '' },
    after: { levels: {}, scent: '', note: '' }, nextDate: '',
    copied: !!prev, createdAt: Date.now(), updatedAt: Date.now(),
  };
  await db.put('visits', v);
  const p = person(customerId);
  if (p && p.nextDate && p.nextDate <= v.date) { p.nextDate = ''; p.nextTime = ''; } // 予定どおり来たので、予定を消す
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

// ---- お客さんに渡す（お客さん用の画面）と、戻るための合言葉 ----
// 合言葉そのものは残さず、まぜもの（salt）つきの要約だけを残す。外へは送らない
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function pinHash(pin, salt) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin))); }
export const hasPin = () => !!(S.settings.pin && S.settings.pin.hash);
export async function setPin(pin) { const salt = db.uid(); S.settings.pin = { salt, hash: await pinHash(pin, salt) }; await saveSettings(); }
export async function checkPin(pin) { return hasPin() && (await pinHash(pin, S.settings.pin.salt)) === S.settings.pin.hash; }
// g：{ customerId, visitId, parts:['profile','consent','monshin'], step, startedAt }
export async function enterGuest(g) { await flush(); S.guest = { step: 0, startedAt: Date.now(), ...g }; await db.setMeta('guest', S.guest); }
export async function saveGuest() { if (S.guest) await db.setMeta('guest', S.guest); }
export async function leaveGuest() { await flush(); S.guest = null; await db.setMeta('guest', null); }
