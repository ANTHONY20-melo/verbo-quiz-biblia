# VERBO — Quiz da Biblia

Jogo de perguntas e respostas sobre a Biblia. Arquivos separados, zero dependencias, 100% offline.

## Como jogar
Abra `index.html` em qualquer navegador (duplo clique). Ou sirva a pasta:

```powershell
# na raiz do projeto sexta-feira
.\sexta.ps1 servir
```

E acesse o endereco informado, navegando ate `projetos/quiz-biblia/`.

## Modos
- **Partida Classica**: 10 perguntas (3 faceis, 4 medias, 3 dificeis), 3 vidas, pontos por tempo e sequencia.
- **Sobrevivencia**: uma vida so, perguntas ate errar ou acabar o baralho.
- **Por Categoria**: Antigo Testamento, Novo Testamento, Personagens, Milagres e Parabolas, Versiculos, Livros da Biblia.
- **Estatisticas**: partidas, acertos, precisao geral e recordes (localStorage `verbo_v1`).

## Conteudo
`banco.js` tem 74 perguntas com texto de apoio e referencia biblica. A resposta correta e sempre a primeira opcao no banco; o jogo embaralha as quatro ao exibir.

## Recursos
- Ajudas por partida: 50:50 e Pular.
- Timer com barra visuais (mais tempo em perguntas dificeis).
- Sons gerados via WebAudio (sem arquivos), com botao para silenciar.
- Teclado: 1-4 respondem, Enter continua, F usa 50:50.
- Recordes por modo + historico de acertos persistidos no navegador.
