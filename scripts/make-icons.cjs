// アプリのアイコンを書き出す: node scripts/make-icons.cjs
//
// 32×32 ドットのドット絵をコードで描き、整数倍に拡大して PNG にする
// (ドットがにじまないように、拡大はすべて最近傍=ぼかさない)。
// 書き出すもの:
//   icons/icon-512.png / icon-192.png   … ふつうのアイコン(角丸などはOSが付ける)
//   icons/maskable-512.png              … 丸や角丸に切り抜かれても欠けないよう、余白を広く取ったもの
//   icons/apple-touch-icon.png (180)    … iPhone のホーム画面用
//   icons/favicon-32.png / favicon-64.png
// Playwright(Chromium)の canvas で描くので、Playwright が入っている環境で動かす。

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ---- ここがドット絵(ブラウザの中で動く) ----
function draw(N, pad) {
  // N×N のマス目に描く。pad はキャラの周りに足す余白(maskable 用)
  const C = {
    bg0: '#080c22', bg1: '#0b1230', bg2: '#0f183e', glow: '#13225a', glow2: '#1a3175', glow3: '#22408f', trace: '#1c2d68', dot: '#4f8cff',
    ol: '#070d26',
    hl: '#bff0ff', b1: '#5cc8ff', b2: '#29adff', b3: '#1a7fd6', b4: '#155ca8',
    visor: '#050a1c', vref: '#2b4a8f', eye: '#7cf7ff', eyeW: '#ffffff',
    gold1: '#fff4b0', gold2: '#ffd23f', gold3: '#f0a420', gold4: '#b8650f',
    red: '#ff3b5c', redHi: '#ff9fb2',
  };
  const px = Array.from({ length: N }, () => Array(N).fill(null)); // 背景
  const fg = Array.from({ length: N }, () => Array(N).fill(null)); // キャラ
  const set = (L, x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) L[y][x] = c; };
  const o = pad; // キャラの描き始め位置
  const cx = N / 2 - 0.5;

  // 背景: 帯状のグラデーション + 中心の光 + 基板の配線
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const t = y / N;
    let c = t < 0.33 ? C.bg0 : t < 0.66 ? C.bg1 : C.bg2;
    // 中心の光: 3段の輪。輪の境目だけ1ドットの市松でなじませる
    const d = Math.hypot(x - cx, y - cx);
    const r = N * 0.46;
    const ring = (k, col) => {
      if (d < r * k) c = col;
      else if (d < r * k + 1 && (x + y) % 2 === 0) c = col;
    };
    ring(1, C.glow);
    ring(0.78, C.glow2);
    ring(0.55, C.glow3);
    px[y][x] = c;
  }
  const traces = [
    [[1, 6], [5, 6], [5, 2]], [[N - 2, 5], [N - 6, 5], [N - 6, 1]],
    [[1, N - 5], [4, N - 5], [4, N - 2]], [[N - 2, N - 7], [N - 5, N - 7], [N - 5, N - 2]],
  ];
  for (const t of traces) {
    for (let i = 0; i < t.length - 1; i++) {
      const [x0, y0] = t[i], [x1, y1] = t[i + 1];
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) set(px, x, y, C.trace);
    }
    const [ex, ey] = t[t.length - 1];
    set(px, ex, ey, C.dot);
  }

  // キャラ(32×32 の座標で描いて o だけずらす)
  const F = (x, y, c) => set(fg, x + o, y + o - 1, c); // 1段上げて、足元に余白を作る
  const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) F(x, y, c); };

  // アンテナ
  F(13, 2, C.red); F(14, 2, C.redHi); F(13, 3, C.red); F(14, 3, C.red);
  rect(13, 4, 14, 5, C.b4);

  // 頭(角の丸い箱)。左上を明るく、右下を暗く
  for (let y = 6; y <= 19; y++) for (let x = 6; x <= 22; x++) {
    const corner = (x < 8 && y < 8 && (8 - x) + (8 - y) > 3) || (x > 20 && y < 8 && (x - 20) + (8 - y) > 3) ||
      (x < 8 && y > 17 && (8 - x) + (y - 17) > 3) || (x > 20 && y > 17 && (x - 20) + (y - 17) > 3);
    if (corner) continue;
    const s = (x - 6) / 16 + (y - 6) / 13;
    F(x, y, s < 0.35 ? C.b1 : s < 1.3 ? C.b2 : C.b3);
  }
  // ハイライト
  rect(8, 7, 12, 7, C.hl); F(7, 8, C.hl); F(7, 9, C.hl); F(8, 8, C.b1);
  // バイザー
  for (let y = 10; y <= 16; y++) for (let x = 9; x <= 22; x++) {
    if ((x === 9 || x === 22) && (y === 10 || y === 16)) continue;
    F(x, y, C.visor);
  }
  rect(11, 11, 15, 11, C.vref); F(10, 12, C.vref);
  // 目(右向き)。光の芯 + にじみ
  for (const ex of [15, 19]) {
    rect(ex, 12, ex + 1, 14, C.eye);
    F(ex, 12, C.eyeW);
  }
  rect(9, 17, 22, 17, C.b4); // あご

  // 体
  for (let y = 20; y <= 27; y++) for (let x = 9; x <= 19; x++) {
    if ((x === 9 || x === 19) && y === 27) continue;
    const s = (x - 9) / 10;
    F(x, y, s < 0.25 ? C.b1 : s < 0.7 ? C.b2 : C.b3);
  }
  rect(9, 24, 19, 24, C.b4); // ベルト
  F(12, 24, C.gold2); F(13, 24, C.gold3);
  rect(10, 21, 10, 22, C.hl);
  rect(10, 28, 12, 29, C.b4); rect(15, 28, 17, 29, C.b4); // 足

  // 盾(上が平ら、下がとがった形)
  const sx0 = 18, sx1 = 28, sy0 = 17, sy1 = 29;
  for (let y = sy0; y <= sy1; y++) {
    const k = y - sy0;
    const inset = k < 7 ? 0 : Math.ceil((k - 6) * 0.8);
    for (let x = sx0 + inset; x <= sx1 - inset; x++) {
      const rel = (x - sx0) / (sx1 - sx0);
      F(x, y, rel < 0.18 ? C.gold1 : rel < 0.6 ? C.gold2 : rel < 0.85 ? C.gold3 : C.gold4);
    }
  }
  rect(sx0 + 1, sy0, sx1 - 1, sy0, C.gold1);
  // 盾の紋章: 太いチェックマーク(守れた、の印)
  const check = [[20, 22], [21, 23], [22, 24], [23, 23], [24, 22], [25, 21], [26, 20]];
  for (const [x, y] of check) { F(x, y, C.ol); F(x, y + 1, C.ol); }

  // 輪郭: キャラの外側に1ドットの縁取り
  const out = fg.map((r) => r.slice());
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (fg[y][x]) continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => fg[y + dy]?.[x + dx]);
    if (n) out[y][x] = C.ol;
  }
  // 重ねる
  return px.map((r, y) => r.map((c, x) => out[y][x] || c));
}

