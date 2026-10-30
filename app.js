/* ============================================================
   VERBO - Motor do jogo | vanilla JS, puro
   Modos: classica | survival | categoria | show
   Persistencia: localStorage (verbo_v1)
   ============================================================ */
'use strict';

var $ = function (id) { return document.getElementById(id); };

/* ---------- ESTADO GLOBAL ---------- */
var G = {
  screen: 'scHome',
  mode: 'classic',
  cat: null,
  questions: [],
  order: [],
  index: 0,
  score: 0,
  lives: 3,
  maxLives: 3,
  streak: 0,
  bestStreak: 0,
  hits: 0,
  misses: 0,
  answered: 0,
  current: null,
  options: [],
  correctAt: 0,
  locked: false,
  timeLeft: 0,
  timeMax: 20,
  timer: null,
  fifty: true,
  skip: true,
  cards: true,
  showIdx: 0
};

/* ---------- ESCADA DO SHOW DA BÊNÇÃO ----------
   20 degraus. Checkpoints (garantidos) nos degraus 10 (500) e 15 (3.000).
   Topo: degrau 20 = 10.000 - mais garantido ainda quando conquistado. */
var LADDER = [
  1, 2, 5, 10, 20, 50, 75, 100, 250, 500,
  700, 1000, 1500, 2000, 3000,
  4000, 5000, 7000, 8000, 10000
];
var LADDER_CHECKPOINTS = [9, 14]; // indices (0-based) garantidos ao responder

function fmtBen(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function benValueAt(idx) { return LADDER[Math.max(0, Math.min(19, idx))]; }

/* ---------- PERSISTENCIA ---------- */
var STORE_KEY = 'verbo_v1';

function storeLoad() {
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultStore();
    var s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return defaultStore();
    return {
      best: s.best || { classic: 0, survival: 0, categoria: 0, show: 0 },
      games: s.games || 0,
      totalHits: s.totalHits || 0,
      totalMiss: s.totalMiss || 0,
      bestStreak: s.bestStreak || 0,
      sound: s.sound !== false,
      voz: s.voz !== false
    };
  } catch (e) {
    return defaultStore();
  }
}

function defaultStore() {
  return {
    best: { classic: 0, survival: 0, categoria: 0, show: 0 },
    games: 0, totalHits: 0, totalMiss: 0, bestStreak: 0, sound: true, voz: true
  };
}

function storeSave() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* sem storage */ }
}

var S = storeLoad();

/* ---------- AUDIO (WebAudio, sem arquivos) ---------- */
var AC = null;

function beep(freq, dur, type, gain) {
  if (!S.sound) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    var o = AC.createOscillator();
    var g = AC.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain || 0.08, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
    o.connect(g); g.connect(AC.destination);
    o.start();
    o.stop(AC.currentTime + dur);
  } catch (e) { /* audio bloqueado */ }
}

function sfxOk() { beep(660, 0.12); setTimeout(function () { beep(880, 0.18); }, 110); }
function sfxBad() { beep(220, 0.25, 'sawtooth', 0.06); }
function sfxTick() { beep(950, 0.05, 'square', 0.03); }
function sfxClick() { beep(420, 0.06, 'triangle', 0.05); }
function sfxTime() { beep(180, 0.3, 'sawtooth', 0.07); }

/* ---------- Sons cinematograficos do Show (WebAudio sintetico) ---------- */
var NOISE = null;

function ctxIfOn() {
  if (!S.sound) return null;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    return AC;
  } catch (e) { return null; }
}

/* Buffer de ruido branco (2s) para plateia/sussurros */
function noiseBuf(ctx) {
  if (NOISE && NOISE.ctx === ctx) return NOISE.buf;
  var len = ctx.sampleRate * 2;
  var buf = ctx.createBuffer(1, len, ctx.sampleRate);
  var data = buf.getChannelData(0);
  for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  NOISE = { ctx: ctx, buf: buf };
  return buf;
}

