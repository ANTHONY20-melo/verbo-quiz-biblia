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
var FALLBACKS = (process.env.ULTRON_VOICE_FALLBACKS || 'pNInz6obpgDQGcFmaJgB')
  .split(',').map(function (id) { return id.trim(); }).filter(Boolean);
var KEY = process.env.ELEVENLABS_API_KEY || '';
var FORCAR = process.argv.indexOf('--forcar') >= 0;
var COM_OPCOES = process.argv.indexOf('--com-opcoes') >= 0;
var DIR_AUDIO = path.join(__dirname, 'audio');
var API = 'https://api.elevenlabs.io/v1';

function slug(txt) {
  var h = 5381;
  for (var i = 0; i < txt.length; i++) {
    h = ((h << 5) + h + txt.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

/* Carrega o banco e extrai os textos que o narrador realmente fala:
   pergunta + explicacao. Ordem de prioridade por dificuldade, porque o deck
   do Show usa 8 faceis (d1), 7 medias (d2) e 5 dificeis (d3).
   As opcoes NAO sao narradas pelo jogo, entao ficam de fora por padrao. */
function coletarTextos() {
  var src = fs.readFileSync(path.join(__dirname, 'banco.js'), 'utf8').replace("'use strict';", '');
  var ctx = { console: console };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  var qs = ctx.QUESTIONS || [];

  var grupos = { 1: [], 2: [], 3: [] };
  var vistos = {};

  function add(arr, texto) {
    if (!texto) return;
    var limpo = String(texto).trim();
    if (limpo === '') return;
    if (vistos[limpo]) return;
    vistos[limpo] = true;
    arr.push(limpo);
  }

  qs.forEach(function (q) {
    var alvo = grupos[q.d] || grupos[3];
    add(alvo, q.q);
    add(alvo, q.e);
    if (COM_OPCOES) (q.o || []).forEach(function (o) { add(grupos[3], o); });
  });

  return grupos[1].concat(grupos[2], grupos[3]);
}

async function sintetizar(texto) {
  var cadeias = [VOICE_ID].concat(FALLBACKS);
  var ultimoErro = null;
  for (var i = 0; i < cadeias.length; i++) {
    var voiceId = cadeias[i];
    try {
      var r = await fetch(
        API + '/text-to-speech/' + encodeURIComponent(voiceId) + '?output_format=mp3_44100_128',
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
      if (r.ok) return Buffer.from(await r.arrayBuffer());
      var det = '';
      try { det = (await r.text()).slice(0, 200); } catch (e) { /* ignora */ }
      ultimoErro = new Error('HTTP ' + r.status + ' voz ' + voiceId + ' ' + det);
      if (r.status === 402 || r.status === 403 || r.status === 404) continue;
      throw ultimoErro;
    } catch (err) {
      ultimoErro = err;
      if (err instanceof Error && /HTTP (402|403|404)/.test(err.message)) continue;
      throw err;
    }
  }
  throw ultimoErro || new Error('nenhuma voz respondeu');
}

function quotaEsgotado(err) {
  if (!err || !err.message) return false;
  return /quota|character_limit_exceeded|too_many_requests|monthly credits/i.test(err.message);
}

async function main() {
  if (!KEY.trim()) {
    console.error('ELEVENLABS_API_KEY nao definida.');
    console.error('Defina a variavel e rode novamente: $env:ELEVENLABS_API_KEY = "sk_..."');
    process.exit(3);
  }

  if (!fs.existsSync(DIR_AUDIO)) fs.mkdirSync(DIR_AUDIO, { recursive: true });

  var textos = coletarTextos();
  var caracteres = textos.reduce(function (t, x) { return t + x.length; }, 0);
  console.log('Textos a narrar: ' + textos.length + ' (' + caracteres + ' caracteres)');

  var indice = {};
  var indicePath = path.join(DIR_AUDIO, 'indice.json');
  if (!FORCAR && fs.existsSync(indicePath)) {
    try { indice = JSON.parse(fs.readFileSync(indicePath, 'utf8')); } catch (e) { indice = {}; }
  }

  var feitos = 0, pulados = 0, falhas = 0, caracteresGastos = 0;
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
      caracteresGastos += texto.length;
      if (feitos % 10 === 0) console.log('  gerados ' + feitos + ' (' + caracteresGastos + ' caracteres)');
    } catch (err) {
      if (quotaEsgotado(err)) {
        console.error('');
        console.error('QUOTA do ElevenLabs esgotado apos ' + feitos + ' audios (' + caracteresGastos + ' caracteres).');
        console.error('O restante usa a voz nativa do navegador em tempo real.');
        break;
      }
      falhas++;
      console.error('  FALHOU (' + s + '): ' + err.message);
      await new Promise(function (r) { setTimeout(r, 800); });
    }
  }

  fs.writeFileSync(indicePath, JSON.stringify(indice, null, 2), 'utf8');
  console.log('Concluido: ' + feitos + ' gerados, ' + pulados + ' ja existiam, ' + falhas + ' falhas, ' + caracteresGastos + ' caracteres usados.');
  if (falhas > 0) process.exit(1);
}

main().catch(function (err) {
  console.error('Erro geral: ' + (err && err.message ? err.message : String(err)));
  process.exit(1);
});
