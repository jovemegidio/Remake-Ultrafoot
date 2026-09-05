# Ultrafoot 26 — 1.0.388

Base: 1.0.387 (commit `bf49cf9`, nunca publicado). Pedido: *"modernize a camada
visual tomando como referencia estetica a interface dos modos Carreira/Manager
do EA Sports FC 26/27 — como DIRECAO DE ARTE, sem copiar identidade"*.

Esta versao mexe **so em como o jogo aparece**. Nenhuma regra, calculo,
economia, simulacao, IA ou persistencia foi alterada, e ha prova disso mais
abaixo.

---

## Antes de tudo: a arvore certa

O ambiente anuncia o `G:` como diretorio de trabalho. Ele diz **1.0.381** e nao
tem **nada da 1.0.358 em diante**. A arvore viva e `C:\UF372-clone`. A checagem
de dez segundos continua valendo como PRIMEIRO comando de qualquer sessao.

## O sistema ja existia — com outro nome

`app/globals.css` ja trazia um "EA FC 26 PREMIUM DESIGN SYSTEM" com `.eafc-card`,
`.stat-card`, `.eafc-btn` e `.glass-panel`. O trabalho foi **tokenizar e
refinar**, nao inventar. Mesmo padrao da 1.0.383, da 1.0.377 e do desempate da
1.0.387: o codigo costuma ja estar la.

**A alavanca eram DOIS hexadecimais.** `#050508` (81 usos) e `#0c0c10` (144)
*eram* o sistema de superficies do jogo, chumbados em 225 lugares — e era por
isso que a atmosfera nunca mudava. Um codemod asseverado os transformou em token
(**249 substituicoes em 75 arquivos**), e a partir dai vestir as 74 telas virou
uma edicao de CSS.

## O que entrou

| Peca | O que mudou |
|---|---|
| **Tokens** | Base canonica `--color-*`, `--radius-*`, `--shadow-*`, `--ease-*`, `--duration-*`, `--space-unit`, mais z-index nomeado, blur e margem segura. Os `--uf-*` viraram alias: uma verdade, dois nomes |
| **`AtmosphericBackground`** | Camada fixa: base em gradiente, tres manchas em deriva assincrona (13/17/21 s), faixa de luz inclinada, piso em perspectiva mascarado, vinheta e ruido. Sem `"use client"` (zero JS no pacote) e **sem `filter: blur()`** |
| **Veu de modal** | **64 veus** em 41 arquivos, com 7 escurecimentos, 5 desfoques e 9 z-index diferentes, unificados em `.uf-veu` |
| **Tipografia** | **131 titulos** `<h1>/<h2>` na condensada (Oswald, que ja estava carregada). `.uf-num` com digito tabular para placar, dinheiro e data |
| **Anel de foco** | Nao existia fora do modo controle. Agora `:where(...):focus-visible` global, com contorno externo escuro |
| **Escritorio do hub** | Passou a aparecer DESFOCADO. Alem da profundidade, resolve o texto discreto que caia sobre as janelas claras do predio |
| **Marca** | `EaMark()` desenhava um selo **"EA"** no rodape de todas as telas. Virou `MarcaDoJogo()` com "UF" |

**Nenhuma dependencia foi adicionada.** A condensada pedida ja estava no bundle.

## As armadilhas que so a captura de tela pegou

### 1. `z-index: 0` num fundo `fixed` vira TAPUME

Um elemento posicionado com z-index 0 pinta **depois** do conteudo de bloco
comum. Telas inteiras sumiram atras do fundo — e o defeito era invisivel para
toda medicao de estilo: o texto estava no DOM, `visibility: visible`,
`opacity: 1`, cor branca, `innerText` correto.

Correcao: `z-index: -1` **e** `body { background-color: transparent }`, os dois
juntos. Filho com z negativo pinta atras do fundo do proprio pai.

O portao ganhou o teste que pega isso: `document.elementFromPoint` no centro de
cada texto. Se quem responde nao e o proprio no nem parente dele, tem coisa por
cima.

### 2. `inset: 0` sob `zoom: 0.8` cobre so 80% da tela

O `body` roda com `zoom: var(--game-view-scale)` e o filho `fixed` herda. Mesma
familia da armadilha do `vh` que as classes `.h-screen`/`.w-screen` ja corrigem.

### 3. Utilitario que chumba `color` vence o `text-*` da tela

`.uf-eyebrow { color }` apagou a cor de marca do "RODADA 1" no escritorio.
Resolvido com `:where()`, especificidade zero: a classe da o padrao, a tela
manda.

### 4. A catraca de traducao conta comentario dentro de JSX

Subiu para 5284 e reprovou. Um comentario JSX com frase entre aspas conta como
texto de tela (a heuristica so pula linha que comeca com `//` ou asterisco), e
`title="..."` tambem conta. Corrigido, e o **teto desceu para 5280**.

