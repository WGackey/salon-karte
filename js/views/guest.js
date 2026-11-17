// お客さん用の画面（端末をお客さんに渡しているあいだの画面）。
// ここからは、ほかのお客さんのカルテ・後半の画面・設定には行けない（app.js が、アドレスを打ちかえても戻るボタンでもここに戻す）。
// 施術する人が合言葉を入れると、もとの画面に戻る。
import { h, fill, btn, chips, field, group, input, textarea, toast, sheet, go } from '../ui.js';
import { S, person, blankCustomer, saveCustomer, saveVisit, saveSoon, flush, newVisit, visitsOf, hasPin, setPin, checkPin, enterGuest, saveGuest, leaveGuest } from '../state.js';
import * as db from '../db.js';
import { todayStr, consentState } from '../logic.js';
import { signPad } from '../signpad.js';
import { figureEditor } from '../figedit.js';
import { lifeFields, birthPicker } from './customer.js';
import { scopePicker } from '../scopepick.js';
import { isPart, figsOf, areaForScope, scopeText } from '../parts.js';

// ---- 合言葉（数字4けた）を入れるボタン。端末のキーボードは出さない ----
let wrong = 0, lockUntil = 0;
export function pinPad({ title, note, onPin }) {
  return new Promise((res) => {
    let val = ''; const dots = h('div', { class: 'pindots' }); const msg = h('p', { class: 'pinmsg' }, note || '');
    const end = (v) => { wrap.remove(); res(v); };
    const draw = () => fill(dots, ...[0, 1, 2, 3].map((i) => h('i', { class: i < val.length ? 'on' : '' })));
    const press = async (d) => {
      if (Date.now() < lockUntil) { msg.textContent = `少し待ってからためしてね（あと ${Math.ceil((lockUntil - Date.now()) / 1000)} 秒）`; return; }
      if (d === 'del') { val = val.slice(0, -1); draw(); return; }
      if (val.length >= 4) return;
      val += d; draw(); if (val.length < 4) return;
      const r = await onPin(val);
      if (r === true) return end(true);
      val = ''; draw(); msg.textContent = r || 'ちがうようです。もう一度入れてね'; msg.classList.add('warntext');
    };
    const key = (d, label) => h('button', { type: 'button', class: 'pinkey', 'aria-label': label || d, onclick: () => press(d) }, label || d);
    const wrap = h('div', { class: 'overlay center pinwrap' }, h('div', { class: 'dialog pin' }, h('h2', null, title), dots, msg,
      h('div', { class: 'pinkeys' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => key(d)), btn('やめる', () => end(false), 'ghost'), key('0'), key('del', '⌫'))));
    draw(); document.body.append(wrap);
  });
}
// 合言葉を決める（2回入れて、同じなら保存）
export async function choosePin() {
  let first = '';
  if (!(await pinPad({ title: '合言葉を決める（数字4けた）', note: 'お客さん用の画面から戻るときに入れます', onPin: (v) => { first = v; return true; } }))) return false;
  const ok = await pinPad({ title: 'もう一度、同じ数字を', note: 'たしかめのため、もう一度入れてね', onPin: (v) => (v === first ? true : '1回目とちがいます。もう一度') });
  if (!ok) return false;
  await setPin(first); toast('合言葉を決めました'); return true;
}
// 合言葉を聞いて、合っていれば true
export const askPin = (title = 'スタッフ用：合言葉を入れてください') => pinPad({ title, onPin: async (v) => {
  if (await checkPin(v)) { wrong = 0; return true; }
  if (++wrong >= 5) { wrong = 0; lockUntil = Date.now() + 30000; return '5回ちがいました。30秒 待ってからためしてね'; }
  return 'ちがうようです。もう一度入れてね';
} });

