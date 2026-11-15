// 画面を実際に動かして確かめるテスト（iPad と iPhone の大きさ・タッチ）。
// 動かし方： python3 -m http.server 8080 を別で動かしてから  node tests/e2e.cjs [写真を置くフォルダ]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path'); const assert = require('assert/strict');
const BASE = process.env.BASE || 'http://localhost:8080/'; const OUT = process.argv[2] || null;
const log = (...a) => console.log(...a);

const errs = []; const outside = [];
// ひとつの端末ぶんの道具（ページ・押す・なぞる・写真）
async function kit(b, opt, prefix) {
  const ctx = await b.newContext({ acceptDownloads: true, locale: 'ja-JP', timezoneId: 'Asia/Tokyo', ...opt });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(prefix + e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(prefix + m.text()));
  p.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) outside.push(r.url()); });
  const shot = async (name) => { if (OUT) { fs.mkdirSync(OUT, { recursive: true }); await p.screenshot({ path: path.join(OUT, prefix + name + '.png') }); } };
  const tap = (text, o = {}) => p.getByText(text, { exact: o.exact ?? true }).locator('visible=true').first().tap(); // 見えているものを押す
  const cdp = await ctx.newCDPSession(p);
  const touchLine = async (pts, { hold = false } = {}) => { // 指でなぞる
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0][0], y: pts[0][1] }] });
    for (const [x, y] of pts.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    if (hold) await p.waitForTimeout(120); // 指を止めてから離す（サインなど。すばやく払ったと見なされると、次の1回押しがブラウザに食われる）
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(350); // 人の手の速さに合わせる（すぐ次を押すと、ブラウザが「2回押し」と見なして押したことにならない）
  };
  const noOverflow = async (what) => assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${what}：横にはみ出さない`);
  const counts = () => p.evaluate(async () => { const db = await import('./js/db.js'); return { c: await db.count('customers'), v: await db.count('visits'), b: await db.count('blends') }; });
  const skipStart = async () => { await p.waitForSelector('.page'); if (await p.locator('.startskip').count()) { await p.locator('.startskip').tap(); await p.waitForSelector('.home-top'); } };
  return { skipStart, ctx, p, shot, tap, touchLine, noOverflow, counts };
}
const strokes = (p) => p.locator('.zu .bodypad .strokes.own path').count();

(async () => {
  const b = await chromium.launch();
  const pad = await kit(b, { viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }, '');
  const { ctx, p, shot, tap, touchLine } = pad;

  await p.goto(BASE); await pad.skipStart();
  await shot('01-home-empty');

  // --- お客さんを登録 ---
  await tap('＋ 新しいお客さん');
  await p.getByPlaceholder('山田 花子').fill('試験 みほ'); await p.getByPlaceholder('やまだ はなこ').fill('しけん みほ');
  await tap('女性'); await p.getByLabel('年', { exact: true }).selectOption('1985'); await p.getByLabel('月', { exact: true }).selectOption('04'); await p.getByLabel('日', { exact: true }).selectOption('09');
  await tap('敏感肌'); await tap('ナッツ類（木の実）'); await p.getByPlaceholder('例：ナッツ、ラベンダー').fill('ティートリー');
  await shot('02-new-customer');
  await tap('保存する'); await p.waitForSelector('text=今日の来店をはじめる');
  assert.ok(await p.getByText('No.1').count(), 'カルテ番号が自動でつく');
  await shot('03-customer');

  // --- 来店：問診 ---
  await tap('今日の来店をはじめる'); await p.waitForSelector('.steps');
  await tap('妊娠中'); await tap('肩こり'); await tap('眠りが浅い'); await tap('冷え');
  await p.locator('.symrow').nth(0).getByText('8', { exact: true }).tap();
  await tap('乾燥しやすい'); await tap('リラックスしたい');
  await shot('04-monshin');

  // --- からだの図：指でなぞる ---
  await tap('次へ：気になるところ ›'); await p.waitForSelector('.zu.guest');
  assert.ok((await p.locator('.whobar').textContent()).includes('施術者が聞き取って書いた'), '「今日の来店をはじめる」で始めた回は「施術者が聞き取って書いた」');
  await tap('後半へ：所見 ›'); await p.waitForSelector('.zu.staff'); await p.waitForSelector('.zuprev .bodypad');
  // 0.9.0：来店の流れの中は小さな図（見るだけ）。小さな図の上ではなぞれない → 押すと画面いっぱいで開いて書ける
  assert.equal(await p.locator('.zuprev .bodypad.ro').count(), 2, '小さな図は見るだけ'); assert.equal(await p.locator('.toolbar:visible').count(), 0, '小さな図のときは道具を出さない');
  assert.ok((await p.locator('.zuprev').textContent()).includes('画面いっぱいで書けます'), '押すと書けると分かる'); await shot('05-zu-prev');
  await p.locator('.zuprev').tap(); await p.waitForSelector('.zu.full .zu-main .bodypad');
  const box = await p.locator('.bodypad').nth(1).boundingBox(); const sy0 = await p.evaluate(() => scrollY);
  const cx = box.x + box.width / 2, top = box.y;
  await touchLine([[cx - 30, top + box.height * 0.2], [cx - 10, top + box.height * 0.21], [cx + 10, top + box.height * 0.2], [cx + 30, top + box.height * 0.21]]);
  await tap('痛い'); await tap('太い');
  const b0 = await p.locator('.bodypad').nth(0).boundingBox();
  await touchLine([[b0.x + b0.width / 2, b0.y + b0.height * 0.4], [b0.x + b0.width / 2 + 5, b0.y + b0.height * 0.45], [b0.x + b0.width / 2, b0.y + b0.height * 0.5]]);
  assert.equal(await strokes(p), 2, '指でなぞった線が2本');
  assert.equal(await p.evaluate(() => scrollY), sy0, 'なぞっても画面が動かない');
  await shot('05-zu');
  await tap('↩ 戻す'); assert.equal(await strokes(p), 1, 'ひとつ戻す');
  await tap('消しゴム（線をえらぶ）'); await touchLine([[cx, top + box.height * 0.2], [cx + 2, top + box.height * 0.205]]);
  assert.equal(await strokes(p), 0, '消しゴムで消える');
  await tap('↩ 戻す'); assert.equal(await strokes(p), 1, '消しゴムで消した線が「ひとつ戻す」で戻る');
  await tap('↩ 戻す'); assert.equal(await strokes(p), 0, 'もう一度で、その線をかく前に戻る');
  assert.ok(await p.getByText('↩ 戻す').isDisabled(), '戻すものがなくなったら押せない');
  await tap('こっている'); await touchLine([[cx - 30, top + box.height * 0.2], [cx, top + box.height * 0.21], [cx + 30, top + box.height * 0.2]]);
  await tap('開く前に戻す'); await p.locator('.dialog').getByText('開く前に戻す').tap(); assert.equal(await strokes(p), 0, '開く前の図に戻る');
  await tap('↩ 戻す'); assert.equal(await strokes(p), 1, '「開く前に戻す」も、ひとつ戻すで取り消せる');
  assert.equal(await p.locator('.markbtn.on').count(), 1); assert.equal(await p.locator('.widthbtn.on').count(), 1);
  await p.locator('.fullview .chip', { hasText: '後ろ' }).tap(); await shot('05b-zu-big'); assert.equal(await p.locator('.zu .bodypad').count(), 1);
  const fb = await p.locator('.zu .bodypad').boundingBox(); assert.ok(fb.y >= 0 && fb.y + fb.height <= 768 && fb.height > 560, `iPad の画面いっぱいで図がおさまる（${Math.round(fb.y)}〜${Math.round(fb.y + fb.height)}）`);
  const cl = await p.locator('.closefull').boundingBox(); assert.ok(cl.y < 80 && cl.x < 60 && cl.height >= 44 && cl.width >= 120, `画面いっぱいの上のほうに、大きな「もどる（とじる）」がある：${JSON.stringify(cl)}`);
  await tap('‹ もどる（とじる）'); assert.equal(await p.locator('.zu.full').count(), 0); assert.equal(await strokes(p), 1, 'とじると、小さな図にかいた線が出る');
  assert.ok((await p.locator('.prevnote').textContent()).includes('1本'));
  assert.ok((await p.locator('.savebadge').textContent()).includes('保存'), '自動で保存のしるしが出ている');

  // --- 精油の候補 ---
  await tap('次へ：オイル ›'); await p.waitForSelector('.oil');
  assert.ok(await p.getByText('理由があって外したもの', { exact: false }).count(), '外したものを見せる');
  const outText = await p.locator('.oil.out').allTextContents();
  assert.ok(outText.some((t) => t.includes('ティートゥリー') && t.includes('アレルギー')), 'アレルギーの精油は理由つきで外す（書き方のゆれ「ティートリー」でも）');
  assert.ok(outText.some((t) => t.includes('ジュニパー') && t.includes('妊娠中')), '妊娠中に使わない精油は理由つきで外す');
  assert.ok(outText.some((t) => t.includes('サイプレス') && t.includes('月数が入っていない')), '月数がないときは、初期の注意も見る');
  // 妊娠の月数をえらぶと、時期に合わせた注意になる
  await p.locator('.steps').getByText('問診').tap(); await tap('3か月');
  await p.locator('.steps').getByText('オイル').tap(); await p.waitForSelector('.oil');
  const out3 = await p.locator('.oil.out').allTextContents();
  assert.ok(out3.some((t) => t.includes('サイプレス') && t.includes('妊娠3か月')), '3か月 → 初期の注意：' + out3.join('|').slice(0, 300));
  assert.ok(!out3.some((t) => t.includes('月数が入っていない')));
  const lav = p.locator('.oil', { hasText: 'ラベンダー・アングスティフォリア' });
  await lav.getByText('手持ちにする').tap(); await p.locator('.oil.hit', { hasText: 'ラベンダー・アングスティフォリア' }).waitFor();
  await p.locator('.oil.hit', { hasText: 'ラベンダー・アングスティフォリア' }).getByText('使う', { exact: true }).tap();
  await p.locator('.oil', { hasText: 'マンダリン' }).getByText('使う', { exact: true }).tap();
  await shot('06-seiyu');
  await tap('花穂系'); assert.equal(await p.locator('.oil', { hasText: 'マンダリン' }).count(), 0, '香りの系統でしぼれる'); await tap('花穂系');
  // キャリアオイルの候補（精油と同じ作り）
  await p.locator('.tab', { hasText: 'キャリアオイル' }).tap(); await p.waitForSelector('.oil.buy');
  const cOut = await p.locator('.oil.out').allTextContents();
  assert.ok(cOut.some((t) => t.includes('スイートアーモンドオイル') && t.includes('ナッツ類')), 'ナッツのアレルギーにあたるオイルは理由つきで外す：' + cOut.join('|').slice(0, 200));
  assert.ok(cOut.some((t) => t.includes('マカデミアナッツオイル')), 'マカデミアも外す');
  const tsubaki = p.locator('.oil', { hasText: '椿オイル' });
  assert.ok((await tsubaki.textContent()).includes('「乾燥しやすい」← オレイン酸が多い'), '「なぜ出たか」が出る');
  assert.equal(await p.locator('.oil.buy', { hasText: '椿オイル' }).count(), 1, '持っていないが合うものは「次に買う候補」');
  await tsubaki.getByText('手持ちにする').tap(); await p.locator('.oil.hit', { hasText: '椿オイル' }).waitFor();
  await p.locator('.oil.hit', { hasText: '椿オイル' }).getByText('使う', { exact: true }).tap();
  assert.ok((await p.locator('.chosen').textContent()).includes('キャリアオイル：椿オイル'));
  await shot('06b-carrier');

  // --- ブレンド ---
  await tap('次へ：ブレンド ›'); await p.waitForSelector('.meter');
  assert.equal((await p.locator('.meter .pct').textContent()).trim(), '0.3％', '30ml に 2滴で 0.3％');
  await tap('＋ キャリアオイルをえらぶ'); assert.ok(await p.getByText('⚠ スイートアーモンドオイル（持っていない）').count(), 'えらぶ一覧でも注意が出る'); await tap('とじる');
  assert.ok(await p.getByText('この量なら 6滴まで', { exact: false }).count(), '目安までの滴数が出る');
  const plus = p.locator('.brow:not(.car)').first().getByText('＋'); for (let i = 0; i < 4; i++) await plus.tap();
  assert.equal((await p.locator('.meter .pct').textContent()).trim(), '1.0％', '30ml に 6滴でちょうど 1.0％（精油 ÷ キャリアオイル）');
  assert.equal(await p.locator('.meter.over').count(), 0, 'ちょうど目安なら、こえた色にしない');
  await plus.tap(); assert.equal((await p.locator('.meter .pct').textContent()).trim(), '1.2％');
  assert.ok(await p.locator('.meter.over').count(), '目安をこえたら色が変わる');
  await shot('07-blend-over');
  const minus = p.locator('.brow:not(.car)').first().getByText('−'); for (let i = 0; i < 3; i++) await minus.tap();
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
  await tap('できた（カルテをとじる）'); await p.waitForSelector('text=情報を直す');
  const pageText = await p.locator('.main').textContent();
  assert.ok(pageText.includes('肩こり 8→3'), 'つらさの変化が残る：' + pageText.slice(0, 300)); assert.ok(pageText.includes('ラベンダー・アングスティフォリア 3滴'), 'ブレンドが残る');
  assert.ok(pageText.includes('1回'), '回数を自動で数える'); assert.ok(pageText.includes('妊娠中（前回）'), '注意のしるし'); assert.ok(pageText.includes('ナッツ類（木の実）／ティートリー'), 'アレルギーのしるし');
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
  await p.getByLabel('お客さんをさがす').fill('シケン'); assert.equal(await p.locator('.home-top + .list .row-link', { hasText: '試験 みほ' }).count(), 1, 'カタカナでもさがせる');

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
  assert.deepEqual(await pad.counts(), { c: 1, v: 2, b: 1 }, 'バックアップから元どおり');
  await shot('11-home');

  // --- これまでの記録を横にめくる（前回 → 1回前 …） ---
  await p.getByLabel('お客さんをさがす').fill('しけん'); await p.locator('.home-top + .list .row-link', { hasText: '試験 みほ' }).tap(); await p.waitForSelector('.hist');
  assert.equal(await p.locator('.hist .slide').count(), 2, '来店の回数ぶんの紙がある'); assert.ok((await p.locator('.hpos').textContent()).startsWith('1／全2回'));
  assert.ok(await p.getByText('‹ 新しい').isDisabled(), 'いちばん新しい回では「新しい」は押せない');
  await tap('古い ›'); await p.waitForFunction(() => document.querySelector('.hpos').textContent.startsWith('2／全2回')); await p.waitForTimeout(500);
  const s2 = await p.locator('.hist .slide').nth(1).textContent();
  assert.ok(s2.includes('1回前') && s2.includes('肩こり 8→3') && s2.includes('▼5') && s2.includes('ラベンダー・アングスティフォリア 3滴') && s2.includes('0.7％') && s2.includes('とても好き'), '前の回の中身が同じ並びで出る：' + s2.slice(0, 200));
  const f0 = await p.locator('.hist .slide').nth(0).locator('.bodypad').first().evaluate((e) => [e.clientWidth, e.clientHeight, e.getBoundingClientRect().top]);
  const f1 = await p.locator('.hist .slide').nth(1).locator('.bodypad').first().evaluate((e) => [e.clientWidth, e.clientHeight, e.getBoundingClientRect().top]);
  assert.deepEqual(f0, f1, 'からだの図は、どの回も同じ大きさ・同じ高さ'); await shot('11b-history');
  await p.locator('.hist .slide').nth(1).getByText('この回の問診とブレンドを今日に写す').tap(); await p.locator('.dialog').getByText('写す', { exact: true }).tap(); await p.waitForSelector('.steps');
  assert.equal(await p.locator('.symrow').count(), 3, 'めくった先の回の問診が今日に写る'); assert.deepEqual(await pad.counts(), { c: 1, v: 2, b: 1 }, '今日のカルテがあれば、そこに写す（増やさない）');
  await p.goto(BASE + '#/'); await p.waitForSelector('.home-top');

  // --- 生活の様子・同意書のサイン・触れないで（×） ---
  const cid = await p.evaluate(async () => { const db = await import('./js/db.js'); return (await db.all('customers')).find((c) => c.name === '試験 みほ').id; });
  await p.goto(BASE + `#/c/${cid}/edit`); await p.waitForSelector('.page');
  await p.locator('.edit-row', { hasText: '睡眠' }).locator('input').fill('7'); await tap('便秘ぎみ');
  await tap('保存する'); await p.waitForSelector('text=睡眠 7時間くらい');
  assert.ok(await p.getByText('お通じ 便秘ぎみ', { exact: false }).count(), '生活の様子がお客さんのページに出る');
  assert.ok(await p.getByText('まだ同意をもらっていません').count());
  // 同意書は、お客さん用の画面に切りかえて書いてもらう。はじめてのときは、戻るための合言葉を決める
  const pin = async (digits) => { for (const d of digits) { await p.locator('.pinkey', { hasText: d }).tap(); await p.waitForTimeout(60); } };
  await tap('同意書にサインしてもらう'); await p.waitForSelector('.pinwrap'); await pin('2580'); await p.waitForSelector('text=もう一度、同じ数字を'); await pin('2580'); await p.waitForSelector('.guestmode');
  await tap('はじめる'); await p.waitForSelector('.signpad');
  const signBody = await p.locator('body').textContent();
  for (const w of ['来店の記録', '情報を直す', '敏感肌', 'これまでの記録']) assert.ok(!signBody.includes(w), 'サインの画面には、ほかの情報やメニューを出さない：' + w);
  await tap('同意して、サインを残す'); await p.waitForTimeout(300); assert.ok(await p.locator('.signpad').count(), 'サインするまで先へ進まない');
  await p.locator('.signpad').scrollIntoViewIfNeeded(); await p.waitForTimeout(300); const sb = await p.locator('.signpad').boundingBox();
  // すばやく払うように書き終えても（指を止めない）、すぐ次の1回押しが効く
  await touchLine([[sb.x + 60, sb.y + sb.height * 0.6], [sb.x + 120, sb.y + sb.height * 0.3], [sb.x + 200, sb.y + sb.height * 0.65], [sb.x + 280, sb.y + sb.height * 0.35]]);
  await shot('21-sign');
  await p.getByText('同意して、サインを残す').scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await tap('同意して、サインを残す'); await p.waitForSelector('text=スタッフにお返しください', { timeout: 3000 });
  await shot('21a-guest-done');
  // お客さん用の画面からは出られない：アドレスを打ちかえても・戻るボタンでも・開き直しても
  const locked = async (what) => { await p.waitForTimeout(250); assert.ok(await p.locator('.guestmode').count() === 1 && await p.locator('.page').count() === 0, `${what}：お客さん用の画面のまま`); assert.equal(await p.evaluate(() => location.hash), '#/guest', `${what}：アドレスも戻る`); };
  for (const hsh of ['#/', '#/list', `#/c/${cid}`, '#/set', '#/set/handover', '#/set/backup', '#/v/x/shoken']) { await p.evaluate((x) => { location.hash = x; }, hsh); await locked('アドレスを ' + hsh + ' に打ちかえ'); }
  await p.goBack(); await locked('戻るボタン'); await p.goBack(); await locked('戻るボタン2回目');
  await p.goto(BASE + `#/c/${cid}`); await p.waitForSelector('.guestmode'); await locked('アドレスを入れて開き直し');
  await p.reload(); await p.waitForSelector('.guestmode'); await locked('読みこみ直し');
  await tap('スタッフ：合言葉を入れてもどる'); await p.waitForSelector('.pinwrap'); await pin('1111'); await p.waitForSelector('text=ちがうようです', { exact: false }); await locked('ちがう合言葉');
  await pin('2580'); await p.waitForSelector('text=同意・サインあり（文の版 1）', { exact: false });
  assert.equal(await p.evaluate(async () => (await import('./js/db.js')).getMeta('guest')), null, '戻ったら、お客さん用の画面のしるしが消える');
  await tap('同意した文とサインを見る'); assert.equal(await p.locator('.sheet .signpad path').count(), 1, 'サインの線が残っている'); await shot('21b-consent-view'); await p.locator('.sheet').getByText('とじる').tap();
  await p.goto(BASE + '#/set/consent'); await p.waitForSelector('textarea');
  await p.locator('textarea').fill('自分の店の注意事項（テスト）'); await tap('この文で保存する（版が上がります）'); await p.locator('.dialog').getByText('保存する', { exact: true }).tap(); await p.waitForSelector('.page');
  await p.goto(BASE + `#/c/${cid}`); await p.waitForSelector('text=いまの文は版 2', { exact: false });
  const cons = await p.evaluate(async (id) => { const db = await import('./js/db.js'); const d = await db.get('details', id); return d.consents.map((c) => [c.ver, c.text.slice(0, 6), c.sign.length]); }, cid);
  assert.deepEqual(cons, [[1, '施術を受ける', 1]], '同意したときの文と版が残る');
  // 触れないで（×）：かいた来店の次の来店にも写る・施術の前に見える
  const xv = await p.evaluate(async (id) => { const st = await import('./js/state.js'); const v = await st.newVisit(id); return v.id; }, cid);
  await p.goto(BASE + `#/v/${xv}/zu`); await p.waitForSelector('.zu.staff .bodypad'); // 前の版のアドレス（/zu）は「所見」に行く
  await p.locator('.zuprev').tap(); await p.waitForSelector('.zu.full .zu-main .bodypad');
  await tap('触れないで（×）'); const xb = await p.locator('.bodypad').nth(1).boundingBox();
  await touchLine([[xb.x + xb.width * 0.4, xb.y + xb.height * 0.5], [xb.x + xb.width * 0.45, xb.y + xb.height * 0.52]]);
  assert.equal(await p.locator('.zu .notouch .xmark').count(), 1, '× が出る'); await shot('22-notouch');
  await p.goto(BASE + `#/v/${xv}/sejutsu`); await p.waitForSelector('text=触れないでほしいところがあります');
  assert.ok((await p.locator('.visit-warn').textContent()).includes('触れないで'), '来店の画面の上の帯にも出る');
  const xv2 = await p.evaluate(async (id) => { const st = await import('./js/state.js'); const v = await st.newVisit(id); return { n: (v.figures.back || []).length, m: (v.figures.back || [])[0]?.m, front: (v.figures.front || []).length }; }, cid);
  assert.deepEqual(xv2, { n: 1, m: 'm_notouch', front: 0 }, '次の来店に「触れないで」だけが写る');
  await p.goto(BASE + `#/c/${cid}`); await p.waitForSelector('text=触れないでほしいところがあります');
  // 試した来店は消しておく（このあとのテストの数を変えないため）
  await p.evaluate(async (id) => { const db = await import('./js/db.js'); const st = await import('./js/state.js'); const vs = await db.byIndex('visits', 'customerId', id);
    for (const v of vs.sort((a, b) => b.createdAt - a.createdAt).slice(0, 2)) await st.deleteVisit(v); const s = st.S.settings; s.consent = { ...s.consent, text: (await import('./js/seed.js')).DEFAULT_CONSENT_TEXT }; await st.saveSettings(); }, cid);
  await p.goto(BASE + '#/'); await p.waitForSelector('.home-top');

  // --- 版の移し替え（端末の中のデータ）：前の版（版1）の形にもどしてから開き直す → 版2 に直る ---
  await p.evaluate(async () => {
    const db = await import('./js/db.js');
    const cs = (await db.all('carriers')).filter((c) => c.id !== 'k_argan').map((c) => ({ id: c.id, name: c.id === 'k_jojoba' ? 'ホホバ（自分で直した名前）' : c.name, owned: c.owned, note: '' }));
    const ds = (await db.all('details')).map(({ allergyTags, avoidCarrierIds, ...r }) => r);
    const vs = (await db.all('visits')).map((v) => { const { skins, ...iv } = v.interview; return { ...v, interview: iv }; });
    await db.batch(['carriers', 'details', 'visits', 'meta'], (os) => { os.carriers.clear(); cs.forEach((c) => os.carriers.put(c)); ds.forEach((d) => os.details.put(d)); vs.forEach((v) => os.visits.put(v)); os.meta.put({ key: 'dataVersion', value: 1 }); });
    const st = await db.getMeta('settings'); st.conds.find((c) => c.id === 'c_sun').name = 'このあと日に当たる'; st.conds.find((c) => c.id === 'c_mens').name = '生理中（自分で直した）'; await db.setMeta('settings', st);
  });
  await p.reload(); await p.waitForSelector('.home-top');
  const mig = await p.evaluate(async () => {
    const db = await import('./js/db.js'); const cs = Object.fromEntries((await db.all('carriers')).map((c) => [c.id, c]));
    const cn = Object.fromEntries((await db.getMeta('settings')).conds.map((c) => [c.id, c.name]));
    return { ver: await db.getMeta('dataVersion'), sun: cn.c_sun, mens: cn.c_mens, jojoba: [cs.k_jojoba.name, cs.k_jojoba.fatty.wax, cs.k_jojoba.draft], tsubakiOwned: cs.k_tsubaki.owned, argan: !!cs.k_argan, n: Object.keys(cs).length,
      tags: (await db.all('details'))[0].allergyTags, skins: (await db.all('visits')).map((v) => v.interview.skins.length), syms: (await db.all('visits')).map((v) => v.interview.symptoms.length) };
  });
  assert.deepEqual(mig, { ver: 8, sun: 'このあと屋外で過ごす予定がある（外出・屋外作業など）', mens: '生理中（自分で直した）', jojoba: ['ホホバ（自分で直した名前）', 97, true], tsubakiOwned: true, argan: true, n: 12, tags: [], skins: [0, 0], syms: [3, 3] }, '版1 → 版4 の移し替え：' + JSON.stringify(mig));
  await p.goto(BASE + '#/set/carriers'); await p.waitForSelector('text=ホホバ（自分で直した名前）');
  // --- 版3（0.4.0 のころ）の精油のデータから、版4（資料の30本）へ。手持ち・確かめた精油は残る・資料にない精油は「資料にない」で残る ---
  await p.evaluate(async () => {
    const db = await import('./js/db.js');
    const old = [
      { id: 'o_lavender', name: 'ラベンダー（真正）', family: 'f_flower', components: { est: 40, alc: 40, mth: 5 }, uses: ['s_nemuri'], cautions: [], note: '', owned: true, draft: true },
      { id: 'o_ginger', name: 'ジンジャー', family: 'f_spice', components: { sth: 60, mth: 20 }, uses: ['s_hie'], cautions: ['c_skin'], note: '', owned: true, draft: true },
      { id: 'o_clary', name: 'クラリセージ（確かめた）', family: 'f_herb', components: { est: 65, alc: 20 }, uses: ['s_gekkei'], cautions: ['c_preg'], note: '', owned: false, draft: false },
    ];
    const cats = [{ id: 'mth', name: 'モノテルペン炭化水素類', uses: ['s_mukumi'], cautions: [], draft: true }, { id: 'sth', name: 'セスキテルペン炭化水素類', uses: [], cautions: [], draft: true }, { id: 'est', name: 'エステル類', uses: ['s_stress'], cautions: [], draft: true }];
    const st = await db.getMeta('settings');
    st.families = [{ id: 'f_citrus', name: '柑橘', color: '#f2a03d' }, { id: 'f_flower', name: '花', color: '#e88fb0' }, { id: 'f_tree', name: '樹木', color: '#5a9a6b' }, { id: 'f_herb', name: 'ハーブ', color: '#8fbf5a' }, { id: 'f_spice', name: 'スパイス', color: '#b9643a' }];
    st.conds = st.conds.filter((c) => !['c_preg_early', 'c_preg_mid', 'c_preg_late', 'c_drive', 'c_drink', 'c_bpmed', 'c_atopy', 'c_infant'].includes(c.id));
    st.allergens = st.allergens.filter((a) => !a.plants); st.symptoms = st.symptoms.map(({ acts, ...r }) => r); delete st.actions; delete st.ageRules; delete st.unknownPct;
    const vs = (await db.all('visits')).map(({ pregMonth, ...v }) => { const { famLikes, ...iv } = v.interview; return { ...v, interview: iv }; });
    await db.batch(['oils', 'cats', 'visits', 'meta'], (os) => { os.oils.clear(); old.forEach((o) => os.oils.put(o)); os.cats.clear(); cats.forEach((c) => os.cats.put(c)); vs.forEach((v) => os.visits.put(v)); os.meta.put({ key: 'settings', value: st }); os.meta.put({ key: 'dataVersion', value: 3 }); });
  });
  await p.goto(BASE + '#/'); await p.reload(); await p.waitForSelector('.home-top');
  const mig4 = await p.evaluate(async () => {
    const db = await import('./js/db.js'); const os = Object.fromEntries((await db.all('oils')).map((o) => [o.id, o])); const st = await db.getMeta('settings');
    return { ver: await db.getMeta('dataVersion'), n: Object.keys(os).length, lav: [os.o_lavender.name, os.o_lavender.owned], ginger: [os.o_ginger.ref, os.o_ginger.owned, os.o_ginger.components.hyd], clary: [os.o_clary.name, os.o_clary.family, os.o_clary.components.est],
      cats: (await db.all('cats')).map((c) => c.id).sort().join(), fam: st.families.map((f) => f.name).join(), drive: st.conds.some((c) => c.id === 'c_drive'), acts: st.symptoms[0].acts.a_relax, iv: (await db.all('visits')).every((v) => Array.isArray(v.interview.famLikes)) };
  });
  assert.deepEqual(mig4, { ver: 8, n: 31, lav: ['ラベンダー・アングスティフォリア', true], ginger: [false, true, 80], clary: ['クラリセージ（確かめた）', 'f_flower', 65],
    cats: 'alc,ald,est,hyd,ket,oxi,phe', fam: '樹木系,花穂系,柑橘系', drive: true, acts: 2, iv: true }, '版3 → 版4 の移し替え：' + JSON.stringify(mig4));
  await p.goto(BASE + '#/set/oils'); await p.waitForSelector('text=ラベンダー・アングスティフォリア'); assert.ok(await p.getByText('資料にない').count(), '資料にない精油のしるし');
  // 移し替えたあとのカルテで、精油の候補の画面が開ける
  await p.goto(BASE + '#/'); await p.waitForSelector('.home-top');
  // --- 版4（0.5.0）の形のデータから、版5へ。これまでの図は「所見」の図として残る・お客さんの図の入れ物が足される・カルテが開ける ---
  const v4 = await p.evaluate(async () => {
    const db = await import('./js/db.js');
    const vs = (await db.all('visits')).map(({ guestFigures, intake, ...v }) => { const { wish, ...iv } = v.interview; return { ...v, interview: iv }; });
    const ds = (await db.all('details')).map(({ intakeAt, ...d }) => d);
    const st = await db.getMeta('settings'); delete st.handover; delete st.pin;
    await db.batch(['visits', 'details', 'meta'], (os) => { vs.forEach((v) => os.visits.put(v)); ds.forEach((d) => os.details.put(d)); os.meta.put({ key: 'settings', value: st }); os.meta.put({ key: 'dataVersion', value: 4 }); });
    const v = vs.find((x) => (x.figures.front || []).length + (x.figures.back || []).length > 0); return { id: v.id, n: (v.figures.front || []).length + (v.figures.back || []).length };
  });
  await p.goto(BASE + '#/'); await p.reload(); await p.waitForSelector('.home-top');
  const mig5 = await p.evaluate(async (id) => { const db = await import('./js/db.js'); const st = await import('./js/state.js'); const v = await db.get('visits', id);
    return { ver: await db.getMeta('dataVersion'), n: v.figures.front.length + v.figures.back.length, g: v.guestFigures, intake: v.intake, wish: v.interview.wish, hand: st.S.settings.handover, pin: st.hasPin(), all: (await db.all('visits')).every((x) => x.guestFigures && x.figures) }; }, v4.id);
  assert.deepEqual(mig5, { ver: 8, n: v4.n, g: { front: [], back: [] }, intake: null, wish: '', hand: { first: 'guest', repeat: 'staff' }, pin: false, all: true }, '版4 → 版5 の移し替え：' + JSON.stringify(mig5));
  await p.goto(BASE + `#/v/${v4.id}/shoken`); await p.waitForSelector('.zu.staff .bodypad'); assert.equal(await p.locator('.zu .strokes.own.staff > *').count(), v4.n, '0.5.0 の図が、施術する人の「所見」の図として出る');
  await p.goto(BASE + `#/v/${v4.id}/kininaru`); await p.waitForSelector('.zu.guest .bodypad'); assert.equal(await p.locator('.zu .strokes.own > *').count(), 0, 'お客さんの図は空で始まる');
  await p.goto(BASE + '#/'); await p.waitForSelector('.home-top');
  // 移し替えのしくみそのもの（次の版を足すとき用）
  const mig3 = await p.evaluate(async () => {
    const db = await import('./js/db.js');
    const r = await db.migrateDb([{ to: 9, stores: { visits: (x) => ({ ...x, _test: 'moved' }) } }], 9);
    const ok = (await db.all('visits')).every((x) => x._test === 'moved'); const ver = await db.getMeta('dataVersion');
    const vs = await db.all('visits'); for (const x of vs) delete x._test; await db.bulkPut('visits', vs); await db.setMeta('dataVersion', 8);
    return { r, ok, ver };
  });
  assert.deepEqual(mig3, { r: { from: 8, to: 9 }, ok: true, ver: 9 }, '版の移し替え');

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
  await p.getByLabel('お客さんをさがす').fill('試験'); await p.locator('.home-top + .list .row-link').first().tap(); await p.waitForSelector('text=来店の記録');
  await p.goto(BASE + '#/set/oils'); await p.waitForSelector('text=ラベンダー');
  await ctx.setOffline(false); log('ネットなし：開けた');

  // --- たて向き・設定の画面 ---
  await p.setViewportSize({ width: 768, height: 1024 });
  for (const [h, n] of [['/set', '13-settings'], ['/set/oils', '14-oils'], ['/set/oil/o_lavender', '15-oil-edit'], ['/set/limits', '16-limits'], ['/set/cats', '17-cats'], ['/set/backup', '18-backup'], ['/set/carriers', '19a-carriers'], ['/set/carrier/k_almond', '19b-carrier-edit'], ['/set/fats', '19c-fats'], ['/set/lists', '19d-lists']]) { await p.goto(BASE + '#' + h); await p.waitForSelector('.page'); await p.waitForTimeout(150); await shot(n); }
  const vid = await p.evaluate(async () => { const db = await import('./js/db.js'); return (await db.all('visits')).find((v) => v.status === 'done').id; });
  for (const s of ['monshin', 'zu', 'seiyu', 'blend']) { await p.goto(BASE + `#/v/${vid}/${s}`); await p.waitForSelector('.step'); await p.waitForTimeout(150); await shot('20-tate-' + s); }
  const wide = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth); assert.equal(wide, false, 'たて向きで横にはみ出さない');

  // --- 設定でキャリアオイルを直す → 候補が変わる（決め打ちではない） ---
  await p.evaluate(async () => { const db = await import('./js/db.js'); const d = (await db.all('details'))[0]; d.allergyTags = ['al_nut']; await db.put('details', d); }); // 移し替えの試しで外れたしるしを付け直す
  await p.goto(BASE + '#/set/carrier/k_tsubaki'); await p.waitForSelector('text=成分ごとの割合');
  await tap('ナッツ類（木の実）'); await tap('自分の資料で確かめた（「下書き」のしるしを外す）'); await tap('保存する'); await p.waitForSelector('text=キャリアオイルの一覧と手持ち');
  assert.equal(await p.locator('.row-link', { hasText: '椿オイル' }).getByText('確かめた').count(), 1, '「下書き」のしるしが外れる');
  await p.goto(BASE + `#/v/${vid}/seiyu`); await p.locator('.tab', { hasText: 'キャリアオイル' }).tap();
  assert.equal(await p.locator('.oil.out', { hasText: '椿オイル' }).count(), 1, '設定で直すと、外す・外さないも変わる');

  // ================= お客さんに渡す：初回の登録・同意書・問診を、お客さんが自分で書く → 合言葉で戻る → 後半 =================
  await p.goto(BASE + '#/new'); await p.waitForSelector('.page'); await p.getByPlaceholder('山田 花子').fill('渡す ためし'); await tap('保存する'); await p.waitForSelector('.handbtn');
  assert.ok(await p.locator('.foot .handbtn.primary').count(), '初回は「お客さんに渡す」が大きく出る（聞きながら書く、も選べる）'); assert.ok(await p.locator('.foot').getByText('今日の来店をはじめる').count());
  await p.locator('.foot .handbtn').tap(); await p.waitForSelector('.sheet'); assert.equal(await p.locator('.sheet .chips.col .chip.on').count(), 3, '初回は、登録・同意書・問診の3つとも'); await shot('30-handover');
  await tap('この内容で、お客さんに渡す'); await p.waitForSelector('.pinwrap'); await pin('2580'); await p.waitForSelector('text=もう一度、同じ数字を'); await pin('2580'); await p.waitForSelector('.guestmode');
  const gnext = async () => { await p.locator('.gnext').scrollIntoViewIfNeeded(); await p.locator('.gnext').tap(); await p.waitForTimeout(250); };
  const noOthers = async (what) => { const t = await p.locator('#app').textContent(); assert.equal(await p.locator('.overlay, .update-bar').count(), 0); for (const w of ['試験 みほ', '設定', '施術者の記録', 'オイル', 'ブレンド']) assert.ok(!t.includes(w), `お客さん用の画面（${what}）に「${w}」が出ない`); };
  await shot('31-guest-hello'); await noOthers('はじめ'); await gnext();
  await p.locator('.gcard input').nth(1).fill('わたす ためし'); await tap('女性'); await shot('32-guest-p1'); await noOthers('お客さまのこと'); await gnext();
  await p.locator('input[type=tel]').fill('000-0000-0000'); await gnext();
  await tap('高血圧'); await tap('ごま'); await shot('33-guest-p3'); await noOthers('おからだのこと'); await gnext();
  await tap('快便'); await gnext();
  await p.locator('.signpad').scrollIntoViewIfNeeded(); await p.waitForTimeout(300); const gs = await p.locator('.signpad').boundingBox();
  await touchLine([[gs.x + 60, gs.y + gs.height * 0.6], [gs.x + 140, gs.y + gs.height * 0.3], [gs.x + 240, gs.y + gs.height * 0.6]]); await gnext();
  await p.waitForSelector('text=今日、あてはまるものはありますか'); await tap('肩こり'); await p.locator('.symrow').nth(0).getByText('8', { exact: true }).tap(); await shot('34-guest-m1'); await gnext();
  await p.waitForSelector('.zu.guest.simple .zuprev'); assert.ok((await p.locator('.zuprev').textContent()).includes('ここを押して、図に書く'), 'お客さんにも、押すと書けると分かる');
  await p.locator('.zuprev').tap(); await p.waitForSelector('.zu.full .zu-main .bodypad'); await p.waitForTimeout(300);
  let gb = await p.locator('.zu .bodypad').first().boundingBox();
  await touchLine([[gb.x + gb.width * 0.4, gb.y + gb.height * 0.25], [gb.x + gb.width * 0.5, gb.y + gb.height * 0.26], [gb.x + gb.width * 0.6, gb.y + gb.height * 0.25]]);
  await p.locator('.markbtn', { hasText: '触れないで（×）' }).tap(); await p.locator('.zu .bodypad').first().scrollIntoViewIfNeeded(); await p.waitForTimeout(300); gb = await p.locator('.zu .bodypad').first().boundingBox();
  await touchLine([[gb.x + gb.width * 0.45, gb.y + gb.height * 0.5], [gb.x + gb.width * 0.5, gb.y + gb.height * 0.52]]);
  assert.equal(await p.locator('.zu .strokes.own.guest > *').count(), 2, 'お客さんが図をなぞれる（×も）'); assert.equal(await p.getByText('消しゴム', { exact: false }).count(), 0, 'お客さん用の図は道具を少なく'); await shot('35-guest-m2'); await noOthers('図');
  await tap('‹ もどる（とじる）'); assert.equal(await p.locator('.zu .strokes.own.guest > *').count(), 2, 'とじると小さな図に出る');
  await gnext(); await tap('リラックスしたい'); await p.locator('.gcard textarea').fill('力は弱めでお願いします'); await shot('36-guest-m3');
  await gnext(); await p.waitForSelector('text=スタッフにお返しください'); await shot('37-guest-done');
  for (const hsh of ['#/', '#/set', '#/list']) { await p.evaluate((x) => { location.hash = x; }, hsh); await locked('書き終えたあと ' + hsh); }
  await tap('スタッフ：合言葉を入れてもどる'); await pin('2580'); await p.waitForSelector('.phasebar.guest');
  assert.ok((await p.locator('.phasebar').textContent()).includes('お客さんが自分で書きました'), '戻ると、前半の画面に「お客さんが書いた」と出る'); await shot('38-back-to-staff');
  const got = await p.evaluate(async () => { const db = await import('./js/db.js'); const c = (await db.all('customers')).find((x) => x.name === '渡す ためし'); const d = await db.get('details', c.id); const v = (await db.byIndex('visits', 'customerId', c.id))[0];
    return { id: c.id, vid: v.id, kana: c.kana, gender: d.gender, tel: d.tel, conds: d.conds, tags: d.allergyTags.length, bowel: d.life.bowel, cons: d.consents.length, intakeAt: !!d.intakeAt, sym: v.interview.symptoms, g: v.guestFigures.front.map((x) => x.m), staff: v.figures.front.length + v.figures.back.length, by: v.intake.by, wish: v.interview.wish, purposes: v.interview.purposes }; });
  assert.deepEqual({ ...got, id: 0, vid: 0 }, { id: 0, vid: 0, kana: 'わたす ためし', gender: '女性', tel: '000-0000-0000', conds: ['c_bp'], tags: 1, bowel: '快便', cons: 1, intakeAt: true, sym: [{ id: 's_kata', level: 8 }], g: ['m_pain', 'm_notouch'], staff: 0, by: 'guest', wish: '力は弱めでお願いします', purposes: ['リラックスしたい'] }, 'お客さんが書いた中身が残る：' + JSON.stringify(got));
  assert.ok((await p.locator('.visit-warn').textContent()).includes('触れないで'), 'お客さんがつけた × が、上の帯に出る');
  // 後半：所見の図に、お客さんの図が重なって見える（切りかえできる）。施術する人の線は別に残る
  await tap('次へ：気になるところ ›'); await p.waitForSelector('.zu.guest'); await tap('後半へ：所見 ›'); await p.waitForSelector('.zu.staff .bodypad'); assert.ok(await p.locator('.phasebar.staff').count(), '後半は「施術者の記録」の帯');
  assert.equal(await p.locator('.zu .strokes.under.guest > *').count(), 2, '所見の図に、お客さんの図が重なる');
  await p.locator('.zuprev').tap(); await p.waitForSelector('.zu.full'); assert.equal(await p.locator('.zu .strokes.under.guest > *').count(), 2, '画面いっぱいでも重なって見える'); await p.waitForTimeout(400); gb = await p.locator('.zu .bodypad').first().boundingBox(); await touchLine([[gb.x + gb.width * 0.4, gb.y + gb.height * 0.3], [gb.x + gb.width * 0.5, gb.y + gb.height * 0.31], [gb.x + gb.width * 0.6, gb.y + gb.height * 0.3]]);
  assert.equal(await p.locator('.zu .strokes.own.staff > *').count(), 1); await shot('39-shoken-overlay');
  await tap('お客さんの図も重ねる'); assert.equal(await p.locator('.zu .strokes.under').count(), 0, '所見だけにできる'); await tap('お客さんの図も重ねる');
  await tap('‹ もどる（とじる）'); await p.waitForTimeout(300);
  const two = await p.evaluate(async (id) => { const db = await import('./js/db.js'); const st = await import('./js/state.js'); await st.flush(); const v = await db.get('visits', id); return [v.guestFigures.front.length, v.figures.front.length]; }, got.vid);
  assert.deepEqual(two, [2, 1], '2つの図は別々に残る');
  // お客さんが書いて返した回：気になるところの図は、施術する人は見るだけ（×だけ足せる・「施術者」の札）。問診は直せて、直したらんに印
  await p.goto(BASE + `#/v/${got.vid}/kininaru`); await p.waitForSelector('.zuprev');
  assert.ok((await p.locator('.whobar').textContent()).includes('お客さんが自分で書いた')); assert.ok(await p.getByText('所見の図に書く ›').count(), '所見に書くよう案内');
  await p.locator('.zuprev').tap(); await p.waitForSelector('.zu.full .zu-main .bodypad'); await p.waitForSelector('.locknote');
  assert.deepEqual(await p.locator('.zu .markbtn').allTextContents(), ['触れないで（×）'], '足せるのは × だけ');
  assert.equal(await p.getByText('ぜんぶ消す').count(), 0, 'お客さんの図をぜんぶ消せない');
  await tap('消しゴム（線をえらぶ）'); { const r = await p.locator('.zu .bodypad').nth(0).boundingBox(); await touchLine([[r.x + r.width * 0.4, r.y + r.height * 0.25], [r.x + r.width * 0.5, r.y + r.height * 0.26], [r.x + r.width * 0.6, r.y + r.height * 0.25], [r.x + r.width * 0.47, r.y + r.height * 0.5], [r.x + r.width * 0.5, r.y + r.height * 0.52]]); }
  assert.equal(await p.locator('.zu .strokes.own.guest > *').count(), 2, '消しゴムでもお客さんの線は消えない');
  await tap('触れないで（×）'); { const r = await p.locator('.zu .bodypad').nth(1).boundingBox(); await touchLine([[r.x + r.width * 0.45, r.y + r.height * 0.6], [r.x + r.width * 0.5, r.y + r.height * 0.62]]); }
  assert.equal(await p.locator('.zu .bytag').count(), 1, '施術する人が足した × に「施術者」の札'); await shot('38b-kininaru-lock');
  await tap('‹ もどる（とじる）');
  await p.goto(BASE + `#/v/${got.vid}/monshin`); await p.waitForSelector('.whobar'); assert.equal(await p.locator('.bystaff:not(:empty)').count(), 0);
  await tap('乾燥しやすい'); assert.ok((await p.locator('.bystaff[data-k=skins]').textContent()).includes('施術者が書き足した'), '直したらんに印'); await shot('38c-monshin-edited');
  const ed = await p.evaluate(async (id) => { const db = await import('./js/db.js'); const st = await import('./js/state.js'); await st.flush(); const v = await db.get('visits', id); return [Object.keys(v.staffEdits), v.guestFigures.back.map((x) => x.by || '')]; }, got.vid);
  assert.deepEqual(ed, [['skins'], ['staff']], 'どのらんを直したか・だれが×を足したかが残る');
  await p.goto(BASE + `#/v/${got.vid}/after`); await p.waitForSelector('text=つらさの変化'); await tap('できた（カルテをとじる）'); await p.waitForSelector('.hist');
  assert.ok(await p.locator('.hist .slide .strokes.under.guest').count() && await p.locator('.hist .slide .strokes.own.staff').count(), 'これまでの記録：両方を重ねて出す'); await shot('40-history-both');
  await p.locator('.figsel .chip', { hasText: '施術者' }).tap(); assert.equal(await p.locator('.hist .slide .strokes.under').count(), 0); assert.equal(await p.locator('.hist .slide .strokes.own.staff > *').count(), 1, '施術者の図だけ');
  await p.locator('.figsel .chip', { hasText: 'お客さん' }).tap(); assert.equal(await p.locator('.hist .slide .strokes.own.guest > *').count(), 3, 'お客さんの図だけ（施術する人が足した × も）');
  assert.ok((await p.locator('.hist .slide').first().textContent()).includes('施術者が書き足した：肌の状態'), 'これまでの記録で、書いた人と直したらんが分かる'); await shot('40b-history-guest');
  assert.ok(await p.locator('.foot .btn.primary', { hasText: '今日の来店をはじめる' }).count() && await p.locator('.foot .handbtn:not(.primary)').count(), '2回目からは「聞きながら書く」が大きく、「お客さんに渡す」も選べる');
  const nx = await p.evaluate(async (id) => { const st = await import('./js/state.js'); const v = await st.newVisit(id); const r = [v.guestFigures.front.map((x) => x.m), v.figures.front.length]; await st.deleteVisit(v); return r; }, got.id);
  assert.deepEqual(nx, [['m_notouch'], 0], 'お客さんの × は、次の来店のお客さんの図に写る');
  // 2回目：お客さんに渡すと、問診だけ（登録・同意書は済んでいる）
  await p.locator('.foot .handbtn').tap(); await p.waitForSelector('.sheet'); assert.deepEqual(await p.locator('.sheet .chips.col .chip.on').allTextContents().then((a) => a.length), 1, '2回目は問診だけ'); await p.locator('.sheet').getByText('とじる').tap();
  await p.goto(BASE + '#/set/handover'); await p.waitForSelector('text=決めてあります'); await shot('41-set-handover');
  await p.evaluate(async (id) => { const st = await import('./js/state.js'); await st.deleteCustomer(id); }, got.id); await p.goto(BASE + '#/'); await p.waitForSelector('.home-top');

  // ================= iPhone（たて持ち・指）で、来店の流れを最後まで =================
  const { devices } = require('playwright');
  const ph = await kit(b, { ...devices['iPhone 13'], deviceScaleFactor: 1 }, 'iphone-');
  const q = ph.p; const size = q.viewportSize(); log('iPhone の大きさ：', JSON.stringify(size));
  await q.goto(BASE); await ph.skipStart(); await ph.shot('01-home');
  assert.deepEqual(await ph.counts(), { c: 0, v: 0, b: 0 }, '端末ごとにデータは別（iPad のお客さんは見えない）');
  await ph.tap('＋ 新しいお客さん');
  await q.getByPlaceholder('山田 花子').fill('小画面 ためし'); await q.getByPlaceholder('やまだ はなこ').fill('しょうがめん ためし');
  await ph.tap('ごま'); await ph.noOverflow('お客さんの登録'); await ph.shot('02-new');
  await ph.tap('保存する'); await q.waitForSelector('text=今日の来店をはじめる'); await ph.noOverflow('お客さん'); await ph.shot('03-customer');
  await ph.tap('今日の来店をはじめる'); await q.waitForSelector('.steps');
  await ph.tap('腰のつらさ'); await ph.tap('むくみ'); await q.locator('.symrow').nth(0).getByText('7', { exact: true }).tap();
  await ph.tap('べたつきやすい'); await ph.tap('こり・はりをほぐしたい');
  const lv = await q.locator('.symrow .lv').first().boundingBox(); assert.ok(lv.width >= 44 && lv.height >= 44, `つらさのボタンが指で押せる大きさ（${lv.width}×${lv.height}）`);
  await ph.noOverflow('問診'); await ph.shot('04-monshin');
  await ph.tap('次へ：気になるところ ›'); await q.waitForSelector('.zu.guest'); await ph.noOverflow('気になるところ'); await ph.tap('後半へ：所見 ›'); await q.waitForSelector('.zu.staff .bodypad');
  await ph.noOverflow('からだの図'); await ph.shot('05-zu');
  await q.locator('.zuprev').tap(); await q.waitForSelector('.zu.full'); assert.equal(await q.locator('.zu .bodypad').count(), 1, '小さい画面では、図は1つずつ');
  let bb = await q.locator('.zu .bodypad').boundingBox();
  assert.ok(bb.height > size.height * 0.55, `画面いっぱいで図が大きい（高さ ${Math.round(bb.height)} / ${size.height}）`);
  const qc = await q.locator('.closefull').boundingBox(); assert.ok(qc.y >= 0 && qc.y < 60 && qc.height >= 44 && qc.y + qc.height < bb.y + 2, `iPhone でも、図の上に「もどる（とじる）」がある：${JSON.stringify(qc)}`);
  const mid = (r, fx, fy) => [r.x + r.width * fx, r.y + r.height * fy];
  await ph.touchLine([mid(bb, 0.45, 0.3), mid(bb, 0.5, 0.31), mid(bb, 0.55, 0.3)]);
  assert.equal(await strokes(q), 1, '画面いっぱいで、指でなぞれる'); await ph.shot('05b-zu-full');
  await ph.tap('上半身'); bb = await q.locator('.zu .bodypad').boundingBox();
  await ph.tap('痛い'); await ph.touchLine([mid(bb, 0.4, 0.5), mid(bb, 0.5, 0.52), mid(bb, 0.6, 0.5)]);
  assert.equal(await strokes(q), 2, '上半身を大きくしてなぞれる'); await ph.shot('05c-zu-top');
  const ys = await q.evaluate(async () => { const db = await import('./js/db.js'); const st = await import('./js/state.js'); await st.flush(); const v = (await db.all('visits'))[0]; return v.figures.front.map((s) => s.p[1]); });
  assert.ok(ys[0] > 150 && ys[0] < 250 && ys[1] > 120 && ys[1] < 260, '大きくしても、線は図の同じ座標で残る：' + ys.join());
  await q.locator('.fullview .chip', { hasText: '後ろ' }).tap(); await ph.tap('下半身'); bb = await q.locator('.zu .bodypad').boundingBox();
  await ph.touchLine([mid(bb, 0.4, 0.4), mid(bb, 0.42, 0.5), mid(bb, 0.4, 0.6)]); await ph.shot('05d-zu-bottom');
  await ph.tap('↩ 戻す'); await ph.tap('全体'); await q.locator('.fullview .chip', { hasText: '前' }).tap(); assert.equal(await strokes(q), 2);
  await ph.tap('‹ もどる（とじる）'); assert.equal(await q.locator('.zu.full').count(), 0);
  await ph.tap('次へ：オイル ›'); await q.waitForSelector('.oil');
  await q.locator('.oil', { hasText: 'サイプレス' }).getByText('使う', { exact: true }).tap();
  await q.locator('.tab', { hasText: 'キャリアオイル' }).tap(); await q.waitForSelector('.oil.buy');
  assert.equal(await q.locator('.oil.out', { hasText: 'セサミオイル' }).count(), 1, 'ごまのアレルギー → セサミオイルを理由つきで外す');
  await q.locator('.oil', { hasText: 'ホホバオイル' }).getByText('使う', { exact: true }).tap();
  await ph.noOverflow('オイルの候補'); await ph.shot('06-carrier');
  await ph.tap('次へ：ブレンド ›'); await q.waitForSelector('.meter');
  await q.getByText('20ml', { exact: true }).tap();
  assert.equal((await q.locator('.meter .pct').textContent()).trim(), '0.3％', '20ml に 1滴で 0.25％');
  assert.ok(await q.getByText('この量なら 4滴まで', { exact: false }).count(), '20ml・目安1％なら 4滴まで');
  const plus2 = q.locator('.brow:not(.car)').first().getByText('＋'); for (let i = 0; i < 4; i++) await plus2.tap();
  assert.ok(await q.locator('.meter.over').count(), '5滴でこえる'); await ph.noOverflow('ブレンド'); await ph.shot('07-blend');
  await q.locator('.brow:not(.car)').first().getByText('−').tap(); assert.equal((await q.locator('.meter .pct').textContent()).trim(), '1.0％');
  await ph.tap('＋ 精油を足す'); await q.waitForSelector('.sheet'); await ph.shot('07b-sheet'); await ph.tap('とじる');
  await ph.tap('次へ：施術 ›'); await q.waitForSelector('text=施術メニュー'); await q.getByText('整体 60分').tap(); await ph.noOverflow('施術'); await ph.shot('08-sejutsu');
  await ph.tap('次へ：施術後 ›'); await q.waitForSelector('text=つらさの変化');
  await q.locator('.symrow').nth(0).getByText('2', { exact: true }).tap(); await ph.tap('好き'); await ph.tap('1週間後'); await ph.noOverflow('施術後'); await ph.shot('09-after');
  await ph.tap('できた（カルテをとじる）'); await q.waitForSelector('text=情報を直す');
  const t2 = await q.locator('.main').textContent();
  assert.ok(t2.includes('腰のつらさ 7→2') && t2.includes('サイプレス 4滴') && t2.includes('ホホバオイル 20ml'), 'iPhone で最後まで通って残る：' + t2.slice(0, 200));
  await ph.noOverflow('お客さん（来店のあと）'); await ph.shot('10-customer-after');

  // --- iPad ⇄ iPhone：バックアップの書き出し → 戻しで移せる ---
  await q.goto(BASE + '#/set/backup'); await q.waitForSelector('text=iPad と iPhone のあいだで移す'); await ph.noOverflow('バックアップ'); await ph.shot('11-backup');
  assert.ok(await q.getByText('など iPhone の外にも', { exact: false }).count(), '説明の言葉が端末に合っている');
  await ph.tap('バックアップを作る'); await ph.tap('合言葉なしで書き出す'); await q.waitForSelector('text=保存先をえらぶ');
  const [dl2] = await Promise.all([q.waitForEvent('download'), ph.tap('保存先をえらぶ')]);
  const file2 = path.join(require('os').tmpdir(), 'karte-e2e-iphone.json'); await dl2.saveAs(file2);
  // iPad で書き出したもの（合言葉つき）を iPhone に戻す
  await q.waitForSelector('text=今日バックアップ済み');
  await q.locator('input[type=file]').setInputFiles(file); await q.waitForSelector('text=合言葉つき');
  await q.locator('input[type=password]').nth(2).fill('あいことば123'); await ph.tap('このバックアップに入れ替える'); await ph.tap('入れ替える'); await q.waitForSelector('.home-top');
  assert.deepEqual(await ph.counts(), { c: 1, v: 2, b: 1 }, 'iPad → iPhone に移せる');
  await q.getByLabel('お客さんをさがす').fill('しけん'); await q.locator('.home-top + .list .row-link', { hasText: '試験 みほ' }).tap(); await q.waitForSelector('text=来店の記録');
  assert.equal(await q.locator('.thumbs .strokes path').count(), 1, '図の線もいっしょに移る'); await ph.shot('12-moved');
  await q.locator('.hist .track').scrollIntoViewIfNeeded(); await q.waitForTimeout(300); const tb = await q.locator('.hist .track').boundingBox(); // 指で横にめくる
  await ph.touchLine([[tb.x + tb.width * 0.85, tb.y + 200], [tb.x + tb.width * 0.6, tb.y + 202], [tb.x + tb.width * 0.35, tb.y + 204], [tb.x + tb.width * 0.15, tb.y + 205]]);
  await q.waitForFunction(() => document.querySelector('.hpos').textContent.startsWith('2／全2回'), null, { timeout: 5000 }); await q.waitForTimeout(400);
  await ph.noOverflow('これまでの記録'); await ph.shot('12b-history-swiped');
  const tops = await q.locator('.hist .slide .thumbs').evaluateAll((els) => els.map((e) => e.offsetTop)); assert.equal(tops[0], tops[1], 'iPhone でも、図はどの回も同じ高さ：' + tops.join());
  // iPhone で書き出したものを iPad に戻す
  await p.goto(BASE + '#/set/backup'); await p.waitForSelector('text=書き出す');
  await p.locator('input[type=file]').setInputFiles(file2); await p.waitForSelector('text=合言葉なし'); await tap('このバックアップに入れ替える'); await tap('入れ替える'); await p.waitForSelector('.home-top');
  assert.deepEqual(await pad.counts(), { c: 1, v: 1, b: 0 }, 'iPhone → iPad に移せる');
  await p.getByLabel('お客さんをさがす').fill('ためし'); assert.equal(await p.locator('.home-top + .list .row-link', { hasText: '小画面 ためし' }).count(), 1);

  // --- もっと小さい iPhone（375×667）でも、はみ出さない ---
  await q.setViewportSize({ width: 375, height: 667 });
  const vid2 = await q.evaluate(async () => { const db = await import('./js/db.js'); return (await db.all('visits')).find((v) => v.status === 'done').id; });
  for (const [h, n] of [['/', 'home'], ['/list', 'list'], ['/new', 'new'], ['/set', 'set'], ['/set/oils', 'oils'], ['/set/oil/o_lavender', 'oil-edit'], ['/set/carriers', 'carriers'], ['/set/carrier/k_almond', 'carrier-edit'], ['/set/fats', 'fats'], ['/set/limits', 'limits'], ['/set/cats', 'cats'], ['/set/lists', 'lists'], ['/set/menus', 'menus'], ['/set/backup', 'backup'], ['/set/about', 'about'],
    ['/set/handover', 'handover'], ...['monshin', 'kininaru', 'shoken', 'seiyu', 'blend', 'sejutsu', 'after'].map((s) => [`/v/${vid2}/${s}`, 'visit-' + s])]) {
    await q.goto(BASE + '#' + h); await q.waitForSelector('.page'); await q.waitForTimeout(120);
    await q.locator('details.fold').evaluateAll((els) => els.forEach((e) => { e.open = true; }));
    await ph.noOverflow('小さい iPhone・' + n); await ph.shot('se-' + n);
  }
  await q.goto(BASE + `#/v/${vid2}/zu`); await q.waitForSelector('.bodypad'); await q.locator('.zuprev').tap(); await q.waitForSelector('.zu.full'); await ph.shot('se-zu-full');
  bb = await q.locator('.zu .bodypad').boundingBox(); assert.ok(bb.height > 330 && bb.y >= 0 && bb.y + bb.height <= 667, `小さい iPhone でも図が画面におさまる（高さ ${Math.round(bb.height)}）`);

  await ph.tap('‹ もどる（とじる）');
  // 小さい iPhone で、お客さん用の画面を最後まで（はみ出さない・図は画面いっぱいでなぞれる・出られない）
  await q.evaluate(async (vid) => { const db = await import('./js/db.js'); const st = await import('./js/state.js'); const v = await db.get('visits', vid); await st.setPin('1357'); await st.enterGuest({ customerId: v.customerId, visitId: v.id, parts: ['profile', 'consent', 'monshin'] }); location.hash = '#/guest'; }, vid2);
  await q.waitForSelector('.guestmode');
  for (let k = 0; k < 12 && !(await q.locator('.gdone').count()); k++) {
    await q.waitForTimeout(150); await ph.noOverflow('小さい iPhone・お客さん用の画面 ' + k); await ph.shot('se-guest-' + k);
    if (await q.locator('.signpad').count()) { await q.locator('.signpad').scrollIntoViewIfNeeded(); await q.waitForTimeout(300); const r = await q.locator('.signpad').boundingBox(); await ph.touchLine([[r.x + 40, r.y + r.height * 0.6], [r.x + 120, r.y + r.height * 0.3], [r.x + 200, r.y + r.height * 0.6]]); }
    if (await q.locator('.zu.simple').count()) {
      await q.locator('.zuprev').tap(); await q.waitForSelector('.zu.full'); const r = await q.locator('.zu .bodypad').boundingBox(); const before = await q.locator('.zu .strokes.own > *').count();
      await ph.touchLine([[r.x + r.width * 0.45, r.y + r.height * 0.3], [r.x + r.width * 0.55, r.y + r.height * 0.31]]); assert.equal(await q.locator('.zu .strokes.own > *').count(), before + 1, 'お客さんも画面いっぱいでなぞれる');
      await ph.noOverflow('お客さん用の図・画面いっぱい'); await ph.shot('se-guest-full'); await ph.tap('‹ もどる（とじる）'); assert.equal(await q.locator('.zu.full').count(), 0);
    }
    await q.locator('.gnext').scrollIntoViewIfNeeded(); await q.locator('.gnext').tap(); await q.waitForTimeout(250);
  }
  await q.waitForSelector('text=スタッフにお返しください'); await ph.shot('se-guest-done');
  await q.evaluate(() => { location.hash = '#/set'; }); await q.waitForTimeout(250); assert.ok(await q.locator('.guestmode').count() === 1 && await q.locator('.page').count() === 0, 'iPhone でも、お客さん用の画面から出られない');
  await ph.tap('スタッフ：合言葉を入れてもどる'); for (const d of '1357') { await q.locator('.pinkey', { hasText: d }).tap(); await q.waitForTimeout(60); } await q.waitForSelector('.phasebar.guest'); await ph.noOverflow('戻ったあと');

  assert.deepEqual(outside, [], '外へ通信していない'); assert.deepEqual(errs, [], 'エラーなし');
  log('✓ ぜんぶ通った'); await b.close();
})().catch((e) => { console.error('✗ 失敗：', e.message, (e.stack || '').split('\n').filter((l) => l.includes('e2e.cjs')).slice(0, 2).join(' ')); process.exit(1); });
