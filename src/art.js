// ゲームのドット絵。32×32 ドット(画面上は 16×16 マスに収まる細かさ)で描く。
//
// 1枚ずつ点を打つ代わりに、形(四角・丸・線)と陰影をコードで描き、
// 最後に「外側へ1ドットの輪郭」を自動で付ける。アイコン(scripts/make-icons.cjs)と同じ描き方。
// ここはブラウザに頼らない(配列を返すだけ)。画像にするのは sprites.js。
//
// 絵は「色の文字列の2次元配列」で、null は透明。

export const C = {
  // 主人公
  ol: '#070d26',
  hl: '#bff0ff', b1: '#5cc8ff', b2: '#29adff', b3: '#1a7fd6', b4: '#155ca8', b5: '#0f3f7a',
  visor: '#050a1c', vref: '#2b4a8f', eye: '#7cf7ff', eyeW: '#ffffff',
  gold1: '#fff4b0', gold2: '#ffd23f', gold3: '#f0a420', gold4: '#b8650f',
  red: '#ff3b5c', redHi: '#ff9fb2',
  // フィッシングメール
  paper1: '#fffaf2', paper2: '#efe6f2', paper3: '#c9b8d6', paper4: '#8f7aa6', pol: '#2a1036',
  mouth: '#e8344e', hook1: '#e6ecf5', hook2: '#8d97ab',
  // Password1!
  st1: '#eef3fa', st2: '#bcc7d6', st3: '#8792a8', st4: '#59627a', st5: '#3a4158', sol: '#12172a',
  slit: '#0b0e18', pink1: '#ffc2d9', pink2: '#ff77a8', pink3: '#d94f86', pink4: '#9c2f63',
  // 地形
  pcb0: '#0b1232', pcb1: '#111a44', pcb2: '#16225a', pcbLine: '#24357a', pcbHi: '#7fe3ff', pcbEdge: '#29adff',
  pad1: '#ffd23f', pad2: '#b8861f',
  mag1: '#ffa8d6', mag2: '#e2479a', mag3: '#b02a74', mag4: '#741a4e', mag5: '#4a0f33',
  br1: '#a08870', br2: '#7a6452', br3: '#5b4636', br4: '#3b2c22',
  bez1: '#8a94ad', bez2: '#5d667f', bez3: '#3a4158', scr1: '#0d3b66', scr2: '#145a96', scr3: '#29adff', scr4: '#bff0ff',
  key1: '#c7cfdd', key2: '#8d97ab', key3: '#5d667f',
  door1: '#4a5370', door2: '#2f3650', door3: '#1b2140', door4: '#121833', lamp: '#00e436', sign: '#dfe5f0',
  // アイテム
  cry1: '#ffffff', cry2: '#9ff3ff', cry3: '#29d3ff', cry4: '#1a7fd6', cry5: '#0f3f7a',
  pw1: '#d6ffe0', pw2: '#5dff8a', pw3: '#00c94a', pw4: '#00813a',
};

// ---- 描くための道具 ----
export function grid(w, h) {
  return Array.from({ length: h }, () => Array(w).fill(null));
}
function set(G, x, y, c) {
  x = Math.round(x);
  y = Math.round(y);
  if (y >= 0 && y < G.length && x >= 0 && x < G[0].length) G[y][x] = c;
}
function rect(G, x0, y0, x1, y1, c) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(G, x, y, c);
}
// 形(test)の中を、場所ごとの色(color)で塗る
function shape(G, x0, y0, x1, y1, test, color) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (test(x, y)) set(G, x, y, color(x, y));
}
// 太さのある線
function thick(G, xa, ya, xb, yb, w, c) {
  const n = Math.max(Math.abs(xb - xa), Math.abs(yb - ya), 1);
  for (let i = 0; i <= n; i++) {
    const x = xa + ((xb - xa) * i) / n;
    const y = ya + ((yb - ya) * i) / n;
    rect(G, Math.round(x), Math.round(y), Math.round(x) + w - 1, Math.round(y), c);
  }
}
// 外側に1ドットの輪郭を付ける
function outline(G, c) {
  const H = G.length;
  const W = G[0].length;
  const add = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (G[y][x]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => G[y + dy]?.[x + dx])) add.push([x, y]);
    }
  for (const [x, y] of add) G[y][x] = c;
  return G;
}
// 角の丸い四角の中か
const inRound = (x, y, x0, y0, x1, y1, r) => {
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
  const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.5;
};