// ---- 渡す前の確かめ（施術する人の画面に出る） ----
const backTo = () => (S.settings.staffName ? `スタッフ（${S.settings.staffName}）` : 'スタッフ');
const PARTS = [['profile', 'お客さんの情報（お名前・連絡先・からだのこと・生活の様子）'], ['consent', '同意書とサイン'], ['monshin', '今日の問診（今日の状態・つらいところ・気になるところの図・香りの好み）']];
export async function startHandover(p, parts, visit, pick = null) {
  if (!parts.length) { toast('書いてもらうものをえらんでね'); return false; }
  if (!hasPin()) {
    toast('はじめに、戻るための合言葉を決めます'); if (!(await choosePin())) return false;
  }
  let v = visit;
  if (parts.includes('monshin') && !v) { const vs = await visitsOf(p.id); v = vs.find((x) => x.status === 'draft' && x.date === todayStr()) || await newVisit(p.id); }
  if (v && pick && parts.includes('monshin')) { // 渡す前にえらんだメニューと「施術するところ」を、今日のカルテに入れる
    const was = JSON.stringify(v.scope); v.menus = pick.menus; v.scope = pick.scope;
    if (was !== JSON.stringify(v.scope)) { const a = areaForScope(S.settings, v.scope); if (a) v.blend.areaId = a; }
    await saveVisit(v);
  }
  document.querySelectorAll('.overlay').forEach((o) => o.remove());
  await enterGuest({ customerId: p.id, visitId: parts.includes('monshin') ? v.id : null, parts });
  go('#/guest'); return true;
}
export function handoverSheet(p, det, visit, preset) {
  const cs = consentState(det.consents, S.settings.consent);
  let parts = preset || [!det.intakeAt && !(p.visitCount > (visit ? 1 : 0)) ? 'profile' : null, !cs.last || cs.stale ? 'consent' : null, 'monshin'].filter(Boolean);
  const pick = { menus: visit ? [...(visit.menus || [])] : [], scope: visit ? visit.scope : { type: 'whole' } };
  const pickBox = h('div'); const drawPick = () => fill(pickBox, parts.includes('monshin') ? h('div', { class: 'pickbox' }, scopePicker(pick, () => {})) : null);
  const s = sheet('お客さんに渡す', h('div', { class: 'step' },
    h('p', null, 'お客さん用の画面に切りかわります。', h('b', null, 'ほかのお客さんのカルテ・後半の画面・設定には行けなくなります。'), '戻るには合言葉が要ります。'),
    group('書いてもらうもの', chips(PARTS.map(([id, name]) => ({ id, name })), parts, { cls: 'col', onChange: (x) => { parts = PARTS.map((q) => q[0]).filter((q) => x.includes(q)); drawPick(); } })),
    pickBox,
    hasPin() ? null : h('div', { class: 'notice amber' }, 'まだ合言葉を決めていません。次の画面で、数字4けたを決めます。'),
    btn('この内容で、お客さんに渡す', () => startHandover(p, parts, visit, pick), 'primary big wide handbtn')));
  drawPick();
  return s;
}