/* Aplausos: rajadas de ruido com filtro passa-banda (micro-estalos aleatorios) */
function sfxCrowd(big) {
  var ctx = ctxIfOn();
  if (!ctx) return;
  try {
    var dur = big ? 2.2 : 1.2;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf(ctx);
    var band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1100;
    band.Q.value = 0.7;
    var g = ctx.createGain();
    var t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(big ? 0.18 : 0.09, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(band); band.connect(g); g.connect(ctx.destination);
    src.start(t);
    src.stop(t + dur);
    // micro-estalos de palmas por cima
    var claps = big ? 14 : 7;
    for (var i = 0; i < claps; i++) {
      (function () {
        var at = t + Math.random() * dur * 0.85;
        var c = ctx.createBufferSource();
        c.buffer = noiseBuf(ctx);
        var bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1600 + Math.random() * 900;
        bp.Q.value = 6;
        var cg = ctx.createGain();
        cg.gain.setValueAtTime(0.14, at);
        cg.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
        c.connect(bp); bp.connect(cg); cg.connect(ctx.destination);
        c.start(at);
        c.stop(at + 0.07);
      })();
    }
  } catch (e) { /* audio bloqueado */ }
}

/* Suspense: drone grave pulsante (dois osciladores desafinados) */
function sfxSuspense() {
  var ctx = ctxIfOn();
  if (!ctx) return;
  try {
    var t = ctx.currentTime;
    var dur = 2.4;
    [55, 58.2].forEach(function (f, k) {
      var o = ctx.createOscillator();
      o.type = k === 0 ? 'sawtooth' : 'triangle';
      o.frequency.value = f;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 260;
      o.connect(lp); lp.connect(g); g.connect(ctx.destination);
      o.start(t);
      o.stop(t + dur);
    });
  } catch (e) { /* audio bloqueado */ }
}

/* Coracao batendo (degraus medianos): dois thumps graves */
function sfxHeartbeat() {
  var ctx = ctxIfOn();
  if (!ctx) return;
  try {
    var t = ctx.currentTime;
    [0, 0.28].forEach(function (off) {
      var o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(64, t + off);
      o.frequency.exponentialRampToValueAtTime(38, t + off + 0.12);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.16, t + off);
      g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.13);
      o.connect(g); g.connect(ctx.destination);
      o.start(t + off);
      o.stop(t + off + 0.14);
    });
  } catch (e) { /* audio bloqueado */ }
}

/* Fanfarra: 3 notas ascendentes + brilho (checkpoints e vitoria) */
function sfxFanfare() {
  var ctx = ctxIfOn();
  if (!ctx) return;
  try {
    var t = ctx.currentTime;
    var notes = [523, 659, 784];
    if (G && G.showIdx === 19) notes = [523, 659, 784, 1047];
    notes.forEach(function (f, i) {
      var at = t + i * 0.16;
      var o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.001, at);
      g.gain.setValueAtTime(0.09, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
      o.connect(g); g.connect(ctx.destination);
      o.start(at);
      o.stop(at + 0.36);
    });
  } catch (e) { /* audio bloqueado */ }
}

/* ---------- NAVEGACAO ---------- */
function go(screen) {
  var screens = document.querySelectorAll('.screen');
  screen = screen || 'scHome';
  for (var i = 0; i < screens.length; i++) screens[i].classList.remove('on');
  $(screen).classList.add('on');
  G.screen = screen;
  window.scrollTo(0, 0);
}

function refreshHome() {
  var maxBest = Math.max(S.best.classic, S.best.survival, S.best.categoria, S.best.show || 0);
  $('homeRec').textContent = fmtBen(maxBest);
  $('homeGames').textContent = S.games;
  $('homeStreak').textContent = S.bestStreak;
  $('recClassic').textContent = S.best.classic ? 'rec ' + S.best.classic : '';
  $('recSurv').textContent = S.best.survival ? 'rec ' + S.best.survival : '';
  $('recCat').textContent = S.best.categoria ? 'rec ' + S.best.categoria : '';
  $('recShow').textContent = S.best.show ? ('rec ' + fmtBen(S.best.show)) : '';
  var p = VERSES[Math.floor(Math.random() * VERSES.length)];
  $('homeVerse').innerHTML = '\u202A' + p.t + '\u202C';
  $('homeVerseRef').textContent = p.v.toUpperCase();
}

function toggleSound() {
  S.sound = !S.sound;
  $('soundBtn').classList.toggle('off', !S.sound);
  storeSave();
  if (S.sound) sfxClick();
}

function toggleVoz() {
  S.voz = !S.voz;
  if (typeof Voz !== 'undefined') Voz.setAtivo(S.voz);
  $('voiceBtn').classList.toggle('off', !S.voz);
  storeSave();
  if (S.voz && typeof Voz !== 'undefined') Voz.falar('Voz do narrador ativada.');
}