// ---- 主人公「ガード」(右向き) ----
// 足の形: [付け根x, つま先x, 足の裏y] を、奥の足・手前の足の順で
const LEGS = {
  stand: [[10, 10, 31], [15, 15, 31]],
  run0: [[10, 7, 30], [15, 18, 31]],
  run1: [[11, 12, 31], [14, 14, 29]],
  run2: [[10, 16, 31], [15, 9, 30]],
  run3: [[11, 11, 29], [14, 14, 31]],
  jump: [[10, 8, 28], [15, 17, 29]],
  fall: [[10, 9, 30], [15, 16, 31]],
};

export function guard(pose = 'stand', bob = 0, blink = false) {
  const G = grid(32, 32);
  const F = (x, y, c) => set(G, x, y + bob, c);
  const R = (x0, y0, x1, y1, c) => rect(G, x0, y0 + bob, x1, y1 + bob, c);

  // 足(体より先に描いて、体の後ろに回す)
  const [back, front] = LEGS[pose];
  for (const [[hip, foot, sole], col] of [[back, C.b5], [front, C.b4]]) {
    thick(G, hip, 27, foot, sole - 2, 3, col);
    rect(G, foot - 1, sole - 1, foot + 2, sole, col);
    set(G, foot + 2, sole - 1, C.b3); // つま先の光
  }

  // アンテナ
  F(13, 3, C.red); F(14, 3, C.redHi); F(13, 4, C.red); F(14, 4, C.red);
  R(13, 5, 14, 6, C.b4);

  // 頭: 左上を明るく、右下を暗く
  for (let y = 7; y <= 19; y++)
    for (let x = 6; x <= 22; x++) {
      if (!inRound(x, y, 6, 7, 22, 19, 2.6)) continue;
      const s = (x - 6) / 16 + (y - 7) / 12;
      F(x, y, s < 0.35 ? C.b1 : s < 1.3 ? C.b2 : C.b3);
    }
  R(8, 8, 12, 8, C.hl); F(7, 9, C.hl); F(7, 10, C.hl);
  // バイザーと目
  for (let y = 11; y <= 16; y++) for (let x = 9; x <= 22; x++) if (inRound(x, y, 9, 11, 22, 16, 1.2)) F(x, y, C.visor);
  R(11, 12, 15, 12, C.vref);
  for (const ex of [15, 19]) {
    if (blink) {
      R(ex, 14, ex + 1, 14, C.eye);
    } else {
      R(ex, 13, ex + 1, 15, C.eye);
      F(ex, 13, C.eyeW);
    }
  }
  R(9, 18, 21, 18, C.b3);

  // 体
  for (let y = 20; y <= 27; y++)
    for (let x = 9; x <= 19; x++) {
      if ((x === 9 || x === 19) && y === 27) continue;
      const s = (x - 9) / 10;
      F(x, y, s < 0.25 ? C.b1 : s < 0.7 ? C.b2 : C.b3);
    }
  R(9, 24, 19, 24, C.b4);
  F(12, 24, C.gold2); F(13, 24, C.gold3);
  R(10, 21, 10, 22, C.hl);

  // 盾
  const sx0 = 18, sx1 = 28, sy0 = 18, sy1 = 29;
  for (let y = sy0; y <= sy1; y++) {
    const k = y - sy0;
    const inset = k < 6 ? 0 : Math.ceil((k - 5) * 0.8);
    for (let x = sx0 + inset; x <= sx1 - inset; x++) {
      const rel = (x - sx0) / (sx1 - sx0);
      F(x, y, rel < 0.18 ? C.gold1 : rel < 0.6 ? C.gold2 : rel < 0.85 ? C.gold3 : C.gold4);
    }
  }
  R(sx0 + 1, sy0, sx1 - 1, sy0, C.gold1);
  for (const [x, y] of [[20, 22], [21, 23], [22, 24], [23, 23], [24, 22], [25, 21], [26, 20]]) {
    F(x, y, C.ol);
    F(x, y + 1, C.ol);
  }

  return outline(G, C.ol);
}

