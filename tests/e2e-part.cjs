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
  const skipStart = async () => { await p.waitForSelector('.page'); if (await p.locator('.startskip').count()) { await p.locator('.startskip').tap(); await p.waitForSelector('.home-top'); } };
  return { skipStart, ctx, p, shot, tap, touchLine, noOverflow, drawOn, pin };
}
const visitOf = (p) => p.evaluate(async () => { const db = await import('./js/db.js'); await (await import('./js/state.js')).flush(); const id = location.hash.split('/')[2]; return db.get('visits', id); });

(async () => {
  const b = await chromium.launch();
  const pad = await kit(b, { viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }, 'pad-');
  const { p, shot, tap, drawOn } = pad;
  await p.goto(BASE); await pad.skipStart();

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
  await p.locator('.zuprev').tap(); await p.waitForSelector('.zu.full .zu-main .bodypad');
  await drawOn('.zu .bodypad', 0); await p.locator('.markbtn', { hasText: '触れないで' }).tap(); await drawOn('.zu .bodypad', 2); await shot('03-kininaru-hand');
  await tap('‹ もどる（とじる）'); await tap('後半へ：所見 ›'); await p.waitForSelector('.zu.staff .bodypad.pt');
  assert.equal(await p.locator('.zu .strokes.under.guest > *').count(), 2, 'お客さんの図が、所見の図に重なる');
  await p.locator('.zuprev').tap(); await p.waitForSelector('.zu.full'); await shot('05-full-hand');
  await drawOn('.zu .bodypad', 1); await shot('04-shoken-hand');
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
  await p.locator('.zuprev').tap(); await p.waitForSelector('.zu.full .zu-main .bodypad'); await drawOn('.guestmode .bodypad', 0); await shot('13-guest-foot'); await tap('‹ もどる（とじる）'); await tap('つぎへ ›'); await p.waitForSelector('text=伝えておきたいこと'); assert.equal(await p.getByText('今日の目的', { exact: true }).count(), 0); await shot('14-guest-m3');
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
  assert.deepEqual(mig, { ver: 9, parts: 5, menus: [null, null, null, null, null], n: 2 }, '版5 → 版6：' + JSON.stringify(mig));
  await p.goto(BASE + `#/v/${vid}/monshin`); await p.waitForSelector('.scopepick'); assert.ok(await p.locator('.scopesel .wholechip.on').count(), '0.6.0 のカルテは全身として開く');

  // ---------- ② 経過のページ ----------
  const kid = await p.evaluate(async () => { // 6回分の来店を作る（作りものの数字）
    const st = await import('./js/state.js'); const db = await import('./js/db.js'); const { addDays, todayStr } = await import('./js/logic.js');
    const { slim, det } = st.blankCustomer(); slim.name = '見本 けいか'; slim.kana = 'みほん けいか'; await st.saveCustomer(slim, det);
    const O = st.S.oils, C = st.S.carriers[0]; const plan = [[8, 7, 7, 6, [0, 1], 6], [8, 5, 6, 4, [2, 3], 6], [7, 6, 6, 6, [0, 1], 6], [7, 3, 5, 2, [2, 3], 9], [6, 4, null, null, [2, 3], 6], [5, null, 4, null, [4], 3]];
    for (let i = 0; i < plan.length; i++) { const [b1, a1, b2, a2, oi, drops] = plan[i]; const v = await st.newVisit(slim.id);
      v.date = addDays(todayStr(), -(plan.length - 1 - i) * 14); v.status = i === plan.length - 1 ? 'draft' : 'done'; v.createdAt = Date.now() + i;
      v.interview.symptoms = [{ id: 's_kata', level: b1 }, ...(b2 != null ? [{ id: 's_nemuri', level: b2 }] : [])]; v.after.levels = { ...(a1 != null ? { s_kata: a1 } : {}), ...(a2 != null ? { s_nemuri: a2 } : {}) };
      v.blend.oils = oi.map((k, j) => ({ oilId: O[k].id, name: O[k].name, drops: j ? drops - Math.ceil(drops / 2) : Math.ceil(drops / 2) })); v.blend.carriers = [{ carrierId: C.id, name: C.name, ml: 30 }];
      v.menus = [{ id: 'mn_2', name: 'アロマトリートメント', minutes: 60 }]; if (i === 2) { v.scope = { type: 'part', parts: ['hand'] }; v.blend.areaId = 'a_part'; } v.after.scent = '好き'; v.after.note = i === 3 ? 'よく眠れたとのこと' : ''; await db.put('visits', v); }
    await st.recount(slim.id); return slim.id; });
  await p.goto(BASE + `#/c/${kid}`); await p.waitForSelector('.keikabtn'); await p.locator('.hist').evaluate((e) => e.scrollIntoView()); await shot('20-hist-entry');
  await p.locator('.keikabtn').tap(); await p.waitForSelector('.pchart');
  assert.equal(await p.locator('.pchart .pdot.before').count(), 6, '前のつらさが6回分'); assert.equal(await p.locator('.pchart .pdot.after').count(), 5, '後は入っている回だけ');
  assert.equal(await p.locator('.plist .prow').count(), 6); assert.ok(await p.locator('.plist .prow').first().textContent().then((t) => t.includes('6回目') && t.includes('書きかけ')), '新しい順');
  assert.equal(await p.locator('.pgroup').count(), 3, '同じ精油の組み合わせでまとまる'); await shot('21-keika');
  await p.locator('.pchart .phit').nth(3).tap(); await p.waitForSelector('.ppicked'); assert.ok(await p.locator('.ppicked').textContent().then((t) => t.includes('4回目') && t.includes('7 → 3')), '回を押すと中身が出る'); await shot('22-keika-pick');
  await p.locator('.symsel .chip', { hasText: '眠りが浅い' }).tap(); assert.equal(await p.locator('.pchart .pdot.before').count(), 5, '症状を切りかえる');
  await p.locator('.sortsel .chip', { hasText: 'つらさが下がった順' }).tap(); assert.ok(await p.locator('.plist .prow').first().textContent().then((t) => t.includes('4回目')), '下がった順'); assert.equal(await p.locator('.plist .prow').count(), 5);
  await p.locator('.plist').evaluate((e) => e.scrollIntoView()); await shot('23-keika-list'); await pad.noOverflow('経過のページ');
  await p.locator('.symsel .chip', { hasText: '肩こり' }).tap(); await p.locator('.pchart .phit').nth(1).tap(); await tap('この回を「これまでの記録」で見る'); await p.waitForSelector('.hist .hpos');
  await p.waitForFunction(() => document.querySelector('.hpos').textContent.startsWith('5／全6回')); // 2回目＝新しい順で5番目
  await p.goto(BASE + `#/c/${kid}/keika`); await p.waitForSelector('.pchart'); await p.locator('.plist .prow').first().tap(); await p.waitForSelector('.steps');

  // ---------- ③ 予定の一覧 ----------
  const ids = await p.evaluate(async () => { const st = await import('./js/state.js'); const { addDays, todayStr } = await import('./js/logic.js'); const t = todayStr(); const out = {};
    const plan = [['よてい きょう', 0, '14:00'], ['よてい あさ', 0, '09:30'], ['よてい あした', 1, ''], ['よてい らいしゅう', 5, '10:00'], ['よてい さき', 20, ''], ['よてい すぎた', -4, ''], ['よてい むかし', -40, '']];
    for (const [name, d, time] of plan) { const { slim, det } = st.blankCustomer(); slim.name = '見本 ' + name; slim.kana = name; slim.nextDate = addDays(t, d); slim.nextTime = time; await st.saveCustomer(slim, det); out[name] = slim.id; }
    return out; });
  await p.goto(BASE + '#/list'); await p.goto(BASE + '#/'); await p.waitForSelector('.sched.today');
  const names = (k) => p.locator(`.sched.${k} .schedrow .name`).allTextContents();
  assert.deepEqual(await names('today'), ['見本 よてい あさ', '見本 よてい きょう'], '今日は時間の順'); assert.deepEqual(await names('week'), ['見本 よてい あした', '見本 よてい らいしゅう']);
  assert.deepEqual(await names('later'), ['見本 よてい さき']); assert.deepEqual(await names('overdue'), ['見本 よてい すぎた', '見本 よてい むかし'], '予定日を過ぎて来店の記録がない人');
  await shot('30-home-sched'); await pad.noOverflow('ホーム');
  // 予定を押すと、その人のカルテが開く
  await p.locator('.sched.today .schedrow').first().tap(); await p.waitForSelector('text=今日の来店をはじめる'); assert.ok(await p.getByText('見本 よてい あさ').count()); assert.equal(await p.locator('.timein').inputValue(), '09:30');
  // 来店をはじめると、予定は消える
  await tap('今日の来店をはじめる'); await p.waitForSelector('.scopepick'); await p.goto(BASE + '#/'); await p.waitForSelector('.sched.today'); assert.deepEqual(await names('today'), ['見本 よてい きょう']);
  // 過ぎた人：お客さんのページに知らせ → 予定を消す
  await p.locator('.sched.overdue .schedrow').first().tap(); await p.waitForSelector('.latenote'); await shot('31-late'); await tap('予定を消す'); await p.waitForFunction(() => !document.querySelector('.latenote'));
  await p.goto(BASE + '#/list'); await p.goto(BASE + '#/'); await p.waitForSelector('.sched.overdue'); assert.deepEqual(await names('overdue'), ['見本 よてい むかし']);
  // 予定の入れ物（あとで Google カレンダーの取りこみが使う）。行を入れると、ホームに並ぶ。バックアップにも入る
  const kept = await p.evaluate(async (cid) => { const db = await import('./js/db.js'); const st = await import('./js/state.js'); const { addDays, todayStr } = await import('./js/logic.js');
    await db.put('appts', { id: 'x1', date: addDays(todayStr(), 2), time: '13:00', customerId: '', title: '山田さま（カレンダーから）', source: 'gcal' }); await db.put('appts', { id: 'x2', date: addDays(todayStr(), 3), time: '15:00', customerId: cid, source: 'gcal', confirmed: true });
    await st.reload(); const dump = await db.dumpAll(); await db.restoreAll(dump); await st.reload(); return (await db.all('appts')).length; }, ids['よてい さき']);
  assert.equal(kept, 2, '予定の入れ物は、書き出し → 戻しでも残る');
  await p.goto(BASE + '#/list'); await p.goto(BASE + '#/'); await p.waitForSelector('.sched.week'); assert.ok((await names('week')).some((n) => n.includes('山田さま（カレンダーから）') && n.includes('お客さんを確かめる'))); assert.ok((await names('week')).includes('見本 よてい さき'));
  await shot('32-home-appts');

  // ---------- iPhone ----------
  const ph = await kit(b, { viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, 'ph-'); const q = ph.p;
  await q.goto(BASE); await ph.skipStart(); await ph.tap('＋ 新しいお客さん'); await q.getByPlaceholder('山田 花子').fill('見本 あしうら'); await ph.tap('保存する'); await q.waitForSelector('text=今日の来店をはじめる');
  await ph.tap('今日の来店をはじめる'); await q.waitForSelector('.scopepick'); await q.locator('.scopepick .chip', { hasText: 'フットトリートメント' }).tap(); await q.waitForSelector('.shortnote'); await ph.shot('01-monshin-foot'); await ph.noOverflow('iPhone 問診');
  await ph.tap('次へ：気になるところ ›'); await q.waitForSelector('.zu.guest .bodypad.pt'); await ph.shot('02-kininaru-foot'); await ph.noOverflow('iPhone 図');
  await q.locator('.zuprev').tap(); await q.waitForSelector('.zu.full'); assert.equal(await q.locator('.zu .bodypad').count(), 1, 'iPhone は図を1つずつ'); await ph.drawOn('.zu .bodypad', 0); await ph.shot('03-full-foot');
  await q.locator('.fullview .chip', { hasText: '左足の甲' }).scrollIntoViewIfNeeded(); await q.locator('.fullview .chip', { hasText: '左足の甲' }).tap(); await ph.drawOn('.zu .bodypad', 0); await ph.shot('04-full-foot-top'); await ph.tap('‹ もどる（とじる）');
  await q.goto(q.url().replace(/\/[^/]+$/, '/after')); await ph.tap('できた（カルテをとじる）'); await q.waitForSelector('.hist'); await q.locator('.hist').scrollIntoViewIfNeeded(); await ph.shot('05-customer-foot'); await ph.noOverflow('iPhone お客さんのページ');
  await q.locator('.hist button.thumbs').first().tap(); await q.waitForSelector('.bigfigs'); await ph.shot('06-bigfigs'); await ph.noOverflow('iPhone 図を大きく');
  await q.goto(BASE + '#/list'); await q.waitForSelector('.list'); assert.equal(await q.locator('.overlay').count(), 0, '開いたままのパネルは、画面を移ると閉じる');

  // 経過のページ（iPhone）
  const kid2 = await q.evaluate(async () => { const st = await import('./js/state.js'); const db = await import('./js/db.js'); const { addDays, todayStr } = await import('./js/logic.js'); const id = st.S.people[0].id;
    for (let i = 0; i < 12; i++) { const v = await st.newVisit(id); v.date = addDays(todayStr(), -(i + 1) * 10); v.status = 'done'; v.interview.symptoms = [{ id: 's_ashi', level: 4 + (i % 5) }]; v.after.levels = { s_ashi: 2 + (i % 3) };
      v.blend.oils = [{ oilId: st.S.oils[i % 2].id, name: st.S.oils[i % 2].name, drops: 3 }]; v.blend.carriers = [{ carrierId: st.S.carriers[0].id, name: st.S.carriers[0].name, ml: 10 }]; v.scope = { type: 'part', parts: ['foot'] }; await db.put('visits', v); }
    await st.recount(id); return id; });
  await q.goto(BASE + `#/c/${kid2}/keika`); await q.waitForSelector('.pchart'); await ph.shot('07-keika'); await ph.noOverflow('iPhone 経過');
  await q.locator('.plist').evaluate((e) => e.scrollIntoView()); await ph.shot('08-keika-list');
  await q.goto(BASE + `#/c/${kid2}`); await q.waitForSelector('.keikabtn'); await q.locator('.hist').evaluate((e) => e.scrollIntoView()); await ph.shot('09-hist-entry'); await ph.noOverflow('iPhone これまでの記録');

  await q.evaluate(async () => { const st = await import('./js/state.js'); const { addDays, todayStr } = await import('./js/logic.js'); const t = todayStr();
    for (const [name, d, time] of [['きょう', 0, '10:00'], ['あした', 1, '16:30'], ['すぎた', -3, '']]) { const { slim, det } = st.blankCustomer(); slim.name = '見本 ' + name; slim.nextDate = addDays(t, d); slim.nextTime = time; await st.saveCustomer(slim, det); } });
  await q.goto(BASE + '#/list'); await q.goto(BASE + '#/'); await q.waitForSelector('.sched.today'); await ph.shot('10-home-sched'); await ph.noOverflow('iPhone ホーム');
  await q.locator('.sched.overdue .schedrow').first().tap(); await q.waitForSelector('.latenote'); await ph.shot('11-late'); await ph.noOverflow('iPhone 過ぎた人');

  assert.deepEqual(errs, [], 'エラーなし'); assert.deepEqual(outside, [], '外への通信なし');
  console.log('✓ ぜんぶ通った（第2段）'); await b.close();
})().catch((e) => { console.error('✗ 失敗：', e.message, '\n', (e.stack || '').split('\n').slice(1, 4).join('\n')); console.error(errs); process.exit(1); });