/* ---------- UTIL ---------- */
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function diffLabel(d) { return d === 1 ? 'FÁCIL' : (d === 2 ? 'MÉDIA' : 'DIFÍCIL'); }

/* linha larga: >= 980px ativa o layout de computador/TV (escada lateral) */
function isWide() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 980px)').matches;
}

/* Monta a lista de perguntas do modo escolhido.
   A resposta correta no banco e sempre a opcao 0 (guardo a resposta real),
   e no fim as opcoes sao embaralhadas para exibicao. */
function buildDeck() {
  var pool = QUESTIONS.slice();
  if (G.mode === 'categoria' && G.cat) {
    pool = QUESTIONS.filter(function (q) { return q.c === G.cat; });
  }
  if (G.mode === 'classic') {
    // dificuldade progressiva: 3 faceis, 4 medias, 3 uteis
    var easy = pool.filter(function (q) { return q.d === 1; });
    var med = pool.filter(function (q) { return q.d === 2; });
    var hard = pool.filter(function (q) { return q.d === 3; });
    return shuffle(shuffle(easy).slice(0, 3)
      .concat(shuffle(med).slice(0, 4))
      .concat(shuffle(hard).slice(0, 3)));
  }
  return shuffle(pool);
}

function timeMaxFor(q) {
  return q.d === 1 ? 18 : (q.d === 2 ? 22 : 26);
}

function pointsFor(q) {
  var base = q.d === 1 ? 100 : (q.d === 2 ? 150 : 220);
  var timeBonus = Math.round((G.timeLeft / G.timeMax) * 60);
  var streakBonus = Math.min(G.streak, 8) * 15;
  return base + (q.d >= 2 ? timeBonus : Math.round(timeBonus / 2)) + streakBonus;
}

/* ---------- SHOW DA BÊNÇÃO ---------- */
/* Deck de 20 perguntas em dificuldade progressiva: 8 faceis, 7 medias, 5 dificeis */
function buildShowDeck() {
  var pool = QUESTIONS.slice();
  var easy = pool.filter(function (q) { return q.d === 1; });
  var med = pool.filter(function (q) { return q.d === 2; });
  var hard = pool.filter(function (q) { return q.d === 3; });
  var deck = shuffle(easy).slice(0, 8)
    .concat(shuffle(med).slice(0, 7))
    .concat(shuffle(hard).slice(0, 5));
  return deck;
}

function startShow() {
  G.mode = 'show';
  G.cat = null;
  G.questions = buildShowDeck();
  if (G.questions.length < 20) return;
  G.index = 0;
  G.showIdx = 0;
  G.score = 0;
  G.maxLives = 3;
  G.lives = 3;
  G.streak = 0;
  G.bestStreak = 0;
  G.hits = 0;
  G.misses = 0;
  G.answered = 0;
  G.fifty = true;
  G.skip = true;
  G.cards = true;
  G.timer = null;
  prepareHudForMode();
  showQuestion();
  go('scGame');
}

/* Ativa visibilidade dos elementos por modo (chama antes de go('scGame')) */
function prepareHudForMode() {
  var isShow = G.mode === 'show';
  $('showLadderBtn').classList.toggle('hidden', !isShow);
  $('toolCards').classList.toggle('hidden', !isShow);
  var tbar = $('timerfill').parentElement;
  tbar.classList.toggle('hidden', isShow);
  $('ladderSide').classList.toggle('hidden', !isShow || !isWide());
}

/* ---------- MOTOR DA PARTIDA ---------- */
function startGame(mode, cat) {
  G.mode = mode;
  G.cat = cat || null;
  G.questions = buildDeck();
  if (!G.questions.length) return;
  G.index = 0;
  G.score = 0;
  G.maxLives = (mode === 'survival') ? 1 : 3;
  G.lives = G.maxLives;
  G.streak = 0;
  G.bestStreak = 0;
  G.hits = 0;
  G.misses = 0;
  G.answered = 0;
  G.fifty = true;
  G.skip = true;
  G.cards = true;
  G.showIdx = 0;
  G.timer = null;
  prepareHudForMode();
  showQuestion();
  go('scGame');
}

function totalQuestions() {
  return G.mode === 'classic' ? Math.min(10, G.questions.length) : G.questions.length;
}

