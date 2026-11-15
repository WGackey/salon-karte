import { h, fill, page, card, btn, badge, go, chips, field, group, input, textarea, toast, confirmDlg, sheet } from '../ui.js';
import { signPad } from '../signpad.js';
import { S, blankCustomer, saveCustomer, deleteCustomer, person, visitsOf, newVisit, saveVisit } from '../state.js';
import * as db from '../db.js';
import { ageOf, jpDate, todayStr, addDays, blendCalc, limitFor, limitLevel, effectiveConds, noTouchAll, consentState, intakeInfo } from '../logic.js';
import { handoverSheet, startHandover } from './guest.js';
const allergenName = (id) => (S.settings.allergens.find((c) => c.id === id) || {}).name || '';
import { bodyPad } from '../bodymap.js';
import { FIGS, figsOf, isPart, scopeText } from '../parts.js';

const condName = (id) => (S.settings.conds.find((c) => c.id === id) || {}).name || '';
const symName = (id) => (S.settings.symptoms.find((c) => c.id === id) || {}).name || '';
export function blendText(b) {
  const o = (b.oils || []).filter((x) => x.drops > 0).map((x) => `${x.name} ${x.drops}滴`).join('・');
  const c = (b.carriers || []).filter((x) => x.ml > 0).map((x) => `${x.name} ${x.ml}ml`).join('・');
  return [o, c].filter(Boolean).join(' ／ ');
}
export function visitSummary(v) {
  const sy = v.interview.symptoms.map((s) => {
    const a = v.after.levels[s.id]; return `${symName(s.id)} ${s.level}${a != null ? '→' + a : ''}`;
  }).join('、');
  return [isPart(v.scope) ? scopeText(S.settings, v.scope) : '', sy, v.menus.map((m) => `${m.name}${m.minutes ? m.minutes + '分' : ''}`).join('・'), blendText(v.blend)].filter(Boolean);
}

// 生活の様子。初回に聞いて、変わったときに直す（毎回の問診には出さない）
const LIFE = [
  { id: 'sleep', name: '睡眠', unit: '時間くらい', num: true },
  { id: 'meal', name: '食事', opts: ['規則的', '不規則'] }, { id: 'meals', name: '食事の回数', unit: '回／日', num: true },
  { id: 'bowel', name: 'お通じ', opts: ['快便', '便秘ぎみ', 'ゆるめ'] },
  { id: 'exercise', name: '運動', unit: '回／週', num: true },
  { id: 'smoke', name: 'たばこ', unit: '本／日', num: true }, { id: 'alcohol', name: 'お酒', unit: '回／週', num: true },
  { id: 'sweets', name: 'お菓子', opts: ['多い', '少ない'] },
];
export function lifeText(life = {}) {
  return LIFE.filter((f) => life[f.id] != null && life[f.id] !== '').map((f) => `${f.name} ${life[f.id]}${f.num ? f.unit : ''}`).join('・');
}
export function lifeFields(det, onChange) {
  det.life = det.life || {}; const ch = () => { det.life.updated = todayStr(); onChange && onChange(); };
  return [LIFE.map((f) => f.num
    ? h('div', { class: 'edit-row' }, h('div', { class: 'grow' }, f.name), h('span', { class: 'row tight' }, input(det.life, f.id, { type: 'number', inputmode: 'decimal', cls: 'num', onInput: ch }), f.unit))
    : group(f.name, chips(f.opts, det.life[f.id] || '', { multi: false, onChange: (v) => { det.life[f.id] = v; ch(); } }))),
  field('そのほか（生活の様子）', textarea(det.life, 'memo', { rows: 2, onInput: ch }))];
}
function lifeCard(det) {
  return card(h('h2', null, '生活の様子'), h('p', { class: 'hint' }, 'はじめに聞いて、あとは変わったときに直します（毎回の問診には出ません）。分からないところは空けたままで。'), lifeFields(det));
}

