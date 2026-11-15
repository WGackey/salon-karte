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
  const tap = (text, o = {}) => p.getByText(text, { exact: o.exact ?? true }).first().tap();
  const cdp = await ctx.newCDPSession(p);
  const touchLine = async (pts) => { // 指でなぞる
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0][0], y: pts[0][1] }] });
    for (const [x, y] of pts.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(350); // 人の手の速さに合わせる（すぐ次を押すと、ブラウザが「2回押し」と見なして押したことにならない）
  };
  const noOverflow = async (what) => assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${what}：横にはみ出さない`);
  const counts = () => p.evaluate(async () => { const db = await import('./js/db.js'); return { c: await db.count('customers'), v: await db.count('visits'), b: await db.count('blends') }; });
  return { ctx, p, shot, tap, touchLine, noOverflow, counts };
}
const strokes = (p) => p.locator('.zu .bodypad .strokes path').count();

(async () => {
  const b = await chromium.launch();
  const pad = await kit(b, { viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }, '');
  const { ctx, p, shot, tap, touchLine } = pad;

  await p.goto(BASE); await p.waitForSelector('.page');
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
  await tap('次へ：からだの図 ›'); await p.waitForSelector('.bodypad');
  const box = await p.locator('.bodypad').nth(1).boundingBox(); const sy0 = await p.evaluate(() => scrollY);
  const cx = box.x + box.width / 2, top = box.y;
  await touchLine([[cx - 30, top + box.height * 0.2], [cx - 10, top + box.height * 0.21], [cx + 10, top + box.height * 0.2], [cx + 30, top + box.height * 0.21]]);
  await tap('痛い'); await tap('太い');
  const b0 = await p.locator('.bodypad').nth(0).boundingBox();
  await touchLine([[b0.x + b0.width / 2, b0.y + b0.height * 0.4], [b0.x + b0.width / 2 + 5, b0.y + b0.height * 0.45], [b0.x + b0.width / 2, b0.y + b0.height * 0.5]]);
  assert.equal(await strokes(p), 2, '指でなぞった線が2本');
  assert.equal(await p.evaluate(() => scrollY), sy0, 'なぞっても画面が動かない');
  await shot('05-zu');
  await tap('↩ ひとつ戻す'); assert.equal(await strokes(p), 1, 'ひとつ戻す');
  await tap('消しゴム（線をえらぶ）'); await touchLine([[cx, top + box.height * 0.2], [cx + 2, top + box.height * 0.205]]);
  assert.equal(await strokes(p), 0, '消しゴムで消える');
  await tap('↩ ひとつ戻す'); assert.equal(await strokes(p), 1, '消しゴムで消した線が「ひとつ戻す」で戻る');
  await tap('↩ ひとつ戻す'); assert.equal(await strokes(p), 0, 'もう一度で、その線をかく前に戻る');
  assert.ok(await p.getByText('↩ ひとつ戻す').isDisabled(), '戻すものがなくなったら押せない');
  await tap('こっている'); await touchLine([[cx - 30, top + box.height * 0.2], [cx, top + box.height * 0.21], [cx + 30, top + box.height * 0.2]]);
  await tap('開く前に戻す'); await p.locator('.dialog').getByText('開く前に戻す').tap(); assert.equal(await strokes(p), 0, '開く前の図に戻る');
  await tap('↩ ひとつ戻す'); assert.equal(await strokes(p), 1, '「開く前に戻す」も、ひとつ戻すで取り消せる');
  assert.ok((await p.locator('.pennow').textContent()).includes('こっている'), 'いまえらんでいる症状が見える');
  assert.equal(await p.locator('.markbtn.on').count(), 1); assert.equal(await p.locator('.widthbtn.on').count(), 1);
  assert.ok((await p.locator('.savebadge').textContent()).includes('保存'), '自動で保存のしるしが出ている');
  await tap('後ろだけ'); await shot('05b-zu-big'); assert.equal(await p.locator('.zu .bodypad').count(), 1);
  await tap('⤢ 画面いっぱいでかく'); await p.waitForSelector('.zu.full'); await shot('05c-zu-full');
  const fb = await p.locator('.zu .bodypad').boundingBox(); assert.ok(fb.y >= 0 && fb.y + fb.height <= 768 && fb.height > 600, `iPad の画面いっぱいで図がおさまる（${Math.round(fb.y)}〜${Math.round(fb.y + fb.height)}）`);
  await tap('✕ 大きい画面をとじる'); assert.equal(await p.locator('.zu.full').count(), 0); await tap('ならべる'); assert.equal(await strokes(p), 1, '見え方を変えても線は残る');

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
  assert.deepEqual(await pad.counts(), { c: 1, v: 2, b: 1 }, 'バックアップから元どおり');
  await shot('11-home');

  // --- これまでの記録を横にめくる（前回 → 1回前 …） ---
  await p.getByLabel('お客さんをさがす').fill('しけん'); await p.locator('.list .row-link', { hasText: '試験 みほ' }).tap(); await p.waitForSelector('.hist');
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
  assert.deepEqual(mig, { ver: 4, sun: 'このあと屋外で過ごす予定がある（外出・屋外作業など）', mens: '生理中（自分で直した）', jojoba: ['ホホバ（自分で直した名前）', 97, true], tsubakiOwned: true, argan: true, n: 12, tags: [], skins: [0, 0], syms: [3, 3] }, '版1 → 版4 の移し替え：' + JSON.stringify(mig));
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
  assert.deepEqual(mig4, { ver: 4, n: 31, lav: ['ラベンダー・アングスティフォリア', true], ginger: [false, true, 80], clary: ['クラリセージ（確かめた）', 'f_flower', 65],
    cats: 'alc,ald,est,hyd,ket,oxi,phe', fam: '樹木系,花穂系,柑橘系', drive: true, acts: 2, iv: true }, '版3 → 版4 の移し替え：' + JSON.stringify(mig4));
  await p.goto(BASE + '#/set/oils'); await p.waitForSelector('text=ラベンダー・アングスティフォリア'); assert.ok(await p.getByText('資料にない').count(), '資料にない精油のしるし');
  // 移し替えたあとのカルテで、精油の候補の画面が開ける
  await p.goto(BASE + '#/'); await p.waitForSelector('.home-top');
  // 移し替えのしくみそのもの（次の版を足すとき用）
  const mig3 = await p.evaluate(async () => {
    const db = await import('./js/db.js');
    const r = await db.migrateDb([{ to: 5, stores: { visits: (x) => ({ ...x, _test: 'moved' }) } }], 5);
    const ok = (await db.all('visits')).every((x) => x._test === 'moved'); const ver = await db.getMeta('dataVersion');
    const vs = await db.all('visits'); for (const x of vs) delete x._test; await db.bulkPut('visits', vs); await db.setMeta('dataVersion', 4);
    return { r, ok, ver };
  });
  assert.deepEqual(mig3, { r: { from: 4, to: 5 }, ok: true, ver: 5 }, '版の移し替え');

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

  // ================= iPhone（たて持ち・指）で、来店の流れを最後まで =================
  const { devices } = require('playwright');
  const ph = await kit(b, { ...devices['iPhone 13'], deviceScaleFactor: 1 }, 'iphone-');
  const q = ph.p; const size = q.viewportSize(); log('iPhone の大きさ：', JSON.stringify(size));
  await q.goto(BASE); await q.waitForSelector('.page'); await ph.shot('01-home');
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
  await ph.tap('次へ：からだの図 ›'); await q.waitForSelector('.bodypad');
  assert.equal(await q.locator('.zu .bodypad').count(), 1, '小さい画面では、図は1つずつ');
  await ph.noOverflow('からだの図'); await ph.shot('05-zu');
  await ph.tap('⤢ 画面いっぱいでかく（なぞりやすい）'); await q.waitForSelector('.zu.full');
  let bb = await q.locator('.zu .bodypad').boundingBox();
  assert.ok(bb.height > size.height * 0.55, `画面いっぱいで図が大きい（高さ ${Math.round(bb.height)} / ${size.height}）`);
  const mid = (r, fx, fy) => [r.x + r.width * fx, r.y + r.height * fy];
  await ph.touchLine([mid(bb, 0.45, 0.3), mid(bb, 0.5, 0.31), mid(bb, 0.55, 0.3)]);
  assert.equal(await strokes(q), 1, '画面いっぱいで、指でなぞれる'); await ph.shot('05b-zu-full');
  await ph.tap('上半身'); bb = await q.locator('.zu .bodypad').boundingBox();
  await ph.tap('痛い'); await ph.touchLine([mid(bb, 0.4, 0.5), mid(bb, 0.5, 0.52), mid(bb, 0.6, 0.5)]);
  assert.equal(await strokes(q), 2, '上半身を大きくしてなぞれる'); await ph.shot('05c-zu-top');
  const ys = await q.evaluate(async () => { const db = await import('./js/db.js'); const st = await import('./js/state.js'); await st.flush(); const v = (await db.all('visits'))[0]; return v.figures.front.map((s) => s.p[1]); });
  assert.ok(ys[0] > 150 && ys[0] < 250 && ys[1] > 120 && ys[1] < 260, '大きくしても、線は図の同じ座標で残る：' + ys.join());
  await ph.tap('後ろだけ'); await ph.tap('下半身'); bb = await q.locator('.zu .bodypad').boundingBox();
  await ph.touchLine([mid(bb, 0.4, 0.4), mid(bb, 0.42, 0.5), mid(bb, 0.4, 0.6)]); await ph.shot('05d-zu-bottom');
  await ph.tap('↩ ひとつ戻す'); await ph.tap('全体'); await ph.tap('前だけ'); assert.equal(await strokes(q), 2);
  await ph.tap('✕ 大きい画面をとじる'); assert.equal(await q.locator('.zu.full').count(), 0);
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
  await q.getByLabel('お客さんをさがす').fill('しけん'); await q.locator('.list .row-link', { hasText: '試験 みほ' }).tap(); await q.waitForSelector('text=来店の記録');
  assert.equal(await q.locator('.thumbs .strokes path').count(), 1, '図の線もいっしょに移る'); await ph.shot('12-moved');
  const tb = await q.locator('.hist .track').boundingBox(); // 指で横にめくる
  await ph.touchLine([[tb.x + tb.width * 0.85, tb.y + 200], [tb.x + tb.width * 0.6, tb.y + 202], [tb.x + tb.width * 0.35, tb.y + 204], [tb.x + tb.width * 0.15, tb.y + 205]]);
  await q.waitForFunction(() => document.querySelector('.hpos').textContent.startsWith('2／全2回'), null, { timeout: 5000 }); await q.waitForTimeout(400);
  await ph.noOverflow('これまでの記録'); await ph.shot('12b-history-swiped');
  const tops = await q.locator('.hist .slide .thumbs').evaluateAll((els) => els.map((e) => e.offsetTop)); assert.equal(tops[0], tops[1], 'iPhone でも、図はどの回も同じ高さ：' + tops.join());
  // iPhone で書き出したものを iPad に戻す
  await p.goto(BASE + '#/set/backup'); await p.waitForSelector('text=書き出す');
  await p.locator('input[type=file]').setInputFiles(file2); await p.waitForSelector('text=合言葉なし'); await tap('このバックアップに入れ替える'); await tap('入れ替える'); await p.waitForSelector('.home-top');
  assert.deepEqual(await pad.counts(), { c: 1, v: 1, b: 0 }, 'iPhone → iPad に移せる');
  await p.getByLabel('お客さんをさがす').fill('ためし'); assert.equal(await p.locator('.list .row-link', { hasText: '小画面 ためし' }).count(), 1);

  // --- もっと小さい iPhone（375×667）でも、はみ出さない ---
  await q.setViewportSize({ width: 375, height: 667 });
  const vid2 = await q.evaluate(async () => { const db = await import('./js/db.js'); return (await db.all('visits')).find((v) => v.status === 'done').id; });
  for (const [h, n] of [['/', 'home'], ['/list', 'list'], ['/new', 'new'], ['/set', 'set'], ['/set/oils', 'oils'], ['/set/oil/o_lavender', 'oil-edit'], ['/set/carriers', 'carriers'], ['/set/carrier/k_almond', 'carrier-edit'], ['/set/fats', 'fats'], ['/set/limits', 'limits'], ['/set/cats', 'cats'], ['/set/lists', 'lists'], ['/set/menus', 'menus'], ['/set/backup', 'backup'], ['/set/about', 'about'],
    ...['monshin', 'zu', 'seiyu', 'blend', 'sejutsu', 'after'].map((s) => [`/v/${vid2}/${s}`, 'visit-' + s])]) {
    await q.goto(BASE + '#' + h); await q.waitForSelector('.page'); await q.waitForTimeout(120);
    await q.locator('details.fold').evaluateAll((els) => els.forEach((e) => { e.open = true; }));
    await ph.noOverflow('小さい iPhone・' + n); await ph.shot('se-' + n);
  }
  await q.goto(BASE + `#/v/${vid2}/zu`); await q.waitForSelector('.bodypad'); await ph.tap('⤢ 画面いっぱいでかく（なぞりやすい）'); await q.waitForSelector('.zu.full'); await ph.shot('se-zu-full');
  bb = await q.locator('.zu .bodypad').boundingBox(); assert.ok(bb.height > 330 && bb.y >= 0 && bb.y + bb.height <= 667, `小さい iPhone でも図が画面におさまる（高さ ${Math.round(bb.height)}）`);

  assert.deepEqual(outside, [], '外へ通信していない'); assert.deepEqual(errs, [], 'エラーなし');
  log('✓ ぜんぶ通った'); await b.close();
})().catch((e) => { console.error('✗ 失敗：', e.message, (e.stack || '').split('\n').filter((l) => l.includes('e2e.cjs')).slice(0, 2).join(' ')); process.exit(1); });
