// 計算の部品のテスト。動かし方： node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { ageOf, addDays, daysBetween, blendCalc, maxDrops, limitFor, limitLevel, pickOils, pickCarriers, allergyHits, searchPeople, effectiveConds, noTouchOf, consentState } from '../js/logic.js';
import { migrateDump, MIGRATIONS, DATA_VERSION } from '../js/db.js';
import { DEFAULT_SETTINGS, DEFAULT_CATS, DEFAULT_OILS, DEFAULT_CARRIERS, OLD_ONLY_OILS } from '../js/seed.js';

test('年齢：誕生日の前と後', () => {
  assert.equal(ageOf('1980-11-16', '2026-11-15'), 45);
  assert.equal(ageOf('1980-11-15', '2026-11-15'), 46);
  assert.equal(ageOf('', '2026-11-15'), null);
});
test('日付の足し算・引き算（月またぎ）', () => {
  assert.equal(addDays('2026-11-28', 7), '2026-12-05');
  assert.equal(daysBetween('2026-11-01', '2026-11-15'), 14);
});
test('濃度＝精油 ÷ キャリアオイル：30ml に 6滴（1滴0.05ml）でちょうど1％', () => {
  const c = blendCalc({ oils: [{ drops: 4 }, { drops: 2 }], carriers: [{ ml: 30 }] }, 0.05);
  assert.equal(c.drops, 6); assert.ok(Math.abs(c.pct - 1) < 1e-9, String(c.pct));
  assert.ok(Math.abs(blendCalc({ oils: [{ drops: 10 }], carriers: [{ ml: 20 }, { ml: 30 }] }, 0.05).pct - 1) < 1e-9, 'キャリアオイルが2種類なら合わせた量で');
  assert.ok(Math.abs(blendCalc({ oils: [{ drops: 3 }], carriers: [{ ml: 10 }] }, 0.04).pct - 1.2) < 1e-9, '1滴の量を変えたとき');
  assert.equal(blendCalc({ oils: [{ drops: 3 }], carriers: [] }, 0.05).pct, null);
  assert.equal(limitLevel(c.pct, 1), 'near', 'ちょうど目安の数字は「こえている」にしない');
});
test('目安におさまる滴数：その滴数は中、1滴足すとこえる', () => {
  assert.equal(maxDrops(1, 30, 0.05), 6); assert.equal(maxDrops(0.5, 10, 0.05), 1); assert.equal(maxDrops(2, 50, 0.05), 20); assert.equal(maxDrops(1, 5, 0.05), 1); assert.equal(maxDrops(0.5, 5, 0.05), 0);
  for (const [lim, ml, d] of [[1, 30, 0.05], [0.5, 10, 0.05], [2, 50, 0.05], [1, 5, 0.05], [3, 20, 0.04], [1.5, 15, 0.03]]) {
    const n = maxDrops(lim, ml, d);
    assert.notEqual(limitLevel(blendCalc({ oils: [{ drops: n }], carriers: [{ ml }] }, d).pct, lim), 'over');
    assert.equal(limitLevel(blendCalc({ oils: [{ drops: n + 1 }], carriers: [{ ml }] }, d).pct, lim), 'over');
  }
  assert.equal(maxDrops(null, 30, 0.05), null);
});
test('目安：部位と状態のうち低いほう。未設定なら「目安なし」', () => {
  const st = { ...DEFAULT_SETTINGS, stateLimits: { c_old: 0.5 } };
  assert.equal(limitFor(st, 'a_body', []).max, 1);
  assert.equal(limitFor(st, 'a_body', ['c_old']).max, 0.5);
  assert.equal(limitFor(st, 'a_part', []).max, null);
  assert.equal(limitLevel(1.2, 1), 'over'); assert.equal(limitLevel(0.95, 1), 'near'); assert.equal(limitLevel(0.5, 1), 'ok'); assert.equal(limitLevel(0.5, null), 'unknown');
});
const pick = (o) => pickOils({ oils: DEFAULT_OILS, cats: DEFAULT_CATS, settings: DEFAULT_SETTINGS, symptoms: [], condIds: [], avoidOilIds: [], allergyText: '', ...o });
const byId = (r) => Object.fromEntries(r.map((x) => [x.oil.id, x]));
test('候補：資料の3段（つらいところ → 作用 → 成分 → 精油）で、理由つきで出る', () => {
  const r = pick({ symptoms: [{ id: 's_nemuri', level: 8 }] });
  const top = r.slice(0, 6).map((x) => x.oil.id);
  assert.ok(top.includes('o_clary') && top.includes('o_chamomile'), top.join());
  assert.ok(r[0].reasons.some((t) => t.includes('「眠りが浅い」→ 気持ちを落ちつける ←')), r[0].reasons.join());
  const kata = byId(pick({ symptoms: [{ id: 's_kata', level: 6 }] }));
  assert.ok(kata.o_rosemary.reasons.some((t) => t.includes('カンファー（ケトン類')), '成分（小分類）の名前が理由に出る');
  assert.ok(kata.o_lemongrass.reasons.some((t) => t.includes('資料の「OK」')), '資料のOKが理由に出る');
  assert.ok(pick({}).every((x) => x.score === 0), '何もえらんでいなければ、どれも候補に上げない');
});
test('候補：重みを変えると並びが変わる（つらいところ → 作用）', () => {
  const st = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  st.symptoms.find((x) => x.id === 's_hie').acts = { a_warm: 2 }; // あたためる だけ → それを持つ精油はない
  const r = pickOils({ oils: DEFAULT_OILS, cats: DEFAULT_CATS, settings: st, symptoms: [{ id: 's_hie', level: 5 }], condIds: [] });
  assert.equal(r[0].oil.id, 'o_lemongrass', '残るのは資料のOK（冷え性）だけ');
  assert.equal(r.filter((x) => x.score > 0).length, 1);
});
test('候補：資料のNGにあたる精油は消さずに、理由つきで外す', () => {
  const r = pick({ symptoms: [{ id: 's_kata', level: 6 }], condIds: ['c_drive', 'c_sun', 'c_bpmed'] });
  assert.equal(r.length, DEFAULT_OILS.length); // 消していない
  const by = byId(r);
  assert.ok(by.o_clary.blocks.some((t) => t.includes('運転')));
  assert.ok(by.o_orange.blocks.some((t) => t.includes('屋外で過ごす'))); assert.ok(by.o_mandarin.blocks.length > 0);
  assert.ok(by.o_peppermint.blocks.some((t) => t.includes('ケトン類') && t.includes('約30％')));
  assert.equal(by.o_lavender.blocks.length, 0);
});
test('妊娠の時期：月数から初期・中期・後期。月数がなければ、どの時期にもあてはまる（安全側）', () => {
  const ec = (m) => effectiveConds({ settings: DEFAULT_SETTINGS, det: { conds: [] }, visit: { conds: ['c_preg'], pregMonth: m } });
  assert.ok(ec(3).ids.includes('c_preg_early') && !ec(3).ids.includes('c_preg_mid'));
  assert.ok(ec(6).ids.includes('c_preg_mid')); assert.ok(ec(9).ids.includes('c_preg_late'));
  assert.ok(['c_preg_early', 'c_preg_mid', 'c_preg_late'].every((c) => ec(null).ids.includes(c)));
  const at = (m) => byId(pick({ condIds: ec(m).ids, autoConds: ec(m).auto }));
  assert.ok(at(3).o_chamomile.blocks.length > 0, '初期はカモミール・ローマンを外す');
  assert.ok(at(6).o_palmarosa.blocks.length > 0, 'パルマローザは中期まで外す');
  assert.ok(!at(9).o_palmarosa.blocks.length && !at(9).o_cypress.blocks.length, '後期は「初期」「中期まで」の注意にあたらない');
  assert.ok(at(9).o_juniper.blocks.length > 0, '「妊娠」のNGは時期を問わない');
  assert.ok(at(null).o_cypress.blocks[0].includes('月数が入っていない'));
});
test('年齢：区切りを入れると、生年月日から乳幼児・子ども・高齢が自動でつく', () => {
  const ec = (birth, settings = { ...DEFAULT_SETTINGS, ageRules: { infant: 6, child: 15, old: 65 } }) => effectiveConds({ settings, det: { birth, conds: [] }, visit: { conds: [] }, today: '2026-11-15' }).ids;
  assert.deepEqual(ec('2023-01-01').sort(), ['c_child', 'c_infant']); assert.deepEqual(ec('2016-01-01'), ['c_child']);
  assert.deepEqual(ec('1950-01-01'), ['c_old']); assert.deepEqual(ec('1990-01-01'), []); assert.deepEqual(ec(''), []);
  assert.deepEqual(ec('2023-01-01', DEFAULT_SETTINGS), [], 'はじめは区切りが未記入なので、自動でつけない');
  const by = byId(pick({ condIds: ec('2023-01-01') }));
  assert.ok(by.o_peppermint.blocks.length > 0); assert.equal(by.o_ravensara.blocks.length, 0);
});
test('割合が分からない成分の注意：はじめは外す（安全側）。設定で ⚠ だけにできる。資料のOKと食いちがうときは書く', () => {
  const g = byId(pick({ condIds: ['c_preg'] })).o_geranium;
  assert.ok(g.blocks.some((t) => t.includes('ケトン類') && t.includes('割合は未記入') && t.includes('「OK」')), g.blocks.join());
  const w = byId(pickOils({ oils: DEFAULT_OILS, cats: DEFAULT_CATS, settings: { ...DEFAULT_SETTINGS, unknownPct: 'warn' }, symptoms: [], condIds: ['c_preg'] }));
  assert.equal(w.o_geranium.blocks.length, 0); assert.ok(w.o_geranium.warns.some((t) => t.includes('ケトン類')));
  assert.ok(w.o_peppermint.blocks.length > 0, '割合が分かっていて目安をこえるものは外す');
});
test('外さずに ⚠：敏感肌のイランイラン・アトピーのカモミール・ジャーマン・フェノール類', () => {
  const by = byId(pick({ condIds: ['c_skin', 'c_atopy'] }));
  assert.equal(by.o_ylang.blocks.length, 0); assert.ok(by.o_ylang.warns.some((t) => t.includes('敏感肌')));
  assert.ok(by.o_chamomile_g.warns.some((t) => t.includes('アトピー')));
  assert.ok(byId(pick({})).o_rose.warns.some((t) => t.includes('うすめて')), 'フェノール類は、だれにでも「うすめて」の注意');
});
test('植物アレルギー：資料のNG（ブタクサ・イネ科）にあたる精油だけ外す（資料にない広げ方はしない）', () => {
  const rag = byId(pick({ allergyTags: ['al_ragweed'] }));
  assert.ok(rag.o_chamomile_g.blocks.length > 0); assert.equal(rag.o_chamomile.blocks.length, 0); assert.equal(rag.o_lavender.blocks.length, 0);
  const grass = byId(pick({ allergyText: 'イネ科の花粉' }));
  assert.ok(grass.o_palmarosa.blocks.length > 0); assert.equal(grass.o_lemongrass.blocks.length, 0);
});
test('候補：アレルギーの欄・避ける精油', () => {
  const by = byId(pick({ allergyText: 'ナッツ、ラベンダー', avoidOilIds: ['o_lemon'] }));
  assert.ok(by.o_lavender.blocks[0].includes('アレルギー')); assert.ok(by.o_lemon.blocks[0].includes('避ける精油')); assert.equal(by.o_orange.blocks.length, 0);
});
test('資料にない精油（ref:false）は点数に入れない。気をつける点は見る', () => {
  const extra = { ...DEFAULT_OILS[0], id: 'x', name: 'テスト精油', ref: false, uses: ['s_kata'], cautions: ['c_preg'] };
  const r = byId(pickOils({ oils: [...DEFAULT_OILS, extra], cats: DEFAULT_CATS, settings: DEFAULT_SETTINGS, symptoms: [{ id: 's_kata', level: 9 }], condIds: ['c_preg'] }));
  assert.equal(r.x.score, 0); assert.equal(r.x.reasons.length, 0); assert.ok(r.x.blocks.length > 0);
});
const pickC = (o) => pickCarriers({ carriers: DEFAULT_CARRIERS, settings: DEFAULT_SETTINGS, skins: [], purposes: [], condIds: [], allergyTags: [], allergyText: '', avoidIds: [], ...o });
test('キャリアオイルの候補：肌の状態・目的から、理由つきで出る', () => {
  const dry = pickC({ skins: ['sk_dry'] });
  assert.equal(dry.length, DEFAULT_CARRIERS.length);
  assert.ok(dry.slice(0, 5).some((x) => x.oil.id === 'k_tsubaki') && dry.slice(0, 5).some((x) => x.oil.id === 'k_almond'), dry.slice(0, 5).map((x) => x.oil.id).join());
  assert.ok(dry[0].reasons[0].includes('乾燥しやすい'));
  const oily = pickC({ skins: ['sk_oily'] }); assert.ok(['k_jojoba', 'k_mct', 'k_grape'].includes(oily[0].oil.id), oily[0].oil.id);
  assert.ok(oily.find((x) => x.oil.id === 'k_grape').reasons.some((t) => t.includes('リノール酸')));
  const pu = pickC({ purposes: ['こり・はりをほぐしたい'] }); assert.ok(pu[0].score > 0 && pu[0].reasons[0].includes('目的'));
  assert.ok(pickC({}).every((x) => x.score === 0), '何もえらんでいなければ、どれも候補に上げない');
});
test('キャリアオイルの候補：ナッツなどのアレルギーは消さずに、理由つきで外す', () => {
  const by = (o) => Object.fromEntries(pickC({ skins: ['sk_dry'], ...o }).map((x) => [x.oil.id, x]));
  const tag = by({ allergyTags: ['al_nut'] });
  assert.equal(Object.keys(tag).length, DEFAULT_CARRIERS.length); // 消していない
  for (const id of ['k_almond', 'k_macadamia', 'k_apricot', 'k_argan']) assert.ok(tag[id].blocks.some((t) => t.includes('ナッツ')), id);
  assert.equal(tag.k_jojoba.blocks.length, 0); assert.equal(tag.k_tsubaki.blocks.length, 0);
  const text = by({ allergyText: 'アーモンドでかゆくなる' }); assert.ok(text.k_almond.blocks[0].includes('「アーモンド」')); assert.ok(text.k_macadamia.blocks.length > 0);
  assert.ok(by({ allergyText: 'ごま' }).k_sesame.blocks.length > 0); assert.equal(by({ allergyText: 'ごま' }).k_almond.blocks.length, 0);
  assert.ok(by({ avoidIds: ['k_jojoba'] }).k_jojoba.blocks[0].includes('避ける'));
  assert.deepEqual(allergyHits(DEFAULT_SETTINGS.allergens, [], ''), {});
});
test('版2への移し替え：前の版のキャリアオイル（名前と手持ちだけ）に中身が入り、使う人の値は残る', () => {
  const old = { dataVersion: 1, stores: {
    carriers: [{ id: 'k_jojoba', name: 'ホホバ（うちの呼び方）', owned: true, note: '' }, { id: 'mine', name: '自分で足したオイル', owned: true, note: 'メモ' }],
    details: [{ id: 'c1', allergy: 'ナッツ', avoidOilIds: [] }],
    visits: [{ id: 'v1', interview: { symptoms: [{ id: 's_kata', level: 5 }], purposes: [] }, blend: { oils: [], carriers: [{ carrierId: 'k_jojoba', name: 'ホホバオイル', ml: 30 }] } }],
  } };
  const d = migrateDump(old, MIGRATIONS, DATA_VERSION);
  assert.equal(d.dataVersion, DATA_VERSION);
  const c = Object.fromEntries(d.stores.carriers.map((x) => [x.id, x]));
  assert.equal(c.k_jojoba.name, 'ホホバ（うちの呼び方）'); assert.equal(c.k_jojoba.owned, true); assert.equal(c.k_jojoba.fatty.wax, 97); assert.equal(c.k_jojoba.draft, true);
  assert.deepEqual(c.mine.fatty, {}); assert.equal(c.mine.note, 'メモ'); assert.deepEqual(c.mine.allergens, []);
  assert.ok(c.k_argan && c.k_argan.owned === false, '新しく足したオイルが入る'); assert.equal(d.stores.carriers.length, DEFAULT_CARRIERS.length + 1);
  assert.deepEqual(d.stores.details[0].allergyTags, []); assert.equal(d.stores.details[0].allergy, 'ナッツ');
  assert.deepEqual(d.stores.visits[0].interview.skins, []); assert.equal(d.stores.visits[0].interview.symptoms.length, 1); assert.equal(d.stores.visits[0].blend.carriers[0].ml, 30);
  assert.deepEqual(migrateDump(d, MIGRATIONS, DATA_VERSION).stores.carriers, d.stores.carriers, '2回かけても変わらない');
});
test('版3への移し替え：問診の言葉「このあと日に当たる」を直す。自分で直した言葉はさわらない', () => {
  const mk = (name) => ({ dataVersion: 2, stores: { meta: [{ key: 'settings', value: { conds: [{ id: 'c_preg', name: '妊娠中', when: 'visit' }, { id: 'c_sun', name, when: 'visit' }] } }, { key: 'nextNo', value: 5 }] } });
  const d = migrateDump(mk('このあと日に当たる'), MIGRATIONS, DATA_VERSION);
  const c = (dd, id) => dd.stores.meta[0].value.conds.find((x) => x.id === id);
  assert.equal(c(d, 'c_sun').name, DEFAULT_SETTINGS.conds.find((x) => x.id === 'c_sun').name); assert.ok(c(d, 'c_sun').name.includes('屋外'));
  assert.equal(c(d, 'c_preg').name, '妊娠中'); assert.deepEqual(d.stores.meta[1], { key: 'nextNo', value: 5 });
  assert.equal(c(migrateDump(mk('外に出る予定'), MIGRATIONS, DATA_VERSION), 'c_sun').name, '外に出る予定');
});
test('はじめのデータ：キャリアオイルは知らない成分・肌の状態・目的・アレルギーを指していない。割合は100以下', () => {
  const st = DEFAULT_SETTINGS; const fats = new Set(st.fats.map((f) => f.id)), sk = new Set(st.skins.map((f) => f.id)), al = new Set(st.allergens.map((f) => f.id));
  assert.equal(new Set(DEFAULT_CARRIERS.map((o) => o.id)).size, DEFAULT_CARRIERS.length);
  for (const o of DEFAULT_CARRIERS) {
    assert.ok(o.draft, o.name);
    for (const k of Object.keys(o.fatty)) assert.ok(fats.has(k), o.name + k);
    assert.ok(Object.values(o.fatty).reduce((a, b) => a + b, 0) <= 100, o.name);
    for (const u of o.skins) assert.ok(sk.has(u), o.name + u); for (const u of o.allergens) assert.ok(al.has(u), o.name + u);
    for (const u of o.purposes) assert.ok(st.purposes.includes(u), o.name + u);
    for (const v of Object.values(o.traits)) assert.ok(v == null || [1, 2, 3].includes(v), o.name);
  }
  for (const f of st.fats) for (const u of f.uses) assert.ok(sk.has(u), f.name);
});
test('触れないで（×）：その線だけ取り出す（次の来店に写す）', () => {
  const marks = DEFAULT_SETTINGS.marks; assert.ok(marks.some((m) => m.id === 'm_notouch' && m.x));
  const f = { front: [{ m: 'm_pain', w: 6, p: [1, 2] }, { m: 'm_notouch', w: 14, p: [3, 4] }], back: [{ m: 'm_kori', w: 6, p: [5, 6] }] };
  assert.deepEqual(noTouchOf(f, marks), { front: [{ m: 'm_notouch', w: 14, p: [3, 4] }] }); assert.deepEqual(noTouchOf({}, marks), {});
});
test('同意：いちばん新しい同意と、文を直したあとかどうか', () => {
  assert.deepEqual(consentState([], { ver: 1 }), { last: null, stale: false });
  const cs = [{ at: '2026-11-01T10:00:00Z', ver: 1 }, { at: '2026-11-15T10:00:00Z', ver: 2 }];
  assert.equal(consentState(cs, { ver: 2 }).last.ver, 2); assert.equal(consentState(cs, { ver: 2 }).stale, false); assert.equal(consentState(cs, { ver: 3 }).stale, true);
  assert.ok(DEFAULT_SETTINGS.consent.draft && DEFAULT_SETTINGS.consent.text.includes('同意'));
});
test('さがす：ひらがな・カタカナ・番号', () => {
  const ps = [{ name: '春野 あおい', kana: 'はるの あおい', no: 12 }, { name: '森下 太郎', kana: 'もりした たろう', no: 3 }];
  assert.equal(searchPeople(ps, 'ハルノ').length, 1); assert.equal(searchPeople(ps, '森下').length, 1); assert.equal(searchPeople(ps, 'たろう')[0].no, 3); assert.equal(searchPeople(ps, '').length, 2);
});
test('版の移し替え：古いバックアップを順番に新しい形へ。新しすぎるものは断る', () => {
  const list = [{ to: 2, stores: { visits: (r) => ({ ...r, scope: r.scope || { type: 'whole' } }) } }, { to: 3, stores: { customers: (r) => ({ ...r, tags: [] }) } }];
  const d = migrateDump({ dataVersion: 1, stores: { visits: [{ id: 'a' }], customers: [{ id: 'c' }] } }, list, 3);
  assert.equal(d.dataVersion, 3); assert.deepEqual(d.stores.visits[0].scope, { type: 'whole' }); assert.deepEqual(d.stores.customers[0].tags, []);
  const half = migrateDump({ dataVersion: 2, stores: { visits: [{ id: 'a' }], customers: [{ id: 'c' }] } }, list, 3);
  assert.equal(half.stores.visits[0].scope, undefined); // 2 への移し替えは、もうかけない
  assert.throws(() => migrateDump({ dataVersion: 9, stores: {} }, list, 3));
});
test('はじめのデータ：精油は資料の30本・番号の重なりなし・知らない分類／成分／作用／症状／状態を指していない', () => {
  assert.equal(DEFAULT_OILS.length, 30);
  assert.equal(new Set(DEFAULT_OILS.map((o) => o.id)).size, DEFAULT_OILS.length);
  for (const id of Object.keys(OLD_ONLY_OILS)) assert.ok(!DEFAULT_OILS.some((o) => o.id === id), id);
  const st = DEFAULT_SETTINGS;
  const cats = new Set(DEFAULT_CATS.map((c) => c.id)), sy = new Set(st.symptoms.map((s) => s.id)), cd = new Set(st.conds.map((s) => s.id)), fm = new Set(st.families.map((s) => s.id));
  const subs = new Set(DEFAULT_CATS.flatMap((c) => c.subs.map((x) => x.id))), acts = new Set(st.actions.map((a) => a.id)), al = new Set(st.allergens.map((a) => a.id));
  assert.equal(st.families.length, 3);
  for (const o of DEFAULT_OILS) {
    assert.ok(o.family === '' || fm.has(o.family), o.name); assert.ok(o.draft);
    for (const [k, v] of Object.entries(o.components)) { assert.ok(cats.has(k), o.name + k); assert.ok(v === null || v === 'tr' || (v > 0 && v <= 100), o.name + k); }
    assert.ok(Object.values(o.components).filter((v) => typeof v === 'number').reduce((a, b) => a + b, 0) <= 100, o.name);
    for (const u of o.subs) assert.ok(subs.has(u), o.name + u); for (const u of o.actions) assert.ok(acts.has(u), o.name + u);
    for (const u of o.uses) assert.ok(sy.has(u), o.name + u);
    for (const c of [...o.cautions, ...o.warns, ...o.okConds]) assert.ok(cd.has(c), o.name + c);
    for (const a of o.allergens) assert.ok(al.has(a), o.name + a);
    // 成分（小分類）の分類が、割合のらんにもある
    for (const u of o.subs) assert.ok(Object.keys(o.components).includes(DEFAULT_CATS.find((c) => c.subs.some((x) => x.id === u)).id), o.name + u);
  }
  for (const c of DEFAULT_CATS) { for (const x of [...c.cautions, ...c.warns]) assert.ok(cd.has(x)); for (const sb of c.subs) for (const a of sb.actions) assert.ok(acts.has(a), sb.name + a); }
  for (const s of st.symptoms) for (const a of Object.keys(s.acts)) assert.ok(acts.has(a), s.name + a);
});
test('版4への移し替え：精油を資料の30本に。手持ちは残す・確かめた精油と自分で足した精油はさわらない（分類だけ直す）・資料にない精油は残す', () => {
  const v3 = { dataVersion: 3, stores: {
    meta: [{ key: 'settings', value: { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      families: [{ id: 'f_citrus', name: '柑橘', color: '#f2a03d' }, { id: 'f_flower', name: 'お花', color: '#e88fb0' }, { id: 'f_tree', name: '樹木', color: '#5a9a6b' }, { id: 'f_herb', name: 'ハーブ', color: '#8fbf5a' }],
      conds: [{ id: 'c_preg', name: '妊娠中', when: 'visit' }, { id: 'c_bp', name: '高血圧（自分で直した）', when: 'person' }],
      allergens: [{ id: 'al_nut', name: 'ナッツ類', words: 'ナッツ' }],
      symptoms: [{ id: 's_kata', name: '肩こり' }, { id: 'mysym', name: '自分で足した症状' }], actions: undefined, ageRules: undefined, unknownPct: undefined } }],
    cats: [{ id: 'mth', name: 'モノテルペン炭化水素類', draft: true }, { id: 'sth', name: 'セスキ', draft: true }, { id: 'ket', name: 'ケトン類', draft: true, cautions: ['c_preg'] }, { id: 'oxi', name: 'オキサイド類（確かめた）', draft: false, cautions: [] }, { id: 'mine', name: '自分の分類', draft: false }],
    oils: [
      { id: 'o_lavender', name: 'ラベンダー（真正）', family: 'f_flower', components: { est: 40, alc: 40, mth: 5 }, uses: [], cautions: [], owned: true, draft: true },
      { id: 'o_marjoram', name: 'うちのマージョラム', family: 'f_herb', components: { alc: 50, mth: 30, sth: 10, lac: 1 }, uses: ['s_kata'], cautions: [], owned: true, draft: false },
      { id: 'o_ginger', name: 'ジンジャー', family: 'f_spice', components: { sth: 60, mth: 20 }, uses: ['s_hie'], cautions: [], owned: true, draft: true },
      { id: 'mine', name: '自分の精油', family: 'f_herb', components: { eth: 10, sqa: null }, uses: [], cautions: [], owned: false, draft: false },
    ],
    visits: [{ id: 'v1', conds: ['c_preg'], interview: { symptoms: [], moods: [] }, blend: { oils: [{ oilId: 'o_lavender', name: 'ラベンダー（真正）', drops: 3 }], carriers: [] } }],
  } };
  const d = migrateDump(v3, MIGRATIONS, DATA_VERSION);
  assert.equal(d.dataVersion, DATA_VERSION);
  const o = Object.fromEntries(d.stores.oils.map((x) => [x.id, x]));
  assert.equal(o.o_lavender.name, 'ラベンダー・アングスティフォリア'); assert.equal(o.o_lavender.owned, true); assert.deepEqual(o.o_lavender.components, { est: null, alc: null, hyd: null });
  assert.equal(o.o_marjoram.name, 'うちのマージョラム'); assert.deepEqual(o.o_marjoram.components, { alc: 50, hyd: 40 }); assert.equal(o.o_marjoram.family, 'f_flower'); assert.deepEqual(o.o_marjoram.uses, ['s_kata']);
  assert.equal(o.o_ginger.ref, false); assert.equal(o.o_ginger.owned, true); assert.deepEqual(o.o_ginger.components, { hyd: 80 }); assert.equal(o.o_ginger.family, '');
  assert.deepEqual(o.mine.components, { phe: 10, alc: null }); assert.equal(o.mine.ref, undefined);
  assert.ok(o.o_euc_radiata && o.o_myrrh && o.o_celery, '資料の新しい精油が入る');
  assert.equal(d.stores.oils.length, 30 + 2, '資料の30本 ＋ 資料にない1本 ＋ 自分の1本');
  const c = Object.fromEntries(d.stores.cats.map((x) => [x.id, x]));
  assert.ok(!c.mth && !c.sth, '下書きのままの前の分類は、資料の分類にまとめた'); assert.ok(c.hyd && c.alc && c.phe);
  assert.deepEqual(c.ket.cautions, ['c_infant', 'c_preg', 'c_epi', 'c_bpmed']); assert.equal(c.oxi.name, 'オキサイド類（確かめた）'); assert.ok(c.oxi.subs.length > 0); assert.ok(c.mine);
  const st = d.stores.meta[0].value;
  assert.deepEqual(st.families.map((f) => f.name), ['樹木系', 'お花', '柑橘系']);
  assert.equal(st.conds.find((x) => x.id === 'c_bp').name, '高血圧（自分で直した）'); assert.ok(st.conds.some((x) => x.id === 'c_preg_early') && st.conds.some((x) => x.id === 'c_drive'));
  assert.ok(st.allergens.some((a) => a.id === 'al_ragweed')); assert.equal(st.allergens.length, DEFAULT_SETTINGS.allergens.length);
  assert.ok(st.symptoms[0].acts.a_relax === 2); assert.deepEqual(st.symptoms[1].acts, {});
  assert.equal(st.actions.length, DEFAULT_SETTINGS.actions.length); assert.equal(st.unknownPct, 'block');
  assert.ok(st.marks.some((m) => m.id === 'm_notouch' && m.x), '「触れないで（×）」のしるしが足される');
  assert.deepEqual(d.stores.visits[0].interview.famLikes, []); assert.equal(d.stores.visits[0].pregMonth, null); assert.equal(d.stores.visits[0].blend.oils[0].name, 'ラベンダー（真正）', '前の記録の名前はそのまま');
  const again = migrateDump({ ...d, dataVersion: 3 }, MIGRATIONS, DATA_VERSION);
  assert.deepEqual(again.stores.oils.map((x) => x.id).sort(), d.stores.oils.map((x) => x.id).sort(), '2回かけても増えない');
});

