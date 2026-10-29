/* ============================================================
   VERBO - Narrador (voz Marcos / ElevenLabs)
   Ordem de tentativa:
     1) audio/<slug>.mp3  (pre-gerado, funciona offline)
     2) /api/voz           (proxy Vercel -> ElevenLabs)
     3) Web Speech API     (voz nativa do navegador, sempre disponivel)
   ============================================================ */
'use strict';

var Voz = (function () {
  var ATIVO = true;
  var audio = null;
  var objectUrl = '';
  var semEstatico = {};   // slug que ja respondeu 404 (nao inspeciona de novo)
  var desbloqueado = false;

  /* Slug deterministico: mesmo texto -> mesmo arquivo de audio */
  function slug(txt) {
    var h = 5381;
    for (var i = 0; i < txt.length; i++) {
      h = ((h << 5) + h + txt.charCodeAt(i)) >>> 0;
    }
    return h.toString(36);
  }

  function temNativa() {
    return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
  }

  function limparUrl() {
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch (e) { /* ignora */ }
      objectUrl = '';
    }
  }

  function parar() {
    if (audio) {
      try { audio.pause(); audio.currentTime = 0; } catch (e) { /* ignora */ }
      audio = null;
    }
    limparUrl();
    if (temNativa()) {
      try { window.speechSynthesis.cancel(); } catch (e) { /* ignora */ }
    }
  }

  function tocar(src, aoTerminar, aoFalhar) {
    try {
      var a = new Audio(src);
      audio = a;
      a.onended = function () { audio = null; aoTerminar(); };
      a.onerror = function () { audio = null; aoFalhar(); };
      var p = a.play();
      if (p && typeof p.catch === 'function') {
        p.catch(function () { audio = null; aoFalhar(); });
      }
    } catch (e) {
      audio = null;
      aoFalhar();
    }
  }

  function construtorUtt() {
    if (typeof window !== 'undefined' && window.SpeechSynthesisUtterance) {
      return window.SpeechSynthesisUtterance;
    }
    if (typeof SpeechSynthesisUtterance !== 'undefined') return SpeechSynthesisUtterance;
    return null;
  }

  function falarNativo(texto) {
    if (!temNativa()) return;
    var Ctor = construtorUtt();
    if (!Ctor) return;
    try {
      var u = new Ctor(texto);
      u.lang = 'pt-BR';
      u.rate = 1;
      var vozes = window.speechSynthesis.getVoices();
      for (var i = 0; i < vozes.length; i++) {
        if (vozes[i].lang && vozes[i].lang.toLowerCase() === 'pt-br') {
          u.voice = vozes[i];
          break;
        }
      }
      window.speechSynthesis.speak(u);
    } catch (e) { /* ignora */ }
  }

  function viaEstatico(slug, texto, ok, falha) {
    if (semEstatico[slug]) { falha(); return; }
    var url = 'audio/' + slug + '.mp3';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    xhr.onload = function () {
      if (xhr.status === 200 && xhr.response && xhr.response.size > 0) {
        objectUrl = URL.createObjectURL(xhr.response);
        tocar(objectUrl, ok, function () { limparUrl(); falha(); });
      } else {
        semEstatico[slug] = true;
        falha();
      }
    };
    xhr.onerror = function () { semEstatico[slug] = true; falha(); };
    try { xhr.send(); } catch (e) { semEstatico[slug] = true; falha(); }
  }

  function viaApi(texto, ok, falha) {
    if (typeof fetch === 'undefined') { falha(); return; }
    try {
      fetch('api/voz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: texto })
      }).then(function (r) {
        if (!r.ok) throw new Error('api ' + r.status);
        return r.blob();
      }).then(function (blob) {
        if (!blob || blob.size === 0) throw new Error('blob vazio');
        objectUrl = URL.createObjectURL(blob);
        tocar(objectUrl, ok, function () { limparUrl(); falha(); });
      }).catch(function () { falha(); });
    } catch (e) { falha(); }
  }

  /* Fala um texto. Substitui a fala em andamento (modo remplacement). */
  function falar(texto) {
    if (!ATIVO) return;
    var limpo = String(texto || '').trim();
    if (limpo === '') return;
    parar();

    var s = slug(limpo);
    viaEstatico(s, limpo, function () {}, function () {
      viaApi(limpo, function () {}, function () { falarNativo(limpo); });
    });
  }

  /* Libera o audio no primeiro toque (exigencia dos navegadores mobile) */
  function desbloquear() {
    if (desbloqueado) return;
    desbloqueado = true;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx();
      var buf = ctx.createBuffer(1, 1, 22050);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch (e) { /* ignora */ }
  }

  function ativo() { return ATIVO; }
  function setAtivo(v) { ATIVO = !!v; if (!ATIVO) parar(); return ATIVO; }

  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('pointerdown', desbloquear, { once: true });
    window.addEventListener('touchstart', desbloquear, { once: true });
  }

  var api = {
    falar: falar,
    parar: parar,
    ativo: ativo,
    setAtivo: setAtivo,
    slug: slug
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
