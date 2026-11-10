// 文字を出す画面(HTML で描く):
//   タイトル・名前入力・HUD・会話・手帳・判断シーン・障害報告書/始末書・振り返り・解説カード・一時停止
import { SCENES, RULES, TIERS, FOLLOWUP } from '../data/scenes.js';
import { ACTIONS, ESCALATE } from '../data/actions.js';
import { CARDS, CAUSES, TIPS } from '../data/cards.js';
import { PEOPLE, CLUES } from '../data/story.js';
import { sfx } from './audio.js';

const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const overlay = $('#overlay');
let bannerTimer = 0;
let shownAt = 0;
// 画面を出した直後(0.25秒)のクリックは受け付けない。前の画面でのタップが、新しい画面のボタンに当たるのを防ぐ
overlay.addEventListener(
  'click',
  (e) => {
    if (performance.now() - shownAt < 250) {
      e.stopPropagation();
      e.preventDefault();
    }
  },
  true,
);

// main.js から受け取るもの: 顔・手がかりの画像、主人公の名前
let ctx = { face: () => '', clueImg: () => '', name: () => 'ミナト', touch: () => false, seen: () => true, markSeen: () => {} };
export function initUI(c) {
  ctx = { ...ctx, ...c };
}
// {name} を主人公の名前に
// 操作の書き方は、タッチ端末かどうかで変える
const KEYWORDS = {
  move: () => (ctx.touch() ? '左下の ◀ ▶ キー' : '← → キー'),
  jump: () => (ctx.touch() ? '右下の A ボタン' : 'Z キーかスペース'),
  note: () => (ctx.touch() ? '右上の 📒' : 'C キーか右上の 📒'),
  shoot: () => (ctx.touch() ? 'B ボタン' : 'X キー'),
  pause: () => (ctx.touch() ? '右上の ⏸' : 'Esc キー'),
};
const fill = (t) =>
  String(t)
    .replace(/\{name\}/g, ctx.name())
    .replace(/\{(move|jump|note|pause|shoot)\}/g, (_, k) => KEYWORDS[k]());
// {{ }} で囲んだ決め手: on なら光らせる、off なら印だけ外す
const marks = (t, on) =>
  esc(fill(t)).replace(/\{\{(.+?)\}\}/g, (_, w) => (on ? `<mark>${w}</mark>` : w));

function show(html, cls = '') {
  // 重ねる画面を出すときは、プレイ中のひとことを消す
  clearTimeout(bannerTimer);
  $('#banner').className = '';
  overlay.className = cls;
  overlay.innerHTML = html;
  overlay.hidden = false;
  shownAt = performance.now();
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
  const wb = $('#hud-weapon');
  const w = game.weaponHud();
  wb.hidden = w.count < 2;
  wb.classList.toggle('buster', w.id === 'buster');
  wb.style.setProperty('--wc', w.color);
  wb.style.setProperty('--e', w.energy ?? 1);
  wb.querySelector('b').textContent = w.short;
  wb.title = w.name;
  const ioc = $('#hud-ioc');
  ioc.hidden = !game.ioc;
  ioc.textContent = `痕跡 ${game.ioc}`;
  ioc.classList.toggle('ready', game.ioc >= 3);
  $('#hud-clues').innerHTML = Object.keys(CLUES)
    .filter((k) => game.clues[k])
    .map((k) => `<img src="${ctx.clueImg(k)}" alt="${esc(CLUES[k].name)}" width="20" height="20">`)
    .join('');
}

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
export function showTitle({ title, subtitle, owned, heroURL, onStart, onCards, muted, onMute, onMovie, name, onName, startLabel, days, onDay }) {
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
  setKeys(null);
  show(
    `<div class="panel title">
      <div class="title-brand">
      <img class="hero" src="${heroURL}" alt="" width="128" height="128">
      <h1>${esc(title)}</h1>
      <p class="sub">〜 ${esc(subtitle)} 〜</p>
      </div>
      <div class="title-menu">
      <label class="namefield"><span>あなたの名前</span><input id="title-name" maxlength="8" value="${esc(name || '')}" placeholder="ミナト" autocomplete="off"></label>
      <div class="actions">
        <button class="primary" data-act="start" data-autofocus>${esc(startLabel || '月曜からはじめる')}</button>
        ${
          days && days.filter((d) => d.unlocked).length > 1
            ? `<div class="day-select" role="group" aria-label="日を選ぶ">${days
                .map(
                  (d, i) =>
                    `<button data-day="${i}" ${d.unlocked ? '' : 'disabled'} title="${esc(d.unlocked ? d.theme : 'まだ遊べない')}">${esc(d.day.slice(0, 1))}${d.cleared ? '<i>✓</i>' : ''}</button>`,
                )
                .join('')}</div>`
            : ''
        }
        <div class="sub-actions">
          <button data-act="cards">カード ${owned}/${CARDS.length}</button>
          ${onMovie ? '<button data-act="movie">ムービー</button>' : ''}
          <button data-act="mute" class="ghost">${muted ? '音 オフ' : '音 オン'}</button>
        </div>
      </div>
      <p class="tip"><span>Tips</span>${esc(tip)}</p>
      <p class="keys">← → 移動 / Z ジャンプ / X ショット(長押しでため撃ち) / C 手帳 / Esc 一時停止</p>
      <p class="fine">会社・人物・ドメインはすべて架空です。</p>
      </div>
    </div>`,
    'is-title',
  );
  // 名前は入力したそばから保存する(はじめる・カード・音のどれを押しても消えないように)
  const input = $('#title-name');
  const saveName = () => onName?.(input.value.trim());
  input.addEventListener('input', saveName);
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      saveName();
      onStart();
    }
  });
  on('[data-act=start]', () => {
    saveName();
    onStart();
  });
  on('[data-act=cards]', onCards);
  on('[data-act=mute]', onMute);
  if (onMovie) on('[data-act=movie]', onMovie);
  on('[data-day]', (e) => {
    saveName();
    onDay?.(+e.currentTarget.dataset.day);
  });
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
    document.querySelectorAll('.spot').forEach((el) => el.classList.remove('spot'));
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
    document.querySelectorAll('.spot').forEach((el) => el.classList.remove('spot'));
    if (l.point) document.querySelectorAll(l.point).forEach((el) => el.classList.add('spot'));
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