// ---- お客さん用の画面 ----
export async function guestView() {
  const g = S.guest; const p = person(g.customerId);
  const root = h('div', { class: 'guestmode' });
  const unlock = async () => {
    await flush();
    if (!(await askPin())) return;
    const dest = g.visitId && v ? `#/v/${g.visitId}/monshin` : p ? `#/c/${p.id}` : '#/';
    await leaveGuest(); toast('施術する人の画面に戻りました'); go(dest);
  };
  const staffLink = () => h('button', { type: 'button', class: 'stafflink', onclick: unlock }, 'スタッフ用（合言葉でもどる）');
  let v = null;
  if (!p) { fill(root, h('div', { class: 'gdone' }, h('h1', null, backTo() + 'にお返しください'), staffLink())); return root; }
  const det = (await db.get('details', p.id)) || blankCustomer().det;
  v = g.visitId ? await db.get('visits', g.visitId) : null;
  if (v) { v.guestFigures = v.guestFigures || { front: [], back: [] }; v.interview.wish = v.interview.wish || ''; }
  const dirty = { p: false, v: false };
  const write = async () => { if (dirty.p) { dirty.p = false; await saveCustomer(p, det); } if (dirty.v && v) { dirty.v = false; await saveVisit(v); } };
  const saveP = () => { dirty.p = true; saveSoon(write); }; const saveV = () => { dirty.v = true; saveSoon(write); };
  const has = (part) => g.parts.includes(part) && (part !== 'monshin' || v);
  const consent = S.settings.consent || { text: '', ver: 1 };

  // 画面の並び。1画面に少しずつ。部分の施術（手だけ など）のときは短い版：連絡先・ふだんの生活は聞かない（からだの状態・アレルギーは省かない）
  const short = !!v && has('monshin') && isPart(v.scope);
  const screens = ['hello', ...(has('profile') ? (short ? ['p1', 'p3'] : ['p1', 'p2', 'p3', 'p4']) : []), ...(has('consent') ? ['consent'] : []), ...(has('monshin') ? ['m1', 'm2', 'm3'] : []), 'done'];
  let i = Math.min(g.step || 0, screens.length - 1);
  const q = (title, hint, ...kids) => h('section', { class: 'gcard' }, h('h2', null, title), hint ? h('p', { class: 'ghint' }, hint) : null, kids);
  const personConds = S.settings.conds.filter((c) => c.when === 'person' && !['c_infant', 'c_child', 'c_old'].includes(c.id));
  const visitConds = S.settings.conds.filter((c) => c.when === 'visit');
  const symName = (id) => (S.settings.symptoms.find((c) => c.id === id) || {}).name || '';
  const levels = (value, onPick) => {
    const wrap = h('div', { class: 'levels' });
    for (let n = 1; n <= 10; n++) { const b = h('button', { type: 'button', class: 'lv' + (n === value ? ' on' : ''), style: { '--lv': n } }, String(n)); b.onclick = () => { wrap.querySelectorAll('.lv').forEach((x) => x.classList.toggle('on', x === b)); onPick(n); }; wrap.append(b); }
    return wrap;
  };
  let signed = false; const signStrokes = [];

  const SCREEN = {
    hello: () => ({ title: `${p.name} 様`, body: [h('div', { class: 'ghello' },
      S.settings.salonName ? h('p', { class: 'gsalon' }, S.settings.salonName) : null, h('p', { class: 'gbig' }, '本日はありがとうございます。'), h('p', null, '施術の前に、いくつかおうかがいします。'),
      h('ul', { class: 'plain' }, has('profile') ? h('li', null, 'お客さまのこと（お名前・ご連絡先・おからだのこと）') : null, has('consent') ? h('li', null, '施術を受ける前のお願い（お読みいただいて、サイン）') : null, has('monshin') ? h('li', null, '今日のおからだの調子') : null),
      h('p', { class: 'ghint' }, '書きにくいところ・分からないところは、空けたままでだいじょうぶです。あとでスタッフがおうかがいします。'))], next: 'はじめる' }),
    p1: () => ({ title: 'お客さまのこと', body: [q('お名前', null,
      h('div', { class: 'grid2' }, field('お名前', input(p, 'name', { onInput: saveP })), field('ふりがな', input(p, 'kana', { onInput: saveP })))),
      q('性別', null, chips(['女性', '男性', 'そのほか'], det.gender, { multi: false, onChange: (x) => { det.gender = x; saveP(); } })),
      q('生年月日', null, birthPicker(det, saveP)),
      q('お仕事', 'いちばん近いものを押してください', chips(S.settings.jobs, det.job, { multi: false, onChange: (x) => { det.job = x; saveP(); } }))],
      check: () => (p.name.trim() ? null : 'お名前を入れてください') }),
    p2: () => ({ title: 'ご連絡先', body: [q('ご連絡先', '書けるところだけで、だいじょうぶです',
      h('div', { class: 'grid2' }, field('電話', input(det, 'tel', { type: 'tel', onInput: saveP })), field('メール', input(det, 'email', { type: 'email', onInput: saveP })),
        field('郵便番号', input(det, 'zip', { inputmode: 'numeric', onInput: saveP })), field('住所', input(det, 'address', { onInput: saveP }))))] }),
    p3: () => ({ title: 'おからだのこと', body: [
      q('あてはまるものはありますか', 'あてはまるものを押してください（なければ、そのまま次へ）', chips(personConds, det.conds, { onChange: (x) => { det.conds = [...det.conds.filter((c) => !personConds.some((pc) => pc.id === c)), ...x]; saveP(); } })),
      q('アレルギーはありますか', 'あてはまるものを押してください', chips(S.settings.allergens, det.allergyTags || [], { onChange: (x) => { det.allergyTags = x; saveP(); } }),
        field('そのほかのアレルギー・苦手な香りなど', textarea(det, 'allergy', { rows: 2, onInput: saveP }))),
      q('これまでの大きな病気・けが', 'いま通院中のこと・のんでいる薬があれば、それも書いてください', textarea(det, 'history', { rows: 3, onInput: saveP })),
      q('マッサージや整体を受けたことはありますか', null, textarea(det, 'experience', { rows: 2, onInput: saveP }))] }),
    p4: () => ({ title: 'ふだんの生活', body: [q('ふだんの生活', '分かるところだけで、だいじょうぶです', lifeFields(det, saveP))] }),
    consent: () => {
      const okBtn = btn('同意して、サインを残す', async () => {
        if (!signStrokes.length) { toast('わくの中にサインをお願いします'); return; }
        det.consents = [...(det.consents || []), { at: new Date().toISOString(), ver: consent.ver || 1, text: consent.text, sign: signStrokes.slice(), salon: S.settings.salonName || '', staff: S.settings.staffName || '' }];
        signed = true; await saveCustomer(p, det); show(i + 1);
      }, 'primary big wide gnext');
      const sync = () => okBtn.classList.toggle('dim', signStrokes.length === 0);
      const pad = signPad({ strokes: signStrokes, onChange: sync }); sync();
      return { title: S.settings.salonName ? `${S.settings.salonName}　施術を受ける前に` : '施術を受ける前に',
        body: signed ? [q('サインをいただきました', null, h('p', null, 'ありがとうございます。「つぎへ」を押してください。'))]
          : [h('p', { class: 'pre consenttext' }, consent.text), h('p', { class: 'signname' }, `${p.name} 様`), h('p', { class: 'ghint' }, '下のわくに、指かペンでサインしてください。'),
            h('div', { class: 'signbox' }, pad), h('div', { class: 'row' }, btn('書き直す', () => { signStrokes.length = 0; pad.redraw(); sync(); }, 'ghost'))],
        custom: signed ? null : okBtn };
    },
    m1: () => {
      const iv = v.interview; const symBox = h('div', { class: 'symlist' }); const pregBox = h('div');
      const drawSym = () => fill(symBox, ...iv.symptoms.map((s) => h('div', { class: 'symrow' }, h('div', { class: 'symname' }, symName(s.id)), levels(s.level, (n) => { s.level = n; saveV(); }))));
      const drawPreg = () => fill(pregBox, v.conds.includes('c_preg') ? group('いま何か月ですか', chips([...Array(10)].map((_, k) => ({ id: k + 1, name: `${k + 1}か月` })), v.pregMonth || '', { multi: false, onChange: (m) => { v.pregMonth = m || null; saveV(); } })) : null);
      drawSym(); drawPreg();
      const symChipBox = h('div'); // つらいところは、部分の施術でも いつもぜんぶ出す（0.14.1）
      const drawSymChips = () => {
        fill(symChipBox, chips(S.settings.symptoms, iv.symptoms.map((s) => s.id), { onChange: (ids) => { iv.symptoms = ids.map((sid) => iv.symptoms.find((s) => s.id === sid) || { id: sid, level: 5 }); drawSym(); saveV(); } }));
      };
      drawSymChips();
      return { title: '今日のおからだの調子', body: [
        v.copied ? h('div', { class: 'gnote' }, '前回うかがった内容が入っています。変わったところだけ直してください。') : null,
        q('今日、あてはまるものはありますか', 'あてはまるものを押してください（なければ、そのまま下へ）', chips(visitConds, v.conds, { onChange: (x) => { v.conds = x; saveV(); drawPreg(); } }), pregBox),
        q('つらいところ・気になること', 'あてはまるものを押して、つらさを 1（少し）〜 10（とても）でえらんでください',
          symChipBox, symBox)] };
    },
    m2: () => ({ title: '気になるところを、図に', wide: true, body: [h('section', { class: 'gcard' }, h('h2', null, '気になるところを、指でなぞってください'),
      h('p', { class: 'ghint' }, short ? `今日は「${scopeText(S.settings, v.scope)}」の施術です。下の図を押すと大きく開くので、色をえらんでから、なぞってください。` : '下の図を押すと大きく開くので、色をえらんでから、なぞってください。まちがえたら「↩ 戻す」か「消しゴム」で消せます。書けたら左上の「もどる（とじる）」。', h('b', null, '触れてほしくないところ'), 'は「触れないで（×）」をえらんでなぞってください。なければ、そのまま次へ。'),
      figureEditor({ figures: v.guestFigures, figs: figsOf(v.scope), layer: 'guest', marks: S.settings.marks, onSave: saveV, simple: true, markLabel: '色をえらぶ' }))] }),
    m3: () => { const iv = v.interview; return { title: '香りの好み・ご希望', body: [
      short ? null : q('今日の目的', 'あてはまるものを押してください', chips(S.settings.purposes, iv.purposes, { onChange: (x) => { iv.purposes = x; saveV(); } })),
      q('お肌の状態', null, chips(S.settings.skins, iv.skins || [], { onChange: (x) => { iv.skins = x; saveV(); } })),
      q('好きな香り', 'オイルをえらぶときの参考にします', group('香りの系統', chips(S.settings.families, iv.famLikes || [], { onChange: (x) => { iv.famLikes = x; saveV(); } })),
        short ? null : group('香りの好み・気分', chips(S.settings.moods, iv.moods, { onChange: (x) => { iv.moods = x; saveV(); } }))),
      q('伝えておきたいこと', '力かげん・気をつけてほしいこと・聞いておきたいこと など、なんでも', textarea(iv, 'wish', { rows: 3, onInput: saveV }))] }; },
    done: () => ({ title: '', done: true, body: [h('div', { class: 'gdone' }, h('div', { class: 'gcheck' }, '✓'), h('h1', null, 'ありがとうございました'),
      h('p', { class: 'gbig' }, backTo() + 'にお返しください。'), btn('スタッフ：合言葉を入れてもどる', unlock, 'primary big'))] }),
  };

  const finishUp = async () => { // 書き終わったしるしを残す
    const at = new Date().toISOString();
    if (has('profile')) { det.intakeAt = det.intakeAt || at; dirty.p = true; }
    // お客さんが書き終えた＝前半はお客さんの書いたもの。前に施術する人が直したしるしは消す（この時点の中身はお客さんが見て返したもの）
    if (has('monshin')) { v.intake = { by: 'guest', at }; v.staffEdits = {}; v.copied = false; dirty.v = true; }
    await flush(); await write();
  };
  async function show(n) {
    await flush(); await write();
    i = Math.max(0, Math.min(screens.length - 1, n)); g.step = i; await saveGuest();
    if (screens[i] === 'done') await finishUp();
    const sc = SCREEN[screens[i]](); const steps = screens.length - 2; // はじめと終わりは数えない
    const nextBtn = sc.custom || (sc.done ? null : btn(sc.next || (i === screens.length - 2 ? 'これで書きおわる' : 'つぎへ ›'), async () => {
      const err = sc.check && sc.check(); if (err) { toast(err); return; } show(i + 1); }, 'primary big grow gnext'));
    fill(root,
      h('header', { class: 'gbar' }, h('span', { class: 'gtag' }, 'お客さま用の画面'), sc.title ? h('h1', null, sc.title) : null,
        i > 0 && !sc.done ? h('div', { class: 'gprog', 'aria-label': `${i}／${steps}` }, h('span', null, `${i}／${steps}`), h('div', { class: 'gprogbar' }, h('i', { style: { width: `${Math.round((i / steps) * 100)}%` } }))) : null),
      h('main', { class: 'gmain' + (sc.wide ? ' wide' : '') }, sc.body),
      sc.done ? null : h('footer', { class: 'gfoot' }, i > 0 ? btn('‹ もどる', () => show(i - 1), 'big gprev') : null, nextBtn),
      sc.done ? null : staffLink());
    scrollTo(0, 0);
  }
  await show(i);
  return root;
}