// ---- 敵「フィッシングメール」: 釣り針つきの封筒。噛みつく口 ----
export function phish(frame = 0) {
  const G = grid(32, 32);
  const sway = frame ? 2 : 0;
  // 釣り糸と針
  rect(G, 16 + sway, 0, 16 + sway, 9, C.hook2);
  for (const [x, y] of [[16, 10], [16, 11], [15, 12], [14, 12], [13, 11], [13, 10], [13, 9]]) set(G, x + sway, y, C.hook1);
  set(G, 12 + sway, 9, C.hook1);
  // 封筒の体(少し弾む)
  const top = frame ? 15 : 14;
  for (let y = top; y <= 29; y++)
    for (let x = 4; x <= 27; x++) {
      if (!inRound(x, y, 4, top, 27, 29, 2)) continue;
      const s = (x - 4) / 23 + (y - top) / 15;
      set(G, x, y, s < 0.4 ? C.paper1 : s < 1.25 ? C.paper2 : C.paper3);
    }
  // ふた(V字)
  for (let i = 0; i <= 10; i++) {
    set(G, 5 + i, top + 1 + Math.floor(i * 0.6), C.paper4);
    set(G, 26 - i, top + 1 + Math.floor(i * 0.6), C.paper4);
  }
  // 怒った目
  const ey = top + 6;
  rect(G, 9, ey, 11, ey + 2, C.pol); set(G, 10, ey, C.paper1);
  rect(G, 20, ey, 22, ey + 2, C.pol); set(G, 21, ey, C.paper1);
  for (const [x, y] of [[8, ey - 2], [9, ey - 2], [10, ey - 1], [11, ey - 1], [23, ey - 2], [22, ey - 2], [21, ey - 1], [20, ey - 1]]) set(G, x, y, C.pol);
  // 口と歯
  rect(G, 10, top + 10, 21, top + 12, C.mouth);
  rect(G, 11, top + 13, 20, top + 13, C.mouth);
  for (const x of [11, 14, 17, 20]) set(G, x, top + 10, C.paper1);
  for (const x of [12, 15, 18]) set(G, x, top + 12, C.paper1);
  // 足
  const fo = frame ? 1 : 0;
  rect(G, 8 + fo, 30, 10 + fo, 31, C.paper4);
  rect(G, 21 - fo, 30, 23 - fo, 31, C.paper4);
  return outline(G, C.pol);
}

// ---- メール便(本物も偽物も同じ姿。見分けるのは頭の上の札だけ) ----
// にこやかな封筒に、配達員の帽子と切手
export function mailer(frame = 0) {
  const G = grid(32, 32);
  const top = frame ? 13 : 12;
  // 帽子
  rect(G, 10, top - 5, 21, top - 2, C.b3);
  rect(G, 10, top - 5, 21, top - 5, C.b1);
  rect(G, 8, top - 2, 23, top - 1, C.b4);
  set(G, 15, top - 4, C.gold2);
  set(G, 16, top - 4, C.gold2);
  // 封筒の体
  for (let y = top; y <= 29; y++)
    for (let x = 4; x <= 27; x++) {
      if (!inRound(x, y, 4, top, 27, 29, 2)) continue;
      const s = (x - 4) / 23 + (y - top) / 17;
      set(G, x, y, s < 0.4 ? C.paper1 : s < 1.25 ? C.paper2 : C.paper3);
    }
  for (let i = 0; i <= 10; i++) {
    set(G, 5 + i, top + 1 + Math.floor(i * 0.6), C.paper4);
    set(G, 26 - i, top + 1 + Math.floor(i * 0.6), C.paper4);
  }
  // 切手
  rect(G, 21, top + 2, 25, top + 6, C.red);
  rect(G, 22, top + 3, 24, top + 5, C.redHi);
  // にこやかな目と口
  const ey = top + 8;
  rect(G, 10, ey, 11, ey + 1, C.pol);
  rect(G, 19, ey, 20, ey + 1, C.pol);
  rect(G, 8, ey + 3, 9, ey + 3, '#f59a9a');
  rect(G, 21, ey + 3, 22, ey + 3, '#f59a9a');
  set(G, 13, ey + 3, C.pol);
  rect(G, 14, ey + 4, 16, ey + 4, C.pol);
  set(G, 17, ey + 3, C.pol);
  // 足
  const fo = frame ? 1 : 0;
  rect(G, 8 + fo, 30, 10 + fo, 31, C.paper4);
  rect(G, 21 - fo, 30, 23 - fo, 31, C.paper4);
  return outline(G, C.pol);
}

// ---- 敵「Password1!」: 硬そうな鋼の兜。じつはすぐ割れる ----
export function pass(frame = 0) {
  const G = grid(32, 32);
  const cx = 15.5;
  shape(
    G, 4, 9, 27, 28,
    (x, y) => {
      const w = y < 17 ? Math.sqrt(Math.max(0, 1 - ((17 - y) / 8) ** 2)) * 11.5 : 11.5;
      return Math.abs(x - cx) <= w;
    },
    (x, y) => {
      const s = (x - 4) / 23 + (y - 9) / 19;
      return s < 0.35 ? C.st1 : s < 0.8 ? C.st2 : s < 1.3 ? C.st3 : C.st4;
    },
  );
  rect(G, 8, 11, 11, 11, C.st1);
  set(G, 7, 12, C.st1);
  // 目のすき間と赤い目
  rect(G, 7, 17, 24, 19, C.slit);
  const glow = frame ? C.redHi : C.red;
  rect(G, 10, 18, 12, 18, glow);
  rect(G, 19, 18, 21, 18, glow);
  // 帯・びょう・胸の「****」プレート
  rect(G, 4, 22, 27, 22, C.st5);
  for (const x of [7, 24]) set(G, x, 24, C.gold2);
  rect(G, 11, 24, 20, 27, C.gold2);
  rect(G, 11, 27, 20, 27, C.gold3);
  for (const x of [12, 14, 16, 18]) rect(G, x, 25, x + 1, 26, C.st5);
  // 足
  const fo = frame ? 1 : 0;
  rect(G, 8 + fo, 29, 11 + fo, 31, C.pink2);
  rect(G, 20 - fo, 29, 23 - fo, 31, C.pink2);
  return outline(G, C.sol);
}

