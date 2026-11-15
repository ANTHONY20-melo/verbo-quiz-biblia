/* ============================================================
   TÁ NA BÍBLIA OU TÁ AMARRADO? - Motor do jogo (vanilla JS)
   Persistência: localStorage (amarrado_v1) | 4 modos + apresentador
   ============================================================ */
'use strict';

var STORE_KEY = 'amarrado_v1';
var TEAM_COLORS = ['#3f6fd8', '#d84f4f', '#3fa864', '#d8b13f', '#9b59d0', '#d8813f', '#d86fa0', '#3fb8c4'];
var TEAM_DEFAULT = ['Azul', 'Vermelha', 'Verde', 'Amarela', 'Roxa', 'Laranja', 'Rosa', 'Ciano'];

/* ---------- Store ---------- */
function defaultStore() {
  return {
    sound: true,
    custom: [],
    best: { solo: 0, flash: 0, surv: 0, equipes: 0 },
    hist: [],
    teamCfg: { qtd: 20, time: 15, pts: 10, bonus: 5, rounds: 3, lvl: 0, names: TEAM_DEFAULT.slice() },
    progress: null
  };
}
var S = defaultStore();
function storeLoad() {
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      var p = JSON.parse(raw);
      for (var k in defaultStore()) if (!(k in p)) p[k] = defaultStore()[k];
      if (!p.best || typeof p.best !== 'object') p.best = defaultStore().best;
      if (!Array.isArray(p.custom)) p.custom = [];
      if (!Array.isArray(p.hist)) p.hist = [];
      if (!p.teamCfg || typeof p.teamCfg !== 'object') p.teamCfg = defaultStore().teamCfg;
      S = p;
    }
  } catch (e) { S = defaultStore(); }
}
function storeSave() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* quota */ }
}

/* ---------- Banco (originais + personalizados) ---------- */
function bankAll() { return QUESTIONS_ALL.concat(S.custom); }
function bankNextCustomId() {
  var n = 0;
  S.custom.forEach(function (q) {
    var m = /^C(\d+)$/.exec(q.id);
    if (m) n = Math.max(n, parseInt(m[1], 10));
  });
  return 'C' + (n + 1);
}

