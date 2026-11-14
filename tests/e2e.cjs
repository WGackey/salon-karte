// 画面を実際に動かして確かめるテスト（iPad の大きさ・タッチ）。
// 動かし方： python3 -m http.server 8080 を別で動かしてから  node tests/e2e.cjs [写真を置くフォルダ]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path'); const assert = require('assert/strict');
const BASE = process.env.BASE || 'http://localhost:8080/'; const OUT = process.argv[2] || null;
const log = (...a) => console.log(...a);

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, acceptDownloads: true, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const outside = []; p.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) outside.push(r.url()); });
  const shot = async (name) => { if (OUT) { fs.mkdirSync(OUT, { recursive: true }); await p.screenshot({ path: path.join(OUT, name + '.png') }); } };
  const tap = (text, opt = {}) => p.getByText(text, { exact: opt.exact ?? true }).first().tap();
  const cdp = await ctx.newCDPSession(p);
  const touchLine = async (pts) => { // 指でなぞる
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0][0], y: pts[0][1] }] });
    for (const [x, y] of pts.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };

  await p.goto(BASE); await p.waitForSelector('.page');
  await shot('01-home-empty');

  // --- お客さんを登録 ---
  await tap('＋ 新しいお客さん');
  await p.getByPlaceholder('山田 花子').fill('試験 みほ'); await p.getByPlaceholder('やまだ はなこ').fill('しけん みほ');
  await tap('女性'); await p.getByLabel('年', { exact: true }).selectOption('1985'); await p.getByLabel('月', { exact: true }).selectOption('04'); await p.getByLabel('日', { exact: true }).selectOption('09');
  await tap('敏感肌'); await p.getByPlaceholder('例：ナッツ、ラベンダー').fill('ティートリー');
  await shot('02-new-customer');
  await tap('保存する'); await p.waitForSelector('text=今日の来店をはじめる');
  assert.ok(await p.getByText('No.1').count(), 'カルテ番号が自動でつく');
  await shot('03-customer');

  // --- 来店：問診 ---
  await tap('今日の来店をはじめる'); await p.waitForSelector('.steps');
  await tap('妊娠中'); await tap('肩こり'); await tap('眠りが浅い'); await tap('冷え');
  await p.locator('.symrow').nth(0).getByText('8', { exact: true }).tap();
  await tap('リラックスしたい');
  await shot('04-monshin');

  // --- からだの図：指でなぞる ---
  await tap('次へ：からだの図 ›'); await p.waitForSelector('.bodypad');
  const box = await p.locator('.bodypad').nth(1).boundingBox(); const sy0 = await p.evaluate(() => scrollY);
  const cx = box.x + box.width / 2, top = box.y;
  await touchLine([[cx - 30, top + box.height * 0.2], [cx - 10, top + box.height * 0.21], [cx + 10, top + box.height * 0.2], [cx + 30, top + box.height * 0.21]]);
  await tap('痛い'); await tap('太い');
  const b0 = await p.locator('.bodypad').nth(0).boundingBox();
  await touchLine([[b0.x + b0.width / 2, b0.y + b0.height * 0.4], [b0.x + b0.width / 2 + 5, b0.y + b0.height * 0.45], [b0.x + b0.width / 2, b0.y + b0.height * 0.5]]);
  assert.equal(await p.locator('.bodypad .strokes path').count(), 2, '指でなぞった線が2本');
  assert.equal(await p.evaluate(() => scrollY), sy0, 'なぞっても画面が動かない');
  await shot('05-zu');
  await tap('ひとつ戻す'); assert.equal(await p.locator('.bodypad .strokes path').count(), 1, 'ひとつ戻す');
  await tap('消しゴム'); await touchLine([[cx, top + box.height * 0.2], [cx + 2, top + box.height * 0.205]]);
  assert.equal(await p.locator('.bodypad .strokes path').count(), 0, '消しゴムで消える');
  await tap('こっている'); await touchLine([[cx - 30, top + box.height * 0.2], [cx, top + box.height * 0.21], [cx + 30, top + box.height * 0.2]]);
  await tap('後ろを大きく'); await shot('05b-zu-big'); await tap('ならべる');

  // --- 精油の候補 ---
  await tap('次へ：精油 ›'); await p.waitForSelector('.oil');
  assert.ok(await p.getByText('理由があって外したもの', { exact: false }).count(), '外したものを見せる');
  const outText = await p.locator('.oil.out').allTextContents();
  assert.ok(outText.some((t) => t.includes('ティートリー') && t.includes('アレルギー')), 'アレルギーの精油は理由つきで外す');
  assert.ok(outText.some((t) => t.includes('クラリセージ') && t.includes('妊娠中')), '妊娠中に気をつける精油は理由つきで外す');
  const lav = p.locator('.oil', { hasText: 'ラベンダー（真正）' });
  await lav.getByText('手持ちにする').tap(); await p.locator('.oil.hit', { hasText: 'ラベンダー（真正）' }).waitFor();
  await p.locator('.oil.hit', { hasText: 'ラベンダー（真正）' }).getByText('使う', { exact: true }).tap();
  await p.locator('.oil', { hasText: 'オレンジ・スイート' }).getByText('使う', { exact: true }).tap();
  await shot('06-seiyu');
  await tap('花'); assert.equal(await p.locator('.oil', { hasText: 'オレンジ・スイート' }).count(), 0, '香りの系統でしぼれる'); await tap('花');

  // --- ブレンド ---
  await tap('次へ：ブレンド ›'); await p.waitForSelector('.meter');
  await tap('＋ キャリアオイルをえらぶ'); await tap('ホホバオイル（持っていない）');
  assert.equal((await p.locator('.meter .pct').textContent()).trim(), '0.3％', '30ml に 2滴で 0.3％');
  assert.ok(await p.getByText('この量なら 6滴まで', { exact: false }).count(), '目安までの滴数が出る');
  const plus = p.locator('.brow').first().getByText('＋'); for (let i = 0; i < 5; i++) await plus.tap();
  assert.equal((await p.locator('.meter .pct').textContent()).trim(), '1.2％');
  assert.ok(await p.locator('.meter.over').count(), '目安をこえたら色が変わる');
  await shot('07-blend-over');
  const minus = p.locator('.brow').first().getByText('−'); for (let i = 0; i < 3; i++) await minus.tap();
  assert.ok(await p.locator('.meter.ok').count(), '目安の中にもどる');
  await tap('名前をつけて残す'); await p.getByPlaceholder('例：肩こり用・夜のリラックス').fill('夜のリラックス'); await tap('残す');
  await shot('07b-blend-ok');

  // --- 施術・施術後 ---
  await tap('次へ：施術 ›'); await p.waitForSelector('text=施術メニュー');
  await p.getByText('アロマトリートメント 60分').tap(); await p.getByPlaceholder('例：背中と脚を中心に。圧は弱め').fill('背中を中心に');
  await shot('08-sejutsu');
  await tap('次へ：施術後 ›'); await p.waitForSelector('text=つらさの変化');
  await p.locator('.symrow').nth(0).getByText('3', { exact: true }).tap(); await tap('とても好き'); await tap('2週間後');
  await shot('09-after');
  await tap('カルテを保存して終わる'); await p.waitForSelector('text=情報を直す');
  const pageText = await p.locator('.main').textContent();
  assert.ok(pageText.includes('肩こり 8→3'), 'つらさの変化が残る：' + pageText.slice(0, 300)); assert.ok(pageText.includes('ラベンダー（真正） 3滴'), 'ブレンドが残る');
  assert.ok(pageText.includes('1回'), '回数を自動で数える'); assert.ok(pageText.includes('妊娠中（前回）'), '注意のしるし');
  assert.equal(await p.locator('.thumbs .strokes path').count(), 1, '図の小さな写しが出る');
  await shot('10-customer-after');

  // --- 2回目：前回の問診が入っている・前回のブレンドを写せる ---
  await p.evaluate(async () => { // 前回を昨日の日付にして、2回目を今日にする
    const db = await import('./js/db.js'); const { addDays, todayStr } = await import('./js/logic.js');
    const v = (await db.all('visits'))[0]; v.date = addDays(todayStr(), -1); await db.put('visits', v);
  });
  await p.reload(); await p.waitForSelector('text=今日の来店をはじめる'); await tap('今日の来店をはじめる'); await p.waitForSelector('.steps');
  assert.ok(await p.getByText('の問診が入っています', { exact: false }).count(), '前回の問診が入った状態で開く');
  assert.equal(await p.locator('.symrow').count(), 3);
  await p.goto(BASE + (await p.evaluate(() => location.hash.replace('monshin', 'blend')))); await p.waitForSelector('.meter');
  await p.getByText('前回のブレンドを写す', { exact: false }).tap();
  assert.equal((await p.locator('.meter .pct').textContent()).trim(), '0.7％', '前回のブレンドを写す');
  await p.getByText('よく使うブレンドから').tap(); assert.ok(await p.getByText('夜のリラックス').count(), 'よく使うブレンドが出る'); await tap('とじる');

  // --- ホーム：予定とさがす ---
  await p.goto(BASE + '#/'); await p.waitForSelector('.home-top');
  await p.getByLabel('お客さんをさがす').fill('シケン'); assert.equal(await p.locator('.list .row-link', { hasText: '試験 みほ' }).count(), 1, 'カタカナでもさがせる');

  // --- バックアップ：合言葉つきで書き出し → ぜんぶ消す → 戻す ---
  await p.goto(BASE + '#/set/backup'); await p.waitForSelector('text=バックアップを作る');
  await p.locator('input[type=password]').nth(0).fill('あいことば123'); await p.locator('input[type=password]').nth(1).fill('あいことば123');
  await tap('バックアップを作る'); await p.waitForSelector('text=保存先をえらぶ');
  const [dl] = await Promise.all([p.waitForEvent('download'), tap('保存先をえらぶ')]);
  const file = path.join(require('os').tmpdir(), 'karte-e2e-backup.json'); await dl.saveAs(file);
  const raw = fs.readFileSync(file, 'utf8'); assert.ok(!raw.includes('試験') && !raw.includes('しけん'), 'カギつきのファイルに名前がそのまま入っていない');
  await p.waitForSelector('text=今日バックアップ済み');
  await p.evaluate(async () => { const db = await import('./js/db.js'); const d = await db.openDb(); for (const s of ['customers', 'details', 'visits', 'blends']) await new Promise((r) => { d.transaction(s, 'readwrite').objectStore(s).clear().onsuccess = r; }); });
  await p.reload(); await p.waitForSelector('text=書き出す');
  await p.locator('input[type=file]').setInputFiles(file); await p.waitForSelector('text=合言葉つき');
  await p.locator('input[type=password]').nth(2).fill('ちがう'); await tap('このバックアップに入れ替える'); await tap('入れ替える');
  await p.waitForSelector('text=合言葉がちがうか'); // まちがった合言葉では開かない
  await p.locator('input[type=password]').nth(2).fill('あいことば123'); await tap('このバックアップに入れ替える'); await tap('入れ替える');
  await p.waitForSelector('.home-top');
  const back = await p.evaluate(async () => { const db = await import('./js/db.js'); return { c: await db.count('customers'), v: await db.count('visits'), b: await db.count('blends') }; });
  assert.deepEqual(back, { c: 1, v: 2, b: 1 }, 'バックアップから元どおり');
  await shot('11-home');

  // --- 版の移し替え（iPad の中のデータ） ---
  const mig = await p.evaluate(async () => {
    const db = await import('./js/db.js');
    const r = await db.migrateDb([{ to: 2, stores: { visits: (x) => ({ ...x, _test: 'moved' }) } }], 2);
    const ok = (await db.all('visits')).every((x) => x._test === 'moved'); const ver = await db.getMeta('dataVersion');
    // 元にもどす
    const d = await db.openDb(); const vs = await db.all('visits'); for (const x of vs) delete x._test; await db.bulkPut('visits', vs); await db.setMeta('dataVersion', 1);
    return { r, ok, ver };
  });
  assert.deepEqual(mig, { r: { from: 1, to: 2 }, ok: true, ver: 2 }, '版の移し替え');

  // --- 見本 1,000人で速さを見る ---
  await p.goto(BASE + '#/set/sample'); await tap('見本を 1,000人 入れる'); await p.waitForSelector('text=入れました', { timeout: 120000 });
  const addMsg = await p.locator('.notice.ok').textContent();
  const perf = await p.evaluate(async () => {
    const st = await import('./js/state.js'); const { searchPeople } = await import('./js/logic.js'); const db = await import('./js/db.js');
    const t = (fn) => { const a = performance.now(); return Promise.resolve(fn()).then(() => +(performance.now() - a).toFixed(1)); };
    const list = await t(() => st.reload()); const search = await t(() => searchPeople(st.S.people, 'はるの')); const pid = st.S.people[500].id;
    const open = await t(async () => { await db.get('details', pid); await st.visitsOf(pid); });
    const dump = await t(() => db.dumpAll()); const est = await navigator.storage.estimate();
    return { people: st.S.people.length, visits: await db.count('visits'), listMs: list, searchMs: search, openCustomerMs: open, dumpAllMs: dump, usageMB: +(est.usage / 1048576).toFixed(1) };
  });
  const nav = async (hash, sel) => { const a = Date.now(); await p.goto(BASE + '#' + hash); await p.waitForSelector(sel); return Date.now() - a; };
  await p.goto(BASE + '#/set');
  perf.homeScreenMs = await nav('/', '.home-top'); perf.listScreenMs = await nav('/list', '.row-link');
  const t0 = Date.now(); await p.reload(); await p.waitForSelector('.row-link'); perf.coldStartMs = Date.now() - t0;
  await p.goto(BASE + '#/'); await p.waitForSelector('.home-top'); await p.getByLabel('お客さんをさがす').fill('ハルノ'); await p.waitForSelector('.home-top + .list .row-link');
  assert.ok(await p.getByText('ほか', { exact: false }).count() || await p.locator('.home-top + .list .row-link').count() > 3, '1,000人の中からさがせる');
  await shot('12-home-1000');
  log('見本を入れたとき：', addMsg); log('速さ：', JSON.stringify(perf));
  assert.ok(perf.people >= 1001 && perf.listMs < 1000 && perf.openCustomerMs < 300);
  await p.goto(BASE + '#/set/sample'); await tap('見本をぜんぶ消す'); await tap('消す'); await p.waitForSelector('text=を消しました', { timeout: 120000 });
  assert.deepEqual(await p.evaluate(async () => { const db = await import('./js/db.js'); return [await db.count('customers'), await db.count('visits'), await db.count('details')]; }), [1, 2, 1], '見本だけ消えて、本物は残る');

  // --- ネットなしで開く ---
  await p.goto(BASE); await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(800);
  await ctx.setOffline(true); await p.reload(); await p.waitForSelector('.home-top');
  await p.getByLabel('お客さんをさがす').fill('試験'); await p.locator('.list .row-link').first().tap(); await p.waitForSelector('text=来店の記録');
  await p.goto(BASE + '#/set/oils'); await p.waitForSelector('text=ラベンダー');
  await ctx.setOffline(false); log('ネットなし：開けた');

  // --- たて向き・設定の画面 ---
  await p.setViewportSize({ width: 768, height: 1024 });
  for (const [h, n] of [['/set', '13-settings'], ['/set/oils', '14-oils'], ['/set/oil/o_lavender', '15-oil-edit'], ['/set/limits', '16-limits'], ['/set/cats', '17-cats'], ['/set/backup', '18-backup']]) { await p.goto(BASE + '#' + h); await p.waitForSelector('.page'); await p.waitForTimeout(150); await shot(n); }
  const vid = await p.evaluate(async () => { const db = await import('./js/db.js'); return (await db.all('visits')).find((v) => v.status === 'done').id; });
  for (const s of ['monshin', 'zu', 'seiyu', 'blend']) { await p.goto(BASE + `#/v/${vid}/${s}`); await p.waitForSelector('.step'); await p.waitForTimeout(150); await shot('20-tate-' + s); }
  const wide = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth); assert.equal(wide, false, 'たて向きで横にはみ出さない');

  assert.deepEqual(outside, [], '外へ通信していない'); assert.deepEqual(errs, [], 'エラーなし');
  log('✓ ぜんぶ通った'); await b.close();
})().catch((e) => { console.error('✗ 失敗：', e.message); process.exit(1); });
