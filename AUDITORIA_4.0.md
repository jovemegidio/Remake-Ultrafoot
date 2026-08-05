# O que falta para a 4.0 — auditoria de ponta a ponta

**Base:** 1.0.264 (árvore de trabalho, não o último commit) · **Data:** 05/08/2026
**Método:** gates completos rodados em sandbox com `node_modules` real, carreiras
passivas de 10 temporadas medidas no motor, e inspeção dirigida de código e dados.
Licenciamento continua fora de escopo por pedido — o que já estava registrado no
`COMMERCIAL_READINESS.md` segue valendo sem alteração.

> **Onde os gates rodaram.** `G:\...\Ultrafoot - PC\node_modules` tem **um único
> arquivo** (`desktop.ini`): qualquer `tsc`/`eslint`/`tsx` disparado da pasta do
> projeto aprova sem checar nada. Tudo abaixo foi executado em `C:\uf-tscheck`,
> sincronizado por SHA-256 arquivo a arquivo. O type-check foi **provado com erro
> injetado** (`TS2322` acusado, exit 2) antes de eu acreditar no verde.

---

## Veredito

A 3.0 pediu duas coisas: **um mundo que se administra sozinho** e **uma economia
com peso**. A 1.0.260–1.0.264 entregou a metade barata das duas — a diretoria
renova contratos, a receita reage à divisão, a torcida foi ligada — e o jogo hoje
é **tecnicamente sólido**: 25 dos 26 gates estão verdes, 10 temporadas passivas em
4 clubes rodam sem uma única violação de contrato, elenco ou calendário.

O que falta para a 4.0 não é robustez. É que **o jogo continua sendo o único
agente vivo do mundo**. Fora do clube do usuário, ninguém envelhece, ninguém
treina, ninguém renova, ninguém contrata a não ser por 40 transferências scriptadas
por temporada. E dentro do clube, parar de jogar continua sendo a estratégia
financeiramente ótima: 10 temporadas sem fazer nada multiplicam o caixa do
Manchester City por 4,2.

**A 4.0 é a versão em que o adversário existe.**

---

## O que está são (gates de 05/08/2026)

| Gate | Resultado |
|---|---|
| `tsc --noEmit` | **0 erros** — provado com erro injetado |
| `eslint app components lib hooks` | **0 erros**, 341 avisos |
| `next build --webpack` | **verde** — compila em 59s e gera as **57 páginas** estáticas |
| `qa:competitions` | **73/73** competições com regulamento, ciclo, desempate e fonte |
| `qa:regras` (14 scripts) | 13 verdes; o 14º só falha na sandbox (ver "falsos alarmes") |
| `qa:features` | 375 arquivos varridos, **0** funções ativas lançando "not implemented" |
| `qa:orfaos` | 20/21 — o único vermelho é o `qa-club-names` |
| `qa-long-campaign`, `qa-economia`, `qa-gameplay-matrix`, `qa-save-engine`, `qa-navigation`, `qa-promotion-relegation`, `qa-virada-de-temporada`, `qa-youth-career`, `qa-transfer-window`, `qa-cup-bracket`, `qa-rosters` | todos exit 0 |
| `qa:carreiras` — 4 clubes × **10** temporadas | TUDO OK |
| `qa-club-names` | **VERMELHO** — 3 duplicatas exatas |

Nas 40 temporadas simuladas: nenhum atleta sumiu com contrato em dia, nenhum
contrato vencido ficou pendurado, o elenco nunca furou o piso nem ficou sem
goleiro/defensor/atacante, a semana sempre zerou na virada e o saldo sempre ficou
finito. A Fase 1 e a 1.0.260 seguram.

---

## Gap 1 — O mundo é um cenário, não um adversário (o maior)

**`lib/players-data.ts` não tem uma única ocorrência de "temporada" ou "season".**
O elenco de qualquer clube que não seja o do usuário é remontado do seed a cada
consulta (`getPlayersForTeam`, usado em `use-game-manager.ts:1647-1648` para toda
partida simulada). Consequência direta, verificável por leitura:

