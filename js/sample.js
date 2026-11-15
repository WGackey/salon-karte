// 見本のデータ（速さを試すため）。名前はすべて作りもの。その場で作るので、リポには入らない。
import * as db from './db.js';
import { S, reload } from './state.js';
import { todayStr, addDays } from './logic.js';
import { PART_FIGS } from './parts.js';
const SEI = [['春野', 'はるの'], ['夏川', 'なつかわ'], ['秋山', 'あきやま'], ['冬木', 'ふゆき'], ['朝倉', 'あさくら'], ['夕凪', 'ゆうなぎ'], ['星野', 'ほしの'], ['月岡', 'つきおか'], ['花村', 'はなむら'], ['森下', 'もりした'],
  ['川辺', 'かわべ'], ['海野', 'うみの'], ['空閑', 'くが'], ['雪村', 'ゆきむら'], ['風間', 'かざま'], ['水瀬', 'みなせ'], ['草薙', 'くさなぎ'], ['柚木', 'ゆずき'], ['桜庭', 'さくらば'], ['藤崎', 'ふじさき'],
  ['見本', 'みほん'], ['試田', 'ためしだ'], ['白石', 'しらいし'], ['黒沢', 'くろさわ'], ['青柳', 'あおやぎ'], ['赤城', 'あかぎ'], ['緑川', 'みどりかわ'], ['紺野', 'こんの'], ['茶谷', 'ちゃたに'], ['灰原', 'はいばら']];
const MEI = [['あおい', 'あおい'], ['ひなた', 'ひなた'], ['つむぎ', 'つむぎ'], ['かえで', 'かえで'], ['みのり', 'みのり'], ['さつき', 'さつき'], ['いつき', 'いつき'], ['はるか', 'はるか'], ['ゆずは', 'ゆずは'], ['こはる', 'こはる'],
  ['太郎', 'たろう'], ['花子', 'はなこ'], ['一郎', 'いちろう'], ['桃子', 'ももこ'], ['健太', 'けんた'], ['美咲', 'みさき'], ['大地', 'だいち'], ['千夏', 'ちなつ'], ['陽向', 'ひなた'], ['和泉', 'いずみ'],
  ['真琴', 'まこと'], ['薫', 'かおる'], ['渚', 'なぎさ'], ['光', 'ひかる'], ['望', 'のぞみ'], ['歩', 'あゆむ'], ['静', 'しずか'], ['翼', 'つばさ'], ['忍', 'しのぶ'], ['遥', 'はるか']];
let seed = 12345; // いつも同じ並びになる乱数（mulberry32）
const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ri = (n) => Math.floor(rnd() * n); const pick = (a) => a[ri(a.length)];
function stroke(marks, maxY = 400) {
  const p = []; let x = 100 + ri(100), y = 100 + ri(maxY);
  for (let i = 0; i < 18; i++) { p.push(x, y); x += ri(13) - 6; y += ri(13) - 4; }
  return { m: pick(marks).id, w: 14, p };
}
export async function addSamples(n = 1000) {
  const t0 = performance.now(); const st = S.settings; const today = todayStr();
  let no = await db.getMeta('nextNo', 1); const customers = [], details = [], visits = [];
  for (let i = 0; i < n; i++) {
    const [s, sk] = pick(SEI), [m, mk] = pick(MEI); const id = db.uid(); const nv = 2 + ri(7); let last = '';
    for (let k = 0; k < nv; k++) {
      const date = addDays(today, -(1 + ri(30) + k * (14 + ri(30)))); if (date > last) last = date;
      const syms = [...new Set([pick(st.symptoms).id, pick(st.symptoms).id])].map((sid) => ({ id: sid, level: 3 + ri(7) }));
      const oils = [pick(S.oils), pick(S.oils)].map((o) => ({ oilId: o.id, name: o.name, drops: 1 + ri(3) }));
      const part = rnd() < 0.15 ? pick(['hand', 'foot']) : null; const fg = part ? PART_FIGS[part] : ['front', 'back']; const sk = () => stroke(st.marks, part ? 200 : 400);
      visits.push({
        id: db.uid(), customerId: id, date, status: 'done', scope: part ? { type: 'part', parts: [part] } : { type: 'whole' }, conds: [], sample: true,
        interview: { life: '見本のデータです', purposes: [pick(st.purposes)], moods: [pick(st.moods)], symptoms: syms, skins: rnd() < 0.5 ? [pick(st.skins).id] : [], memo: '' },
        guestFigures: { front: [], back: [], [fg[0]]: [sk()], [fg[1]]: rnd() < 0.5 ? [sk()] : [] }, intake: null,
        figures: { front: [], back: [], [fg[0]]: [sk(), sk()], [fg[1]]: [sk(), sk(), sk()] },
        blend: { areaId: st.areas[0].id, oils, carriers: [{ carrierId: S.carriers[0].id, name: S.carriers[0].name, ml: 30 }], memo: '' },
        menus: S.menus[0] ? [{ id: S.menus[0].id, name: S.menus[0].name, minutes: S.menus[0].minutes }] : [], treat: { seitai: '', aroma: '見本' },
        after: { levels: Object.fromEntries(syms.map((x) => [x.id, Math.max(0, x.level - 1 - ri(4))])), scent: pick(st.scents), note: '' },
        nextDate: '', createdAt: Date.now() - k, updatedAt: Date.now(),
      });
    }
    customers.push({ id, no: no++, name: `${s} ${m}`, kana: `${sk} ${mk}`, nextDate: rnd() < 0.03 ? addDays(today, ri(7)) : '', lastVisit: last, visitCount: nv, sample: true });
    details.push({ id, gender: pick(['女性', '女性', '男性']), birth: `${1950 + ri(55)}-${String(1 + ri(12)).padStart(2, '0')}-${String(1 + ri(28)).padStart(2, '0')}`, zip: '', address: '', tel: '', email: '', job: pick(st.jobs), firstVisit: last, history: '', conds: rnd() < 0.15 ? [pick(st.conds.filter((c) => c.when === 'person')).id] : [], allergy: '', allergyTags: [], avoidOilIds: [], avoidCarrierIds: [], experience: '', memo: '見本のお客さんです（作りもの）', sample: true });
  }
  await db.bulkPut('customers', customers); await db.bulkPut('details', details);
  for (let i = 0; i < visits.length; i += 1000) await db.bulkPut('visits', visits.slice(i, i + 1000));
  await db.setMeta('nextNo', no); await reload();
  return { customers: n, visits: visits.length, ms: Math.round(performance.now() - t0) };
}
export async function removeSamples() {
  const ids = S.people.filter((p) => p.sample).map((p) => p.id);
  const idb = await db.openDb(); const tx = idb.transaction(['customers', 'details', 'visits'], 'readwrite');
  for (const id of ids) { tx.objectStore('customers').delete(id); tx.objectStore('details').delete(id); }
  tx.objectStore('visits').openCursor().onsuccess = (e) => { const c = e.target.result; if (c) { if (c.value.sample) c.delete(); c.continue(); } };
  await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  await reload(); return ids.length;
}