/* ---------- Utilidades ---------- */
function $(id) { return document.getElementById(id); }
function shuffle(a) {
  var r = a.slice(), i, j, t;
  for (i = r.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = r[i]; r[i] = r[j]; r[j] = t; }
  return r;
}
function esc(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function lvlName(l) { return l === 1 ? 'FÁCIL' : l === 2 ? 'MÉDIO' : 'DIFÍCIL'; }
function nowStr() {
  var d = new Date();
  function p(n) { return (n < 10 ? '0' : '') + n; }
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
function download(name, text, type) {
  var blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 500);
}

/* ---------- Sons (WebAudio) ---------- */
var AC = null;
function ac() {
  if (!AC) {
    var C = window.AudioContext || window.webkitAudioContext;
    if (C) AC = new C();
  }
  if (AC && AC.state === 'suspended') { try { AC.resume(); } catch (e) { /* ignore */ } }
  return AC;
}
function tone(f, t0, dur, type, gainV) {
  var a = ac(); if (!a || !S.sound) return;
  var o = a.createOscillator(), g = a.createGain();
  o.type = type || 'sine'; o.frequency.value = f;
  g.gain.setValueAtTime(gainV || 0.12, a.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + dur);
  o.connect(g); g.connect(a.destination);
  o.start(a.currentTime + t0); o.stop(a.currentTime + t0 + dur + 0.05);
}
function sfxOk() { tone(523, 0, .16); tone(659, .1, .18); tone(784, .2, .26); }
function sfxBad() { tone(196, 0, .28, 'sawtooth', .1); tone(147, .14, .34, 'sawtooth', .1); }
function sfxTick() { tone(880, 0, .05, 'square', .05); }
function sfxSus() { tone(98, 0, .8, 'sawtooth', .07); tone(73, .1, .8, 'sawtooth', .06); }
function sfxEnd() { tone(523, 0, .18); tone(659, .16, .18); tone(784, .32, .18); tone(1047, .48, .5); }
function sfxClick() { tone(660, 0, .05, 'triangle', .07); }

/* ---------- Telas ---------- */
var SCREENS = ['scHome', 'scHow', 'scBank', 'scRank', 'scTeams', 'scGame', 'scEnd'];
function show(id) {
  SCREENS.forEach(function (s) { $(s).classList.toggle('on', s === id); });
  window.scrollTo(0, 0);
}

/* ---------- Estado da partida ---------- */
var G = null;
var timerInt = null;

function newMatch(mode, cfg) {
  G = {
    mode: mode, idx: 0, hits: 0, misses: 0, score: 0, lvl: mode === 'surv' ? 1 : 2,
    times: [], pool: [], deck: [], turn: 0, teams: [], cfg: cfg || null,
    paused: false, startedAt: Date.now(), lastOk: null
  };
}

/* Sorteio adaptativo: escolhe da pool pelo nível desejado; senão o mais próximo */
function poolPick(lvl) {
  var byLvl = [1, 2, 3].map(function (l) {
    return G.pool.filter(function (q) { return q.lvl === l; });
  });
  var order = lvl === 1 ? [1, 2, 3] : lvl === 2 ? [2, 3, 1] : [3, 2, 1];
  var arr = null, want = lvl;
  for (var i = 0; i < order.length; i++) if (byLvl[order[i] - 1].length) { arr = byLvl[order[i] - 1]; want = order[i]; break; }
  if (!arr) return null;
  var q = arr[0];
  G.pool.splice(G.pool.indexOf(q), 1);
  G.lvl = want;
  return q;
}

function adaptiveDifficulty() {
  /* solo: sobe a cada 2 acertos seguidos, desce ao errar. surv: sobe a cada 5 acertos */
  if (G.mode === 'surv') return Math.min(3, 1 + Math.floor(G.hits / 5));
  return G.lvl;
}

/* ---------- Timer ---------- */
function startTimer(sec) {
  stopTimer();
  var end = Date.now() + sec * 1000, dur = sec * 1000, lastSec = -1;
  G.timerEnd = end; G.timerDur = dur;
  updateTimerUI();
  timerInt = setInterval(function () {
    if (G.paused) { G.timerEnd += 250; return; }
    var left = G.timerEnd - Date.now();
    updateTimerUI();
    var s = Math.ceil(left / 1000);
    if (s <= 3 && s !== lastSec && s > 0) { lastSec = s; sfxTick(); }
    if (left <= 0) { stopTimer(); onTimeout(); }
  }, 250);
}
function stopTimer() { if (timerInt) { clearInterval(timerInt); timerInt = null; } }
function updateTimerUI() {
  var left = Math.max(0, G.timerEnd - Date.now());
  var pct = Math.max(0, Math.min(100, (left / G.timerDur) * 100));
  $('timerFill').style.width = pct + '%';
  var s = Math.ceil(left / 1000);
  var t = $('gTagTimer');
  t.textContent = s + 's';
  t.classList.toggle('low', s <= 3 && pct > 0);
  $('timerBar').classList.toggle('low', s <= 3 && pct > 0);
}

/* ---------- Feedback ---------- */
function showFeedback(q, picked, revealOnly) {
  var fb = $('feedback');
  var head = $('fbHead');
  var ok = picked === q.resp;
  var cls = fb.classList; cls.add('on');
  var pg = $('perga');
  pg.classList.remove('shake', 'glowok', 'glowbad');
  if (picked === null || picked === undefined) {
    head.textContent = 'TEMPO ESGOTADO!';
    head.className = 'fbhead bad';
    pg.classList.add('glowbad');
    if (S.sound) sfxBad();
  } else if (revealOnly) {
    head.textContent = 'RESPOSTA REVELADA (sem pontuar)';
    head.className = 'fbhead';
  } else if (ok) {
    head.textContent = 'ACERTOU! ' + '+' + G.lastGain + ' PONTO' + (G.lastGain === 1 ? '' : 'S');
    head.className = 'fbhead ok';
    pg.classList.add('glowok');
    if (S.sound) sfxOk();
  } else {
    head.textContent = 'ERROU!';
    head.className = 'fbhead bad';
    pg.classList.add('shake', 'glowbad');
    if (S.sound) sfxBad();
  }
  var correctTxt = q.resp === 1 ? '📖 TÁ NA BÍBLIA' : '🔒 TÁ AMARRADO';
  $('fbRef').textContent = 'RESPOSTA CORRETA: ' + correctTxt + (q.ref ? '  ·  ' + q.ref.toUpperCase() : '');
  $('fbExp').textContent = q.exp;
  $('choiceBook').classList.toggle('reveal-ok', q.resp === 1);
  $('choiceLock').classList.toggle('reveal-ok', q.resp === 0);
  if (picked !== null && picked !== undefined && !revealOnly) {
    $('choiceBook').classList.toggle('reveal-bad', picked === 1 && !ok);
    $('choiceLock').classList.toggle('reveal-bad', picked === 0 && !ok);
  }
  $('choiceBook').disabled = true;
  $('choiceLock').disabled = true;
}

function hideFeedback() {
  $('feedback').classList.remove('on');
  $('perga').classList.remove('shake', 'glowok', 'glowbad');
  $('choiceBook').classList.remove('reveal-ok', 'reveal-bad');
  $('choiceLock').classList.remove('reveal-ok', 'reveal-bad');
  $('choiceBook').disabled = false;
  $('choiceLock').disabled = false;
}

/* ---------- Fim de partida ---------- */
function pushHist(entry) {
  S.hist.push(Object.assign({ m: G.mode, d: nowStr() }, entry));
  if (S.hist.length > 60) S.hist = S.hist.slice(-60);
}
function bestKey() { return G.mode === 'solo' ? 'solo' : G.mode === 'flash' ? 'flash' : G.mode === 'surv' ? 'surv' : 'equipes'; }

/* ---------- Painel: escada de equipes ---------- */
function renderLadder(highlightTurn) {
  var L = $('ladderList');
  L.innerHTML = G.teams.map(function (t, i) {
    var pos = G.teams.slice().sort(function (a, b) { return b.score - a.score; }).indexOf(t) + 1;
    return '<div class="lrow' + (highlightTurn === i ? ' at' : '') + '">' +
      '<div class="lpos">' + pos + 'º</div>' +
      '<div class="lname" style="color:' + t.color + '">' + esc(t.name) + '</div>' +
      '<div class="lscore">' + t.score + '</div></div>';
  }).join('');
}

/* ---------- Exportação CSV ---------- */
function exportCSV() {
  var rows = [['modo', 'data', 'pontos', 'acertos', 'erros', 'aproveitamento_%', 'tempo_medio_s', 'detalhe']];
  S.hist.forEach(function (h) {
    rows.push([h.m, h.d, h.score, h.hits, h.misses, h.pct, h.tmed, h.extra || '']);
  });
  var csv = '\uFEFF' + rows.map(function (r) {
    return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(';');
  }).join('\r\n');
  download('resultados-amarrado.csv', csv, 'text/csv;charset=utf-8');
}

/* ---------- Banco: listagem ---------- */
function renderBank() {
  var term = $('bankSearch').value.trim().toLowerCase();
  var cat = $('bankCat').value;
  var lvl = $('bankLvl').value;
  var list = bankAll().filter(function (q) {
    if (term && q.frase.toLowerCase().indexOf(term) < 0) return false;
    if (cat && q.cat !== cat) return false;
    if (lvl && String(q.lvl) !== lvl) return false;
    return true;
  });
  var L = $('bankList');
  if (!list.length) { L.innerHTML = '<div class="empty">Nenhuma frase encontrada com esses filtros.</div>'; return; }
  L.innerHTML = list.map(function (q) {
    var custom = String(q.id).charAt(0) === 'C';
    return '<div class="qcard">' +
      '<div class="frase">' + esc(q.frase) + '</div>' +
      '<div class="exp" style="color:var(--muted);font-size:12px;margin-top:6px">' + esc(q.exp) + '</div>' +
      '<div class="meta">' +
        '<span class="chip ' + (q.resp ? 'b1' : 'b0') + '">' + (q.resp ? '📖 TÁ NA BÍBLIA' : '🔒 TÁ AMARRADO') + '</span>' +
        '<span class="chip">' + esc(q.cat) + '</span>' +
        '<span class="chip">' + lvlName(q.lvl) + '</span>' +
        (q.ref ? '<span class="chip ref">' + esc(q.ref) + '</span>' : '') +
        (custom ? '<span class="chip">SUA PERGUNTA</span>' : '') +
      '</div>' +
      (custom ? '<div class="acts"><button class="mini" data-edit="' + esc(q.id) + '">Editar</button>' +
        '<button class="mini del" data-del="' + esc(q.id) + '">Excluir</button></div>' : '') +
      '</div>';
  }).join('');
}

/* ============================================================
   MOTOR DO JOGO
   ============================================================ */
var MODE_LABEL = { solo: 'INDIVIDUAL', equipes: 'COMPETIÇÃO', flash: 'RELÂMPAGO', surv: 'SOBREVIVÊNCIA' };

/* Pergunta atual: índice da rodada. Nos modos solo/survivência o deck cresce uma
   carta por pergunta (deck[idx]); nos modos com deck pré-montado (relâmpago/
   equipes) o deck já tem todas e o idx controla a posição. */
function curQ() { return G.deck[Math.min(G.idx, G.deck.length - 1)]; }

function showQuestion() {
  var q = curQ();
  hideFeedback();
  $('qNum').textContent = 'PERGUNTA ' + String(G.idx + 1).padStart(2, '0');
  $('qFrase').textContent = q.frase;
  $('gTagQ').textContent = 'PERGUNTA ' + (G.idx + 1) + (G.mode === 'equipes' ? '/' + G.totalQ : '');
  var x2 = G.mode === 'flash' && (G.idx === 2 || G.idx === 5 || G.idx === 8);
  G.x2 = x2;
  $('gTagScore').textContent = (G.mode === 'equipes'
    ? G.teams[G.turn].name + ': ' + G.teams[G.turn].score + ' pts'
    : G.score + ' pts') + (x2 ? ' · x2!' : '');
  if (G.mode === 'equipes') {
    $('turnTeam').style.display = '';
    $('turnTeam').textContent = 'Vez: ' + G.teams[G.turn].name;
    renderLadder(G.turn);
  }
  var sec = G.mode === 'flash' ? 25 : G.mode === 'solo' ? 15 : G.mode === 'equipes' ? G.cfg.time : 15;
  startTimer(sec);
  saveProgress();
}

/* Registra resposta (jogador ou apresentador registrando a resposta da equipe) */
function recordAnswer(picked) {
  if (!G || G.ended) return;
  var fbOn = $('feedback').classList.contains('on');
  if (fbOn) {
    /* Apresentador revelou sem pontuar: pode registrar a resposta da equipe agora */
    if (!G.revealed || G.mode !== 'equipes') return;
    hideFeedback();
    G.revealed = false;
  }
  var q = curQ();
  if (picked !== 0 && picked !== 1) return;
  stopTimer();
  var tmed = Math.round((G.timerDur - (G.timerEnd - Date.now())) / 1000);
  if (tmed < 0) tmed = 0;
  G.times.push(tmed);
  var ok = picked === q.resp;
  G.lastOk = ok;
  G.lastPick = picked;
  G.revealed = false;
  G.lastGain = 0;
  if (ok) {
    G.hits++;
    if (G.mode === 'solo') { G.lastGain = 10; G.score += 10; }
    else if (G.mode === 'flash') { G.lastGain = G.x2 ? 20 : 10; G.score += G.lastGain; }
    else if (G.mode === 'surv') { G.lastGain = 10; G.score += 10; }
    else if (G.mode === 'equipes') { G.lastGain = G.cfg.pts; G.teams[G.turn].score += G.cfg.pts; }
  } else {
    G.misses++;
  }
  showFeedback(q, picked, false);
  refreshScore();
}

function onTimeout() {
  if (!G || G.ended) return;
  G.times.push(G.timerDur / 1000);
  G.misses++;
  G.lastOk = false;
  G.lastPick = null;
  showFeedback(curQ(), null, false);
  refreshScore();
}

function refreshScore() {
  if (!G) return;
  if (G.mode === 'equipes') {
    $('gTagScore').textContent = G.teams[G.turn].name + ': ' + G.teams[G.turn].score + ' pts';
    renderLadder(G.turn);
  } else {
    $('gTagScore').textContent = G.score + ' pts';
  }
}

/* Avança: próxima pergunta ou fim */
function nextQuestion() {
  if (!G || G.ended) return;
  /* Sobrevivência: um erro elimina */
  if (G.mode === 'surv' && G.lastOk === false) { endMatch(); return; }
  /* Ajuste de dificuldade (individual automático) */
  if (G.mode === 'solo') {
    if (G.lastOk === true) G.lvl = Math.min(3, G.lvl + 1);
    else if (G.lastOk === false) G.lvl = Math.max(1, G.lvl - 1);
  }
  G.idx++;
  var limit = G.mode === 'solo' ? 20 : G.mode === 'flash' ? 10 : G.mode === 'equipes' ? G.totalQ : Infinity;
  if (G.mode === 'equipes') G.turn = G.idx % G.teams.length;
  if (G.idx >= limit) { endMatch(); return; }
  pickNext();
  showQuestion();
}

function pickNext() {
  if (G.mode === 'equipes' || G.mode === 'flash') {
    /* deck fixo pré-embaralhado */
  } else {
    var q = poolPick(adaptiveDifficulty());
    if (q) G.deck.push(q);
  }
}

/* ---------- Início dos modos ---------- */
function startSolo() {
  newMatch('solo');
  G.pool = shuffle(bankAll());
  G.deck.push(poolPick(2));
  enterGame();
}

function startFlash() {
  newMatch('flash');
  /* Relâmpago é o modo mais difícil: prioriza perguntas DIFÍCEIS (7) e MÉDIAS (3) */
  var pool = bankAll();
  var hard = shuffle(pool.filter(function (q) { return q.lvl === 3; }));
  var med = shuffle(pool.filter(function (q) { return q.lvl === 2; }));
  G.deck = hard.slice(0, 7).concat(med.slice(0, 3));
  G.deck = shuffle(G.deck);
  enterGame();
}

function startSurv() {
  newMatch('surv');
  G.pool = shuffle(bankAll());
  G.deck.push(poolPick(1));
  enterGame();
}

function startTeams() {
  var cfg = readTeamCfg();
  newMatch('equipes', cfg);
  var names = cfg.names.slice(0, cfg.nTeams);
  G.teams = names.map(function (n, i) { return { name: n, color: TEAM_COLORS[i], score: 0 }; });
  G.totalQ = Math.min(cfg.qtd * cfg.rounds, bankAll().length);
  var pool = bankAll().filter(function (q) { return !cfg.lvl || q.lvl === Number(cfg.lvl); });
  if (pool.length < G.totalQ) pool = bankAll();
  G.deck = shuffle(pool).slice(0, G.totalQ);
  $('presPanel').style.display = '';
  $('turnTeam').style.display = '';
  enterGame();
}

function readTeamCfg() {
  var n = Number($('teamCount').value);
  var cfg = {
    nTeams: n, qtd: Number($('cfgQtd').value), time: Number($('cfgTime').value),
    pts: Number($('cfgPts').value), bonus: Number($('cfgBonus').value),
    rounds: Number($('cfgRounds').value), lvl: Number($('cfgLvl').value),
    names: []
  };
  var inputs = $('teamList').querySelectorAll('input');
  for (var i = 0; i < n; i++) cfg.names.push((inputs[i] && inputs[i].value.trim()) || TEAM_DEFAULT[i]);
  S.teamCfg = cfg;
  storeSave();
  return cfg;
}

function enterGame() {
  $('presPanel').style.display = G.mode === 'equipes' ? '' : 'none';
  $('turnTeam').style.display = G.mode === 'equipes' ? '' : 'none';
  $('gTagMode').textContent = MODE_LABEL[G.mode];
  show('scGame');
  showQuestion();
}

/* ---------- Fim ---------- */
function endMatch() {
  stopTimer();
  G.ended = true;
  S.progress = null;
  var hits = G.hits, misses = G.misses, total = hits + misses;
  var pct = total ? Math.round((hits / total) * 100) : 0;
  var tmed = G.times.length ? Math.round(G.times.reduce(function (a, b) { return a + b; }, 0) / G.times.length) : 0;
  var k = bestKey();
  var rec = false;
  if (k !== 'equipes') { rec = G.score > (S.best[k] || 0); if (rec) S.best[k] = G.score; }
  pushHist({ score: G.score, hits: hits, misses: misses, pct: pct, tmed: tmed, extra: rec ? 'NOVO RECORDE' : '' });
  storeSave();
  if (G.mode === 'equipes') { renderTeamEnd(); } else { renderSoloEnd(pct, tmed, rec); }
  show('scEnd');
  if (S.sound) sfxEnd();
  spawnSparks();
}

function statCard(n, l) {
  return '<div class="stcard"><div class="n">' + esc(n) + '</div><div class="l">' + esc(l) + '</div></div>';
}
function renderSoloEnd(pct, tmed, rec) {
  var names = { solo: 'VOCÊ', flash: 'DESAFIO RELÂMPAGO', surv: 'SOBREVIVÊNCIA BÍBLICA' };
  $('endTitle').textContent = rec ? 'NOVO RECORDE!' : names[G.mode];
  $('endSub').textContent = G.mode === 'surv'
    ? 'Você foi eliminado após ' + G.hits + ' acerto' + (G.hits === 1 ? '' : 's') + ' consecutivos.'
    : 'Você acertou ' + pct + '% das frases.';
  $('podium').style.display = 'none';
  $('podium').innerHTML = '';
  $('endStats').innerHTML =
    statCard(G.score, 'PONTOS') + statCard(G.hits, 'ACERTOS') +
    statCard(G.misses, 'ERROS') + statCard(pct + '%', 'APROVEITAMENTO') +
    statCard(tmed + 's', 'TEMPO MÉDIO') + statCard(S.best[bestKey()], 'RECORDE');
}

function renderTeamEnd() {
  var rank = G.teams.slice().sort(function (a, b) { return b.score - a.score; });
  var medals = ['🥇', '🥈', '🥉'];
  $('endTitle').textContent = medals[0] + ' ' + esc(rank[0].name) + ' VENCEU!';
  $('endSub').textContent = 'Placar final da competição';
  var pod = $('podium');
  pod.style.display = '';
  var cols = [
    { c: 'p2', t: rank[1], m: '🥈' }, { c: 'p1', t: rank[0], m: '🥇' }, { c: 'p3', t: rank[2], m: '🥉' }
  ];
  pod.innerHTML = cols.filter(function (x) { return x.t; }).map(function (x) {
    return '<div class="pcol ' + x.c + '"><div class="pbase">' + x.m + '</div>' +
      '<div class="pname" style="color:' + x.t.color + '">' + esc(x.t.name) + '</div>' +
      '<div class="pscore">' + x.t.score + ' pts</div></div>';
  }).join('');
  var total = G.hits + G.misses;
  var pct = total ? Math.round((G.hits / total) * 100) : 0;
  var tmed = G.times.length ? Math.round(G.times.reduce(function (a, b) { return a + b; }, 0) / G.times.length) : 0;
  var bestEq = S.best.equipes || 0;
  if (rank[0].score > bestEq) S.best.equipes = rank[0].score;
  pushHist({ score: rank[0].score, hits: G.hits, misses: G.misses, pct: pct, tmed: tmed, extra: 'Vencedor: ' + rank[0].name });
  $('endStats').innerHTML = rank.map(function (t, i) {
    return '<div class="stcard"><div class="n" style="color:' + t.color + '">' + t.score + '</div><div class="l">' + (i + 1) + 'º ' + esc(t.name) + '</div></div>';
  }).join('');
  storeSave();
}

function spawnSparks() {
  var w = document.createElement('div');
  w.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:80;overflow:hidden';
  for (var i = 0; i < 14; i++) {
    var s = document.createElement('div');
    s.className = 'spark';
    s.style.left = (Math.random() * 100) + 'vw';
    s.style.top = '-8px';
    s.style.animationDelay = (Math.random() * 0.9) + 's';
    s.style.background = TEAM_COLORS[Math.floor(Math.random() * TEAM_COLORS.length)];
    w.appendChild(s);
  }
  document.body.appendChild(w);
  setTimeout(function () { if (w.parentNode) w.parentNode.removeChild(w); }, 3200);
}

/* ---------- Painel do apresentador ---------- */
function presPause() {
  G.paused = !G.paused;
  $('presPause').textContent = G.paused ? 'Retomar' : 'Pausar / Retomar';
}
function presReveal() {
  if ($('feedback').classList.contains('on')) return;
  G.revealed = true;
  showFeedback(curQ(), null, true);
  if (S.sound) sfxSus();
}
function presBonus() { G.teams[G.turn].score += G.cfg.bonus; refreshScore(); sfxClick(); }
function presMinus() { G.teams[G.turn].score = Math.max(0, G.teams[G.turn].score - G.cfg.pts); refreshScore(); sfxClick(); }
function presSkip() {
  G.idx++;
  if (G.idx >= G.totalQ) { endMatch(); return; }
  G.turn = G.idx % G.teams.length;
  showQuestion();
}
function presRestart() {
  var cfg = G.cfg;
  startTeamsReload(cfg);
}
function startTeamsReload(cfg) {
  newMatch('equipes', cfg);
  G.teams = cfg.names.slice(0, cfg.nTeams).map(function (n, i) { return { name: n, color: TEAM_COLORS[i], score: 0 }; });
  G.totalQ = Math.min(cfg.qtd * cfg.rounds, bankAll().length);
  var pool = bankAll().filter(function (q) { return !cfg.lvl || q.lvl === Number(cfg.lvl); });
  if (pool.length < G.totalQ) pool = bankAll();
  G.deck = shuffle(pool).slice(0, G.totalQ);
  $('presPanel').style.display = '';
  enterGame();
}
function presEnd() { endMatch(); }

/* ---------- Salvamento de progresso (auto) ---------- */
function saveProgress() {
  if (!G || G.mode === 'equipes' || G.ended) return;
  S.progress = {
    mode: G.mode, idx: G.idx, hits: G.hits, misses: G.misses, score: G.score, lvl: G.lvl,
    deckIds: G.deck.map(function (q) { return q.id; }),
    poolIds: G.pool.map(function (q) { return q.id; }),
    lastOk: G.lastOk, lastPick: G.lastPick
  };
  storeSave();
}
function restoreProgress() {
  var p = S.progress;
  if (!p) return;
  var bank = bankAll();
  var byId = {};
  bank.forEach(function (q) { byId[q.id] = q; });
  var deck = p.deckIds.map(function (id) { return byId[id]; }).filter(Boolean);
  var pool = p.poolIds.map(function (id) { return byId[id]; }).filter(Boolean);
  if (!deck.length) { S.progress = null; storeSave(); return; }
  newMatch(p.mode);
  G.idx = p.idx; G.hits = p.hits; G.misses = p.misses; G.score = p.score;
  G.lvl = p.lvl; G.deck = deck; G.pool = pool;
  G.lastOk = p.lastOk; G.lastPick = p.lastPick;
  enterGame();
}

/* ---------- Configuração de equipes ---------- */
function renderTeamInputs() {
  var n = Number($('teamCount').value);
  var names = S.teamCfg.names || TEAM_DEFAULT;
  var html = '';
  for (var i = 0; i < n; i++) {
    html += '<div class="teamname"><span class="dot" style="background:' + TEAM_COLORS[i] + '"></span>' +
      '<input type="text" maxlength="18" value="' + esc(names[i] || TEAM_DEFAULT[i]) + '" aria-label="Equipe ' + (i + 1) + '"></div>';
  }
  $('teamList').innerHTML = html;
}

/* ---------- Admin ---------- */
var editingId = null;
function openAdmin(editId) {
  editingId = editId || null;
  $('adminTitle').textContent = editingId ? 'Editar pergunta' : 'Cadastrar nova pergunta';
  if (editingId) {
    var q = S.custom.filter(function (x) { return x.id === editingId; })[0];
    if (q) {
      $('fFrase').value = q.frase; $('fResp').value = String(q.resp);
      $('fRef').value = q.ref; $('fExp').value = q.exp;
      $('fLvl').value = String(q.lvl); $('fCat').value = q.cat;
    }
  } else {
    $('fFrase').value = ''; $('fRef').value = ''; $('fExp').value = '';
    $('fResp').value = '1'; $('fLvl').value = '1';
  }
  $('adminModal').classList.add('on');
  $('fFrase').focus();
}
function closeAdmin() { $('adminModal').classList.remove('on'); renderBank(); }
function saveCustom() {
  var frase = $('fFrase').value.trim();
  var exp = $('fExp').value.trim();
  if (!frase || !exp) return;
  var q = {
    id: editingId || bankNextCustomId(),
    frase: frase, resp: Number($('fResp').value),
    ref: $('fRef').value.trim(), exp: exp,
    lvl: Number($('fLvl').value), cat: $('fCat').value
  };
  if (editingId) {
    var i = S.custom.findIndex(function (x) { return x.id === editingId; });
    if (i >= 0) S.custom[i] = q; else S.custom.push(q);
  } else {
    S.custom.push(q);
  }
  storeSave();
  $('fFrase').value = ''; $('fRef').value = ''; $('fExp').value = '';
  editingId = null;
  $('adminTitle').textContent = 'Cadastrar nova pergunta';
  renderBank();
}
function doImport() {
  var raw = $('iJson').value.trim();
  if (!raw) return;
  var arr;
  try { arr = JSON.parse(raw); } catch (e) { $('iJson').value = 'JSON inválido: ' + e.message; return; }
  if (!Array.isArray(arr)) { $('iJson').value = 'O JSON precisa ser um array de perguntas.'; return; }
  var n = 0;
  arr.forEach(function (it) {
    if (!it || typeof it.frase !== 'string' || !it.frase.trim()) return;
    if (typeof it.exp !== 'string' || !it.exp.trim()) return;
    var resp = Number(it.resp);
    if (resp !== 0 && resp !== 1) return;
    var lvl = Number(it.lvl); if (![1, 2, 3].includes(lvl)) lvl = 2;
    var cat = CATS.includes(it.cat) ? it.cat : 'Frases Populares';
    S.custom.push({ id: bankNextCustomId(), frase: it.frase.trim(), resp: resp, ref: String(it.ref || ''), exp: it.exp.trim(), lvl: lvl, cat: cat });
    n++;
    if (S.custom.length > 500) return;
  });
  storeSave();
  $('iJson').value = 'Importadas com sucesso: ' + n + ' pergunta(s).';
  renderBank();
}

/* ---------- Ranking ---------- */
function renderRank() {
  var b = S.best;
  $('rankBest').innerHTML =
    statCard(b.solo || 0, 'RECORDE INDIVIDUAL') +
    statCard(b.flash || 0, 'RECORDE RELÂMPAGO') +
    statCard(b.surv || 0, 'RECORDE SOBREVIVÊNCIA') +
    statCard(b.equipes || 0, 'MELHOR EQUIPE');
  var list = S.hist.slice().reverse().slice(0, 20);
  $('rankList').innerHTML = list.length ? list.map(function (h) {
    return '<div class="hrow"><span class="hm">' + esc(MODE_LABEL[h.m] || h.m) + '</span>' +
      '<span>' + h.score + ' pts · ' + h.hits + ' acertos (' + h.pct + '%)</span>' +
      '<span class="spacer"></span><span class="hi">' + esc(h.d) + (h.extra ? ' · ' + esc(h.extra) : '') + '</span></div>';
  }).join('') : '<div class="empty">Nenhuma partida registrada ainda. Jogue para começar o ranking!</div>';
}

/* ---------- Tela cheia ---------- */
function fsElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement || null;
}
function toggleFullscreen() {
  var el = document.documentElement;
  try {
    if (!fsElement()) {
      var p = el.requestFullscreen ? el.requestFullscreen() :
        el.webkitRequestFullscreen ? el.webkitRequestFullscreen() :
        el.mozRequestFullScreen ? el.mozRequestFullScreen() : el.msRequestFullscreen ? el.msRequestFullscreen() : null;
      if (p && p.catch) p.catch(function () { /* rejeitado */ });
    } else {
      var x = document.exitFullscreen ? document.exitFullscreen() :
        document.webkitExitFullscreen ? document.webkitExitFullscreen() :
        document.mozCancelFullScreen ? document.mozCancelFullScreen() : document.msExitFullscreen ? document.msExitFullscreen() : null;
      if (x && x.catch) x.catch(function () { /* rejeitado */ });
    }
  } catch (e) { /* navegador sem suporte */ }
}
function fsSync() {
  var on = !!fsElement();
  $('fsBtn').classList.toggle('fson', on);
  $('fsBtn').innerHTML = on ? '&times; Sair da tela cheia (Esc)' : '&#9974;';
}