async function main() {
  const outDir = path.join(__dirname, '..', 'icons');
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage();
  // grid: 何マスで描くか / pad: キャラの余白 / scale: 1マスの大きさ / size: 出来上がりの大きさ(余りは背景色で埋める)
  const jobs = [
    { file: 'icon-512.png', grid: 32, pad: 0, scale: 16, size: 512 },
    { file: 'icon-192.png', grid: 32, pad: 0, scale: 6, size: 192 },
    { file: 'maskable-512.png', grid: 42, pad: 5, scale: 12, size: 512 },
    { file: 'apple-touch-icon.png', grid: 36, pad: 2, scale: 5, size: 180 },
    { file: 'favicon-64.png', grid: 32, pad: 0, scale: 2, size: 64 },
    { file: 'favicon-32.png', grid: 32, pad: 0, scale: 1, size: 32 },
  ];
  for (const j of jobs) {
    const data = await p.evaluate(({ src, j }) => {
      const draw = new Function(`return (${src})`)();
      const grid = draw(j.grid, j.pad);
      const c = document.createElement('canvas');
      c.width = c.height = j.size;
      const g = c.getContext('2d');
      const off = Math.floor((j.size - j.grid * j.scale) / 2);
      g.fillStyle = grid[j.grid - 1][0];
      g.fillRect(0, 0, j.size, j.size);
      grid.forEach((row, y) => row.forEach((col, x) => {
        g.fillStyle = col;
        g.fillRect(off + x * j.scale, off + y * j.scale, j.scale, j.scale);
      }));
      return c.toDataURL('image/png');
    }, { src: draw.toString(), j });
    fs.writeFileSync(path.join(outDir, j.file), Buffer.from(data.split(',')[1], 'base64'));
    console.log('wrote', j.file);
  }
  await b.close();
}
main();
