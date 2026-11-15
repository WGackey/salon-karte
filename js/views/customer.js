import { h, fill, page, card, btn, badge, go, chips, field, group, input, textarea, toast, confirmDlg } from '../ui.js';
import { S, blankCustomer, saveCustomer, deleteCustomer, person, visitsOf, newVisit, saveVisit } from '../state.js';
import * as db from '../db.js';
import { ageOf, jpDate, todayStr, addDays, blendCalc, limitFor, limitLevel, effectiveConds } from '../logic.js';
const allergenName = (id) => (S.settings.allergens.find((c) => c.id === id) || {}).name || '';
import { bodyPad, FIGURES } from '../bodymap.js';

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
  return [sy, v.menus.map((m) => `${m.name}${m.minutes ? m.minutes + '分' : ''}`).join('・'), blendText(v.blend)].filter(Boolean);
}

// 生年月日は 年・月・日 を別々にえらぶ（iPad の日付えらびは昔の年まで回すのが大変なので）
function birthPicker(det, onChange) {
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
    const a = ageOf(det.birth); age.textContent = a != null ? `${a}歳` : ''; onChange && onChange();
  };
  [ys, ms, ds].forEach((s) => { s.onchange = upd; }); upd();
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
function history(visits, det, copyFrom) {
  const n = visits.length; const today = todayStr(); let idx = 0;
  const dropMl = S.settings.dropMl || 0.05;
  const slideOf = (v, k) => {
    const nth = n - k; const c = blendCalc(v.blend, dropMl);
    const lim = limitFor(S.settings, v.blend.areaId, effectiveConds({ settings: S.settings, det, visit: v, today: v.date }).ids); const lv = limitLevel(c.pct, lim.max);
    const oils = (v.blend.oils || []).filter((x) => x.drops > 0), cars = (v.blend.carriers || []).filter((x) => x.ml > 0);
    const conds = (v.conds || []).map(condName).filter(Boolean);
    const row = (label, ...kids) => h('div', { class: 'hrow' }, h('div', { class: 'hlabel' }, label), h('div', { class: 'hval' }, kids.some((x) => x != null && x !== '' && !(Array.isArray(x) && !x.length)) ? kids : h('span', { class: 'muted' }, '—')));
    return [
      h('div', { class: 'hhead' }, h('b', null, jpDate(v.date)), h('span', { class: 'muted' }, `${nth}回目`),
        v.date === today && v.status === 'draft' ? badge('今日・書きかけ', 'amber') : k === 0 ? badge('いちばん新しい記録') : badge(`${k}回前`, 'draft'), conds.map((x) => badge(x, 'warn'))),
      h('div', { class: 'hbody' },
        h('div', { class: 'thumbs' }, FIGURES.map((f) => h('div', { class: 'thumb' }, h('span', { class: 'small muted' }, f.name), bodyPad({ kind: f.id, strokes: v.figures[f.id] || [], marks: S.settings.marks, readOnly: true })))),
        h('div', { class: 'hrows' },
          row('つらさ（前→後）', v.interview.symptoms.map((s) => { const a = v.after.levels[s.id]; return h('div', { class: 'hsym' }, `${symName(s.id) || '（消した症状）'} ${s.level}${a != null ? '→' + a : ''}`, a != null && a < s.level ? h('span', { class: 'down' }, ` ▼${s.level - a}`) : a != null && a > s.level ? h('span', { class: 'up' }, ` ▲${a - s.level}`) : null); })),
          row('ブレンド', oils.length || cars.length ? [h('div', null, oils.map((x) => `${x.name} ${x.drops}滴`).join('・') || '精油なし'), h('div', null, cars.map((x) => `${x.name} ${x.ml}ml`).join('・') || 'キャリアオイルなし')] : null),
          row('濃度', c.pct != null ? h('span', { class: 'hpct ' + lv }, `${c.pct.toFixed(1)}％`, lv === 'over' ? '（目安をこえている）' : '') : null),
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
  return h('section', { class: 'card hist' },
    h('h2', null, 'これまでの記録'),
    n > 1 ? h('div', { class: 'hnav' }, newer, h('div', { class: 'hmid' }, pos, dots), older) : null,
    track, n > 1 ? h('p', { class: 'hint center' }, '横にめくる（スワイプする）と、前の回にさかのぼれます。') : null);
}

export const notFound = () => page({ title: '見つかりません', back: '#/', body: h('p', { class: 'muted pad' }, 'このページは見つかりませんでした。') });

export async function customerView(id) {
  const p = person(id); if (!p) return notFound();
  const det = (await db.get('details', id)) || blankCustomer().det;
  const t0 = performance.now(); const visits = await visitsOf(id); S.lastOpenMs = performance.now() - t0;
  const last = visits.find((v) => v.status === 'done') || visits[0];
  const age = ageOf(det.birth); const tags = (det.allergyTags || []).map(allergenName).filter(Boolean);
  const warns = [...det.conds.map(condName), ...(last ? last.conds.filter((c) => !['c_sun', 'c_mens', 'c_drive', 'c_drink'].includes(c)).map((c) => condName(c) + '（前回）') : [])].filter(Boolean);

  const start = async () => {
    const draft = visits.find((v) => v.status === 'draft' && v.date === todayStr());
    const v = draft || await newVisit(id); go(`#/v/${v.id}/monshin`);
  };
  // めくった先の回の問診とブレンドを、今日のカルテに写す（今日のカルテがなければ作る）
  const copyFrom = async (src) => {
    const draft = visits.find((v) => v.date === todayStr() && v.id !== src.id);
    if (!(await confirmDlg(`${jpDate(src.date)} の問診とブレンドを、今日のカルテに写します。${draft ? '\n今日のカルテにもう書いてある問診とブレンドは、入れ替わります。' : ''}\n（からだの図・施術・施術後は写しません）`, '写す'))) return;
    const v = draft || await newVisit(id); const c = (o) => JSON.parse(JSON.stringify(o));
    v.interview = { skins: [], ...c(src.interview), memo: '' }; v.blend = c(src.blend); v.copied = true; v.status = 'draft';
    await saveVisit(v); toast('写しました。変わったところだけ直してね'); go(`#/v/${v.id}/monshin`);
  };
  const nextIn = h('input', { type: 'date', class: 'input', value: p.nextDate, 'aria-label': '次回の予定日' });
  const setNext = async (d) => { p.nextDate = d; nextIn.value = d; await saveCustomer(p, null); toast(d ? `次回：${jpDate(d)}` : '予定を消しました'); };
  nextIn.onchange = () => setNext(nextIn.value);

  return page({
    title: p.name, sub: [p.kana, `No.${p.no}`, det.gender, age != null ? `${age}歳` : '', det.job].filter(Boolean).join('・'),
    back: '#/', actions: h('a', { class: 'btn ghost', href: `#/c/${id}/edit` }, '情報を直す'),
    body: [
      (warns.length || det.allergy || tags.length || det.history) ? h('div', { class: 'warnbox' },
        h('strong', null, '⚠ 気をつけること'),
        warns.length ? h('div', { class: 'chips' }, warns.map((w) => badge(w, 'warn'))) : null,
        det.allergy || tags.length ? h('p', null, h('b', null, 'アレルギー：'), [...tags, det.allergy].filter(Boolean).join('／')) : null,
        det.history ? h('p', null, h('b', null, 'これまでの病気・けが：'), det.history) : null) : null,
      visits.length ? history(visits, det, copyFrom) : null,
      det.memo ? card(h('h2', null, 'メモ'), h('p', { class: 'pre' }, det.memo)) : null,
      card(h('h2', null, '次回の予定日'), h('div', { class: 'row' }, nextIn,
        btn('1週間後', () => setNext(addDays(todayStr(), 7))), btn('2週間後', () => setNext(addDays(todayStr(), 14))), btn('1か月後', () => setNext(addDays(todayStr(), 28))),
        p.nextDate ? btn('消す', () => setNext(''), 'ghost') : null)),
      card(h('h2', null, '来店の記録 ', badge(`${visits.length}回`)),
        visits.length ? h('div', { class: 'list' }, visits.map((v, i) => h('a', { class: 'row-link', href: `#/v/${v.id}/monshin` },
          h('div', { class: 'grow' }, h('div', { class: 'name' }, jpDate(v.date), ' ', h('span', { class: 'muted' }, `${visits.length - i}回目`), v.status === 'draft' ? badge('書きかけ', 'amber') : null),
            h('div', { class: 'muted' }, visitSummary(v).join(' ｜ ') || '（まだ何も書いていません）')),
          h('span', { class: 'chev' }, '›')))) : h('p', { class: 'muted' }, 'まだ来店の記録がありません')),
    ],
    footer: btn(visits.some((v) => v.status === 'draft' && v.date === todayStr()) ? '今日のカルテのつづきを書く' : '今日の来店をはじめる', start, 'primary big wide'),
  });
}