/* ---------- Sons on/off ---------- */
function toggleSound() {
  S.sound = !S.sound;
  storeSave();
  $('soundBtn').innerHTML = S.sound ? '&#9835;' : '&#9834;';
  $('soundBtn').style.opacity = S.sound ? '1' : '.5';
  if (S.sound) sfxClick();
}

/* ---------- Teclado ---------- */
document.addEventListener('keydown', function (e) {
  var tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  var k = e.key.toLowerCase();
  if (e.key === 'Escape') {
    if ($('adminModal').classList.contains('on') || $('ladderModal').classList.contains('on')) {
      $('adminModal').classList.remove('on'); $('ladderModal').classList.remove('on'); renderBank();
      return;
    }
    if (fsElement()) toggleFullscreen();
    return;
  }
  if ($('scGame').classList.contains('on') && G && !G.ended) {
    var answered = $('feedback').classList.contains('on');
    if (e.key === 'Enter') {
      if (answered) { e.preventDefault(); $('btnNext').click(); }
      return;
    }
    if (!answered) {
      if (k === '1' || k === 'b') { e.preventDefault(); recordAnswer(1); return; }
      if (k === '2' || k === 'a') { e.preventDefault(); recordAnswer(0); return; }
    }
  }
  if (k === 's') { toggleSound(); return; }
  if (k === 'f') { toggleFullscreen(); return; }
});