## Prova de que nao ha mudanca de logica

Nao basta afirmar. Para cada arquivo alterado, as linhas `-`/`+` do
`git diff -U0` foram NEUTRALIZADAS (conteudo de `className`, comentarios de
linha e de JSX) e comparadas:

- **121 de 131 arquivos ficam identicos** apos a neutralizacao;
- dos 10 restantes, **3 sao da frente paralela** (`lib/game-engine.ts`,
  `app/partida/escalacao/page.tsx`, `lib/i18n/translations/pt-BR.ts`) e
  entraram intactos;
- os 7 meus sao a marca UF, dois nomes de tema, o `dialog.tsx`, o script de
  foco de janela e dois literais de cor.

**Zero delecoes. Zero mudanca de schema — portanto nenhuma migracao**, e nao foi
inventada uma.

## O portao novo: `npm run qa:visual`

Descobre as rotas do proprio `out/` e mede, em **cinco janelas** (1024x640 a
1920x1080, por redimensionamento sem recarregar):

- rolagem lateral;
- se a camada de fundo cobre a janela inteira;
- **oclusao real** por `elementFromPoint`;
- anel de foco visivel;
- erros de console;
- uma segunda passada com **save antigo** (campos opcionais ausentes) e com
  **nomes longos e acentuados**, cobrando que a tela nao caia na rede de erro.

`--capturar <pasta>` grava um PNG por tela para comparar versoes.

Quatro armadilhas do proprio instrumento ficaram documentadas nele: pagina
estatica de `public/` nao e rota do App Router; rota que redireciona derruba as
seguintes em cascata; o `about:blank` que conserta isso gera erro de console
falso; e oclusao precisa saber QUEM tapa (o fundo reprova, a cerimonia nao).

## Matriz de paridade

`npm run qa:matriz` gera `MATRIZ-DE-PARIDADE-VISUAL.md` **a partir do codigo**:
74 telas, 783 acoes declaradas, 0 reprovadas. E o contrato contra perda — se uma
tela sumir ou perder acoes, a proxima geracao mostra o numero caindo.

## O que NAO foi mexido, e por que

**O Tab nao navega por foco.** `components/fc-hub.tsx` o intercepta em fase de
captura, e as Configuracoes o documentam como "Proxima aba (= RB / R1)". E uma
escolha console-first deliberada; o portao a **relata** a cada execucao em vez de
reprova-la. Se um dia tiver de mudar, o ponto e unico: aquele `keydown`.

**`cargo fmt --check` reprova e `clippy` tem 5 avisos** em `src/input/*.rs`.
Ambos pre-existentes: `git status src-tauri` esta vazio. Nao se reformata codigo
de outra pessoa dentro de uma tarefa visual.

**`/leiloes` escreve React #418 no console.** A pagina exportada renderiza o ramo
"sem leilao" e o cliente com save renderiza outro. O diff desta versao ali e so
nome de classe, que nao produz incompatibilidade ESTRUTURAL de hidratacao.

## Entra junto

O que a 1.0.387 preparou e nunca chegou ao jogador: o **desempate pela regra do
pais** (no Brasil, vitorias antes do saldo, em todas as divisoes e estaduais) e o
**limite de estrangeiros em campo** passando a valer.

## Validacao

| Comando | Resultado |
|---|---|
| `npm run qa:gates` (60 portoes) | **exit 0** |
| `tsc --noEmit` | 0 erros |
| `eslint app components lib hooks` | 0 erros (372 avisos pre-existentes) |
| `next build` normal e `TAURI_BUILD=1` | exit 0, 74 rotas |
| `cargo check` / `cargo clippy` | exit 0 / exit 0 com 5 avisos pre-existentes |
| `npm run qa:visual` | aprovado — 69/73 telas x 5 janelas |
| fixtures de save antigo e nomes hostis | 10 telas cada, sem quebra |

⚠️ A notificacao de tarefa em segundo plano disse "exit code 0" numa corrida em
que os portoes REPROVARAM — o comando terminava com `echo`. Ler sempre a linha
de EXIT gravada no log.

## Publicacao

⚠️ **A VPS `179.198.103.30` estava FORA DO AR** no momento desta publicacao:
100% de perda no ping, HTTPS e SSH em timeout. O canal do GitHub
(`build-1.0.388`) foi publicado normalmente e e por ele que o jogo se atualiza
enquanto a VPS nao volta — `lib/updater.ts` le a VPS primeiro e o GitHub como
reserva.

**Falta espelhar na VPS quando ela voltar:**

    ULTRAFOOT_DISCO=C:/UF372-clone ULTRAFOOT_VPS_KEY=~/.ssh/id_ed25519_vps \
      node scripts/deploy-tudo.mjs --publicar --so-jogo