test('版5への移し替え：これまでの図は「所見」としてそのまま残る。お客さんの図・前半をだれが書いたか の入れ物が足される', () => {
  const line = { m: 'm_pain', w: 14, p: [10, 10, 20, 20] }, x = { m: 'm_notouch', w: 14, p: [50, 50, 60, 60] };
  const v4 = { dataVersion: 4, stores: {
    visits: [{ id: 'v1', customerId: 'c1', figures: { front: [line, x], back: [] }, interview: { symptoms: [{ id: 's_kata', level: 7 }], memo: 'メモ' } }],
    details: [{ id: 'c1', consents: [{ ver: 1 }], life: { sleep: 6 } }],
  } };
  const d = migrateDump(v4, MIGRATIONS, DATA_VERSION); const v = d.stores.visits[0];
  assert.equal(d.dataVersion, DATA_VERSION);
  assert.deepEqual(v.figures, { front: [line, x], back: [] }, 'これまでの図は所見の図として残る');
  assert.deepEqual(v.guestFigures, { front: [], back: [] }); assert.equal(v.intake, null);
  assert.equal(v.interview.wish, ''); assert.equal(v.interview.memo, 'メモ'); assert.equal(v.interview.symptoms[0].level, 7);
  assert.equal(d.stores.details[0].intakeAt, ''); assert.equal(d.stores.details[0].life.sleep, 6); assert.equal(d.stores.details[0].consents.length, 1);
  // お客さんの図に書いたあとで もう一度かけても、消えない
  v.guestFigures.front.push(line); v.intake = { by: 'guest', at: 'x' };
  const again = migrateDump({ ...d, dataVersion: 4 }, MIGRATIONS, DATA_VERSION).stores.visits[0];
  assert.equal(again.guestFigures.front.length, 1); assert.equal(again.intake.by, 'guest');
});
test('触れないで（×）は、お客さんの図と施術する人の図の両方から集める', async () => {
  const { noTouchAll } = await import('../js/logic.js'); const marks = [{ id: 'm_pain' }, { id: 'm_notouch', x: true }];
  const g = { m: 'm_notouch', w: 14, p: [1, 1] }, s = { m: 'm_notouch', w: 6, p: [2, 2] }, n = { m: 'm_pain', w: 6, p: [3, 3] };
  assert.deepEqual(noTouchAll({ guestFigures: { front: [g, n], back: [] }, figures: { front: [s], back: [n] } }, marks), { front: [g, s] });
  assert.deepEqual(noTouchAll({ figures: { front: [n] } }, marks), {});
});