// 生年月日は 年・月・日 を別々にえらぶ（iPad の日付えらびは昔の年まで回すのが大変なので）
export function birthPicker(det, onChange) {
  const [y, m, d] = (det.birth || '--').split('-'); const now = new Date().getFullYear();
  const mk = (cur, from, to, unit, step = 1) => {
    const s = h('select', { class: 'input sel', 'aria-label': unit }); s.append(h('option', { value: '' }, '—'));
    for (let i = from; step > 0 ? i <= to : i >= to; i += step) { const v = String(i).padStart(2, '0'); s.append(h('option', { value: v, selected: v === cur || String(i) === cur }, `${i}${unit}`)); }
    return s;
  };
  const ys = mk(y, now, 1920, '年', -1), ms = mk(m, 1, 12, '月'), ds = mk(d, 1, 31, '日');
  const age = h('span', { class: 'muted' });
  const upd = () => {
    det.birth = ys.value && ms.value && ds.value ? `${ys.value}-${ms.value}-${ds.value}` : '';
    const a = ageOf(det.birth); age.textContent = a != null ? `${a}歳` : '';
  };
  [ys, ms, ds].forEach((s) => { s.onchange = () => { upd(); onChange && onChange(); }; }); upd();
  return h('div', { class: 'row' }, ys, ms, ds, age);
}

export async function customerFormView(id) {
  let slim, det;
  if (id) { const p = person(id); if (!p) return notFound(); slim = { ...p }; det = (await db.get('details', id)) || blankCustomer().det; }
  else ({ slim, det } = blankCustomer());
  const personConds = S.settings.conds.filter((c) => c.when === 'person');
  const save = async () => {
    if (!slim.name.trim()) { toast('お名前を入れてね'); return; }
    slim.name = slim.name.trim(); slim.kana = slim.kana.trim();
    await saveCustomer(id ? Object.assign(person(id), slim) : slim, det);
    toast('保存しました'); go(`#/c/${slim.id}`);
  };
  const avoidWrap = h('details', { class: 'fold' }, h('summary', null, `避ける精油をえらぶ（いま ${det.avoidOilIds.length} 本）`),
    chips(S.oils, det.avoidOilIds, { onChange: (v) => { det.avoidOilIds = v; avoidWrap.querySelector('summary').textContent = `避ける精油をえらぶ（いま ${v.length} 本）`; } }));
  det.avoidCarrierIds = det.avoidCarrierIds || [];
  const avoidCarWrap = h('details', { class: 'fold' }, h('summary', null, `避けるキャリアオイルをえらぶ（いま ${det.avoidCarrierIds.length} 種類）`),
    chips(S.carriers, det.avoidCarrierIds, { onChange: (v) => { det.avoidCarrierIds = v; avoidCarWrap.querySelector('summary').textContent = `避けるキャリアオイルをえらぶ（いま ${v.length} 種類）`; } }));
  return page({
    title: id ? 'お客さんの情報を直す' : '新しいお客さん', back: id ? `#/c/${id}` : '#/',
    body: [
      card(h('h2', null, 'きほん'),
        h('div', { class: 'grid2' }, field('お名前（必須）', input(slim, 'name', { placeholder: '山田 花子' })), field('ふりがな', input(slim, 'kana', { placeholder: 'やまだ はなこ' }))),
        group('性別', chips(['女性', '男性', 'そのほか'], det.gender, { multi: false, onChange: (v) => { det.gender = v; } })),
        group('生年月日', birthPicker(det)),
        group('お仕事', chips(S.settings.jobs, det.job, { multi: false, onChange: (v) => { det.job = v; } })),
        field('はじめて来た日', input(det, 'firstVisit', { type: 'date' }))),
      card(h('h2', null, '気をつけること'),
        group('からだの状態', chips(personConds, det.conds, { onChange: (v) => { det.conds = v; } }), '精油の候補と濃度の目安に使います。妊娠中・月経中・運転などは、来店ごとの問診でえらびます。生年月日があれば、乳幼児・子ども・高齢は自動でつきます'),
        field('これまでの病気・けが', textarea(det, 'history')),
        group('アレルギー（あてはまるものを押す）', chips(S.settings.allergens, det.allergyTags || [], { onChange: (v) => { det.allergyTags = v; } }), 'あてはまる原料のキャリアオイルは、候補から外して知らせます'),
        field('アレルギー（そのほか・くわしく）', textarea(det, 'allergy', { placeholder: '例：ナッツ、ラベンダー' }), '精油やオイルの原料の名前が書いてあると、候補から外して知らせます'),
        avoidWrap, avoidCarWrap,
        field('ほかで受けた施術', textarea(det, 'experience'))),
      lifeCard(det),
      card(h('h2', null, '連絡先'),
        h('div', { class: 'grid2' }, field('電話', input(det, 'tel', { type: 'tel' })), field('メール', input(det, 'email', { type: 'email' })),
          field('郵便番号', input(det, 'zip', { inputmode: 'numeric' })), field('住所', input(det, 'address')))),
      card(h('h2', null, '自由メモ'), textarea(det, 'memo', { rows: 4 })),
      id ? h('div', { class: 'row end' }, btn('このお客さんを消す', async () => {
        if (await confirmDlg(`「${slim.name}」さんと、その来店の記録をすべて消します。元に戻せません。`, '消す', true)) { await deleteCustomer(id); toast('消しました'); go('#/'); }
      }, 'danger ghost')) : null,
    ],
    footer: btn('保存する', save, 'primary big wide'),
  });
}