/* ---------- Eventos ---------- */
function wire() {
  $('brandBtn').addEventListener('click', function () { goHome(); });
  $('soundBtn').addEventListener('click', toggleSound);
  $('fsBtn').addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', fsSync);
  document.addEventListener('webkitfullscreenchange', fsSync);
  document.addEventListener('mozfullscreenchange', fsSync);
  document.addEventListener('MSFullscreenChange', fsSync);

  $('btnSolo').addEventListener('click', function () { ac(); startSolo(); });
  $('btnFlash').addEventListener('click', function () { ac(); startFlash(); });
  $('btnSurv').addEventListener('click', function () { ac(); startSurv(); });
  $('btnTeams').addEventListener('click', function () { ac(); renderTeamInputs(); show('scTeams'); });
  $('btnHow').addEventListener('click', function () { show('scHow'); });
  $('btnBank').addEventListener('click', function () { show('scBank'); renderBank(); });
  $('btnRank').addEventListener('click', function () { show('scRank'); renderRank(); });
  $('btnHowBack').addEventListener('click', function () { goHome(); });
  $('btnBankBack').addEventListener('click', function () { goHome(); });
  $('btnRankBack').addEventListener('click', function () { goHome(); });
  $('btnTeamsBack').addEventListener('click', function () { goHome(); });

  $('btnTeamsStart').addEventListener('click', function () { ac(); startTeams(); });
  $('teamCount').addEventListener('change', renderTeamInputs);
  ['cfgQtd', 'cfgTime', 'cfgPts', 'cfgBonus', 'cfgRounds', 'cfgLvl'].forEach(function (id) {
    $(id).addEventListener('change', function () { readTeamCfg(); });
  });

  $('choiceBook').addEventListener('click', function () { recordAnswer(1); });
  $('choiceLock').addEventListener('click', function () { recordAnswer(0); });
  $('btnNext').addEventListener('click', nextQuestion);
  $('btnQuitGame').addEventListener('click', function () { quitGame(); });

  $('presPause').addEventListener('click', presPause);
  $('presReveal').addEventListener('click', presReveal);
  $('presBonus').addEventListener('click', presBonus);
  $('presMinus').addEventListener('click', presMinus);
  $('presSkip').addEventListener('click', presSkip);
  $('presLadder').addEventListener('click', function () { renderLadder(G.turn); $('ladderModal').classList.add('on'); });
  $('presRestart').addEventListener('click', function () { presRestart(); });
  $('presEnd').addEventListener('click', presEnd);
  $('btnLadderClose').addEventListener('click', function () { $('ladderModal').classList.remove('on'); });

  $('btnPlayAgain').addEventListener('click', function () {
    if (G.mode === 'solo') startSolo();
    else if (G.mode === 'flash') startFlash();
    else if (G.mode === 'surv') startSurv();
    else startTeamsReload(G.cfg);
  });
  $('btnEndHome').addEventListener('click', function () { goHome(); });
  $('btnEndExport').addEventListener('click', exportCSV);
  $('btnExportResults').addEventListener('click', exportCSV);

  /* banco + admin */
  ['bankSearch', 'bankCat', 'bankLvl'].forEach(function (id) {
    $(id).addEventListener('input', renderBank);
  });
  $('btnAdmin').addEventListener('click', function () { openAdmin(null); });
  $('btnAdminCancel').addEventListener('click', closeAdmin);
  $('btnSaveQ').addEventListener('click', saveCustom);
  $('btnDoImport').addEventListener('click', doImport);
  $('btnExportBank').addEventListener('click', function () {
    download('amarrado-banco.json', JSON.stringify(bankAll(), null, 2), 'application/json');
  });
  $('bankList').addEventListener('click', function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.edit) openAdmin(t.dataset.edit);
    if (t.dataset && t.dataset.del) {
      var id = t.dataset.del;
      S.custom = S.custom.filter(function (x) { return x.id !== id; });
      storeSave();
      renderBank();
      sfxClick();
    }
  });

  /* intro */
  var intro = $('intro');
  function closeIntro() {
    intro.classList.add('out');
    setTimeout(function () { if (intro.parentNode) intro.parentNode.removeChild(intro); }, 700);
    ac();
  }
  intro.addEventListener('click', closeIntro);
  setTimeout(function () { if (intro.parentNode) closeIntro(); }, 2900);

  /* continuar partida */
  $('btnContinue').addEventListener('click', restoreProgress);
}