test('版6への移し替え：部位の設定が足される・メニューと来店に「施術するところ」の入れ物・前の図と線はそのまま', async () => {
  const line = { m: 'm_pain', w: 14, p: [10, 10, 20, 20] };
  const v5 = { dataVersion: 5, stores: {
    meta: [{ key: 'settings', value: { salonName: 'みほんの店', areas: [{ id: 'a_body', name: '体', max: 2 }] } }, { key: 'nextNo', value: 3 }],
    menus: [{ id: 'm1', name: '自分のメニュー', minutes: 45 }],
    visits: [{ id: 'v1', customerId: 'c1', scope: { type: 'whole' }, figures: { front: [line], back: [] }, guestFigures: { front: [line], back: [] }, menus: [{ id: 'm1', name: '自分のメニュー', minutes: 45 }] }, { id: 'v0', customerId: 'c1', figures: { front: [], back: [line] } }],
  } };
  const d = migrateDump(v5, MIGRATIONS, DATA_VERSION); const st = d.stores.meta[0].value;
  assert.equal(d.dataVersion, DATA_VERSION);
  assert.deepEqual(st.parts.map((p) => p.id), ['hand', 'foot', 'head', 'neck', 'back']); assert.equal(st.salonName, 'みほんの店'); assert.equal(st.areas[0].max, 2, '濃度の目安はさわらない');
  assert.equal(d.stores.meta[1], v5.stores.meta[1], '変えない行は同じものを返す');
  assert.deepEqual(d.stores.menus, [{ id: 'm1', name: '自分のメニュー', minutes: 45, scope: null }], 'メニューは増やさない');
  assert.deepEqual(d.stores.visits[0].figures, { front: [line], back: [] }); assert.deepEqual(d.stores.visits[0].guestFigures, { front: [line], back: [] });
  assert.deepEqual(d.stores.visits[1].scope, { type: 'whole' }); assert.deepEqual(d.stores.visits[1].figures.back, [line]);
  // 部位の名前を直したあと・部分の来店を作ったあとに もう一度かけても、戻らない
  st.parts[0].name = 'ハンド'; d.stores.visits[0].scope = { type: 'part', parts: ['hand'] }; d.stores.menus[0].scope = { type: 'part', parts: ['hand'] };
  const again = migrateDump({ ...d, dataVersion: 5 }, MIGRATIONS, DATA_VERSION);
  assert.equal(again.stores.meta[0].value.parts[0].name, 'ハンド'); assert.equal(again.stores.visits[0].scope.type, 'part'); assert.equal(again.stores.menus[0].scope.parts[0], 'hand');
});
test('全身／部分：出す図・濃度の目安・関わるつらいところ・メニューから決まる', async () => {
  const P = await import('../js/parts.js'); const st = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  const hand = { type: 'part', parts: ['hand'] }, hf = { type: 'part', parts: ['hand', 'foot'] };
  assert.deepEqual(P.figIdsOf({ type: 'whole' }), ['front', 'back']); assert.deepEqual(P.figIdsOf(undefined), ['front', 'back'], '入れ物がなければ全身');
  assert.deepEqual(P.figIdsOf(hand), ['hand_palm_r', 'hand_palm_l', 'hand_back_l', 'hand_back_r']); assert.equal(P.figIdsOf(hf).length, 8);
  assert.deepEqual(P.figIdsOf({ type: 'part', parts: ['nazo'] }), ['front', 'back'], '知らない部位だけなら全身');
  assert.equal(P.scopeText(st, hf), '手・足 だけ'); assert.equal(P.scopeText(st, { type: 'whole' }), '全身');
  assert.equal(P.areaForScope(st, { type: 'whole' }), 'a_body'); assert.equal(P.areaForScope(st, hand), 'a_part');
  assert.equal(P.areaForScope(st, { type: 'part', parts: ['back', 'head'] }), 'a_face', 'いくつかあるときは、目安のいちばん低いもの');
  st.parts.find((p) => p.id === 'hand').areaId = ''; assert.equal(P.areaForScope(st, hand), '', '決めていなければ、そのまま');
  assert.ok(P.symsForScope(st, { type: 'part', parts: ['foot'] }).includes('s_ashi')); assert.deepEqual(P.symsForScope(st, { type: 'whole' }), []);
  for (const p of st.parts) for (const s of p.syms) assert.ok(st.symptoms.some((x) => x.id === s), `${p.name} の ${s}`);
  for (const p of st.parts) assert.ok(!p.areaId || st.areas.some((a) => a.id === p.areaId));
  // メニューから
  assert.equal(P.scopeFromMenus([{ id: 'a' }, { id: 'b', scope: null }]), null, '決めていないメニューだけなら、変えない');
  assert.deepEqual(P.scopeFromMenus([{ scope: { type: 'part', parts: ['foot'] } }, { scope: hand }]), hf, '部位の合わせたもの（決まった並び）');
  assert.deepEqual(P.scopeFromMenus([{ scope: hand }, { scope: { type: 'whole' } }]), { type: 'whole' }, 'どれかが全身なら全身');
  // 図の番号は保存に使うので、そろっていること
  for (const ids of Object.values(P.PART_FIGS)) for (const id of ids) { assert.ok(P.FIGS[id].box && P.FIGS[id].svg && P.FIGS[id].name, id); }
});
test('経過：回ごとの行（古い順）と、ブレンドごとのまとめ', async () => {
  const { progressRows, blendGroups } = await import('../js/logic.js');
  const mk = (date, b, a, oils, ml = 30) => ({ id: date, date, createdAt: 1, status: 'done', interview: { symptoms: [{ id: 's_kata', level: b }] }, after: { levels: a == null ? {} : { s_kata: a } },
    blend: { oils: oils.map(([oilId, drops]) => ({ oilId, name: oilId, drops })), carriers: [{ carrierId: 'c', name: 'c', ml }] }, menus: [] });
  const rows = progressRows([mk('2026-03-01', 6, 2, [['lav', 3], ['ora', 3]]), mk('2026-01-01', 8, 7, [['tea', 6]]), mk('2026-02-01', 7, 4, [['ora', 2], ['lav', 2]]), mk('2026-04-01', 5, null, [['lav', 1], ['ora', 1]])]);
  assert.deepEqual(rows.map((r) => [r.date, r.nth, r.drop]), [['2026-01-01', 1, 1], ['2026-02-01', 2, 3], ['2026-03-01', 3, 4], ['2026-04-01', 4, null]]);
  assert.equal(rows[0].pct.toFixed(1), '1.0'); assert.deepEqual(rows[3].syms, [{ id: 's_kata', before: 5, after: null }]);
  const g = blendGroups(rows);
  assert.deepEqual(g.map((x) => [x.key, x.n, x.rated, x.avg]), [['lav+ora', 3, 2, 3.5], ['tea', 1, 1, 1]], '同じ組み合わせ（順番・滴数がちがっても）でまとまる。後が未記入の回は平均に入れない');
  assert.equal(g[0].last, '2026-04-01'); assert.deepEqual(blendGroups(progressRows([{ id: 'x', date: '2026-01-01', interview: {}, after: {}, blend: {} }])), []);
});
test('予定の一覧：今日・今週・その先・過ぎた人。予定の入れ物（あとの取りこみ用）もいっしょに並ぶ', async () => {
  const { schedule } = await import('../js/logic.js'); const T = '2026-11-15';
  const people = [{ id: 'a', name: 'あ', nextDate: '2026-11-15', nextTime: '14:00' }, { id: 'b', name: 'い', nextDate: '2026-11-15', nextTime: '' }, { id: 'c', name: 'う', nextDate: '2026-11-15', nextTime: '09:30' },
    { id: 'd', name: 'え', nextDate: '2026-11-21' }, { id: 'e', name: 'お', nextDate: '2026-11-22' }, { id: 'f', name: 'か', nextDate: '2026-11-10' }, { id: 'g', name: 'き', nextDate: '2026-10-01' }, { id: 'h', name: 'く', nextDate: '' }];
  const s = schedule(people, [], T);
  assert.deepEqual(s.today.map((x) => x.person.id), ['c', 'a', 'b'], '今日は時間の早い順。時間のない人はうしろ');
  assert.deepEqual(s.week.map((x) => x.person.id), ['d'], '今週＝あした〜6日後'); assert.deepEqual(s.later.map((x) => x.person.id), ['e']);
  assert.deepEqual(s.overdue.map((x) => [x.person.id, x.late]), [['f', 5], ['g', 45]], '過ぎたばかりの人が上');
  // 予定の入れ物（Google カレンダーの取りこみが足す行）
  const ap = [{ id: '1', date: '2026-11-16', time: '10:00', customerId: 'h', source: 'gcal', confirmed: true }, { id: '2', date: '2026-11-16', time: '11:00', customerId: '', title: '山田さま', source: 'gcal' },
    { id: '3', date: '2026-11-21', customerId: 'd', source: 'gcal' }, { id: '4', date: '2026-11-17', customerId: 'h', done: true }];
  const w = schedule(people, ap, T).week;
  assert.deepEqual(w.map((x) => [x.key, x.title, !!x.unsure]), [['a:1', 'く', false], ['a:2', '山田さま', true], ['p:d', 'え', false]], '同じ人・同じ日は1つ。お客さんが決まっていない予定は「確かめる」');
  assert.deepEqual(schedule([], undefined, T), { overdue: [], today: [], week: [], later: [] });
});

