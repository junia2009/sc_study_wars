// ステージの中身: 地図・主人公・敵・仕掛け・描画。
// 画面に文字を出す場面(判断シーン・扉・報告書など)は hooks で外(ui.js)に任せる。
import { TILE as T, RES } from './sprites.js';
import { held, take } from './input.js';
import { sfx } from './audio.js';

export const VIEW_W = 320; // 見える横幅の標準。画面の形に合わせて this.vw が変わる(200〜400)
export const VIEW_H = 180; // 見える高さの標準。縦向きでは床の上の空まで映して高くする(180〜300)

// 手触りの調整はここで
const PH = {
  gravity: 900, // 落ちる速さ(px/秒²)
  jumpV: 300, // ジャンプの初速
  jumpCut: 0.45, // ボタンを早く離したときに上昇を弱める割合
  runMax: 105,
  accelGround: 900,
  accelAir: 620,
  friction: 1200,
  maxFall: 420,
  coyote: 0.09, // 足場から落ちた直後でもジャンプできる猶予(秒)
  buffer: 0.12, // 着地の少し前に押したジャンプを覚えておく時間(秒)
  stomp: 220, // 踏んだときに跳ね返る強さ
  stompHeld: 310, // 踏んだときジャンプを押していれば、高く跳ねる
};

const SOLID = new Set(['G', 'B', 'Q', 'U']);
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function body(x, y, w, h) {
  return { x, y, w, h, vx: 0, vy: 0, onGround: false, hitWall: false };
}

export class Game {
  constructor(stage, day, sprites, hooks) {
    this.stage = stage;
    this.day = day; // その日の台本(判断シーンの順番・ひとこと)
    this.S = sprites;
    this.hooks = hooks;
    this.vw = VIEW_W;
    this.vh = VIEW_H;
    this.reset();
  }

