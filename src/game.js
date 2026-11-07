// ステージの中身: 地図・主人公・敵・仕掛け・描画。
// 画面に文字を出す場面(判断シーン・扉・報告書など)は hooks で外(ui.js)に任せる。
import { TILE as T } from './sprites.js';
import { held, take } from './input.js';
import { sfx } from './audio.js';

export const VIEW_W = 320;
export const VIEW_H = 180;

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
  constructor(stage, sprites, hooks) {
    this.stage = stage;
    this.S = sprites;
    this.hooks = hooks;
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
    this.events = [];
    this.spawns = [];
    this.doors = [];
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
          case 'T': this.terms.push({ x: px, y: py, w: T, h: T, id: st.terminals[ti++], used: false }); break;
          case 'i': this.hints.push({ x: px, text: st.hints[hi++], shown: false }); break;
          case 'A': this.events.push({ x: px, done: false }); break;
          case 'x': this.spawns.push({ x: px + 2, y: py + 6 }); break;
          case 'D':
          case 'F':
            this.doors.push({ x: px, y: py - T, w: T, h: T * 2, kind: ch, ...st.doors[ch], marked: false });
            break;
          default: clear = false;
        }
        if (clear) this.grid[y][x] = '.';
      }
    }
    this.p = { ...body(start.x, start.y, 10, 14), face: 1, coyote: 0, buffer: 0, inv: 0, jumping: false, anim: 0 };
    this.safe = { x: start.x, y: start.y };
    this.flags = { reuse: false, mfa: false };
    this.leak = 0;
    this.maxLeak = 0;
    this.score = 0;
    this.causes = [];
    this.judgments = []; // { id, result }
    this.time = 0;
    this.t = 0;
    this.camX = 0;
    this.camY = this.rows * T - VIEW_H;
    this.shieldFlash = 0;
    this.nearDoor = null;
    this.over = false;
    this.hooks.hud?.(this);
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
      this.floats.push({ x: cx * T + 8, y: cy * T - 4, text: '+10', life: 0.7, coin: true });
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
    if (this.leak >= 100) {
      this.over = true;
      sfx.over();
      this.hooks.over?.(this);
    }
  }

  hurt(cause, n, from) {
    const p = this.p;
    if (p.inv > 0 || this.over) return;
    p.inv = 1.3;
    p.vx = (from && p.x + p.w / 2 < from.x + from.w / 2 ? -1 : 1) * 120;
    p.vy = -170;
    sfx.hurt();
    this.addLeak(n, cause);
    this.burst(p.x + 5, p.y + 7, 8, '#ff004d');
  }

  defeat(e) {
    e.dead = true;
    this.score += 50;
    sfx.stomp();
    this.burst(e.x + 6, e.y + 5, 10, e.kind === 'phish' ? '#fff1e8' : '#ff77a8');
    this.floats.push({ x: e.x + 6, y: e.y - 4, text: '+50', life: 0.7 });
  }

  burst(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.parts.push({ x, y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 40, life: 0.5, color });
    }
  }

  // ---- 判断シーンや扉の結果を受け取る ----
  applyScene(id, choice) {
    // choice: 選んだ選択肢(時間切れなら timeout の内容)。null にはならない
    Object.assign(this.flags, choice.flag || {});
    if (choice.leak) this.addLeak(choice.leak, choice.cause);
    if (choice.result === 'good') this.score += 300;
    if (id === 'mfa' && this.flags.mfa) this.shieldFlash = 1.5;
    this.judgments.push({ id, result: choice.result || 'timeout' });
  }

  enterDoor(door) {
    if (door.real) {
      this.judgments.push({ id: 'phishing', result: this.doors.some((d) => d.marked) ? 'bad' : 'good' });
      this.over = true;
      sfx.clear();
      this.hooks.clear?.(this);
    } else {
      door.marked = true;
      this.p.x = door.x - 28;
      this.p.vx = 0;
      sfx.bad();
      this.hooks.banner?.('偽サイトだった! 入力した ID とパスワードが盗まれた……', 'bad');
      this.addLeak(40, 'phishing');
    }
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
      this.hooks.banner?.('足元を確かめずに、本番環境へ落ちた……', 'bad');
      this.addLeak(30, 'pit');
      if (this.over) return;
      Object.assign(p, { x: this.safe.x, y: this.safe.y, vx: 0, vy: 0, inv: 1.3 });
    }

    // 敵
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (!e.awake && e.x < this.camX + VIEW_W + 24) e.awake = true;
      if (!e.awake) continue;
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
          this.hurt(e.kind === 'phish' ? 'phishMail' : 'weakPass', 20, e);
          if (this.over) return;
        }
      }
    }

    // データの粒
    for (const c of this.coins) {
      if (!c.taken && overlap(p, c)) {
        c.taken = true;
        this.score += 10;
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
        this.hooks.banner?.(h.text, 'info');
      }
    }

    // 判断シーンの端末(前を通ったら始まる。飛び越えても逃げられない)
    for (const term of this.terms) {
      if (!term.used && p.x + p.w > term.x + 4) {
        term.used = true;
        p.vx = 0;
        this.hooks.scene?.(term.id);
        return;
      }
    }

    // 事件: パスワード使い回しのツケ
    for (const ev of this.events) {
      if (ev.done || p.x < ev.x) continue;
      ev.done = true;
      if (this.flags.reuse && !this.flags.mfa) {
        sfx.alarm();
        this.hooks.banner?.('警告: 使い回したパスワードで、不正ログインされた!', 'bad');
        for (const s of this.spawns) {
          const e = this.enemy('pass', s.x, s.y - 40);
          e.awake = true;
          this.enemies.push(e);
        }
        this.addLeak(15, 'credential');
        if (this.over) return;
      } else if (this.flags.reuse && this.flags.mfa) {
        sfx.good();
        this.shieldFlash = 2;
        this.hooks.banner?.('使い回したパスワードでログインを試みられた……が、多要素認証が止めた!', 'good');
      } else {
        this.hooks.banner?.('どこかで漏れたパスワードが試された。でも使い回していないので、ここは無事。', 'good');
      }
    }

    // 扉
    const near = this.doors.find((d) => Math.abs(p.x + p.w / 2 - (d.x + 8)) < 12 && Math.abs(p.y + p.h - (d.y + d.h)) < 20);
    if (near !== this.nearDoor) {
      this.nearDoor = near || null;
      this.hooks.prompt?.(near ? (near.marked ? 'この扉は偽物だった' : '調べる: 扉の看板を読む') : null);
    }
    if (take('act') && near && !near.marked) {
      this.hooks.door?.(near);
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
    const target = p.x + p.w / 2 - VIEW_W / 2 + p.face * 28;
    this.camX += (target - this.camX) * Math.min(1, dt * 5);
    this.camX = clamp(this.camX, 0, this.cols * T - VIEW_W);
  }

  // ---- 描画 ----
  render(g, now) {
    const S = this.S;
    const cx = Math.round(this.camX);
    const cy = Math.round(this.camY);
    const t = now / 1000;

    // 背景: 奥のデータの流れと、手前のオフィス
    g.fillStyle = '#0b0f24';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    g.fillStyle = '#121a3a';
    const off1 = Math.floor(cx * 0.2);
    for (let x = -(off1 % 24); x < VIEW_W; x += 24) {
      const seed = Math.floor((x + off1) / 24);
      const h = 30 + ((seed * 37) % 60);
      const y = (t * (10 + (seed % 5) * 4) + seed * 53) % (VIEW_H + h);
      g.fillRect(x + 6, y - h, 1, h);
    }
    const off2 = Math.floor(cx * 0.5);
    for (let x = -(off2 % 56); x < VIEW_W; x += 56) {
      const bx = x;
      g.fillStyle = '#151d40';
      g.fillRect(bx, 140, 44, 4); // 机
      g.fillRect(bx + 4, 144, 2, 16);
      g.fillRect(bx + 38, 144, 2, 16);
      g.fillStyle = '#1a2550';
      g.fillRect(bx + 12, 124, 20, 14); // モニター
      g.fillRect(bx + 20, 138, 4, 2);
      g.fillStyle = '#20356a';
      g.fillRect(bx + 14, 126, 16, 10);
    }

    // マス
    const c0 = Math.floor(cx / T);
    const c1 = Math.min(this.cols - 1, c0 + Math.ceil(VIEW_W / T) + 1);
    for (let y = 0; y < this.rows; y++) {
      for (let x = c0; x <= c1; x++) {
        const ch = this.grid[y][x];
        if (ch === '.' || ch === 'H') continue;
        const b = this.bumps.find((bb) => bb.cx === x && bb.cy === y);
        const dy = b ? -3 : 0;
        const img =
          ch === 'G' ? (this.tile(x, y - 1) === 'G' ? S.ground : S.groundTop) :
          ch === 'B' ? S.block :
          ch === 'Q' ? S.qblock :
          S.used;
        g.drawImage(img, x * T - cx, y * T - cy + dy);
      }
    }

    // 端末
    for (const term of this.terms) {
      const x = term.x - cx;
      const y = term.y - cy;
      g.drawImage(term.used ? S.terminalOff : S.terminal, x, y);
      if (!term.used) {
        const by = y - 12 + Math.round(Math.sin(t * 5) * 1.5);
        g.fillStyle = '#ffec27';
        g.fillRect(x + 5, by, 6, 8);
        g.fillStyle = '#000';
        g.fillRect(x + 7, by + 1, 2, 4);
        g.fillRect(x + 7, by + 6, 2, 1);
      }
    }

    // 扉
    for (const d of this.doors) {
      const x = d.x - cx;
      const y = d.y - cy;
      g.drawImage(S.door, x, y);
      if (d.marked) {
        g.strokeStyle = '#ff004d';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x + 2, y + 10);
        g.lineTo(x + 14, y + 30);
        g.moveTo(x + 14, y + 10);
        g.lineTo(x + 2, y + 30);
        g.stroke();
      }
      if (d === this.nearDoor && !d.marked) {
        g.fillStyle = '#fff1e8';
        g.fillRect(x + 6, y - 8 + Math.round(Math.sin(t * 6)), 4, 4);
      }
    }

    // データの粒
    for (const c of this.coins) {
      if (c.taken) continue;
      g.drawImage(S.coin, c.x - cx, c.y - cy + Math.round(Math.sin(t * 4 + c.x) * 1.5));
    }

    // アイテム
    for (const it of this.items) {
      if (it.taken) continue;
      g.drawImage(S.reboot, it.x - cx, it.y - cy + it.rise);
    }

    // 敵
    for (const e of this.enemies) {
      if (e.dead) continue;
      const set = S[e.kind];
      const fr = set[Math.floor(t * 4) % 2][e.dir > 0 ? 'r' : 'l'];
      if (e.flash > 0 && Math.floor(t * 30) % 2) continue;
      g.drawImage(fr, Math.round(e.x - 2 - cx), Math.round(e.y - 6 - cy));
    }

    // 主人公
    const p = this.p;
    if (!(p.inv > 0 && Math.floor(t * 20) % 2)) {
      const side = p.face > 0 ? 'r' : 'l';
      const fr = !p.onGround
        ? S.guard.jump[side]
        : Math.abs(p.vx) > 8
          ? S.guard.run[Math.floor(p.anim * 2) % 4][side]
          : S.guard.stand[side];
      g.drawImage(fr, Math.round(p.x - 3 - cx), Math.round(p.y - 2 - cy));
    }
    // 多要素認証の盾が光る
    if (this.shieldFlash > 0) {
      const a = Math.min(1, this.shieldFlash);
      g.strokeStyle = `rgba(41,173,255,${a})`;
      g.lineWidth = 1;
      g.beginPath();
      g.arc(Math.round(p.x + 5 - cx), Math.round(p.y + 7 - cy), 12 + Math.sin(t * 12) * 1.5, 0, Math.PI * 2);
      g.stroke();
    }

    // 演出
    for (const pt of this.parts) {
      g.fillStyle = pt.color;
      g.fillRect(Math.round(pt.x - cx), Math.round(pt.y - cy), 2, 2);
    }
    g.font = '8px monospace';
    g.textAlign = 'center';
    for (const f of this.floats) {
      g.fillStyle = '#000';
      g.fillText(f.text, Math.round(f.x - cx) + 1, Math.round(f.y - cy) + 1);
      g.fillStyle = f.coin ? '#ffec27' : '#fff1e8';
      g.fillText(f.text, Math.round(f.x - cx), Math.round(f.y - cy));
    }
  }

  // クリア時のまとめ
  summary() {
    const goods = this.judgments.filter((j) => j.result === 'good').length;
    const badges = [];
    if (this.maxLeak === 0) badges.push('障害ゼロ件(誰にも褒められない)');
    if (this.judgments.length && this.judgments.every((j) => j.result === 'good')) badges.push('判断ミスゼロ');
    if (this.flags.reuse && this.flags.mfa) badges.push('多要素認証に救われた人');
    if (new Date().getHours() === 3) badges.push('午前3時の英雄');
    return {
      score: this.score,
      time: this.time,
      maxLeak: this.maxLeak,
      goods,
      total: this.judgments.length,
      badges,
      cards: ['bec', 'reuse', 'mfa', 'phishing'],
    };
  }
}
