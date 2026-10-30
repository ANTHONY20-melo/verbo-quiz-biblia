# VERBO â€” Quiz da BÃ­blia

Jogo de perguntas e respostas sobre a BÃ­blia. Arquivos separados, zero dependÃªncias, 100% offline.

## Como jogar
Abra `index.html` em qualquer navegador (duplo clique). Ou sirva a pasta:

```powershell
# na raiz do projeto sexta-feira
.\sexta.ps1 servir
```

E acesse o endereco informado, navegando ate `projetos/quiz-biblia/`.

Producao: https://quiz-biblia-ebon.vercel.app

## Modos
- **Partida ClÃ¡ssica**: 10 perguntas (3 fÃ¡ceis, 4 mÃ©dias, 3 difÃ­ceis), 3 vidas, pontos por tempo e sequÃªncia.
- **SobrevivÃªncia**: uma vida sÃ³, perguntas atÃ© errar ou acabar o baralho.
- **Por Categoria**: Antigo Testamento, Novo Testamento, Personagens, Milagres e ParÃ¡bolas, VersÃ­culos, Livros da BÃ­blia.
- **Show da BÃªnÃ§Ã£o**: escada de 20 degraus (1 a 10.000), 3 vidas, 2 checkpoints (500 e 3.000) e ajuda CARTA (50% de acerto).
- **EstatÃ­sticas**: partidas, acertos, precisÃ£o geral e recordes (localStorage `verbo_v1`).

## ConteÃºdo
`banco.js` tem 168 perguntas com texto de apoio e referÃªncia bÃ­blica. A resposta correta Ã© sempre a primeira opÃ§Ã£o no banco; o jogo embaralha as quatro ao exibir.

DistribuiÃ§Ã£o: 44 fÃ¡ceis, 71 mÃ©dias e 53 difÃ­ceis, em 6 categorias. As difÃ­ceis incluem perguntas capciosas de leitura profunda: viÃºva de Sarepta (Elias) x azeite de Eliseu, 12 cestos nos 5.000 x 7 cestos nos 4.000, pai de Judas Iscariotes, servo Malco, NaamÃ£, os 400 profetas de Asera, etc.

## Recursos
- Ajudas por partida: 50:50 e Pular.
- Timer com barra visual (mais tempo em perguntas difÃ­ceis).
- Sons gerados via WebAudio (sem arquivos), com botÃ£o para silenciar.
- Trilha cinematogrÃ¡fica no Show da BÃªnÃ§Ã£o: batimento cardÃ­aco a partir do degrau 10, suspense a partir do degrau 15, fanfarra e aplausos nos checkpoints e na vitÃ³ria.
- Narrador com a voz "Marcos" (ElevenLabs): lÃª a pergunta e a explicaÃ§Ã£o. BotÃ£o no cabeÃ§alho liga/desliga.
- Teclado: 1-4 respondem, Enter continua, F usa 50:50.
- Recordes por modo + histÃ³rico de acertos persistidos no navegador.
- PWA instalÃ¡vel (funciona offline depois da primeira visita): `manifest.json` + `sw.js` + Ã­cones gerados por `icone.ps1`.

## VersÃ£o computador / TV
A partir de 980px de largura o jogo entra automaticamente no layout de duas colunas: pergunta e opÃ§Ãµes Ã  esquerda, escada da bÃªnÃ§Ã£o fixa Ã  direita (durante o Show). A partir de 1600px a tipografia amplia para leitura em televisÃ£o â€” notebook e TV ficam sempre alinhados e centralizados, sem scroll lateral.

## Narrador (voz Marcos / ElevenLabs)

Cadeia de tentativa do `voz.js`:

1. `audio/<slug>.mp3` - audio pre-gerado, funciona 100% offline e sem custo por partida;
2. `api/voz` - proxy Vercel que chama o ElevenLabs com a chave do ambiente (nunca no cliente);
3. Web Speech API - voz nativa do navegador (sempre disponivel como reserva).

Para gerar os MP3 offline (roda uma vez, exige a chave):

```powershell
$env:ELEVENLABS_API_KEY = "sk_..."
cd projetos\quiz-biblia
node gerar-audio.js
```

Para ativar a sintese em tempo real, defina a variavel no ambiente da Vercel:

```powershell
cd projetos\quiz-biblia
vercel env add ELEVENLABS_API_KEY production
```

Variaveis reconhecidas: `ELEVENLABS_API_KEY`, `ULTRON_VOICE_ID` (padrao `xHUwLsLfyqiYOIVTzLRW`), `ULTRON_VOICE_MODEL` (padrao `eleven_multilingual_v2`).

## Instalar no celular
1. Abra o endereco de producao no Chrome (Android) ou Safari (iOS).
2. Use "Adicionar na tela inicial" / "Compartilhar > Adicionar para Tela de Inicio".
3. O jogo abre em tela cheia, com icone proprio e sem internet.

