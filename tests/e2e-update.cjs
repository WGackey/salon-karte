// 新しい版に気づくしくみを確かめるテスト。置き場の写しを作って、途中で sw.js の版を上げる。
// 動かし方： node tests/e2e-update.cjs [写真を置くフォルダ]   （自分で写しを作って 8091 番で動かす）
const { chromium } = require('playwright'); const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path'); const assert = require('assert/strict');
const OUT = process.argv[2] || null; const PORT = 8091; const BASE = `http://localhost:${PORT}/`;
(async () => {
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'karte-')); const root = path.join(__dirname, '..');
  for (const f of ['index.html', 'sw.js', 'manifest.webmanifest', 'css', 'js', 'icons']) fs.cpSync(path.join(root, f), path.join(site, f), { recursive: true });
  const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: site, stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 800));
  const b = await chromium.launch(); const errs = [];
  try {
    const ctx = await b.newContext({ locale: 'ja-JP', timezoneId: 'Asia/Tokyo', viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    const shot = async (n) => { if (OUT) { fs.mkdirSync(OUT, { recursive: true }); await p.screenshot({ path: path.join(OUT, n + '.png') }); } };
    const cdp = await ctx.newCDPSession(p);
    // 0.13.0：ホームの上に知らせの帯が出るようになったので、引っぱりはじめる場所を いちばん上の見出しに（検索のらんの上からだと、引っぱりにならない）
    const pull = async (dy) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 190, y: 30 }] }); for (let y = 20; y <= dy; y += 20) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 190, y: 30 + y }] }); await p.waitForTimeout(100); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
    await p.goto(BASE); await p.waitForSelector('.startskip'); await p.locator('.startskip').tap(); await p.waitForSelector('.home-top');
    await p.evaluate(() => navigator.serviceWorker.ready); await p.reload(); await p.waitForSelector('.home-top'); await p.waitForFunction(() => !!navigator.serviceWorker.controller);
    // 少しだけ引く → さがさない／しっかり引く → 「いちばん新しい」
    await pull(40); await p.waitForTimeout(200); assert.equal(await p.locator('.pullnote.show').count(), 0, '少し引いただけでは、さがさない');
    await pull(160); await p.waitForSelector('text=いまの版がいちばん新しいです'); await shot('u1-latest'); assert.equal(await p.locator('.update-bar').count(), 0);
    // 新しい版を置く → 引っぱる → 案内が出る（勝手には切りかわらない）
    await p.waitForTimeout(3600);
    fs.writeFileSync(path.join(site, 'sw.js'), fs.readFileSync(path.join(site, 'sw.js'), 'utf8').replace(/const VERSION = '[^']+'/, "const VERSION = '9.9.9'"));
    fs.writeFileSync(path.join(site, 'js/version.js'), "export const APP_VERSION = '9.9.9';\n");
    await pull(160); await p.waitForSelector('.update-bar'); assert.ok((await p.locator('.update-bar').textContent()).includes('入れたデータはそのまま残ります')); await shot('u2-found');
    assert.equal(await p.evaluate(async () => (await import('./js/version.js')).APP_VERSION) !== '9.9.9', true, '押すまで切りかわらない');
    // 来店の流れの途中は小さなしるし・お客さん用の画面では出さない
    await p.getByText('＋ 新しいお客さん').tap(); await p.getByPlaceholder('山田 花子').fill('見本 こうしん'); await p.getByText('保存する', { exact: true }).tap(); await p.waitForSelector('.handbtn');
    assert.equal(await p.locator('.update-bar.small').count(), 0); await p.getByText('今日の来店をはじめる').first().tap(); await p.waitForSelector('.scopepick'); await p.waitForSelector('.update-bar.small'); assert.equal((await p.locator('.update-bar').textContent()), '新しい版あり'); await shot('u3-small');
    await p.evaluate(async () => { const s = await import('./js/state.js'); await s.enterGuest({ customerId: s.S.people[0].id, visitId: null, parts: ['consent'] }); location.hash = '#/guest'; }); await p.waitForSelector('.guestmode'); assert.equal(await p.locator('.update-bar:visible').count(), 0, 'お客さん用の画面では出さない');
    await p.evaluate(async () => { const s = await import('./js/state.js'); await s.leaveGuest(); location.hash = '#/set/about'; }); await p.waitForSelector('text=新しい版をさがす'); await p.waitForSelector('.update-bar:not(.small)'); await shot('u4-about');
    // 押すと新しくなる・データはそのまま
    await p.locator('.update-bar').tap(); await p.waitForFunction(() => document.body.textContent.includes('いまの版：9.9.9'), null, { timeout: 15000 });
    assert.equal(await p.evaluate(async () => (await (await import('./js/db.js')).all('customers')).length), 1, 'データはそのまま'); assert.equal(await p.locator('.update-bar').count(), 0);
    // ネットなし：だまって何もしない（エラーを出さない）
    await p.goto(BASE + '#/'); await p.waitForSelector('.home-top'); await ctx.setOffline(true); await pull(160); await p.waitForSelector('text=いまはさがせませんでした', { exact: false }); await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(500);
    assert.deepEqual(errs, [], 'エラーなし');
    console.log('✓ ぜんぶ通った（新しい版に気づくしくみ）');
  } finally { await b.close(); srv.kill(); fs.rmSync(site, { recursive: true, force: true }); }
})().catch((e) => { console.error(e); process.exit(1); });
