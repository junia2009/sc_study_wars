// 文字を出す画面(HTML で描く): タイトル・HUD・判断シーン・扉・障害報告書・クリア・カード。
import { SCENES } from '../data/scenes.js';
import { CARDS, CAUSES, TIPS } from '../data/cards.js';
import { sfx } from './audio.js';

const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const overlay = $('#overlay');

function show(html, cls = '') {
  overlay.className = cls;
  overlay.innerHTML = html;
  overlay.hidden = false;
  overlay.scrollTop = 0;
  const first = overlay.querySelector('[data-autofocus]') || overlay.querySelector('button');
  first?.focus({ preventScroll: true });
}

export function hideOverlay() {
  overlay.hidden = true;
  overlay.innerHTML = '';
}

function on(sel, fn) {
  overlay.querySelectorAll(sel).forEach((el) => el.addEventListener('click', fn));
}

// 数字キー(1〜4)で選択肢を押せるように
let keyHandler = null;
function setKeys(fn) {
  if (keyHandler) removeEventListener('keydown', keyHandler);
  keyHandler = fn;
  if (fn) addEventListener('keydown', fn);
}

// ---------------- HUD ----------------
export function updateHud(game) {
  $('#hud-stage').textContent = game.stage.name;
  $('#hud-score').textContent = String(game.score).padStart(5, '0');
  const bar = $('#hud-leak');
  bar.style.setProperty('--v', game.leak / 100);
  bar.classList.toggle('warn', game.leak >= 60);
  $('#hud-leak-num').textContent = `${Math.round(game.leak)}%`;
  $('#hud-mfa').hidden = !game.flags.mfa;
}

let bannerTimer = 0;
export function banner(text, tone = 'info') {
  const el = $('#banner');
  el.textContent = text;
  el.className = `show ${tone}`;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => (el.className = ''), 3600);
}

export function prompt(text) {
  const el = $('#prompt');
  el.textContent = text || '';
  el.hidden = !text;
}

// ---------------- タイトル ----------------
export function showTitle({ title, subtitle, owned, heroURL, onStart, onCards, muted, onMute }) {
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
  setKeys(null);
  show(
    `<div class="panel title">
      <img class="hero" src="${heroURL}" alt="" width="128" height="128">
      <h1>${esc(title)}</h1>
      <p class="sub">〜 ${esc(subtitle)} 〜</p>
      <p class="lead">情報漏洩の手口を、遊びながら見抜けるようになる横スクロールアクション。</p>
      <div class="actions">
        <button class="primary" data-act="start" data-autofocus>はじめる</button>
        <button data-act="cards">解説カード(${owned}/${CARDS.length})</button>
        <button data-act="mute" class="ghost">${muted ? '音: オフ' : '音: オン'}</button>
      </div>
      <p class="tip"><span>Tips</span>${esc(tip)}</p>
      <p class="keys">PC: ← → 移動 / Z・スペース ジャンプ / X・↑ 調べる<br>スマホ: 縦でも横でも。十字キーは指を滑らせて向きを変えられる</p>
      <p class="fine">登場する会社・人物・ドメインはすべて架空です。</p>
    </div>`,
    'is-title',
  );
  on('[data-act=start]', onStart);
  on('[data-act=cards]', onCards);
  on('[data-act=mute]', onMute);
}

// ---------------- 判断シーン ----------------
function mockHTML(m) {
  if (m.kind === 'mail') {
    return `<div class="mock mail">
      <div class="mail-bar">受信トレイ</div>
      <div class="mail-row"><span>差出人</span><b>${esc(m.from)}</b></div>
      <div class="mail-row"><span>件名</span><b>${esc(m.subject)}</b></div>
      <div class="mail-body">${m.body.map((l) => `<p>${esc(l)}</p>`).join('')}</div>
    </div>`;
  }
  return `<div class="mock app">
    <div class="app-bar">${esc(m.app)}</div>
    <div class="app-body"><h3>${esc(m.title)}</h3>${m.body.map((l) => `<p>${esc(l)}</p>`).join('')}</div>
  </div>`;
}

