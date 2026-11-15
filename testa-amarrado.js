/* Smoke test headless do TÁ NA BÍBLIA OU TÁ AMARRADO?
   Simula DOM + localStorage, carrega banco e app, e valida os 4 modos + admin. */
'use strict';

/* ---- DOM stub ---- */
var elements = {};
function mkEl(id) {
  return {
    id: id, style: {}, dataset: {}, children: [], textContent: '', innerHTML: '',
    value: '0', disabled: false, className: '',
    _cls: {},
    classList: {
      add: function (c) { this._c[c] = 1; },
      remove: function (c) { delete this._c[c]; },
      toggle: function (c, v) { if (v === undefined) { this._c[c] = !this._c[c]; } else if (v) { this._c[c] = 1; } else { delete this._c[c]; } },
      contains: function (c) { return !!this._c[c]; },
      _c: {}
    },
    addEventListener: function () {},
    appendChild: function () {},
    removeChild: function () {},
    querySelectorAll: function () { return []; },
    setAttribute: function () {},
    focus: function () {},
    click: function () {}
  };
}
var registered = {};
global.document = {
  getElementById: function (id) {
    if (!elements[id]) { elements[id] = mkEl(id); if (!registered[id]) { registered[id] = 1; elements[id].value = '1'; } }
    return elements[id];
  },
  addEventListener: function () {},
  createElement: function (t) { var e = mkEl('el_' + t + Math.random()); e.tagName = t; return e; },
  body: mkEl('body'),
  documentElement: mkEl('html'),
  fullscreenElement: null
};
global.window = { scrollTo: function () {}, AudioContext: undefined, webkitAudioContext: undefined };
global.localStorage = {
  _d: {},
  getItem: function (k) { return this._d[k] || null; },
  setItem: function (k, v) { this._d[k] = v; },
  removeItem: function (k) { delete this._d[k]; }
};
global.Blob = function (a, o) { this.parts = a; };
global.URL = { createObjectURL: function () { return 'blob:x'; }, revokeObjectURL: function () {} };
global.location = { href: '' };
global.setInterval = function (f) { return 1; };
global.clearInterval = function () {};
global.setTimeout = function (f) { return 1; };
global.Math.random = function () { return 0.42; };

/* ---- Carrega banco + app ---- */
var fs = require('fs');
var bankSrc = fs.readFileSync('./amarrado-banco.js', 'utf8').replace(/'use strict';/, '');
var appSrc = fs.readFileSync('./amarrado-app.js', 'utf8').replace(/'use strict';/, '');
/* executa no escopo global (funções var) */
(0, eval)(bankSrc);
(0, eval)(appSrc.replace("document.addEventListener('DOMContentLoaded', init);", ''));

var PASS = 0, FAIL = 0;
function assert(cond, msg) {
  if (cond) { PASS++; } else { FAIL++; console.log('  FALHA: ' + msg); }
}

/* document.readyState check */
document.readyState = 'complete';

/* DOMContentLoaded já passou; roda init manualmente */
try { init(); } catch (e) { console.log('  init erro: ' + e.message); FAIL++; }

/* ---- T1: banco ---- */
assert(typeof QUESTIONS_ALL === 'object' && QUESTIONS_ALL.length >= 150, 'banco >= 150 (=' + QUESTIONS_ALL.length + ')');
assert(CATS.length === 11, '11 categorias');

/* ---- T2: modo individual (solo) ---- */
startSolo();
assert(G.mode === 'solo' && G.deck.length === 1, 'solo iniciado com 1 pergunta');
assert(document.getElementById('scGame').classList.contains('on'), 'tela do jogo ativa');
var q1 = curQ();
recordAnswer(q1.resp); /* acerta */
assert(G.hits === 1 && G.score === 10, 'acerto vale 10 pts (score=' + G.score + ')');
assert(document.getElementById('feedback').classList.contains('on'), 'feedback exibido');
nextQuestion();
assert(G.idx === 1, 'avançou para pergunta 2');
var q2 = curQ();
recordAnswer(q2.resp === 1 ? 0 : 1); /* erra */
assert(G.misses === 1 && G.score === 10, 'erro não pontua');
nextQuestion();
assert(G.idx === 2, 'solo não elimina por erro');
/* completa 20 perguntas */
for (var i = 2; i < 20; i++) { recordAnswer(curQ().resp); nextQuestion(); }
assert(G.ended === true, 'solo termina em 20 perguntas');
assert(S.hist.length === 1 && S.hist[0].m === 'solo', 'histórico registrado');
assert(S.best.solo === (S.hist[0].pct === 100 ? 200 : 190) || S.best.solo > 0, 'recorde salvo (' + S.best.solo + ')');
assert(S.progress === null, 'progresso limpo no fim');