// ---------------- オープニングムービーの字幕 ----------------
// 画面のどこをタップしても次の字幕へ。スキップもできる
export function startMovieUI({ onNext, onSkip }) {
  show(
    `<div class="movie-ui">
      <button class="movie-skip ghost" data-act="skip">スキップ ⏭</button>
      <div class="movie-cap" aria-live="polite"><p class="movie-name"></p><p class="movie-text"></p><span class="movie-dots"></span></div>
    </div>`,
    'is-movie',
  );
  overlay.addEventListener('click', (e) => {
    if (e.target.closest('[data-act=skip]')) return;
    onNext();
  });
  on('[data-act=skip]', onSkip);
  setKeys((e) => {
    if (['Enter', 'Space', 'KeyZ', 'KeyX'].includes(e.code)) {
      e.preventDefault();
      onNext();
    }
    if (e.code === 'Escape') onSkip();
  });
}

export function setMovieCaption(cap, shot, total) {
  const box = overlay.querySelector('.movie-cap');
  if (!box) return;
  const p = cap.who ? PEOPLE[cap.who] : null;
  box.querySelector('.movie-name').textContent = p ? p.name : '';
  box.classList.toggle('speak', !!p);
  const text = box.querySelector('.movie-text');
  text.textContent = fill(cap.text);
  text.classList.remove('in');
  void text.offsetWidth;
  text.classList.add('in');
  box.querySelector('.movie-dots').textContent = Array.from({ length: total }, (_, i) => (i === shot ? '●' : '・')).join('');
}

// ---------------- 初めて見たときの説明(画面の一部を光らせて、順番に説明) ----------------
function coach(key, steps, done) {
  if (ctx.seen(key)) return done();
  ctx.markSeen(key);
  let i = 0;
  const el = document.createElement('div');
  el.id = 'coach';
  el.setAttribute('role', 'dialog');
  document.body.appendChild(el);
  const clear = () => document.querySelectorAll('.spot').forEach((x) => x.classList.remove('spot'));
  const render = () => {
    clear();
    const st = steps[i];
    const target = st.sel ? overlay.querySelector(st.sel) || document.querySelector(st.sel) : null;
    if (target) {
      target.classList.add('spot');
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    el.innerHTML = `${faceImg('guard', 40)}<div><p class="coach-who">ガードの解説 ${i + 1}/${steps.length}</p><p>${esc(fill(st.text))}</p></div><button class="primary" data-coach="next">${i + 1 < steps.length ? '次へ' : 'わかった'}</button>`;
    el.querySelector('[data-coach=next]').focus({ preventScroll: true });
  };
  const keys = (e) => {
    if (['Enter', 'Space'].includes(e.code)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      step();
    }
  };
  const step = () => {
    i++;
    if (i >= steps.length) {
      clear();
      el.remove();
      removeEventListener('keydown', keys, true);
      done();
    } else render();
  };
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-coach=next]')) step();
  });
  addEventListener('keydown', keys, true);
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

