// 部位の図（手・足・頭・首肩・背中）と、「全身／部分」の決まりごと。
// 図はどれも自分で描き起こしたもの。なぞった線は図ごとの座標で残すので、★形を大きく変えると前の線がずれる（変えるなら移し替えを入れる）。
// 足の裏の反射区（第3段）は、図の上に重ねる層として足せる：FIGS[図].overlays に { id, name, svg } を足すと、bodyPad が線の下に重ねる。
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

// ---- 手（親指が右にある形。左右は鏡うつし） ----
const HAND = union([
  blob('M82 236C78 208 82 188 100 180L206 174C224 178 231 194 231 216C233 256 228 292 208 322L203 348L203 430L107 430L107 348C90 320 85 276 82 236Z'),
  limb([[100, 200, 30], [80, 142, 27], [69, 104]]), limb([[130, 190, 32], [118, 112, 29], [111, 62]]),
  limb([[163, 186, 34], [160, 98, 31], [159, 42]]), limb([[197, 190, 33], [205, 110, 30], [211, 62]]),
  limb([[204, 304, 44], [244, 240, 37], [268, 192]]),
]);
const PALM = detail('<path d="M150 350C144 296 160 250 206 226M90 242C122 226 160 226 190 208M96 274C132 268 172 254 208 226"/><path d="M68 132q12 -5 24 3M105 104q14 -5 27 0M145 92q15 -4 30 0M190 104q14 -5 28 2M236 226q12 2 22 14" opacity=".7"/>');
const HANDBACK = detail('<path d="M61 104q8 -12 16 -3M103 62q8 -12 17 -1M150 42q9 -12 18 0M203 61q9 -12 17 0M258 190q11 -8 16 4"/><path d="M88 190q9 -9 18 -1M120 180q10 -9 20 -1M152 176q11 -9 22 -1M186 180q10 -9 20 0"/><path d="M104 208L128 330M134 200L144 330M165 198L160 330M196 202L176 330" opacity=".45"/>');
// ---- 足（親指が右にある形。左右は鏡うつし） ----
const SOLE_D = 'M150 402C118 402 104 378 106 346C108 312 96 280 86 244C76 208 68 178 72 150C74 120 110 100 150 96C192 92 236 102 240 140C243 172 222 206 210 240C200 270 198 304 198 344C198 378 184 402 150 402Z';
const TOES = [oval(214, 82, 26, 33, 4), oval(170, 76, 16, 24), oval(138, 82, 15, 21, -6), oval(110, 96, 14, 19, -12), oval(85, 116, 13, 17, -20)];
const FOOT = union([blob(SOLE_D), ...TOES]);
const SOLE = detail('<path d="M78 172C116 198 196 192 236 160M204 244C190 276 188 306 194 336M112 352C132 336 172 336 192 352"/><path d="M192 112q22 9 44 0M156 100q14 6 28 1M124 104q13 6 26 2M98 116q11 6 23 3M74 136q9 5 19 3" opacity=".7"/>');
const FOOTTOP = union([blob(SOLE_D), ...TOES, oval(100, 322, 9, 15), oval(204, 316, 9, 15)])
  + detail('<path d="M202 58q12 -12 24 0M162 58q8 -10 16 0M130 66q8 -9 15 0M103 82q7 -8 13 0M79 104q6 -7 11 1"/><path d="M208 124L176 246M170 108L158 242M140 112L142 244M112 124L126 250" opacity=".4"/><ellipse cx="152" cy="334" rx="45" ry="42"/>');
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
const NECKB = union(NECK_SHAPES) + detail('<path d="M180 60V320" stroke-dasharray="5 6"/><path d="M148 96C136 136 92 156 48 164M212 96C224 136 268 156 312 164"/><path d="M112 196C100 236 112 282 146 304M248 196C260 236 248 282 214 304"/><path d="M64 320C60 290 62 264 72 240M296 320C300 290 298 264 288 240"/><path d="M134 56C150 74 210 74 226 56" opacity=".7"/>');
// ---- 背中・腰 ----
const BACK = union([
  blob('M126 -20L126 26C112 44 72 50 50 62C30 74 22 98 14 132L-24 250L14 262L60 168C64 214 72 246 76 276C78 304 64 344 60 384L58 460L242 460L240 384C236 344 222 304 224 276C228 246 236 214 240 168L286 262L324 250L286 132C278 98 270 74 250 62C228 50 188 44 174 26L174 -20Z'),
]) + detail('<path d="M150 10V396" stroke-dasharray="5 6"/><path d="M128 20C118 50 84 66 52 70M172 20C182 50 216 66 248 70" opacity=".7"/><path d="M92 96C80 136 92 178 126 196M208 96C220 136 208 178 174 196"/><path d="M78 282q30 12 60 4M222 282q-30 12 -60 4" opacity=".7"/><path d="M118 372q32 26 64 0M112 344h14M174 344h14"/><path d="M60 168q4 -22 -4 -40M240 168q-4 -22 4 -40" opacity=".7"/>');

const HB = [10, 0, 280, 400], FB = [20, 20, 260, 400], HDB = [0, 10, 300, 360], NB = [0, 0, 360, 320], BB = [0, 0, 300, 420];
// 図の一覧。id は保存する名前（visits の figures／guestFigures のキー）。変えない
export const FIGS = {
  front: { id: 'front', name: '前', part: 'whole' }, back: { id: 'back', name: '後ろ', part: 'whole' },
  hand_palm_r: { name: '右手のひら', part: 'hand', box: HB, svg: HAND + PALM },
  hand_palm_l: { name: '左手のひら', part: 'hand', box: HB, svg: mirror(HAND + PALM, 300) },
  hand_back_l: { name: '左手の甲', part: 'hand', box: HB, svg: HAND + HANDBACK },
  hand_back_r: { name: '右手の甲', part: 'hand', box: HB, svg: mirror(HAND + HANDBACK, 300) },
  foot_sole_r: { name: '右足の裏', part: 'foot', box: FB, svg: FOOT + SOLE, overlays: [] },
  foot_sole_l: { name: '左足の裏', part: 'foot', box: FB, svg: mirror(FOOT + SOLE, 300), overlays: [] },
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