- os atletas da CPU **nunca envelhecem** — em 2036 o rival ainda tem o elenco de 2026 com as idades de 2026;
- **não se desenvolvem e não se aposentam** — não há curva de evolução fora do clube do usuário;
- **não têm contrato** — só o usuário perde gente por vencimento;
- **não se lesionam entre partidas**, não cansam e não têm moral persistente.

A única coisa que move um elenco da CPU é `simulateWorldTransferWindow`
([world-market.ts:175](lib/world-market.ts#L175)), que faz **40 negócios por
janela** sobre 525 clubes elegíveis — ~7,6% dos clubes fazem uma contratação por
ano, e sempre no mesmo padrão (clube grande compra do pequeno).

E `tickAIDecisions` ([ai-club-engine.ts:149-156](lib/ai-club-engine.ts#L149-L156))
— o lugar previsto para a IA reagir a crise, trocar técnico e mudar identidade
tática — **ainda é um stub que devolve tudo vazio, e ninguém o chama.**

**Para a 4.0:** envelhecimento e evolução do mundo inteiro na virada de temporada
(barato: uma passada por seed, não por partida), contratos e saídas para clubes da
CPU, e o `tickAIDecisions` saindo do papel. Sem isso, uma carreira de 10 anos é
jogada contra um álbum de figurinhas de 2026.

## Gap 2 — Não agir continua sendo a melhor jogada

Medido agora, 10 temporadas com o técnico sem tomar **nenhuma** decisão
(`scripts/medir-decadencia.ts`):

| Flamengo | T0 | T4 | T8 | T10 |
|---|---|---|---|---|
| Elenco | 28 | 18 | 18 | 18 |
| Overall médio | **74,4** | 72,4 | 65,3 | **60,9** |
| Emergenciais (valor 0) | 0 | 7 | 11 | **13 de 18** |
| Folha/semana | 909.561 | 575.050 | 437.595 | 330.302 |
| Caixa | 250 mi | 462 mi | 734 mi | **878 mi** |

| Clube | Overall T0 → T10 | Caixa T0 → T10 |
|---|---|---|
| Flamengo | 74,4 → 60,9 | 250 mi → 878 mi (**3,5×**) |
| Manchester City | 80,8 → 73,3 | 850 mi → 3,60 bi (**4,2×**) |
| ABC | 53,5 → 54,6 | 1,0 mi → 9,25 mi (**9,3×**) |

Duas leituras:

1. **A diretoria da 1.0.260 funcionou** — em 6 temporadas o Flamengo caía a 42 e
   ficava 18/18 emergencial; hoje está em 67,8 com 10/18. Mas ela **renova e não
   contrata** (é explícito em [diretoria.ts:12](lib/diretoria.ts#L12): "É FALLBACK,
   NÃO GESTÃO COMPLETA"), então o elenco converge para **exatamente 18** — o piso —
   em todos os clubes testados, e a decadência apenas ficou mais lenta.
2. **O incentivo continua invertido.** Em nenhum cenário o caixa deixou de crescer.
   Um clube abandonado vira uma máquina de dinheiro com um elenco de reservas.

**Para a 4.0:** a diretoria precisa ir ao mercado (com caixa, janela e concorrência
com o próprio jogador), e a economia precisa de um custo que não caia junto com a
folha — manutenção, estrutura, contrato de patrocínio que exige desempenho,
premiação e público que **caem** quando o clube afunda. Enquanto receita for fixa e
despesa acompanhar o elenco encolhendo, o caixa só sobe.

## Gap 3 — A dificuldade é um dedo na balança, e não se pode ajustar

[match-engine.ts:520-539](lib/match-engine.ts#L520-L539): sempre que o usuário
entra em campo, o adversário ganha `CPU_DIFFICULTY = 9`, mais até `+7` por
diferença de força e `+2/+3` por clássico/decisão/final — até **+21 em
ataque, defesa e meio**, na escala 40-99. Partidas entre dois times da CPU ficam
neutras.

Isso cria uma assimetria mensurável: o time do usuário rende **pior nas partidas
que ele disputa** do que renderia se a mesma partida fosse simulada. Numa liga de
38 rodadas, a tabela mistura os dois regimes.

E não existe **nenhum seletor de dificuldade** — `CPU_DIFFICULTY` é constante de
código. Um jogo de carreira em 2026 sem escolher dificuldade é uma ausência
notável por si só.

**Para a 4.0:** transformar o número em níveis expostos ao jogador (e deixar o
"justo" como opção real), ou trocar o bônus plano por vantagens que o jogador
entenda — mando de campo, torcida, cansaço de viagem.

## Gap 4 — Alcance: toque e idioma

> ⚠️ **CORREÇÃO (05/08, mesmo dia).** A frase original desta seção — *"escalação e
> gerenciamento não funcionam no dedo"* — **estava errada**. O arraste por toque
> já existia em `hooks/use-arrastar-por-toque.ts` (criado às 11:53, antes desta
> auditoria) e já estava ligado nas duas telas. Meu levantamento procurou
> `onPointer*` como **atributo JSX** e o hook o entrega como **propriedade de um
> objeto** (`propsDoItem`), então o contador deu zero sobre código que existe e
> funciona. Vale a lição de sempre: contar ocorrência de padrão não é ler o
> código. O que segue abaixo é o que sobrou de verdade.

**Toque:** o arraste está resolvido (ver a correção acima). O que faltava era
conteúdo escondido atrás de `hover`: controles com `opacity-0
group-hover:opacity-100` — apagar carreira na splash, trocar o avatar do
treinador — ficam **invisíveis para sempre** num aparelho sem mouse. São poucos
(3 lugares, 2 deles já com `focus-visible`), mas o padrão se repete a cada
controle novo.

**Idioma:** 4 idiomas registrados (pt-BR, en-US, es-ES, it-IT) com **351 chaves**
traduzidas. Contra isso, existem ~2.238 textos literais em JSX e **apenas 11 dos
208 arquivos `.tsx` chamam `useTranslation`**. Ou seja: a infraestrutura está certa
e a cobertura é de ~15% — trocar de idioma hoje traduz o menu e deixa o jogo em
português. (O launcher tem 126 idiomas; o jogo, 4 pela metade.)

## Gap 5 — Conteúdo: o mapa é largo e raso

`node scripts/auditar-divisoes.mjs`:

- **34 países jogáveis, 47 divisões** de 136 possíveis (1ª a 4ª);
- **só o Brasil tem 4 divisões**; 10 países têm 2; **23 países têm uma só**;
- **14 divisões sem acesso/rebaixamento** — MLS, Japão, México e 11 ligas que existem com **1 a 5 clubes reais** cadastrados (Dinamarca, Grécia, Noruega, Chéquia, Chipre, Azerbaijão, Cazaquistão, Bolívia, Paraguai, Peru, Venezuela). O `completarLigaComPool` preenche em runtime, então a liga **roda** — mas o técnico na Dinamarca enfrenta clubes sorteados do pool, não a Superliga;
- **15 divisões em que o calendário real é menor que o declarado** no `LEAGUE_CALENDAR` (Chipre joga 14 e declara 38; Venezuela joga 26 e declara 38). Nenhuma trava — o `qa-virada-de-temporada` passa — mas é a mesma família do bug #1 do `BUGS_REPORTADOS.md`, e as três fontes de verdade de uma liga continuam podendo divergir em silêncio.

**Elencos.** O `audit-squad-gaps.mjs` mede o **seed cru** e acusa 725 clubes
(24,2%) com menos de 18 atletas e 6.247 "inventados". Esse número **não é o que o
jogador vê**: medido depois de todas as camadas (real-positions, Transfermarkt,
curado, importado), em jogo são **5.118 de 75.766 atletas gerados — 6,8%**, e
**2.379 dos 3.094 clubes têm elenco 100% real**.

Também não é verdade que eles se chamem "Reserva XXX 12": o gerador
(`nomePreenchimento`) já monta nome plausível por país. O que existia era um pool
de países curto — sete —, então um clube japonês completava o elenco com nomes
eslavos do pool `Padrao`.

Nas **ligas jogáveis** o buraco é de **1.196 atletas (7,1%) concentrados em 105
clubes**: J-League, K-League, Ligue 2, Equador, Escócia, Dinamarca, Noruega,
Paraguai e Peru. Para **nenhum** deles existe elenco coletado em `tm-squads.json`
— fechar isso é trabalho de **coleta de dados**, não de código.

**Rostos** (`node scripts/auditar-licenciamento.mjs`): 66.649 atletas, **44% com
rosto**, 56% sem. **Escudos: 98%** (2.935/2.994); nas ligas jogáveis faltam **18**,
sendo 16 da Coreia do Sul.

## Gap 6 — Sistema pronto e ainda desligado

`lib/stadium-sectors.ts` (289 linhas: setores, orçamento de obra, preço por setor,
obra com prazo) tem **zero importadores**. A tela de Infraestrutura usa outro
sistema (`stadium-economy`, por níveis). É o mesmo diagnóstico da 3.0, intacto —
falta o modal de obra.

Os outros nove módulos sem importador (`injury-engine`, `training-engine`,
`discipline-engine`, `staff-engine`, `interviews-engine`, `promotion-relegation`,
`save-engine`, `multiplayer-engine`, `player-fame`) **não são funcionalidades
faltando**: cada um tem equivalente vivo dentro do `game-engine`/`use-game-manager`
(lesão, treino, julgamento, comissão, coletiva de imprensa). São duplicatas mortas
— vale apagar para o próximo leitor não se enganar, mas não é backlog de produto.

## Gap 7 — Operação

- **323 mudanças não commitadas** (51 modificadas, 117 apagadas, 155 novas). O
  `package.json` está em **1.0.264** e o último commit é da **1.0.261**: três
  versões de trabalho existem apenas no disco G:.
- **3 clubes duplicados** — Burnley, Cremonese e Real Oviedo estão no catálogo
  curado *e* no pool do seed. Vieram do commit que atualizou Premier/La Liga/Serie
  A para 25/26. É o `qa-club-names` vermelho, e é exatamente a família de bug
  documentada em "cópias de clube".
- **Documentação desencontrada:** `docs/ARQUITETURA_ONLINE_OFFLINE_E_HUB_SOCIAL.md`
  descreve o relay como "pronto mas não público, faltam conta e domínio" — ele está
  no ar desde então. Quem ler o doc decide errado.

---

## Falsos alarmes que eu confirmei serem falsos

Registro porque cada um custaria uma sessão de conserto do que não está quebrado.

1. **"49 clubes das ligas jogáveis sem escudo."** É bug do auditor, não do jogo:
   [auditar-divisoes.mjs:100](scripts/auditar-divisoes.mjs#L100) ainda usa
   `/escudos/${fk}.png` como fallback, e os escudos empacotados viraram **WebP**. O
   runtime (`getEscudoUrl`, escudos-map.ts:342) já resolve `.webp` corretamente.
   Trocando a extensão no script, o número real é **18**. *Corrigir o script.*
2. **"Liverpool e Bayern não estão no seed."** Estão, como *Liverpool Football
   Club* e *Bayern München*. O `audit-squad-gaps.mjs` casa por nome exato na lista
   de clubes de destaque.
3. **"0% dos clubes têm uniforme."** A coluna UNIFORME do `auditar-divisoes` mede
   só o **manifesto do canal da VPS**, ausente localmente. Não diz nada sobre os
   kits empacotados.
4. **`test-escudo-clube-formador` falhando com 8 erros.** Artefato da sandbox
   (`public/escudos` parcial). Os 8 arquivos existem na árvore real — conferido um
   a um. *Este teste só vale rodado no projeto.*

---

## Ordem sugerida para a 4.0

1. **Envelhecer e evoluir o mundo na virada de temporada** (Gap 1). É a mudança
   que mais altera a natureza do jogo e a mais barata das grandes: roda uma vez
   por ano, não por partida.
2. **Diretoria que contrata** (Gap 2, primeira metade). Fecha de verdade o gap
   herdado da 3.0 e tira o elenco do piso de 18.
3. **Despesa que não encolhe junto com o elenco** (Gap 2, segunda metade). Sem
   isso o caixa cresce para sempre e a gestão não tem consequência.
4. **Níveis de dificuldade** (Gap 3) — expõe o que já existe escondido e resolve
   a assimetria entre partida jogada e partida simulada.
5. **Toque nas duas telas do núcleo** (Gap 4). Pointer Events + um caminho de
   toque-para-selecionar; destrava o mobile junto.
6. **Profundidade onde o jogador olha** (Gap 5): elencos reais das ligas grandes
   antes de mais países, e clubes reais nas 11 ligas de fachada.
7. **Higiene** (Gaps 6 e 7): apagar as 9 duplicatas mortas, ligar o estádio por
   setores, remover os 3 clubes duplicados, corrigir o auditor de escudos e
   **commitar as 323 mudanças**.

## Como reproduzir

```bash
# sandbox (o G: não checa nada — ver o aviso do topo)
#   C:\uf-tscheck com node_modules por junction de C:\Ultrafoot\node_modules
cd /c/uf-tscheck
./node_modules/.bin/tsc --noEmit -p tsconfig.json
./node_modules/.bin/eslint app components lib hooks
./node_modules/.bin/tsx scripts/qa-competition-regulations.ts
TEMPORADAS=10 CLUBES="FLA,MCI,ABC,BJU" ./node_modules/.bin/tsx scripts/qa-carreiras-longas.ts
TEMPORADAS=10 CLUBES="FLA,MCI,ABC"     ./node_modules/.bin/tsx scripts/medir-decadencia.ts

# auditores de dados (stdlib apenas — rodam na árvore real)
node scripts/audit-squad-gaps.mjs
node scripts/auditar-licenciamento.mjs
node scripts/auditar-divisoes.mjs        # ⚠️ trocar .png por .webp na linha 100
```

---

## O que a 1.0.265 fechou

### Gap 1 — o mundo passou a envelhecer

`lib/mundo-vivo.ts` (puro, testado) e `lib/temporada-do-mundo.ts` (a ponte que
`players-data` podia usar sem importar o motor — os dois se importam). Todo clube
que não é o do usuário passa pela curva: cresce até ~27, estabiliza, cai depois
dos 30, e entre 36 e 40 pendura as chuteiras. **Determinístico por atleta**, senão
o mesmo zagueiro teria um overall na tela de adversários e outro na partida.

Duas exceções deliberadas: o modo `raw` (editor mostra o cadastro original) e o
**clube do usuário**, cujo elenco vive no motor e já envelhece na virada — envelhecer
duas vezes mostraria o mesmo atleta com duas idades em telas diferentes.

**Quem se aposenta abre vaga na base.** A primeira versão só descontava as saídas
e o mundo encolhia para sempre: medido, os clubes iam de ~26 para ~20 atletas em
10 temporadas, porque a rede de segurança repõe até o *mínimo jogável* e nunca de
volta ao plantel. Com a reposição por crias o mundo mantém o tamanho — 16.891
atletas em 2026, 16.922 em 2036, 16.885 em 2046. Custo medido: +32% numa varredura
dos 642 clubes (224 ms → 295 ms), ou 0,46 ms por clube.

`tickAIDecisions` — o stub que devolvia listas vazias e que ninguém chamava — foi
substituído por `decidirReacoesDaIA`, que roda no avanço de semana. Clube que
emenda 4 derrotas em 5 se fecha (e, com pouca paciência, troca de técnico); quem
emenda 4 vitórias vem para cima. E isso **chega ao campo**: a mentalidade do lado
da máquina passou a existir na partida (`posturasDaIA` no save → `app/partida/ao-vivo`).
Antes só o lado do usuário mandava mentalidade ao motor.

### Gap 2 — não agir deixou de ser a melhor jogada

Duas mudanças, ambas necessárias:

- **A diretoria vai ao mercado** (`decidirContratacoes`): completa o plantel de 24
  quando a janela está aberta, no nível do próprio elenco (mediana −2), com teto
  de folha e reserva de 20% do caixa. Paga **115% do valor de mercado** — comprar
  e revender tem de dar prejuízo, senão vira a impressora de dinheiro que já fez o
  reforço emergencial valer 0.
- **Custo operacional semanal** (`custoOperacionalSemanal`, 22% da receita):
  estádio, base, viagem e administração custam igual com 30 ou com 18 atletas.
  Derivado do `weeklyIncome` já calculado, **não** da divisão do cadastro — ler a
  divisão estática aqui repetia o defeito que a 1.0.260 corrigiu, e na primeira
  tentativa quebrou o ABC (custo de Série C sobre receita de Série D).

Efeito medido, 10 temporadas sem o técnico tomar **nenhuma** decisão:

| Clube | Overall T0→T10 | Caixa T0→T10 | Elenco final | Emergenciais |
|---|---|---|---|---|
| Flamengo | 74,4 → **74,3** (era 60,9) | 250 mi → **318 mi** (era 878 mi) | **24** (era 18) | **0** (era 13) |
| Man City | 80,8 → **79,3** (era 73,3) | 850 mi → **1,40 bi** (era 3,60 bi) | **24** | **0** (era 12) |
| ABC | 53,5 → **62,3** (era 54,6) | 1,0 mi → **1,25 mi** (era 9,25 mi) | **23** | **0** (era 12) |

O elenco parou de convergir para o piso e o caixa parou de multiplicar sozinho.
`qa:carreiras` com **6 clubes × 10 temporadas**: tudo OK.

### Gap 3 — a dificuldade virou escolha

`lib/dificuldade.ts` com cinco níveis. **"Normal" vale exatamente o 9 histórico**,
então carreira em andamento e a calibração do motor não mudam. "Justo" zera o
bônus base **e** o peso do contexto — o adversário joga com a força que tem.
Seletor em Configurações; o motor recebe `cpuBonusBase`/`cpuPesoDoContexto` e cai
no 9 quando a UI não manda nada.

### Gap 4 — o que faltava do toque, e um pouco de idioma

Controles revelados por `hover` ficam visíveis sob `@media (hover: none)`
(`app/globals.css`) — vale também para o próximo controle escrito nesse padrão,
que era o ponto. Cabeçalho e o item "Amistosos" do menu entraram no dicionário
(4 idiomas). **A cobertura de i18n continua parcial**: é projeto de tradução,
não de código.

### Gap 5 — nomes locais onde o preenchimento aparece

Nove pools novos (França, Alemanha, Itália, Inglaterra, Portugal, Holanda, Coreia,
nórdico e andino) cobrindo justamente as ligas dos 105 clubes com elenco gerado.
Um clube japonês não completa mais o elenco com "Nikola Popov". **O dado real
continua sendo o certo** — isto só faz o preenchimento parar de se denunciar.

### Gates da 1.0.265

`tsc` 0 erros · `eslint` 0 erros · **27 scripts de QA verdes** · `qa:carreiras`
6 clubes × 10 temporadas OK. Testes novos no `qa:regras`: `test-mundo-vivo.ts`
(9 verificações) e `test-dificuldade-e-diretoria.ts` (14).

### Continua aberto

Elencos reais para os 105 clubes (coleta de dados), cobertura de i18n, os 3 clubes
duplicados, `scripts/auditar-divisoes.mjs:100` ainda com fallback `.png`, e o
`lib/stadium-sectors.ts` sem tela.