export function basicsHTML() {
  return `<div class="basics">
    <h3>3つの基本動作</h3>
    <ol>${Object.values(RULES).map((r) => `<li>${esc(r.replace(/^[①②③] /, ''))}</li>`).join('')}</ol>
    <h3>2本のゲージ</h3>
    <ul>
      <li><b class="c-leak">漏洩リスク</b>: 詐欺に引っかかる・敵にぶつかる・穴に落ちるとたまる。満タンで<b>障害報告書</b>(ゲームオーバー)</li>
      <li><b class="c-delay">業務の遅れ</b>: 本物まで疑う・自分で確かめられることを人に任せるとたまる。満タンで<b>始末書</b>(ゲームオーバー)。業務データ(結晶)を集めると減る</li>
    </ul>
    <h3>判断の結果(4段階)</h3>
    <ul>
      <li>◎ 最善 ── 正しい確かめ方で解決</li>
      <li>○ 安全だが遅い ── 守れたが、業務の遅れがたまる</li>
      <li>△ 惜しい / たまたま無事 ── 確かめたつもり、または運が良かっただけ</li>
      <li>× 引っかかった ── 漏洩リスクが大きくたまる。すぐ報告すれば半分で済む</li>
    </ul>
    <h3>夕方の評価</h3>
    <p>100点から「漏洩リスクの最大」と「業務の遅れの最大×0.7」を引き、最善の判断1つにつき2点、メールの怪しいところを見抜くごとに2点足す。90点以上で全部が最善なら S。</p>
    <h3>メールの見抜き</h3>
    <p>判断シーンでは、メールの怪しいところをタップして印を付ける。本当に怪しいところなら「見抜いた」、問題ないところなら「疑いすぎ」(業務の遅れ +3%)。本物のメールなら、印を付けないのが正解。</p>
    <h3>操作</h3>
    <p>移動: ${esc(KEYWORDS.move())} / ジャンプ: ${esc(KEYWORDS.jump())}(押す長さで高さが変わる) / ショット: ${esc(KEYWORDS.shoot())}(長押しして離すと、ため撃ち) / 武器の切り替え: ${ctx.touch() ? '右上の武器アイコン' : 'Q / E'} / 手帳: ${esc(KEYWORDS.note())} / 一時停止: ${esc(KEYWORDS.pause())}</p>
  </div>`;
}

export function showNotebook(clues, onClose, tab = 'clues') {
  show(
    `<div class="panel notebook" role="dialog" aria-label="手帳">
      <h2>📒 手帳</h2>
      <div class="tabs" role="tablist">
        <button role="tab" data-tab="clues" class="${tab === 'clues' ? 'on' : ''}">手がかり</button>
        <button role="tab" data-tab="basics" class="${tab === 'basics' ? 'on' : ''}">きほん</button>
      </div>
      <div class="tab-body">${
        tab === 'clues'
          ? `<p class="lead">集めた手がかり(本物の情報)。判断シーンで、届いたメールと見比べられる。</p>${Object.keys(CLUES)
              .map((k) => clueHTML(k, clues[k]))
              .join('')}`
          : basicsHTML()
      }</div>
      <div class="actions"><button class="primary" data-act="close" data-autofocus>とじる</button></div>
    </div>`,
    'is-dialog',
  );
  const close = once(onClose);
  on('[data-act=close]', close);
  on('[data-tab]', (e) => showNotebook(clues, onClose, e.currentTarget.dataset.tab));
  setKeys((e) => {
    if (['Escape', 'KeyX'].includes(e.code)) close();
  });
}

// ---------------- 判断シーン ----------------
// メールの中で「印を付けられるところ」
//   {{ }} = 本当に怪しいところ(証拠) / [[ ]] = 問題ないところ(引っかけ。印を付けると「疑いすぎ」)
// mode: 'play' ならタップできるボタン、'review' なら答え合わせの色分け
// cx: { n: 通し番号, flags: 印を付けた番号, list: 番号ごとの中身 } (同じ順番で数えるので、play と review で番号がそろう)
function cands(str, cx, mode) {
  return esc(fill(str)).replace(/(\{\{|\[\[)(.+?)(\}\}|\]\])/g, (_, open, w) => {
    const i = cx.n++;
    const ev = open === '{{';
    cx.list[i] = { ev, text: w };
    if (mode === 'play') return `<button type="button" class="cand" data-c="${i}">${w}</button>`;
    const f = cx.flags.has(i);
    const cls = ev ? (f ? 'hit' : 'miss') : f ? 'false' : 'plain';
    return `<span class="cand ${cls}">${w}</span>`;
  });
}

function mailHTML(m, mode, cx) {
  const kind = m.kind || 'mail';
  const lines = (arr) => arr.map((l) => `<p>${cands(l, cx, mode)}</p>`).join('');
  if (kind === 'chat') {
    return `<div class="mock chat">
      <div class="mail-bar">${esc(m.app || 'チャット')}</div>
      <div class="chat-from">${cands(m.from, cx, mode)}</div>
      <div class="chat-bubbles">${m.body.map((l) => `<p class="bubble">${cands(l, cx, mode)}</p>`).join('')}</div>
    </div>`;
  }
  if (kind === 'call') {
    return `<div class="mock call">
      <div class="mail-bar">📞 ${esc(m.app || '着信')}</div>
      <div class="call-from"><span>相手</span><b>${cands(m.from, cx, mode)}</b></div>
      <div class="call-body">${lines(m.body)}</div>
    </div>`;
  }
  if (kind === 'screen') {
    return `<div class="mock screen">
      <div class="mail-bar">⚠ ${esc(m.app || '画面')}</div>
      <div class="screen-title">${cands(m.from, cx, mode)}</div>
      <div class="screen-body">${lines(m.body)}</div>
    </div>`;
  }
  return `<div class="mock mail">
    <div class="mail-bar">受信トレイ</div>
    <div class="mail-row"><span>差出人</span><b>${cands(m.from, cx, mode)}</b></div>
    ${m.replyTo ? `<div class="mail-row"><span>返信先</span><b>${cands(m.replyTo, cx, mode)}</b></div>` : ''}
    <div class="mail-row"><span>件名</span><b>${cands(m.subject, cx, mode)}</b></div>
    <div class="mail-body">${lines(m.body)}</div>
  </div>`;
}

