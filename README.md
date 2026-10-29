# VERBO — Quiz da Biblia

Jogo de perguntas e respostas sobre a Biblia. Arquivos separados, zero dependencias, 100% offline.

## Como jogar
Abra `index.html` em qualquer navegador (duplo clique). Ou sirva a pasta:

```powershell
# na raiz do projeto sexta-feira
.\sexta.ps1 servir
```

E acesse o endereco informado, navegando ate `projetos/quiz-biblia/`.

Producao: https://quiz-biblia-ebon.vercel.app

## Modos
- **Partida Classica**: 10 perguntas (3 faceis, 4 medias, 3 dificeis), 3 vidas, pontos por tempo e sequencia.
- **Sobrevivencia**: uma vida so, perguntas ate errar ou acabar o baralho.
- **Por Categoria**: Antigo Testamento, Novo Testamento, Personagens, Milagres e Parabolas, Milagres, Versiculos, Livros da Biblia.
- **Show da Bencao**: escada de 20 degraus (1 a 10.000), 3 vidas, 2 checkpoints (500 e 3.000) e ajuda CARTA (50% de acerto).
- **Estatisticas**: partidas, acertos, precisao geral e recordes (localStorage `verbo_v1`).

## Conteudo
`banco.js` tem 134 perguntas com texto de apoio e referencia biblica. A resposta correta e sempre a primeira opcao no banco; o jogo embaralha as quatro ao exibir.

Distribuicao: 40 faceis, 53 medias e 41 dificeis, em 7 categorias.

## Recursos
- Ajudas por partida: 50:50 e Pular.
- Timer com barra visuais (mais tempo em perguntas dificeis).
- Sons gerados via WebAudio (sem arquivos), com botao para silenciar.
- Trilha cinematografica no Show da Bencao: batimento cardiaco a partir do degrau 10, suspense a partir do degrau 15, fanfarra e aplausos nos checkpoints e na vitoria.
- Teclado: 1-4 respondem, Enter continua, F usa 50:50.
- Recordes por modo + historico de acertos persistidos no navegador.
- PWA instalavel (funciona offline depois da primeira visita): `manifest.json` + `sw.js` + icones gerados por `icone.ps1`.

## Instalar no celular
1. Abra o endereco de producao no Chrome (Android) ou Safari (iOS).
2. Use "Adicionar na tela inicial" / "Compartilhar > Adicionar para Tela de Inicio".
3. O jogo abre em tela cheia, com icone proprio e sem internet.
