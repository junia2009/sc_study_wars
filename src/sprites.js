// art.js の文字のドット絵を、描ける画像(canvas)に変える。
import * as ART from './art.js';
import { PALETTE } from './art.js';

export const TILE = 16;

function fromRows(rows) {
  const c = document.createElement('canvas');
  c.width = rows[0].length;
  c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const ch = r[x];
      if (ch === '.') continue;
      g.fillStyle = PALETTE[parseInt(ch, 16)];
      g.fillRect(x, y, 1, 1);
    }
  });
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
function pair(rows) {
  const r = fromRows(rows);
  return { r, l: mirror(r) };
}

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g);
  return c;
}

const P = (i) => PALETTE[i];

export function buildSprites() {
  const S = {
    guard: {
      stand: pair(ART.GUARD.stand),
      run: ART.GUARD.run.map(pair),
      jump: pair(ART.GUARD.jump),
    },
    phish: ART.PHISH.map(pair),
    pass: ART.PASS.map(pair),
    soft: ART.SOFT.map(pair),
    qblock: fromRows(ART.QBLOCK),
    used: fromRows(ART.USED),
    terminal: fromRows(ART.TERMINAL),
    terminalOff: fromRows(ART.TERMINAL_OFF),
    coin: fromRows(ART.COIN),
    reboot: fromRows(ART.REBOOT),
  };

  // 床(電子基板)。上の段と中の段の2種類
  S.groundTop = canvas(16, 16, (g) => {
    g.fillStyle = P(1);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = P(12);
    g.fillRect(0, 0, 16, 2);
    g.fillStyle = P(7);
    g.fillRect(0, 0, 16, 1);
    g.fillStyle = P(13);
    g.fillRect(2, 6, 5, 1);
    g.fillRect(6, 6, 1, 5);
    g.fillRect(6, 10, 7, 1);
    g.fillStyle = P(10);
    g.fillRect(12, 9, 2, 2);
    g.fillRect(1, 5, 2, 2);
  });
  S.ground = canvas(16, 16, (g) => {
    g.fillStyle = P(1);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = P(13);
    g.fillRect(3, 0, 1, 7);
    g.fillRect(3, 7, 8, 1);
    g.fillRect(10, 7, 1, 9);
    g.fillStyle = P(5);
    g.fillRect(0, 15, 16, 1);
  });

  // データブロック
  S.block = canvas(16, 16, (g) => {
    g.fillStyle = P(2);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = P(14);
    g.fillRect(0, 0, 16, 1);
    g.fillRect(0, 0, 1, 16);
    g.fillStyle = P(0);
    g.fillRect(0, 15, 16, 1);
    g.fillRect(15, 0, 1, 16);
    g.fillStyle = P(14);
    // 0 と 1 の模様
    g.fillRect(3, 4, 1, 4);
    g.fillRect(6, 4, 3, 1);
    g.fillRect(6, 7, 3, 1);
    g.fillRect(6, 4, 1, 4);
    g.fillRect(8, 4, 1, 4);
    g.fillRect(11, 4, 1, 4);
    g.fillRect(3, 10, 3, 1);
    g.fillRect(3, 12, 3, 1);
    g.fillRect(3, 10, 1, 3);
    g.fillRect(5, 10, 1, 3);
    g.fillRect(9, 10, 1, 3);
    g.fillRect(12, 10, 1, 3);
  });

  // 扉(16×32)
  S.door = canvas(16, 32, (g) => {
    g.fillStyle = P(5);
    g.fillRect(0, 0, 16, 32);
    g.fillStyle = P(6);
    g.fillRect(2, 2, 12, 5); // 看板
    g.fillStyle = P(1);
    g.fillRect(3, 4, 2, 1);
    g.fillRect(6, 4, 6, 1);
    g.fillStyle = P(0);
    g.fillRect(2, 9, 12, 23);
    g.fillStyle = P(1);
    g.fillRect(3, 10, 10, 22);
    g.fillStyle = P(12);
    g.fillRect(7, 10, 2, 22);
    g.fillStyle = P(11);
    g.fillRect(11, 19, 1, 2); // ランプ
  });

  // 多要素認証の盾(HUD とカード用)
  S.shield = canvas(16, 16, (g) => {
    g.fillStyle = P(12);
    g.fillRect(3, 2, 10, 8);
    g.fillRect(4, 10, 8, 2);
    g.fillRect(6, 12, 4, 2);
    g.fillStyle = P(7);
    g.fillRect(7, 4, 2, 6);
    g.fillRect(5, 6, 6, 2);
  });

  return S;
}

// カードの絵などに使う、大きく描いた画像の data URL
export function spriteURL(c, scale = 4) {
  const big = document.createElement('canvas');
  big.width = c.width * scale;
  big.height = c.height * scale;
  const g = big.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(c, 0, 0, big.width, big.height);
  return big.toDataURL();
}