// これまでの記録を、横にめくってさかのぼる（新しい順）。どの回も同じ並び・同じ大きさで出すので、めくると変化が目に入る。
// 回数が多くても重くならないように、中身を作るのは「いま見ている回と、その前後」だけ。
function history(visits, det, copyFrom, startIdx = 0, customerId = '') {
  const n = visits.length; const today = todayStr(); let idx = Math.max(0, Math.min(n - 1, startIdx | 0)); let figMode = 'both'; // 図の見せ方：both 両方／guest お客さん／staff 施術者
  const dropMl = S.settings.dropMl || 0.05;
  // 図の小さな写し。全身＝前・後ろ／部分＝その部位の図（多いときは、線のある図を先に4つまで）。押すと大きく見られる
  const padOf = (v, f) => bodyPad({ kind: f.id, marks: S.settings.marks, readOnly: true, layer: figMode === 'guest' ? 'guest' : 'staff',
    strokes: (figMode === 'guest' ? (v.guestFigures || {})[f.id] : (v.figures || {})[f.id]) || [],
    under: figMode === 'both' ? [{ strokes: (v.guestFigures || {})[f.id] || [], layer: 'guest' }] : [] });
  const thumbs = (v) => {
    const all = figsOf(v.scope); const part = isPart(v.scope); const drawn = (f) => ((v.figures || {})[f.id] || []).length + ((v.guestFigures || {})[f.id] || []).length > 0;
    const show = all.length > 4 ? [...all.filter(drawn), ...all.filter((f) => !drawn(f))].slice(0, 4) : all;
    const big = () => sheet(`${jpDate(v.date)} の図${part ? `（${scopeText(S.settings, v.scope)}）` : ''}`, h('div', { class: 'bigfigs' }, all.map((f) => h('div', { class: 'padwrap' }, h('div', { class: 'padname' }, f.name), padOf(v, f)))), { wide: true });
    return h('button', { type: 'button', class: 'thumbs' + (part ? ' pt n' + show.length : ''), 'aria-label': '図を大きく見る', onclick: big },
      show.map((f) => h('div', { class: 'thumb' }, h('span', { class: 'small muted' }, f.name), padOf(v, f))),
      h('span', { class: 'zoomtag' }, all.length > show.length ? `⤢ ぜんぶ見る（${all.length}）` : '⤢ 大きく見る'));
  };
  const slideOf = (v, k) => {
    const nth = n - k; const c = blendCalc(v.blend, dropMl);
    const lim = limitFor(S.settings, v.blend.areaId, effectiveConds({ settings: S.settings, det, visit: v, today: v.date }).ids); const lv = limitLevel(c.pct, lim.max);
    const oils = (v.blend.oils || []).filter((x) => x.drops > 0), cars = (v.blend.carriers || []).filter((x) => x.ml > 0);
    const conds = (v.conds || []).map(condName).filter(Boolean);
    const row = (label, ...kids) => h('div', { class: 'hrow' }, h('div', { class: 'hlabel' }, label), h('div', { class: 'hval' }, kids.some((x) => x != null && x !== '' && !(Array.isArray(x) && !x.length)) ? kids : h('span', { class: 'muted' }, '—')));
    return [
      h('div', { class: 'hhead' }, h('b', null, jpDate(v.date)), h('span', { class: 'muted' }, `${nth}回目`),
        v.date === today && v.status === 'draft' ? badge('今日・書きかけ', 'amber') : k === 0 ? badge('いちばん新しい記録') : badge(`${k}回前`, 'draft'), isPart(v.scope) ? badge(scopeText(S.settings, v.scope), 'part') : null, conds.map((x) => badge(x, 'warn'))),
      h('div', { class: 'hbody' },
        thumbs(v),
        h('div', { class: 'hrows' },
          row('つらさ（前→後）', v.interview.symptoms.map((s) => { const a = v.after.levels[s.id]; return h('div', { class: 'hsym' }, `${symName(s.id) || '（消した症状）'} ${s.level}${a != null ? '→' + a : ''}`, a != null && a < s.level ? h('span', { class: 'down' }, ` ▼${s.level - a}`) : a != null && a > s.level ? h('span', { class: 'up' }, ` ▲${a - s.level}`) : null); })),
          row('ブレンド', oils.length || cars.length ? [h('div', null, oils.map((x) => `${x.name} ${x.drops}滴`).join('・') || '精油なし'), h('div', null, cars.map((x) => `${x.name} ${x.ml}ml`).join('・') || 'キャリアオイルなし')] : null),
          row('濃度', c.pct != null ? h('span', { class: 'hpct ' + lv }, `${c.pct.toFixed(1)}％`, lv === 'over' ? '（目安をこえている）' : '') : null),
          row('書いた人', intakeInfo(v).text),
          row('メニュー', v.menus.map((m) => `${m.name}${m.minutes ? m.minutes + '分' : ''}`).join('・')),
          row('施術後', [v.after.scent ? `香り：${v.after.scent}` : '', v.after.note].filter(Boolean).join('　') || null))),
      h('div', { class: 'row hact' }, h('a', { class: 'btn', href: `#/v/${v.id}/monshin` }, 'この回のカルテを開く ›'),
        v.date === today ? null : btn('この回の問診とブレンドを今日に写す', () => copyFrom(v))),
    ];
  };
  const slides = visits.map(() => h('div', { class: 'slide' }));
  const made = new Set();
  const make = (i) => { if (i < 0 || i >= n || made.has(i)) return; made.add(i); fill(slides[i], ...slideOf(visits[i], i)); };
  const track = h('div', { class: 'track', tabindex: '0', 'aria-label': 'これまでの記録（横にめくる）' }, slides);
  const pos = h('span', { class: 'hpos' }); const dots = h('span', { class: 'hdots' });
  const newer = btn('‹ 新しい', () => goTo(idx - 1), 'chip'), older = btn('古い ›', () => goTo(idx + 1), 'chip');
  const show = () => {
    make(idx); make(idx + 1); make(idx - 1);
    pos.textContent = `${idx + 1}／全${n}回（新しい順）`; newer.disabled = idx === 0; older.disabled = idx === n - 1;
    fill(dots, ...(n > 1 && n <= 12 ? visits.map((_, i) => h('i', { class: i === idx ? 'on' : '' })) : []));
  };
  const goTo = (i) => { idx = Math.max(0, Math.min(n - 1, i)); track.scrollTo({ left: slides[idx].offsetLeft - track.offsetLeft, behavior: 'smooth' }); show(); };
  let raf = 0;
  track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth)); if (i !== idx && i >= 0 && i < n) { idx = i; show(); } }); }, { passive: true });
  show();
  if (idx > 0) requestAnimationFrame(() => track.scrollTo({ left: slides[idx].offsetLeft - track.offsetLeft })); // 経過のページから「この回を見る」で来たとき
  // 図は2つ：お客さんの「気になるところ」（つぶつぶの線）と、施術する人の「所見」（ぬった線）。重ねる・片方だけを切りかえ
  const figSel = h('div', { class: 'figsel' }, h('span', { class: 'small' }, '図：'),
    chips([{ id: 'both', name: '両方を重ねる' }, { id: 'guest', name: 'お客さんの「気になるところ」' }, { id: 'staff', name: '施術者の「所見」' }], figMode, { multi: false, cls: 'tight', onChange: (x) => { figMode = x || 'both'; figSel.querySelectorAll('.chip').forEach((c, i) => c.classList.toggle('on', ['both', 'guest', 'staff'][i] === figMode)); made.clear(); show(); } }),
    h('span', { class: 'legend' }, h('i', { class: 'lg guest' }), 'つぶつぶ＝お客さん', h('i', { class: 'lg staff' }), 'ぬった線＝施術者'));
  return h('section', { class: 'card hist' },
    h('div', { class: 'histhead' }, h('div', { class: 'grow' }, h('h2', null, 'これまでの記録'), h('p', { class: 'hint' }, '1回ずつ くわしく見る：ここで横にめくる　／　ぜんぶの回を並べて見る：経過のページ')),
      h('a', { class: 'btn keikabtn', href: `#/c/${customerId}/keika` }, '📈 経過を並べて見る ›')), figSel,
    n > 1 ? h('div', { class: 'hnav' }, newer, h('div', { class: 'hmid' }, pos, dots), older) : null,
    track, n > 1 ? h('p', { class: 'hint center' }, '横にめくる（スワイプする）と、前の回にさかのぼれます。') : null);
}