function showQuestion() {
  if (G.mode === 'classic' && G.index >= 10) return endGame(false);
  var q = G.questions[G.index];
  if (!q) {
    if (G.mode === 'show') return endShow(false);
    return endGame(false);
  }
  G.current = q;
  G.locked = false;

  var isShow = G.mode === 'show';
  if (isShow) {
    G.timeMax = 1;
    G.timeLeft = 1;
    if (isWide()) renderLadder();
  } else {
    G.timeMax = timeMaxFor(q);
  }
  G.timeLeft = G.timeMax;

  // embaralha opcoes mantendo a referencia da correta
  var texts = shuffle(q.o);
  G.options = texts;
  G.correctAt = texts.indexOf(q.o[0]);

  $('qCat').textContent = isShow
    ? ('DEGRAU ' + (G.showIdx + 1) + ' DE 20')
    : q.c.toUpperCase();
  $('qDiff').textContent = isShow
    ? (fmtBen(LADDER[G.showIdx]) + ' BÊNÇÕES')
    : diffLabel(q.d);
  var st = $('qStreak');
  if (G.streak >= 2) {
    st.style.display = '';
    st.textContent = 'SEQ x' + G.streak;
  } else {
    st.style.display = 'none';
  }
  $('qText').textContent = q.q;
  renderLives();
  renderHud();
  if (typeof Voz !== 'undefined') Voz.falar(q.q);

  $('fb').className = 'fb';
  $('nextBtn').classList.add('hidden');
  $('tool50').disabled = !G.fifty;
  $('toolSkip').disabled = G.lives <= 0 || !G.skip;
  $('toolCards').disabled = !G.cards;

  var box = $('opts');
  box.innerHTML = '';
  var keys = ['A', 'B', 'C', 'D'];
  for (var i = 0; i < 4; i++) {
    var b = document.createElement('button');
    b.className = 'opt';
    b.setAttribute('data-i', String(i));
    b.innerHTML = '<span class="key">' + keys[i] + '</span><span class="tx"></span>';
    b.querySelector('.tx').textContent = texts[i];
    b.addEventListener('click', onAnswer);
    box.appendChild(b);
  }

  if (!isShow) {
    runTimer();
  } else if (G.showIdx >= 15) {
    sfxSuspense();
  } else if (G.showIdx >= 10) {
    sfxHeartbeat();
  }
}

/* ---------- TIMER ---------- */
function runTimer() {
  stopTimer();
  updateTimerUI();
  G.timer = setInterval(function () {
    G.timeLeft -= 1;
    updateTimerUI();
    if (G.timeLeft === 5 && !G.locked) sfxTick();
    if (G.timeLeft <= 0) {
      stopTimer();
      timeOut();
    }
  }, 1000);
}

function stopTimer() {
  if (G.timer) { clearInterval(G.timer); G.timer = null; }
}

function updateTimerUI() {
  var pct = Math.max(0, (G.timeLeft / G.timeMax) * 100);
  $('timerfill').style.width = pct + '%';
  var bar = $('timerfill').parentElement;
  bar.className = 'timerbar' + (pct <= 25 ? ' low' : '');
}

function timeOut() {
  if (G.locked) return;
  G.locked = true;
  stopTimer();
  if (G.mode === 'show') {
    // no show nao ha tempo esgotado; este caminho nao deve ocorrer
    return;
  }
  sfxTime();
  handleWrong(null, true);
}

/* ---------- RESPOSTA ---------- */
function onAnswer(ev) {
  if (G.locked) return;
  G.locked = true;
  stopTimer();
  var btn = ev.currentTarget;
  var pick = parseInt(btn.getAttribute('data-i'), 10);

  var all = document.querySelectorAll('#opts .opt');
  for (var i = 0; i < all.length; i++) all[i].classList.add('lock');

  if (G.mode === 'show') {
    showAnswerFlow(btn, pick, all);
    return;
  }

  if (pick === G.correctAt) {
    btn.classList.add('ok');
    G.answered++;
    G.hits++;
    G.streak++;
    if (G.streak > G.bestStreak) G.bestStreak = G.streak;
    var pts = pointsFor(G.current);
    G.score += pts;
    sfxOk();
    feedback(true, pts);
    afterAnswer();
  } else {
    btn.classList.add('bad', 'shake');
    document.querySelectorAll('#opts .opt')[G.correctAt].classList.add('ok');
    sfxBad();
    handleWrong(btn, false);
  }
  renderHud();
}

