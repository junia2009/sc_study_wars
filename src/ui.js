// 文字を出す画面(HTML で描く):
//   タイトル・名前入力・HUD・会話・手帳・判断シーン・障害報告書/始末書・振り返り・解説カード・一時停止
import { SCENES, RULES, TIERS, FOLLOWUP } from '../data/scenes.js';
import { CARDS, CAUSES, TIPS } from '../data/cards.js';
import { PEOPLE, CLUES } from '../data/story.js';
import { sfx } from './audio.js';

const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const overlay = $('#overlay');

// main.js から受け取るもの: 顔・手がかりの画像、主人公の名前
let ctx = { face: () => '', clueImg: () => '', name: () => 'ミナト' };
export function initUI(c) {
  ctx = { ...ctx, ...c };
}
// {name} を主人公の名前に
const fill = (t) => String(t).replace(/\{name\}/g, ctx.name());
// {{ }} で囲んだ決め手: on なら光らせる、off なら印だけ外す
const marks = (t, on) =>
  esc(fill(t)).replace(/\{\{(.+?)\}\}/g, (_, w) => (on ? `<mark>${w}</mark>` : w));

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
  setKeys(null);
}

function on(sel, fn) {
  overlay.querySelectorAll(sel).forEach((el) => el.addEventListener('click', fn));
}

// 画面ごとのキー操作(数字キーで選択肢など)
let keyHandler = null;
function setKeys(fn) {
  if (keyHandler) removeEventListener('keydown', keyHandler);
  keyHandler = fn;
  if (fn) addEventListener('keydown', fn);
}

// 1回しか呼ばれない関数にする(ボタンの連打対策)
function once(fn) {
  let used = false;
  return (...a) => {
    if (used) return;
    used = true;
    fn(...a);
  };
}

const faceImg = (who, size = 64) => {
  const p = PEOPLE[who];
  return p?.face ? `<img class="face" src="${ctx.face(p.face)}" alt="" width="${size}" height="${size}">` : '';
};

// ---------------- HUD ----------------
export function updateHud(game) {
  $('#hud-clock').textContent = game.clock;
  for (const [id, v] of [['#hud-leak', game.leak], ['#hud-delay', game.delay]]) {
    const bar = $(id);
    bar.style.setProperty('--v', v / 100);
    bar.classList.toggle('warn', v >= 60);
  }
  $('#hud-clues').innerHTML = Object.keys(CLUES)
    .filter((k) => game.clues[k])
    .map((k) => `<img src="${ctx.clueImg(k)}" alt="${esc(CLUES[k].name)}" width="20" height="20">`)
    .join('');
}

let bannerTimer = 0;
export function banner(text, tone = 'info') {
  const el = $('#banner');
  el.textContent = fill(text);
  el.className = `show ${tone}`;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => (el.className = ''), 3600);
}