// 「触れないで」の線だけを、小さな図で見せる
export function noTouchFigures(noTouch) {
  return h('div', { class: 'thumbs notouchfig' }, Object.values(FIGS).filter((f) => noTouch[f.id]).map((f) => h('div', { class: 'padwrap' }, h('div', { class: 'padname' }, f.name),
    bodyPad({ kind: f.id, strokes: noTouch[f.id], marks: S.settings.marks, readOnly: true }))));
}
// 同意書：いちばん新しい同意と、サインをもらうボタン（お客さん用の画面に切りかえて書いてもらう）
function consentCard(p, cs) {
  const cur = S.settings.consent || { ver: 1 };
  const show = () => sheet(`${jpDate(cs.last.at.slice(0, 10))} の同意（文の版 ${cs.last.ver}）`, h('div', null,
    cs.last.salon || cs.last.staff ? h('p', { class: 'muted' }, [cs.last.salon, cs.last.staff ? `施術する人：${cs.last.staff}` : ''].filter(Boolean).join('　')) : null,
    h('p', { class: 'pre consenttext' }, cs.last.text), h('div', { class: 'signbox' }, signPad({ strokes: cs.last.sign || [], readOnly: true }))));
  return card(h('h2', null, '同意書'),
    cs.last ? h('p', null, `${jpDate(cs.last.at.slice(0, 10))} に同意・サインあり（文の版 ${cs.last.ver}）`, cs.stale ? h('span', { class: 'warntext' }, `　いまの文は版 ${cur.ver}。直したあとの文には、まだ同意をもらっていません`) : null)
      : h('p', { class: 'muted' }, 'まだ同意をもらっていません'),
    h('div', { class: 'row' }, btn(cs.last ? 'もう一度サインしてもらう' : '同意書にサインしてもらう', () => startHandover(p, ['consent'], null), cs.last && !cs.stale ? '' : 'primary'),
      cs.last ? btn('同意した文とサインを見る', show, 'ghost') : null),
    h('p', { class: 'hint' }, '押すと、お客さん用の画面（同意書とサインだけ）に切りかわります。戻るには合言葉が要ります。'));
}

