// 部位の図（手・足・頭・首肩・背中）と、「全身／部分」の決まりごと。
// 図はどれも自分で描き起こしたもの。なぞった線は図ごとの座標で残すので、★形を大きく変えると前の線がずれる（変えるなら移し替えを入れる）。
// 足の裏の反射区は、図の上に重ねる層（このファイルの下のほうの REFLEX_SHAPES と reflexSvg）。bodyPad の overlaySvg に渡すと、図と線のあいだに重なる。
const O = '#a89c8c', F = '#f3ede4';
// りんかくをきれいにつなぐ描き方：同じ形を「ふち色で太く」→「中の色で」の2回重ねる（指と手のひらの境目に線が出ない）
const limb = (pts, w) => (ly) => { // pts：[x,y,太さ]…（つけ根 → 先）
  let s = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1, w1] = pts[i], [x2, y2] = pts[i + 1]; const ww = w1 || w;
    s += `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke-linecap="round" stroke="${ly ? F : O}" stroke-width="${ly ? ww : ww + 4}"/>`;
  }
  return s;
};
const blob = (d) => (ly) => `<path d="${d}" fill="${ly ? F : O}" stroke="${ly ? 'none' : O}" stroke-width="4" stroke-linejoin="round"/>`;
const oval = (cx, cy, rx, ry, rot = 0) => (ly) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ''} fill="${ly ? F : O}" stroke="${ly ? 'none' : O}" stroke-width="4"/>`;
const union = (shapes) => shapes.map((f) => f(0)).join('') + shapes.map((f) => f(1)).join('');
const detail = (s) => `<g class="fig-detail">${s}</g>`;
const mirror = (s, w) => `<g transform="translate(${w} 0) scale(-1 1)">${s}</g>`;
const label = (x, y, t, cls = 'fig-lr') => `<text x="${x}" y="${y}" class="${cls}">${t}</text>`;

// 指：つけ根 → 先 を1本のなめらかな形で（関節で分けない。0.11.0 がっき〜：「手の図は関節で分けず、シンプルに」）
// ★つけ根と指先の位置は 0.10.0 までと同じ（前の来店でなぞった線がずれないように）。太さは、つけ根 w1 → 先 w2 へ少しずつ細く
const finger = (x1, y1, x2, y2, w1, w2) => {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, r1 = w1 / 2, r2 = w2 / 2;
  const f = (n) => Math.round(n * 10) / 10;
  return blob(`M${f(x1 + nx * r1)} ${f(y1 + ny * r1)}L${f(x2 + nx * r2)} ${f(y2 + ny * r2)}A${r2} ${r2} 0 0 0 ${f(x2 - nx * r2)} ${f(y2 - ny * r2)}L${f(x1 - nx * r1)} ${f(y1 - ny * r1)}A${r1} ${r1} 0 0 0 ${f(x1 + nx * r1)} ${f(y1 + ny * r1)}Z`); // 先もつけ根も丸く（つけ根の角が手のひらの外に出ないように）
};
// ---- 手（親指が右にある形。左右は鏡うつし） ----
const HAND = union([
  blob('M82 236C78 208 82 188 100 180L206 174C224 178 231 194 231 216C233 256 228 292 208 322L203 348L203 430L107 430L107 348C90 320 85 276 82 236Z'),
  finger(100, 206, 69, 104, 30, 26), finger(130, 196, 111, 62, 33, 28),
  finger(163, 192, 159, 42, 35, 30), finger(197, 196, 211, 62, 34, 29),
  finger(200, 300, 268, 192, 42, 34),
]);
// 手のひら：おもな手のすじ3本だけ（指の関節のすじは描かない）
const PALM = detail('<path d="M150 350C144 296 160 250 206 226M90 242C122 226 160 226 190 208M96 274C132 268 172 254 208 226"/>');
// 手の甲：つめだけ（手の甲と見分けるため。関節・すじは描かない）
const HANDBACK = detail('<path d="M61 106q8 -12 16 -3M103 64q8 -12 17 -1M150 44q9 -12 18 0M203 63q9 -12 17 0M256 196q11 -9 17 3"/>');
// ---- 足（親指が右にある形。左右は鏡うつし） ----
const SOLE_D = 'M150 402C118 402 104 378 106 346C108 312 96 280 86 244C76 208 68 178 72 150C74 120 110 100 150 96C192 92 236 102 240 140C243 172 222 206 210 240C200 270 198 304 198 344C198 378 184 402 150 402Z';
const TOES = [oval(214, 82, 26, 33, 4), oval(170, 76, 16, 24), oval(138, 82, 15, 21, -6), oval(110, 96, 14, 19, -12), oval(85, 116, 13, 17, -20)];
const FOOT = union([blob(SOLE_D), ...TOES]);
const SOLE = detail('<path d="M78 172C116 198 196 192 236 160M204 244C190 276 188 306 194 336M112 352C132 336 172 336 192 352"/><path d="M192 112q22 9 44 0M156 100q14 6 28 1M124 104q13 6 26 2M98 116q11 6 23 3M74 136q9 5 19 3" opacity=".7"/>');
// 足の甲：りんかくと、つめ・足首のすじだけ（0.11.0 がっき〜：「シンプルに」。前の、くるぶしのふくらみ・骨のすじ・足首の丸は描かない。りんかくの位置は同じ）
const FOOTTOP = union([blob(SOLE_D), ...TOES])
  + detail('<path d="M202 58q12 -12 24 0M162 58q8 -10 16 0M130 66q8 -9 15 0M103 82q7 -8 13 0M79 104q6 -7 11 1"/><path d="M110 334C134 350 168 350 194 332" opacity=".7"/>');
// ---- 頭 ----
const HEAD_SHAPES = [
  blob('M118 236L118 290C100 306 52 314 14 334L-10 350L-10 420L310 420L310 350L286 334C248 314 200 306 182 290L182 236Z'),
  oval(70, 152, 11, 25), oval(230, 152, 11, 25),
  blob('M150 38C202 38 230 80 230 134C230 192 202 254 150 260C98 254 70 192 70 134C70 80 98 38 150 38Z'),
];
const HEADF = union(HEAD_SHAPES) + detail('<path d="M78 112C96 70 204 70 222 112" opacity=".6"/><path d="M104 140q16 -9 32 -1M164 139q16 -8 32 1M108 156q13 -7 26 0M166 156q13 -7 26 0M150 162L146 196q4 5 10 1M130 222q20 9 40 0"/><path d="M124 324C104 320 76 324 50 336M176 324C196 320 224 324 250 336" opacity=".7"/>');
const HEADB = union(HEAD_SHAPES) + detail('<path d="M96 226C116 250 184 250 204 226"/><path d="M150 44V250" stroke-dasharray="5 7" opacity=".6"/><path d="M150 262V352" stroke-dasharray="5 6"/><path d="M130 296C112 322 76 330 40 340M170 296C188 322 224 330 260 340" opacity=".7"/>');
const HEADT = union([oval(150, 62, 12, 15), oval(63, 196, 9, 23), oval(237, 196, 9, 23),
  blob('M150 62C204 62 236 118 236 190C236 262 200 316 150 316C100 316 64 262 64 190C64 118 96 62 150 62Z')])
  + detail('<path d="M150 70V310" stroke-dasharray="5 7" opacity=".6"/><path d="M70 196H230" stroke-dasharray="5 7" opacity=".6"/><path d="M144 228q6 -8 13 -1q3 8 -6 9"/>');
// ---- 首・肩 ----
const NECK_SHAPES = [
  blob('M146 70L146 116C130 136 74 144 44 160C14 176 6 214 2 262L-10 340L370 340L358 262C354 214 346 176 316 160C286 144 230 136 214 116L214 70Z'),
  oval(180, 6, 64, 86),
];
const NECKF = union(NECK_SHAPES) + detail('<path d="M172 152C140 146 100 150 64 166M188 152C220 146 260 150 296 166M174 152q6 8 12 0"/><path d="M64 320C60 290 62 264 72 240M296 320C300 290 298 264 288 240"/><path d="M150 100C156 122 166 140 176 150M210 100C204 122 194 140 184 150" opacity=".6"/><path d="M150 62q30 16 60 0" opacity=".6"/>');
// 首・肩（後ろ）：0.11.0 がっき〜「肩の線がずれている」「肩甲骨のラインが不自然」→ りんかくの下にずれて重なっていた肩の線は消した（肩はりんかくの線だけ）。
// 肩甲骨は「内側のふち（背骨の横をたてに）→ 下の角 → 外側のふち（わきへ）」と「肩甲骨の上の骨の出っぱり（よこ）」で描く。りんかくは前と同じ
const scapula = (cx, top, s) => { const X = (x) => cx + x * s; return `<path d="M${X(38)} ${top}C${X(36)} ${top + 34} ${X(36)} ${top + 72} ${X(40)} ${top + 104}C${X(56)} ${top + 92} ${X(72)} ${top + 70} ${X(84)} ${top + 44}"/><path d="M${X(38)} ${top + 12}C${X(56)} ${top + 4} ${X(78)} ${top - 2} ${X(100)} ${top - 4}" opacity=".8"/>`; };
const NECKB = union(NECK_SHAPES) + detail('<path d="M180 60V320" stroke-dasharray="5 6"/>' + scapula(180, 192, -1) + scapula(180, 192, 1) + '<path d="M64 320C60 290 62 264 72 240M296 320C300 290 298 264 288 240"/><path d="M134 56C150 74 210 74 226 56" opacity=".7"/>');
// ---- 背中・腰 ----
// 背中・腰：首・肩（後ろ）と同じ直し（0.11.0）。りんかくの下にずれて重なっていた肩の線を消し、肩甲骨を同じ描き方に。りんかくは前と同じ
const BACK = union([
  blob('M126 -20L126 26C112 44 72 50 50 62C30 74 22 98 14 132L-24 250L14 262L60 168C64 214 72 246 76 276C78 304 64 344 60 384L58 460L242 460L240 384C236 344 222 304 224 276C228 246 236 214 240 168L286 262L324 250L286 132C278 98 270 74 250 62C228 50 188 44 174 26L174 -20Z'),
]) + detail('<path d="M150 10V396" stroke-dasharray="5 6"/>' + scapula(150, 88, -0.82) + scapula(150, 88, 0.82) + '<path d="M78 282q30 12 60 4M222 282q-30 12 -60 4" opacity=".7"/><path d="M118 372q32 26 64 0M112 344h14M174 344h14"/><path d="M60 168q4 -22 -4 -40M240 168q-4 -22 4 -40" opacity=".7"/>');

const HB = [10, 0, 280, 400], FB = [20, 20, 260, 400], HDB = [0, 10, 300, 360], NB = [0, 0, 360, 320], BB = [0, 0, 300, 420];
// 図の一覧。id は保存する名前（visits の figures／guestFigures のキー）。変えない
export const FIGS = {
  front: { id: 'front', name: '前', part: 'whole' }, back: { id: 'back', name: '後ろ', part: 'whole' },
  hand_palm_r: { name: '右手のひら', part: 'hand', box: HB, svg: HAND + PALM },
  hand_palm_l: { name: '左手のひら', part: 'hand', box: HB, svg: mirror(HAND + PALM, 300) },
  hand_back_l: { name: '左手の甲', part: 'hand', box: HB, svg: HAND + HANDBACK },
  hand_back_r: { name: '右手の甲', part: 'hand', box: HB, svg: mirror(HAND + HANDBACK, 300) },
  foot_sole_r: { name: '右足の裏', part: 'foot', box: FB, svg: FOOT + SOLE },
  foot_sole_l: { name: '左足の裏', part: 'foot', box: FB, svg: mirror(FOOT + SOLE, 300) },
  foot_top_l: { name: '左足の甲', part: 'foot', box: FB, svg: FOOTTOP },
  foot_top_r: { name: '右足の甲', part: 'foot', box: FB, svg: mirror(FOOTTOP, 300) },
  head_front: { name: '頭（前）', part: 'head', box: HDB, svg: HEADF + label(34, 60, '右') + label(266, 60, '左') },
  head_back: { name: '頭（後ろ）', part: 'head', box: HDB, svg: HEADB + label(34, 60, '左') + label(266, 60, '右') },
  head_top: { name: '頭（上から）', part: 'head', box: HDB, svg: HEADT + label(150, 34, '前（顔）') + label(150, 346, '後ろ') + label(34, 110, '左') + label(266, 110, '右') },
  neck_front: { name: '首・肩（前）', part: 'neck', box: NB, svg: NECKF + label(40, 60, '右') + label(320, 60, '左') },
  neck_back: { name: '首・肩（後ろ）', part: 'neck', box: NB, svg: NECKB + label(40, 60, '左') + label(320, 60, '右') },
  back_back: { name: '背中・腰', part: 'back', box: BB, svg: BACK + label(28, 36, '左') + label(272, 36, '右') },
};
for (const [id, f] of Object.entries(FIGS)) f.id = id;
export const WHOLE_FIGS = ['front', 'back'];
// 部位の一覧（図の組み合わせ）。名前・濃度の目安・関わる「つらいところ」は設定（settings.parts）で直せる
export const PART_FIGS = {
  hand: ['hand_palm_r', 'hand_palm_l', 'hand_back_l', 'hand_back_r'],
  foot: ['foot_sole_r', 'foot_sole_l', 'foot_top_l', 'foot_top_r'],
  head: ['head_front', 'head_back', 'head_top'],
  neck: ['neck_front', 'neck_back'],
  back: ['back_back'],
};

// ---- 全身／部分 ----
// scope：{ type:'whole' } か { type:'part', parts:['hand','foot'] }
export const isPart = (scope) => !!scope && scope.type === 'part' && (scope.parts || []).some((id) => PART_FIGS[id]);
export const scopeParts = (scope) => (isPart(scope) ? scope.parts.filter((id) => PART_FIGS[id]) : []);
// その来店で出す図（図の番号の並び）
export const figIdsOf = (scope) => (isPart(scope) ? scopeParts(scope).flatMap((id) => PART_FIGS[id]) : WHOLE_FIGS);
export const figsOf = (scope) => figIdsOf(scope).map((id) => FIGS[id]);
const partDef = (settings, id) => ((settings && settings.parts) || []).find((p) => p.id === id) || { id, name: id, areaId: '', syms: [] };
export const partName = (settings, id) => partDef(settings, id).name || id;
export const scopeText = (settings, scope) => (isPart(scope) ? scopeParts(scope).map((id) => partName(settings, id)).join('・') + ' だけ' : '全身');
// 部位に合わせた「濃度の目安」。いくつか部位があるときは、目安のいちばん低いものを使う（安全側）。決まらなければ ''（そのまま）
export function areaForScope(settings, scope) {
  const areas = settings.areas || [];
  if (!isPart(scope)) return (areas.find((a) => a.id === (settings.wholeAreaId || 'a_body')) || {}).id || '';
  const hit = scopeParts(scope).map((id) => areas.find((a) => a.id === partDef(settings, id).areaId)).filter(Boolean);
  if (!hit.length) return '';
  const num = hit.filter((a) => a.max != null);
  return (num.length ? num.reduce((a, b) => (b.max < a.max ? b : a)) : hit[0]).id;
}
// 部位に関わる「つらいところ」の番号（短い問診で先に出す）
export const symsForScope = (settings, scope) => [...new Set(scopeParts(scope).flatMap((id) => partDef(settings, id).syms || []))];
// えらんだメニューから、全身／部分を決める。どれかが全身なら全身、部位だけならその合わせたもの。決まっていなければ null
export function scopeFromMenus(menus) {
  const sc = (menus || []).map((m) => m.scope).filter((s) => s && (s.type === 'whole' || isPart(s)));
  if (!sc.length) return null;
  if (sc.some((s) => s.type === 'whole')) return { type: 'whole' };
  return { type: 'part', parts: Object.keys(PART_FIGS).filter((id) => sc.some((s) => s.parts.includes(id))) };
}

// ---- 反射区（足の裏の区分け） ----
// 自分で描き起こした、大まかな区分けだけの下書き（本の図の写しではない）。確かめていない → 画面に「下書き・確かめていません」と出す。
// 形は右足の裏の座標（親指が右）。左足は左右を返す。名前と色は設定（settings.reflex.zones）で、使う人が直せる。番号は並びの順。
// 位置に自信のない区分け（左右でちがうもの・小さいもの・資料によって場所がちがうもの）は入れていない：引き継ぎメモに一覧
const E = (cx, cy, rx, ry, rot = 0) => ({ d: `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ''}/>`, at: [cx, cy] });
export const REFLEX_SHAPES = {
  rz_head: E(214, 74, 19, 21), // 親指のはら
  rz_neck: E(214, 106, 19, 8), // 親指のつけ根
  rz_eye: E(154, 110, 30, 9), // 人さし指・中指のつけ根
  rz_ear: E(100, 128, 22, 9, -28), // 薬指・小指のつけ根
  rz_shoulder: E(90, 164, 12, 15), // 小指の下・外側のふち
  rz_chest: E(154, 152, 44, 21), // 指のつけ根の下のふくらみ
  rz_stomach: E(184, 214, 20, 15), // 土ふまずの上のほう・内側
  rz_gut: E(150, 292, 38, 33), // 土ふまずの下のほう
  rz_spine: { d: '<path class="rzline" d="M233 150C227 190 210 226 205 262C200 300 195 330 194 368"/>', at: [222, 190] }, // 内側のふちにそって
  rz_pelvis: E(150, 368, 34, 24), // かかと
};
export const REFLEX_FIGS = { foot_sole_r: false, foot_sole_l: true }; // 図 → 左右を返すか
export const hasReflex = (figs) => (figs || []).some((f) => (f.id || f) in REFLEX_FIGS);
// 出す区分け（形があって、使う人が外していないもの）。番号つき
export const reflexZones = (reflex) => ((reflex && reflex.zones) || []).filter((z) => REFLEX_SHAPES[z.id] && !z.off).map((z, i) => ({ ...z, no: i + 1 }));
const safeColor = (c) => (/^#[0-9a-fA-F]{3,8}$/.test(c || '') ? c : '#888888');
export function reflexSvg(figId, reflex) {
  if (!(figId in REFLEX_FIGS)) return '';
  const flip = REFLEX_FIGS[figId];
  return reflexZones(reflex).map((z) => {
    const sh = REFLEX_SHAPES[z.id]; const x = flip ? 300 - sh.at[0] : sh.at[0];
    return `<g class="rz" data-z="${z.id}" style="--c:${safeColor(z.color)}">${flip ? mirror(sh.d, 300) : sh.d}<text x="${x}" y="${sh.at[1] + 4}">${z.no}</text></g>`;
  }).join('');
}