// ゲームを止めずに出す、ひとこと(顔つき)
export function say(line) {
  const el = $('#banner');
  el.innerHTML = `${faceImg(line.who, 28)}<span>${esc(fill(line.text))}</span>`;
  el.className = 'show info talkline';
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => (el.className = ''), 4200);
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
      <p class="lead">情シス見習いのあなたと相棒 AI ガードで、経理部を詐欺から1週間守り抜け。</p>
      <div class="actions">
        <button class="primary" data-act="start" data-autofocus>月曜からはじめる</button>
        <button data-act="cards">解説カード(${owned}/${CARDS.length})</button>
        <button data-act="mute" class="ghost">${muted ? '音: オフ' : '音: オン'}</button>
      </div>
      <p class="tip"><span>Tips</span>${esc(tip)}</p>
      <p class="keys">PC: ← → 移動 / Z・スペース ジャンプ / X 手帳 / Esc 一時停止<br>スマホ: 縦でも横でも。左右のキーは、指を滑らせて切り替えられる</p>
      <p class="fine">登場する会社・人物・ドメインはすべて架空です。</p>
    </div>`,
    'is-title',
  );
  on('[data-act=start]', onStart);
  on('[data-act=cards]', onCards);
  on('[data-act=mute]', onMute);
}

// ---------------- 名前を決める ----------------
export function askName(initial, done) {
  setKeys(null);
  show(
    `<form class="panel namebox" role="dialog" aria-label="名前を決める">
      ${faceImg('kuroda', 64)}
      <p>黒田先輩「……で、名前なんだっけ?」</p>
      <input id="name-input" maxlength="8" value="${esc(initial)}" autocomplete="off" aria-label="あなたの名前" data-autofocus>
      <div class="actions"><button class="primary" type="submit">これでいく</button></div>
    </form>`,
    'is-dialog',
  );
  const input = $('#name-input');
  input.focus();
  input.select();
  overlay.querySelector('form').addEventListener(
    'submit',
    once((e) => {
      e.preventDefault();
      done(input.value.trim() || 'ミナト');
    }),
  );
}

// ---------------- 一時停止 ----------------
export function showPause({ muted, onResume, onRestart, onTitle, onMute }) {
  setKeys(null);
  show(
    `<div class="panel pause" role="dialog" aria-label="一時停止">
      <h2>PAUSE</h2>
      <div class="actions">
        <button class="primary" data-act="resume" data-autofocus>つづける</button>
        <button data-act="restart">この日を最初から</button>
        <button data-act="mute">${muted ? '音: オフ' : '音: オン'}</button>
        <button data-act="title" class="ghost">タイトルへ</button>
      </div>
    </div>`,
    'is-dialog',
  );
  on('[data-act=resume]', onResume);
  on('[data-act=restart]', onRestart);
  on('[data-act=mute]', onMute);
  on('[data-act=title]', onTitle);
}

// ---------------- 会話 ----------------
// 画面の下に、顔つきの会話ウインドウを出す。タップ・Enter・スペース・Z・X で送る
export function talk(lines, done) {
  let i = 0;
  let typing = null;
  const finish = once(() => {
    clearInterval(typing);
    setKeys(null);
    done();
  });
  show(
    `<div class="talk" role="dialog" aria-label="会話" aria-live="polite">
      <div class="talk-face"></div>
      <div class="talk-main">
        <p class="talk-name"></p>
        <p class="talk-text"></p>
        <span class="talk-next" aria-hidden="true">▼</span>
      </div>
      <button class="talk-skip ghost" data-act="skip">スキップ</button>
    </div>`,
    'is-talk',
  );
  const box = overlay.querySelector('.talk');
  const text = overlay.querySelector('.talk-text');
  let full = '';
  const render = () => {
    const l = lines[i];
    const p = PEOPLE[l.who] || PEOPLE.sys;
    box.classList.toggle('sys', l.who === 'sys');
    overlay.querySelector('.talk-face').innerHTML = faceImg(l.who, 72);
    overlay.querySelector('.talk-name').textContent = p.name;
    full = fill(l.text);
    let n = 0;
    clearInterval(typing);
    text.textContent = '';
    typing = setInterval(() => {
      n += 2;
      text.textContent = full.slice(0, n);
      if (n >= full.length) {
        clearInterval(typing);
        typing = null;
      }
    }, 22);
    sfx.tick();
  };
  const next = () => {
    if (typing) {
      clearInterval(typing);
      typing = null;
      text.textContent = full;
      return;
    }
    i++;
    if (i >= lines.length) finish();
    else render();
  };
  box.addEventListener('click', (e) => {
    if (e.target.closest('[data-act=skip]')) return;
    next();
  });
  on('[data-act=skip]', finish);
  setKeys((e) => {
    if (['Enter', 'Space', 'KeyZ', 'KeyX', 'KeyJ', 'KeyK'].includes(e.code)) {
      e.preventDefault();
      next();
    }
  });
  render();
}

// ---------------- 手帳 ----------------
function clueHTML(kind, has) {
  const c = CLUES[kind];
  if (!has) {
    return `<div class="clue missing"><b>？？？</b><p>${esc(c.where)}で手に入る手がかり。まだ持っていない</p></div>`;
  }
  return `<div class="clue">
    <img src="${ctx.clueImg(kind)}" alt="" width="40" height="40">
    <div><b>${esc(c.name)}</b>${c.lines.map((l) => `<code>${esc(l)}</code>`).join('')}<p class="clue-hint">${esc(c.hint)}</p></div>
  </div>`;
}

export function showNotebook(clues, onClose) {
  show(
    `<div class="panel notebook" role="dialog" aria-label="手帳">
      <h2>📒 手帳</h2>
      <p class="lead">集めた手がかり。判断シーンで、届いたメールと見比べられる。</p>
      ${Object.keys(CLUES).map((k) => clueHTML(k, clues[k])).join('')}
      <div class="actions"><button class="primary" data-act="close" data-autofocus>とじる</button></div>
    </div>`,
    'is-dialog',
  );
  const close = once(onClose);
  on('[data-act=close]', close);
  setKeys((e) => {
    if (['Escape', 'KeyX'].includes(e.code)) close();
  });
}

// ---------------- 判断シーン ----------------
function mailHTML(m, lit) {
  return `<div class="mock mail">
    <div class="mail-bar">受信トレイ</div>
    <div class="mail-row"><span>差出人</span><b>${marks(m.from, lit)}</b></div>
    ${m.replyTo ? `<div class="mail-row"><span>返信先</span><b>${marks(m.replyTo, lit)}</b></div>` : ''}
    <div class="mail-row"><span>件名</span><b>${marks(m.subject, lit)}</b></div>
    <div class="mail-body">${m.body.map((l) => `<p>${marks(l, lit)}</p>`).join('')}</div>
  </div>`;
}

const SCENE_NAMES = { invoice: '請求書', bec: '振込先の変更', phish: 'パスワードの期限切れ' };
export const sceneName = (id) => SCENE_NAMES[id] || id;

const TIMEOUT = {
  tier: 'safe',
  delay: 10,
  rule: 3,
  title: '時間切れ(保留)',
  text: '決めきれずに時間切れ。でも、急かされたときに判断を保留するのは悪くない選択。保留したら、別の道で確かめよう。',
};

// clues: 持っている手がかり / clock: 時刻 / done(result)
export function showScene(id, { clues, clock }, done) {
  const sc = SCENES[id];
  // 手がかりの有無で、選択肢を差し替える
  const choices = sc.choices
    .filter((c) => !c.onlyWith || clues[c.onlyWith])
    .map((c) => (c.needs && !clues[c.needs] ? { ...c.alt, usedClue: null } : { ...c, usedClue: c.needs || null }));
  let finished = false;

  const asker =
    sc.from === 'sato'
      ? `<div class="asker">${faceImg('sato', 48)}<p><b>佐藤さん</b>${esc(fill(sc.ask))}</p></div>`
      : `<div class="asker self"><p><b>あなたあてのメール</b>自分で判断しよう</p></div>`;

  show(
    `<div class="panel scene" role="dialog" aria-label="判断シーン">
      <div class="scene-top">
        <div class="scene-head">
          <span class="tag">${esc(clock)} 判断シーン</span>
          ${sc.time ? `<span class="count">あと <b>${sc.time}</b> 秒</span>` : '<span class="count calm">時間制限なし</span>'}
        </div>
        ${sc.time ? '<div class="timer"><i></i></div>' : ''}
      </div>
      <div class="scene-body">
        <div class="scene-left">${asker}${mailHTML(sc.mock, false)}</div>
        <div class="scene-right">
          <div class="choices">${choices
            .map(
              (c, i) =>
                `<button data-choice="${i}"><kbd>${i + 1}</kbd><span>${esc(fill(c.label))}${
                  c.usedClue ? `<em>📒 ${esc(CLUES[c.usedClue].name)}を使う</em>` : ''
                }</span></button>`,
            )
            .join('')}</div>
          <div class="tools">
            <button class="inspect" data-act="notebook">📒 手帳と見比べる</button>
            ${sc.inspect ? `<button class="inspect" data-act="inspect">${esc(sc.inspect.label)}</button>` : ''}
          </div>
          <div class="detail notebook-in" hidden>${sc.clues.map((k) => clueHTML(k, clues[k])).join('')}</div>
          ${sc.inspect ? `<p class="detail inspect-out" hidden>${marks(sc.inspect.text, false)}</p>` : ''}
        </div>
      </div>
    </div>`,
    'is-dialog is-scene',
  );

  // 制限時間(急かしてくるメールだけ)
  if (sc.time) {
    const bar = overlay.querySelector('.timer i');
    const count = overlay.querySelector('.count b');
    const start = performance.now();
    let lastSec = sc.time;
    const tick = (now) => {
      if (finished) return;
      const rest = Math.max(0, sc.time - (now - start) / 1000);
      bar.style.transform = `scaleX(${rest / sc.time})`;
      const sec = Math.ceil(rest);
      if (sec !== lastSec) {
        lastSec = sec;
        count.textContent = sec;
        if (sec <= 5 && sec > 0) sfx.tick();
      }
      if (rest <= 0) return choose(TIMEOUT);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  on('[data-act=notebook]', (e) => {
    const el = overlay.querySelector('.notebook-in');
    el.hidden = !el.hidden;
    e.currentTarget.classList.toggle('on', !el.hidden);
  });
  on('[data-act=inspect]', (e) => {
    overlay.querySelector('.inspect-out').hidden = false;
    e.currentTarget.disabled = true;
  });
  on('[data-choice]', (e) => choose(choices[+e.currentTarget.dataset.choice]));
  setKeys((e) => {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= choices.length) choose(choices[n - 1]);
  });

  function choose(c) {
    if (finished) return;
    finished = true;
    setKeys(null);
    if (c.followup) {
      sfx.bad();
      followup(c);
    } else {
      outcome(c, undefined);
    }
  }

  // 引っかかったあと: すぐ報告するか(③ やったら報告)
  function followup(c) {
    show(
      `<div class="panel outcome fooled" role="dialog">
        <p class="mark">×</p>
        <h2>${esc(c.title)}</h2>
        <p>${esc(fill(c.text))}</p>
        <p class="ask-again">${esc(FOLLOWUP.ask)}</p>
        <div class="choices">
          <button data-act="report" data-autofocus><kbd>1</kbd><span>${esc(FOLLOWUP.report.label)}</span></button>
          <button data-act="hide"><kbd>2</kbd><span>${esc(FOLLOWUP.hide.label)}</span></button>
        </div>
      </div>`,
      'is-dialog',
    );
    const pick = once((report) => outcome(c, report));
    on('[data-act=report]', () => pick(true));
    on('[data-act=hide]', () => pick(false));
    setKeys((e) => {
      if (e.key === '1') pick(true);
      if (e.key === '2') pick(false);
    });
  }

  function outcome(c, report) {
    const tier = TIERS[c.tier];
    if (c.tier === 'best') sfx.good();
    else if (c.tier === 'fooled' || c.tier === 'close') sfx.bad();
    else sfx.open();
    let leak = c.leak || 0;
    if (report === true) leak = Math.round(leak / 2);
    if (report === false) leak += FOLLOWUP.hide.leak;
    const after = report === true ? FOLLOWUP.report : report === false ? FOLLOWUP.hide : null;
    const hasMarks = /\{\{/.test(JSON.stringify(sc.mock)) || sc.inspect;
    show(
      `<div class="panel outcome ${c.tier}" role="dialog">
        <p class="mark">${tier.mark}<small>${esc(tier.label)}</small></p>
        <h2>${esc(after ? after.title : c.title)}</h2>
        <p>${esc(fill(after ? `${c.text} ${after.text}` : c.text))}</p>
        <p class="rule">${esc(RULES[c.rule])}</p>
        <p class="effects">
          ${leak ? `<span class="leak">漏洩リスク +${leak}%</span>` : ''}
          ${c.delay ? `<span class="delay">業務の遅れ +${c.delay}%</span>` : ''}
          ${!leak && !c.delay ? '<span class="none">ゲージの変化なし</span>' : ''}
        </p>
        ${
          hasMarks
            ? `<details class="evidence" open><summary>決め手を見る</summary>
                ${mailHTML(sc.mock, true)}
                ${sc.inspect ? `<p class="detail">${marks(sc.inspect.text, true)}</p>` : ''}
                ${sc.clues.filter((k) => clues[k]).map((k) => clueHTML(k, true)).join('')}
              </details>`
            : ''
        }
        <button class="primary" data-act="ok" data-autofocus>つづける</button>
      </div>`,
      'is-dialog',
    );
    const ok = once(() =>
      done({ tier: c.tier, leak: c.leak || 0, delay: c.delay || 0, cause: c.cause, score: tier.score, report }),
    );
    on('[data-act=ok]', ok);
    setKeys((e) => {
      if (e.code === 'Enter') ok();
    });
  }
}

// ---------------- 障害報告書・始末書(ゲームオーバー) ----------------
export function showReport(game, { onRetry, onTitle }) {
  setKeys(null);
  const d = new Date();
  const when = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const delay = game.overKind === 'delay';
  const causes = (delay ? game.delayCauses : game.causes).map((c) => CAUSES[c]).filter(Boolean);
  const doc = delay
    ? { title: '始末書', subject: `取引先への支払い遅延(${game.stage.name})`, impact: '取引先と社内の業務に、業務の遅れ 100% ぶんの迷惑をかけた', stamp: '要提出' }
    : { title: '障害報告書', subject: `情報漏洩インシデント(${game.stage.name})`, impact: '社外秘データ(架空)が、漏洩リスク 100% ぶん流出', stamp: '要提出' };
  show(
    `<div class="panel report" role="dialog" aria-label="${doc.title}">
      <div class="report-head"><h2>${doc.title}</h2><span class="stamp">${doc.stamp}</span></div>
      <table>
        <tr><th>件名</th><td>${esc(doc.subject)}</td></tr>
        <tr><th>発生日時</th><td>${when}</td></tr>
        <tr><th>報告者</th><td>${esc(ctx.name())}(情報システム部 見習い)</td></tr>
        <tr><th>${delay ? '内容' : '影響範囲'}</th><td>${esc(doc.impact)}</td></tr>
        <tr><th>原因</th><td><ol>${causes.map((c) => `<li>${esc(c.title)}</li>`).join('')}</ol></td></tr>
        <tr><th>再発防止策</th><td><ol>${causes.map((c) => `<li>${esc(c.fix)}</li>`).join('')}</ol></td></tr>
      </table>
      <p class="note">${
        delay
          ? '※ 疑うのは大事。でも、確かめて本物なら進めるのも仕事のうち。'
          : '※ この報告書は自動生成です。上長の承認は不要です(ゲームなので)。'
      }</p>
      <div class="actions">
        <button class="primary" data-act="retry" data-autofocus>再発防止策を提出する(この日をもう一度)</button>
        <button data-act="title">タイトルへ</button>
      </div>
    </div>`,
    'is-dialog is-report',
  );
  on('[data-act=retry]', once(onRetry));
  on('[data-act=title]', once(onTitle));
}

// ---------------- 夕方の振り返り ----------------
export function showReview(sum, { day, cardImg, onCards, onRetry, onTitle }) {
  setKeys(null);
  const cards = sum.cards.map((id) => CARDS.find((c) => c.id === id));
  show(
    `<div class="panel review" role="dialog" aria-label="振り返り">
      <p class="review-day">${esc(day)}の振り返り</p>
      <div class="grade grade-${sum.grade}"><b>${sum.grade}</b><span>評価</span></div>
      <div class="boss-comment">${faceImg('kuroda', 40)}<p><b>部長(を代読する黒田先輩)</b>「${esc(sum.boss)}」</p></div>
      <dl class="stats">
        <div><dt>漏洩リスク(最大)</dt><dd>${Math.round(sum.maxLeak)}%</dd></div>
        <div><dt>業務の遅れ(最大)</dt><dd>${Math.round(sum.maxDelay)}%</dd></div>
        <div><dt>最善の判断</dt><dd>${sum.goods} / ${sum.total}</dd></div>
      </dl>
      <ul class="judges">${sum.judgments
        .map((j) => `<li class="${j.tier}"><span>${TIERS[j.tier].mark}</span>${esc(sceneName(j.id))}<em>${esc(TIERS[j.tier].label)}</em></li>`)
        .join('')}</ul>
      ${sum.badges.length ? `<div class="badges">${sum.badges.map((b) => `<span>🏅 ${esc(b)}</span>`).join('')}</div>` : ''}
      <h3>手に入れた解説カード</h3>
      <ul class="mini-cards">${cards
        .map((c) => `<li><img src="${cardImg(c)}" alt="" width="32" height="32">${esc(c.name)}</li>`)
        .join('')}</ul>
      <p class="next">火曜(上司・社長のなりすまし)は準備中です。</p>
      <div class="actions">
        <button class="primary" data-act="cards" data-autofocus>カードを読む</button>
        <button data-act="retry">月曜をもう一度</button>
        <button data-act="title">タイトルへ</button>
      </div>
    </div>`,
    'is-dialog',
  );
  on('[data-act=cards]', onCards);
  on('[data-act=retry]', once(onRetry));
  on('[data-act=title]', once(onTitle));
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