const SCENE_NAMES = {
  invoice: '請求書',
  bec: '振込先の変更',
  phish: 'パスワードの期限切れ',
  ceo: '社長からのチャット',
  mfaSetup: '多要素認証の設定',
  attach: '添付ファイルつきの請求書',
  reuse: '新しいパスワード',
  vishing: '情シスを名乗る電話',
  vpn: 'VPN 機器の更新',
  takeover: '本物のアドレスからの振込先変更',
  payment: '大口の支払いの確認',
  ransom: 'ランサムウェアの画面',
  support: '復旧業者を名乗る電話',
  threat: '黒幕からの脅し',
};
const KIND_SELF = { mail: 'あなたあてのメール', chat: 'あなたあてのチャット', call: 'あなたへの電話', screen: '目の前の画面' };
export const sceneName = (id) => SCENE_NAMES[id] || id;

const TIMEOUT = {
  tier: 'safe',
  delay: 10,
  rule: 3,
  title: '時間切れ(保留)',
  text: '決めきれずに時間切れ。でも、急かされたときに判断を保留するのは悪くない選択。保留したら、別の道で確かめよう。',
};

// 2つの文字列を1文字ずつ重ねて、違う文字に印を付ける(短い文字列なので、素直な LCS で十分)
function diffHTML(a, b) {
  const n = a.length;
  const m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ka = new Array(n).fill(false);
  const kb = new Array(m).fill(false);
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (a[i] === b[j]) {
      ka[i] = kb[j] = true;
      i++;
      j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  const paint = (str, keep, cls) => [...str].map((ch, i) => (keep[i] ? esc(ch) : `<i class="${cls}">${esc(ch)}</i>`)).join('');
  return { a: paint(a, ka, 'bad'), b: paint(b, kb, 'good'), same: a === b };
}

const FX = {
  best: '🛡️',
  safe: '⏳',
  ok: '😅',
};

// clues: 持っている手がかり / clock: 時刻 / done(result)
// 読んで選ぶのではなく、手を動かして確かめる画面:
//   🔍 手帳と重ねる … 違う文字が光る / 📞 電話 … どの番号にかけるかを自分で選ぶ / ボタンは絵と短い言葉だけ
export function showScene(id, { clues, clock, ioc = 0 }, done) {
  const sc = SCENES[id];
  const A = ACTIONS[id] || {};
  // 手がかりの有無で、選択肢を差し替える(差し替えた先は「先輩に相談」)
  const entries = sc.choices
    .map((c, i) => ({ c, act: A.acts?.[i] }))
    .filter(({ c }) => !c.onlyWith || clues[c.onlyWith])
    .map(({ c, act }) => (c.needs && !clues[c.needs] ? { c: { ...c.alt }, act: ESCALATE } : { c: { ...c }, act: act || (c.cause === 'escalate' ? ESCALATE : { icon: '▶️', short: c.label }) }));
  // 見比べる行(手がかりを持っているものだけ使える)
  const rows = (A.compare || []).map((r) => ({ ...r, has: !!clues[r.clue], seen: false }));
  const usable = rows.filter((r) => r.has);
  const compared = () => usable.length > 0 && usable.every((r) => r.seen);
  // ボタン: 電話はダイヤル画面へまとめ、同じ group は1つにまとめる
  const buttons = [];
  const calls = entries.filter((e) => e.act.via);
  if (calls.length) buttons.push({ icon: '📞', short: '電話する', kind: 'dial' });
  const groups = {};
  for (const e of entries) {
    if (e.act.via) continue;
    if (e.act.group) {
      if (!groups[e.act.group]) {
        groups[e.act.group] = [];
        buttons.push({ icon: e.act.icon, short: e.act.short, kind: 'group', key: e.act.group });
      }
      groups[e.act.group].push(e);
    } else buttons.push({ icon: e.act.icon, short: e.act.short, kind: 'one', entry: e });
  }
  for (let i = buttons.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [buttons[i], buttons[j]] = [buttons[j], buttons[i]];
  }
  let finished = false;
  const cx = { n: 0, flags: new Set(), list: [] };
  const mailPlay = mailHTML(sc.mock, 'play', cx);
  const inspectPlay = sc.inspect ? cands(sc.inspect.text, cx, 'play') : '';
  const kind = sc.mock.kind || 'mail';
  const asker =
    sc.from === 'sato'
      ? `<div class="asker">${faceImg('sato', 40)}<p><b>佐藤さん</b>${esc(fill(sc.ask))}</p></div>`
      : `<div class="asker self"><p><b>${KIND_SELF[kind]}</b></p></div>`;
  const rowHTML = (r, i) =>
    r.has
      ? `<button class="cmp" data-cmp="${i}"><span>🔍</span>${esc(r.label)}を重ねる</button><div class="cmp-out" data-out="${i}" hidden></div>`
      : `<p class="cmp missing">${esc(r.label)}: 手帳に${esc(CLUES[r.clue].name)}がない</p>`;

  show(
    `<div class="panel scene" role="dialog" aria-label="判断シーン">
      <div class="scene-top">
        <div class="scene-head">
          <span class="tag">${esc(clock)}</span>
          ${sc.time ? `<span class="count">あと <b>${sc.time}</b> 秒</span>` : ''}
        </div>
        ${sc.time ? '<div class="timer"><i></i></div>' : ''}
      </div>
      <div class="scene-body">
        <div class="scene-left">${asker}
          <p class="mark-count">怪しいところをタップ <span>印 <b>0</b></span></p>
          ${mailPlay}
          ${sc.inspect ? `<button class="inspect" data-act="inspect">${esc(sc.inspect.label)}</button><p class="detail inspect-out" hidden>${inspectPlay}</p>` : ''}
        </div>
        <div class="scene-right">
          ${rows.length ? `<div class="compare"><p class="cmp-head">手帳と重ねる</p>${rows.map(rowHTML).join('')}</div>` : ''}
          ${ioc >= 3 ? `<button class="inspect" data-act="ioc">🔎 痕跡を使う(のこり ${ioc})</button>` : ''}
          <div class="acts">${buttons
            .map((b, i) => `<button class="act-btn" data-btn="${i}"><kbd>${i + 1}</kbd><span class="ic">${b.icon}</span><span>${esc(b.short)}</span></button>`)
            .join('')}</div>
        </div>
      </div>
      <div class="dialer" hidden></div>
    </div>`,
    'is-dialog is-scene',
  );

  // 初めてのときだけ、見方を短く
  const steps = [
    { sel: '.mock', text: '届いたものを見て、怪しいところはタップで印' },
    rows.length ? { sel: '.compare', text: '手帳と重ねると、違う文字が光る' } : null,
    { sel: '.acts', text: 'どうするかを、ボタンで選ぶ' },
  ].filter(Boolean);
  coach('scene2', steps, () => (sc.time ? coach('timed', [{ sel: '.timer', text: '急かしてくるものには時間制限。時間切れは「保留」' }], startTimer) : startTimer()));

  function startTimer() {
    if (!sc.time) return;
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

  on('.cand', (e) => {
    const b = e.currentTarget;
    const i = +b.dataset.c;
    if (cx.flags.has(i)) cx.flags.delete(i);
    else cx.flags.add(i);
    b.classList.toggle('flagged', cx.flags.has(i));
    overlay.querySelector('.mark-count b').textContent = cx.flags.size;
    sfx.tick();
  });
  // 手帳と重ねる
  on('[data-cmp]', (e) => {
    const i = +e.currentTarget.dataset.cmp;
    const r = rows[i];
    const out = overlay.querySelector(`[data-out="${i}"]`);
    let html;
    if (r.kind === 'ext') {
      const k = r.mail.lastIndexOf('.');
      const ext = r.mail.slice(k);
      const danger = ['.exe', '.scr', '.bat', '.js', '.docm', '.xlsm'].includes(ext);
      html = `<p class="cmp-line"><code>${esc(r.mail.slice(0, k))}<i class="${danger ? 'bad' : 'good'}">${esc(ext)}</i></code></p><p class="verdict ${danger ? 'ng' : 'okv'}">${danger ? `いちばん右は ${esc(ext)}: 開くと動くファイル!` : `いちばん右は ${esc(ext)}: 書類`}</p>`;
    } else if (r.kind === 'rule') {
      html = `<p class="cmp-line rule-line">📒 ${esc(CLUES[r.clue].lines[r.ref])}</p>`;
    } else {
      const d = diffHTML(r.mail, r.ref);
      html = `<p class="cmp-line"><span>届いた</span><code>${d.a}</code></p><p class="cmp-line"><span>手帳</span><code>${d.b}</code></p><p class="verdict ${d.same ? 'okv' : 'ng'}">${d.same ? '一致' : 'ちがう!'}</p>`;
    }
    out.innerHTML = html;
    out.hidden = false;
    e.currentTarget.classList.add('done');
    r.seen = true;
    sfx.open();
  });
  let iocUsed = 0;
  let iocLeft = ioc;
  on('[data-act=ioc]', (e) => {
    // 集めた痕跡から、まだ印を付けていない「本当に怪しいところ」を1つ光らせる
    const btns = [...overlay.querySelectorAll('.mock .cand')].filter((b) => cx.list[+b.dataset.c]?.ev && !b.classList.contains('hinted') && !cx.flags.has(+b.dataset.c));
    const b = btns[Math.floor(Math.random() * btns.length)];
    iocUsed++;
    iocLeft -= 3;
    if (b) {
      b.classList.add('hinted');
      sfx.open();
    } else e.currentTarget.textContent = '🔎 もう怪しいところはない';
    if (iocLeft < 3 || !b) e.currentTarget.disabled = true;
    else e.currentTarget.textContent = `🔎 痕跡を使う(のこり ${iocLeft})`;
  });
  on('[data-act=inspect]', (e) => {
    overlay.querySelector('.inspect-out').hidden = false;
    e.currentTarget.disabled = true;
  });
  const press = (i) => {
    const b = buttons[i];
    if (!b || finished) return;
    if (b.kind === 'dial') return openDialer();
    if (b.kind === 'group') {
      const list = groups[b.key];
      const pick = list.find((e) => (e.act.when === 'compared' ? compared() : e.act.when === 'not' ? !compared() : true)) || list[0];
      return choose(pick.c);
    }
    choose(b.entry.c);
  };
  on('[data-btn]', (e) => press(+e.currentTarget.dataset.btn));
  setKeys((e) => {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= buttons.length) press(n - 1);
  });

  // ダイヤル画面: どの番号にかけるかを、自分の指で選ぶ
  function openDialer() {
    const el = overlay.querySelector('.dialer');
    const order = calls.map((_, i) => i).sort(() => Math.random() - 0.5);
    const opts = order.map((i) => calls[i]).map((e, k) => `<button class="dial-opt" data-dial="${order[k]}"><span>${e.act.via === 'book' ? '📒' : '✉️'}</span><code>${esc(e.act.dial)}</code></button>`).join('');
    el.innerHTML = `<div class="dial-box"><p class="dial-head">📞 どこにかける?</p>${opts}${calls.some((e) => e.act.via === 'book') ? '' : '<p class="fine">手帳に番号がない……</p>'}<button class="ghost" data-dial="x">やめる</button></div>`;
    el.hidden = false;
    el.querySelectorAll('[data-dial]').forEach((b) =>
      b.addEventListener('click', () => {
        const v = b.dataset.dial;
        if (v === 'x') {
          el.hidden = true;
          return;
        }
        const e = calls[+v];
        el.innerHTML = `<div class="dial-box calling"><p class="dial-head">📞</p><p><code>${esc(e.act.dial)}</code></p><p class="ringing">発信中…</p></div>`;
        sfx.tick();
        setTimeout(() => choose(e.c), 900);
      }),
    );
  }

  function choose(c) {
    if (finished) return;
    finished = true;
    setKeys(null);
    if (c.followup) {
      sfx.bad();
      followup(c);
    } else outcome(c, undefined);
  }

  // 引っかかったあと: すぐ報告するか(③ やったら報告)
  function followup(c) {
    show(
      `<div class="panel outcome fooled" role="dialog">
        ${fxHTML('fooled')}
        <p class="mark">×</p>
        <h2>${esc(c.title)}</h2>
        <p class="ask-again">……どうする?</p>
        <div class="acts two">
          <button class="act-btn" data-act="report" data-autofocus><kbd>1</kbd><span class="ic">🚨</span><span>すぐ報告</span></button>
          <button class="act-btn" data-act="hide"><kbd>2</kbd><span class="ic">🤐</span><span>黙っておく</span></button>
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

  // 起きたことを絵で見せる(引っかかったら、大事なものが飛んでいく)
  function fxHTML(t) {
    if (t === 'fooled' || t === 'close') {
      const icon = t === 'fooled' ? A.loss || '💸' : '⚠️';
      return `<div class="fx fly" aria-hidden="true">${Array.from({ length: 7 }, (_, i) => `<i style="--i:${i}">${icon}</i>`).join('')}</div>`;
    }
    return `<div class="fx pop" aria-hidden="true"><i>${FX[t] || '✅'}</i></div>`;
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
    const total = cx.list.filter((x) => x.ev).length;
    const found = cx.list.filter((x, i) => x.ev && cx.flags.has(i)).length;
    const falseN = cx.list.filter((x, i) => !x.ev && cx.flags.has(i)).length;
    const rv = { n: 0, flags: cx.flags, list: [] };
    const mailReview = mailHTML(sc.mock, 'review', rv);
    const inspectReview = sc.inspect ? cands(sc.inspect.text, rv, 'review') : '';
    const eye = total === 0 ? (falseN ? `疑いすぎ ${falseN}` : '本物を見送れた') : `見抜いた ${found}/${total}${falseN ? `・疑いすぎ ${falseN}` : ''}`;
    show(
      `<div class="panel outcome ${c.tier}" role="dialog">
        ${fxHTML(c.tier)}
        <p class="mark">${tier.mark}<small>${esc(tier.label)}</small></p>
        <h2>${esc(after ? after.title : c.title)}</h2>
        ${A.lesson ? `<p class="lesson">${esc(A.lesson)}</p>` : ''}
        <p class="effects">
          ${leak ? `<span class="leak">漏洩 +${leak}%</span>` : ''}
          ${c.delay ? `<span class="delay">遅れ +${c.delay}%</span>` : ''}
          ${falseN ? `<span class="delay">疑いすぎ +${falseN * 3}%</span>` : ''}
          <span class="eye-chip ${total && found === total && !falseN ? 'perfect' : ''}">🔍 ${esc(eye)}</span>
        </p>
        <details class="evidence"><summary>くわしく</summary>
          <p>${esc(fill(after ? `${c.text} ${after.text}` : c.text))}</p>
          <p class="rule">${esc(RULES[c.rule])}</p>
          ${mailReview}
          ${sc.inspect ? `<p class="detail">${inspectReview}</p>` : ''}
          ${sc.clues.filter((k) => clues[k]).map((k) => clueHTML(k, true)).join('')}
        </details>
        <button class="primary" data-act="ok" data-autofocus>つづける</button>
      </div>`,
      'is-dialog',
    );
    const ok = once(() =>
      done({ tier: c.tier, leak: c.leak || 0, delay: c.delay || 0, cause: c.cause, score: tier.score, report, found, total, falseN, flag: c.flag, iocUsed }),
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
export function showReview(sum, { day, cardImg, onCards, onRetry, onTitle, next, onNext, weapon }) {
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
      ${
        sum.sort
          ? `<p class="sortline">メール便の仕分け: 偽物を見抜いた <b>${sum.sort.caught}/${sum.sort.fakes}</b> ・ 本物を届けた <b>${sum.sort.delivered}/${sum.sort.reals}</b></p>`
          : ''
      }
      ${sum.eye ? `<p class="sortline">見抜き: 怪しいところを見抜いた <b>${sum.eye.found}/${sum.eye.total}</b> ・ 疑いすぎ <b>${sum.eye.falseN}</b></p>` : ''}
      ${sum.block && sum.block.kills + sum.block.intruded ? `<p class="sortline">ブロック率: <b>${Math.round((100 * sum.block.kills) / (sum.block.kills + sum.block.intruded))}%</b>(撃退 ${sum.block.kills} ・ 取り逃がし ${sum.block.intruded})</p>` : ''}
      ${sum.push ? `<p class="sortline">承認の通知: 身に覚えのない通知を拒否 <b>${sum.push.denied}</b> ・ うっかり承認 <b>${sum.push.approvedFake}</b></p>` : ''}
      ${sum.files ? `<p class="sortline">添付ファイル: 安全なファイルを開けた <b>${sum.files.safe}</b> ・ マルウェアを開けた <b>${sum.files.malware}</b></p>` : ''}
      ${sum.doors ? `<p class="sortline">URL の扉: 本物に入った <b>${sum.doors.right}</b> ・ 偽物に入った <b>${sum.doors.wrong}</b></p>` : ''}
      <p class="how">評価 ${sum.points}点 = 100 − 漏洩リスク(最大) − 業務の遅れ(最大)×0.7 + 最善の判断×2 + 見抜いたところ×2</p>
      <ul class="judges">${sum.judgments
        .map((j) => `<li class="${j.tier}"><span>${TIERS[j.tier].mark}</span>${esc(sceneName(j.id))}<em>${esc(TIERS[j.tier].label)}</em></li>`)
        .join('')}</ul>
      ${sum.badges.length ? `<div class="badges">${sum.badges.map((b) => `<span>🏅 ${esc(b)}</span>`).join('')}</div>` : ''}
      ${
        weapon
          ? `<div class="new-weapon" style="--wc:${weapon.color}"><p class="nw-head">新しい武器を手に入れた!</p><p class="nw-name"><b>${esc(weapon.short)}</b>${esc(weapon.name)}</p><p>${esc(weapon.desc)}</p><p class="fine">切り替え: ${ctx.touch() ? '画面右上の武器アイコンをタップ' : 'Q / E キー(右上の武器アイコンでも)'}</p></div>`
          : ''
      }
      <h3>手に入れた解説カード</h3>
      <ul class="mini-cards">${cards
        .map((c) => `<li><img src="${cardImg(c)}" alt="" width="32" height="32">${esc(c.name)}</li>`)
        .join('')}</ul>
      ${next ? `<p class="next">${esc(next.text)}</p>` : ''}
      <div class="actions">
        ${next ? `<button class="primary" data-act="next" data-autofocus>${esc(next.label)}</button>` : ''}
        <button ${next ? '' : 'class="primary" data-autofocus'} data-act="cards">カードを読む</button>
        <button data-act="retry">${esc(day)}をもう一度</button>
        <button data-act="title">タイトルへ</button>
      </div>
    </div>`,
    'is-dialog',
  );
  on('[data-act=cards]', onCards);
  on('[data-act=retry]', once(onRetry));
  on('[data-act=title]', once(onTitle));
  if (next) on('[data-act=next]', once(onNext));
}

// ---------------- エンディング(日曜のあと) ----------------
export function showEnding({ heroURL, owned, onCards, onTitle }) {
  setKeys(null);
  show(
    `<div class="panel ending" role="dialog" aria-label="エンディング">
      <img class="hero" src="${heroURL}" alt="" width="96" height="96">
      <h2>一週間、おつかれさまでした</h2>
      <p>${esc(fill('{name}とガードは、フィッシャーズから junia 商事を守り抜いた。'))}</p>
      <ul class="ending-list">
        <li><b>月</b>差出人とURLを、手元の本物と見比べる</li>
        <li><b>火</b>偉い人の名前でも、ルールを盾に断っていい</li>
        <li><b>水</b>ファイル名は、いちばん右まで読む</li>
        <li><b>木</b>電話はかけ直す。身に覚えのない承認は押さない</li>
        <li><b>金</b>アドレスが本物でも、振込先の変更は電話で確かめる</li>
        <li><b>土</b>切り離して、電源は切らずに、すぐ報告</li>
        <li><b>日</b>迷ったら相談、やったら報告</li>
      </ul>
      <p class="fine">解説カード ${owned}/${CARDS.length} 枚。朝礼や注意喚起に、そのまま使ってください。</p>
      <div class="actions">
        <button class="primary" data-act="cards" data-autofocus>カードを読む</button>
        <button data-act="title">タイトルへ</button>
      </div>
    </div>`,
    'is-dialog',
  );
  on('[data-act=cards]', onCards);
  on('[data-act=title]', once(onTitle));
}

// ---------------- 承認の通知(木曜。プレイ中に画面の上に出る) ----------------
const pushEls = new Map();
export function showPush(ps, answer) {
  let box = $('#pushes');
  if (!box) {
    box = document.createElement('div');
    box.id = 'pushes';
    $('#stage-wrap').append(box);
  }
  const el = document.createElement('div');
  el.className = 'push';
  el.innerHTML = `<p class="push-app">📱 ${esc(ps.app)}</p>
    <p class="push-q">ログインを承認しますか?</p>
    <p class="push-where">${esc(ps.where)}</p>
    <div class="push-btns"><button type="button" data-a="no">拒否<kbd>N</kbd></button><button type="button" data-a="yes">承認<kbd>Y</kbd></button></div>
    <i class="push-life" style="animation-duration:${ps.life}s"></i>`;
  const go = (v) => answer(v);
  el.querySelector('[data-a=yes]').addEventListener('click', (e) => {
    e.stopPropagation();
    go(true);
  });
  el.querySelector('[data-a=no]').addEventListener('click', (e) => {
    e.stopPropagation();
    go(false);
  });
  // ボタンの上で指を置いても、ゲームのタッチ操作にならないように
  for (const t of ['pointerdown', 'touchstart']) el.addEventListener(t, (e) => e.stopPropagation(), { passive: true });
  box.append(el);
  pushEls.set(ps.id, { el, go });
}
export function hidePush(ps) {
  const it = pushEls.get(ps.id);
  if (!it) return;
  pushEls.delete(ps.id);
  it.el.classList.add('gone');
  setTimeout(() => it.el.remove(), 250);
}
export function clearPushes() {
  for (const it of pushEls.values()) it.el.remove();
  pushEls.clear();
}
// キーボード: Y 承認 / N 拒否(いちばん新しい通知に)
addEventListener('keydown', (e) => {
  if (!pushEls.size || !overlay.hidden) return;
  const last = [...pushEls.values()].pop();
  if (e.code === 'KeyY') last.go(true);
  if (e.code === 'KeyN') last.go(false);
});

// ---------------- URL の扉(日曜) ----------------
export function showDoor(dr, clues, done) {
  const fin = once(done);
  const bm = CLUES.bookmark.lines[1];
  show(
    `<div class="panel door-dlg" role="dialog" aria-label="URL の扉">
      <h2>この入口に入りますか?</h2>
      <p class="door-row"><span>扉の URL</span><code>${esc(dr.url)}</code></p>
      ${
        clues.bookmark
          ? `<p class="door-row ref"><span>手帳のブックマーク</span><code>${esc(bm)}</code></p>`
          : '<p class="door-row ref"><span>手帳</span><em>公式ブックマークを持っていない……</em></p>'
      }
      <p class="fine">1文字ずつ見比べよう。偽物に入ると、情報を盗まれて押し戻される。</p>
      <div class="actions">
        <button class="primary" data-act="enter" data-autofocus><kbd>1</kbd>入る</button>
        <button data-act="back"><kbd>2</kbd>やめる</button>
      </div>
    </div>`,
    'is-dialog',
  );
  on('[data-act=enter]', () => fin(true));
  on('[data-act=back]', () => fin(false));
  setKeys((e) => {
    if (e.key === '1') fin(true);
    if (e.key === '2' || e.code === 'Escape') fin(false);
  });
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
    const pending = c.sources.some((s) => !s.url || !s.checked);
    return `<article class="card">
      <header><img src="${cardImg(c)}" alt="" width="48" height="48"><div><p class="no">No.${i + 1}</p><h3>${esc(c.name)}</h3></div></header>
      <p>${esc(c.what)}</p>
      <h4>見抜くポイント</h4>
      <ul>${c.signs.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      <h4>自分でできる対策</h4>
      <p>${esc(c.action)}</p>
      <h4>やってしまったら</h4>
      <p>${esc(c.ifDone)}</p>
      <p class="src">出典: ${src}${pending ? '(内容の確認日は準備中)' : ''}</p>
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
