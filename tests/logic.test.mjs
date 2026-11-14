// 計算の部品のテスト。動かし方： node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { ageOf, addDays, daysBetween, blendCalc, maxDrops, limitFor, limitLevel, pickOils, searchPeople } from '../js/logic.js';
import { migrateDump } from '../js/db.js';
import { DEFAULT_SETTINGS, DEFAULT_CATS, DEFAULT_OILS } from '../js/seed.js';

test('年齢：誕生日の前と後', () => {
  assert.equal(ageOf('1980-11-16', '2026-11-15'), 45);
  assert.equal(ageOf('1980-11-15', '2026-11-15'), 46);
  assert.equal(ageOf('', '2026-11-15'), null);
});
test('日付の足し算・引き算（月またぎ）', () => {
  assert.equal(addDays('2026-11-28', 7), '2026-12-05');
  assert.equal(daysBetween('2026-11-01', '2026-11-15'), 14);
});
test('濃度：30ml に 6滴（1滴0.05ml）で約1％', () => {
  const c = blendCalc({ oils: [{ drops: 4 }, { drops: 2 }], carriers: [{ ml: 30 }] }, 0.05);
  assert.equal(c.drops, 6); assert.ok(Math.abs(c.pct - 0.990099) < 1e-4);
  assert.equal(blendCalc({ oils: [{ drops: 3 }], carriers: [] }, 0.05).pct, null);
});
test('目安におさまる滴数：その滴数は中、1滴足すとこえる', () => {
  for (const [lim, ml] of [[1, 30], [0.5, 10], [2, 50], [1, 5]]) {
    const n = maxDrops(lim, ml, 0.05);
    assert.ok(blendCalc({ oils: [{ drops: n }], carriers: [{ ml }] }, 0.05).pct <= lim + 1e-9);
    assert.ok(blendCalc({ oils: [{ drops: n + 1 }], carriers: [{ ml }] }, 0.05).pct > lim);
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
  assert.ok(by.o_bergamot.blocks.some((t) => t.includes('日に当たる')));
  assert.equal(by.o_lavender.blocks.length, 0);
});
test('候補：アレルギーの欄・避ける精油', () => {
  const by = Object.fromEntries(pick({ allergyText: 'ナッツ、ラベンダー', avoidOilIds: ['o_lemon'] }).map((x) => [x.oil.id, x]));
  assert.ok(by.o_lavender.blocks[0].includes('アレルギー')); assert.ok(by.o_lemon.blocks[0].includes('避ける精油')); assert.equal(by.o_orange.blocks.length, 0);
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
