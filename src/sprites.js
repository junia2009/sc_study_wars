// art.js の絵を、描ける画像(canvas)に変える。
import * as A from './art.js';

export const TILE = 16; // 1マスの大きさ(ゲームの計算で使う単位)
export const RES = 2; // 画面の細かさ。1単位を 2×2 ドットで描く(絵は 32×32 ドット = 1マス)

function toCanvas(G) {
  const c = document.createElement('canvas');
  c.width = G[0].length;
  c.height = G.length;
  const g = c.getContext('2d');
  G.forEach((row, y) =>
    row.forEach((col, x) => {
      if (!col) return;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }),
  );
  return c;
}

function mirror(src) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d');
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}

// 右向きと左向きの組
function pair(G) {
  const r = toCanvas(G);
  return { r, l: mirror(r) };
}

export function buildSprites() {
  return {
    guard: {
      stand: [pair(A.guard('stand')), pair(A.guard('stand', 0, true))], // 2枚目はまばたき
      run: [pair(A.guard('run0')), pair(A.guard('run1', -1)), pair(A.guard('run2')), pair(A.guard('run3', -1))],
      jump: pair(A.guard('jump')),
      fall: pair(A.guard('fall')),
    },
    phish: [pair(A.phish(0)), pair(A.phish(1))],
    pass: [pair(A.pass(0)), pair(A.pass(1))],
    soft: [pair(A.soft(0)), pair(A.soft(1))],
    groundTop: [toCanvas(A.ground(true, 0)), toCanvas(A.ground(true, 1))],
    ground: [toCanvas(A.ground(false, 0)), toCanvas(A.ground(false, 1))],
    block: toCanvas(A.block()),
    qblock: [-1, 2, 9, 16, 23].map((s) => toCanvas(A.qblock(s))), // 光の筋が流れる
    used: toCanvas(A.used()),
    terminal: [0, 1, 2, 3].map((t) => toCanvas(A.terminal(true, t))),
    terminalOff: toCanvas(A.terminal(false)),
    door: toCanvas(A.door()),
    crystal: [0, 1, 2, 1].map((f) => toCanvas(A.crystal(f))),
    reboot: toCanvas(A.reboot()),
    shield: toCanvas(A.shield()),
    bookmark: toCanvas(A.bookmark()),
    ledger: toCanvas(A.ledger()),
    hero: [0, 1, 0, 2].map((f) => pair(A.hero(f))),
    anglerBlink: toCanvas(A.angler(true)),
    faces: {
      kuroda: toCanvas(A.kuroda()),
      sato: toCanvas(A.sato()),
      angler: toCanvas(A.angler()),
      guard: toCanvas(A.guard('stand')),
    },
  };
}

// タイトルやカードに使う、大きく描いた画像の data URL
export function spriteURL(c, scale = 3) {
  const big = document.createElement('canvas');
  big.width = c.width * scale;
  big.height = c.height * scale;
  const g = big.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(c, 0, 0, big.width, big.height);
  return big.toDataURL();
}
