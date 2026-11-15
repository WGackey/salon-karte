// 計算の部品のテスト。動かし方： node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { ageOf, addDays, daysBetween, blendCalc, maxDrops, limitFor, limitLevel, pickOils, pickCarriers, allergyHits, searchPeople } from '../js/logic.js';
import { migrateDump, MIGRATIONS, DATA_VERSION } from '../js/db.js';
import { DEFAULT_SETTINGS, DEFAULT_CATS, DEFAULT_OILS, DEFAULT_CARRIERS } from '../js/seed.js';

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
test('候補：症状から理由つきで出る', () => {
  const r = pick({ symptoms: [{ id: 's_nemuri', level: 8 }] });
  const top = r.slice(0, 5).map((x) => x.oil.id);
  assert.ok(top.includes('o_lavender') && top.includes('o_chamomile'), top.join());
  assert.ok(r[0].reasons.length > 0 && r[0].reasons[0].includes('眠りが浅い'));
});
test('候補：気をつける状態にあたる精油は消さずに、理由つきで外す', () => {
  const r = pick({ symptoms: [{ id: 's_kata', level: 6 }], condIds: ['c_preg', 'c_sun'] });
  assert.equal(r.length, DEFAULT_OILS.length); // 消していない
  const by = Object.fromEntries(r.map((x) => [x.oil.id, x]));
  assert.ok(by.o_clary.blocks.some((t) => t.includes('妊娠中')));
  assert.ok(by.o_peppermint.blocks.some((t) => t.includes('ケトン類')));
  assert.ok(by.o_bergamot.blocks.some((t) => t.includes('屋外で過ごす')));
  assert.equal(by.o_lavender.blocks.length, 0);
});
test('候補：アレルギーの欄・避ける精油', () => {
  const by = Object.fromEntries(pick({ allergyText: 'ナッツ、ラベンダー', avoidOilIds: ['o_lemon'] }).map((x) => [x.oil.id, x]));
  assert.ok(by.o_lavender.blocks[0].includes('アレルギー')); assert.ok(by.o_lemon.blocks[0].includes('避ける精油')); assert.equal(by.o_orange.blocks.length, 0);
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
  assert.equal(d.stores.meta[0].value.conds[1].name, DEFAULT_SETTINGS.conds.find((c) => c.id === 'c_sun').name); assert.ok(d.stores.meta[0].value.conds[1].name.includes('屋外'));
  assert.equal(d.stores.meta[0].value.conds[0].name, '妊娠中'); assert.deepEqual(d.stores.meta[1], { key: 'nextNo', value: 5 });
  assert.equal(migrateDump(mk('外に出る予定'), MIGRATIONS, DATA_VERSION).stores.meta[0].value.conds[1].name, '外に出る予定');
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
test('はじめのデータ：精油は30本ほど・番号の重なりなし・知らない分類や症状を指していない', () => {
  assert.ok(DEFAULT_OILS.length >= 30);
  assert.equal(new Set(DEFAULT_OILS.map((o) => o.id)).size, DEFAULT_OILS.length);
  const cats = new Set(DEFAULT_CATS.map((c) => c.id)), sy = new Set(DEFAULT_SETTINGS.symptoms.map((s) => s.id)), cd = new Set(DEFAULT_SETTINGS.conds.map((s) => s.id)), fm = new Set(DEFAULT_SETTINGS.families.map((s) => s.id));
  for (const o of DEFAULT_OILS) {
    assert.ok(fm.has(o.family), o.name); assert.ok(o.draft);
    for (const k of Object.keys(o.components)) assert.ok(cats.has(k), o.name + k);
    assert.ok(Object.values(o.components).reduce((a, b) => a + b, 0) <= 100, o.name);
    for (const u of o.uses) assert.ok(sy.has(u), o.name + u); for (const c of o.cautions) assert.ok(cd.has(c), o.name + c);
  }
  for (const c of DEFAULT_CATS) { for (const u of c.uses) assert.ok(sy.has(u)); for (const x of c.cautions) assert.ok(cd.has(x)); }
});
