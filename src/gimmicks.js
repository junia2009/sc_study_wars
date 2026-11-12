// 火曜〜日曜の新しいギミック。Game に機能を足す(game.js から呼ぶ)。
//
// 地図の文字と、曜日の設定(day.xxx)で動く。
//   X 認証ゲートの壁(条件を満たすと消える)   # 通れない壁(扉の迷路の仕切り)
//   k パスワードの鍵   h スマホ        → day.barrier = 'mfa'   : 2つそろうと壁が消える(火曜)
//   Y 添付ファイルの箱(下から叩いて開ける)   → day.files       : 安全なファイルを決まった数開けると壁が消える(水曜)
//   W ログイン端末(触れると自分のログイン)   → day.push        : 承認通知の嵐。自分のログインだけ承認すると壁が消える(木曜)
//   R 黒幕アングラー(ボス)                   → day.angler       : 倒すと壁が消える(金曜・日曜)
//   S バックアップ地点                       → day.chase       : 後ろから暗号化の壁が迫る(土曜)
//   D URL の扉                               → day.doors       : 本物の扉だけが先へ通じる(日曜)
import { TILE as T, RES } from './sprites.js';
import { sfx } from './audio.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const gimmickMethods = {
  // ---- 地図の読み込み ----
  gimmickReset() {
    this.factors = {}; // 手に入れた認証の要素(key / phone)
    this.factorItems = [];
    this.files = []; // 添付ファイルの箱
    this.filesSafe = 0;
    this.logins = []; // ログイン端末
    this.pushes = []; // 届いた承認通知
    this.pushTimer = 0;
    this.pushStats = { approved: 0, denied: 0, approvedFake: 0, deniedReal: 0 };
    this.backups = [];
    this.backupX = null;
    this.chase = null;
    this.doors = [];
    this.boss = null;
    this.hooksShot = [];
    this.barrierOpen = false;
    this.fileIndex = 0;
    this.doorIndex = 0;
  },

  // 1文字ぶん読む。使ったら true(地図のその文字は消す)。X と # は地図に残す(壁として)
  gimmickTile(ch, px, py, cx, cy) {
    const d = this.day;
    switch (ch) {
      case 'k':
      case 'h':
        this.factorItems.push({ kind: ch === 'k' ? 'key' : 'phone', x: px, y: py, w: T, h: T });
        return true;
      case 'Y': {
        const f = d.files?.list?.[this.fileIndex++] || { name: 'ファイル.pdf', safe: true };
        this.files.push({ cx, cy, x: px, y: py, ...f, opened: false });
        this.grid[cy][cx] = 'Y';
        return false;
      }
      case 'W':
        this.logins.push({ x: px, y: py, w: T, h: T, used: 0 });
        return true;
      case 'S':
        this.backups.push({ x: px, y: py, w: T, h: T, lit: false });
        return true;
      case 'D': {
        const dd = d.doors?.list?.[this.doorIndex++] || { url: 'https://example/', real: true };
        this.doors.push({ x: px, y: py - T, w: T, h: T * 2, ...dd, marked: false });
        return true;
      }
      case 'R':
        this.boss = { x: px, y: py - 40, w: 24, h: 28, hp: (d.angler?.hp || 3) * 4, max: (d.angler?.hp || 3) * 4, state: 'wait', t: 0, inv: 0, dir: -1, homeY: py - 72, awake: false, dead: false };
        return true;
      default:
        return false;
    }
  },

  gimmickAfterParse() {
    if (this.day.chase) {
      this.chase = { x: -40, active: false, speed: this.day.chase.speed || 50 };
    }
  },

  // ---- 認証ゲートの壁 ----
  openBarrier(why) {
    if (this.barrierOpen) return;
    this.barrierOpen = true;
    for (let y = 0; y < this.rows; y++)
      for (let x = 0; x < this.cols; x++)
        if (this.grid[y][x] === 'X') {
          this.grid[y][x] = '.';
          this.burst(x * T + 8, y * T + 8, 4, '#ff9fb2');
        }
    sfx.item();
    this.hooks.banner?.(why, 'good');
  },

  // ---- 毎コマ。止める場面(会話など)を出したら true ----
  gimmickUpdate(dt) {
    const p = this.p;
    const d = this.day;

    // 認証の要素(火曜)
    for (const it of this.factorItems) {
      if (!it.taken && overlap(p, it)) {
        it.taken = true;
        this.factors[it.kind] = true;
        sfx.coin();
        this.burst(it.x + 8, it.y + 8, 10, '#ffd23f');
        const both = this.factors.key && this.factors.phone;
        this.floats.push({ x: it.x + 8, y: it.y - 4, text: it.kind === 'key' ? '要素1: パスワード' : '要素2: スマホ', life: 1.4, coin: true });
        if (d.barrier === 'mfa' && both) this.openBarrier('パスワード + スマホ。2つの要素がそろって、認証ゲートが開いた!');
        else if (d.barrier === 'mfa') this.hooks.banner?.('要素は、あと1つ。パスワードだけでは、ゲートは開かない', 'info');
      }
    }

    // 承認通知の嵐(木曜): ニセの通知がときどき届く
    if (d.push && this.released.push) {
      this.pushTimer -= dt;
      if (this.pushTimer <= 0 && !this.pushes.some((x) => !x.done)) {
        this.pushTimer = d.push.every || 7;
        this.sendPush(false);
      }
      for (const lg of this.logins) {
        lg.used = Math.max(0, lg.used - dt);
        if (!lg.used && overlap(p, lg) && !this.barrierOpen) {
          lg.used = 6;
          this.hooks.banner?.('経費システムにログインした。スマホに承認の通知が来るはず……', 'info');
          this.pendingReal = 0.8;
        }
      }
      if (this.pendingReal !== undefined && this.pendingReal > 0) {
        this.pendingReal -= dt;
        if (this.pendingReal <= 0) {
          this.pendingReal = undefined;
          this.sendPush(true);
        }
      }
      for (const ps of this.pushes) {
        if (ps.done) continue;
        ps.life -= dt;
        if (ps.life <= 0) this.answerPush(ps, null);
      }
    }

    // 暗号化の壁(土曜)
    if (this.chase?.active) {
      const c = this.chase;
      c.x += c.speed * dt;
      for (const e of this.enemies) if (!e.dead && e.x < c.x) e.dead = true;
      if (p.x < c.x + 2) {
        // 追いつかれた
        if (this.backupX !== null && this.backupX > c.x) {
          sfx.hurt();
          this.hooks.banner?.('暗号化された! ……バックアップから復旧(被害は小さく済んだ)', 'info');
          this.addLeak(6, 'ransomBackup');
          Object.assign(p, { x: this.backupX, y: this.backupY, vx: 0, vy: 0, inv: 1.2 });
          c.x = Math.min(c.x, this.backupX - 7 * T);
        } else {
          sfx.hurt();
          this.hooks.banner?.('暗号化された! バックアップがなく、データを失った……', 'bad');
          this.addLeak(20, 'ransomNoBackup');
          p.x = c.x + 5 * T;
          p.vx = 0;
          p.inv = 1.2;
        }
        if (this.over) return true;
      }
    }
    for (const b of this.backups) {
      if (!b.lit && overlap(p, b)) {
        b.lit = true;
        this.backupX = b.x;
        this.backupY = b.y + 2;
        sfx.item();
        this.floats.push({ x: b.x + 8, y: b.y - 6, text: 'バックアップ完了', life: 1.2, coin: true });
      }
    }

    // ボス(金曜・日曜)
    if (this.boss && !this.boss.dead) {
      if (this.bossUpdate(dt)) return true;
    }
    for (const h of this.hooksShot) {
      h.x += (h.vx || 0) * dt;
      if (h.flat) {
        // 床を這う釣り糸(跳んでよける)
        if (h.x < this.camX - 40 || h.x > this.camX + this.vw + 40) h.dead = true;
      } else {
        h.y += h.vy * dt;
        h.vy = Math.min(240, h.vy + (h.vx ? 420 : 200) * dt);
      }
      if (!h.dead && overlap(p, h)) {
        h.dead = true;
        this.hurt(h.cause || 'bossHook', h.dmg || 4, h);
        if (this.over) return true;
      }
      if (!h.flat && (h.y > this.rows * T || (h.vy > 0 && this.solidAt(Math.floor((h.x + 4) / T), Math.floor((h.y + h.h) / T))))) h.dead = true;
    }
    // 釣り針は弾で打ち落とせる
    for (const s of this.shots) for (const h of this.hooksShot) if (!h.dead && overlap(s, h)) { h.dead = true; if (!s.big) s.life = 0; this.burst(h.x + 4, h.y + 4, 4, '#e6ecf5'); }
    this.hooksShot = this.hooksShot.filter((h) => !h.dead);
    return false;
  },

  // 扉(日曜): B で入る。手帳より先に見る
  gimmickAct() {
    const p = this.p;
    const near = this.doors.find((dr) => !dr.marked && Math.abs(p.x + p.w / 2 - (dr.x + 8)) < 12 && Math.abs(p.y + p.h - (dr.y + dr.h)) < 6);
    if (!near) return false;
    this.doorTried = true;
    this.hooks.door?.(near);
    return true;
  },

  // 近くの扉(プロンプト表示用)
  nearestDoor() {
    const p = this.p;
    return this.doors.find((dr) => !dr.marked && Math.abs(p.x + p.w / 2 - (dr.x + 8)) < 12 && Math.abs(p.y + p.h - (dr.y + dr.h)) < 6) || null;
  },

  enterDoor(dr, enter) {
    if (!enter) return;
    if (dr.real) {
      sfx.good();
      this.doorStats = this.doorStats || { right: 0, wrong: 0 };
      this.doorStats.right++;
      this.burst(dr.x + 8, dr.y + 16, 14, '#7fe3ff');
      this.p.x = dr.to * T;
      this.p.vx = 0;
      this.camX = clamp(this.p.x - this.vw / 3, 0, this.cols * T - this.vw);
      this.hooks.banner?.('本物の入口だった。先へ進める!', 'good');
    } else {
      sfx.bad();
      this.doorStats = this.doorStats || { right: 0, wrong: 0 };
      this.doorStats.wrong++;
      dr.marked = true;
      this.p.x = dr.x - 28;
      this.p.vx = 0;
      this.hooks.banner?.('偽サイトだった! 入力した情報が盗まれた……', 'bad');
      this.addLeak(10, 'phishDoor');
    }
  },

  // ---- 承認通知 ----
  sendPush(real) {
    const d = this.day.push;
    const ps = { id: Math.random(), real, life: d.life || 6, done: false, ...(real ? d.real : d.fakes[Math.floor(Math.random() * d.fakes.length)]) };
    this.pushes.push(ps);
    sfx.tick();
    this.hooks.push?.(ps);
  },

  // approve: true 承認 / false 拒否 / null 放っておいた
  answerPush(ps, approve) {
    if (ps.done) return;
    ps.done = true;
    this.hooks.pushDone?.(ps);
    if (approve === true && ps.real) {
      this.pushStats.approved++;
      sfx.good();
      if (this.day.barrier === 'push') this.openBarrier('自分のログインを承認した。認証ゲートが開いた!');
    } else if (approve === true && !ps.real) {
      this.pushStats.approvedFake++;
      sfx.bad();
      this.hooks.banner?.('自分のログインではない通知を承認してしまった! 不正ログインされた……', 'bad');
      this.addLeak(15, 'pushFake');
    } else if (approve === false && !ps.real) {
      this.pushStats.denied++;
      sfx.coin();
      this.floats.push({ x: this.p.x + 5, y: this.p.y - 20, text: '拒否した!', life: 1, coin: true });
    } else if (approve === false && ps.real) {
      this.pushStats.deniedReal++;
      sfx.bad();
      this.hooks.banner?.('自分のログインを拒否した。ログインできず、仕事が遅れる……(もう一度ログインできる)', 'info');
      this.addDelay(5, 'pushDenyReal');
      for (const lg of this.logins) lg.used = 0;
    } else if (approve === null && ps.real) {
      this.hooks.banner?.('承認しないまま、通知が消えた。もう一度ログインしよう', 'info');
      for (const lg of this.logins) lg.used = 0;
    }
  },

  // ---- 添付ファイルの箱を下から叩いた ----
  openFile(cx, cy) {
    const f = this.files.find((x) => x.cx === cx && x.cy === cy);
    if (!f || f.opened) return;
    f.opened = true;
    this.grid[cy][cx] = 'U';
    if (f.safe) {
      this.filesSafe++;
      sfx.coin();
      this.workDone(cx * T + 8, cy * T - 4);
      this.workDone();
      this.floats.push({ x: cx * T + 8, y: cy * T - 16, text: '安全なファイル', life: 1.2, coin: true });
      const need = this.day.files?.need || 3;
      if (this.day.barrier === 'files' && this.filesSafe >= need) this.openBarrier(`必要なファイルを ${need} つ開けた。仕事が進んで、ゲートが開いた!`);
    } else {
      sfx.hurt();
      this.floats.push({ x: cx * T + 8, y: cy * T - 16, text: 'マルウェアだった!', life: 1.4 });
      this.addLeak(8, 'openMalware');
      for (let i = 0; i < 2; i++) {
        const e = this.enemy('soft', cx * T + i * 10, cy * T - 20);
        e.awake = true;
        e.speed = 40;
        e.dir = i ? 1 : -1;
        this.enemies.push(e);
      }
    }
    this.hooks.hud?.(this);
  },

  // ---- ボス ----
  bossUpdate(dt) {
    const b = this.boss;
    const p = this.p;
    const cfg = this.day.angler || {};
    if (!b.awake) {
      if (b.x < this.camX + this.vw - 8) {
        b.awake = true;
        this.hooks.music?.('boss');
        b.state = 'hover';
        b.t = 0;
        if (cfg.talk) {
          p.vx = 0;
          this.hooks.lesson?.(cfg.talk);
          return true;
        }
      }
      return false;
    }
    b.t += dt;
    b.inv = Math.max(0, b.inv - dt);
    // 後半戦(日曜): 体力が半分を切ると、本気を出す
    if (cfg.phase2 && !b.phase2 && b.hp <= b.max / 2) {
      b.phase2 = true;
      b.state = 'hover';
      b.t = 0;
      for (const dx of [-5, 5]) {
        const e = this.enemy('bot', b.x + dx * T, (this.rows - 3) * T + 6);
        e.awake = true;
        e.homeX = b.x;
        this.enemies.push(e);
      }
      if (cfg.phase2.talk) {
        p.vx = 0;
        this.hooks.lesson?.(cfg.phase2.talk);
        return true;
      }
    }
    const rage = b.phase2 ? 1.35 : 1;
    const speed = (cfg.speed || 50) * rage;
    if (b.state === 'hover') {
      const tx = p.x - 6;
      b.x += clamp(tx - b.x, -speed * dt, speed * dt);
      b.y += (b.homeY - b.y) * Math.min(1, dt * 3);
      b.dir = tx < b.x ? -1 : 1;
      b.drop = (b.drop || 0) - dt;
      if (b.drop <= 0) {
        b.drop = (cfg.drop || 2.2) / rage;
        this.hooksShot.push({ x: b.x + 8, y: b.y + 20, w: 8, h: 10, vy: 30 });
      }
      if (b.t > (cfg.swoop || 4.5) / rage) {
        // 降りる前に、その場で震えて知らせる(真下にいたら、よけられるように)
        b.state = 'warn';
        b.t = 0;
      }
    } else if (b.state === 'warn') {
      b.shake = Math.sin(b.t * 60) * 2;
      if (b.t > 0.9) {
        b.state = 'down';
        b.t = 0;
        b.shake = 0;
        if (b.phase2) b.wave = 0.35; // 着地の衝撃で、床を這う釣り糸を左右へ
      }
    } else if (b.state === 'down') {
      const groundY = (this.rows - 2) * T - b.h;
      b.y += (groundY - b.y) * Math.min(1, dt * 6);
      if (b.wave !== undefined) {
        b.wave -= dt;
        if (b.wave <= 0) {
          delete b.wave;
          for (const d of [-1, 1]) this.hooksShot.push({ x: b.x + 8 + d * 14, y: (this.rows - 2) * T - 9, w: 10, h: 8, vx: d * 130, vy: 0, flat: true, cause: 'bossHook', dmg: 5 });
          sfx.bump();
        }
      }
      if (b.t > 2.8) {
        b.state = 'hover';
        b.t = 0;
      }
    }
    // 当たり
    if (overlap(p, b)) {
      const stomp = p.vy > 0 && p.y + p.h - b.y <= 10 && b.state === 'down';
      if (stomp && b.inv <= 0) {
        p.vy = -320;
        b.state = 'hover';
        b.t = 0;
        if (this.damageBoss(4, 1)) return true;
      } else if (!stomp && p.inv <= 0 && !(b.state === 'down' && b.t > 0.35)) {
        // 降りきって目を回しているあいだは、横から触れても痛くない(踏むチャンス)
        this.hurt('bossHook', 6, b);
        if (this.over) return true;
      }
    }
    return false;
  },

  // ボスに当てた。会話を出したら true
  damageBoss(n, inv) {
    const b = this.boss;
    const cfg = this.day.angler || {};
    b.hp = Math.max(0, b.hp - n);
    b.inv = inv;
    sfx.armor();
    this.burst(b.x + 12, b.y + 6, n > 1 ? 14 : 5, '#b18cff');
    if (n > 1) this.floats.push({ x: b.x + 12, y: b.y - 6, text: n >= 4 ? '大ダメージ!' : 'ヒット!', life: 0.8 });
    if (b.hp > 0) return false;
    b.dead = true;
    this.hooksShot = [];
    this.kills++;
    this.hooks.music?.(this.day.id);
    sfx.clear();
    if (this.day.barrier === 'boss') this.openBarrier('アングラーを追い払った! 出口への道が開いた');
    if (cfg.defeat) {
      this.p.vx = 0;
      this.hooks.lesson?.(cfg.defeat);
      return true;
    }
    return false;
  },

  // 弾がボスに当たったか(当たったら true)。浮いているあいだは届きにくいので、降りてきたところを狙う
  bossShot(s) {
    const b = this.boss;
    if (!b || !b.awake || b.dead || !overlap(s, b)) return false;
    if (b.inv > 0) return true;
    this.damageBoss(s.big ? 3 : s.kind === 'quarantine' ? 2 : 1, s.big ? 0.3 : 0.08);
    return true;
  },

  // ---- 描画(敵より前) ----
  gimmickRender(g, X, Y, t) {
    const S = this.S;
    // 認証の要素
    for (const it of this.factorItems) {
      if (it.taken) continue;
      const y = Y(it.y) + Math.round(Math.sin(t * 3 + it.x) * 3);
      g.fillStyle = 'rgba(255,210,63,0.16)';
      g.beginPath();
      g.arc(X(it.x) + 16, y + 16, 18, 0, Math.PI * 2);
      g.fill();
      g.drawImage(it.kind === 'key' ? S.keyItem : S.phoneItem, X(it.x), y);
    }
    // 添付ファイルの名札
    for (const f of this.files) {
      if (f.opened) continue;
      this.drawLabel(g, f.name, X(f.x + 8), Y(f.y) - 2, Math.abs(f.x - this.p.x));
    }
    // ログイン端末
    for (const lg of this.logins) g.drawImage(lg.used ? S.loginOff : S.loginPanel, X(lg.x), Y(lg.y));
    // バックアップ地点
    for (const b of this.backups) g.drawImage(b.lit ? S.backupLit : S.backup, X(b.x), Y(b.y));
    // 扉(日曜)と看板の URL
    const cx = this.p.x + this.p.w / 2;
    let nearDoor = null;
    for (const dr of this.doors) if (!dr.marked && Math.abs(dr.x + 8 - cx) < 3 * T && (!nearDoor || Math.abs(dr.x + 8 - cx) < Math.abs(nearDoor.x + 8 - cx))) nearDoor = dr;
    for (const dr of this.doors) {
      const x = X(dr.x);
      const y = Y(dr.y);
      g.drawImage(S.door, x, y);
      if (dr.marked) {
        g.strokeStyle = '#ff3b5c';
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(x + 4, y + 20);
        g.lineTo(x + 28, y + 60);
        g.moveTo(x + 28, y + 20);
        g.lineTo(x + 4, y + 60);
        g.stroke();
      } else if (dr === nearDoor) {
        // 看板は、いちばん近い扉の分だけ(並んだ扉の URL が重ならないように)
        this.drawLabel(g, dr.url.replace(/^https:\/\//, ''), X(dr.x + 8), Y(dr.y) - 2, 0);
      } else {
        g.fillStyle = '#ffd23f';
        g.font = '14px "DotGothic16", monospace';
        g.textAlign = 'center';
        g.fillText('URL?', X(dr.x + 8), Y(dr.y) - 8);
      }
    }
    // ボス
    const b = this.boss;
    if (b && b.awake && !b.dead && !(b.inv > 0 && Math.floor(t * 20) % 2)) {
      const fr = S.anglerBody[Math.floor(t * 3) % 2][b.dir > 0 ? 'r' : 'l'];
      g.drawImage(fr, X(b.x - 4 + (b.shake || 0)), Y(b.y - 4), 64, 64);
      if (b.state === 'warn') {
        // 降りてくる場所の影
        g.fillStyle = 'rgba(255,59,92,0.35)';
        g.fillRect(X(b.x), Y((this.rows - 2) * T) - 4, 48, 4);
        g.fillStyle = '#ff3b5c';
        g.font = '14px "DotGothic16", monospace';
        g.textAlign = 'center';
        g.fillText('来るぞ! よけろ', clamp(X(b.x + 12), 60, this.vw * RES - 60), Y(b.y) - 22);
      }
      // 体力
      g.fillStyle = '#3a2140';
      g.fillRect(X(b.x) - 4, Y(b.y) - 16, 56, 6);
      g.fillStyle = '#ff3b5c';
      g.fillRect(X(b.x) - 4, Y(b.y) - 16, Math.round((56 * b.hp) / b.max), 6);
      if (b.state === 'down') {
        g.fillStyle = '#ffd23f';
        g.font = '14px "DotGothic16", monospace';
        g.textAlign = 'center';
        g.fillText('いまだ! 踏め', clamp(X(b.x + 12), 60, this.vw * RES - 60), Y(b.y) - 22);
      }
    }
    for (const h of this.hooksShot) {
      if (h.flat) {
        g.fillStyle = '#b18cff';
        g.fillRect(X(h.x), Y(h.y + 3), h.w * RES, 4);
        g.fillStyle = '#e6ecf5';
        g.fillRect(X(h.vx > 0 ? h.x + h.w - 3 : h.x), Y(h.y), 6, 16);
      } else g.drawImage(S.hookShot, X(h.x - 4), Y(h.y - 4));
    }
    // 暗号化の壁(土曜)
    if (this.chase?.active) {
      const edge = X(this.chase.x);
      if (edge > 0) {
        const H = Math.round(this.vh * RES);
        g.fillStyle = 'rgba(80,6,24,0.82)';
        g.fillRect(0, 0, edge, H);
        g.fillStyle = 'rgba(255,59,92,0.35)';
        for (let y = (Math.floor(t * 60) % 24) - 24; y < H; y += 24) g.fillRect(0, y, edge, 2);
        g.fillStyle = '#ff3b5c';
        for (let y = 0; y < H; y += 8) g.fillRect(edge - 4 + ((y * 7 + Math.floor(t * 30)) % 6), y, 4, 6);
        g.font = '600 14px ui-monospace, Menlo, monospace';
        g.textAlign = 'center';
        g.fillStyle = '#ffd0dc';
        if (edge > 80) g.fillText('🔒 ENCRYPTED', edge / 2, H / 2);
      }
    }
  },

  // 認証ゲートの壁・通れない壁の描画
  drawWallTile(g, ch, x, y, t) {
    if (ch === 'X') g.drawImage(this.S.barrier[Math.floor(t * 4) % 2], x, y);
    else if (ch === '#') {
      g.fillStyle = '#1a2148';
      g.fillRect(x, y, 32, 32);
      g.fillStyle = '#252f63';
      g.fillRect(x + 2, y + 2, 28, 2);
      g.fillRect(x + 2, y + 14, 28, 2);
      g.fillStyle = '#3dff8a';
      g.fillRect(x + 24, y + 6, 3, 3);
    } else if (ch === 'Y') g.drawImage(this.S.fileBox, x, y);
  },

  // 頭の上の名札(ファイル名・URL)
  drawLabel(g, text, cx, bottom, dist, near = 10) {
    const a = Math.max(0, Math.min(1, (near * T - dist) / (4 * T)));
    if (a <= 0 || cx < 0 || cx > this.vw * RES) return;
    g.save();
    g.globalAlpha = a;
    g.font = '600 13px ui-monospace, Menlo, Consolas, monospace';
    g.textAlign = 'center';
    const w = Math.ceil(g.measureText(text).width) + 10;
    const x0 = Math.max(4, Math.min(Math.round(this.vw * RES) - w - 4, Math.round(cx - w / 2)));
    const y0 = bottom - 20;
    g.fillStyle = '#070d26e6';
    g.fillRect(x0, y0, w, 18);
    g.fillStyle = '#ffd23f';
    g.fillRect(x0, y0 + 17, w, 1);
    g.fillStyle = '#ffffff';
    g.fillText(text, x0 + w / 2, y0 + 13);
    g.restore();
  },
};
