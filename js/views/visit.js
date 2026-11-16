import { h, fill, page, card, btn, badge, go, chips, field, group, input, textarea, toast, confirmDlg, sheet, isPhone, saveBadge } from '../ui.js';
import { closeNudge } from '../nudge.js';
import { S, saveSettings, person, visitsOf, saveVisit, deleteVisit, saveSoon, saveCustomer, saveMaster, recount, blankCustomer } from '../state.js';
import * as db from '../db.js';
import { jpDate, todayStr, addDays, blendCalc, limitFor, isFirstBlend, limitLevel, maxDrops, pickOils, pickCarriers, traitText, allergyHits, effectiveConds, noTouchAll } from '../logic.js';
import { figureEditor, hasLines } from '../figedit.js';
import { notFound, blendText, noTouchFigures } from './customer.js';
import { handoverSheet } from './guest.js';
import { scopePicker } from '../scopepick.js';
import { isPart, figsOf, scopeText, areaForScope, symsForScope } from '../parts.js';

// 来店の流れは2つに分かれる。前半（guest）＝お客さんから聞くこと／後半（staff）＝施術する人の記録
const STEPS = [['monshin', '問診', 'guest'], ['kininaru', '気になるところ', 'guest'],
  ['shoken', '所見', 'staff'], ['seiyu', 'オイル', 'staff'], ['blend', 'ブレンド', 'staff'], ['sejutsu', '施術', 'staff'], ['after', '施術後', 'staff']];
const PHASES = { guest: ['前半', 'お客さんから聞くこと'], staff: ['後半', '施術者の記録'] };
const fam = (id) => S.settings.families.find((f) => f.id === id) || { name: '', color: '#bbb' };
const symName = (id) => (S.settings.symptoms.find((c) => c.id === id) || {}).name || '（消した症状）';
const condName = (id) => (S.settings.conds.find((c) => c.id === id) || {}).name || '';
const skinName = (id) => (S.settings.skins.find((c) => c.id === id) || {}).name || '';
const fmt = (n) => (Math.round(n * 100) / 100).toString();

// つらさ（1〜10）をえらぶボタン。zero=true なら 0 から
function levelPicker(value, onPick, zero = false) {
  const wrap = h('div', { class: 'levels' + (zero ? ' zero' : ''), role: 'group' });
  for (let i = zero ? 0 : 1; i <= 10; i++) {
    const b = h('button', { type: 'button', class: 'lv' + (i === value ? ' on' : ''), style: { '--lv': i } }, String(i));
    b.onclick = () => { wrap.querySelectorAll('.lv').forEach((x) => x.classList.toggle('on', x === b)); onPick(i); };
    wrap.append(b);
  }
  return wrap;
}

