// 「お手本ガード」: 説明の場所で、半透明のガードが先にやって見せる。
// 終わったら一言だけ出して、プレイヤーが同じことをできたら「OK!」で先へ。
//
// 説明(day.hints)に demo を書く:
//   demo: {
//     script: [[秒, '押すキー'], ...]   r 右 / l 左 / j ジャンプ / a 撃つ / c ためる(その間押し続け、終わりで離す)
//     target: マス数                    お手本が撃つ「的」を、お手本の前方に置く(省略で置かない)
//     task:   'move' | 'jump' | 'shoot' | 'charge' | 'bump' | 'pass' | 'door'   プレイヤーにやってもらうこと
//     pass:   マスの x                  task が 'pass' / 'jump' のとき、ここを越えたらできたことにする
//     text:   一言('{jump}' などは操作の書き方に置き換わる)
//   }
import { TILE as T, RES } from './sprites.js';
import { sfx } from './audio.js';

const PH = { gravity: 900, jumpV: 300, jumpCut: 0.45, runMax: 105, accel: 900, friction: 1200, maxFall: 420 };

export const demoMethods = {
  demoReset() {
    this.demo = null; // 再生中のお手本
    this.task = null; // お手本のあとに、プレイヤーがやること
  },

  startDemo(line) {
    const d = line.demo;
    const p = this.p;
    p.vx = 0;
    const g = { x: p.x, y: p.y, w: p.w, h: p.h, vx: 0, vy: 0, onGround: true, face: 1, jumping: false, charge: 0, anim: 0 };
    this.demo = { line, g, step: 0, t: 0, shots: [], target: null, fade: 0, startBumps: this.bumps.length };
    if (d.target) this.demo.target = { x: p.x + d.target * T, y: p.y + 4, w: 12, h: 10, hit: false, t: 0 };
    sfx.open();
  },

  // お手本を1コマ進める。再生中なら true(プレイヤーの操作は止める)
  demoUpdate(dt) {
    const dm = this.demo;
    if (!dm) return false;
    const d = dm.line.demo;
    const g = dm.g;
    if (dm.fade > 0) {
      dm.fade -= dt;
      if (dm.fade <= 0) this.endDemo();
      return !!this.demo;
    }
    const cur = d.script[dm.step];
    if (!cur) {
      dm.fade = 0.35;
      return true;
    }
    const keys = cur[1];
    dm.t += dt;
    // 横の動き
    const dir = (keys.includes('r') ? 1 : 0) - (keys.includes('l') ? 1 : 0);
    if (dir) {
      g.face = dir;
      g.vx += dir * PH.accel * dt;
    } else if (g.onGround) {
      const f = PH.friction * dt;
      g.vx = Math.abs(g.vx) <= f ? 0 : g.vx - Math.sign(g.vx) * f;
    }
    g.vx = Math.max(-PH.runMax, Math.min(PH.runMax, g.vx));
    // ジャンプ(その段の最初に押す。押している長さで高さが変わる)
    if (keys.includes('j') && dm.t <= dt + 1e-6 && g.onGround) {
      g.vy = -PH.jumpV;
      g.jumping = true;
    }
    if (g.jumping && !keys.includes('j') && g.vy < 0) {
      g.vy *= PH.jumpCut;
      g.jumping = false;
    }
    if (g.vy >= 0) g.jumping = false;
    g.vy = Math.min(PH.maxFall, g.vy + PH.gravity * dt);
    this.moveX(g, dt);
    const up = g.vy < 0;
    this.moveY(g, dt, false);
    if (up && g.vy === 0 && !g.onGround) this.burst(g.x + 5, g.y, 6, '#bff0ff'); // 頭で叩いた
    g.anim += dt * (Math.abs(g.vx) / 60);
    // 撃つ
    if (keys.includes('a') && dm.t <= dt + 1e-6) this.demoShot(false);
    if (keys.includes('c')) g.charge += dt;
    // 段の終わり
    if (dm.t >= cur[0]) {
      if (keys.includes('c') && g.charge >= 0.75) this.demoShot(true);
      g.charge = 0;
      dm.step++;
      dm.t = 0;
    }
    // お手本の弾と的
    for (const s of dm.shots) {
      s.x += s.vx * dt;
      s.life -= dt;
      const tg = dm.target;
      if (tg && !tg.hit && s.x < tg.x + tg.w && s.x + s.w > tg.x && s.y < tg.y + tg.h && s.y + s.h > tg.y) {
        tg.hit = true;
        s.life = 0;
        this.burst(tg.x + 6, tg.y + 5, 10, '#bff0ff');
        sfx.stomp();
      }
    }
    dm.shots = dm.shots.filter((s) => s.life > 0);
    if (dm.target?.hit) dm.target.t += dt;
    return true;
  },

  demoShot(big) {
    const g = this.demo.g;
    this.demo.shots.push({ x: g.face > 0 ? g.x + g.w : g.x - 7, y: g.y + (big ? 2 : 5), w: big ? 14 : 7, h: big ? 10 : 5, vx: g.face * (big ? 230 : 260), big, life: 0.7 });
    sfx[big ? 'charge' : 'shot']();
  },

  endDemo() {
    const dm = this.demo;
    this.demo = null;
    const d = dm.line.demo;
    if (dm.line.release) this.released[dm.line.release] = true; // 待たせていた敵は、お手本のあとで動き出す
    if (!d.task) return;
    const p = this.p;
    this.task = { kind: d.task, x0: p.x, pass: d.pass, shots: this.shotCount || 0, big: this.bigCount || 0, bumps: this.bumps.length, t: 0 };
    this.hooks.prompt?.(d.text || null);
  },

  // プレイヤーが、お手本と同じことをできたか
  taskUpdate(dt) {
    const k = this.task;
    if (!k) return;
    const p = this.p;
    k.t += dt;
    let ok = false;
    if (k.kind === 'move') ok = p.x > k.x0 + 2 * T;
    else if (k.kind === 'jump' || k.kind === 'pass') ok = p.x > (k.pass ?? 0) * T;
    else if (k.kind === 'shoot') ok = (this.shotCount || 0) > k.shots;
    else if (k.kind === 'charge') ok = (this.bigCount || 0) > k.big;
    else if (k.kind === 'bump') ok = this.bumps.length > k.bumps || this.files?.some((f) => f.opened);
    else if (k.kind === 'door') ok = !!this.doorTried;
    // 先へ進みすぎたら、もう待たない
    if (ok || p.x > k.x0 + 14 * T) {
      this.task = null;
      this.hooks.prompt?.(null);
      if (ok) {
        sfx.coin();
        this.floats.push({ x: p.x + 5, y: p.y - 12, text: 'OK!', life: 0.9, coin: true });
      }
    }
  },

  demoRender(g, X, Y, t) {
    const dm = this.demo;
    if (!dm) return;
    const S = this.S;
    const a = dm.fade > 0 ? Math.max(0, dm.fade / 0.35) * 0.6 : 0.6;
    g.save();
    g.globalAlpha = a;
    const gh = dm.g;
    const side = gh.face > 0 ? 'r' : 'l';
    const fr = !gh.onGround ? (gh.vy < 0 ? S.guard.jump : S.guard.fall)[side] : Math.abs(gh.vx) > 8 ? S.guard.run[Math.floor(gh.anim * 2) % 4][side] : S.guard.stand[0][side];
    if (gh.charge > 0.2) {
      g.fillStyle = gh.charge >= 0.75 ? 'rgba(255,210,63,0.6)' : 'rgba(127,227,255,0.4)';
      g.beginPath();
      g.arc(X(gh.x + 5), Y(gh.y + 7), 18, 0, Math.PI * 2);
      g.fill();
    }
    g.drawImage(fr, X(gh.x - 3), Y(gh.y - 2));
    for (const s of dm.shots) {
      g.fillStyle = s.big ? '#7fe3ff' : '#ffd23f';
      g.fillRect(X(s.x), Y(s.y), s.w * RES, s.h * RES);
    }
    const tg = dm.target;
    if (tg && !(tg.hit && tg.t > 0.3)) {
      g.globalAlpha = a * (tg.hit ? 1 - tg.t / 0.3 : 1);
      g.drawImage(S.phish[0].l, X(tg.x - 2), Y(tg.y - 6));
    }
    g.restore();
    // 「お手本」の札
    g.font = '13px "DotGothic16", monospace';
    g.textAlign = 'center';
    g.fillStyle = '#7fe3ff';
    g.fillText('お手本', X(gh.x + 5), Y(gh.y - 6));
  },
};