export function showScene(id, done) {
  const sc = SCENES[id];
  let left = sc.time;
  let finished = false;
  show(
    `<div class="panel scene" role="dialog" aria-label="判断シーン">
      <div class="scene-top">
        <div class="scene-head"><span class="tag">判断シーン</span><span class="count">あと <b>${left}</b> 秒</span></div>
        <div class="timer"><i></i></div>
      </div>
      <div class="scene-body">
        <div class="scene-left">${mockHTML(sc.mock)}</div>
        <div class="scene-right">
          <button class="inspect" data-act="inspect">🔍 詳しく調べる</button>
          <ul class="detail" hidden>${sc.detail.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
          <div class="choices">${sc.choices
            .map((c, i) => `<button data-choice="${i}"><kbd>${i + 1}</kbd>${esc(c.label)}</button>`)
            .join('')}</div>
        </div>
      </div>
    </div>`,
    'is-dialog is-scene',
  );
  const bar = overlay.querySelector('.timer i');
  const count = overlay.querySelector('.count b');
  const start = performance.now();
  let lastSec = left;

  const tick = (now) => {
    if (finished) return;
    const rest = Math.max(0, sc.time - (now - start) / 1000);
    bar.style.transform = `scaleX(${rest / sc.time})`;
    const sec = Math.ceil(rest);
    if (sec !== lastSec) {
      lastSec = sec;
      count.textContent = sec;
      if (sec <= 3 && sec > 0) sfx.tick();
    }
    if (rest <= 0) return finish(sc.timeout);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  on('[data-act=inspect]', (e) => {
    overlay.querySelector('.detail').hidden = false;
    e.currentTarget.disabled = true;
    e.currentTarget.textContent = '🔍 調べた';
  });
  on('[data-choice]', (e) => finish(sc.choices[+e.currentTarget.dataset.choice]));
  setKeys((e) => {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= sc.choices.length) finish(sc.choices[n - 1]);
  });

  function finish(choice) {
    if (finished) return;
    finished = true;
    setKeys(null);
    const result = choice.result || 'timeout';
    if (result === 'good') sfx.good();
    else if (result === 'bad') sfx.bad();
    else sfx.open();
    const mark = { good: '◎', bad: '×', later: '…', timeout: '△' }[result];
    show(
      `<div class="panel outcome ${result}" role="dialog">
        <p class="mark">${mark}</p>
        <h2>${esc(choice.title)}</h2>
        <p>${esc(choice.text)}</p>
        ${choice.leak ? `<p class="leak">漏洩ゲージ +${choice.leak}%</p>` : ''}
        <button class="primary" data-act="ok" data-autofocus>つづける</button>
      </div>`,
      'is-dialog',
    );
    let used = false;
    on('[data-act=ok]', () => {
      if (used) return;
      used = true;
      done(choice);
    });
  }
}

// ---------------- 扉 ----------------
export function showDoor(door, done) {
  setKeys(null);
  show(
    `<div class="panel door" role="dialog" aria-label="扉の看板">
      <span class="tag">扉の看板</span>
      <h3>経費精算システム ログイン</h3>
      <div class="urlbar"><span class="lock" aria-label="鍵マーク">🔒</span><span class="url">${esc(door.url)}</span></div>
      <p class="hint">本物の扉の先は、ゴール(経費精算システム)です。</p>
      <div class="choices two">
        <button data-act="enter">入る</button>
        <button data-act="back" data-autofocus>やめる</button>
      </div>
    </div>`,
    'is-dialog',
  );
  let used = false;
  const once = (v) => () => {
    if (used) return;
    used = true;
    done(v);
  };
  on('[data-act=enter]', once(true));
  on('[data-act=back]', once(false));
}