/* Fluxo de resposta do SHOW DA BÊNÇÃO */
function showAnswerFlow(btn, pick, all) {
  if (pick === G.correctAt) {
    btn.classList.add('ok');
    G.answered++;
    G.hits++;
    G.streak++;
    if (G.streak > G.bestStreak) G.bestStreak = G.streak;
    var val = LADDER[G.showIdx];
    G.score = val;
    var isMilestone = LADDER_CHECKPOINTS.indexOf(G.showIdx) >= 0 || G.showIdx === 19;
    sfxOk();
    if (isMilestone) {
      // fanfarra nos patamares e no topo
      setTimeout(function () { sfxFanfare(); }, 260);
      setTimeout(function () { sfxCrowd(true); }, 520);
    }
    feedbackShow(true, val);
    afterShowAnswer(false);
  } else {
    btn.classList.add('bad', 'shake');
    all[G.correctAt].classList.add('ok');
    sfxBad();
    G.answered++;
    G.misses++;
    G.streak = 0;
    feedbackShow(false, 0, false);
    afterShowAnswer(true);
  }
}

function feedbackShow(good, val) {
  var q = G.current;
  var fb = $('fb');
  fb.className = 'fb on ' + (good ? 'good' : 'wrong');
  if (good) {
    $('fbHead').textContent = 'CERTO! + ' + fmtBen(val) + ' BÊNÇÕES';
  } else {
    $('fbHead').textContent = 'ERRADO - A ESCADA TERMINA AQUI';
  }
  $('fbText').textContent = q.e;
  $('fbVerse').textContent = q.v ? ('REFERENCIA: ' + q.v) : '';
  if (typeof Voz !== 'undefined') {
    Voz.falar($('fbHead').textContent + '. ' + q.e);
  }
}

function afterShowAnswer(wrong) {
  if (wrong) {
    G.nextAction = 'lostShow';
    $('nextBtn').textContent = 'VER O QUE GARANTIU';
  } else if (G.showIdx >= 19) {
    G.nextAction = 'winShow';
    $('nextBtn').textContent = 'RECEBER AS BÊNÇÕES';
  } else {
    G.nextAction = 'nextShow';
    $('nextBtn').textContent = 'SUBIR O DEGRAU';
  }
  renderHud();
  setTimeout(function () { $('nextBtn').classList.remove('hidden'); }, 350);
}

/* Valor garantido ao cair da escada na pergunta idx (0-based, a pergunta que errou):
   se errou a 16a..20a (idx 15..19) carrega o checkpoint do degrau 15 (3.000);
   se errou a 11a..15a (idx 10..14) carrega o checkpoint do degrau 10 (500);
   abaixo disso, nada garantido. */
function guaranteedShowValue(idx) {
  if (idx >= 15) return LADDER[14];
  if (idx >= 10) return LADDER[9];
  return 0;
}

function endShow(win) {
  stopTimer();
  var finalVal;
  if (win) {
    finalVal = LADDER[19];
  } else {
    finalVal = guaranteedShowValue(G.showIdx);
  }
  var isRecord = finalVal > (S.best.show || 0);
  if (isRecord) S.best.show = finalVal;
  S.games++;
  S.totalHits += G.hits;
  S.totalMiss += G.misses;
  if (G.bestStreak > S.bestStreak) S.bestStreak = G.bestStreak;
  storeSave();

  var total = G.hits + G.misses;
  var acc = total ? Math.round((G.hits / total) * 100) : 0;
  $('endMedal').textContent = win ? 'D' : 'B';
  $('endMedal').style.fontSize = win ? '30px' : '32px';
  $('endTitle').textContent = win ? 'SHOW DA BÊNÇÃO COMPLETO!' : 'A ESCADA TERMINOU';
  $('endSub').textContent = win
    ? ('Você conquistou 10.000 Bênções! ' + acc + '% de acerto.')
    : (finalVal > 0
      ? ('Levou garantido: ' + fmtBen(finalVal) + ' Bênções (' + acc + '% de acerto).')
      : ('Sem patamar garantido desta vez (' + acc + '% de acerto).'));
  $('endScore').textContent = fmtBen(finalVal);
  $('endScoreLabel').textContent = 'BÊNÇÕES';
  $('endHits').textContent = G.hits + (total ? '/' + total : '');
  $('endStreak').textContent = G.bestStreak;
  $('endBest').textContent = fmtBen(S.best.show || 0);
  $('newRec').classList.toggle('hidden', !isRecord);
  if (win) {
    sfxFanfare();
    setTimeout(function () { sfxCrowd(true); }, 300);
  } else if (isRecord) {
    sfxOk();
  }
  go('scEnd');
}

