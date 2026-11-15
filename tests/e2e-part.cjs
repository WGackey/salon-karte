// 第2段（部位だけのカルテ・経過のページ・予定の一覧）を、画面を実際に動かして確かめるテスト。
// 動かし方： python3 -m http.server 8080 を別で動かしてから  node tests/e2e-part.cjs [写真を置くフォルダ]
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
  const cdp = await ctx.newCDPSession(p);
  const touchLine = async (pts) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0][0], y: pts[0][1] }] });
    for (const [x, y] of pts.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await p.waitForTimeout(120); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(350);
  };
  const noOverflow = async (what) => assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${what}：横にはみ出さない`);
  const drawOn = async (sel, n = 0) => { // 図のまん中あたりを、指でなぞる
    const el = p.locator(sel).nth(n); await el.evaluate((e) => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(150); const b = await el.boundingBox();
    await touchLine([[b.x + b.width * 0.45, b.y + b.height * 0.5], [b.x + b.width * 0.5, b.y + b.height * 0.55], [b.x + b.width * 0.55, b.y + b.height * 0.6]]);
  };
  const pin = async (d = '1234') => { for (const c of d) await p.locator('.pinkey', { hasText: c }).first().tap(); };
  return { ctx, p, shot, tap, touchLine, noOverflow, drawOn, pin };
}
const visitOf = (p) => p.evaluate(async () => { const db = await import('./js/db.js'); await (await import('./js/state.js')).flush(); const id = location.hash.split('/')[2]; return db.get('visits', id); });

(async () => {
  const b = await chromium.launch();
  const pad = await kit(b, { viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }, 'pad-');
  const { p, shot, tap, drawOn } = pad;
  await p.goto(BASE); await p.waitForSelector('.page');

  // ---------- ① 部位だけのカルテ ----------
  await tap('＋ 新しいお客さん'); await p.getByPlaceholder('山田 花子').fill('見本 てのひら'); await p.getByPlaceholder('やまだ はなこ').fill('みほん てのひら');
  await tap('敏感肌'); await tap('ナッツ類（木の実）'); await tap('保存する'); await p.waitForSelector('text=今日の来店をはじめる');
  await tap('今日の来店をはじめる'); await p.waitForSelector('.scopepick');
  assert.ok(await p.locator('.scopesel .wholechip.on').count(), 'はじめは全身'); assert.ok(await p.getByText('今日の目的', { exact: true }).count(), '全身のときは、いつもの問診');
  await shot('01-monshin-whole');
  // メニューをえらぶだけで、部位が決まる
  await p.locator('.scopepick .chip', { hasText: 'ハンドトリートメント' }).tap(); await p.waitForSelector('.shortnote');
  let v = await visitOf(p); assert.deepEqual(v.scope, { type: 'part', parts: ['hand'] }); assert.equal(v.blend.areaId, 'a_part', '濃度の目安が部位に合わせて切りかわる'); assert.equal(v.menus[0].name, 'ハンドトリートメント');
  assert.equal(await p.getByText('今日の目的', { exact: true }).count(), 0, '短い問診：今日の目的は出ない'); assert.equal(await p.getByText('くらしのようす（睡眠・食事・仕事など）').count(), 0);
  assert.ok(await p.locator('.checkbox.has').textContent().then((t) => t.includes('ナッツ類') && t.includes('敏感肌')), 'アレルギーとからだの状態の確かめは省かない');
  assert.ok(await p.getByText('妊娠中', { exact: true }).count(), '気をつける状態（今日の状態）は省かない');
  const nSym = await p.locator('.step .card', { hasText: 'つらいところ' }).locator('.chips .chip:not(.moresym)').count(); assert.ok(nSym > 0 && nSym < 18, '部位に関わるつらいところだけ：' + nSym);
  await tap('冷え'); await tap('むくみ'); await shot('02-monshin-hand');
  await p.locator('.moresym').tap(); assert.equal(await p.locator('.step .card', { hasText: 'つらいところ' }).locator('.chips .chip').count(), 18, 'ほかのつらいところも出せる');
  await tap('ぜんぶの項目を出す'); assert.ok(await p.getByText('今日の目的', { exact: true }).count(), 'ぜんぶの項目に切りかえられる'); await tap('短い問診にもどす');
  // 気になるところ：手の図4つ
  await tap('次へ：気になるところ ›'); await p.waitForSelector('.zu.guest .bodypad.pt');
  assert.deepEqual(await p.locator('.zu .padname').allTextContents(), ['右手のひら', '左手のひら', '左手の甲', '右手の甲']);
  await drawOn('.zu .bodypad', 0); await p.locator('.markbtn', { hasText: '触れないで' }).tap(); await drawOn('.zu .bodypad', 2); await shot('03-kininaru-hand');
  await tap('後半へ：所見 ›'); await p.waitForSelector('.zu.staff .bodypad.pt');
  assert.equal(await p.locator('.zu .strokes.under.guest > *').count(), 2, 'お客さんの図が、所見の図に重なる');
  await drawOn('.zu .bodypad', 1); await shot('04-shoken-hand');
  await p.locator('.fullbtn').tap(); await p.waitForSelector('.zu.full'); await shot('05-full-hand');
  await p.locator('.fullview .chip', { hasText: '左手の甲' }).tap(); assert.equal(await p.locator('.zu .bodypad').count(), 1); await drawOn('.zu .bodypad', 0); await shot('06-full-one');
  await tap('‹ もどる（とじる）');
  v = await visitOf(p); assert.equal(v.guestFigures.hand_palm_r.length, 1); assert.equal(v.guestFigures.hand_back_l.length, 1); assert.equal(v.figures.hand_palm_l.length, 1); assert.equal(v.figures.hand_back_l.length, 1); assert.equal(v.figures.front.length, 0);
  // ブレンド：目安が「手・足だけ」
  await p.goto(p.url().replace(/\/[^/]+$/, '/blend')); await p.waitForSelector('.meter');
  assert.ok(await p.locator('.chip.on', { hasText: '手・足だけ' }).count(), 'ブレンドの目安が部位のもの'); await shot('07-blend-hand');
  await p.goto(p.url().replace(/\/[^/]+$/, '/sejutsu')); await p.waitForSelector('text=施術するところ：');
  assert.ok(await p.locator('.warnbox .bodypad.pt').count(), '触れないで（×）が、施術の画面に部位の図で出る'); await shot('08-sejutsu-hand');
  await p.goto(p.url().replace(/\/[^/]+$/, '/after')); await tap('できた（カルテをとじる）'); await p.waitForSelector('.hist');
  // お客さんのページ：これまでの記録に、部位の図
  assert.equal(await p.locator('.hist .slide').first().locator('.thumbs.pt .bodypad.pt').count(), 4); assert.ok(await p.locator('.hist .badge.part', { hasText: '手 だけ' }).count());
  assert.ok(await p.locator('.warnbox .notouchfig .bodypad.pt').count(), '触れないで（×）が、お客さんのページに出る'); await shot('09-customer-hand');
  await p.locator('.hist button.thumbs').first().tap(); await p.waitForSelector('.bigfigs'); assert.equal(await p.locator('.bigfigs .bodypad').count(), 4); await shot('10-bigfigs'); await tap('とじる');
  // 2回目：お客さんに渡す（足だけ）。短い版
  await p.locator('.foot .handbtn').tap(); await p.waitForSelector('.sheet .scopepick'); await p.locator('.sheet .scopesel .chip', { hasText: '足' }).tap(); await shot('11-handover'); await p.locator('.sheet .chips.col .chip', { hasText: '同意書とサイン' }).tap();
  await tap('この内容で、お客さんに渡す'); await p.waitForSelector('.pinwrap'); await pad.pin(); await p.waitForSelector('text=もう一度、同じ数字を'); await pad.pin(); await p.waitForSelector('.guestmode');
  await tap('はじめる'); await p.waitForSelector('text=つらいところ・気になること'); assert.ok(await p.getByText('足の疲れ').count()); assert.equal(await p.getByText('肩こり', { exact: true }).count(), 0, 'お客さん用も、足に関わるものだけ先に'); await shot('12-guest-m1');
  await tap('足の疲れ'); await tap('つぎへ ›'); await p.waitForSelector('.guestmode .bodypad.pt');
  assert.deepEqual(await p.locator('.guestmode .padname').allTextContents(), ['右足の裏', '左足の裏', '左足の甲', '右足の甲']);
  assert.equal(await p.locator('.guestmode .strokes .notouch').count(), 0, '手の × は、足の図には出ない');
  await drawOn('.guestmode .bodypad', 0); await shot('13-guest-foot'); await tap('つぎへ ›'); await p.waitForSelector('text=伝えておきたいこと'); assert.equal(await p.getByText('今日の目的', { exact: true }).count(), 0); await shot('14-guest-m3');
  await tap('これで書きおわる'); await p.waitForSelector('.gdone'); await tap('スタッフ：合言葉を入れてもどる'); await pad.pin(); await p.waitForSelector('.scopepick');
  v = await visitOf(p); assert.deepEqual(v.scope, { type: 'part', parts: ['foot'] }); assert.equal(v.guestFigures.foot_sole_r.length, 1); assert.equal(v.guestFigures.hand_back_l.length, 1, '手の × は、次の来店にも写っている（足の図には出ないだけ）');
  // 部位をいくつも：手＋足
  await p.locator('.page .scopesel .chip', { hasText: '手' }).tap(); await p.waitForTimeout(200); await tap('次へ：気になるところ ›'); await p.waitForSelector('.zu.guest'); assert.equal(await p.locator('.zu .bodypad').count(), 8); await shot('15-hand-foot');
  // 設定：メニューに部位をひもづける・部位の設定
  await p.goto(BASE + '#/set/menus'); await p.waitForSelector('.menuscope'); await shot('16-set-menus');
  await p.locator('.edit-row').nth(0).locator('.menuscope .chip', { hasText: '背中・腰' }).tap(); await p.waitForTimeout(300);
  assert.deepEqual(await p.evaluate(async () => (await (await import('./js/db.js')).get('menus', 'mn_1')).scope), { type: 'part', parts: ['back'] });
  await p.goto(BASE + '#/set/parts'); await p.waitForSelector('text=関わる「つらいところ」（短い問診で先に出す）'); await shot('17-set-parts'); await pad.noOverflow('部位の設定');
  // 頭・首肩・背中の図
  await p.goto(BASE + '#/'); await p.waitForSelector('.home-top');
  const vid = v.id; await p.evaluate(async (id) => { const db = await import('./js/db.js'); const x = await db.get('visits', id); x.scope = { type: 'part', parts: ['head', 'neck', 'back'] }; await db.put('visits', x); }, vid);
  await p.goto(BASE + `#/v/${vid}/shoken`); await p.waitForSelector('.zu.staff .bodypad.pt'); assert.equal(await p.locator('.zu .bodypad').count(), 6); await shot('18-head-neck-back');
  // 0.6.0（版5）の形にもどして開き直す → 版6に直る。前の図・カルテはそのまま
  await p.goto(BASE + '#/');
  await p.evaluate(async () => { const db = await import('./js/db.js'); const st = await db.getMeta('settings'); delete st.parts; delete st.wholeAreaId;
    const ms = (await db.all('menus')).map(({ scope, ...m }) => m); const vs = (await db.all('visits')).map((x) => ({ ...x, scope: { type: 'whole' } }));
    await db.batch(['menus', 'visits', 'meta'], (os) => { ms.forEach((m) => os.menus.put(m)); vs.forEach((x) => os.visits.put(x)); os.meta.put({ key: 'settings', value: st }); os.meta.put({ key: 'dataVersion', value: 5 }); }); });
  await p.reload(); await p.waitForSelector('.home-top');
  const mig = await p.evaluate(async () => { const db = await import('./js/db.js'); const st = await db.getMeta('settings'); return { ver: await db.getMeta('dataVersion'), parts: st.parts.length, menus: (await db.all('menus')).map((m) => m.scope), n: (await db.all('visits')).length }; });
  assert.deepEqual(mig, { ver: 6, parts: 5, menus: [null, null, null, null, null], n: 2 }, '版5 → 版6：' + JSON.stringify(mig));
  await p.goto(BASE + `#/v/${vid}/monshin`); await p.waitForSelector('.scopepick'); assert.ok(await p.locator('.scopesel .wholechip.on').count(), '0.6.0 のカルテは全身として開く');

  // ---------- iPhone ----------
  const ph = await kit(b, { viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, 'ph-'); const q = ph.p;
  await q.goto(BASE); await q.waitForSelector('.page'); await ph.tap('＋ 新しいお客さん'); await q.getByPlaceholder('山田 花子').fill('見本 あしうら'); await ph.tap('保存する'); await q.waitForSelector('text=今日の来店をはじめる');
  await ph.tap('今日の来店をはじめる'); await q.waitForSelector('.scopepick'); await q.locator('.scopepick .chip', { hasText: 'フットトリートメント' }).tap(); await q.waitForSelector('.shortnote'); await ph.shot('01-monshin-foot'); await ph.noOverflow('iPhone 問診');
  await ph.tap('次へ：気になるところ ›'); await q.waitForSelector('.zu.guest .bodypad.pt'); assert.equal(await q.locator('.zu .bodypad').count(), 1, 'iPhone は図を1つずつ'); await ph.shot('02-kininaru-foot'); await ph.noOverflow('iPhone 図');
  await q.locator('.openfull').tap(); await q.waitForSelector('.zu.full'); await ph.drawOn('.zu .bodypad', 0); await ph.shot('03-full-foot');
  await q.locator('.fullview .chip', { hasText: '左足の甲' }).scrollIntoViewIfNeeded(); await q.locator('.fullview .chip', { hasText: '左足の甲' }).tap(); await ph.drawOn('.zu .bodypad', 0); await ph.shot('04-full-foot-top'); await ph.tap('‹ もどる（とじる）');
  await q.goto(q.url().replace(/\/[^/]+$/, '/after')); await ph.tap('できた（カルテをとじる）'); await q.waitForSelector('.hist'); await q.locator('.hist').scrollIntoViewIfNeeded(); await ph.shot('05-customer-foot'); await ph.noOverflow('iPhone お客さんのページ');
  await q.locator('.hist button.thumbs').first().tap(); await q.waitForSelector('.bigfigs'); await ph.shot('06-bigfigs'); await ph.noOverflow('iPhone 図を大きく');

  assert.deepEqual(errs, [], 'エラーなし'); assert.deepEqual(outside, [], '外への通信なし');
  console.log('✓ ぜんぶ通った（第2段）'); await b.close();
})().catch((e) => { console.error('✗ 失敗：', e.message, '\n', (e.stack || '').split('\n').slice(1, 4).join('\n')); console.error(errs); process.exit(1); });