// 鎧が割れたあと: 中身はやわらかいピンク。汗をかいて逃げ回る
export function soft(frame = 0) {
  const G = grid(32, 32);
  const rx = frame ? 11 : 10;
  const ry = frame ? 6.5 : 7.5;
  const cy = 31 - ry;
  shape(
    G, 2, 14, 29, 31,
    (x, y) => ((x - 15.5) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1,
    (x, y) => {
      const s = (x - 15.5 + rx) / (2 * rx) + (y - cy + ry) / (2 * ry);
      return s < 0.5 ? C.pink1 : s < 1.2 ? C.pink2 : C.pink3;
    },
  );
  const ey = Math.round(cy - 1);
  rect(G, 10, ey, 12, ey + 2, C.ol); set(G, 10, ey, '#ffffff');
  rect(G, 19, ey, 21, ey + 2, C.ol); set(G, 19, ey, '#ffffff');
  for (let x = 13; x <= 18; x++) set(G, x, ey + 4 + ((x + frame) % 2), C.pink4);
  // 汗
  rect(G, 25, ey - 5, 26, ey - 3, C.eye);
  set(G, 25, ey - 6, C.eye);
  set(G, 25, ey - 5, '#ffffff');
  return outline(G, C.pink4);
}

// ---- 地形(32×32) ----
// 床(電子基板)。top=いちばん上の段か / v=見た目の変化(0か1)
export function ground(top, v = 0) {
  const G = grid(32, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) set(G, x, y, y < 16 ? C.pcb2 : y < 26 ? C.pcb1 : C.pcb0);
  const lines = v
    ? [[[3, 8], [12, 8], [12, 20], [24, 20]], [[28, 4], [28, 14], [20, 14]]]
    : [[[6, 31], [6, 18], [18, 18], [18, 6]], [[24, 31], [24, 24], [30, 24]]];
  for (const pts of lines) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      rect(G, Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), C.pcbLine);
    }
    const [ex, ey] = pts[pts.length - 1];
    rect(G, ex - 1, ey - 1, ex + 1, ey + 1, C.pad2);
    set(G, ex, ey, C.pad1);
  }
  if (top) {
    rect(G, 0, 0, 31, 0, C.pcbHi);
    rect(G, 0, 1, 31, 2, C.pcbEdge);
    rect(G, 0, 3, 31, 3, C.b3);
    for (let x = v ? 3 : 11; x < 32; x += 16) rect(G, x, 1, x + 1, 2, C.pcbHi);
  }
  return G;
}

// データブロック(ピンクのパネルに「101」)
export function block() {
  const G = grid(32, 32);
  rect(G, 0, 0, 31, 31, C.mag3);
  rect(G, 0, 0, 31, 1, C.mag1);
  rect(G, 0, 0, 1, 31, C.mag1);
  rect(G, 0, 30, 31, 31, C.mag5);
  rect(G, 30, 0, 31, 31, C.mag5);
  rect(G, 2, 2, 29, 2, C.mag2);
  rect(G, 2, 2, 2, 29, C.mag2);
  rect(G, 4, 6, 27, 25, C.mag4);
  // 1 0 1
  const on = C.mag1;
  rect(G, 7, 10, 8, 21, on); set(G, 6, 11, on);
  rect(G, 12, 10, 18, 11, on); rect(G, 12, 20, 18, 21, on); rect(G, 12, 10, 13, 21, on); rect(G, 17, 10, 18, 21, on);
  rect(G, 23, 10, 24, 21, on); set(G, 22, 11, on);
  rect(G, 4, 6, 27, 6, C.mag5);
  rect(G, 4, 15, 27, 15, C.mag3); // 走査線
  return G;
}