function goHome() {
  stopTimer();
  if (G && !G.ended && G.mode === 'equipes') G = null;
  show('scHome');
  updateContinue();
}
function quitGame() {
  stopTimer();
  S.progress = null;
  storeSave();
  G = null;
  goHome();
}
function updateContinue() {
  var has = !!S.progress && !($('scGame').classList.contains('on'));
  $('btnContinue').style.display = has ? '' : 'none';
  if (has) {
    var m = MODE_LABEL[S.progress.mode] || '';
    $('continueInfo').textContent = 'Partida ' + m.toLowerCase() + ': ' + (S.progress.idx + 1) + 'ª pergunta, ' + S.progress.score + ' pts.';
  }
}

/* ---------- Init ---------- */
function init() {
  storeLoad();
  var cfg = S.teamCfg;
  $('cfgQtd').value = String(cfg.qtd); $('cfgTime').value = String(cfg.time);
  $('cfgPts').value = String(cfg.pts); $('cfgBonus').value = String(cfg.bonus);
  $('cfgRounds').value = String(cfg.rounds); $('cfgLvl').value = String(cfg.lvl);
  var catSel = $('bankCat');
  CATS.forEach(function (c) {
    var o = document.createElement('option');
    o.value = c; o.textContent = c;
    catSel.appendChild(o);
  });
  var catForm = $('fCat');
  CATS.forEach(function (c) {
    var o = document.createElement('option');
    o.value = c; o.textContent = c;
    catForm.appendChild(o);
  });
  $('soundBtn').innerHTML = S.sound ? '&#9835;' : '&#9834;';
  $('soundBtn').style.opacity = S.sound ? '1' : '.5';
  wire();
  updateContinue();
  fsSync();
}
document.addEventListener('DOMContentLoaded', init);