  reset() {
    const st = this.stage;
    this.grid = st.map.map((r) => r.split(''));
    this.rows = this.grid.length;
    this.cols = this.grid[0].length;
    this.enemies = [];
    this.coins = [];
    this.items = [];
    this.parts = [];
    this.floats = [];
    this.terms = [];
    this.hints = [];
    this.tutorialGo = false; // 練習区間の敵が動いてよいか(敵の説明のあと)
    this.sighted = {}; // 初めて画面に映った敵の種類
    this.clueItems = [];
    this.goal = null;
    this.bumps = [];
    let start = { x: 32, y: 0 };
    let ti = 0;
    let hi = 0;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const ch = this.grid[y][x];
        const px = x * T;
        const py = y * T;
        let clear = true;
        switch (ch) {
          case 'P': start = { x: px + 3, y: py + 2 }; break;
          case 'e': this.enemies.push(this.enemy('phish', px + 2, py + 6)); break;
          case 'p': this.enemies.push(this.enemy('pass', px + 2, py + 6)); break;
          case 'o': this.coins.push({ x: px + 4, y: py + 4, w: 8, h: 8 }); break;
          case 'T': this.terms.push({ x: px, y: py, w: T, h: T, id: this.day.scenes[ti++], used: false }); break;
          case 'i': this.hints.push({ x: px, line: this.day.hints[hi++], shown: false }); break;
          case 'K': this.clueItems.push({ kind: 'bookmark', x: px, y: py, w: T, h: T }); break;
          case 'L': this.clueItems.push({ kind: 'ledger', x: px, y: py, w: T, h: T }); break;
          case 'Z': this.goal = { x: px, y: py - T, w: T, h: T * 2 }; break;
          default: clear = false;
        }
        if (clear) this.grid[y][x] = '.';
      }
    }
    this.p = { ...body(start.x, start.y, 10, 14), face: 1, coyote: 0, buffer: 0, inv: 0, jumping: false, anim: 0 };
    this.safe = { x: start.x, y: start.y };
    this.clues = {}; // 手に入れた手がかり(bookmark / ledger)
    this.leak = 0; // 漏洩リスク(満タンで障害報告書)
    this.maxLeak = 0;
    this.delay = 0; // 業務の遅れ(満タンで始末書)
    this.maxDelay = 0;
    this.score = 0;
    this.causes = []; // 漏洩リスクの原因
    this.delayCauses = []; // 業務の遅れの原因
    this.overKind = null; // 'leak' | 'delay'
    this.judgments = []; // { id, tier }
    this.clock = '9:30';
    this.time = 0;
    this.t = 0;
    this.camX = 0;
    this.camY = this.rows * T - this.vh; // 床が画面の下にくるように。高い画面では上に空が見える
    this.shieldFlash = 0;
    this.over = false;
    this.hooks.hud?.(this);
  }

  // 見える横幅を変える(カメラがはみ出さないように直す)
  setView(vw, vh = VIEW_H) {
    this.vw = vw;
    this.vh = vh;
    this.camY = this.rows * T - this.vh;
    this.camX = clamp(this.camX, 0, this.cols * T - this.vw);
  }

  enemy(kind, x, y) {
    return { ...body(x, y, 12, 10), kind, dir: -1, speed: kind === 'phish' ? 26 : 22, dead: false, awake: false, flash: 0 };
  }

  // ---- 地図 ----
  tile(cx, cy) {
    if (cy < 0 || cy >= this.rows || cx < 0 || cx >= this.cols) return '.';
    return this.grid[cy][cx];
  }
  solidAt(cx, cy) {
    if (cx < 0 || cx >= this.cols) return true; // ステージの左右の端は壁
    return SOLID.has(this.tile(cx, cy));
  }

  moveX(b, dt) {
    b.hitWall = false;
    b.x += b.vx * dt;
    const y0 = Math.floor(b.y / T);
    const y1 = Math.floor((b.y + b.h - 0.01) / T);
    if (b.vx > 0) {
      const cx = Math.floor((b.x + b.w - 0.01) / T);
      for (let cy = y0; cy <= y1; cy++) {
        if (this.solidAt(cx, cy)) {
          b.x = cx * T - b.w;
          b.vx = 0;
          b.hitWall = true;
          break;
        }
      }
    } else if (b.vx < 0) {
      const cx = Math.floor(b.x / T);
      for (let cy = y0; cy <= y1; cy++) {
        if (this.solidAt(cx, cy)) {
          b.x = (cx + 1) * T;
          b.vx = 0;
          b.hitWall = true;
          break;
        }
      }
    }
  }

  moveY(b, dt, isPlayer = false) {
    const prevTop = b.y;
    b.y += b.vy * dt;
    b.onGround = false;
    const x0 = Math.floor(b.x / T);
    const x1 = Math.floor((b.x + b.w - 0.01) / T);
    if (b.vy > 0) {
      const cy = Math.floor((b.y + b.h - 0.01) / T);
      for (let cx = x0; cx <= x1; cx++) {
        if (this.solidAt(cx, cy) && cy >= 0) {
          b.y = cy * T - b.h;
          b.vy = 0;
          b.onGround = true;
          break;
        }
      }
    } else if (b.vy < 0) {
      const cy = Math.floor(b.y / T);
      const hits = [];
      for (let cx = x0; cx <= x1; cx++) {
        const hidden = isPlayer && this.tile(cx, cy) === 'H' && prevTop >= (cy + 1) * T - 0.5;
        if ((cy >= 0 && this.solidAt(cx, cy)) || hidden) hits.push(cx);
      }
      if (hits.length) {
        b.y = (cy + 1) * T;
        b.vy = 0;
        if (isPlayer) {
          // 頭の真上にあるブロックを優先して叩く
          const mid = Math.floor((b.x + b.w / 2) / T);
          this.bump(hits.includes(mid) ? mid : hits[0], cy);
        }
      }
    }
  }

  // 下からブロックを叩いた
  bump(cx, cy) {
    const ch = this.tile(cx, cy);
    if (ch === 'Q') {
      this.grid[cy][cx] = 'U';
      this.score += 10;
      sfx.coin();
      this.workDone(cx * T + 8, cy * T - 4);
      this.hooks.hud?.(this);
    } else if (ch === 'H') {
      this.grid[cy][cx] = 'U';
      this.items.push({ kind: 'reboot', x: cx * T, y: cy * T - T, w: T, h: T, rise: T });
      sfx.item();
    } else {
      sfx.bump();
    }
    this.bumps.push({ cx, cy, life: 0.15 });
    // 叩いたブロックの上にいた敵は倒れる
    for (const e of this.enemies) {
      if (!e.dead && Math.abs(e.x + e.w / 2 - (cx * T + 8)) < 12 && Math.abs(e.y + e.h - cy * T) < 3) {
        this.defeat(e);
      }
    }
  }

  // ---- 漏洩ゲージ ----
  addLeak(n, cause) {
    if (this.over) return;
    this.leak = clamp(this.leak + n, 0, 100);
    this.maxLeak = Math.max(this.maxLeak, this.leak);
    if (cause && !this.causes.includes(cause)) this.causes.push(cause);
    this.hooks.hud?.(this);
    if (this.leak >= 100) this.gameOver('leak');
  }

  // 業務データを拾った: 仕事が片づいて、業務の遅れが少し減る
  workDone(x, y) {
    this.delay = Math.max(0, this.delay - 3);
    if (x !== undefined) this.floats.push({ x, y, text: '遅れ-3%', life: 0.8, coin: true });
  }

  // ---- 業務の遅れゲージ ----
  addDelay(n, cause) {
    if (this.over) return;
    this.delay = clamp(this.delay + n, 0, 100);
    this.maxDelay = Math.max(this.maxDelay, this.delay);
    if (cause && !this.delayCauses.includes(cause)) this.delayCauses.push(cause);
    this.hooks.hud?.(this);
    if (this.delay >= 100) this.gameOver('delay');
  }

  gameOver(kind) {
    this.over = true;
    this.overKind = kind;
    sfx.over();
    this.hooks.over?.(this);
  }

  // 練習区間(地図の左端から stage.tutorialEnd マスまで)では、ゲージを増やさない
  inTutorial() {
    return this.p.x < (this.stage.tutorialEnd || 0) * T;
  }

  hurt(cause, n, from) {
    const p = this.p;
    if (p.inv > 0 || this.over) return;
    p.inv = 1.3;
    p.vx = (from && p.x + p.w / 2 < from.x + from.w / 2 ? -1 : 1) * 120;
    p.vy = -170;
    sfx.hurt();
    if (this.inTutorial()) this.hooks.banner?.('練習なので、ノーカウント!', 'info');
    else this.addLeak(n, cause);
    this.burst(p.x + 5, p.y + 7, 8, '#ff004d');
  }

  defeat(e) {
    e.dead = true;
    this.score += 50;
    sfx.stomp();
    this.burst(e.x + 6, e.y + 5, 10, e.kind === 'phish' ? '#fff1e8' : '#ff77a8');
    this.floats.push({ x: e.x + 6, y: e.y - 4, text: '撃退!', life: 0.7 });
  }

  burst(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.parts.push({ x, y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 40, life: 0.5, color });
    }
  }

  // ---- 判断シーンの結果を受け取る ----
  // r: { tier, leak, delay, cause, score, report }  report: 引っかかったあと、すぐ報告したか(true/false/undefined)
  applyScene(id, r) {
    let leak = r.leak || 0;
    if (r.report === true) leak = Math.round(leak / 2);
    if (leak) this.addLeak(leak, r.cause);
    if (r.report === false) this.addLeak(15, 'hide');
    if (r.delay) this.addDelay(r.delay, r.cause);
    this.score += r.score || 0;
    this.judgments.push({ id, tier: r.tier });
    this.hooks.hud?.(this);
  }

  // ---- 1コマ分すすめる(dt は 1/60 秒で固定) ----
  update(dt) {
    if (this.over) return;
    const p = this.p;
    this.t += dt;
    this.time += dt;

    // 横の動き
    const dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    if (dir) {
      p.face = dir;
      let a = p.onGround ? PH.accelGround : PH.accelAir;
      if (Math.sign(p.vx) === -dir) a += PH.friction; // 切り返しは速く
      p.vx += dir * a * dt;
    } else if (p.onGround) {
      const f = PH.friction * dt;
      p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
    }
    p.vx = clamp(p.vx, -PH.runMax, PH.runMax);

    // ジャンプ(猶予と先行入力つき)
    p.buffer = take('jump') ? PH.buffer : Math.max(0, p.buffer - dt);
    p.coyote = p.onGround ? PH.coyote : Math.max(0, p.coyote - dt);
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -PH.jumpV;
      p.buffer = 0;
      p.coyote = 0;
      p.jumping = true;
      sfx.jump();
    }
    if (p.jumping && !held.jump && p.vy < 0) {
      p.vy *= PH.jumpCut;
      p.jumping = false;
    }
    if (p.vy >= 0) p.jumping = false;
    p.vy = Math.min(PH.maxFall, p.vy + PH.gravity * dt);

    this.moveX(p, dt);
    this.moveY(p, dt, true);
    p.inv = Math.max(0, p.inv - dt);
    p.anim += dt * (Math.abs(p.vx) / 60);

    // 落ちても戻れる場所を覚えておく
    // (穴のふちで復帰して、すぐまた落ちないように、前後1マスも床がある場所だけ)
    if (p.onGround) {
      const cy = Math.floor((p.y + p.h + 1) / T);
      const ok = [-T, 0, p.w, p.w + T].every((dx) => this.solidAt(Math.floor((p.x + dx) / T), cy));
      if (ok) {
        this.safe = { x: p.x, y: p.y };
      }
    }

    // 落とし穴
    if (p.y > this.rows * T + 24) {
      if (this.inTutorial()) {
        this.hooks.banner?.('本番環境に落ちた! ……練習なので、ノーカウント', 'info');
      } else {
        this.hooks.banner?.('足元を確かめずに、本番環境へ落ちた……', 'bad');
        this.addLeak(10, 'pit');
      }
      if (this.over) return;
      Object.assign(p, { x: this.safe.x, y: this.safe.y, vx: 0, vy: 0, inv: 1.3 });
    }

    // 敵
    for (const e of this.enemies) {
      if (e.dead) continue;
      // 練習区間の敵は、敵の説明が終わるまでその場で待つ
      if (e.x < (this.stage.tutorialEnd || 0) * T && !this.tutorialGo) continue;
      if (!e.awake && e.x < this.camX + this.vw + 24) e.awake = true;
      if (!e.awake) continue;
      // 初めて画面に映った種類の敵なら、ガードが説明する
      if (!this.sighted[e.kind] && e.x < this.camX + this.vw - 8 && e.x > this.camX) {
        this.sighted[e.kind] = true;
        const first = this.day.firstSight?.[e.kind];
        if (first?.talk) {
          p.vx = 0;
          this.hooks.lesson?.(first.talk);
          return;
        }
        if (first?.say) this.hooks.say?.(first.say);
      }
      e.flash = Math.max(0, e.flash - dt);
      e.vx = e.dir * e.speed;
      e.vy = Math.min(PH.maxFall, e.vy + PH.gravity * dt);
      this.moveX(e, dt);
      if (e.hitWall) e.dir *= -1;
      this.moveY(e, dt);
      if (e.onGround) {
        const fx = e.dir > 0 ? e.x + e.w + 1 : e.x - 1;
        if (!this.solidAt(Math.floor(fx / T), Math.floor((e.y + e.h + 1) / T))) e.dir *= -1;
      }
      if (e.y > this.rows * T + 32) e.dead = true;

      if (!e.dead && overlap(p, e)) {
        const stomp = p.vy > 0 && p.y + p.h - e.y <= 8;
        if (stomp) {
          p.vy = -(held.jump ? PH.stompHeld : PH.stomp);
          p.jumping = held.jump;
          if (e.kind === 'pass') {
            // 硬そうな鎧は、ひと踏みで割れる
            e.kind = 'soft';
            e.speed = 52;
            e.flash = 0.25;
            this.score += 30;
            sfx.armor();
            this.floats.push({ x: e.x + 6, y: e.y - 6, text: 'パキッ', life: 0.8 });
          } else {
            this.defeat(e);
          }
        } else {
          this.hurt(e.kind === 'phish' ? 'phishMail' : 'weakPass', 10, e);
          if (this.over) return;
        }
      }
    }

    // データの粒
    for (const c of this.coins) {
      if (!c.taken && overlap(p, c)) {
        c.taken = true;
        this.score += 10;
        this.workDone();
        sfx.coin();
        this.hooks.hud?.(this);
      }
    }

    // アイテム
    for (const it of this.items) {
      if (it.rise > 0) {
        const d = Math.min(it.rise, 40 * dt);
        it.rise -= d;
        continue;
      }
      if (!it.taken && overlap(p, it)) {
        it.taken = true;
        sfx.item();
        this.leak = Math.max(0, this.leak - 25);
        this.score = Math.max(0, this.score - 50);
        this.hooks.banner?.('とりあえず再起動! 漏洩ゲージ -25%。……保存していない作業も消えた(スコア -50)', 'info');
        this.hooks.hud?.(this);
      }
    }

    // ヒント
    for (const h of this.hints) {
      if (!h.shown && p.x > h.x - 8) {
        h.shown = true;
        if (h.line?.release) this.tutorialGo = true;
        if (h.line?.talk) {
          p.vx = 0;
          this.hooks.lesson?.(h.line.talk);
          return;
        }
        if (h.line?.say) this.hooks.say?.(h.line.say);
      }
    }

    // 手がかり(触れると手帳に記録)
    for (const c of this.clueItems) {
      if (!c.taken && overlap(p, c)) {
        c.taken = true;
        this.clues[c.kind] = true;
        this.score += 100;
        sfx.item();
        this.burst(c.x + 8, c.y + 8, 12, '#ffd23f');
        this.hooks.clue?.(c.kind);
        this.hooks.hud?.(this);
      }
    }

    // B ボタン(X キー): 手帳を開く
    if (take('act')) {
      this.hooks.notebook?.();
      return;
    }

    // 判断シーン(端末の前を通ったら始まる。飛び越えても逃げられない)
    for (const term of this.terms) {
      if (!term.used && p.x + p.w > term.x + 4) {
        term.used = true;
        p.vx = 0;
        this.hooks.scene?.(term.id);
        return;
      }
    }

    // ログアウトゲート(ゴール)
    if (this.goal && p.x + p.w > this.goal.x + 6) {
      this.over = true;
      p.vx = 0;
      sfx.clear();
      this.hooks.goal?.(this);
      return;
    }

    // 演出
    for (const pt of this.parts) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 300 * dt;
      pt.life -= dt;
    }
    this.parts = this.parts.filter((pt) => pt.life > 0);
    for (const f of this.floats) {
      f.y -= 20 * dt;
      f.life -= dt;
    }
    this.floats = this.floats.filter((f) => f.life > 0);
    for (const b of this.bumps) b.life -= dt;
    this.bumps = this.bumps.filter((b) => b.life > 0);
    this.shieldFlash = Math.max(0, this.shieldFlash - dt);

    // カメラ(進む向きを少し先まで見せる)
    const target = p.x + p.w / 2 - this.vw / 2 + p.face * Math.min(36, this.vw * 0.18); // 進む向きを先まで見せる
    this.camX += (target - this.camX) * Math.min(1, dt * 5);
    this.camX = clamp(this.camX, 0, this.cols * T - this.vw);
  }

  // ---- 描画 ----
  // 計算は 320×180 の単位、描画はその RES 倍(640×360)の細かさで行う。
  render(g, now) {
    const S = this.S;
    const R = RES;
    const W = Math.round(this.vw * R);
    const H = Math.round(this.vh * R);
    const X = (wx) => Math.round((wx - this.camX) * R);
    const Y = (wy) => Math.round((wy - this.camY) * R);
    const t = now / 1000;
    const camD = this.camX * R; // 画面のドット単位でのカメラ位置
    const base = Y((this.rows - 2) * T); // 床の上端

    // ---- 背景 ----
    // 空: 帯状のグラデーション
    const bands = ['#060918', '#080c20', '#0a0f28', '#0c1330', '#0f1738', '#111b41'];
    bands.forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect(0, Math.floor((i * H) / bands.length), W, Math.ceil(H / bands.length) + 1);
    });
    // いちばん奥: 窓の明かりが灯るビル群(縦長の画面で、空が寂しくならないように)
    const o0 = Math.floor(camD * 0.06);
    for (let x = -(o0 % 176) - 176; x < W; x += 176) {
      const seed = Math.floor((x + o0) / 176) + 20;
      const bw = 96 + ((seed * 29) % 48);
      const bh = 300 + ((seed * 71) % 220);
      const bx = x + ((seed * 17) % 60);
      const by = base - bh;
      g.fillStyle = '#0a1029';
      g.fillRect(bx, by, bw, bh);
      g.fillStyle = '#0c1431';
      g.fillRect(bx + bw - 10, by, 10, bh);
      for (let wy = by + 14; wy < base - 20; wy += 18) {
        for (let wx = bx + 10; wx < bx + bw - 18; wx += 14) {
          const lit = ((wx * 7 + wy * 13 + seed * 31) >> 3) % 9 === 0;
          g.fillStyle = lit ? '#22366c' : '#0d1534';
          g.fillRect(wx, wy, 6, 8);
        }
      }
      // 屋上の航空障害灯
      if (Math.floor(t * 1.2 + seed) % 2 === 0) {
        g.fillStyle = '#ff3b5c';
        g.fillRect(bx + (bw >> 1) - 2, by - 4, 4, 4);
      }
    }

    // 奥: サーバーラック(ランプが点滅)
    const o1 = Math.floor(camD * 0.15);
    for (let x = -(o1 % 132) - 132; x < W; x += 132) {
      const seed = Math.floor((x + o1) / 132) + 50;
      const rh = 150 + ((seed * 53) % 70);
      const rx = x + 14;
      const ry = base - rh;
      g.fillStyle = '#0a1130';
      g.fillRect(rx, ry, 76, rh);
      g.fillStyle = '#0c1436';
      g.fillRect(rx + 4, ry + 4, 68, rh - 4);
      for (let k = 0; k + 14 < rh; k += 12) {
        g.fillStyle = '#080e28';
        g.fillRect(rx + 6, ry + 8 + k, 64, 3);
        const on = (seed * 7 + k / 12 + Math.floor(t * 1.5)) % 6 === 0;
        g.fillStyle = on ? '#2fd679' : '#142a55';
        g.fillRect(rx + 60, ry + 12 + k, 4, 3);
        g.fillStyle = '#132150';
        g.fillRect(rx + 10, ry + 12 + k, 22, 2);
      }
    }
    // 中: 流れるデータの筋
    const o2 = Math.floor(camD * 0.3);
    for (let x = -(o2 % 40) - 40; x < W; x += 40) {
      const seed = Math.floor((x + o2) / 40) + 100;
      const len = 40 + ((seed * 37) % 60);
      const sp = 40 + (seed % 5) * 14;
      const y = ((t * sp + seed * 97) % (H + len)) - 0;
      const sx = x + ((seed * 13) % 24);
      g.fillStyle = '#142152';
      g.fillRect(sx, y - len, 2, len);
      g.fillStyle = '#1f3a86';
      g.fillRect(sx, y - 14, 2, 10);
      g.fillStyle = '#4f8cff';
      g.fillRect(sx, y - 4, 2, 4);
    }
    // 手前: オフィスの机とモニター
    const o3 = Math.floor(camD * 0.55);
    for (let x = -(o3 % 120) - 120; x < W; x += 120) {
      g.fillStyle = '#121a40';
      g.fillRect(x + 6, base - 34, 4, 34);
      g.fillRect(x + 84, base - 34, 4, 34);
      g.fillStyle = '#18224e';
      g.fillRect(x, base - 40, 94, 6);
      g.fillStyle = '#1d2a5e';
      g.fillRect(x, base - 40, 94, 2);
      g.fillStyle = '#18224e';
      g.fillRect(x + 26, base - 80, 46, 32);
      g.fillRect(x + 44, base - 48, 10, 8);
      g.fillStyle = '#10245a';
      g.fillRect(x + 30, base - 76, 38, 24);
      g.fillStyle = '#183a78';
      g.fillRect(x + 33, base - 72, 22, 2);
      g.fillRect(x + 33, base - 66, 28, 2);
      g.fillRect(x + 33, base - 60, 16, 2);
    }

    // ---- マス ----
    const c0 = Math.max(0, Math.floor(this.camX / T));
    const c1 = Math.min(this.cols - 1, c0 + Math.ceil(this.vw / T) + 1);
    const ph = t % 3;
    const qf = ph < 0.5 ? 1 + Math.floor(ph / 0.125) : 0;
    for (let y = 0; y < this.rows; y++) {
      for (let x = c0; x <= c1; x++) {
        const ch = this.grid[y][x];
        if (ch === '.' || ch === 'H') continue;
        const b = this.bumps.find((bb) => bb.cx === x && bb.cy === y);
        const dy = b ? -6 : 0;
        const v = (x * 7 + y * 3) % 2;
        const img =
          ch === 'G' ? (this.tile(x, y - 1) === 'G' ? S.ground[v] : S.groundTop[v]) :
          ch === 'B' ? S.block :
          ch === 'Q' ? S.qblock[Math.min(qf, 4)] :
          S.used;
        g.drawImage(img, X(x * T), Y(y * T) + dy);
      }
    }

    // ---- 端末 ----
    for (const term of this.terms) {
      const x = X(term.x);
      const y = Y(term.y);
      g.drawImage(term.used ? S.terminalOff : S.terminal[Math.floor(t * 3) % 4], x, y);
      if (!term.used) {
        // 「!」のふきだし
        const by = y - 28 + Math.round(Math.sin(t * 5) * 3);
        g.fillStyle = '#070d26';
        g.fillRect(x + 8, by - 2, 16, 22);
        g.fillRect(x + 14, by + 20, 4, 3);
        g.fillStyle = '#ffd23f';
        g.fillRect(x + 10, by, 12, 18);
        g.fillStyle = '#fff4b0';
        g.fillRect(x + 10, by, 12, 2);
        g.fillStyle = '#070d26';
        g.fillRect(x + 14, by + 3, 4, 8);
        g.fillRect(x + 14, by + 13, 4, 3);
      }
    }

    // ---- ログアウトゲート ----
    if (this.goal) {
      const x = X(this.goal.x);
      const y = Y(this.goal.y);
      g.drawImage(S.door, x, y);
      g.fillStyle = `rgba(127,227,255,${0.25 + Math.sin(t * 3) * 0.15})`;
      g.fillRect(x + 8, y + 34, 16, 30);
    }

    // ---- 手がかり(光りながら浮く) ----
    for (const c of this.clueItems) {
      if (c.taken) continue;
      const x = X(c.x);
      const y = Y(c.y) + Math.round(Math.sin(t * 3 + c.x) * 3);
      const r = 18 + Math.sin(t * 4) * 2;
      g.fillStyle = 'rgba(255,210,63,0.16)';
      g.beginPath();
      g.arc(x + 16, y + 16, r, 0, Math.PI * 2);
      g.fill();
      g.drawImage(S[c.kind], x, y);
    }

    // ---- データの粒・アイテム ----
    for (const c of this.coins) {
      if (c.taken) continue;
      const f = Math.floor(t * 8 + c.x / 16) % 4;
      g.drawImage(S.crystal[f], X(c.x), Y(c.y) + Math.round(Math.sin(t * 4 + c.x) * 3));
    }
    for (const it of this.items) {
      if (it.taken) continue;
      g.drawImage(S.reboot, X(it.x), Y(it.y + it.rise) + Math.round(Math.sin(t * 4) * 2));
    }

    // ---- 敵 ----
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.flash > 0 && Math.floor(t * 30) % 2) continue;
      const fr = S[e.kind][Math.floor(t * 4) % 2][e.dir > 0 ? 'r' : 'l'];
      g.drawImage(fr, X(e.x - 2), Y(e.y - 6));
    }

    // ---- 主人公 ----
    const p = this.p;
    if (!(p.inv > 0 && Math.floor(t * 20) % 2)) {
      const side = p.face > 0 ? 'r' : 'l';
      const blink = t % 3.2 < 0.12 ? 1 : 0;
      const fr = !p.onGround
        ? (p.vy < 0 ? S.guard.jump : S.guard.fall)[side]
        : Math.abs(p.vx) > 8
          ? S.guard.run[Math.floor(p.anim * 2) % 4][side]
          : S.guard.stand[blink][side];
      g.drawImage(fr, X(p.x - 3), Y(p.y - 2));
    }
    // 多要素認証の盾が光る
    if (this.shieldFlash > 0) {
      const a = Math.min(1, this.shieldFlash);
      g.strokeStyle = `rgba(92,200,255,${a})`;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(X(p.x + 5), Y(p.y + 7), 26 + Math.sin(t * 12) * 3, 0, Math.PI * 2);
      g.stroke();
    }

    // ---- 演出 ----
    for (const pt of this.parts) {
      g.fillStyle = pt.color;
      g.fillRect(X(pt.x), Y(pt.y), 4, 4);
    }
    g.font = '16px "DotGothic16", monospace';
    g.textAlign = 'center';
    for (const f of this.floats) {
      g.fillStyle = '#070d26';
      g.fillText(f.text, X(f.x) + 2, Y(f.y) + 2);
      g.fillStyle = f.coin ? '#ffd23f' : '#fff4f0';
      g.fillText(f.text, X(f.x), Y(f.y));
    }
  }

  // 1日のまとめ(振り返りで使う)
  summary(grades) {
    const goods = this.judgments.filter((j) => j.tier === 'best').length;
    // 100点から、漏洩リスクと業務の遅れの最大値を引く。最善の判断が多いほど少し足す
    const points = Math.max(0, Math.min(100, 100 - this.maxLeak - this.maxDelay * 0.7 + goods * 2));
    let g = grades.find((x) => points >= x.min) || grades[grades.length - 1];
    if (g.grade === 'S' && goods < this.judgments.length) g = grades[1]; // S は全部最善のときだけ
    const badges = [];
    if (this.maxLeak === 0) badges.push('障害ゼロ件(誰にも褒められない)');
    if (this.judgments.length && goods === this.judgments.length) badges.push('判断ミスゼロ');
    if (this.clues.bookmark && this.clues.ledger) badges.push('備えあれば憂いなし');
    if (new Date().getHours() === 3) badges.push('午前3時の英雄');
    return {
      points: Math.round(points),
      grade: g.grade,
      boss: g.boss,
      score: this.score,
      time: this.time,
      maxLeak: this.maxLeak,
      maxDelay: this.maxDelay,
      goods,
      total: this.judgments.length,
      judgments: this.judgments,
      badges,
      cards: ['bec', 'phishing', 'verify'],
    };
  }
}