// アイテムブロック(金色に「!」)。shine で光の筋が動く
export function qblock(shine = -1) {
  const G = grid(32, 32);
  rect(G, 0, 0, 31, 31, C.gold2);
  rect(G, 0, 0, 31, 1, C.gold1);
  rect(G, 0, 0, 1, 31, C.gold1);
  rect(G, 0, 29, 31, 31, C.gold4);
  rect(G, 29, 0, 31, 31, C.gold4);
  rect(G, 2, 27, 28, 28, C.gold3);
  rect(G, 27, 2, 28, 28, C.gold3);
  for (const [x, y] of [[4, 4], [25, 4], [4, 25], [25, 25]]) {
    rect(G, x, y, x + 1, y + 1, C.gold3);
    set(G, x, y, C.gold1);
  }
  // 「!」(右下に影を落として、浮き彫りに見せる)
  const bang = (dx, dy, c) => {
    rect(G, 14 + dx, 6 + dy, 17 + dx, 15 + dy, c);
    rect(G, 15 + dx, 16 + dy, 16 + dx, 18 + dy, c);
    rect(G, 14 + dx, 21 + dy, 17 + dx, 24 + dy, c);
  };
  bang(1, 1, C.gold3);
  bang(0, 0, C.gold4);
  rect(G, 14, 6, 17, 6, '#d98a1c');
  if (shine >= 0) for (let i = 0; i < 6; i++) set(G, shine + i, 2 + i * 1, C.gold1), set(G, shine + i + 1, 2 + i * 1, C.gold1);
  return G;
}

// 使い終わったブロック
export function used() {
  const G = grid(32, 32);
  rect(G, 0, 0, 31, 31, C.br3);
  rect(G, 0, 0, 31, 1, C.br1);
  rect(G, 0, 0, 1, 31, C.br1);
  rect(G, 0, 30, 31, 31, C.br4);
  rect(G, 30, 0, 31, 31, C.br4);
  rect(G, 4, 4, 27, 27, C.br2);
  for (const [x, y] of [[4, 4], [26, 4], [4, 26], [26, 26]]) rect(G, x, y, x + 1, y + 1, C.br4);
  return G;
}

// 判断シーンの端末
export function terminal(on = true, tick = 0) {
  const G = grid(32, 32);
  // モニター
  for (let y = 3; y <= 22; y++)
    for (let x = 2; x <= 29; x++) {
      if (!inRound(x, y, 2, 3, 29, 22, 2)) continue;
      set(G, x, y, (x - 2) / 27 + (y - 3) / 19 < 0.5 ? C.bez1 : C.bez2);
    }
  rect(G, 5, 6, 26, 19, on ? C.scr1 : C.door4);
  if (on) {
    rect(G, 5, 6, 26, 7, C.scr2);
    const rows = [[7, 18], [7, 13], [7, 21], [7, 15]];
    rows.forEach(([x0, x1], i) => rect(G, x0, 9 + i * 3, (i === (tick % 4) ? x1 : x1 - 2), 10 + i * 3, i === 0 ? C.scr4 : C.scr3));
    rect(G, 22, 9, 24, 10, C.red);
  } else {
    rect(G, 7, 8, 9, 8, C.door2);
  }
  rect(G, 3, 4, 8, 4, '#c3cbe0');
  // 台と、キーボード
  rect(G, 13, 23, 18, 24, C.bez3);
  rect(G, 10, 25, 21, 25, C.bez2);
  rect(G, 3, 26, 28, 30, C.key1);
  rect(G, 3, 30, 28, 30, C.key2);
  for (let x = 5; x <= 26; x += 3) {
    rect(G, x, 27, x + 1, 27, C.key2);
    rect(G, x + 1, 29, x + 2, 29, C.key2);
  }
  return outline(G, C.ol);
}

// 扉(32×64)。本物も偽物も同じ見た目
export function door() {
  const G = grid(32, 64);
  rect(G, 0, 0, 31, 63, C.door2);
  rect(G, 0, 0, 31, 1, C.door1);
  rect(G, 0, 0, 1, 63, C.door1);
  rect(G, 30, 0, 31, 63, C.door3);
  // 看板
  rect(G, 4, 4, 27, 13, C.sign);
  rect(G, 4, 13, 27, 13, '#a9b3c9');
  rect(G, 6, 6, 9, 11, C.b3); // 鍵のマーク
  rect(G, 7, 5, 8, 6, C.b3);
  rect(G, 11, 7, 24, 7, C.bez3);
  rect(G, 11, 10, 20, 10, C.bez2);
  // 扉の板(左右に開く)
  rect(G, 4, 17, 27, 63, C.door4);
  rect(G, 5, 18, 14, 63, C.door3);
  rect(G, 17, 18, 26, 63, C.door3);
  rect(G, 15, 17, 16, 63, C.pcbEdge);
  rect(G, 15, 17, 15, 63, C.pcbHi);
  for (let y = 26; y < 64; y += 10) {
    rect(G, 6, y, 13, y, C.door2);
    rect(G, 18, y, 25, y, C.door2);
  }
  rect(G, 22, 38, 24, 40, C.lamp);
  set(G, 22, 38, '#c8ffd6');
  return G;
}