// ---------------- 障害報告書(ゲームオーバー) ----------------
export function showReport(game, { onRetry, onTitle }) {
  setKeys(null);
  const d = new Date();
  const when = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const causes = game.causes.map((c) => CAUSES[c]).filter(Boolean);
  show(
    `<div class="panel report" role="dialog" aria-label="障害報告書">
      <div class="report-head"><h2>障害報告書</h2><span class="stamp">要提出</span></div>
      <table>
        <tr><th>件名</th><td>情報漏洩インシデント(${esc(game.stage.name.replace(/^STAGE \d+ /, ''))})</td></tr>
        <tr><th>発生日時</th><td>${when}</td></tr>
        <tr><th>報告者</th><td>ガード(守りのプログラム)</td></tr>
        <tr><th>影響範囲</th><td>社外秘データ(架空)が、漏洩ゲージ 100% ぶん流出</td></tr>
        <tr><th>原因</th><td><ol>${causes.map((c) => `<li>${esc(c.title)}</li>`).join('')}</ol></td></tr>
        <tr><th>再発防止策</th><td><ol>${causes.map((c) => `<li>${esc(c.fix)}</li>`).join('')}</ol></td></tr>
      </table>
      <p class="note">※ この報告書は自動生成です。上長の承認は不要です(ゲームなので)。</p>
      <div class="actions">
        <button class="primary" data-act="retry" data-autofocus>再発防止策を提出する(もう一度)</button>
        <button data-act="title">タイトルへ</button>
      </div>
    </div>`,
    'is-dialog is-report',
  );
  on('[data-act=retry]', onRetry);
  on('[data-act=title]', onTitle);
}

// ---------------- クリア ----------------
export function showClear(sum, { cardImg, onCards, onRetry, onTitle }) {
  setKeys(null);
  const mm = Math.floor(sum.time / 60);
  const ss = String(Math.floor(sum.time % 60)).padStart(2, '0');
  const cards = sum.cards.map((id) => CARDS.find((c) => c.id === id));
  show(
    `<div class="panel clear" role="dialog" aria-label="ステージクリア">
      <h2>STAGE CLEAR</h2>
      <p>本物の経費精算システムに、たどり着いた。</p>
      <dl class="stats">
        <div><dt>正しい判断</dt><dd>${sum.goods} / ${sum.total}</dd></div>
        <div><dt>漏洩ゲージ(最大)</dt><dd>${Math.round(sum.maxLeak)}%</dd></div>
        <div><dt>スコア</dt><dd>${sum.score}</dd></div>
        <div><dt>タイム</dt><dd>${mm}:${ss}</dd></div>
      </dl>
      ${sum.badges.length ? `<div class="badges">${sum.badges.map((b) => `<span>🏅 ${esc(b)}</span>`).join('')}</div>` : ''}
      <h3>手に入れた解説カード</h3>
      <ul class="mini-cards">${cards
        .map((c) => `<li><img src="${cardImg(c)}" alt="" width="32" height="32">${esc(c.name)}</li>`)
        .join('')}</ul>
      <div class="actions">
        <button class="primary" data-act="cards" data-autofocus>カードを読む</button>
        <button data-act="retry">もう一度</button>
        <button data-act="title">タイトルへ</button>
      </div>
    </div>`,
    'is-dialog',
  );
  on('[data-act=cards]', onCards);
  on('[data-act=retry]', onRetry);
  on('[data-act=title]', onTitle);
}

// ---------------- 解説カード ----------------
export function showCards(owned, { cardImg, onBack }) {
  setKeys(null);
  const list = CARDS.map((c, i) => {
    const has = owned.includes(c.id);
    if (!has) {
      return `<article class="card locked"><p class="no">No.${i + 1}</p><h3>？？？</h3><p>まだ手に入れていない</p></article>`;
    }
    const src = c.sources
      .map((s) => (s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>` : esc(s.name)))
      .join('、');
    const pending = c.sources.some((s) => !s.url);
    return `<article class="card">
      <header><img src="${cardImg(c)}" alt="" width="48" height="48"><div><p class="no">No.${i + 1}</p><h3>${esc(c.name)}</h3></div></header>
      <p>${esc(c.what)}</p>
      <h4>見抜くポイント</h4>
      <ul>${c.signs.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      <h4>自分でできる対策</h4>
      <p>${esc(c.action)}</p>
      <h4>やってしまったら</h4>
      <p>${esc(c.ifDone)}</p>
      <p class="src">出典: ${src}${pending ? '(リンクと確認日は準備中)' : ''}</p>
    </article>`;
  }).join('');
  show(
    `<div class="panel cards">
      <div class="cards-head"><h2>解説カード</h2><button data-act="back" data-autofocus>もどる</button></div>
      <p class="lead">朝礼や社内の注意喚起に、そのまま使える短さにしています。</p>
      <div class="card-list">${list}</div>
    </div>`,
    'is-dialog is-cards',
  );
  on('[data-act=back]', onBack);
}
