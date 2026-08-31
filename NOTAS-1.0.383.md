# Ultrafoot 26 — 1.0.383

Base: 1.0.382 (commit `78e3308`). Pedido: *"prepare a 383, verifique o que dá para
evoluir a nível FM24/FM26, EAFC26"*.

## A auditoria antes do código

Cinco "faltas" candidatas caíram na leitura do código — todas já existiam e já
chegam ao motor. Ficam registradas para a próxima auditoria não repetir:

| Achei que faltava | Realidade |
|---|---|
| Bola parada (rotinas, alvo aéreo) | `SetPiecePlan` sai de `gestao-282.ts:331` e é consumido em `match-engine.ts:1398` |
| Instruções individuais | `playerInstructions` chega à partida em `ao-vivo/page.tsx:1097` |
| Hub de dados / xG | `/performance` já tem xG, xGD, conversão, PPG casa/fora, risco médico e projeção de 5 anos em Rust |
| Cláusulas de direitos | `resaleClause`, `ownedPercentage`, `fundPercentage` e `opcaoDeCompra` são aplicados por `repartir-venda.ts` |
| Mentoria, gritos de beira, dinâmica de elenco, imprensa | todos vivos |

O que sobrou são quatro lacunas de verdade, e é isto que a versão entrega.

---

## 1. Preleção — falar com o elenco (`lib/prelecao.ts`)

O jogo tinha o grito de beira de campo (`match-decisions`) e o evento semanal de
vestiário (`dressing-room-engine`). Faltava o ritual do meio: falar com o grupo
**antes, no intervalo e no fim**, com cada atleta reagindo do jeito dele.

Cinco tons (calma, confiança, cobrança, fúria, silêncio). A reação de cada atleta
sai da persona derivada do id (`player-realism.gerarPersona`) — sem `Math.random`,
para que recarregar a tela não sorteie um vestiário novo.

⚠️ **Duas regras estruturais**, ambas para não contar a mesma preleção duas vezes:

- A preleção devolve **moral**, não força. A moral já tem caminho próprio até o
  campo (`userForces`: `mod = … + (moralMedia - 55) / 13`).
- O intervalo é a **única** exceção: a força do XI foi calculada no apito
  inicial, então a conversa do intervalo entra pelo canal `CoachDecisionEffect`
  (o mesmo dos gritos) e a moral só é gravada no apito final, **depois** de
  `processarDesempenhoPartida`.

⚠️ **O portão `qa:prelecao` pegou dois defeitos de desenho meus:**

1. **"Calma" nunca errava** em contexto nenhum — era a escolha dominante e as
   outras quatro viravam enfeite. Agora serenidade como favorito lê como
   conformismo.
2. **A fúria não derrubava ninguém.** O fator partia de 1, então o pior
   temperamento que `gerarPersona` produz (6) ainda dava 0,44 — positivo. A
   promessa do tom ("acende quem tem casca, derruba quem não tem") era texto.
   Hoje é o único fator que **não parte de 1**: o eixo é o temperamento médio,
   gritar não faz nada com quem está no meio da escala, e um elenco de explosivos
   é um elenco em que levantar a voz sai caro.

## 2. Plano contra o adversário (`lib/plano-contra-o-adversario.ts`)

A preparação para o adversário existia desde a 1.0.282 com quatro focos na tela —
e **nenhum deles mudava o jogo**: `bonusPreparacao` devolvia praticamente o mesmo
número para os quatro, `bonusPreparacaoAplicavel282` somava esse número **igual**
em ataque, meio e defesa, e nada olhava para quem estava do outro lado.
Preparar-se contra um bloco baixo rendia o mesmo que contra quem pressiona a saída.

Agora o plano **lê o rival** (pela mesma régua que a partida usa) e devolve
números assimétricos:

- pedra-papel-tesoura entre foco e estilo — **não existe foco bom contra tudo**, e
  nenhum estilo é imune;
- **marcação individual** de até 2 atletas, que reduz os pesos de lance deles e
  **custa** espaço atrás;
- o **dossiê dos olheiros** decide a confiança da leitura: sem observar o rival, a
  comissão lê por cima e o plano pode ser montado contra um time imaginário.

⚠️ O teto **não subiu**: são os mesmos 12 pontos (4 por setor × preparo do
técnico) que o bônus plano já dava. O que passou a existir é **preparar-se
errado**, que agora custa.

⚠️ `cargaDaTatica` saiu de dentro de `app/partida/ao-vivo` para
`lib/tactics-engine.ts`: a tela de preparação e a partida **têm** de ler o mesmo
adversário. Duas cópias seriam a quarta ocorrência do bug "duas escalas" nesta base.

## 3. O olheiro passa a analisar de verdade (`lib/scout-engine.ts`)