// データの粒(16×16)。回転して見えるように、幅の違う4コマ
export function crystal(frame = 0) {
  const G = grid(16, 16);
  const wk = [1, 0.6, 0.2, 0.6][frame];
  shape(
    G, 0, 0, 15, 15,
    (x, y) => Math.abs(x - 7.5) / Math.max(wk, 0.15) + Math.abs(y - 7.5) <= 7,
    (x, y) => {
      if (x < 7.5 && y < 7.5) return C.cry2;
      if (x >= 7.5 && y < 7.5) return C.cry3;
      if (x < 7.5) return C.cry3;
      return C.cry4;
    },
  );
  if (wk > 0.5) {
    set(G, 6, 4, C.cry1);
    set(G, 6, 5, C.cry1);
    set(G, 5, 6, C.cry1);
  }
  return outline(G, C.cry5);
}

// 「とりあえず再起動」(緑の電源マーク)
export function reboot() {
  const G = grid(32, 32);
  shape(
    G, 0, 0, 31, 31,
    (x, y) => {
      const d = Math.hypot(x - 15.5, y - 16.5);
      return d >= 7.5 && d <= 11 && !(y < 12 && Math.abs(x - 15.5) < 4.5);
    },
    (x, y) => (x + y < 30 ? C.pw2 : C.pw3),
  );
  rect(G, 14, 3, 17, 16, C.pw2);
  rect(G, 14, 3, 14, 16, C.pw1);
  rect(G, 8, 9, 9, 10, C.pw1);
  return outline(G, C.pw4);
}

// 多要素認証の盾(HUD・カード用)
export function shield() {
  const G = grid(32, 32);
  for (let y = 3; y <= 29; y++) {
    const k = y - 3;
    const inset = k < 12 ? 0 : Math.ceil((k - 11) * 0.75);
    for (let x = 5 + inset; x <= 26 - inset; x++) {
      const rel = (x - 5) / 21;
      set(G, x, y, rel < 0.18 ? C.hl : rel < 0.6 ? C.b2 : rel < 0.85 ? C.b3 : C.b4);
    }
  }
  rect(G, 6, 3, 25, 3, C.hl);
  for (const [x, y] of [[9, 15], [10, 16], [11, 17], [12, 18], [13, 19], [14, 18], [15, 17], [16, 16], [17, 15], [18, 14], [19, 13], [20, 12], [21, 11]]) {
    rect(G, x, y, x, y + 2, '#ffffff');
  }
  return outline(G, C.ol);
}

// ---- 手がかりアイテム ----
// 公式ブックマーク(青いしおりに金の星)
export function bookmark() {
  const G = grid(32, 32);
  shape(
    G, 9, 3, 22, 28,
    (x, y) => y <= 22 || Math.abs(x - 15.5) >= (y - 22) * 1.2,
    (x) => (x < 12 ? C.hl : x < 19 ? C.b2 : C.b3),
  );
  // 星
  const star = [[15, 8], [16, 8], [14, 10], [15, 10], [16, 10], [17, 10], [12, 11], [13, 11], [14, 11], [15, 11], [16, 11], [17, 11], [18, 11], [19, 11], [14, 12], [15, 12], [16, 12], [17, 12], [13, 13], [14, 13], [17, 13], [18, 13], [15, 9], [16, 9], [13, 14], [18, 14]];
  for (const [x, y] of star) set(G, x, y + 2, C.gold2);
  set(G, 15, 10, C.gold1);
  set(G, 15, 11, C.gold1);
  return outline(G, C.ol);
}

// 連絡先台帳(緑の手帳。表紙に電話のマーク)
export function ledger() {
  const G = grid(32, 32);
  rect(G, 6, 5, 25, 27, '#1f7a5a');
  rect(G, 6, 5, 8, 27, '#165c44');
  rect(G, 23, 6, 26, 27, '#f4efe6');
  for (let y = 8; y < 27; y += 3) rect(G, 24, y, 26, y, '#c9b8d6');
  rect(G, 10, 9, 21, 16, '#e6f7ee');
  // 電話のマーク
  rect(G, 12, 11, 13, 14, '#165c44');
  rect(G, 18, 11, 19, 14, '#165c44');
  rect(G, 12, 11, 19, 11, '#165c44');
  rect(G, 14, 13, 17, 14, '#165c44');
  rect(G, 10, 19, 21, 19, '#7fd8b0');
  rect(G, 10, 22, 18, 22, '#7fd8b0');
  rect(G, 9, 6, 22, 6, '#3fae84');
  return outline(G, C.ol);
}

