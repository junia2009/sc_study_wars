// オープニングムービー。ゲームと同じドット絵を、ゲームの画面(canvas)の上で動かす。
// 動画ファイルは使わないので、軽く、オフラインでも見られ、文章もすぐ直せる。
//
// 場面(SHOTS)ごとに「長さ」「字幕」「描き方」を持つ。字幕は HTML で出す(ui.js の showMovieCaption)。
// 画面の大きさ(横長・縦長)はいろいろなので、絵はすべて画面の幅と高さに合わせて配置する。
import { RES } from './sprites.js';

const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - (1 - x) ** 3);
const lerp = (a, b, k) => a + (b - a) * k;
const rand = (i) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// 字幕の who は会話と同じ登場人物(なければナレーション)。{name} は主人公の名前になる
export const SHOTS = [
  {
    id: 'city',
    dur: 7,
    captions: [
      { at: 0, text: 'とある会社「junia 商事」。' },
      { at: 3, text: '今週の金曜、この会社では大口の支払いが予定されている。' },
    ],
  },
  {
    id: 'hook',
    dur: 8,
    captions: [
      { at: 0, text: 'その支払いを狙って……' },
      { at: 2.5, text: '詐欺グループ「フィッシャーズ」が、会社のネットワークに釣り糸を垂らしていた。' },
    ],
  },
  {
    id: 'morning',
    dur: 9,
    captions: [
      { at: 0, text: '月曜の朝。情報システム部に、新人の{name}が配属された。' },
      { at: 4.5, text: '先輩の黒田さんは……どうやら徹夜明けらしい。' },
    ],
  },
  {
    id: 'board',
    dur: 11.5,
    captions: [
      { at: 0, who: 'kuroda', text: 'おはよう……。詐欺を見抜くコツは、3つだけだ' },
      { at: 2.5, who: 'kuroda', text: '① 見る。送り主や URL を、手元の「本物」と見比べる' },
      { at: 5.3, who: 'kuroda', text: '② 別の道で確かめる。メールに書かれた連絡先やリンクは使わない' },
      { at: 8.2, who: 'kuroda', text: '③ 迷ったら相談。やってしまったら、すぐ報告' },
    ],
  },
  {
    id: 'boot',
    dur: 7.5,
    captions: [
      { at: 0, text: 'そして、情シスが試作中の見習い用 AI「ガード」。' },
      { at: 3.7, text: '{name}がガードを操作して、社内ネットワークの中へ送り込む。' },
    ],
  },
  {
    id: 'dive',
    dur: 6.5,
    captions: [
      { at: 0, text: 'ネットワークの中では、詐欺メールやマルウェアが、敵の姿で襲ってくる。' },
      { at: 3.6, text: '金曜まで、経理部を守り抜け。' },
    ],
  },
];

export class Movie {
  constructor(S, onCaption) {
    this.S = S;
    this.onCaption = onCaption; // (caption, shotIndex) 字幕が変わったとき
    this.active = false;
  }

  start(onEnd) {
    this.onEnd = onEnd;
    this.shot = 0;
    this.t = 0;
    this.cap = -1;
    this.active = true;
    this.syncCaption();
  }

  // タップ: 次の字幕へ(場面の最後の字幕なら次の場面へ)
  next() {
    if (!this.active) return;
    const sh = SHOTS[this.shot];
    const nextCap = sh.captions.find((c) => c.at > this.t + 0.01);
    if (nextCap) this.t = nextCap.at;
    else this.advanceShot();
    this.syncCaption();
  }

  skip() {
    if (!this.active) return;
    this.active = false;
    this.onEnd?.();
  }

  advanceShot() {
    this.shot++;
    this.t = 0;
    this.cap = -1;
    if (this.shot >= SHOTS.length) this.skip();
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    if (this.t >= SHOTS[this.shot].dur) this.advanceShot();
    if (this.active) this.syncCaption();
  }

  syncCaption() {
    if (!this.active) return;
    const caps = SHOTS[this.shot].captions;
    let i = 0;
    caps.forEach((c, k) => {
      if (this.t >= c.at) i = k;
    });
    if (i !== this.cap) {
      this.cap = i;
      this.onCaption?.(caps[i], this.shot, SHOTS.length);
    }
  }