export const notFound = () => page({ title: '見つかりません', back: '#/', body: h('p', { class: 'muted pad' }, 'このページは見つかりませんでした。') });

export async function customerView(id) {
  const p = person(id); if (!p) return notFound();
  const det = (await db.get('details', id)) || blankCustomer().det;
  const t0 = performance.now(); const visits = await visitsOf(id); S.lastOpenMs = performance.now() - t0;
  const last = visits.find((v) => v.status === 'done') || visits[0];
  const age = ageOf(det.birth); const tags = (det.allergyTags || []).map(allergenName).filter(Boolean);
  const warns = [...det.conds.map(condName), ...(last ? last.conds.filter((c) => !['c_sun', 'c_mens', 'c_drive', 'c_drink'].includes(c)).map((c) => condName(c) + '（前回）') : [])].filter(Boolean);
  const noTouch = visits[0] ? noTouchAll(visits[0], S.settings.marks) : {};
  const hasNoTouch = Object.keys(noTouch).length > 0;
  const cs = consentState(det.consents, S.settings.consent); const life = lifeText(det.life);

  const start = async () => {
    const draft = visits.find((v) => v.status === 'draft' && v.date === todayStr());
    // 「今日の来店をはじめる」＝施術する人が聞きながら書く回。新しく作った回にだけ「施術者が聞き取って書いた」をつける（前からある書きかけには、うその印をつけない）
    const v = draft || await newVisit(id, { by: 'staff' }); go(`#/v/${v.id}/monshin`);
  };
  // めくった先の回の問診とブレンドを、今日のカルテに写す（今日のカルテがなければ作る）
  const copyFrom = async (src) => {
    const draft = visits.find((v) => v.date === todayStr() && v.id !== src.id);
    if (!(await confirmDlg(`${jpDate(src.date)} の問診とブレンドを、今日のカルテに写します。${draft ? '\n今日のカルテにもう書いてある問診とブレンドは、入れ替わります。' : ''}\n（からだの図・施術・施術後は写しません）`, '写す'))) return;
    const v = draft || await newVisit(id, { by: 'staff' }); const c = (o) => JSON.parse(JSON.stringify(o));
    v.interview = { skins: [], ...c(src.interview), memo: '' }; v.blend = c(src.blend); v.copied = true; v.status = 'draft';
    await saveVisit(v); toast('写しました。変わったところだけ直してね'); go(`#/v/${v.id}/monshin`);
  };
  const nextIn = h('input', { type: 'date', class: 'input', value: p.nextDate, 'aria-label': '次回の予定日' });
  const timeIn = h('input', { type: 'time', class: 'input timein', value: p.nextTime || '', step: 300, 'aria-label': '次回の予定の時間' });
  const setNext = async (d) => { p.nextDate = d; nextIn.value = d; if (!d) { p.nextTime = ''; timeIn.value = ''; } await saveCustomer(p, null); toast(d ? `次回：${jpDate(d)}${p.nextTime ? ' ' + p.nextTime : ''}` : '予定を消しました'); fill(lateBox, lateNote()); };
  nextIn.onchange = () => setNext(nextIn.value);
  timeIn.onchange = async () => { p.nextTime = timeIn.value; if (p.nextDate) { await saveCustomer(p, null); toast(`次回：${jpDate(p.nextDate)}${p.nextTime ? ' ' + p.nextTime : ''}`); } };
  // 予定日を過ぎて、来店の記録がないとき（来店をはじめると、予定は自動で消える）
  const lateBox = h('div');
  const lateNote = () => (p.nextDate && p.nextDate < todayStr() ? h('div', { class: 'notice amber latenote' }, h('span', { class: 'grow' }, `予定日（${jpDate(p.nextDate, false)}）を過ぎています。来店の記録がありません。`),
    btn('予定を消す', () => setNext(''), 'chip'), btn('1週間後にする', () => setNext(addDays(todayStr(), 7)), 'chip')) : null);
  fill(lateBox, lateNote());

  return page({
    title: p.name, sub: [p.kana, `No.${p.no}`, det.gender, age != null ? `${age}歳` : '', det.job].filter(Boolean).join('・'),
    back: '#/', actions: h('a', { class: 'btn ghost', href: `#/c/${id}/edit` }, '情報を直す'),
    body: [
      lateBox,
      (warns.length || det.allergy || tags.length || det.history || hasNoTouch) ? h('div', { class: 'warnbox' },
        h('strong', null, '⚠ 気をつけること'),
        warns.length ? h('div', { class: 'chips' }, warns.map((w) => badge(w, 'warn'))) : null,
        det.allergy || tags.length ? h('p', null, h('b', null, 'アレルギー：'), [...tags, det.allergy].filter(Boolean).join('／')) : null,
        det.history ? h('p', null, h('b', null, 'これまでの病気・けが：'), det.history) : null,
        hasNoTouch ? h('div', null, h('p', null, h('b', null, '✕ 触れないでほしいところがあります')), noTouchFigures(noTouch)) : null) : null,
      consentCard(p, cs),
      visits.length ? history(visits, det, copyFrom, Number(new URLSearchParams((location.hash.split('?')[1] || '')).get('k')) || 0, id) : null,
      det.memo ? card(h('h2', null, 'メモ'), h('p', { class: 'pre' }, det.memo)) : null,
      card(h('h2', null, '生活の様子'), h('p', null, life || h('span', { class: 'muted' }, 'まだ聞いていません（「情報を直す」で入れられます）')),
        life && det.life.updated ? h('p', { class: 'muted small' }, `${jpDate(det.life.updated)} に直した`) : null),
      card(h('h2', null, '次回の予定日'), h('div', { class: 'row' }, nextIn, timeIn,
        btn('1週間後', () => setNext(addDays(todayStr(), 7))), btn('2週間後', () => setNext(addDays(todayStr(), 14))), btn('1か月後', () => setNext(addDays(todayStr(), 28))),
        p.nextDate ? btn('消す', () => setNext(''), 'ghost') : null)),
      card(h('h2', null, '来店の記録 ', badge(`${visits.length}回`)),
        visits.length ? h('div', { class: 'list' }, visits.map((v, i) => h('a', { class: 'row-link', href: `#/v/${v.id}/monshin` },
          h('div', { class: 'grow' }, h('div', { class: 'name' }, jpDate(v.date), ' ', h('span', { class: 'muted' }, `${visits.length - i}回目`), v.status === 'draft' ? badge('書きかけ', 'amber') : null),
            h('div', { class: 'muted' }, visitSummary(v).join(' ｜ ') || '（まだ何も書いていません）')),
          h('span', { class: 'chev' }, '›')))) : h('p', { class: 'muted' }, 'まだ来店の記録がありません')),
    ],
    // 問診は「お客さんに渡す」「聞きながら書く」のどちらでもできる。はじめに大きく出す方は、設定で変えられる（初回／2回目から）
    footer: (() => {
      const today = visits.find((v) => v.status === 'draft' && v.date === todayStr());
      const mode = (S.settings.handover || {})[visits.some((v) => v.status === 'done') ? 'repeat' : 'first'] || 'staff';
      const self = btn(today ? '今日のカルテのつづきを書く' : '今日の来店をはじめる', start, 'big ' + (mode === 'staff' ? 'primary grow' : ''));
      const hand = btn('お客さんに渡す', () => handoverSheet(p, det, today || null), 'big handbtn ' + (mode === 'guest' ? 'primary grow' : ''));
      return mode === 'guest' ? [self, hand] : [hand, self];
    })(),
  });
}