function handleWrong(btn, timeout) {
  G.answered++;
  G.misses++;
  G.streak = 0;
  G.lives -= 1;
  updateLives();
  feedback(false, 0, timeout);
  renderHud();
  afterAnswer();
}

function afterAnswer() {
  var dead = G.lives <= 0;
  var last = (G.mode === 'classic') && (G.index >= totalQuestions() - 1);
  var noMore = (G.mode !== 'classic') && (G.index >= G.questions.length - 1);
  $('nextBtn').textContent = (dead || last || noMore) ? 'VER RESULTADO' : 'CONTINUAR';
  G.nextAction = (dead || last || noMore) ? 'end' : 'next';
  setTimeout(function () { $('nextBtn').classList.remove('hidden'); }, 350);
}

/* ---------- FEEDBACK ---------- */
function feedback(good, pts, timeout) {
  var q = G.current;
  var fb = $('fb');
  fb.className = 'fb on ' + (good ? 'good' : 'wrong');
  if (good) {
    $('fbHead').textContent = 'CERTO! +' + pts;
  } else {
    $('fbHead').textContent = timeout ? 'TEMPO ESGOTADO' : 'ERRADO';
  }
  $('fbText').textContent = q.e;
  $('fbVerse').textContent = q.v ? ('REFERENCIA: ' + q.v) : '';
  if (typeof Voz !== 'undefined') {
    Voz.falar($('fbHead').textContent + '. ' + q.e);
  }
}

/* ---------- RECORDES ---------- */
function storeKeyFor(mode) {
  return mode === 'survival' ? 'survival' : (mode === 'categoria' ? 'categoria' : 'classic');
}

function endGame() {
  stopTimer();
  var keyStore = storeKeyFor(G.mode);
  var isRecord = G.score > (S.best[keyStore] || 0);
  if (isRecord) S.best[keyStore] = G.score;
  S.games++;
  S.totalHits += G.hits;
  S.totalMiss += G.misses;
  if (G.bestStreak > S.bestStreak) S.bestStreak = G.bestStreak;
  storeSave();

  var total = G.hits + G.misses;
  var acc = total ? Math.round((G.hits / total) * 100) : 0;
  var head, sub;
  if (acc >= 90 && G.score >= 1500) {
    head = 'A'; sub = 'Notável! Você conhece as Escrituras em detalhes.';
  } else if (acc >= 70 || G.score >= 1000) {
    head = 'B'; sub = 'Muito bem! Estudo constante gera sabedoria.';
  } else if (acc >= 50) {
    head = 'C'; sub = 'Boa base. Continue explorando a Palavra.';
  } else {
    head = '?'; sub = 'Todo estudante da Palavra já errou. Tente de novo!';
  }
  $('endMedal').textContent = head;
  $('endTitle').textContent = isRecord ? 'NOVO RECORDE' : 'PARTIDA CONCLUIDA';
  $('endSub').textContent = sub + ' (' + acc + '% de acerto)';
  $('endScore').textContent = fmtBen(G.score);
  $('endScoreLabel').textContent = 'PONTOS';
  $('endHits').textContent = G.hits + (total ? '/' + total : '');
  $('endStreak').textContent = G.bestStreak;
  $('endBest').textContent = fmtBen(S.best[keyStore] || 0);
  $('newRec').classList.toggle('hidden', !isRecord);
  if (isRecord) sfxOk();
  go('scEnd');
}

/* ---------- HUD ---------- */
function showLivesString() {
  var out = '';
  for (var i = 0; i < G.maxLives; i++) {
    out += i < G.lives ? '\u25CF' : '<span class="dead">\u25CB</span>';
  }
  return out;
}

function renderLives() { $('hudLives').innerHTML = showLivesString(); }

function updateLives() {
  var lives = $('hudLives');
  lives.innerHTML = showLivesString();
  if (G.mode === 'survival') {
    lives.innerHTML = '<span class="dead">\u25CB</span>';
  }
}

