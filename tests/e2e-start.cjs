// 第3段（売るための設定・反射区）を、画面を実際に動かして確かめるテスト。
// 動かし方： python3 -m http.server 8080 を別で動かしてから  node tests/e2e-start.cjs [写真を置くフォルダ]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path'); const assert = require('assert/strict');
const BASE = process.env.BASE || 'http://localhost:8080/'; const OUT = process.argv[2] || null;
const errs = []; const outside = [];
async function kit(b, opt, prefix) {
  const ctx = await b.newContext({ locale: 'ja-JP', timezoneId: 'Asia/Tokyo', ...opt });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(prefix + e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(prefix + m.text()));
  p.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) outside.push(r.url()); });
  const shot = async (name) => { if (OUT) { fs.mkdirSync(OUT, { recursive: true }); await p.screenshot({ path: path.join(OUT, prefix + name + '.png') }); } };
  const tap = (text, o = {}) => p.getByText(text, { exact: o.exact ?? true }).locator('visible=true').first().tap();
  const noOverflow = async (what) => assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${what}：横にはみ出さない`);
  const pin = async (d = '1234') => { for (const c of d) await p.locator('.pinkey', { hasText: c }).first().tap(); };
  const settings = () => p.evaluate(async () => { await (await import('./js/state.js')).flush(); return (await import('./js/db.js')).getMeta('settings'); });
  return { ctx, p, shot, tap, noOverflow, pin, settings };
}
module.exports = { kit, BASE, errs, outside };

if (require.main === module) (async () => {
  const b = await chromium.launch();
  for (const [prefix, opt] of [['pad-', { viewport: { width: 1024, height: 768 } }], ['padv-', { viewport: { width: 768, height: 1024 } }], ['ph-', { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 }]]) {
    const k = await kit(b, { hasTouch: true, isMobile: true, deviceScaleFactor: 1, ...opt }, prefix); const { p, tap, shot } = k;
    // --- はじめて開く → 案内が出る ---
    await p.goto(BASE); await p.waitForSelector('.startpage'); await p.waitForSelector('text=ようこそ'); await shot('s0-welcome'); await k.noOverflow('ようこそ');
    await tap('はじめる'); await p.waitForSelector('text=お店の名前・施術する人の名前');
    await p.getByPlaceholder('例：〇〇サロン').fill('みほん/サロン'); await p.getByPlaceholder('例：山田').fill('見本 たろう'); await shot('s1-salon');
    await tap('つぎへ'); await p.waitForSelector('text=まだ決めていません'); await tap('合言葉を決める'); await k.pin(); await p.waitForTimeout(300); await k.pin(); await p.waitForSelector('text=✓ 決めてあります'); await shot('s2-pin');
    await tap('つぎへ'); await p.waitForSelector('.ownpick'); const oil0 = await p.locator('.ownpick .chip').count(); assert.ok(oil0 >= 30, '精油が並ぶ');
    await p.locator('.ownpick .chip').nth(0).tap(); await p.locator('.ownpick .chip').nth(3).tap(); await p.waitForSelector('text=いま 2 個にしるし', { exact: false }); await shot('s3-oils'); await k.noOverflow('精油');
    await tap('つぎへ'); await p.waitForSelector('text=手持ちのキャリアオイル'); await p.locator('.ownpick .chip').nth(1).tap(); await p.waitForSelector('text=いま 1 個にしるし', { exact: false });
    await tap('つぎへ'); await p.waitForSelector('text=はじめから入っているのは例です', { exact: false }); const m0 = await p.locator('.edit-row').count();
    await tap('＋ 足す'); await p.waitForFunction((n) => document.querySelectorAll('.edit-row').length === n + 1, m0); await p.locator('.edit-row input.grow').last().fill('見本のメニュー'); await shot('s5-menus'); await k.noOverflow('メニュー');
    await tap('つぎへ'); await p.waitForSelector('text=濃度の目安'); assert.ok(await p.getByText('体：1％まで').count(), '濃度の下書きが見える');
    await tap('下書きだと分かりました。自分で確かめて直します'); await shot('s6-draft'); await k.noOverflow('下書き');
    // 直す画面へ行って戻っても、続きから
    await tap('同意書の文を直す'); await p.waitForSelector('textarea'); await p.goto(BASE + '#/hajime'); await p.waitForSelector('text=「下書き」の確かめ');
    await tap('‹ もどる'); await p.waitForSelector('text=はじめから入っているのは例です', { exact: false }); await tap('つぎへ'); await tap('つぎへ'); await p.waitForSelector('text=バックアップは自分で'); await shot('s7-backup');
    await tap('できた（使いはじめる）'); await p.waitForSelector('.home-top'); assert.equal(await p.locator('.bar-title h1').textContent(), 'みほん/サロン'); await shot('s8-home');
    const st = await k.settings();
    assert.equal(st.staffName, '見本 たろう'); assert.equal(st.onboard.done, true); assert.ok(st.onboard.ack, '下書きの確かめの日'); assert.ok(st.pin && st.pin.hash);
    const own = await p.evaluate(async () => { const db = await import('./js/db.js'); return { o: (await db.all('oils')).filter((x) => x.owned).length, c: (await db.all('carriers')).filter((x) => x.owned).length, m: (await db.all('menus')).some((x) => x.name === '見本のメニュー') }; });
    assert.deepEqual(own, { o: 2, c: 1, m: true });
    // 開き直しても、案内はもう出ない
    await p.reload(); await p.waitForSelector('.home-top');
    // --- 設定：考え方・手引き・案内をもう一度 ---
    await p.goto(BASE + '#/set'); await p.waitForSelector('text=使い方の手引き'); assert.ok(await p.getByText('みほん/サロン・見本 たろう').count());
    await p.goto(BASE + '#/set/kangae'); await p.waitForSelector('text=医療ではありません'); await shot('k1-kangae'); await k.noOverflow('考え方');
    await p.goto(BASE + '#/set/tebiki'); await p.waitForSelector('.guide'); await p.locator('.guide summary').nth(5).tap(); await p.waitForSelector('text=新しい版があります', { exact: false }); await p.locator('.guide summary').nth(0).tap(); await shot('k2-tebiki'); await k.noOverflow('手引き');
    await p.goto(BASE + '#/hajime'); await p.waitForSelector('text=ようこそ'); await p.locator('.startskip').tap(); await p.waitForSelector('.home-top');
    // --- お客さん用の画面・同意書・バックアップの名前に、お店と施術する人の名前が出る ---
    await tap('＋ 新しいお客さん'); await p.getByPlaceholder('山田 花子').fill('見本 はじめ'); await tap('保存する'); await p.waitForSelector('.handbtn');
    const name = await p.evaluate(async () => (await import('./js/logic.js')).backupName((await (await import('./js/db.js')).getMeta('settings')).salonName, '2026-11-15'));
    assert.equal(name, 'みほん_サロン_カルテのバックアップ_2026-11-15.json');
    await p.evaluate(async () => { const s = await import('./js/state.js'); await s.enterGuest({ customerId: s.S.people[0].id, visitId: null, parts: ['consent'] }); location.hash = '#/guest'; });
    await p.waitForSelector('.guestmode'); await p.waitForSelector('text=みほん/サロン'); await shot('g1-hello');
    await p.evaluate(async () => { const s = await import('./js/state.js'); await s.leaveGuest(); location.hash = '#/'; }); await p.waitForSelector('.home-top');
    // --- 0.7.0（版6）のデータから上げる：案内は出さない・名前の入れ物が足される ---
    await p.evaluate(async () => { const db = await import('./js/db.js'); const st = await db.getMeta('settings'); delete st.onboard; delete st.staffName; delete st.reflex; await db.setMeta('settings', st); await db.setMeta('dataVersion', 6);
      const cs = await db.all('customers'); const ds = await db.all('details'); await db.batch(['customers', 'details'], (os) => { cs.forEach((c) => os.customers.delete(c.id)); ds.forEach((d) => os.details.delete(d.id)); }); });
    await p.reload(); await p.waitForSelector('.home-top'); const s6 = await k.settings();
    assert.equal(await p.evaluate(async () => (await import('./js/db.js')).getMeta('dataVersion')), 7); assert.equal(s6.onboard.done, true); assert.equal(s6.staffName, ''); assert.equal(s6.reflex.show, false); assert.equal(s6.salonName, 'みほん/サロン');
    await k.ctx.close(); console.log('✓', prefix);
  }
  await b.close();
  assert.deepEqual(errs, [], 'エラーなし'); assert.deepEqual(outside, [], '外への通信なし');
  console.log('✓ ぜんぶ通った（第3段・売るための設定）');
})().catch((e) => { console.error(e); process.exit(1); });