export async function visitView(id, step) {
  const v = await db.get('visits', id); if (!v) return notFound();
  const p = person(v.customerId); if (!p) return notFound();
  const det = (await db.get('details', v.customerId)) || blankCustomer().det;
  const all = await visitsOf(v.customerId);
  const prev = all.find((x) => x.id !== v.id && (x.date + x.createdAt) < (v.date + v.createdAt));
  const nth = all.length - all.findIndex((x) => x.id === v.id);
  if (step === 'zu') step = 'shoken'; // 前の版のアドレス
  if (!STEPS.some((s) => s[0] === step)) step = 'monshin';
  v.guestFigures = v.guestFigures || { front: [], back: [] }; v.figures = v.figures || { front: [], back: [] }; v.scope = v.scope || { type: 'whole' };
  let showAll = false; // 部分のときの問診は短い版。「ぜんぶの項目を出す」で、いつもの問診に
  const idx = STEPS.findIndex((s) => s[0] === step);
  const save = () => saveSoon(() => saveVisit(v));
  const eff = () => effectiveConds({ settings: S.settings, det, visit: v });
  const condIds = () => eff().ids;
  const body = h('div', { class: 'step' });
  const redraw = () => fill(body, ...[].concat(RENDER[step]()));
  const picks = () => { const e = eff(); return pickOils({ oils: S.oils, cats: S.cats, symptoms: v.interview.symptoms, condIds: e.ids, autoConds: e.auto, avoidOilIds: det.avoidOilIds, allergyTags: det.allergyTags, allergyText: det.allergy, settings: S.settings }); };
  const carPicks = () => pickCarriers({ carriers: S.carriers, skins: v.interview.skins || [], purposes: v.interview.purposes, condIds: condIds(), allergyTags: det.allergyTags, allergyText: det.allergy, avoidIds: det.avoidCarrierIds, settings: S.settings });
  const allergyNames = () => { const hit = allergyHits(S.settings.allergens, det.allergyTags, det.allergy); return S.settings.allergens.filter((a) => hit[a.id]).map((a) => a.name); };
  const hasOil = (oid) => v.blend.oils.some((o) => o.oilId === oid);
  const hasCar = (cid) => v.blend.carriers.some((c) => c.carrierId === cid);
  const toggleCar = (c) => {
    if (hasCar(c.id)) v.blend.carriers = v.blend.carriers.filter((x) => x.carrierId !== c.id);
    else v.blend.carriers.push({ carrierId: c.id, name: c.name, ml: v.blend.carriers.length ? 0 : 30 });
    save();
  };
  const toggleOil = (oil) => {
    if (hasOil(oil.id)) v.blend.oils = v.blend.oils.filter((o) => o.oilId !== oil.id);
    else v.blend.oils.push({ oilId: oil.id, name: oil.name, drops: 1 });
    save();
  };

  const RENDER = {
    // ---------- 問診 ----------
    monshin() {
      const iv = v.interview; const visitConds = S.settings.conds.filter((c) => c.when === 'visit');
      const symBox = h('div', { class: 'symlist' });
      // 妊娠中のときだけ「いま何か月？」を出す（精油の候補で、時期ごとの注意に使う）
      const pregBox = h('div');
      const drawPreg = () => fill(pregBox, v.conds.includes('c_preg') ? group('妊娠の月数', chips([...Array(10)].map((_, i) => ({ id: i + 1, name: `${i + 1}か月` })), v.pregMonth || '', { multi: false, onChange: (m) => { v.pregMonth = m || null; save(); } }),
        '精油の候補で、時期ごとの注意（初期・中期まで など）に使います。えらばないと、どの時期にもあてはまるとして見ます') : null);
      drawPreg();
      const condHint = () => { const e = eff(); const autoNames = Object.keys(e.auto).filter((id) => !id.startsWith('c_preg_')).map((id) => `${condName(id)}（${e.auto[id]}）`);
        return [det.conds.length ? `いつもの状態：${det.conds.map(condName).join('・')}` : '', autoNames.length ? `自動で：${autoNames.join('・')}` : ''].filter(Boolean).join('　') || null; };
      const drawSym = () => fill(symBox, ...iv.symptoms.map((s) => h('div', { class: 'symrow' },
        h('div', { class: 'symname' }, symName(s.id)), levelPicker(s.level, (n) => { s.level = n; save(); }))));
      drawSym();
      const part = isPart(v.scope), short = part && !showAll;
      // 部分のときは、その部位に関わる「つらいところ」だけ先に出す（えらんであるものは、いつも出す）
      const rel = symsForScope(S.settings, v.scope); let moreSym = false;
      const symChipBox = h('div');
      const drawSymChips = () => {
        const list = short && !moreSym ? S.settings.symptoms.filter((s) => rel.includes(s.id) || iv.symptoms.some((x) => x.id === s.id)) : S.settings.symptoms;
        fill(symChipBox, chips(list, iv.symptoms.map((s) => s.id), {
          onChange: (ids) => { iv.symptoms = ids.map((sid) => iv.symptoms.find((s) => s.id === sid) || { id: sid, level: 5 }); drawSym(); save(); },
        }), short && !moreSym && list.length < S.settings.symptoms.length ? btn(`ほかのつらいところも出す（あと ${S.settings.symptoms.length - list.length}）`, () => { moreSym = true; drawSymChips(); }, 'chip ghostchip moresym') : null);
      };
      drawSymChips();
      // 気をつける状態・アレルギーの確認は、短い版でも省かない
      const al = allergyNames(); const always = det.conds.map(condName).filter(Boolean);
      const checkBox = h('div', { class: 'checkbox ' + (al.length || det.allergy || always.length ? 'has' : '') },
        h('b', null, '施術の前に確かめること'),
        h('div', null, 'アレルギー：', [...al, det.allergy].filter(Boolean).join('／') || '登録なし', '　／　いつものからだの状態：', always.join('・') || '登録なし'),
        h('div', { class: 'small' }, '変わりがないか、ひとこと聞いてね。変わっていたら ', h('a', { href: `#/c/${p.id}/edit` }, 'お客さんの情報を直す ›')));
      return [
        card(h('h2', null, '今日のメニューと、施術するところ'), scopePicker(v, (changed) => {
          if (changed) { const a = areaForScope(S.settings, v.scope); if (a) v.blend.areaId = a; showAll = false; }
          save(); if (changed) redraw();
        })),
        v.copied && prev && !(v.intake && v.intake.by === 'guest') ? h('div', { class: 'notice ok' }, `前回（${jpDate(prev.date)}）の問診が入っています。変わったところだけ直してね。`) : null,
        card(h('div', { class: 'row' }, field('来店日', input(v, 'date', { type: 'date', onInput: () => { save(); } })), h('span', { class: 'muted' }, `${nth}回目`)),
          group('今日の状態', chips(visitConds, v.conds, { onChange: (x) => { v.conds = x; save(); drawPreg(); } }), condHint()), pregBox, checkBox),
        card(h('h2', null, 'つらいところ'), h('p', { class: 'hint' }, short ? `${scopeText(S.settings, v.scope)}の施術に関わるものを先に出しています。あてはまるものを押して、つらさを 1（少し）〜10（とても）でえらびます` : 'あてはまるものを押して、つらさを 1（少し）〜10（とても）でえらびます'),
          symChipBox, symBox),
        card(group('肌の状態', chips(S.settings.skins, iv.skins || [], { onChange: (x) => { iv.skins = x; save(); } }),
          det.conds.includes('c_skin') ? 'キャリアオイルの候補に使います。この方は「お客さんの情報」で敏感肌になっているので、ここでえらばなくても敏感肌として見ます。アレルギーは「お客さんの情報」でえらびます' : 'キャリアオイルの候補に使います。敏感肌は、今日だけならここ、いつもなら「お客さんの情報」でえらびます（どちらでも同じに扱います）。アレルギーは「お客さんの情報」でえらびます'),
          short ? null : group('今日の目的', chips(S.settings.purposes, iv.purposes, { onChange: (x) => { iv.purposes = x; save(); } })),
          group('好きな香りの系統', chips(S.settings.families, iv.famLikes || [], { onChange: (x) => { iv.famLikes = x; save(); } }), '精油の候補の画面で、はじめにこの系統でしぼります'),
          short ? null : group('香りの好み・気分', chips(S.settings.moods, iv.moods, { onChange: (x) => { iv.moods = x; save(); } })),
          short ? null : field('くらしのようす（睡眠・食事・仕事など）', textarea(iv, 'life', { onInput: () => { save(); } })),
          field('お客さんから伝えたいこと・気をつけてほしいこと', textarea(iv, 'wish', { onInput: () => { save(); }, rows: 2 })),
          field('今日のメモ（施術する人用）', textarea(iv, 'memo', { onInput: save, rows: 2 }))),
        part ? h('div', { class: 'notice shortnote' }, h('span', { class: 'grow' }, short ? '部分の施術なので、問診を短くしています（今日の目的・香りの気分・くらしのようす は出していません）。' : 'いつもの問診（ぜんぶの項目）を出しています。'),
          btn(short ? 'ぜんぶの項目を出す' : '短い問診にもどす', () => { showAll = !showAll; redraw(); }, 'chip')) : null,
      ];
    },
    // ---------- 気になるところ（お客さんの所見） ----------
    // お客さんが自分でなぞっても、施術する人が聞きながらなぞっても、ここは「お客さんの所見」（11/16 がっき〜：だれが書いたかは細かく分けない）。
    // まちがえた線・しるしは、だれでも消しゴム・ひとつ戻すで消せる
    kininaru() {
      return figureEditor({ figures: v.guestFigures, figs: figsOf(v.scope), layer: 'guest', marks: S.settings.marks, onSave: save, markLabel: 'どんなふうに気になる？（色）',
        openLabel: '✎ 押すと画面いっぱいで書けます（お客さんの所見）',
        hints: ['お客さんの所見：お客さんが気になるところ・つらいところ。お客さんに書いてもらっても、聞きながら施術する人がなぞっても、ここに書きます。',
          'お客さんの線は「つぶつぶ」で出ます（施術者の所見は、ぬった線）。まちがえた線は「消しゴム」か「ひとつ戻す」で消せます。「触れないで（×）」は、次の来店にも写ります。'] });
    },
    // ---------- 所見（施術する人の図） ----------
    shoken() {
      return figureEditor({ figures: v.figures, figs: figsOf(v.scope), layer: 'staff', marks: S.settings.marks, onSave: save,
        reflex: { get: () => (S.settings.reflex = S.settings.reflex || { show: false, zones: [] }), save: saveSettings },
        under: { figures: v.guestFigures, layer: 'guest', label: 'お客さんの図も重ねる' },
        openLabel: '✎ 押すと画面いっぱいで書けます（施術者の所見）',
        hints: ['施術者の所見：さわって・見て分かったことを、施術する人がなぞります（ぬった線）。' + (hasLines(v.guestFigures) ? 'お客さんの所見（気になるところ）は、つぶつぶの線で下に重ねて出しています（「お客さんの図も重ねる」で出す・かくす）。' : ''),
          '「ひとつ戻す」＝直前にしたこと（かいた・消した）を1つ取り消す。「消しゴム」＝前にかいた線でも、さわった線だけ消す。「触れないで（×）」は施術する人も足せて、次の来店にも写ります。'] });
    },
    // ---------- オイルの候補（精油・キャリアオイル） ----------
    seiyu() {
      let tab = 'oil', famSel = [...(v.interview.famLikes || [])].filter((id) => S.settings.families.some((f) => f.id === id)), ownedOnly = false;
      const listBox = h('div'); const headBox = h('div', { class: 'step' });
      // 精油とキャリアオイルで同じ形のカードを使う。kind：hit 候補／buy 次に買う／out 外した／rest そのほか
      const itemCard = (r, kind) => {
        const isOil = tab === 'oil'; const it = r.oil; const f = isOil ? fam(it.family) : null; const on = isOil ? hasOil(it.id) : hasCar(it.id);
        const own = h('button', { type: 'button', class: 'mini' + (it.owned ? ' on' : '') }, it.owned ? '✓ 手持ち' : '手持ちにする');
        own.onclick = async () => { it.owned = !it.owned; await saveMaster(isOil ? 'oils' : 'carriers', it); draw(); };
        const use = btn(on ? '✓ 使う' : kind === 'out' ? 'それでも使う' : '使う', async () => {
          if (!on && kind === 'out' && !(await confirmDlg(`${it.name} は、次の理由で外してあります。\n\n・${r.blocks.join('\n・')}\n\nそれでも使いますか？（決めるのは施術する人です）`, '使う', true))) return;
          isOil ? toggleOil(it) : toggleCar(it); draw();
        }, on ? 'primary' : kind === 'out' ? 'ghost' : '');
        // キャリアオイルは、特徴と成分（割合が資料にないものは名前だけ）
        const traits = isOil ? [] : [...traitText(it), ...Object.entries(it.fatty || {}).map(([fid, n]) => { const f = (S.settings.fats || []).find((x) => x.id === fid); return f ? f.name + (typeof n === 'number' ? ` 約${n}％` : '') : ''; }).filter(Boolean)];
        return h('div', { class: 'oil ' + kind + (on ? ' picked' : ''), style: { '--fam': f ? f.color : '#c9b98f' } },
          h('div', { class: 'grow' },
            h('div', { class: 'name' }, it.name, ' ', f && f.name ? h('span', { class: 'famtag' }, f.name) : null, it.ref === false ? badge('資料にない', 'amber') : it.draft ? badge('下書き', 'draft') : null),
            traits.length ? h('div', { class: 'traits' }, traits.map((t) => h('span', { class: 'trait' }, t))) : null,
            r.blocks.length ? h('ul', { class: 'why out' }, r.blocks.map((t) => h('li', null, '外した理由：' + t))) : null,
            (r.warns || []).length ? h('ul', { class: 'why warn' }, r.warns.map((t) => h('li', null, '⚠ ' + t))) : null,
            r.reasons.length ? h('ul', { class: 'why' }, r.reasons.slice(0, 3).map((t) => h('li', null, t))) : null,
            r.reasons.length > 3 ? h('details', { class: 'more' }, h('summary', null, `ほかの理由（${r.reasons.length - 3}）`), h('ul', { class: 'why' }, r.reasons.slice(3).map((t) => h('li', null, t)))) : null,
            it.ref === false ? h('div', { class: 'muted small' }, `はじめの資料にない${isOil ? '精油' : 'オイル'}なので、候補の点数には入れていません（気をつける点は見ています）。`) : null,
            it.note ? h('div', { class: 'muted small' }, it.note) : null),
          h('div', { class: 'oil-act' }, use, own));
      };
      const draw = () => {
        const isOil = tab === 'oil'; const word = isOil ? '精油' : 'キャリアオイル';
        const rs = isOil ? picks().filter((r) => !famSel.length || famSel.includes(r.oil.family)) : carPicks();
        const ok = rs.filter((r) => !r.blocks.length), out = rs.filter((r) => r.blocks.length);
        const hit = ok.filter((r) => r.score > 0), rest = ok.filter((r) => r.score <= 0);
        const asked = isOil ? v.interview.symptoms.length > 0 : (v.interview.skins || []).length > 0 || v.interview.purposes.length > 0;
        const sec = (title, arr, kind, hint, fold) => !arr.length ? null
          : h(fold ? 'details' : 'div', { class: 'sec' + (fold ? ' fold' : '') }, h(fold ? 'summary' : 'h3', null, `${title}（${arr.length}）`), hint ? h('p', { class: 'hint' }, hint) : null, arr.map((r) => itemCard(r, kind)));
        fill(listBox, ...[
          asked ? null : h('div', { class: 'notice amber' }, isOil ? '問診で「つらいところ」をえらぶと、合いそうな精油が上に出ます。' : '問診で「肌の状態」や「今日の目的」をえらぶと、合いそうなキャリアオイルが上に出ます。'),
          sec('候補（手持ちの中から）', hit.filter((r) => r.oil.owned), 'hit'),
          hit.length && !hit.some((r) => r.oil.owned) ? h('div', { class: 'notice' }, `手持ちの${word}の中には候補がありません。持っているものに「手持ちにする」を押してね（設定 → ${word}の一覧 でもまとめてできます）。`) : null,
          ownedOnly ? null : sec('次に買う候補（持っていないけれど合いそう）', hit.filter((r) => !r.oil.owned), 'buy'),
          sec('理由があって外したもの', out.filter((r) => !ownedOnly || r.oil.owned), 'out', '消さずに見せています。最後に決めるのは施術する人です。'),
          sec(`そのほかの${word}`, rest.filter((r) => !ownedOnly || r.oil.owned), 'rest', null, asked),
        ].filter(Boolean));
        chosen.textContent = [v.blend.oils.length ? `精油：${v.blend.oils.map((o) => o.name).join('、')}` : '精油はまだ', v.blend.carriers.length ? `キャリアオイル：${v.blend.carriers.map((o) => o.name).join('、')}` : 'キャリアオイルはまだ'].join('　／　');
      };
      const chosen = h('div', { class: 'chosen' });
      const e0 = eff(); const conds = e0.ids; const effAuto = e0.auto; const iv = v.interview;
      const drawHead = () => {
        const isOil = tab === 'oil'; const al = allergyNames();
        fill(headBox,
          h('div', { class: 'tabs' }, [['oil', '精油'], ['car', 'キャリアオイル']].map(([id, name]) => h('button', { type: 'button', class: 'tab' + (tab === id ? ' on' : ''), onclick: () => { tab = id; drawHead(); draw(); } }, name))),
          h('div', { class: 'notice draft' }, isOil ? '精油のデータは、アロマテラピーを学んだときの資料をもとに入れたものです。作用は「こんな働きがあると言われる」という分け方で、効くという意味ではありません。候補は目安で、最後に決めるのは施術する人です。' : 'キャリアオイルのデータは、アロマテラピーを学んだときの資料をもとに入れたものです（下書き）。アレルギー体質・敏感肌・はじめて使う人は、腕の内側に1〜2滴ぬって赤くならないか確かめる（パッチテスト）と資料に。候補は目安で、最後に決めるのは施術する人です。'),
          card(h('div', { class: 'facts' },
            isOil ? h('div', null, h('b', null, 'つらいところ：'), iv.symptoms.map((s) => `${symName(s.id)}（${s.level}）`).join('、') || 'なし')
              : [h('div', null, h('b', null, '肌の状態：'), (iv.skins || []).map(skinName).filter(Boolean).join('・') || 'えらんでいません'),
                h('div', null, h('b', null, '今日の目的：'), iv.purposes.join('・') || 'えらんでいません')],
            h('div', null, h('b', null, '気をつける状態：'), conds.filter((c) => !(c.startsWith('c_preg_') && effAuto[c])).map((c) => condName(c) + (effAuto[c] ? `（自動：${effAuto[c]}）` : '')).join('・') || 'なし'),
            isOil && conds.includes('c_preg') && !v.pregMonth ? h('div', { class: 'small warntext' }, '妊娠の月数が入っていないので、初期〜後期のどの時期の注意も見ています（問診で月数をえらぶと、時期に合わせます）') : null,
            !isOil || det.allergy ? h('div', null, h('b', null, 'アレルギー：'), [...al, det.allergy].filter(Boolean).join('／') || 'なし') : null,
            isOil && iv.moods.length ? h('div', null, h('b', null, '香りの好み：'), iv.moods.join('・')) : null),
          isOil ? group('香りの系統でしぼる', chips(S.settings.families, famSel, { onChange: (x) => { famSel = x; draw(); } })) : null,
          chips([{ id: 'own', name: '手持ちだけ見る' }], ownedOnly ? ['own'] : [], { onChange: (x) => { ownedOnly = x.length > 0; draw(); } })));
      };
      drawHead(); draw();
      return [headBox, listBox, chosen];
    },
    // ---------- ブレンド ----------
    blend() {
      const b = v.blend; const dropMl = S.settings.dropMl || 0.05;
      const meter = h('div', { class: 'meter' }); const oilBox = h('div'); const carBox = h('div');
      const pk = picks(); const blockOf = Object.fromEntries(pk.filter((r) => r.blocks.length).map((r) => [r.oil.id, r.blocks]));
      const warnOf = Object.fromEntries(pk.filter((r) => r.warns.length).map((r) => [r.oil.id, r.warns]));
      const carBlockOf = Object.fromEntries(carPicks().filter((r) => r.blocks.length).map((r) => [r.oil.id, r.blocks]));
      // はじめての人の目安（低いほう）に1タップで切りかえる。来店が1回目なら、はじめから「はじめての人」で見る（blend.first に、切りかえたことを残す）
      const firstBtn = (lim) => {
        const area = lim.area; if (!area || area.firstMax == null) return null;
        const on = isFirstBlend(b, nth);
        return h('div', { class: 'firstbox' }, btn(on ? `✓ はじめての人の目安（${area.firstMax}％）` : `はじめての人の目安（${area.firstMax}％）にする`, () => { b.first = !on; drawMeter(); save(); }, 'chip firstsel' + (on ? ' on' : '')),
          h('div', { class: 'small muted' }, on ? (typeof b.first === 'boolean' ? '施術する人が切りかえました。もう一度押すと、ふつうの目安に戻ります' : '1回目の来店なので、はじめての人の目安で見ています。押すと、ふつうの目安に') : `ふつうの目安（${area.name} ${area.max != null ? area.max + '％' : '目安なし'}）で見ています`));
      };
      const drawMeter = () => {
        const c = blendCalc(b, dropMl); const lim = limitFor(S.settings, b.areaId, condIds(), { first: isFirstBlend(b, nth) }); const lv = limitLevel(c.pct, lim.max);
        const md = maxDrops(lim.max, c.carrierMl, dropMl);
        meter.className = 'meter ' + lv;
        fill(meter, 
          h('div', { class: 'pct' }, c.pct == null ? '—' : c.pct.toFixed(1), h('small', null, '％')),
          h('div', { class: 'grow' },
            h('div', { class: 'meter-msg' }, lv === 'over' ? '⚠ 目安をこえています' : lv === 'near' ? '目安のぎりぎりです' : lv === 'ok' ? '目安の中です' : lv === 'unknown' ? 'この部位の目安はまだ入っていません' : 'キャリアオイルの量を入れると濃度が出ます'),
            h('div', { class: 'muted' }, `キャリアオイル ${fmt(c.carrierMl)}ml に、精油 ${c.drops}滴（約${fmt(c.oilMl)}ml）`),
            h('div', { class: 'muted' }, lim.max != null ? `目安：${lim.parts.map((x) => `${x.name || x.label} ${x.max}％まで`).join('・')}${md != null ? `　→ この量なら ${md}滴まで` : ''}` : h('a', { href: '#/set/limits' }, '目安を設定する ›'))),
          firstBtn(lim));
      };
      const stepper = (obj, key, stepBy, min, unit, after) => {
        const val = h('span', { class: 'val' }, `${fmt(obj[key])}${unit}`);
        const set = (n) => { obj[key] = Math.max(min, Math.round(n * 10) / 10); val.textContent = `${fmt(obj[key])}${unit}`; drawMeter(); save(); after && after(); };
        return h('div', { class: 'stepper' }, btn('−', () => set(obj[key] - stepBy), 'round'), val, btn('＋', () => set(obj[key] + stepBy), 'round'));
      };
      const drawOils = () => fill(oilBox, ...b.oils.map((o) => {
        const oil = S.oils.find((x) => x.id === o.oilId);
        return h('div', { class: 'brow', style: { '--fam': fam(oil && oil.family).color } },
          h('div', { class: 'grow' }, h('div', { class: 'name' }, o.name), blockOf[o.oilId] ? h('div', { class: 'small warntext' }, '⚠ ' + blockOf[o.oilId].join('／')) : null, warnOf[o.oilId] ? h('div', { class: 'small muted' }, '⚠ ' + warnOf[o.oilId].join('／')) : null),
          stepper(o, 'drops', 1, 0, '滴'),
          btn('×', () => { b.oils = b.oils.filter((x) => x !== o); drawOils(); drawMeter(); save(); }, 'ghost round'));
      }), b.oils.length ? null : h('p', { class: 'muted' }, 'まだ精油がありません。「オイル」の画面でえらぶか、下のボタンで足してね。'));
      const drawCars = () => fill(carBox, ...b.carriers.map((c) => h('div', { class: 'brow car' },
        h('div', { class: 'grow' }, h('div', { class: 'name' }, c.name),
          carBlockOf[c.carrierId] ? h('div', { class: 'small warntext' }, '⚠ ' + carBlockOf[c.carrierId].join('／')) : null,
          h('div', { class: 'chips tight' }, [5, 10, 15, 20, 30, 50].map((ml) => btn(`${ml}ml`, () => { c.ml = ml; drawCars(); drawMeter(); save(); }, 'chip sm' + (c.ml === ml ? ' on' : ''))))),
        stepper(c, 'ml', 5, 0, 'ml', drawCars),
        btn('×', () => { b.carriers = b.carriers.filter((x) => x !== c); drawCars(); drawMeter(); save(); }, 'ghost round'))),
      b.carriers.length ? null : h('p', { class: 'muted' }, 'キャリアオイルをえらんで、量を入れてね。'));
      const refresh = () => { drawOils(); drawCars(); drawMeter(); fill(areaBox, areaChips()); };
      const addOil = () => {
        const s = sheet('精油を足す', h('div', null, S.settings.families.map((f) => {
          const os = S.oils.filter((o) => o.family === f.id); if (!os.length) return null;
          return h('div', { class: 'field' }, h('span', { class: 'label' }, h('span', { class: 'dot', style: { background: f.color } }), f.name),
            h('div', { class: 'chips' }, os.map((o) => btn((blockOf[o.id] ? '⚠ ' : '') + o.name + (o.owned ? '' : '（持っていない）'), async () => {
              if (blockOf[o.id] && !(await confirmDlg(`${o.name} は気をつける点があります。\n\n・${blockOf[o.id].join('\n・')}\n\nそれでも使いますか？`, '使う', true))) return;
              if (!hasOil(o.id)) { b.oils.push({ oilId: o.id, name: o.name, drops: 1 }); save(); } s.close(); refresh();
            }, 'chip' + (hasOil(o.id) ? ' on' : '')))));
        })), { wide: true });
      };
      const addCarrier = () => {
        const list = [...S.carriers].sort((x, y) => (y.owned ? 1 : 0) - (x.owned ? 1 : 0));
        const s = sheet('キャリアオイルをえらぶ', h('div', { class: 'chips' }, list.map((c) => btn((carBlockOf[c.id] ? '⚠ ' : '') + c.name + (c.owned ? '' : '（持っていない）'), async () => {
          if (carBlockOf[c.id] && !hasCar(c.id) && !(await confirmDlg(`${c.name} は気をつける点があります。\n\n・${carBlockOf[c.id].join('\n・')}\n\nそれでも使いますか？`, '使う', true))) return;
          if (!hasCar(c.id)) { b.carriers.push({ carrierId: c.id, name: c.name, ml: b.carriers.length ? 0 : 30 }); save(); } s.close(); refresh();
        }, 'chip' + (hasCar(c.id) ? ' on' : '')))));
      };
      const copyFrom = (src, label) => { b.oils = JSON.parse(JSON.stringify(src.oils)); b.carriers = JSON.parse(JSON.stringify(src.carriers)); if (src.areaId) b.areaId = src.areaId; save(); refresh(); toast(label); };
      const prevBlend = all.find((x) => x.id !== v.id && (x.date + x.createdAt) < (v.date + v.createdAt) && x.blend.oils.length);
      const pickSaved = () => {
        const s = sheet('よく使うブレンド', S.blends.length ? h('div', { class: 'list' }, S.blends.map((sb) => h('button', { type: 'button', class: 'row-link', onclick: () => { copyFrom(sb, `「${sb.name}」を入れました`); s.close(); } },
          h('div', { class: 'grow' }, h('div', { class: 'name' }, sb.name), h('div', { class: 'muted' }, blendText(sb)))))) : h('p', { class: 'muted' }, 'まだありません。ブレンドを作って「名前をつけて残す」を押すと、ここに出ます。'));
      };
      const keep = () => {
        const o = { name: '' }; const inp = input(o, 'name', { placeholder: '例：肩こり用・夜のリラックス' });
        const s = sheet('このブレンドに名前をつけて残す', h('div', null, field('名前', inp), btn('残す', async () => {
          if (!o.name.trim()) { toast('名前を入れてね'); return; }
          await saveMaster('blends', { id: db.uid(), name: o.name.trim(), areaId: b.areaId, oils: JSON.parse(JSON.stringify(b.oils)), carriers: JSON.parse(JSON.stringify(b.carriers)) });
          s.close(); toast('残しました');
        }, 'primary wide')));
      };
      const areaBox = h('div');
      const areaChips = () => chips(S.settings.areas.map((a) => ({ id: a.id, name: a.name + (a.max != null ? `（${a.max}％まで）` : '（目安なし）') })), b.areaId, { multi: false, onChange: (x) => { if (x) b.areaId = x; drawMeter(); save(); } });
      refresh();
      return [
        h('div', { class: 'sticky' }, meter),
        card(group('どこに使う？', areaBox, [isPart(v.scope) ? `今日は「${scopeText(S.settings, v.scope)}」の施術なので、部位に合わせた目安をえらんであります（設定 → 部位 で変えられます）。` : '', S.settings.areas.some((a) => a.draft) ? '「下書き」の目安が入っています。自分の資料で確かめて、設定で直してね。' : '', 'はじめての人は、上の「はじめての人の目安」で見られます（1回目の来店は、はじめからそちら）。敏感肌の人も、目安よりうすめに（資料のメモ。数字は書いていない）。'].filter(Boolean).join('　') || null)),
        card(h('h2', null, 'キャリアオイル'), carBox, h('div', { class: 'row' }, btn('＋ キャリアオイルをえらぶ', addCarrier))),
        card(h('h2', null, '精油'), oilBox, h('div', { class: 'row' }, btn('＋ 精油を足す', addOil)),
          h('p', { class: 'hint' }, `濃度は「精油の量 ÷ キャリアオイルの量」で出しています（1滴＝${fmt(dropMl)}ml。設定で変えられます）。`)),
        card(h('div', { class: 'row' },
          prevBlend ? btn(`前回のブレンドを写す（${jpDate(prevBlend.date, false)}）`, () => copyFrom(prevBlend.blend, '前回のブレンドを入れました')) : null,
          btn('よく使うブレンドから', pickSaved), btn('名前をつけて残す', keep)),
          field('ブレンドのメモ', textarea(b, 'memo', { onInput: save, rows: 2 }))),
      ];
    },
    // ---------- 施術 ----------
    sejutsu() {
      const box = h('div', { class: 'chips' });
      const draw = () => fill(box, ...S.menus.map((m) => {
        const on = v.menus.some((x) => x.id === m.id);
        return btn(`${m.name}${m.minutes ? ` ${m.minutes}分` : ''}`, () => {
          v.menus = on ? v.menus.filter((x) => x.id !== m.id) : [...v.menus, { id: m.id, name: m.name, minutes: m.minutes }]; draw(); save();
        }, 'chip' + (on ? ' on' : ''));
      }), ...v.menus.filter((x) => !S.menus.some((m) => m.id === x.id)).map((x) => btn(`${x.name}（前のメニュー）×`, () => { v.menus = v.menus.filter((y) => y !== x); draw(); save(); }, 'chip on')));
      draw();
      const nt = noTouchAll(v, S.settings.marks);
      return [
        Object.keys(nt).length ? h('div', { class: 'warnbox' }, h('strong', null, '✕ 触れないでほしいところがあります'), noTouchFigures(nt)) : null,
        card(h('h2', null, '施術メニュー'), box, h('p', { class: 'hint' }, 'いくつでもえらべます。メニューは 設定 → 施術メニュー で作れます。'),
          h('p', null, h('b', null, '施術するところ：'), scopeText(S.settings, v.scope), '　', h('a', { href: `#/v/${id}/monshin` }, '問診の画面で変える ›'))),
        card(field('整体でしたこと', textarea(v.treat, 'seitai', { onInput: save, rows: 4, placeholder: '例：首〜肩まわりをゆるめた。右の腰がかたい' })),
          field('アロマでしたこと', textarea(v.treat, 'aroma', { onInput: save, rows: 4, placeholder: '例：背中と脚を中心に。圧は弱め' })),
          blendText(v.blend) ? h('p', { class: 'muted' }, '使ったブレンド：' + blendText(v.blend)) : null),
      ];
    },
    // ---------- 施術後 ----------
    after() {
      const a = v.after; const nextIn = h('input', { type: 'date', class: 'input', value: v.nextDate, 'aria-label': '次回の予定日' });
      const timeIn = h('input', { type: 'time', class: 'input timein', value: p.nextTime || '', step: 300, 'aria-label': '次回の予定の時間' });
      const setNext = (d) => { v.nextDate = d; nextIn.value = d; p.nextDate = d; if (!d) { p.nextTime = ''; timeIn.value = ''; } saveSoon(async () => { await saveVisit(v); await saveCustomer(p, null); }); };
      nextIn.onchange = () => setNext(nextIn.value);
      timeIn.onchange = () => { p.nextTime = timeIn.value; saveSoon(async () => { await saveVisit(v); await saveCustomer(p, null); }); };
      return [
        h('div', { class: 'notice' }, '施術のあとに、お客さんから感想を聞いて、施術する人が書きます。'),
        card(h('h2', null, 'つらさの変化'), h('p', { class: 'hint' }, 'お客さんに聞いた、施術のあとのつらさをえらびます（0＝なくなった）'),
          v.interview.symptoms.length ? v.interview.symptoms.map((s) => h('div', { class: 'symrow' },
            h('div', { class: 'symname' }, symName(s.id), h('span', { class: 'muted' }, `　前 ${s.level}`)),
            levelPicker(a.levels[s.id], (n) => { a.levels[s.id] = n; save(); }, true))) : h('p', { class: 'muted' }, '問診で「つらいところ」をえらぶと、ここで変化を残せます。')),
        card(group('香りの感想（お客さんに聞いて）', chips(S.settings.scents, a.scent, { multi: false, onChange: (x) => { a.scent = x; save(); } })),
          field('施術後のようす・伝えたこと', textarea(a, 'note', { onInput: save, rows: 3 }))),
        card(h('h2', null, '次回の予定日'), h('p', { class: 'hint' }, '入れると、ホームの「予定」に並びます。時間は入れなくてもだいじょうぶ。'), h('div', { class: 'row' }, nextIn, timeIn,
          btn('1週間後', () => setNext(addDays(v.date, 7))), btn('2週間後', () => setNext(addDays(v.date, 14))), btn('1か月後', () => setNext(addDays(v.date, 28))), btn('なし', () => setNext(''), 'ghost'))),
        h('div', { class: 'row end' }, btn('この来店の記録を消す', async () => {
          if (await confirmDlg('この来店の記録を消します。元に戻せません。', '消す', true)) { saveSoon(null); await deleteVisit(v); toast('消しました'); go(`#/c/${p.id}`); }
        }, 'danger ghost')),
      ];
    },
  };
  redraw();

  const finish = async () => {
    v.status = 'done'; v.copied = false; saveSoon(null); await saveVisit(v); await recount(p.id);
    toast('カルテをとじました（保存済み）');
    closeNudge(() => go(`#/c/${p.id}`)); // 7日以上バックアップしていなければ「バックアップしますか？」
  };
  const phase = STEPS[idx][2];
  const stepBtn = ([k, name], i) => h('a', { class: 'stepbtn' + (k === step ? ' on' : ''), href: `#/v/${id}/${k}` }, h('span', { class: 'num' }, String(i + 1)), name);
  const nav = h('nav', { class: 'steps' }, Object.keys(PHASES).map((ph) => h('div', { class: 'stepgroup ' + ph + (ph === phase ? ' now' : '') },
    h('div', { class: 'glabel' }, h('b', null, PHASES[ph][0]), ph === 'guest' ? 'お客さん' : '施術者'),
    STEPS.map((s, i) => (s[2] === ph ? stepBtn(s, i) : null)))));
  // いまどちらの番かを、色のついた帯でいつも見せる。前半には「お客さんに渡す」を置く
  const inGuest = v.intake && v.intake.by === 'guest';
  const phaseBar = phase === 'guest'
    ? h('div', { class: 'phasebar guest' }, h('div', { class: 'grow' }, h('b', null, '前半｜お客さんから聞くこと'),
        h('div', { class: 'small' }, inGuest ? `✓ お客さんに書いてもらいました（${jpDate(v.intake.at.slice(0, 10), false)}）。目を通して、足りないところを聞いてね（施術する人も直せます）` : '聞きながら書くか、端末を渡してお客さんに書いてもらいます（どちらで書いても「お客さんから聞いたこと」として残ります）')),
      btn(inGuest ? 'もう一度お客さんに渡す' : 'お客さんに渡して書いてもらう', () => handoverSheet(p, det, v), inGuest ? '' : 'primary'))
    : h('div', { class: 'phasebar staff' }, h('div', { class: 'grow' }, h('b', null, '後半｜施術者の記録'), h('div', { class: 'small' }, 'ここからは施術する人が書きます（お客さんに渡す画面には出ません）')));
  const warn = effectiveConds({ settings: S.settings, det, visit: v }).ids.filter((c) => !c.startsWith('c_preg_')).map(condName).filter(Boolean);
  if (Object.keys(noTouchAll(v, S.settings.marks)).length) warn.push('触れないでほしいところあり');
  const hasAllergy = !!det.allergy || (det.allergyTags || []).length > 0; const hasWarn = warn.length > 0 || hasAllergy;
  const nextLabel = idx < STEPS.length - 1 ? (STEPS[idx + 1][2] !== phase ? `後半へ：${STEPS[idx + 1][1]} ›` : `次へ：${STEPS[idx + 1][1]} ›`) : '';
  return page({
    cls: 'visit phase-' + phase + (hasWarn ? ' haswarn' : ''), title: p.name, sub: `${jpDate(v.date)}・${nth}回目${isPart(v.scope) ? '・' + scopeText(S.settings, v.scope) : ''}${v.status === 'draft' ? '（書きかけ）' : ''}`, badgeEl: saveBadge(), back: `#/c/${p.id}`,
    body: [hasWarn ? h('div', { class: 'visit-warn' }, '⚠ ' + [...new Set(warn), hasAllergy ? 'アレルギーあり' : ''].filter(Boolean).join('・')) : null, nav, phaseBar, body],
    footer: [
      idx > 0 ? h('a', { class: 'btn big', href: `#/v/${id}/${STEPS[idx - 1][0]}` }, '‹ 前へ') : h('span'),
      idx < STEPS.length - 1 ? h('a', { class: 'btn primary big grow', href: `#/v/${id}/${STEPS[idx + 1][0]}` }, nextLabel)
        : btn('できた（カルテをとじる）', finish, 'primary big grow'),
    ],
  });
}