function renderHud() {
  var isShow = G.mode === 'show';
  $('hudScore').textContent = isShow ? fmtBen(LADDER[G.showIdx]) : G.score;
  $('hudMeta').textContent = isShow
    ? ('Nv ' + (G.showIdx + 1) + '/20')
    : (G.mode === 'survival'
      ? ('x' + G.answered + ' RESPONDIDAS')
      : ((Math.min(G.index + 1, totalQuestions())) + '/' + totalQuestions()));
  renderLives();
}

/* ---------- AJUDAS ---------- */
function useFifty() {
  if (!G.fifty || G.locked) return;
  G.fifty = false;
  $('tool50').disabled = true;
  var opts = document.querySelectorAll('#opts .opt');
  var wrong = [];
  for (var i = 0; i < opts.length; i++) if (i !== G.correctAt) wrong.push(i);
  shuffle(wrong).slice(0, 2).forEach(function (i) {
    opts[i].classList.add('dim', 'lock');
  });
  sfxClick();
}

function useCards() {
  if (!G.cards || G.locked) return;
  G.cards = false;
  $('toolCards').disabled = true;
  var opts = document.querySelectorAll('#opts .opt');
  var target;
  if (Math.random() < 0.5) {
    target = G.correctAt; // a carta aponta para a correta
  } else {
    var wrong = [];
    for (var i = 0; i < opts.length; i++) if (i !== G.correctAt && !opts[i].classList.contains('dim')) wrong.push(i);
    target = wrong[Math.floor(Math.random() * wrong.length)];
  }
  if (target === undefined) target = G.correctAt;
  var el = opts[target];
  el.classList.add('spotted');
  var key = el.querySelector('.key');
  key.textContent = '?';
  sfxOk();
}

function useSkip() {
  if (G.locked) {
    return;
  }
  stopTimer();
  sfxClick();
  if (G.mode === 'show') {
    // Pular no show consome uma das 3 chamadas, sem perder patamar
    G.lives -= 1;
    G.skip = G.lives > 0;
    $('toolSkip').disabled = !G.skip;
    G.index += 1;
    showQuestion();
    return;
  }
  if (!G.skip) return;
  G.skip = false;
  $('toolSkip').disabled = true;
  G.index += 1;
  showQuestion();
}

/* ---------- MODAL DA ESCADA ---------- */
function renderLadderList(list) {
  list.innerHTML = '';
  // do topo para a base: degrau 20 no topo
  for (var i19 = 19; i19 >= 0; i19--) {
    (function (idx) {
      var step = document.createElement('div');
      var isAt = idx === G.showIdx;
      var isCheck = LADDER_CHECKPOINTS.indexOf(idx) >= 0;
      var cls = 'lstep';
      if (idx === 19) cls += ' top';
      if (isCheck) cls += ' check';
      if (isAt) cls += ' at';
      if (idx < G.showIdx) cls += ' done';
      step.className = cls;
      var no = document.createElement('span');
      no.className = 'no';
      no.textContent = (isAt ? ('VOCÊ AQUI ' + isCheckText(idx)) : ('Nv ' + (idx + 1) + (isCheck ? ' SEGURANÇA' : '')));
      var val = document.createElement('span');
      val.className = 'val';
      val.textContent = fmtBen(LADDER[idx]) + ' Bênções';
      step.appendChild(no);
      step.appendChild(val);
      list.appendChild(step);
    })(i19);
  }
}

function renderLadder() {
  renderLadderList($('ladderList'));
  if ($('ladderListSide')) renderLadderList($('ladderListSide'));
}

function isCheckText(idx) {
  return LADDER_CHECKPOINTS.indexOf(idx) >= 0 ? ' (GARANTIDO)' : '';
}

function openLadder() {
  renderLadder();
  $('ladderModal').classList.add('open');
}

function closeLadder() {
  $('ladderModal').classList.remove('open');
}

function quitGame() {
  stopTimer();
  G.score = 0;
  closeLadder();
  go('scHome');
  refreshHome();
}

