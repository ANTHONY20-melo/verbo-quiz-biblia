/* VERBO - Proxy de voz (Vercel Serverless Function)
   Converte texto em audio mp3 usando a voz Marcos (ElevenLabs).
   A chave fica no ambiente do servidor (ELEVENLABS_API_KEY) e nunca no cliente. */
'use strict';

var VOICE_ID = process.env.ULTRON_VOICE_ID || 'xHUwLsLfyqiYOIVTzLRW';
var MODEL = process.env.ULTRON_VOICE_MODEL || 'eleven_multilingual_v2';
var API = 'https://api.elevenlabs.io/v1';

function responderJson(res, status, obj) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  var key = process.env.ELEVENLABS_API_KEY;
  var configurado = !!(key && key.trim());

  if (req.method === 'GET') {
    responderJson(res, 200, {
      configured: configurado,
      voiceId: VOICE_ID,
      model: MODEL,
      language: 'pt-BR'
    });
    return;
  }

  if (req.method !== 'POST') {
    responderJson(res, 405, { error: 'Use GET ou POST' });
    return;
  }

  if (!configurado) {
    responderJson(res, 503, {
      error: 'Voz ElevenLabs nao configurada',
      hint: 'Defina ELEVENLABS_API_KEY no ambiente da Vercel'
    });
    return;
  }

  var body = req.body || {};
  var texto = String(body.text || '').trim();
  if (!texto) {
    responderJson(res, 400, { error: 'Campo "text" obrigatorio' });
    return;
  }
  if (texto.length > 4000) {
    responderJson(res, 413, { error: 'Texto muito longo (max 4000)' });
    return;
  }

  try {
    var upstream = await fetch(
      API + '/text-to-speech/' + encodeURIComponent(VOICE_ID) + '?output_format=mp3_44100_128',
      {
        method: 'POST',
        headers: {
          'xi-api-key': key.trim(),
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

    if (!upstream.ok) {
      var detalhe = '';
      try { detalhe = (await upstream.text()).slice(0, 300); } catch (e) { /* ignora */ }
      responderJson(res, upstream.status, { error: 'ElevenLabs respondeu ' + upstream.status, detail: detalhe });
      return;
    }

    var buf = Buffer.from(await upstream.arrayBuffer());
    res.status(200);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.end(buf);
  } catch (err) {
    responderJson(res, 502, {
      error: 'Falha ao falar com o ElevenLabs',
      detail: err && err.message ? err.message : String(err)
    });
  }
};
