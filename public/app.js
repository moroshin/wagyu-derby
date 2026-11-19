(function () {
  'use strict';
  const W = window.WagyuRace;
  const $ = (s) => document.querySelector(s);
  const RACE_NAMES = ['三河ステークス', 'サシ杯', 'A5記念', 'すき焼きカップ', '炭火グランプリ', 'しゃぶしゃぶ賞', '霜降りダービー', 'ハラミ特別'];

  // ---------- 保存（使えない環境でも動くように） ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* noop */ } },
  };

  const state = {
    round: store.get('wd_round', 1),
    players: store.get('wd_players', []),   // [{name, pick}]
    scores: store.get('wd_scores', {}),     // name -> pts
    conditions: null,
    odds: null,
    race: null,
    sound: store.get('wd_sound', true),
  };
  const save = () => {
    store.set('wd_round', state.round);
    store.set('wd_players', state.players);
    store.set('wd_scores', state.scores);
  };

  // ---------- サウンド ----------
  let ac = null;
  function audio() {
    if (!state.sound) return null;
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, dur, type, vol, when, slideTo) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + (when || 0);
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  const sfx = {
    beep: () => tone(660, 0.15, 'square', 0.07),
    go: () => tone(1320, 0.4, 'square', 0.08),
    moo: () => { tone(170, 0.7, 'sawtooth', 0.06, 0, 120); tone(172, 0.7, 'triangle', 0.05, 0, 118); },
    cheer: () => tone(880 + Math.random() * 200, 0.05, 'triangle', 0.03),
    fanfare: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i === 5 ? 0.6 : 0.16, 'square', 0.07, i * 0.15)),
  };
  function renderSound() { $('#soundBtn').textContent = state.sound ? '🔊' : '🔇'; }
  $('#soundBtn').addEventListener('click', () => { state.sound = !state.sound; store.set('wd_sound', state.sound); renderSound(); });

  // ---------- 画面切り替え ----------
  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- 予想画面 ----------
  function prepareRound() {
    state.conditions = W.rollConditions(Math.random);
    state.odds = W.estimateOdds(state.conditions, 300);
    $('#roundLabel').textContent = `第${state.round}レース`;
    $('#raceName').textContent = RACE_NAMES[(state.round - 1) % RACE_NAMES.length];
    renderCows();
    renderPlayers();
  }

  function renderCows() {
    $('#cowCards').innerHTML = W.COWS.map((c, i) => `
      <div class="cow-card ${c.star ? 'star' : ''}" style="--c:${c.color}">
        <div class="num">${i + 1}</div>
        <div class="brand">${esc(c.brand)} ${c.star ? '<span class="badge">推し牛</span>' : ''}</div>
        <div class="name">${esc(c.name)}</div>
        <div class="intro">${esc(c.intro)}</div>
        <div class="meta"><span class="odds">${state.odds[i].toFixed(1)}倍</span><span class="cond">調子：${state.conditions[i].label}</span></div>
      </div>`).join('');
  }

  function renderPlayers() {
    const list = $('#playerList');
    if (!state.players.length) {
      list.innerHTML = '<li class="hint">参加者なしでも観戦できます</li>';
      return;
    }
    list.innerHTML = state.players.map((p, pi) => `
      <li>
        <span class="pname">${esc(p.name)}</span>
        <span class="picks">${W.COWS.map((c, ci) =>
          `<button type="button" class="pick ${p.pick === ci ? 'on' : ''}" style="--c:${c.color}" data-p="${pi}" data-c="${ci}" title="${esc(c.brand)}">${ci + 1}</button>`).join('')}</span>
        <button type="button" class="del" data-del="${pi}" aria-label="削除">✕</button>
      </li>`).join('');
  }

  $('#playerList').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.del !== undefined) { state.players.splice(+b.dataset.del, 1); }
    else { state.players[+b.dataset.p].pick = +b.dataset.c; sfx.beep(); }
    save(); renderPlayers();
  });

  $('#addPlayer').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#playerName').value.trim();
    if (!name) return;
    if (state.players.some((p) => p.name === name)) { $('#playerName').select(); return; }
    state.players.push({ name, pick: null });
    $('#playerName').value = '';
    save(); renderPlayers();
  });

  $('#startBtn').addEventListener('click', () => {
    const missing = state.players.filter((p) => p.pick === null);
    if (missing.length && !confirm(`${missing.map((p) => p.name).join('、')} さんがまだ予想していません。このまま出走しますか？`)) return;
    startRace();
  });

  // ---------- レース ----------
  let laneEls = [];
  function buildTrack() {
    const track = $('#track');
    track.innerHTML = '<div class="goal"></div>' + W.COWS.map((c, i) => `
      <div class="lane" style="--c:${c.color}">
        <span class="lane-num">${i + 1}</span>
        <div class="runner"><span class="tag">${esc(c.brand)}</span><span class="fx"></span><span class="cow">🐄</span></div>
      </div>`).join('');
    laneEls = [...track.querySelectorAll('.runner')];

    const fans = (ci) => state.players.filter((p) => p.pick === ci).map((p) => p.name);
    $('#cheerBtns').innerHTML = W.COWS.map((c, i) => {
      const f = fans(i);
      return `<button class="cheer" style="--c:${c.color}" data-c="${i}">${i + 1} ${esc(c.brand)}<small>${f.length ? esc(f.join('・')) : 'がんばれ！'}</small></button>`;
    }).join('');
  }

  function cheer(ci, x, y) {
    if (!state.race || state.race.finished.length === W.COWS.length) return;
    const r = state.race.runners[ci];
    r.cheer = Math.min(1, r.cheer + 0.18);
    sfx.cheer();
    const f = document.createElement('div');
    f.className = 'floaty'; f.textContent = ['がんばれ！', 'いけー！', 'モー！', 'ファイト！'][Math.floor(Math.random() * 4)];
    f.style.left = (x - 30) + 'px'; f.style.top = (y - 20) + 'px';
    document.body.appendChild(f); setTimeout(() => f.remove(), 700);
  }
  $('#cheerBtns').addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.cheer'); if (!b) return;
    e.preventDefault();
    cheer(+b.dataset.c, e.clientX, e.clientY);
  });

  let lastComment = 0, lastLeader = -1, halfwaySaid = false, lastSpurtSaid = false;
  function say(text, force) {
    const now = performance.now();
    if (!force && now - lastComment < 1400) return;
    lastComment = now;
    $('#commentary').textContent = text;
  }
  const label = (r) => `${r.idx + 1}番 ${r.cow.brand}`;

  function commentEvents(events) {
    for (const ev of events) {
      const r = ev.r;
      if (ev.type === 'finish') {
        if (ev.place === 1) { say(`ゴーーール！！ 1着は ${label(r)} 「${r.cow.name}」！${r.cow.star ? ' さすがみかわ牛！！' : ''}`, true); sfx.fanfare(); }
        continue;
      }
      if (ev.type === 'grass') say(`おっと ${label(r)}、道草を食べ始めたーっ！🌱`);
      if (ev.type === 'dash') say(`${label(r)} が猛ダッシュ！！🔥${r.cow.star ? ' 三河魂だ！' : ''}`);
      if (ev.type === 'moo') { say(`${label(r)}「モォ〜〜〜！」🐮`); sfx.moo(); }
    }
  }

  function render(race) {
    const rank = W.ranking(race);
    race.runners.forEach((r, i) => {
      const el = laneEls[i];
      const pct = r.pos / W.TRACK;
      el.style.left = `calc(30px + (100% - 80px) * ${pct.toFixed(4)})`;
      el.className = 'runner ' + (r.finishTime !== null ? '' : r.state === 'dash' ? 'running dash' : r.state === 'grass' ? 'grass' : 'running');
      el.querySelector('.fx').textContent = r.state === 'dash' ? '💨' : r.state === 'grass' ? '🌱' : r.state === 'moo' ? '💬' : '';
      const place = rank.indexOf(r) + 1;
      el.querySelector('.tag').textContent = r.finishTime !== null ? `${place}着` : r.cow.brand;
    });

    const leader = rank[0];
    if (race.finished.length) return;
    const lp = leader.pos / W.TRACK;
    if (!halfwaySaid && lp > 0.5) { halfwaySaid = true; say(`半分を通過！先頭は ${label(leader)}、2番手 ${label(rank[1])}！`, true); }
    else if (!lastSpurtSaid && lp > 0.8) { lastSpurtSaid = true; say(`最後の直線！ ${label(leader)} 逃げ切れるか！？ ${label(rank[1])} が迫る！`, true); }
    else if (leader.idx !== lastLeader && race.t > 2) { say(`先頭が入れ替わった！ ${label(leader)} がトップに！`); }
    lastLeader = leader.idx;
  }

  function startRace() {
    buildTrack();
    show('screenRace');
    state.race = W.createRace(state.conditions, Math.random);
    lastLeader = -1; halfwaySaid = false; lastSpurtSaid = false; lastComment = 0;
    render(state.race);
    say('各牛、ゲートに入りました…', true);

    const cd = $('#countdown');
    let n = 3;
    const tick = () => {
      cd.classList.remove('show'); void cd.offsetWidth;
      if (n > 0) { cd.textContent = n; cd.classList.add('show'); sfx.beep(); n--; setTimeout(tick, 800); }
      else { cd.textContent = 'GO!'; cd.classList.add('show'); sfx.go(); setTimeout(() => cd.classList.remove('show'), 600); say('スタートしました！！', true); run(); }
    };
    tick();
  }

  function run() {
    const race = state.race;
    const dt = 1 / 60;
    let acc = 0, last = performance.now(), doneAt = null;
    function frame(now) {
      acc += Math.min(0.1, (now - last) / 1000); last = now;
      while (acc >= dt) {
        acc -= dt;
        if (race.finished.length < W.COWS.length) commentEvents(W.step(race, dt, Math.random));
      }
      render(race);
      if (race.finished.length === W.COWS.length) {
        if (doneAt === null) doneAt = now;
        if (now - doneAt > 1500) return showResult();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ---------- 結果 ----------
  function showResult() {
    const race = state.race;
    const fin = race.finished;
    const win = fin[0];
    const odds = state.odds[win.idx];

    const banner = $('#winnerBanner');
    banner.style.setProperty('--c', win.cow.color);
    banner.innerHTML = `
      <div class="big-cow">🐄</div>
      <div class="w1">第${state.round}レース 優勝</div>
      <div class="w2">${win.idx + 1}番 ${esc(win.cow.brand)}「${esc(win.cow.name)}」</div>
      <div class="w3">${win.cow.star ? 'やっぱり強い！みかわ牛！！🎉' : `大波乱！単勝 ${odds.toFixed(1)}倍！`}</div>`;

    $('#resultList').innerHTML = fin.map((r, i) => `
      <li style="--c:${r.cow.color}"><span class="place">${['🥇', '🥈', '🥉'][i] || (i + 1) + '着'}</span>
        <span>${r.idx + 1}番 <b>${esc(r.cow.brand)}</b> ${esc(r.cow.name)}</span>
        <span class="time">${r.finishTime.toFixed(2)}秒</span></li>`).join('');

    const payouts = state.players.map((p) => {
      const hit = p.pick === win.idx;
      const pts = hit ? Math.round(odds * 100) : 0;
      state.scores[p.name] = (state.scores[p.name] || 0) + pts;
      return { p, hit, pts };
    });
    $('#payoutList').innerHTML = payouts.length
      ? payouts.map(({ p, hit, pts }) => `<li class="${hit ? 'hit' : ''}">${esc(p.name)}：${p.pick === null ? '予想なし' : (p.pick + 1) + '番 ' + esc(W.COWS[p.pick].brand)} → ${hit ? `🎯 的中！ +${pts}pt` : 'はずれ'}</li>`).join('')
      : '<li class="hint">参加者なし（観戦モード）</li>';

    const myHits = payouts.filter((x) => x.hit).map((x) => x.p.name);
    lastResultText = `🐄 和牛ダービー 第${state.round}レースは ${win.idx + 1}番 ${win.cow.brand}「${win.cow.name}」が優勝！` +
      (win.cow.star ? 'やっぱりみかわ牛は強い！' : `単勝${odds.toFixed(1)}倍の波乱！`) +
      (myHits.length ? ` 的中：${myHits.join('・')}` : '') + ' #和牛ダービー';
    renderScoreboard();
    state.round++;
    save();
    show('screenResult');
    confetti(win.cow.color);
  }

  function renderScoreboard() {
    const rows = Object.entries(state.scores).sort((a, b) => b[1] - a[1]);
    $('#scoreboard').innerHTML = rows.length
      ? rows.map(([n, s]) => `<li>${esc(n)}<span class="pts">${s}pt</span></li>`).join('')
      : '<li class="hint">まだ記録がありません</li>';
  }

  function confetti(color) {
    const colors = [color, '#ffd400', '#ffffff', '#e60033', '#3f9b45'];
    for (let i = 0; i < 60; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = 1.8 + Math.random() * 1.6 + 's';
      c.style.animationDelay = Math.random() * 0.5 + 's';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 4200);
    }
  }

  $('#nextBtn').addEventListener('click', () => {
    state.players.forEach((p) => { p.pick = null; });
    save(); prepareRound(); show('screenBet');
  });
  $('#resetScores').addEventListener('click', () => {
    if (!confirm('通算ランキングをリセットしますか？')) return;
    state.scores = {}; state.round = 1; save(); renderScoreboard();
  });


  // ---------- 共有 ----------
  const shareUrl = () => location.protocol.startsWith('http') ? location.origin + location.pathname.replace(/index\.html$/, '') : 'https://github.com/moroshin/wagyu-derby';
  let lastResultText = '';
  const inviteText = () => '🐄 和牛ダービーで勝負しよう！みんなで予想して連打で応援するパーティーゲーム #和牛ダービー';
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('show'), 1800);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e2) { /* noop */ } ta.remove();
    }
    toast('リンクをコピーしました');
  }
  async function doShare(how, kind) {
    const url = shareUrl();
    const text = kind === 'result' && lastResultText ? lastResultText : inviteText();
    if (how === 'copy') return copy(kind === 'result' ? `${text}\n${url}` : url);
    if (how === 'line') return window.open('https://social-plugins.line.me/lineit/share?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text), '_blank', 'noopener');
    if (how === 'x') return window.open('https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url), '_blank', 'noopener');
    if (navigator.share) { try { await navigator.share({ title: '和牛ダービー', text, url }); } catch (e) { /* キャンセル */ } }
    else copy(`${text}\n${url}`);
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-share]'); if (!b) return;
    const box = b.closest('[data-kind]');
    doShare(b.dataset.share, box ? box.dataset.kind : 'invite');
  });
  $('#shareUrl').value = shareUrl();

  renderSound();
  prepareRound();
})();
