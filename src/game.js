// ステージの中身: 地図・主人公・敵・仕掛け・描画。
// 画面に文字を出す場面(判断シーン・扉・報告書など)は hooks で外(ui.js)に任せる。
import { TILE as T, RES } from './sprites.js';
import { held, take } from './input.js';
import { sfx } from './audio.js';
import { gimmickMethods } from './gimmicks.js';
import { weaponMethods } from './weapons.js';

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

const SOLID = new Set(['G', 'B', 'Q', 'U', 'X', '#', 'Y']); // X 認証ゲート / # 仕切りの壁 / Y 添付ファイルの箱
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
    this.ownedWeapons = []; // 手に入れた特殊武器(main.js が入れる)
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
    this.released = {}; // 説明が終わって動いてよくなった敵の組(tutorial / sort)
    this.sighted = {}; // 初めて画面に映った敵の種類
    this.clueItems = [];
    this.goal = null;
    this.bumps = [];
    this.shots = []; // 主人公の弾
    this.spawners = []; // 迷惑メールの群れが湧く場所
    let start = { x: 32, y: 0 };
    let ti = 0;
    let hi = 0;
    const mails = [];
    this.gimmickReset();
    this.weaponReset(this.ownedWeapons);
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
          case 'M': mails.push(this.enemy('mail', px + 2, py + 6)); break;
          case 'v': this.enemies.push(this.enemy('virus', px + 2, py + 6)); break;
          case 'b': this.enemies.push(this.enemy('bot', px + 2, py + 6)); break;
          case 'c': this.enemies.push(this.enemy('staff', px + 3, py + 6)); break;
          case 't': this.enemies.push(this.enemy('tail', px + 3, py + 6)); break;
          case 's': this.spawners.push({ x: px, y: py, n: 5, t: 0, on: false }); break;
          case 'o': this.coins.push({ x: px + 4, y: py + 4, w: 8, h: 8 }); break;
          case 'T': this.terms.push({ x: px, y: py, w: T, h: T, id: this.day.scenes[ti++], used: false }); break;
          case 'i': this.hints.push({ x: px, line: this.day.hints[hi++], shown: false }); break;
          case 'K': this.clueItems.push({ kind: 'bookmark', x: px, y: py, w: T, h: T }); break;
          case 'L': this.clueItems.push({ kind: 'ledger', x: px, y: py, w: T, h: T }); break;
          case 'J': this.clueItems.push({ kind: 'rules', x: px, y: py, w: T, h: T }); break;
          case 'V': this.clueItems.push({ kind: 'extlist', x: px, y: py, w: T, h: T }); break;
          case 'N': this.clueItems.push({ kind: 'naisen', x: px, y: py, w: T, h: T }); break;
          case 'F': this.clueItems.push({ kind: 'irp', x: px, y: py, w: T, h: T }); break;
          case 'Z': this.goal = { x: px, y: py - T, w: T, h: T * 2 }; break;
          default: clear = this.gimmickTile(ch, px, py, x, y);
        }
        if (clear) this.grid[y][x] = '.';
      }
    }
    // メール便: 半分を偽物にする(どれが偽物かは毎回変わる)
    //   月曜: 偽物はドメインが本物の1文字違い / 金曜: ドメインは本物(乗っ取り)で、口座だけが違う
    const mc = this.day.mails || {};
    const realDomain = mc.real || 'sample-bussan';
    const fakes = [...(mc.fakes || ['sanple-bussan', 'samp1e-bussan', 'sample-busan', 'sample-bussam', 'sarnple-bussan'])];
    const fakeAccounts = [...(mc.account?.fakes || [])];
    for (let i = fakes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [fakes[i], fakes[j]] = [fakes[j], fakes[i]];
    }
    const order = mails.map((_, i) => i).sort(() => Math.random() - 0.5);
    const fakeSet = new Set(order.slice(0, Math.ceil(mails.length / 2)));
    mails.forEach((m, i) => {
      m.real = !fakeSet.has(i);
      if (mc.account) {
        // 乗っ取り: ドメインはどれも本物。偽物は口座が違う
        m.domain = realDomain;
        m.account = m.real ? mc.account.real : fakeAccounts.pop() || mc.account.fakes[0];
      } else {
        m.domain = m.real ? realDomain : fakes.pop() || 'sanple-bussan';
      }
      m.speed = mc.speed || 18;
      m.gate = 'sort';
      this.enemies.push(m);
    });
    this.sort = { fakes: mails.filter((m) => !m.real).length, reals: mails.filter((m) => m.real).length, caught: 0, delivered: 0, passed: 0, stomped: 0, missed: 0 };
    this.gimmickAfterParse();
    // 練習区間の敵は、敵の説明が終わるまで待つ
    for (const e of this.enemies) if (e.x < (st.tutorialEnd || 0) * T) e.gate = 'tutorial';

    this.p = { ...body(start.x, start.y, 10, 14), face: 1, coyote: 0, buffer: 0, inv: 0, jumping: false, anim: 0, charge: 0, shootPose: 0 };
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
    this.flags = {}; // 判断シーンの選択で立つ印(水曜: パスワードの使い回し)
    this.kills = 0; // 倒した敵
    this.intruded = []; // 倒さずに取り逃がして、社内に入り込んだ敵の種類
    this.ioc = 0; // 倒した敵が落とした痕跡(3つで判断シーンのヒント1回)
    this.combo = { n: 0, t: 0 }; // 続けて倒した数
    this.shotCool = 0;
    this.eye = { found: 0, total: 0, falseN: 0 }; // メールの見抜きの成績
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
    const e = { ...body(x, y, 12, 10), kind, dir: -1, speed: kind === 'phish' ? 26 : 22, dead: false, awake: false, flash: 0, hp: 1, t: 0 };
    if (kind === 'pass') Object.assign(e, { hp: 3, hopT: 1 + Math.random() }); // 鎧: 弾なら3発(ため撃ちなら1発)、踏めば1回で割れる。近づくと跳びかかる
    if (kind === 'virus') Object.assign(e, { speed: 30, gen: 0, split: 4 });
    if (kind === 'spam') Object.assign(e, { w: 8, h: 7, y: y + 3, speed: 62 });
    if (kind === 'phish') e.throwT = 1.2 + Math.random();
    if (kind === 'staff' || kind === 'tail') Object.assign(e, { w: 10, h: 14, y: y - 4, dir: 1, speed: 24 });
    if (kind === 'bot') Object.assign(e, { homeX: x, fly: true, hp: 2, speed: 34, baseY: y - 3 * T, y: y - 3 * T, state: 'patrol', st: 0 });
    return e;
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
    } else if (ch === 'Y') {
      this.openFile(cx, cy);
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
      if (!e.dead && e.kind !== 'mail' && Math.abs(e.x + e.w / 2 - (cx * T + 8)) < 12 && Math.abs(e.y + e.h - cy * T) < 3) {
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
    sfx.stomp();
    const col = { phish: '#fff1e8', virus: '#5dff8a', spam: '#ff9fc6' }[e.kind] || '#ff77a8';
    this.burst(e.x + 6, e.y + 5, 10, col);
    // 続けて倒すほど点が増える(迷惑メールの群れをまとめて倒すと気持ちいい)
    this.combo.n = this.combo.t > 0 ? this.combo.n + 1 : 1;
    this.combo.t = 1.2;
    const mult = Math.min(this.combo.n, 5);
    this.score += 50 * mult;
    this.kills++;
    if (this.inTutorial()) {
      this.floats.push({ x: e.x + 6, y: e.y - 4, text: '撃退!', life: 0.7 });
      return;
    }
    // 痕跡(IOC)を落とす。3つ集めると、判断シーンで怪しいところを1つ光らせられる
    this.ioc++;
    this.floats.push({ x: e.x + 6, y: e.y - 4, text: mult > 1 ? `撃退 ×${mult}` : '撃退! 痕跡+1', life: 0.8, coin: mult > 1 });
    if (this.ioc % 3 === 0) this.hooks.banner?.(`痕跡が ${this.ioc} つ。判断シーンでヒントに使える(${Math.floor(this.ioc / 3)}回分)`, 'good');
    this.hooks.hud?.(this);
  }

  // 敵に当てた(弾 dmg / 踏みつけ)。倒したら true
  hitEnemy(e, dmg, how, shot) {
    // フィッシングは「なりすましの盾」で、正面からの小さい弾をはじく(釣り針を投げる瞬間だけ盾が下がる)
    if (e.kind === 'phish' && e.gate !== 'tutorial' && how === 'shot' && shot && Math.sign(shot.vx) === -e.dir && !(e.throwT < 0.45 && e.throwT > 0)) {
      sfx.bump();
      this.floats.push({ x: e.x + 6, y: e.y - 6, text: 'ガード!', life: 0.5 });
      this.burst(e.x + (e.dir > 0 ? 12 : 0), e.y + 4, 4, '#bff0ff');
      if (!this.guardTold) {
        this.guardTold = true;
        if (!this.hooks.sightSeen?.('phishGuard')) {
          this.hooks.markSight?.('phishGuard');
          this.hooks.say?.({ who: 'guard', text: '盾ではじかれた! 釣り針を投げる瞬間(「!」)か、ため撃ち・踏みつけなら通ります' });
        }
      }
      return 'guard';
    }
    if (e.kind === 'staff') {
      // 本物の社員を撃ってしまった(倒れない。仕事が止まる)
      if (e.flash > 0) return 'guard';
      e.flash = 0.8;
      sfx.bad();
      this.floats.push({ x: e.x + 5, y: e.y - 8, text: '同僚だった!', life: 1 });
      this.addDelay(6, 'hitColleague');
      return 'guard';
    }
    if (e.kind === 'mail') {
      // メール便は、撃つ = 追い返す(仕分け)。本物を撃つと業務が止まる
      this.sortMail(e, true);
      return true;
    }
    e.hp -= dmg;
    e.flash = 0.2;
    if (e.kind === 'pass' && e.hp <= 0 && how !== 'charge') {
      // 鎧が割れて、中身が逃げ回る
      e.kind = 'soft';
      e.hp = 1;
      e.speed = 52;
      e.flash = 0.25;
      this.score += 30;
      sfx.armor();
      this.floats.push({ x: e.x + 6, y: e.y - 6, text: 'パキッ', life: 0.8 });
      return false;
    }
    if (e.hp > 0) {
      sfx.armor();
      this.floats.push({ x: e.x + 6, y: e.y - 6, text: 'カン!', life: 0.5 });
      return false;
    }
    this.defeat(e);
    return true;
  }

  // ---- 弾を撃つ(B ボタン / X キー)。長く押してから離すと、ためた大きい弾 ----
  fire(big) {
    const p = this.p;
    if (!big && (this.shots.filter((s) => !s.big).length >= 3 || this.shotCool > 0)) return;
    this.shotCool = 0.12;
    const w = big ? 14 : 7;
    const h = big ? 10 : 5;
    this.shots.push({
      x: p.face > 0 ? p.x + p.w : p.x - w,
      y: p.y + (big ? 2 : 5),
      w,
      h,
      vx: p.face * (big ? 230 : 260),
      big,
      life: big ? 0.9 : 0.55, // 小さい弾は射程が短い(画面の半分ほど)
      hit: new Set(),
    });
    p.shootPose = 0.25;
    sfx[big ? 'charge' : 'shot']();
  }

  updateShots(dt) {
    for (const s of this.shots) {
      s.x += s.vx * dt;
      s.y += (s.vy || 0) * dt;
      s.life -= dt;
      if (this.solidAt(Math.floor((s.x + s.w / 2) / T), Math.floor((s.y + s.h / 2) / T))) {
        s.life = 0;
        this.burst(s.x + s.w / 2, s.y + s.h / 2, 4, '#ffd23f');
        continue;
      }
      for (const e of this.enemies) {
        if (e.dead || s.hit.has(e) || (e.gate && !this.released[e.gate]) || !overlap(s, e)) continue;
        s.hit.add(e);
        if (e.jail !== undefined) continue;
        if (s.kind) {
          this.specialHit(s, e);
          if (this.over) return;
          s.life = 0;
          break;
        }
        const r = this.hitEnemy(e, s.big ? 3 : 1, s.big ? 'charge' : 'shot', s);
        if (this.over) return;
        if (r === 'guard') {
          s.life = 0;
          break;
        }
        if (!s.big) {
          s.life = 0; // 小さい弾は1体で消える。ためた弾は貫く
          break;
        }
      }
      if (s.life > 0 && this.bossShot?.(s)) s.life = s.big ? s.life : 0;
    }
    this.shots = this.shots.filter((s) => s.life > 0);
  }

  // 倒さずに取り逃がした敵は、社内に入り込む(夕方にまとめて見つかる)
  intrude(e) {
    e.dead = true;
    this.intruded.push(e.kind);
    this.floats.push({ x: this.camX + 30, y: this.p.y - 20, text: '取り逃がした……', life: 1 });
  }

  // メール便を仕分けた。stomp: 踏んで追い返した / そうでなければ受け止めた
  sortMail(e, stomp) {
    e.dead = true;
    const fx = e.x + 6;
    const fy = e.y - 18;
    if (stomp && !e.real) {
      this.sort.caught++;
      this.score += 100;
      sfx.good();
      this.burst(fx, e.y + 5, 12, '#ffd23f');
      this.floats.push({ x: fx, y: fy, text: '見抜いた!', life: 1, coin: true });
    } else if (stomp && e.real) {
      this.sort.stomped++;
      sfx.bad();
      this.burst(fx, e.y + 5, 8, '#b18cff');
      this.floats.push({ x: fx, y: fy, text: '本物だった…', life: 1.2 });
      this.addDelay(8, 'stompReal');
    } else if (e.real) {
      this.sort.delivered++;
      this.score += 50;
      sfx.coin();
      this.burst(fx, e.y + 5, 10, '#7fe3ff');
      this.floats.push({ x: fx, y: fy, text: '届けた!', life: 1, coin: true });
      this.delay = Math.max(0, this.delay - 5);
      this.hooks.hud?.(this);
    } else {
      this.sort.passed++;
      sfx.hurt();
      this.p.inv = 0.6;
      this.burst(fx, e.y + 5, 10, '#ff3b5c');
      this.floats.push({ x: fx, y: fy, text: '偽物を通した…', life: 1.2 });
      this.addLeak(12, this.day.mails?.account ? 'accountFake' : 'passFake');
    }
  }

  missMail(e) {
    e.dead = true;
    const fx = this.p.x + 5;
    const fy = this.p.y - 22;
    if (!e.real) {
      this.sort.passed++;
      sfx.hurt();
      this.floats.push({ x: fx, y: fy, text: '偽物が受信箱へ…', life: 1.4 });
      this.addLeak(10, this.day.mails?.account ? 'accountFake' : 'passFake');
    } else {
      this.sort.missed++;
      sfx.bad();
      this.floats.push({ x: fx, y: fy, text: '本物を受け取りそこねた', life: 1.4 });
      this.addDelay(5, 'missReal');
    }
  }

  sortReportText() {
    const s = this.sort;
    const head = `仕分けの結果: 偽物を見抜いた ${s.caught}/${s.fakes}、本物を届けた ${s.delivered}/${s.reals}。`;
    if (s.caught === s.fakes && s.delivered === s.reals) return head + 'パーフェクトです! 1文字違いも見逃しませんでした';
    if (s.passed) return head + '偽物を通してしまいました……。札を、台帳の本物と1文字ずつ見比べましょう';
    if (s.stomped) return head + '本物まで追い返してしまいました。見比べて本物なら、受け取って大丈夫です';
    if (s.missed) return head + '本物を受け取りそこねました。素通りさせず、本物は受け止めて届けましょう';
    return head + 'いくつか取り逃しました。次は全部仕分けましょう';
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
    this.score += (r.score || 0) + (r.found || 0) * 50;
    // メールの見抜き: 問題ないところに付けた印は「疑いすぎ」
    this.eye.found += r.found || 0;
    this.eye.total += r.total || 0;
    this.eye.falseN += r.falseN || 0;
    if (r.falseN) this.addDelay(r.falseN * 3, 'falseFlag');
    if (r.flag) Object.assign(this.flags, r.flag);
    if (r.iocUsed) this.ioc = Math.max(0, this.ioc - r.iocUsed * 3);
    this.judgments.push({ id, tier: r.tier });
    this.hooks.hud?.(this);
  }

  // 水曜: 使い回したパスワードが、よそのサービスから漏れた
  credentialEvent() {
    const p = this.p;
    if (!this.flags.reuse) {
      this.hooks.say?.({ who: 'guard', text: 'ニュース速報: 有名な通販サイトからパスワードが漏れたそうです。……{name}さんは使い回していないので、大丈夫!' });
      this.score += 100;
      return;
    }
    this.hooks.banner?.('通販サイトから漏れたパスワードで、勤怠システムに不正ログイン! 漏洩ゲージ +15%', 'bad');
    this.addLeak(15, 'reuseLeak');
    // 使い回したパスワードの化身が、前後から押し寄せる
    for (const dx of [6, 9, -7]) {
      const x = p.x + dx * T;
      const e = this.enemy('pass', x, p.y + p.h - 12);
      e.dir = dx > 0 ? -1 : 1;
      this.enemies.push(e);
    }
    this.hooks.say?.({ who: 'guard', text: 'いつものパスワードが、ほかのサイトから漏れていたんです……! 化身が押し寄せてきます!' });
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

    // 迷惑メールの群れ: 近づくと、続けざまに流れてくる
    for (const sp of this.spawners) {
      if (!sp.on && sp.x < this.camX + this.vw + 8) sp.on = true;
      if (!sp.on || sp.n <= 0) continue;
      sp.t -= dt;
      if (sp.t <= 0) {
        sp.t = 0.35;
        sp.n--;
        const e = this.enemy('spam', sp.x, sp.y + 6);
        e.awake = true;
        this.enemies.push(e);
      }
    }

    // 敵
    for (const e of this.enemies) {
      if (e.dead) continue;
      // 説明が終わるまで、その場で待つ敵(練習区間の敵・メール便)
      if (e.gate && !this.released[e.gate]) continue;
      if (!e.awake && e.x < this.camX + this.vw + 24) e.awake = true;
      if (!e.awake) continue;
      if (e.jail !== undefined) continue; // 隔離中は動かない
      // 初めて画面に映った種類の敵なら、ガードが説明する
      // (共連れは、社員と並んで画面の中ほどに来てから説明する)
      if (!this.sighted[e.kind] && e.x < this.camX + (e.kind === 'tail' ? this.vw * 0.6 : this.vw - 8) && e.x > this.camX) {
        this.sighted[e.kind] = true;
        let first = this.day.firstSight?.[e.kind];
        // 敵の説明は、どの日でも一度見たら出さない
        if (first?.help && (this.hooks.learned?.() || this.hooks.sightSeen?.(e.kind))) first = null;
        if (first) this.hooks.markSight?.(e.kind);
        if (first?.talk) {
          p.vx = 0;
          this.hooks.lesson?.(first.talk);
          return;
        }
        if (first?.say) this.hooks.say?.(first.say);
      }
      e.flash = Math.max(0, e.flash - dt);
      e.t += dt;
      // フィッシング: 近づくと立ち止まって、釣り針を投げてくる(投げた直後がスキ)
      if (e.kind === 'phish' && !e.gate && e.onGround && Math.abs(e.x - p.x) < 7 * T) {
        e.dir = p.x < e.x ? -1 : 1; // 盾をこちらへ向ける
        e.throwT -= dt;
        if (e.throwT < 0.45 && e.throwT > 0) {
          e.vx = 0;
          e.dir = p.x < e.x ? -1 : 1;
          e.flash = Math.max(e.flash, 0.05);
          this.moveY(e, dt);
          continue;
        }
        if (e.throwT <= 0) {
          e.throwT = 2.6;
          const dx = p.x - e.x;
          this.hooksShot.push({ x: e.x + 4, y: e.y - 4, w: 8, h: 8, vx: clamp(dx * 0.9, -120, 120), vy: -170, cause: 'phishMail', dmg: 6 });
          sfx.tick();
        }
      }
      // Password1!(総当たり攻撃): 近づくと、こちらへ跳びかかってくる
      if (e.kind === 'pass' && !e.gate && e.onGround && Math.abs(e.x - p.x) < 6 * T) {
        e.hopT -= dt;
        if (e.hopT <= 0) {
          e.hopT = 1.5;
          e.dir = p.x < e.x ? -1 : 1;
          e.vy = -250;
          e.onGround = false;
          e.hopping = true;
        }
      }
      // 迷惑メール: 小刻みに跳ねながら流れてくる(地面すれすれの弾をすり抜ける)
      if (e.kind === 'spam' && e.onGround) e.vy = -150 - Math.random() * 40;
      // ボット: 空を飛び、真上に来ると急降下してくる
      if (e.fly) {
        e.st += dt;
        if (e.state === 'patrol') {
          e.dir = p.x < e.x ? -1 : 1;
          // 持ち場(置かれた場所の前後6マス)からは離れない
          e.x = clamp(e.x + e.dir * e.speed * dt, e.homeX - 6 * T, e.homeX + 6 * T);
          e.y = e.baseY + Math.sin(e.t * 3) * 10;
          if (Math.abs(p.x - e.x) < 2 * T && e.st > 1.2) {
            e.state = 'aim';
            e.st = 0;
          }
        } else if (e.state === 'aim') {
          e.flash = Math.max(e.flash, 0.05);
          if (e.st > 0.35) {
            e.state = 'dive';
            e.st = 0;
            const dx = p.x - e.x;
            const dy = p.y - e.y;
            const d = Math.hypot(dx, dy) || 1;
            e.dvx = (dx / d) * 170;
            e.dvy = (dy / d) * 170;
          }
        } else if (e.state === 'dive') {
          e.x += e.dvx * dt;
          e.y += e.dvy * dt;
          if (e.st > 0.7 || e.y + e.h >= (this.rows - 2) * T) {
            e.y = Math.min(e.y, (this.rows - 2) * T - e.h);
            e.state = 'rise';
            e.st = 0;
          }
        } else if (e.state === 'rise') {
          e.y += (e.baseY - e.y) * Math.min(1, dt * 2.5);
          if (e.st > 1) {
            e.state = 'patrol';
            e.st = 0;
          }
        }
      }
      // 共連れ: 本物の社員のすぐ後ろに付いて歩く。社員がいなければ、こちらへ向かってくる
      if (e.kind === 'tail') {
        const host = this.enemies.find((o) => o.kind === 'staff' && !o.dead && Math.abs(o.x - e.x) < 5 * T);
        if (host) {
          const tx = host.x - host.dir * 14;
          e.dir = tx < e.x ? -1 : 1;
          e.speed = Math.abs(tx - e.x) > 3 ? 30 : 0;
        } else {
          e.dir = p.x < e.x ? -1 : 1;
          e.speed = 34;
        }
      }
      // マルウェア: 放っておくと分裂して増える
      if (e.kind === 'virus' && (e.gen || 0) < 2) {
        e.split -= dt;
        if (e.split <= 0) {
          e.split = 4;
          e.gen = (e.gen || 0) + 1;
          const c = this.enemy('virus', e.x, e.y);
          Object.assign(c, { awake: true, gen: e.gen, dir: -e.dir, vy: -160 });
          this.enemies.push(c);
          e.flash = 0.3;
          this.floats.push({ x: e.x + 6, y: e.y - 6, text: '増殖!', life: 0.8 });
        }
      }
      if (e.fly) {
        // 飛ぶ敵は、地形を気にせず動く(上のブロック)
      } else {
      e.vx = e.dir * e.speed * (e.hopping ? 1.6 : 1);
      e.vy = Math.min(PH.maxFall, e.vy + PH.gravity * dt);
      this.moveX(e, dt);
      if (e.hitWall) e.dir *= -1;
      this.moveY(e, dt);
      if (e.onGround) e.hopping = false;
      }
      if (e.onGround && !e.fly) {
        const fx = e.dir > 0 ? e.x + e.w + 1 : e.x - 1;
        if (!this.solidAt(Math.floor(fx / T), Math.floor((e.y + e.h + 1) / T))) e.dir *= -1;
      }
      if (e.y > this.rows * T + 32) e.dead = true;
      // 仕分けずに素通りさせたメール便(主人公の6マス後ろまで行った): 偽物は受信箱に届き、本物は受け取られない
      if (e.kind === 'mail' && !e.dead && e.x < p.x - 6 * T) {
        this.missMail(e);
        if (this.over) return;
        continue;
      }
      // 倒さずに画面の後ろへ置いてきた敵は、社内に入り込む
      if (e.kind !== 'mail' && e.kind !== 'staff' && e.gate !== 'tutorial' && !this.inTutorial() && e.x < this.camX - 3 * T) {
        this.intrude(e);
        continue;
      }

      if (!e.dead && e.kind === 'staff') continue; // 本物の社員には、ぶつかっても何もない(踏まない・撃たない)
      if (!e.dead && overlap(p, e)) {
        const stomp = p.vy > 0 && p.y + p.h - e.y <= 8;
        if (e.kind === 'mail') {
          if (stomp) {
            p.vy = -(held.jump ? PH.stompHeld : PH.stomp);
            p.jumping = held.jump;
          }
          this.sortMail(e, stomp);
          if (this.over) return;
          continue;
        }
        if (stomp) {
          p.vy = -(held.jump ? PH.stompHeld : PH.stomp);
          p.jumping = held.jump;
          // 踏みつけは強い: 鎧も一度で割れる
          this.hitEnemy(e, e.kind === 'pass' ? e.hp : 3, 'stomp');
        } else {
          const cause = { phish: 'phishMail', virus: 'malwareHit', spam: 'spamHit', bot: 'botHit', tail: 'tailgate' }[e.kind] || 'weakPass';
          this.hurt(cause, e.kind === 'spam' ? 4 : 10, e);
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
        this.refillWeapon(1);
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
        if (h.line?.release) {
          this.released[h.line.release] = true;
          if (h.line.release === 'chase' && this.chase) {
            this.chase.active = true;
            this.chase.x = p.x - 9 * T;
          }
        }
        if (h.line?.endChase && this.chase) this.chase.active = false;
        const learned = this.hooks.learned?.();
        if (h.line?.credential) {
          this.credentialEvent();
          continue;
        }
        if (h.line?.sortReport) {
          // 結果のお知らせ。遊び方を覚えた人には、止めずにひとことで
          const line = { who: 'guard', text: this.sortReportText() };
          if (learned) {
            this.hooks.say?.(line);
            continue;
          }
          p.vx = 0;
          this.hooks.lesson?.([line]);
          return;
        }
        // 遊び方の説明は、一度覚えたら出さない
        if (h.line?.help && learned) continue;
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

    // 曜日ごとのギミック
    if (this.gimmickUpdate(dt)) return;
    if (this.over) return;

    // 扉の前なら「入る」の案内
    const nd = this.nearestDoor();
    if (nd !== this.nearDoorShown) {
      this.nearDoorShown = nd;
      this.hooks.prompt?.(nd ? 'B(X キー)で入口に入る' : null);
    }

    // 手帳(C キー / 画面右上の 📒)
    if (take('note')) {
      this.hooks.notebook?.();
      return;
    }
    // B ボタン(X キー): 扉の前なら入る、それ以外は撃つ。押し続けるとためて、離すと大きい弾
    this.shotCool = Math.max(0, this.shotCool - dt);
    p.shootPose = Math.max(0, p.shootPose - dt);
    if (take('prev')) this.switchWeapon(-1);
    if (take('next')) this.switchWeapon(1);
    if (take('act')) {
      if (this.gimmickAct()) return;
      if (!this.fireSpecial()) this.fire(false);
    }
    if (held.act && this.weapon().id === 'buster') p.charge += dt;
    else {
      if (p.charge >= 0.75) this.fire(true);
      p.charge = 0;
    }
    this.updateShots(dt);
    if (this.over) return;
    this.weaponUpdate(dt);
    if (this.over) return;
    this.combo.t = Math.max(0, this.combo.t - dt);

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
      // 取り逃がした敵が、社内で見つかる
      // 迷惑メールは軽め(1)、ほかの攻撃は重め(3)
      const n = this.intruded.reduce((a, k) => a + (k === 'spam' ? 1 : 3), 0);
      if (n) {
        this.hooks.banner?.(`夕方の点検: 取り逃がした攻撃が ${this.intruded.length} 件、社内で見つかった`, 'bad');
        this.addLeak(Math.min(20, n), 'intruded');
        if (this.over) return;
      }
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
        if (ch === 'X' || ch === '#' || ch === 'Y') {
          const bb = this.bumps.find((q) => q.cx === x && q.cy === y);
          this.drawWallTile(g, ch, X(x * T), Y(y * T) + (bb ? -6 : 0), t);
          continue;
        }
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
      if (e.kind === 'spam') g.drawImage(fr, X(e.x - 4), Y(e.y - 9));
      else if (e.kind === 'staff' || e.kind === 'tail') g.drawImage(fr, X(e.x - 3), Y(e.y - 2));
      else g.drawImage(fr, X(e.x - 2), Y(e.y - 6));
      if (e.kind === 'bot' && e.state === 'aim') {
        g.fillStyle = '#ff3b5c';
        g.font = '16px "DotGothic16", monospace';
        g.textAlign = 'center';
        g.fillText('!', X(e.x + 6), Y(e.y - 8));
      }
      // フィッシングの盾(正面に光る線)。釣り針を投げる瞬間は下がる
      if (e.kind === 'phish' && e.gate !== 'tutorial' && !(e.throwT < 0.45 && e.throwT > 0)) {
        g.fillStyle = 'rgba(191,240,255,0.75)';
        g.fillRect(X(e.dir > 0 ? e.x + e.w + 1 : e.x - 3), Y(e.y - 2), 4, 22);
      }
      // 釣り針を投げる前の合図
      if (e.kind === 'phish' && e.throwT < 0.45 && e.throwT > 0) {
        g.fillStyle = '#ffd23f';
        g.font = '16px "DotGothic16", monospace';
        g.textAlign = 'center';
        g.fillText('!', X(e.x + 6), Y(e.y - 8));
      }
      if (e.kind === 'mail') this.drawTag(g, e, X(e.x + 6), Y(e.y - 8), t);
    }

    // ---- 曜日ごとのギミック ----
    this.gimmickRender(g, X, Y, t);

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
    // ためているあいだは光る(ためきると色が変わる)
    if (p.charge > 0.2) {
      const full = p.charge >= 0.75;
      g.fillStyle = full ? (Math.floor(t * 16) % 2 ? 'rgba(255,210,63,0.5)' : 'rgba(127,227,255,0.5)') : 'rgba(127,227,255,0.25)';
      g.beginPath();
      g.arc(X(p.x + 5), Y(p.y + 7), full ? 20 : 14 + p.charge * 6, 0, Math.PI * 2);
      g.fill();
    }
    // 弾
    for (const sh of this.shots) {
      const x = X(sh.x);
      const y = Y(sh.y);
      if (sh.kind) {
        g.fillStyle = sh.kind === 'quarantine' ? '#5dff8a' : '#ff9fc6';
        g.fillRect(x, y, sh.w * RES, sh.h * RES);
        g.fillStyle = '#ffffff';
        g.fillRect(x + 3, y + 3, sh.w * RES - 6, sh.h * RES - 6);
        if (sh.kind === 'quarantine') {
          g.fillStyle = '#00813a';
          g.fillRect(x + 6, y + 3, 2, sh.h * RES - 6);
        }
      } else if (sh.big) {
        g.fillStyle = 'rgba(127,227,255,0.45)';
        g.fillRect(x - 4, y - 4, sh.w * RES + 8, sh.h * RES + 8);
        g.fillStyle = '#7fe3ff';
        g.fillRect(x, y, sh.w * RES, sh.h * RES);
        g.fillStyle = '#ffffff';
        g.fillRect(x + 6, y + 5, sh.w * RES - 12, sh.h * RES - 10);
      } else {
        g.fillStyle = '#ffd23f';
        g.fillRect(x, y, sh.w * RES, sh.h * RES);
        g.fillStyle = '#fff4b0';
        g.fillRect(x + 3, y + 2, sh.w * RES - 6, sh.h * RES - 4);
      }
    }
    this.weaponRender(g, X, Y, t);
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

  // メール便の頭の上の札(差出人のドメイン)。近づくほどはっきり見える
  drawTag(g, e, cx, bottom) {
    const d = Math.abs(e.x - this.p.x);
    const a = Math.max(0, Math.min(1, (11 * T - d) / (4 * T)));
    if (a <= 0) return;
    if (cx < 0 || cx > this.vw * RES) return; // 画面に映っているメール便だけ
    const text = `@${e.domain}`;
    const sub = e.account ? `口座 ${e.account}` : null;
    g.save();
    g.globalAlpha = a;
    g.font = '600 13px ui-monospace, Menlo, Consolas, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    const w = Math.ceil(Math.max(g.measureText(text).width, sub ? g.measureText(sub).width : 0)) + 10;
    // 画面の端で切れないよう、札は画面の中に収める(指し示す線はメール便の真上のまま)
    const x0 = Math.max(4, Math.min(Math.round(this.vw * RES) - w - 4, Math.round(cx - w / 2)));
    const hgt = sub ? 34 : 18;
    const y0 = bottom - hgt - 2;
    g.fillStyle = '#070d26e6';
    g.fillRect(x0, y0, w, hgt);
    g.fillStyle = '#7fe3ff';
    g.fillRect(x0, y0 + hgt - 1, w, 1);
    g.fillRect(cx - 1, y0 + hgt, 2, 3);
    g.fillStyle = '#ffffff';
    g.fillText(text, x0 + w / 2, y0 + 13);
    if (sub) {
      g.fillStyle = '#ffd23f';
      g.fillText(sub, x0 + w / 2, y0 + 29);
    }
    g.restore();
  }

  // 1日のまとめ(振り返りで使う)
  summary(grades) {
    const goods = this.judgments.filter((j) => j.tier === 'best').length;
    // 100点から、漏洩リスクと業務の遅れの最大値を引く。最善の判断が多いほど少し足す
    const points = Math.max(0, Math.min(100, 100 - this.maxLeak - this.maxDelay * 0.7 + goods * 2 + this.eye.found * 2));
    let g = grades.find((x) => points >= x.min) || grades[grades.length - 1];
    if (g.grade === 'S' && goods < this.judgments.length) g = grades[1]; // S は全部最善のときだけ
    const badges = [];
    if (this.maxLeak === 0) badges.push('障害ゼロ件(誰にも褒められない)');
    if (this.judgments.length && goods === this.judgments.length) badges.push('判断ミスゼロ');
    if (Object.keys(this.clues).length && this.clueItems.every((c) => c.taken)) badges.push('備えあれば憂いなし');
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
      sort: this.sort.fakes + this.sort.reals ? this.sort : null,
      eye: this.eye.total ? this.eye : null,
      badges,
      cards: this.day.cards || ['bec', 'phishing', 'verify'],
      push: this.day.push ? this.pushStats : null,
      doors: this.doorStats || null,
      files: this.day.files ? { safe: this.filesSafe, opened: this.files.filter((f) => f.opened).length, total: this.files.length, malware: this.files.filter((f) => f.opened && !f.safe).length } : null,
      bossDefeated: this.boss ? !!this.boss.dead : null,
      block: { kills: this.kills, intruded: this.intruded.length },
    };
  }
}

// 火曜〜日曜のギミック(gimmicks.js)を足す
Object.assign(Game.prototype, gimmickMethods, weaponMethods);
