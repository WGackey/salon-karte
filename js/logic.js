// 計算だけの部品（画面にも保存にも触らない）。tests/ で確かめている。
const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => ymd(new Date());
const toDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return ymd(d); };
export const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
export function ageOf(birth, today = todayStr()) {
  if (!birth || !/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null;
  const [by, bm, bd] = birth.split('-').map(Number); const [ty, tm, td] = today.split('-').map(Number);
  let a = ty - by; if (tm < bm || (tm === bm && td < bd)) a--; return a >= 0 ? a : null;
}
const WD = ['日', '月', '火', '水', '木', '金', '土'];
export function jpDate(s, withYear = true) {
  if (!s) return ''; const d = toDate(s);
  return `${withYear ? d.getFullYear() + '年' : ''}${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）`;
}

// ブレンドの濃度。精油の量 ÷ キャリアオイルの量（キャリアオイルに対して何滴入れたか）。
export function blendCalc(blend, dropMl) {
  const drops = (blend.oils || []).reduce((s, o) => s + (Number(o.drops) || 0), 0);
  const carrierMl = (blend.carriers || []).reduce((s, c) => s + (Number(c.ml) || 0), 0);
  const oilMl = drops * dropMl;
  return { drops, carrierMl, oilMl, pct: carrierMl > 0 ? (oilMl / carrierMl) * 100 : null };
}
// 目安の濃度におさまる、いちばん多い滴数（キャリアオイルの量 × 目安 ÷ 1滴の量）
export function maxDrops(limitPct, carrierMl, dropMl) {
  if (limitPct == null || !(limitPct >= 0) || !(carrierMl > 0) || !(dropMl > 0)) return null;
  return Math.floor((limitPct / 100) * carrierMl / dropMl + 1e-9);
}
// 部位の目安と、お客さんの状態ごとの目安のうち、いちばん低いものを使う
export function limitFor(settings, areaId, condIds) {
  const parts = [];
  const area = (settings.areas || []).find((a) => a.id === areaId);
  if (area && area.max != null) parts.push({ label: area.name, max: area.max });
  for (const id of condIds || []) {
    const m = (settings.stateLimits || {})[id];
    if (m != null) { const c = settings.conds.find((x) => x.id === id); parts.push({ label: c ? c.name : id, max: m }); }
  }
  if (!parts.length) return { max: null, parts, area };
  const low = parts.reduce((a, b) => (b.max < a.max ? b : a));
  return { max: low.max, by: low.label, parts, area };
}
export function limitLevel(pct, max) {
  if (pct == null) return 'none'; if (max == null) return 'unknown';
  return pct > max + 1e-9 ? 'over' : pct > max * 0.9 ? 'near' : 'ok';
}

// その日の「気をつける状態」をまとめる。お客さんごと ＋ 来店ごと ＋ 自動でつくもの（妊娠の月数・年齢）。
// 返すもの：{ ids：状態の番号, auto：{ 番号: 自動でついた理由 } }
export function effectiveConds({ settings, det = {}, visit = {}, today = todayStr() }) {
  const ids = new Set([...(det.conds || []), ...(visit.conds || [])]); const auto = {};
  const addAuto = (id, why) => { if (!ids.has(id)) { ids.add(id); auto[id] = why; } };
  if (ids.has('c_preg')) {
    const m = Number(visit.pregMonth) || 0;
    if (!m) for (const id of ['c_preg_early', 'c_preg_mid', 'c_preg_late']) addAuto(id, '月数が入っていない');
    else addAuto(m <= 4 ? 'c_preg_early' : m <= 7 ? 'c_preg_mid' : 'c_preg_late', `妊娠${m}か月`);
  }
  const r = settings.ageRules || {}; const age = ageOf(det.birth, today);
  if (age != null) {
    if (r.infant != null && age <= r.infant) addAuto('c_infant', `${age}歳`);
    if (r.child != null && age <= r.child) addAuto('c_child', `${age}歳`);
    if (r.old != null && age >= r.old) addAuto('c_old', `${age}歳`);
  }
  return { ids: [...ids], auto };
}

// 成分の割合の見せ方。null＝入っている（割合は資料になし）、'tr'＝微量
export const pctText = (p) => (p === 'tr' ? '微量' : p == null || p === '' ? '割合は分からない' : `約${p}％`);
// 書き方のゆれ（ティートゥリー／ティートリー、スウィート／スイート）を同じとみなす
const kanaLoose = (t) => t.replace(/ウィ/g, 'イ').replace(/ゥ/g, '');
const has = (comp, id) => !!comp && Object.prototype.hasOwnProperty.call(comp, id);

// 精油の候補。資料の3段：つらいところ → 作用（働き）→ 成分（分類・小分類）→ 精油。
//   つらいところ → 作用 には重み（設定で直せる。2＝とても関係する・1＝少し）。
//   精油と作用のつながりは、強いものから：
//     成分（アロマ表）…… その分類の割合で 0.5〜1（割合が分からないときは 0.75、微量は 0.5）。効能のらんにもあれば ＋0.1
//     精油ごとの作用（アロマDBの効能のらん）だけ …… 0.6
//   点数＝ つらさ/10 × 重み × つながりの強さ を足したもの ＋ 資料の OK・使いどころにある場面なら つらさ/10 × 1
// 気をつける点にあたるものは消さず、blocks（外した理由）をつけて返す。warns は外さずに ⚠ をつけるもの。
// 資料にない精油（ref === false）は点数に入れない（気をつける点は見る）。
export function pickOils({ oils, cats, symptoms, condIds, autoConds = {}, avoidOilIds, allergyTags, allergyText, settings }) {
  const symName = (id) => (settings.symptoms.find((s) => s.id === id) || {}).name || id;
  const condName = (id) => (settings.conds.find((s) => s.id === id) || {}).name || id;
  const actName = (id) => ((settings.actions || []).find((a) => a.id === id) || {}).name || id;
  const symActs = (id) => (settings.symptoms.find((s) => s.id === id) || {}).acts || {};
  const conds = new Set(condIds || []); const avoid = new Set(avoidOilIds || []);
  const th = settings.cautionPct ?? 10; const unknownBlock = (settings.unknownPct || 'block') === 'block';
  const allergy = (allergyText || '').replace(/\s/g, '');
  const hits = allergyHits(settings.allergens, allergyTags, allergyText);
  const subOf = {}; for (const c of cats) for (const sb of c.subs || []) subOf[sb.id] = { ...sb, cat: c };
  const cw = (c) => (autoConds[c] ? `（${autoConds[c]}）` : '');
  return oils.map((oil) => {
    let score = 0; const reasons = []; const blocks = []; const warns = [];
    const comp = oil.components || {}; const scored = oil.ref !== false;
    // 作用ごとに、いちばん強いつながりを1つ
    const link = (aid) => {
      let best = null;
      for (const sid of oil.subs || []) {
        const sb = subOf[sid]; if (!sb || !(sb.actions || []).includes(aid)) continue;
        const p = comp[sb.cat.id]; const f = p === 'tr' ? 0.5 : typeof p === 'number' ? 0.5 + Math.min(p, 100) / 200 : 0.75;
        const pt = has(comp, sb.cat.id) ? pctText(p) : '';
        if (!best || f > best.f) best = { f, text: sb.name === sb.cat.name ? `${sb.name}${pt ? `（${pt}）` : ''}` : `${sb.name}（${sb.cat.name}${pt ? '・' + pt : ''}）` };
      }
      if ((oil.actions || []).includes(aid)) best = best ? { f: Math.min(1.1, best.f + 0.1), text: best.text + '・効能のらんにもある' } : { f: 0.6, text: 'この精油の作用（効能のらん）' };
      return best;
    };
    if (scored) for (const s of symptoms || []) {
      const w = (s.level || 5) / 10;
      for (const [aid, k] of Object.entries(symActs(s.id))) {
        if (!(k > 0)) continue; const l = link(aid); if (!l) continue;
        score += w * k * l.f; reasons.push({ w: w * k * l.f, text: `「${symName(s.id)}」→ ${actName(aid)} ← ${l.text}` });
      }
      if ((oil.uses || []).includes(s.id)) { score += w; reasons.push({ w, text: `「${symName(s.id)}」← 資料の「OK」・使いどころにある場面` }); }
    }
    for (const c of oil.okConds || []) if (conds.has(c)) reasons.push({ w: -1, text: `資料の「OK」：「${condName(c)}」にも向いている` });
    // 気をつける点
    for (const c of oil.cautions || []) if (conds.has(c)) blocks.push(`「${condName(c)}」${cw(c)}のときは使わない精油として登録`);
    for (const c of oil.warns || []) if (conds.has(c)) warns.push(`「${condName(c)}」${cw(c)}のときは気をつけて（うすめる など）`);
    for (const cat of cats) {
      if (!has(comp, cat.id)) continue; const p = comp[cat.id];
      const known = typeof p === 'number'; if (known && !(p > 0)) continue;
      const strong = known ? p >= th : p !== 'tr'; // 微量は外す数に入れない
      for (const c of cat.cautions || []) {
        if (!conds.has(c) || !strong) continue;
        const ok = (oil.okConds || []).includes(c) ? `。ただし資料の「OK」には「${condName(c)}」がある（確かめてね）` : '';
        const t = `「${condName(c)}」${cw(c)}のときに気をつける成分（${cat.name}）が入っている（${pctText(p)}）${ok}`;
        if (known || unknownBlock) blocks.push(t); else warns.push(t);
      }
      const wc = (cat.warns || []).filter((c) => conds.has(c));
      if (wc.length) warns.push(`「${wc.map(condName).join('・')}」：${cat.name}が入っている（${pctText(p)}）${cat.tip ? '。' + cat.tip : ''}`);
      else if (cat.tip) warns.push(`${cat.name}が入っている：${cat.tip}`);
    }
    for (const a of oil.allergens || []) if (hits[a]) blocks.push(hits[a]);
    for (const a of settings.allergens || []) {
      if (!hits[a.id] || (oil.allergens || []).includes(a.id) || !a.plants || !oil.plant) continue;
      if (a.plants.split(/[、,\s]+/).filter(Boolean).includes(oil.plant)) blocks.push(`${hits[a.id]} ← この精油は${oil.plant}（資料の「種類」）`);
    }
    if (avoid.has(oil.id)) blocks.push('このお客さんの「避ける精油」に入っている');
    const base = oil.name.split(/[・（(]/)[0];
    if (allergy && base.length >= 2 && kanaLoose(allergy).includes(kanaLoose(base))) blocks.push(`アレルギーの欄に「${base}」と書いてある`);
    reasons.sort((a, b) => b.w - a.w);
    return { oil, score, reasons: reasons.map((r) => r.text), blocks: [...new Set(blocks)], warns: [...new Set(warns)] };
  }).sort((a, b) => b.score - a.score || a.oil.name.localeCompare(b.oil.name, 'ja'));
}

// キャリアオイルの特徴（えらぶ言葉）。1〜3 で持つ。分からないものは空ける。
export const TRAITS = [
  { id: 'feel', name: 'のび・重さ', opts: ['軽い（さらっと）', 'ふつう', '重い（こってり）'] },
  { id: 'oxid', name: '酸化しやすさ', opts: ['酸化しにくい', 'ふつう', '酸化しやすい'] },
  { id: 'scent', name: '香り', opts: ['香りはほとんどない', '香りが少しある', '香りが強め'] },
];
export const traitText = (c) => TRAITS.map((t) => t.opts[((c.traits || {})[t.id] || 0) - 1]).filter(Boolean);

// お客さんのアレルギー。押してえらんだしるし ＋ 自由に書いた欄に出てくる言葉 の両方を見る。
// 返すもの：{ しるしの番号: 理由の文 }
export function allergyHits(allergens, tags, text) {
  const t = (text || '').replace(/\s/g, ''); const out = {};
  for (const a of allergens || []) {
    if ((tags || []).includes(a.id)) { out[a.id] = `アレルギー「${a.name}」にあたる原料として登録`; continue; }
    const w = (a.words || '').split(/[、,\s]+/).filter((x) => x.length >= 2).find((x) => t.includes(x));
    if (w) out[a.id] = `アレルギーの欄に「${w}」と書いてある（${a.name}）`;
  }
  return out;
}

// キャリアオイルの候補。肌の状態 → 成分（脂肪酸など）→ その成分が多いオイル。目的は、オイルごとの登録から。
// 精油と同じく、気をつける点にあたるものは消さず、blocks（外した理由）をつけて返す。
export function pickCarriers({ carriers, skins, purposes, condIds, allergyTags, allergyText, avoidIds, settings }) {
  const skinName = (id) => (settings.skins.find((s) => s.id === id) || {}).name || id;
  const condName = (id) => (settings.conds.find((s) => s.id === id) || {}).name || id;
  const conds = new Set(condIds || []); const avoid = new Set(avoidIds || []);
  const hits = allergyHits(settings.allergens, allergyTags, allergyText);
  return carriers.map((car) => {
    let score = 0; const reasons = []; const blocks = [];
    for (const sid of skins || []) {
      for (const f of settings.fats || []) {
        const p = Number((car.fatty || {})[f.id]) || 0;
        if (p > 0 && (f.uses || []).includes(sid)) {
          score += p / 100;
          if (p >= 10) reasons.push({ w: p / 100, text: `「${skinName(sid)}」← ${f.name}が${p >= 40 ? '多い' : '入っている'}（約${p}％）` });
        }
      }
      if ((car.skins || []).includes(sid)) { score += 0.5; reasons.push({ w: 0.5, text: `「${skinName(sid)}」← このオイルの特徴として登録` }); }
    }
    for (const pu of purposes || []) if ((car.purposes || []).includes(pu)) { score += 0.5; reasons.push({ w: 0.45, text: `目的「${pu}」← このオイルの特徴として登録` }); }
    for (const a of car.allergens || []) if (hits[a]) blocks.push(hits[a]);
    for (const c of car.cautions || []) if (conds.has(c)) blocks.push(`「${condName(c)}」のときは気をつけるオイルとして登録`);
    if (avoid.has(car.id)) blocks.push('このお客さんの「避けるキャリアオイル」に入っている');
    reasons.sort((a, b) => b.w - a.w);
    return { oil: car, score, reasons: reasons.map((r) => r.text), blocks };
  }).sort((a, b) => b.score - a.score || a.oil.name.localeCompare(b.oil.name, 'ja'));
}

// お客さんを探す（名前・ふりがな・カルテ番号）
const norm = (s) => (s || '').toLowerCase().replace(/[\s　]/g, '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
export function searchPeople(people, q) {
  const k = norm(q); if (!k) return people;
  return people.filter((p) => (p._k || (p._k = norm(p.name) + '|' + norm(p.kana) + '|' + p.no)).includes(k));
}
