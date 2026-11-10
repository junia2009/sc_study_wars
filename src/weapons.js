// 特殊武器の動き。Game に機能を足す(game.js から呼ぶ)。
import { TILE as T, RES } from './sprites.js';
import { sfx } from './audio.js';
import { WEAPONS, MAX_ENERGY } from '../data/weapons.js';

const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const weaponMethods = {
  // owned: 持っている武器の id の並び(ショットはいつも持っている)
  weaponReset(owned = []) {
    this.weapons = WEAPONS.filter((w) => w.id === 'buster' || owned.includes(w.id));
    this.weaponIndex = 0;
    this.energy = Object.fromEntries(this.weapons.map((w) => [w.id, MAX_ENERGY]));
    this.orbs = null; // 多要素シールド
    this.jailed = []; // 隔離中の敵
  },

  weapon() {
    return this.weapons[this.weaponIndex] || this.weapons[0];
  },

  switchWeapon(d) {
    if (this.weapons.length < 2) return;
    this.weaponIndex = (this.weaponIndex + d + this.weapons.length) % this.weapons.length;
    sfx.tick();
    this.p.charge = 0;
    this.hooks.hud?.(this);
  },

  // 業務データを拾った: 選んでいる武器にエネルギーを足す
  refillWeapon(n) {
    const w = this.weapon();
    if (w.id === 'buster') return;
    this.energy[w.id] = Math.min(MAX_ENERGY, this.energy[w.id] + n);
  },

  // 特殊武器を撃つ。撃てたら true
  fireSpecial() {
    const w = this.weapon();
    if (w.id === 'buster') return false;
    if (this.energy[w.id] < w.cost) {
      sfx.bump();
      this.hooks.banner?.(`${w.name}のエネルギーが足りない(業務データで補充)`, 'info');
      return true;
    }
    const p = this.p;
    this.energy[w.id] -= w.cost;
    p.shootPose = 0.25;
    if (w.id === 'mfa') {
      this.orbs = { t: 5, a: 0 };
      sfx.item();
    } else if (w.id === 'quarantine') {
      this.shots.push({ x: p.face > 0 ? p.x + p.w : p.x - 8, y: p.y + 3, w: 8, h: 8, vx: p.face * 170, vy: 0, life: 1.1, kind: 'quarantine', hit: new Set() });
      sfx.shot();
    } else if (w.id === 'patch') {
      for (const a of [0.25, 0.65, 1.05]) {
        this.shots.push({ x: p.x + 2, y: p.y + 2, w: 6, h: 6, vx: p.face * Math.cos(a) * 220, vy: -Math.sin(a) * 220, life: 0.8, kind: 'patch', hit: new Set() });
      }
      sfx.shot();
    } else if (w.id === 'blocklist') {
      sfx.alarm();
      this.flashScreen = 0.35;
      for (const e of this.enemies) {
        if (e.dead || e.kind === 'mail' || e.kind === 'staff' || (e.gate && !this.released[e.gate])) continue;
        if (e.x + e.w < this.camX || e.x > this.camX + this.vw) continue;
        if (['spam', 'phish', 'bot'].includes(e.kind)) this.defeat(e);
      }
      for (const h of this.hooksShot) h.dead = true;
      if (this.boss && this.boss.awake && !this.boss.dead && this.boss.x < this.camX + this.vw) this.damageBoss(3, 0.5);
    }
    this.hooks.hud?.(this);
    return true;
  },

  // 隔離ショットが当たった
  jail(e) {
    if (e.kind === 'mail') return this.sortMail(e, true);
    if (e.kind === 'staff') return this.hitEnemy(e, 0, 'shot');
    e.jail = 0.6;
    e.vx = 0;
    sfx.armor();
    this.floats.push({ x: e.x + 6, y: e.y - 6, text: '隔離!', life: 0.7, coin: true });
  },

  // 毎コマ
  weaponUpdate(dt) {
    const p = this.p;
    this.flashScreen = Math.max(0, (this.flashScreen || 0) - dt);
    // 多要素シールド: 2つの玉が回る
    if (this.orbs) {
      this.orbs.t -= dt;
      this.orbs.a += dt * 7;
      if (this.orbs.t <= 0) this.orbs = null;
      else {
        for (const k of [0, Math.PI]) {
          const ox = p.x + p.w / 2 + Math.cos(this.orbs.a + k) * 20 - 4;
          const oy = p.y + p.h / 2 + Math.sin(this.orbs.a + k) * 20 - 4;
          const orb = { x: ox, y: oy, w: 8, h: 8 };
          for (const e of this.enemies) {
            if (e.dead || e.kind === 'mail' || e.kind === 'staff' || (e.gate && !this.released[e.gate]) || !overlap(orb, e)) continue;
            this.hitEnemy(e, 3, 'orb');
          }
          for (const h of this.hooksShot) if (!h.dead && overlap(orb, h)) h.dead = true;
          if (this.boss && this.boss.awake && !this.boss.dead && this.boss.inv <= 0 && overlap(orb, this.boss)) this.damageBoss(1, 0.4);
        }
      }
    }
    // 隔離した敵は、少しして消える(分裂も攻撃もしない)
    for (const e of this.enemies) {
      if (e.dead || e.jail === undefined) continue;
      e.jail -= dt;
      if (e.jail <= 0) {
        delete e.jail;
        this.defeat(e);
      }
    }
  },

  // 特殊武器の弾が敵に当たった(普通の弾と違う効き方)
  specialHit(s, e) {
    if (s.kind === 'quarantine') {
      this.jail(e);
      return true; // 1体で消える
    }
    // パッチ配布: 普通の弾と同じ威力。盾は上から越える(斜めの弾なので、盾ではじかれない)
    this.hitEnemy(e, 1, 'patch');
    return true;
  },

  weaponRender(g, X, Y, t) {
    const p = this.p;
    if (this.orbs) {
      for (const k of [0, Math.PI]) {
        const ox = p.x + p.w / 2 + Math.cos(this.orbs.a + k) * 20;
        const oy = p.y + p.h / 2 + Math.sin(this.orbs.a + k) * 20;
        g.fillStyle = 'rgba(92,200,255,0.35)';
        g.beginPath();
        g.arc(X(ox), Y(oy), 12, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#bff0ff';
        g.beginPath();
        g.arc(X(ox), Y(oy), 6, 0, Math.PI * 2);
        g.fill();
      }
    }
    // 隔離の檻
    for (const e of this.enemies) {
      if (e.dead || e.jail === undefined) continue;
      g.strokeStyle = '#5dff8a';
      g.lineWidth = 2;
      const x = X(e.x - 3);
      const y = Y(e.y - 6);
      g.strokeRect(x, y, (e.w + 6) * RES, (e.h + 8) * RES);
      g.fillStyle = '#5dff8a';
      for (let i = 1; i < 4; i++) g.fillRect(x + (i * (e.w + 6) * RES) / 4, y, 2, (e.h + 8) * RES);
    }
    if (this.flashScreen > 0) {
      g.fillStyle = `rgba(255,92,122,${this.flashScreen})`;
      g.fillRect(0, 0, this.vw * RES, this.vh * RES);
    }
  },

  weaponHud() {
    const w = this.weapon();
    return { id: w.id, name: w.name, short: w.short, color: w.color, energy: w.id === 'buster' ? null : this.energy[w.id] / MAX_ENERGY, count: this.weapons.length };
  },
};