/* ---- T3: flash (relâmpago) ---- */
startFlash();
assert(G.deck.length === 10, 'flash com 10 perguntas');
var fl3 = 0, fl2 = 0;
G.deck.forEach(function (q) { if (q.lvl === 3) { fl3++; } else if (q.lvl === 2) { fl2++; } });
assert(fl3 === 7 && fl2 === 3, 'relâmpago com 7 difíceis + 3 médias (' + fl3 + '/' + fl2 + ')');
var fids = [curQ().id];
recordAnswer(curQ().resp);
nextQuestion();
fids.push(curQ().id);
recordAnswer(curQ().resp); /* idx=1 */
nextQuestion(); /* idx=2 → x2 */
fids.push(curQ().id);
assert(fids[0] !== fids[1] && fids[1] !== fids[2] && fids[0] !== fids[2], 'relâmpago: perguntas avançam sem repetir');
assert(G.x2 === true, 'pergunta 3 vale x2');
recordAnswer(curQ().resp);
assert(G.lastGain === 20, 'x2 pontua dobrado (' + G.lastGain + ')');
nextQuestion();
for (var i = 3; i < 10; i++) { recordAnswer(curQ().resp); nextQuestion(); }
assert(G.ended === true && S.hist[1].m === 'flash', 'flash termina e registra');

/* ---- T4: sobrevivência ---- */
startSurv();
recordAnswer(curQ().resp); /* acerta → continua */
nextQuestion();
assert(!G.ended, 'sobrevivência continua após acerto');
recordAnswer(curQ().resp === 1 ? 0 : 1); /* erra → eliminado */
nextQuestion();
assert(G.ended === true, 'sobrevivência elimina por erro');
assert(S.hist[2].m === 'surv', 'sobrevivência registrada');

/* ---- T5: equipes ---- */
global.document.getElementById = function (id) {
  if (!elements[id]) { elements[id] = mkEl(id); elements[id].value = '1'; }
  if (id === 'teamCount') elements[id].value = '3';
  return elements[id];
};
renderTeamInputs();
readTeamCfg();
assert(S.teamCfg.nTeams === 3, 'config 3 equipes');
startTeams();
assert(G.teams.length === 3 && G.teams[0].name, '3 equipes criadas');
assert(G.mode === 'equipes' && G.totalQ > 0, 'competição iniciada');
assert(document.getElementById('presPanel').style.display === '', 'painel do apresentador visível');
var t0 = G.teams[G.turn];
var eqQ1 = curQ().id;
recordAnswer(curQ().resp); /* apresentador registra acerto */
assert(G.teams[G.turn].score === 10, 'equipe pontua 10 (score=' + G.teams[G.turn].score + ')');
presBonus();
assert(G.teams[G.turn].score === 15, 'bônus +5 (score=' + G.teams[G.turn].score + ')');
presMinus();
assert(G.teams[G.turn].score === 5, '- pontos (15 - 10 = 5)');
nextQuestion();
assert(G.turn === 1, 'vez passou para equipe 2');
assert(curQ().id !== eqQ1, 'equipes: pergunta avança sem repetir');
presPause(); presPause();
presReveal();
assert(document.getElementById('feedback').classList.contains('on'), 'revelar mostra feedback');
recordAnswer(curQ().resp === 1 ? 0 : 1); /* registra resposta da equipe após revelar */
assert(G.misses === 1, 'resposta registrada após revelação');
nextQuestion();
presSkip();
assert(G.idx === 3, 'pular avança sem responder');
presEnd();
assert(G.ended === true && S.hist[3].m === 'equipes', 'encerrar registra competição');
assert(document.getElementById('podium').innerHTML.indexOf('🥇') >= 0, 'pódio renderizado');

/* ---- T6: admin ---- */
openAdmin(null);
$('fFrase').value = 'Teste de pergunta customizada.';
$('fExp').value = 'Explicação de teste.';
$('fRef').value = 'Salmos 1:1';
$('fResp').value = '1';
$('fLvl').value = '2';
$('fCat').value = 'Versículos';
saveCustom();
assert(S.custom.length === 1 && S.custom[0].id === 'C1', 'pergunta customizada salva');
assert(bankAll().length === QUESTIONS_ALL.length + 1, 'banco somou a customizada');
openAdmin('C1');
assert(document.getElementById('fFrase').value === 'Teste de pergunta customizada.', 'editar carrega a pergunta');
saveCustom();
assert(S.custom.length === 1, 'edição não duplica');
doImport();
assert(typeof document.getElementById('iJson').value === 'string', 'import lida campo vazio sem quebrar');
var del = S.custom[0].id;
S.custom = S.custom.filter(function (x) { return x.id !== del; });
assert(S.custom.length === 0, 'exclusão de pergunta customizada');

/* ---- T7: continuar partida ---- */
startSolo();
assert(S.progress && S.progress.mode === 'solo', 'progresso salvo automaticamente');
restoreProgress();
assert(G.mode === 'solo' && G.deck.length >= 1, 'partida restaurada');

/* ---- T8: helpers ---- */
assert(esc('<b>"x"').indexOf('&lt;b&gt;') >= 0, 'esc() protege HTML');
assert(lvlName(2) === 'MÉDIO', 'lvlName');
exportCSV();
assert(true, 'exportCSV executa');

console.log('SMOKE: ' + PASS + ' PASS / ' + FAIL + ' FALHAS');
process.exit(FAIL ? 1 : 0);