/* ---------- CATEGORIAS ---------- */
function renderCats() {
  var cats = {};
  QUESTIONS.forEach(function (q) {
    if (!cats[q.c]) cats[q.c] = { n: 0, easy: 0 };
    cats[q.c].n++;
    if (q.d === 1) cats[q.c].easy++;
  });
  var grid = $('catGrid');
  grid.innerHTML = '';
  Object.keys(cats).forEach(function (name) {
    var b = document.createElement('button');
    b.className = 'cat';
    b.innerHTML = name + '<small>' + cats[name].n + ' perguntas</small>';
    b.addEventListener('click', function () { startGame('categoria', name); });
    grid.appendChild(b);
  });
}

/* ---------- ESTATISTICAS ---------- */
function renderStats() {
  var total = S.totalHits + S.totalMiss;
  var acc = total ? Math.round((S.totalHits / total) * 100) : 0;
  var rows = [
    ['Partidas jogadas', String(S.games)],
    ['Acertos totais', String(S.totalHits)],
    ['Erros totais', String(S.totalMiss)],
    ['Precisão geral', acc + '%'],
    ['Maior sequência', String(S.bestStreak)],
    ['Recorde Clássica', String(S.best.classic)],
    ['Recorde Sobrevivência', String(S.best.survival)],
    ['Recorde Categoria', String(S.best.categoria)]
  ];
  var list = $('statList');
  list.innerHTML = '';
  rows.forEach(function (r) {
    var d = document.createElement('div');
    d.className = 'srow';
    d.innerHTML = '<span>' + r[0] + '</span><b></b>';
    d.querySelector('b').textContent = r[1];
    list.appendChild(d);
  });
}

/* ---------- EVENTOS / INIT ---------- */
function init() {
  document.querySelectorAll('[data-act]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var act = btn.getAttribute('data-act');
      sfxClick();
      if (act === 'home') { go('scHome'); refreshHome(); }
      if (act === 'classic') startGame('classic');
      if (act === 'show') startShow();
      if (act === 'survival') startGame('survival');
      if (act === 'cats') { renderCats(); go('scCats'); }
      if (act === 'stats') { renderStats(); go('scStats'); }
    });
  });

  $('brandBtn').addEventListener('click', function () {
    stopTimer();
    go('scHome');
    refreshHome();
  });
  $('soundBtn').addEventListener('click', toggleSound);
  $('soundBtn').classList.toggle('off', !S.sound);
  $('voiceBtn').addEventListener('click', toggleVoz);
  $('voiceBtn').classList.toggle('off', !S.voz);
  if (typeof Voz !== 'undefined') Voz.setAtivo(S.voz);

  $('nextBtn').addEventListener('click', function () {
    sfxClick();
    if (G.nextAction === 'end') {
      endGame();
    } else if (G.nextAction === 'nextShow') {
      G.index += 1;
      G.showIdx += 1;
      showQuestion();
    } else if (G.nextAction === 'lostShow') {
      endShow(false);
    } else if (G.nextAction === 'winShow') {
      endShow(true);
    } else {
      G.index += 1;
      showQuestion();
    }
  });
  $('againBtn').addEventListener('click', function () {
    sfxClick();
    if (G.mode === 'show') {
      startShow();
      return;
    }
    startGame(G.mode, G.cat);
  });
  $('clearBtn').addEventListener('click', function () {
    if (window.confirm('Apagar todos os recordes e estatisticas?')) {
      S = defaultStore();
      storeSave();
      refreshHome();
      renderStats();
    }
  });

  $('tool50').addEventListener('click', useFifty);
  $('toolSkip').addEventListener('click', useSkip);
  $('toolQuit').addEventListener('click', quitGame);
  $('toolCards').addEventListener('click', useCards);
  $('showLadderBtn').addEventListener('click', openLadder);
  $('ladderClose').addEventListener('click', closeLadder);
  $('ladderModal').addEventListener('click', function (ev) {
    if (ev.target === $('ladderModal')) closeLadder();
  });

  // teclado: 1-4 responde, Enter continua
  document.addEventListener('keydown', function (ev) {
    if (G.screen !== 'scGame') return;
    var k = ev.key;
    if (k === 'Enter') { $('nextBtn').click(); return; }
    var map = { '1': 0, '2': 1, '3': 2, '4': 3 };
    if (map[k] !== undefined) {
      var opts = document.querySelectorAll('#opts .opt');
      var b = opts[map[k]];
      if (b && !b.classList.contains('lock')) b.click();
    }
    if (k === 'f' || k === 'F') useFifty();
  });

  refreshHome();
}

init();