// ---- 登場人物の顔(会話と判断シーンに出る) ----
const SKIN = ['#ffe0c2', '#f2c9a0', '#d9a77e'];
function faceBase(G, cx, cy, rx, ry) {
  shape(
    G, 0, 0, 31, 31,
    (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1,
    (x, y) => {
      const s = (x - cx) / rx + (y - cy) / ry * 0.6;
      return s < -0.6 ? SKIN[0] : s < 0.55 ? SKIN[1] : SKIN[2];
    },
  );
}

// 黒田先輩: ぼさぼさの黒髪、眼鏡、目の下のくま、パーカー
export function kuroda() {
  const G = grid(32, 32);
  shape(G, 2, 23, 29, 31, (x, y) => Math.abs(x - 15.5) <= 6 + (y - 23) * 1.4, (x) => (x < 12 ? '#4a5370' : x < 20 ? '#3a4158' : '#2a3044'));
  rect(G, 12, 23, 19, 24, '#2a3044');
  rect(G, 13, 21, 18, 23, SKIN[2]);
  faceBase(G, 15.5, 14, 7.5, 8.5);
  // 髪
  shape(G, 5, 1, 27, 12, (x, y) => ((x - 15.5) / 9.5) ** 2 + ((y - 11) / 8) ** 2 <= 1 && (y < 8 || x < 9 || x > 22), (x, y) => ((x + y) % 5 === 0 ? '#3d3d52' : '#24243a'));
  for (const [x, y] of [[8, 3], [11, 2], [14, 1], [17, 2], [20, 2], [23, 4], [7, 6]]) rect(G, x, y, x + 1, y + 1, '#24243a');
  for (let x = 9; x <= 22; x++) if (x % 3) set(G, x, 8, '#24243a');
  // 眼鏡
  for (const lx of [9, 17]) {
    rect(G, lx, 12, lx + 5, 12, '#14141f');
    rect(G, lx, 16, lx + 5, 16, '#14141f');
    rect(G, lx, 12, lx, 16, '#14141f');
    rect(G, lx + 5, 12, lx + 5, 16, '#14141f');
    rect(G, lx + 1, 13, lx + 4, 15, '#cfeaff');
  }
  rect(G, 15, 13, 16, 13, '#14141f');
  // 眠そうな目と、くま
  rect(G, 11, 14, 13, 14, '#24243a');
  rect(G, 19, 14, 21, 14, '#24243a');
  rect(G, 10, 18, 13, 18, '#b98a8a');
  rect(G, 18, 18, 21, 18, '#b98a8a');
  rect(G, 14, 20, 17, 20, '#9a5a4a');
  return outline(G, '#0b0d18');
}

// 佐藤さん: 茶色のボブ、カーディガン
export function sato() {
  const G = grid(32, 32);
  shape(G, 2, 23, 29, 31, (x, y) => Math.abs(x - 15.5) <= 6 + (y - 23) * 1.4, (x) => (x < 11 ? '#f1d9b5' : x < 21 ? '#e2c497' : '#c9a777'));
  rect(G, 13, 23, 18, 27, '#ffffff');
  rect(G, 15, 24, 16, 31, '#e2c497');
  rect(G, 13, 21, 18, 23, SKIN[2]);
  // 後ろの髪(ボブ)
  shape(G, 4, 2, 27, 23, (x, y) => ((x - 15.5) / 10.5) ** 2 + ((y - 12) / 10) ** 2 <= 1 && y <= 22, (x) => (x < 10 ? '#8a4f36' : '#6b3b2a'));
  faceBase(G, 15.5, 15, 7, 8);
  // 前髪
  shape(G, 6, 4, 25, 11, (x, y) => ((x - 15.5) / 9.5) ** 2 + ((y - 12) / 8.5) ** 2 <= 1 && y <= 10 - ((x * 7) % 3 === 0 ? 1 : 0), (x) => (x < 11 ? '#8a4f36' : '#6b3b2a'));
  rect(G, 9, 5, 12, 5, '#b3714f');
  // 目・頬・口
  for (const ex of [11, 18]) {
    rect(G, ex, 14, ex + 2, 16, '#2a1a1a');
    set(G, ex, 14, '#ffffff');
  }
  rect(G, 10, 18, 11, 18, '#f59a9a');
  rect(G, 20, 18, 21, 18, '#f59a9a');
  rect(G, 14, 20, 17, 20, '#c45a5a');
  set(G, 13, 19, '#c45a5a');
  set(G, 18, 19, '#c45a5a');
  return outline(G, '#2a140c');
}

// アングラー: 深いフード、赤く光る目、釣り針の飾り
export function angler(blink = false) {
  const G = grid(32, 32);
  shape(G, 1, 20, 30, 31, (x, y) => Math.abs(x - 15.5) <= 8 + (y - 20) * 1.3, (x) => (x < 10 ? '#3a2d5c' : x < 22 ? '#2a2140' : '#1b1530'));
  shape(
    G, 3, 2, 28, 27,
    (x, y) => ((x - 15.5) / 11) ** 2 + ((y - 15) / 12.5) ** 2 <= 1,
    (x, y) => {
      const s = (x - 15.5) / 11 + (y - 15) / 12.5;
      return s < -0.5 ? '#4b3a78' : s < 0.5 ? '#2f2550' : '#1f1838';
    },
  );
  shape(G, 8, 9, 23, 25, (x, y) => ((x - 15.5) / 6.5) ** 2 + ((y - 17) / 7.5) ** 2 <= 1, () => '#07050e');
  if (!blink) {
    rect(G, 11, 15, 13, 16, '#ff3b5c');
    rect(G, 18, 15, 20, 16, '#ff3b5c');
    set(G, 11, 15, '#ffc2cf');
    set(G, 18, 15, '#ffc2cf');
  } else {
    rect(G, 11, 16, 13, 16, '#ff3b5c');
    rect(G, 18, 16, 20, 16, '#ff3b5c');
  }
  for (const x of [13, 15, 17]) set(G, x, 21, '#c9d2e3');
  // 釣り針の飾り
  rect(G, 27, 3, 27, 12, C.hook2);
  for (const [x, y] of [[27, 13], [27, 14], [26, 15], [25, 15], [24, 14], [24, 13], [24, 12]]) set(G, x, y, C.hook1);
  return outline(G, '#05030a');
}

// ---- オープニングムービーの主人公(情シスの新人。右向き、全身) ----
// frame: 0 立ち / 1・2 歩き
export function hero(frame = 0) {
  const G = grid(32, 32);
  const legs = [[[13, 13], [17, 17]], [[12, 14], [18, 16]], [[14, 12], [16, 18]]][frame];
  // 足(ズボンと靴)
  legs.forEach(([top, foot], i) => {
    thick(G, top, 22, foot, 28, 3, i ? '#2a3256' : '#222844');
    rect(G, foot - 1, 29, foot + 2, 30, '#15151f');
  });
  // 体(白いシャツ)
  for (let y = 14; y <= 22; y++) for (let x = 11; x <= 20; x++) {
    if ((x === 11 || x === 20) && y === 14) continue;
    set(G, x, y, x < 14 ? '#ffffff' : x < 18 ? '#e6ecf5' : '#c3cbe0');
  }
  rect(G, 11, 22, 20, 22, '#222844'); // ベルト
  // 社員証のストラップと、社員証
  rect(G, 15, 14, 15, 18, C.b3);
  rect(G, 14, 19, 17, 21, '#ffffff');
  rect(G, 15, 20, 16, 20, C.b2);
  // 腕(歩くと振る)
  const sw = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  rect(G, 19, 15 + 0, 20, 20 + sw, '#d6dcea');
  rect(G, 19, 21 + sw, 20, 22 + sw, SKIN[1]);
  // 頭
  for (let y = 4; y <= 13; y++) for (let x = 11; x <= 20; x++) {
    if (!inRound(x, y, 11, 4, 20, 13, 3)) continue;
    set(G, x, y, x > 17 ? SKIN[0] : SKIN[1]);
  }
  // 髪(黒に近い茶)
  shape(G, 10, 2, 21, 9, (x, y) => inRound(x, y, 10, 2, 21, 12, 4) && (y < 6 || x < 14), (x, y) => ((x + y) % 4 ? '#3b2a24' : '#55392e'));
  rect(G, 15, 5, 20, 5, '#3b2a24');
  set(G, 20, 6, '#3b2a24');
  // 目と口
  rect(G, 18, 8, 18, 9, '#1a1a24');
  set(G, 19, 11, '#c45a5a');
  set(G, 13, 9, SKIN[2]); // 耳
  return outline(G, '#0b0d18');
}

// すべての絵(形のチェック用)
export function allArt() {
  return {
    'guard.stand': guard('stand'),
    'guard.run0': guard('run0'),
    'guard.jump': guard('jump'),
    phish: phish(0),
    pass: pass(0),
    soft: soft(0),
    ground: ground(true),
    block: block(),
    qblock: qblock(),
    used: used(),
    terminal: terminal(),
    door: door(),
    crystal: crystal(0),
    reboot: reboot(),
    shield: shield(),
    bookmark: bookmark(),
    ledger: ledger(),
    kuroda: kuroda(),
    sato: sato(),
    angler: angler(),
    mailer: mailer(0),
    hero0: hero(0),
    hero1: hero(1),
  };
}