  // ---- 描画 ----
  render(g, W, H, now) {
    if (!this.active) return;
    const lw = W / RES;
    const lh = H / RES;
    g.save();
    g.setTransform(RES, 0, 0, RES, 0, 0);
    g.imageSmoothingEnabled = false;
    const sh = SHOTS[this.shot];
    const t = this.t;
    this[sh.id](g, t, lw, lh, now / 1000);
    // 場面の切り替わりは、黒からふわっと出す
    const fade = Math.max(0, 1 - t / 0.5) + Math.max(0, (t - (sh.dur - 0.4)) / 0.4);
    if (fade > 0) {
      g.fillStyle = `rgba(0,0,0,${Math.min(1, fade)})`;
      g.fillRect(0, 0, lw, lh);
    }
    g.restore();
  }

  // 夜空と、遠くのビル
  sky(g, lw, lh, now, warm = 0) {
    const bands = warm
      ? ['#2a1b4a', '#4a2a5c', '#7a3a5c', '#b4555a', '#e08a5a', '#f4b46a']
      : ['#03050f', '#060a1c', '#0a1028', '#0e1634', '#131c42', '#18234e'];
    bands.forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect(0, Math.floor((i * lh) / bands.length), lw, Math.ceil(lh / bands.length) + 1);
    });
    if (!warm) {
      for (let i = 0; i < 40; i++) {
        const x = rand(i) * lw;
        const y = rand(i + 99) * lh * 0.55;
        g.fillStyle = Math.sin(now * 2 + i) > 0.6 ? '#ffffff' : '#7f8fbf';
        g.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
      g.fillStyle = '#e8ecff';
      g.fillRect(Math.round(lw * 0.82), Math.round(lh * 0.1), 8, 8);
      g.fillStyle = '#c3cbe0';
      g.fillRect(Math.round(lw * 0.82) + 5, Math.round(lh * 0.1) + 2, 2, 2);
    }
  }

  skyline(g, lw, lh, scroll, color, seedBase, hMin, hMax) {
    const base = lh * 0.86;
    for (let x = -(scroll % 30) - 30; x < lw + 30; x += 30) {
      const seed = Math.floor((x + scroll) / 30) + seedBase;
      const bw = 18 + rand(seed) * 14;
      const bh = hMin + rand(seed + 7) * (hMax - hMin);
      g.fillStyle = color;
      g.fillRect(Math.round(x), Math.round(base - bh), Math.round(bw), Math.round(bh));
    }
  }

  building(g, lw, lh, now, alarm = 0) {
    const bw = Math.min(120, lw * 0.5);
    const bh = lh * 0.6;
    const bx = Math.round(lw / 2 - bw / 2);
    const by = Math.round(lh * 0.86 - bh);
    g.fillStyle = '#141b3d';
    g.fillRect(bx, by, Math.round(bw), Math.round(bh));
    g.fillStyle = '#1b2450';
    g.fillRect(bx, by, 3, Math.round(bh));
    // 窓
    const cols = Math.max(3, Math.floor((bw - 8) / 10));
    const rows = Math.max(4, Math.floor((bh - 20) / 12));
    const win = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = bx + 6 + c * ((bw - 8) / cols);
        const wy = by + 16 + r * 12;
        const lit = rand(r * 31 + c * 7) > 0.55;
        g.fillStyle = lit ? '#f4c86a' : '#0d1330';
        g.fillRect(Math.round(wx), Math.round(wy), 5, 6);
        win.push([Math.round(wx), Math.round(wy)]);
      }
    }
    // 狙われる窓(経理部)
    const target = win[Math.min(win.length - 1, cols * 2 + Math.floor(cols / 2))];
    if (alarm > 0) {
      g.fillStyle = Math.floor(now * 6) % 2 ? '#ff3b5c' : '#ff9fb2';
      g.fillRect(target[0] - 1, target[1] - 1, 7, 8);
    }
    // 看板
    g.fillStyle = '#0b1028';
    g.fillRect(bx + 4, by - 12, Math.round(bw - 8), 10);
    g.font = '8px "DotGothic16", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#29adff';
    g.shadowColor = '#29adff';
    g.shadowBlur = 6;
    g.fillText('junia 商事', Math.round(lw / 2), by - 7);
    g.shadowBlur = 0;
    return { target, by };
  }

  ground(g, lw, lh, color = '#070a18') {
    g.fillStyle = color;
    g.fillRect(0, Math.round(lh * 0.86), lw, Math.ceil(lh * 0.14) + 1);
  }

  // ① 夜の街
  city(g, t, lw, lh, now) {
    this.sky(g, lw, lh, now);
    this.skyline(g, lw, lh, t * 3, '#0b1129', 10, 30, 70);
    this.skyline(g, lw, lh, t * 6 + 40, '#0f1735', 30, 18, 46);
    this.building(g, lw, lh, now);
    this.ground(g, lw, lh);
  }

  // ② 釣り糸が垂れてくる
  hook(g, t, lw, lh, now) {
    this.sky(g, lw, lh, now);
    this.skyline(g, lw, lh, 21, '#0b1129', 10, 30, 70);
    const { target } = this.building(g, lw, lh, now, t > 4.6 ? 1 : 0);
    this.ground(g, lw, lh);
    const hx = target[0] + 2;
    const hy = lerp(-10, target[1] + 2, ease((t - 0.6) / 4));
    g.fillStyle = '#c3cbe0';
    g.fillRect(hx, 0, 1, Math.max(0, Math.round(hy)));
    // 針
    g.fillStyle = '#e6ecf5';
    for (const [dx, dy] of [[0, 0], [0, 1], [0, 2], [-1, 3], [-2, 3], [-3, 2], [-3, 1]]) g.fillRect(hx + dx, Math.round(hy) + dy, 1, 1);
    // 赤い光がにじむ
    if (t > 4.6) {
      g.fillStyle = `rgba(255,59,92,${0.15 + Math.sin(now * 8) * 0.08})`;
      g.beginPath();
      g.arc(target[0] + 3, target[1] + 3, 12, 0, Math.PI * 2);
      g.fill();
    }
    // 黒幕の影
    const a = ease((t - 2) / 2);
    if (a > 0) {
      const size = Math.min(56, lh * 0.32);
      g.globalAlpha = a * 0.9;
      const face = Math.floor(now * 1.5) % 6 === 0 ? this.S.anglerBlink : this.S.faces.angler;
      g.drawImage(face, Math.round(lw * 0.06), Math.round(lh * 0.06), size, size);
      g.globalAlpha = 1;
    }
  }

  // ③ 月曜の朝の情シス室
  morning(g, t, lw, lh, now) {
    // 壁と朝焼けの窓
    g.fillStyle = '#1b2348';
    g.fillRect(0, 0, lw, lh);
    const wx = Math.round(lw * 0.08);
    const ww = Math.round(lw * 0.84);
    const wy = Math.round(lh * 0.1);
    const wh = Math.round(lh * 0.38);
    g.save();
    g.beginPath();
    g.rect(wx, wy, ww, wh);
    g.clip();
    g.translate(wx, wy);
    this.sky(g, ww, wh, now, 1);
    this.skyline(g, ww, wh / 0.86, 10, '#2a2050', 50, 10, 40);
    g.restore();
    g.fillStyle = '#3a4158';
    g.fillRect(wx - 2, wy - 2, ww + 4, 2);
    g.fillRect(wx - 2, wy + wh, ww + 4, 2);
    g.fillRect(wx - 2, wy, 2, wh);
    g.fillRect(wx + ww, wy, 2, wh);
    g.fillRect(Math.round(wx + ww / 2), wy, 2, wh);
    // 床
    const floorY = Math.round(lh * 0.8);
    g.fillStyle = '#121833';
    g.fillRect(0, floorY, lw, lh - floorY);
    // 先輩の机(右)
    const dx = Math.round(lw * 0.58);
    const dw = Math.round(lw * 0.36);
    const dy = floorY - 26;
    g.fillStyle = '#4a3a30';
    g.fillRect(dx, dy, dw, 4);
    g.fillRect(dx + 2, dy + 4, 3, 22);
    g.fillRect(dx + dw - 5, dy + 4, 3, 22);
    // モニター
    g.fillStyle = '#2a3044';
    g.fillRect(dx + dw - 26, dy - 20, 22, 16);
    g.fillStyle = '#0d3b66';
    g.fillRect(dx + dw - 24, dy - 18, 18, 12);
    g.fillStyle = '#29adff';
    g.fillRect(dx + dw - 22, dy - 15, 10, 1);
    g.fillRect(dx + dw - 22, dy - 12, 13, 1);
    g.fillStyle = '#2a3044';
    g.fillRect(dx + dw - 17, dy - 4, 4, 4);
    // 机に突っ伏す先輩(頭の上半分だけ見える。ほかの絵と同じ粗さで描く)
    g.drawImage(this.S.faces.kuroda, 0, 0, 32, 20, dx + 2, dy - 20, 32, 20);
    g.fillStyle = '#3a4158';
    g.fillRect(dx, dy - 3, 36, 3);
    // エナジードリンクの缶
    [[dx + 38, '#16a34a'], [dx + 43, '#111827'], [dx + 48, '#16a34a'], [dx + dw - 32, '#111827']].forEach(([cx, col], i) => {
      g.fillStyle = col;
      g.fillRect(cx, dy - 7 + (i === 3 ? 4 : 0), 4, i === 3 ? 3 : 7);
      g.fillStyle = '#c3cbe0';
      g.fillRect(cx, dy - 7 + (i === 3 ? 4 : 0), 4, 1);
    });
    // Zzz
    g.font = '7px "DotGothic16", monospace';
    g.textAlign = 'left';
    g.fillStyle = '#a9b3d6';
    const zz = Math.floor(now * 1.5) % 3;
    g.fillText('Z'.repeat(zz + 1), dx + 20, dy - 24 - zz * 2);
    // 主人公が歩いてくる
    const hxp = lerp(-20, lw * 0.3, ease(t / 3.2));
    const walking = t < 3.2;
    const fr = walking ? this.S.hero[Math.floor(now * 8) % 4].r : this.S.hero[0].r;
    g.drawImage(fr, Math.round(hxp), floorY - 32, 32, 32);
    // 「!?」
    if (t > 4.6) {
      g.fillStyle = '#ffd23f';
      g.font = '10px "DotGothic16", monospace';
      g.fillText('!?', Math.round(hxp) + 20, floorY - 34);
    }
  }

  // ④ ホワイトボード
  board(g, t, lw, lh, now) {
    g.fillStyle = '#1b2348';
    g.fillRect(0, 0, lw, lh);
    const bw = Math.round(Math.min(lw * 0.9, 300));
    const bh = Math.round(Math.min(lh * 0.72, 150));
    const bx = Math.round((lw - bw) / 2);
    const by = Math.round(lh * 0.08);
    g.fillStyle = '#8a94ad';
    g.fillRect(bx - 3, by - 3, bw + 6, bh + 6);
    g.fillStyle = '#eef2fa';
    g.fillRect(bx, by, bw, bh);
    g.fillStyle = '#c3cbe0';
    g.fillRect(bx, by + bh - 4, bw, 4);
    const fs = Math.max(7, Math.min(13, Math.floor(bw / 15)));
    g.font = `${fs}px "DotGothic16", monospace`;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillStyle = '#1d2433';
    g.fillText('詐欺を見抜く 3つの基本', bx + 8, by + 6);
    g.fillStyle = '#c3cbe0';
    g.fillRect(bx + 8, by + 8 + fs, bw - 16, 1);
    const items = [
      [2.5, '#1a7fd6', '① 見る(本物と見比べる)'],
      [5.3, '#16a34a', '② 別の道で確かめる'],
      [8.2, '#c8102e', '③ 迷ったら相談・報告'],
    ];
    items.forEach(([at, col, text], i) => {
      const k = ease((t - at) / 0.8);
      if (k <= 0) return;
      const y = by + 14 + fs + i * (fs + Math.max(8, fs * 0.9));
      // 書いていく(左から見えていく)
      g.save();
      g.beginPath();
      g.rect(bx + 6, y - 2, (bw - 12) * k, fs + 6);
      g.clip();
      g.fillStyle = col;
      g.fillText(text, bx + 10, y);
      g.restore();
    });
    // 先輩(左下から顔を出す)
    const size = Math.min(48, lh * 0.3);
    g.drawImage(this.S.faces.kuroda, Math.round(bx - size * 0.2), Math.round(lh - size - 2), size, size);
    // ペン先
    const cur = items.findLast?.((it) => t >= it[0]) || null;
    if (cur && t - cur[0] < 1) {
      g.fillStyle = '#1d2433';
      const i = items.indexOf(cur);
      const y = by + 14 + fs + i * (fs + Math.max(8, fs * 0.9));
      g.fillRect(Math.round(bx + 10 + (bw - 20) * ease((t - cur[0]) / 0.8)), y + fs, 3, 3);
    }
  }

  // ⑤ ガード起動
  boot(g, t, lw, lh, now) {
    g.fillStyle = '#0b0f24';
    g.fillRect(0, 0, lw, lh);
    const mw = Math.round(Math.min(lw * 0.9, 280));
    const mh = Math.round(Math.min(lh * 0.7, 150));
    const mx = Math.round((lw - mw) / 2);
    const my = Math.round(lh * 0.1);
    g.fillStyle = '#3a4158';
    g.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
    g.fillStyle = '#050a1c';
    g.fillRect(mx, my, mw, mh);
    g.fillStyle = '#3a4158';
    g.fillRect(Math.round(lw / 2 - 6), my + mh + 4, 12, 6);
    const fs = Math.max(6, Math.min(10, Math.floor(mw / 26)));
    g.font = `${fs}px "DotGothic16", monospace`;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    const lines = ['GUARD v0.9β (見習い用)', '> 起動中 ...', '> 判断支援モジュール ... OK', '> 社内ネットワークに接続 ... OK'];
    lines.forEach((l, i) => {
      const at = 0.3 + i * 0.7;
      if (t < at) return;
      const n = Math.floor((t - at) * 30);
      g.fillStyle = i === 0 ? '#7fe3ff' : '#29adff';
      g.fillText(l.slice(0, n), mx + 6, my + 6 + i * (fs + 3));
    });
    // 進み具合
    const pk = ease((t - 0.5) / 2.8);
    const py = my + 6 + 4 * (fs + 3) + 2;
    g.fillStyle = '#14306a';
    g.fillRect(mx + 6, py, mw - 12, 4);
    g.fillStyle = '#5cc8ff';
    g.fillRect(mx + 6, py, Math.round((mw - 12) * pk), 4);
    // ガードが現れる
    const a = ease((t - 3.4) / 0.8);
    if (a > 0) {
      const size = Math.round(32 + 16 * a);
      const cx = Math.round(lw / 2 - size / 2);
      const cy = Math.round(my + mh - size - 4);
      g.fillStyle = `rgba(41,173,255,${0.25 * a})`;
      g.beginPath();
      g.arc(lw / 2, cy + size / 2, size * 0.7 + Math.sin(now * 6) * 2, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = a;
      g.drawImage(this.S.guard.stand[0].r, cx, cy, size, size);
      g.globalAlpha = 1;
    }
  }

  // ⑥ ネットワークへ飛び込む
  dive(g, t, lw, lh, now) {
    g.fillStyle = '#060918';
    g.fillRect(0, 0, lw, lh);
    const speed = 60 + t * 90;
    for (let i = 0; i < 46; i++) {
      const x = Math.round(rand(i) * lw);
      const len = 8 + rand(i + 5) * 30;
      const y = ((rand(i + 9) * lh * 2 - t * speed) % (lh + len) + lh + len) % (lh + len) - len;
      g.fillStyle = i % 5 ? '#16245a' : '#2f5bc4';
      g.fillRect(x, Math.round(y), 1, Math.round(len));
    }
    // 敵の影が左右をよぎる
    if (t > 1.2) {
      const k = (t - 1.2) * 60;
      g.globalAlpha = 0.85;
      g.drawImage(this.S.phish[Math.floor(now * 4) % 2].r, Math.round(lw * 0.12), Math.round(lh + 20 - k), 32, 32);
      g.drawImage(this.S.pass[Math.floor(now * 4) % 2].l, Math.round(lw * 0.72), Math.round(lh + 60 - k * 1.2), 32, 32);
      g.drawImage(this.S.phish[Math.floor(now * 4 + 1) % 2].l, Math.round(lw * 0.6), Math.round(lh + 140 - k), 24, 24);
      g.globalAlpha = 1;
    }
    // ガード(真ん中で落ちていく)
    const size = 40;
    const gx = Math.round(lw / 2 - size / 2 + Math.sin(now * 3) * 3);
    const gy = Math.round(lh * 0.38 - size / 2);
    // 落ちていく光の筋
    g.fillStyle = 'rgba(127,227,255,0.55)';
    for (const [ox, len] of [[12, 22], [20, 30], [28, 18]]) g.fillRect(gx + ox, gy - len - 2, 1, len);
    g.drawImage(this.S.guard.jump.r, gx, gy, size, size);
    // 最後は白く光って、ゲームへ
    const flash = Math.max(0, (t - 5.7) / 0.6);
    if (flash > 0) {
      g.fillStyle = `rgba(230,240,255,${Math.min(1, flash)})`;
      g.fillRect(0, 0, lw, lh);
    }
  }
}
