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

// 精油の候補。症状 → 成分の分類 → その成分が多い精油。
// 気をつける点にあたるものは消さず、blocks（外した理由）をつけて返す。
export function pickOils({ oils, cats, symptoms, condIds, avoidOilIds, allergyText, settings }) {
  const symName = (id) => (settings.symptoms.find((s) => s.id === id) || {}).name || id;
  const condName = (id) => (settings.conds.find((s) => s.id === id) || {}).name || id;
  const conds = new Set(condIds || []); const avoid = new Set(avoidOilIds || []);
  const th = settings.cautionPct ?? 10; const allergy = (allergyText || '').replace(/\s/g, '');
  return oils.map((oil) => {
    let score = 0; const reasons = []; const blocks = [];
    for (const s of symptoms || []) {
      const w = (s.level || 5) / 10;
      for (const cat of cats) {
        const p = Number((oil.components || {})[cat.id]) || 0;
        if (p > 0 && (cat.uses || []).includes(s.id)) {
          score += w * p / 100;
          if (p >= 10) reasons.push({ w: w * p / 100, text: `「${symName(s.id)}」← ${cat.name}が${p >= 40 ? '多い' : '入っている'}（約${p}％）` });
        }
      }
      if ((oil.uses || []).includes(s.id)) { score += w * 0.5; reasons.push({ w: w * 0.5, text: `「${symName(s.id)}」← この精油の特徴として登録` }); }
    }
    for (const c of oil.cautions || []) if (conds.has(c)) blocks.push(`「${condName(c)}」のときは気をつける精油として登録`);
    for (const cat of cats) {
      const p = Number((oil.components || {})[cat.id]) || 0;
      if (p >= th) for (const c of cat.cautions || []) if (conds.has(c)) blocks.push(`「${condName(c)}」のときに気をつける成分（${cat.name}）が約${p}％`);
    }
    if (avoid.has(oil.id)) blocks.push('このお客さんの「避ける精油」に入っている');
    const base = oil.name.split(/[・（(]/)[0];
    if (allergy && base.length >= 2 && allergy.includes(base)) blocks.push(`アレルギーの欄に「${base}」と書いてある`);
    reasons.sort((a, b) => b.w - a.w);
    return { oil, score, reasons: reasons.map((r) => r.text), blocks };
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