`generatePerformanceAnalysis` devolvia **texto chumbado** — "Monitore a fadiga dos
laterais", "Queda de intensidade após os 70 minutos" — para qualquer elenco,
qualquer adversário e qualquer temporada. O nível do centro de dados só **cortava**
a lista fixa com um `slice`: pagar por um centro nível 5 comprava mais frases, não
mais informação. E `/olheiros` exibia aquilo como análise.

Agora cada linha sai de um número do save (energia, lesões, moral, setor fino,
pendurados, contratos a vencer, curva de idade), e o nível de dados decide **quais
leituras** o departamento consegue fazer. A recomendação tática é o foco que
`planoContraOAdversario` premia — o elo que faltava entre o departamento e a
Central de Gestão.

⚠️ **E havia algo pior escondido no mesmo módulo:** quando a missão não encontrava
candidato real no universo, o departamento **inventava um atleta** ("Atleta
123456") com overall, custo e risco de lesão gerados por hash. O relatório
aparecia em "Descobertos" e o atleta não existia em lugar nenhum — não dava para
sondar nem contratar. Agora missão sem achado termina **vazia e marcada**
(`ScoutMission.semAchados`), a tela diz isso, e ela não constrói reputação.

Também foi apagado o **sistema de olheiro paralelo morto** (`assignScout`,
`tickScouting`, `deepScout` sobre um array de módulo não persistido, com zero
consumidores).

## 4. Cláusulas do negócio (`lib/clausulas-do-negocio.ts`)

Três buracos de mercado:

- **Toda transferência era à vista.** Um clube pequeno nunca alcançava um reforço
  caro porque o único caminho era ter o valor cheio no caixa naquela semana. Agora
  dá para parcelar em até 4 anuais — e parcelar **encarece** (6% por parcela),
  senão ninguém pagaria à vista de novo.
- **`resaleClause` era SEMPRE zero.** O campo existe no contrato desde sempre,
  `repartir-venda.ts` já descontava a revenda devida ao clube anterior, e **nada no
  jogo jamais escrevia um valor ali**. A regra estava pronta, testada, e nunca
  disparava. A mesa de negociação agora é a porta de entrada: ceder revenda
  barateia a compra.
- **Não havia recompra.** Vender uma cria com direito de trazê-la de volta por
  valor fixo agora existe, com prazo.

⚠️ **Ordem obrigatória na venda:** `repartirVenda` primeiro (o que nunca foi
nosso), e só o **líquido** é parcelado. Parcelar o bruto faria o clube anterior
esperar as nossas parcelas para receber o que já era dele.

⚠️ **O que NÃO está aqui, e por quê.** Add-on por desempenho do atleta vendido
("+2 mi a cada 10 jogos") exigiria acompanhar jogo a jogo um atleta que passou a
viver num clube da CPU, e `departed-players.ts` guarda apenas **que** ele saiu.
Escrever a cláusula sem o rastreio criaria mais uma promessa que nunca dispara —
exatamente o defeito que os dois itens acima estão consertando.

---

## Qualidade

Quatro portões novos, todos na cadeia `qa:gates`:

| portão | verificações | o que ele impede |
|---|---|---|
| `qa:prelecao` | 9 | tom dominante, fúria que não divide, bola de neve de moral, efeito duplo |
| `qa:plano-adversario` | 11 | foco decorativo, foco universal, teto inflado, marcação sem custo |
| `qa:olheiro-analisa` | 8 | análise que não muda com os dados, atleta inventado |
| `qa:clausulas` | 8 | parcela cobrada duas vezes, soma que não fecha, recompra eterna |

⚠️ **`qa:clausulas` roda 200 semanas** e cobra que o total cobrado seja
**exatamente** o agendado. É a regressão clássica deste projeto: liquidar sem
remover da lista cobra para sempre — irmão do glitch da bilheteria.

⚠️ Um portão existente (`test-gestao-em-campo`) foi **reapontado**, não apagado:
`bonusPreparacaoAplicavel282` virou `preparacaoValeParaEstaPartida282`, que só
responde pela validade. As asserções de validade são as mesmas porque a regra não
mudou.

**Tradução:** a catraca desceu de 5310 para **5303**. As duas telas novas nasceram
extraídas, e as 22 frases que elas somaram foram pagas extraindo o modal de
negociação — uma das telas mais chumbadas do mercado.

## Compatibilidade com save antigo

- `PreparacaoAdversario.marcacaoIndividual` é opcional e `normalizarGestao282`
  espalha a preparação inteira: nada a migrar.
- `parcelasDeTransferencia` e `recompras` nascem `[]` em `onRehydrateStorage` — o
  merge do persist é **raso**, e sem isso a primeira semana avançada numa carreira
  antiga quebraria num `.filter` de `undefined`.
- Sem cláusula nenhuma, `resolverNegocio` devolve o valor cheio à vista: quem
  nunca usa a mesa nova joga exatamente como na 1.0.382.

## Não publicada

Build local apenas, conforme a regra do projeto. `services/cloud-save-server/*`
não foi tocado — são artefatos de publicação, e há trabalho não commitado de outra
sessão neles.
