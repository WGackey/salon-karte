import { h, fill, page, card, btn, badge, go, chips, field, group, input, textarea, toast, confirmDlg, sheet } from '../ui.js';
import { S, person, visitsOf, saveVisit, deleteVisit, saveSoon, saveCustomer, saveMaster, recount, blankCustomer } from '../state.js';
import * as db from '../db.js';
import { jpDate, todayStr, addDays, blendCalc, limitFor, limitLevel, maxDrops, pickOils } from '../logic.js';
import { bodyPad, FIGURES } from '../bodymap.js';
import { notFound, blendText } from './customer.js';

const STEPS = [['monshin', '問診'], ['zu', 'からだの図'], ['seiyu', '精油'], ['blend', 'ブレンド'], ['sejutsu', '施術'], ['after', '施術後']];
const fam = (id) => S.settings.families.find((f) => f.id === id) || { name: '', color: '#bbb' };
const symName = (id) => (S.settings.symptoms.find((c) => c.id === id) || {}).name || '（消した症状）';
const condName = (id) => (S.settings.conds.find((c) => c.id === id) || {}).name || '';
const fmt = (n) => (Math.round(n * 100) / 100).toString();

// つらさ（1〜10）をえらぶボタン。zero=true なら 0 から
function levelPicker(value, onPick, zero = false) {
  const wrap = h('div', { class: 'levels', role: 'group' });
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
  if (!STEPS.some((s) => s[0] === step)) step = 'monshin';
  const idx = STEPS.findIndex((s) => s[0] === step);
  const save = () => saveSoon(() => saveVisit(v));
  const condIds = () => [...new Set([...det.conds, ...v.conds])];
  const body = h('div', { class: 'step' });
  const redraw = () => fill(body, ...[].concat(RENDER[step]()));
  const picks = () => pickOils({ oils: S.oils, cats: S.cats, symptoms: v.interview.symptoms, condIds: condIds(), avoidOilIds: det.avoidOilIds, allergyText: det.allergy, settings: S.settings });
  const hasOil = (oid) => v.blend.oils.some((o) => o.oilId === oid);
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
      const drawSym = () => fill(symBox, ...iv.symptoms.map((s) => h('div', { class: 'symrow' },
        h('div', { class: 'symname' }, symName(s.id)), levelPicker(s.level, (n) => { s.level = n; save(); }))));
      drawSym();
      return [
        v.copied && prev ? h('div', { class: 'notice ok' }, `前回（${jpDate(prev.date)}）の問診が入っています。変わったところだけ直してね。`) : null,
        card(h('div', { class: 'row' }, field('来店日', input(v, 'date', { type: 'date', onInput: () => { save(); } })), h('span', { class: 'muted' }, `${nth}回目`)),
          group('今日の状態', chips(visitConds, v.conds, { onChange: (x) => { v.conds = x; save(); } }),
            det.conds.length ? `いつもの状態：${det.conds.map(condName).join('・')}` : null)),
        card(h('h2', null, 'つらいところ'), h('p', { class: 'hint' }, 'あてはまるものを押して、つらさを 1（少し）〜10（とても）でえらびます'),
          chips(S.settings.symptoms, iv.symptoms.map((s) => s.id), {
            onChange: (ids) => { iv.symptoms = ids.map((sid) => iv.symptoms.find((s) => s.id === sid) || { id: sid, level: 5 }); drawSym(); save(); },
          }), symBox),
        card(group('今日の目的', chips(S.settings.purposes, iv.purposes, { onChange: (x) => { iv.purposes = x; save(); } })),
          group('香りの好み・気分', chips(S.settings.moods, iv.moods, { onChange: (x) => { iv.moods = x; save(); } })),
          field('くらしのようす（睡眠・食事・仕事など）', textarea(iv, 'life', { onInput: save })),
          field('今日のメモ', textarea(iv, 'memo', { onInput: save, rows: 2 }))),
      ];
    },
    // ---------- からだの図 ----------
    zu() {
      const marks = S.settings.marks; const tool = { mode: 'draw', mark: marks[0].id, width: 14 };
      const pads = {}; let view = 'both';
      const hist = []; // 取り消し用
      const padBox = h('div', { class: 'pads' });
      const drawPads = () => {
        padBox.className = 'pads ' + view;
        fill(padBox, ...FIGURES.filter((f) => view === 'both' || view === f.id).map((f) => {
          v.figures[f.id] = v.figures[f.id] || [];
          pads[f.id] = bodyPad({ kind: f.id, strokes: v.figures[f.id], marks, getTool: () => tool, onChange: () => { hist.push(f.id); save(); } });
          return h('div', { class: 'padwrap' }, h('div', { class: 'padname' }, f.name), pads[f.id]);
        }));
      };
      const markChips = chips(marks, tool.mark, { multi: false, cls: 'marks', onChange: (m) => { if (m) tool.mark = m; tool.mode = 'draw'; eraser.classList.remove('on'); syncMarks(); } });
      const syncMarks = () => markChips.querySelectorAll('.chip').forEach((c, i) => c.classList.toggle('on', tool.mode === 'draw' && marks[i].id === tool.mark));
      const eraser = btn('消しゴム', () => { tool.mode = tool.mode === 'erase' ? 'draw' : 'erase'; eraser.classList.toggle('on', tool.mode === 'erase'); syncMarks(); }, 'chip');
      const undo = btn('ひとつ戻す', () => {
        const f = hist.pop(); const k = f || FIGURES.map((x) => x.id).reverse().find((x) => (v.figures[x] || []).length);
        if (!k) return; v.figures[k].pop(); pads[k] && pads[k].redraw(); save();
      }, 'chip');
      const clear = btn('ぜんぶ消す', async () => {
        if (!(await confirmDlg('図にかいた線をぜんぶ消します。', '消す', true))) return;
        for (const f of FIGURES) v.figures[f.id] = []; hist.length = 0; drawPads(); save();
      }, 'chip');
      drawPads();
      return h('div', { class: 'zu' },
        h('div', { class: 'toolbar' }, markChips,
          chips([{ id: 6, name: '細い' }, { id: 14, name: 'ふつう' }, { id: 26, name: '太い' }], tool.width, { multi: false, onChange: (w) => { tool.width = w || 14; } }),
          h('div', { class: 'chips' }, eraser, undo, clear),
          chips([{ id: 'both', name: 'ならべる' }, { id: 'front', name: '前を大きく' }, { id: 'back', name: '後ろを大きく' }], view, { multi: false, onChange: (x) => { view = x || 'both'; drawPads(); } })),
        h('div', null, padBox, h('p', { class: 'hint center' }, '指でもペンでもなぞれます。色をえらんでから、つらいところをなぞってね。')));
    },
    // ---------- 精油の候補 ----------
    seiyu() {
      let famSel = [], ownedOnly = false;
      const listBox = h('div');
      const oilCard = (r, kind) => {
        const f = fam(r.oil.family); const on = hasOil(r.oil.id);
        const own = h('button', { type: 'button', class: 'mini' + (r.oil.owned ? ' on' : '') }, r.oil.owned ? '✓ 手持ち' : '手持ちにする');
        own.onclick = async () => { r.oil.owned = !r.oil.owned; await saveMaster('oils', r.oil); draw(); };
        const use = btn(on ? '✓ 使う' : kind === 'out' ? 'それでも使う' : '使う', async () => {
          if (!on && kind === 'out' && !(await confirmDlg(`${r.oil.name} は、次の理由で外してあります。\n\n・${r.blocks.join('\n・')}\n\nそれでも使いますか？（決めるのは施術する人です）`, '使う', true))) return;
          toggleOil(r.oil); draw();
        }, on ? 'primary' : kind === 'out' ? 'ghost' : '');
        return h('div', { class: 'oil ' + kind + (on ? ' picked' : ''), style: { '--fam': f.color } },
          h('div', { class: 'grow' },
            h('div', { class: 'name' }, r.oil.name, ' ', h('span', { class: 'famtag' }, f.name), r.oil.draft ? badge('下書き', 'draft') : null),
            r.blocks.length ? h('ul', { class: 'why out' }, r.blocks.map((t) => h('li', null, '外した理由：' + t))) : null,
            r.reasons.length ? h('ul', { class: 'why' }, r.reasons.slice(0, 3).map((t) => h('li', null, t))) : null,
            r.oil.note ? h('div', { class: 'muted small' }, r.oil.note) : null),
          h('div', { class: 'oil-act' }, use, own));
      };
      const draw = () => {
        const rs = picks().filter((r) => !famSel.length || famSel.includes(r.oil.family));
        const ok = rs.filter((r) => !r.blocks.length), out = rs.filter((r) => r.blocks.length);
        const hit = ok.filter((r) => r.score > 0), rest = ok.filter((r) => r.score <= 0);
        const sec = (title, arr, kind, hint, fold) => !arr.length ? null
          : h(fold ? 'details' : 'div', { class: 'sec' + (fold ? ' fold' : '') }, h(fold ? 'summary' : 'h3', null, `${title}（${arr.length}）`), hint ? h('p', { class: 'hint' }, hint) : null, arr.map((r) => oilCard(r, kind)));
        fill(listBox, ...[
          v.interview.symptoms.length ? null : h('div', { class: 'notice amber' }, '問診で「つらいところ」をえらぶと、合いそうな精油が上に出ます。'),
          sec('候補（手持ちの中から）', hit.filter((r) => r.oil.owned), 'hit'),
          hit.length && !hit.some((r) => r.oil.owned) ? h('div', { class: 'notice' }, '手持ちの精油の中には候補がありません。持っている精油に「手持ちにする」を押してね（設定 → 精油の一覧 でもまとめてできます）。') : null,
          ownedOnly ? null : sec('次に買う候補（持っていないけれど合いそう）', hit.filter((r) => !r.oil.owned), 'buy'),
          sec('理由があって外したもの', out.filter((r) => !ownedOnly || r.oil.owned), 'out', '消さずに見せています。最後に決めるのは施術する人です。'),
          sec('そのほかの精油', rest.filter((r) => !ownedOnly || r.oil.owned), 'rest', null, v.interview.symptoms.length > 0),
        ].filter(Boolean));
        chosen.textContent = v.blend.oils.length ? `えらんだ精油：${v.blend.oils.map((o) => o.name).join('、')}` : 'まだ精油をえらんでいません';
      };
      const chosen = h('div', { class: 'chosen' });
      const conds = condIds();
      draw();
      return [
        h('div', { class: 'notice draft' }, '精油のデータは「下書き」です。自分の資料で確かめて、設定から直してください。候補は目安で、最後に決めるのは施術する人です。'),
        card(h('div', { class: 'facts' },
          h('div', null, h('b', null, 'つらいところ：'), v.interview.symptoms.map((s) => `${symName(s.id)}（${s.level}）`).join('、') || 'なし'),
          h('div', null, h('b', null, '気をつける状態：'), conds.map(condName).join('・') || 'なし'),
          v.interview.moods.length ? h('div', null, h('b', null, '香りの好み：'), v.interview.moods.join('・')) : null),
          group('香りの系統でしぼる', chips(S.settings.families, famSel, { onChange: (x) => { famSel = x; draw(); } })),
          chips([{ id: 'own', name: '手持ちだけ見る' }], [], { onChange: (x) => { ownedOnly = x.length > 0; draw(); } })),
        listBox, chosen,
      ];
    },
    // ---------- ブレンド ----------
    blend() {
      const b = v.blend; const dropMl = S.settings.dropMl || 0.05;
      const meter = h('div', { class: 'meter' }); const oilBox = h('div'); const carBox = h('div');
      const blockOf = Object.fromEntries(picks().filter((r) => r.blocks.length).map((r) => [r.oil.id, r.blocks]));
      const drawMeter = () => {
        const c = blendCalc(b, dropMl); const lim = limitFor(S.settings, b.areaId, condIds()); const lv = limitLevel(c.pct, lim.max);
        const md = maxDrops(lim.max, c.carrierMl, dropMl);
        meter.className = 'meter ' + lv;
        fill(meter, 
          h('div', { class: 'pct' }, c.pct == null ? '—' : c.pct.toFixed(1), h('small', null, '％')),
          h('div', { class: 'grow' },
            h('div', { class: 'meter-msg' }, lv === 'over' ? '⚠ 目安をこえています' : lv === 'near' ? '目安のぎりぎりです' : lv === 'ok' ? '目安の中です' : lv === 'unknown' ? 'この部位の目安はまだ入っていません' : 'キャリアオイルの量を入れると濃度が出ます'),
            h('div', { class: 'muted' }, `精油 ${c.drops}滴（約${fmt(c.oilMl)}ml）＋ キャリアオイル ${fmt(c.carrierMl)}ml`),
            h('div', { class: 'muted' }, lim.max != null ? `目安：${lim.parts.map((x) => `${x.name || x.label} ${x.max}％まで`).join('・')}${md != null ? `　→ この量なら ${md}滴まで` : ''}` : h('a', { href: '#/set/limits' }, '目安を設定する ›'))));
      };
      const stepper = (obj, key, stepBy, min, unit, after) => {
        const val = h('span', { class: 'val' }, `${fmt(obj[key])}${unit}`);
        const set = (n) => { obj[key] = Math.max(min, Math.round(n * 10) / 10); val.textContent = `${fmt(obj[key])}${unit}`; drawMeter(); save(); after && after(); };
        return h('div', { class: 'stepper' }, btn('−', () => set(obj[key] - stepBy), 'round'), val, btn('＋', () => set(obj[key] + stepBy), 'round'));
      };
      const drawOils = () => fill(oilBox, ...b.oils.map((o) => {
        const oil = S.oils.find((x) => x.id === o.oilId);
        return h('div', { class: 'brow', style: { '--fam': fam(oil && oil.family).color } },
          h('div', { class: 'grow' }, h('div', { class: 'name' }, o.name), blockOf[o.oilId] ? h('div', { class: 'small warntext' }, '⚠ ' + blockOf[o.oilId].join('／')) : null),
          stepper(o, 'drops', 1, 0, '滴'),
          btn('×', () => { b.oils = b.oils.filter((x) => x !== o); drawOils(); drawMeter(); save(); }, 'ghost round'));
      }), b.oils.length ? null : h('p', { class: 'muted' }, 'まだ精油がありません。「精油」の画面でえらぶか、下のボタンで足してね。'));
      const drawCars = () => fill(carBox, ...b.carriers.map((c) => h('div', { class: 'brow' },
        h('div', { class: 'grow' }, h('div', { class: 'name' }, c.name),
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
        const s = sheet('キャリアオイルをえらぶ', h('div', { class: 'chips' }, list.map((c) => btn(c.name + (c.owned ? '' : '（持っていない）'), () => {
          if (!b.carriers.some((x) => x.carrierId === c.id)) { b.carriers.push({ carrierId: c.id, name: c.name, ml: b.carriers.length ? 0 : 30 }); save(); } s.close(); refresh();
        }, 'chip'))));
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
        card(group('どこに使う？', areaBox, S.settings.areas.some((a) => a.draft) ? '「下書き」の目安が入っています。自分の資料で確かめて、設定で直してね。' : null)),
        card(h('h2', null, '精油'), oilBox, h('div', { class: 'row' }, btn('＋ 精油を足す', addOil))),
        card(h('h2', null, 'キャリアオイル'), carBox, h('div', { class: 'row' }, btn('＋ キャリアオイルをえらぶ', addCarrier))),
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
      return [
        card(h('h2', null, '施術メニュー'), box, h('p', { class: 'hint' }, 'いくつでもえらべます。メニューは 設定 → 施術メニュー で作れます。')),
        card(field('整体でしたこと', textarea(v.treat, 'seitai', { onInput: save, rows: 4, placeholder: '例：首〜肩まわりをゆるめた。右の腰がかたい' })),
          field('アロマでしたこと', textarea(v.treat, 'aroma', { onInput: save, rows: 4, placeholder: '例：背中と脚を中心に。圧は弱め' })),
          blendText(v.blend) ? h('p', { class: 'muted' }, '使ったブレンド：' + blendText(v.blend)) : null),
      ];
    },
    // ---------- 施術後 ----------
    after() {
      const a = v.after; const nextIn = h('input', { type: 'date', class: 'input', value: v.nextDate, 'aria-label': '次回の予定日' });
      const setNext = (d) => { v.nextDate = d; nextIn.value = d; p.nextDate = d; saveSoon(async () => { await saveVisit(v); await saveCustomer(p, null); }); };
      nextIn.onchange = () => setNext(nextIn.value);
      return [
        card(h('h2', null, 'つらさの変化'), h('p', { class: 'hint' }, '施術のあとのつらさをえらびます（0＝なくなった）'),
          v.interview.symptoms.length ? v.interview.symptoms.map((s) => h('div', { class: 'symrow' },
            h('div', { class: 'symname' }, symName(s.id), h('span', { class: 'muted' }, `　前 ${s.level}`)),
            levelPicker(a.levels[s.id], (n) => { a.levels[s.id] = n; save(); }, true))) : h('p', { class: 'muted' }, '問診で「つらいところ」をえらぶと、ここで変化を残せます。')),
        card(group('香りの感想', chips(S.settings.scents, a.scent, { multi: false, onChange: (x) => { a.scent = x; save(); } })),
          field('施術後のようす・伝えたこと', textarea(a, 'note', { onInput: save, rows: 3 }))),
        card(h('h2', null, '次回の予定日'), h('div', { class: 'row' }, nextIn,
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
    toast('カルテを保存しました'); go(`#/c/${p.id}`);
  };
  const nav = h('nav', { class: 'steps' }, STEPS.map(([k, name], i) => h('a', { class: 'stepbtn' + (k === step ? ' on' : ''), href: `#/v/${id}/${k}` }, h('span', { class: 'num' }, String(i + 1)), name)));
  const warn = [...det.conds, ...v.conds].map(condName).filter(Boolean);
  return page({
    cls: 'visit', title: p.name, sub: `${jpDate(v.date)}・${nth}回目${v.status === 'draft' ? '（書きかけ・自動で保存）' : ''}`, back: `#/c/${p.id}`,
    actions: warn.length || det.allergy ? h('span', { class: 'badge warn' }, '⚠ ' + [...warn, det.allergy ? 'アレルギーあり' : ''].filter(Boolean).join('・')) : null,
    body: [nav, body],
    footer: [
      idx > 0 ? h('a', { class: 'btn big', href: `#/v/${id}/${STEPS[idx - 1][0]}` }, '‹ 前へ') : h('span'),
      idx < STEPS.length - 1 ? h('a', { class: 'btn primary big grow', href: `#/v/${id}/${STEPS[idx + 1][0]}` }, `次へ：${STEPS[idx + 1][1]} ›`)
        : btn('カルテを保存して終わる', finish, 'primary big grow'),
    ],
  });
}
