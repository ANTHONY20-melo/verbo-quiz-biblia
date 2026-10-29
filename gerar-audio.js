/* ============================================================
   VERBO - Gerador de audio da voz Marcos (ElevenLabs)
   Pre-gera os MP3 das perguntas e explicacoes para o PWA
   funcionar offline e sem consumir caracteres a cada partida.

   Uso:
     $env:ELEVENLABS_API_KEY = "sua-chave"
     node gerar-audio.js            # gera tudo que faltar
     node gerar-audio.js --forcar    # regera tudo
   ============================================================ */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var VOICE_ID = process.env.ULTRON_VOICE_ID || 'xHUwLsLfyqiYOIVTzLRW';
var MODEL = process.env.ULTRON_VOICE_MODEL || 'eleven_multilingual_v2';
var KEY = process.env.ELEVENLABS_API_KEY || '';
var FORCAR = process.argv.indexOf('--forcar') >= 0;
var DIR_AUDIO = path.join(__dirname, 'audio');
var API = 'https://api.elevenlabs.io/v1';

function slug(txt) {
  var h = 5381;
  for (var i = 0; i < txt.length; i++) {
    h = ((h << 5) + h + txt.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

/* Carrega o banco e extrai todos os textos que devem ser falados */
function coletarTextos() {
  var src = fs.readFileSync(path.join(__dirname, 'banco.js'), 'utf8').replace("'use strict';", '');
  var ctx = { console: console };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  var qs = ctx.QUESTIONS || [];
  var textos = {};
  function add(t) {
    if (!t) return;
    var limpo = String(t).trim();
    if (limpo === '') return;
    textos[limpo] = true;
  }
  qs.forEach(function (q) {
    add(q.q);
    add(q.e);
    (q.o || []).forEach(add);
  });
  return Object.keys(textos);
}

async function sintetizar(texto) {
  var r = await fetch(
    API + '/text-to-speech/' + encodeURIComponent(VOICE_ID) + '?output_format=mp3_44100_128',
    {
      method: 'POST',
      headers: {
        'xi-api-key': KEY.trim(),
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg'
      },
      body: JSON.stringify({
        text: texto,
        model_id: MODEL,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.2,
          use_speaker_boost: true
        }
      })
    }
  );
  if (!r.ok) {
    var det = '';
    try { det = (await r.text()).slice(0, 200); } catch (e) { /* ignora */ }
    throw new Error('HTTP ' + r.status + ' ' + det);
  }
  return Buffer.from(await r.arrayBuffer());
}

async function main() {
  if (!KEY.trim()) {
    console.error('ELEVENLABS_API_KEY nao definida.');
    console.error('Defina a variavel e rode novamente: $env:ELEVENLABS_API_KEY = "sk_..."');
    process.exit(3);
  }

  if (!fs.existsSync(DIR_AUDIO)) fs.mkdirSync(DIR_AUDIO, { recursive: true });

  var textos = coletarTextos();
  console.log('Textos a narrar: ' + textos.length);

  var indice = {};
  var indicePath = path.join(DIR_AUDIO, 'indice.json');
  if (!FORCAR && fs.existsSync(indicePath)) {
    try { indice = JSON.parse(fs.readFileSync(indicePath, 'utf8')); } catch (e) { indice = {}; }
  }

  var feitos = 0, pulados = 0, falhas = 0;
  for (var i = 0; i < textos.length; i++) {
    var texto = textos[i];
    var s = slug(texto);
    var arquivo = path.join(DIR_AUDIO, s + '.mp3');
    indice[s] = texto;
    if (!FORCAR && fs.existsSync(arquivo) && fs.statSync(arquivo).size > 0) {
      pulados++;
      continue;
    }
    try {
      var buf = await sintetizar(texto);
      fs.writeFileSync(arquivo, buf);
      feitos++;
      if (feitos % 10 === 0) console.log('  gerados ' + feitos + '/' + textos.length);
    } catch (err) {
      falhas++;
      console.error('  FALHOU (' + s + '): ' + err.message);
      await new Promise(function (r) { setTimeout(r, 800); });
    }
  }

  fs.writeFileSync(indicePath, JSON.stringify(indice, null, 2), 'utf8');
  console.log('Concluido: ' + feitos + ' gerados, ' + pulados + ' já existiam, ' + falhas + ' falhas.');
  if (falhas > 0) process.exit(1);
}

main().catch(function (err) {
  console.error('Erro geral: ' + (err && err.message ? err.message : String(err)));
  process.exit(1);
});