test('版7への移し替え：もう使っている端末には案内を出さない・施術する人の名前と反射区の入れ物（はじめは出さない）・直した値は戻らない', async () => {
  const v6 = { dataVersion: 6, stores: { meta: [{ key: 'settings', value: { salonName: 'みほんの店', areas: [{ id: 'a_body', name: '体', max: 2 }] } }, { key: 'nextNo', value: 3 }], visits: [{ id: 'v1', scope: { type: 'whole' } }] } };
  const d = migrateDump(v6, MIGRATIONS, DATA_VERSION); const st = d.stores.meta[0].value;
  assert.equal(d.dataVersion, 7); assert.equal(st.onboard.done, true); assert.equal(st.staffName, ''); assert.equal(st.salonName, 'みほんの店'); assert.equal(st.areas[0].max, 2);
  assert.equal(st.reflex.show, false); assert.equal(st.reflex.checked, false); assert.ok(st.reflex.zones.length >= 8);
  assert.equal(d.stores.meta[1], v6.stores.meta[1]); assert.equal(d.stores.visits[0], v6.stores.visits[0], '来店はさわらない');
  st.staffName = '見本'; st.reflex.show = true; st.reflex.zones[0].name = 'あたま';
  const again = migrateDump({ ...d, dataVersion: 6 }, MIGRATIONS, DATA_VERSION).stores.meta[0].value;
  assert.equal(again.staffName, '見本'); assert.equal(again.reflex.show, true); assert.equal(again.reflex.zones[0].name, 'あたま');
});
test('バックアップのファイル名：お店の名前が頭につく・使えない字は外す', async () => {
  const { backupName } = await import('../js/logic.js');
  assert.equal(backupName('', '2026-11-15'), 'カルテのバックアップ_2026-11-15.json');
  assert.equal(backupName(' みほん/サロン: A ', '2026-11-15'), 'みほん_サロン_A_カルテのバックアップ_2026-11-15.json');
});
