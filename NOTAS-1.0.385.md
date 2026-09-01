# Ultrafoot 26 — 1.0.385

Base: 1.0.384 (commit `4d37cd1`). Pedido: *"prepare a 385 sem perder nada das
outras versões, seguindo o projeto de deixar o jogo mais profissional e sólido
(FM24/FM26/EAFC24/25/26)"*.

Árvore viva: **`C:\UF372-clone`**. O `G:` dizia 1.0.381 e não tem
`lib/prelecao.ts`, `scripts/qa-sem-casca.mjs` nem `app/carreira/jogador/partida/`
— conferido por arquivo, não por número de versão.

---

## Como esta versão foi escolhida

A 1.0.384 fechou dizendo que varreu ~20 marcos de FM/EA FC atrás de
funcionalidade faltando e **praticamente tudo já existia**, e que a varredura de
"controle na tela sem consequência no motor" voltou zero. Repetir a mesma busca
daria a mesma resposta.

Então a pergunta mudou: em vez de *o que falta o técnico poder fazer*, **o que o
mundo deixa de fazer quando o técnico não está olhando**. A medição respondeu na
primeira pergunta:

> O jogo só registrava o campeão da competição que o **usuário** disputou.

Eliminado nas oitavas da Copa do Brasil, ninguém levantava a taça. Jogando a
Série B, a Libertadores daquele ano não tinha vencedor. A Premier League de 2031
não teve campeão. E a Supercopa da UEFA — que por definição é Champions contra
Europa League — era disputada contra um clube europeu **sorteado**.

O precedente estava dentro da casa. `lib/finalissima.ts` já enuncia o problema no
cabeçalho, para seleções:

> *"O jogo registra o campeão da competição que o USUÁRIO disputou (career.titles)
> e nada sobre o resto do mundo: se ele ganhou a Copa América, ninguém sabe quem
> levou a Eurocopa."*

Esta versão generaliza aquela saída de seleção para clube.

---

## 1. `lib/campeoes-do-mundo.ts` — o mundo resolve as tacas dele

Módulo **puro e determinístico**, no mesmo desenho de `lib/mundo-vivo.ts`: a
mesma pergunta devolve a mesma resposta em qualquer tela e em qualquer sessão, e
**nada é gravado no save**.

⚠️ **Ele não simula nada, e é de propósito.** Resolver 154 ligas mais as copas por
simulação cobraria o preço que a 1.0.300 já cobrou uma vez (o apito travava com
O(n²) sobre o universo). O campeão sai de um sorteio ponderado pelo prestígio com
semente `competição:temporada`. Quarenta temporadas de quadro completo custam
~160 ms.

Responde por:

| Pergunta | Cobertura |
|---|---|
| `campeaoDaLiga` | 154 divisões |
| `campeaoDaCopaNacional` | 67 países |
| `campeaoDaSupercopaNacional` | 50 supercopas |
| `campeaoContinentalDeClubes` | 7 continentais de clube |
| `campeoesDaTemporada` | o quadro do ponto de vista de quem joga naquela divisão |

**Duas regras que o portão cobra:**

1. **O registro sempre vence a derivação.** Havendo `seasonHistory` daquela
   competição naquela temporada, é ele que responde.
2. **A derivação nunca coroa o clube do usuário.** Um título só é dele se ele o
   ganhou em campo — um palmarés que dá ao técnico uma taça que a carreira não
   tem é pior do que não ter palmarés nenhum.

---

## 2. A supercopa volta a ser campeão contra campeão

Era o defeito mais visível da ausência de palmarés, e ninguém tinha como
perceber: o calendário sorteava um adversário da mesma **região**, então a
Supercopa da UEFA saía contra qualquer clube europeu.

Agora `SuperCupBerth.adversarioCampeaoDe` diz de qual troféu sai o adversário, e
`getUserCupPlan` o resolve:

| Decisão | Adversário |
|---|---|
| Supercopa da UEFA | campeão da Europa League (ou da Champions, se a vaga veio da Europa League) |
| Recopa Sul-Americana | campeão da Sul-Americana ↔ da Libertadores |
| Supercopa do Brasil | campeão da Série A ↔ da Copa do Brasil |
| Supercopa nacional (50 países) | campeão da liga ↔ da copa |

⚠️ **Falha para o comportamento anterior, nunca para nenhum jogo.** Sem campeão
resolvível (save antigo, sem histórico), `adversarioFixo` fica indefinido e o
sorteio de sempre volta a valer.

O Mundial de Clubes e a Intercontinental continuam por sorteio: são torneios de
mais de dois clubes e a lógica deles não cabia junto.

---

## 3. As portas de entrada

Sem tela, seria mais um motor pronto e desligado — o padrão que esta base já
catalogou uma dúzia de vezes.

- **`/historico`**: seção *Campeões do mundo*, temporada a temporada, com os
  títulos do próprio clube destacados em dourado entre os do resto do planeta.
  ⚠️ A tela só pergunta por **temporada concluída**, que é a única condição do
  módulo: numa temporada em andamento a derivação daria um palpite que a tabela
  da liga ao lado desmente.
- **Virada de temporada**: notificação com quem levantou cada taça, dentro de
  `try/catch` — o quadro de campeões nunca pode travar a virada.

---

## ⚠️ A PROVA DE MESA REPROVOU O MÓDULO QUATRO VEZES ANTES DO PORTÃO EXISTIR

Vale mais registrar isto do que o que ficou pronto.

**1. O peso copiado da Finalíssima produzia uma liga sorteada.** `(prestígio − 32)³`
funciona para seleções e falha para clubes: em 40 temporadas da Premier League o
**Hull City levantava quatro títulos**, ao lado de Brentford, Fulham, Sunderland
e Coventry. A potência mede distância até um piso **fixo**, e dentro de uma liga
de elite todo mundo está longe do piso — 98 e 62 viram 66³ e 30³, uma razão de 10
para 1 que a cauda de dezenove clubes engole. O que decide um campeonato é a
distância até o **melhor do torneio**. Trocado por exponencial sobre a diferença
para o topo (softmax).

**2. A cauda somada ganha do topo, e o Brasil escondia isso.** Com o peso já
corrigido, a Copa del Rey saía com `Real Madrid II`, `Osasuna II` e `Barcelona II`
campeões — times B, que a regra real da competição **proíbe de inscrever** — e a
FA Cup com Fylde e Havant & Waterlooville. O Brasil passava porque tem 427 clubes;
a Espanha, com ~800, não. ⚠️ **O mesmo peso passa num pool e falha no outro.**

O primeiro conserto foi um remendo — "os 64 mais prestigiados do país" — e
piorou, porque **o prestígio do pool não está na mesma escala do catálogo curado**
(Hull City chega a 88, acima do Tottenham). Era a armadilha de duas escalas pela
quinta vez nesta base. A solução veio da hierarquia que já existe:
`lib/league-pyramid` decide acesso e queda, e as **duas divisões de cima** são de
onde sai o campeão de uma copa nacional.

**3. O time feminino do Athletico disputava a Copa do Brasil masculina.** Varrer
"as divisões do país" junta as duas modalidades num balde só: `atleticopr_bra__fem`,
do Brasileirão Feminino A2, aparecia como campeão da copa masculina. Mesmo erro
de raiz que a 1.0.335 fechou em três fontes.

**4. `allTeams` não contém o pool.** A Supercopa da Espanha de 2031 saía
`undefined`: o campeão da copa do ano anterior era um clube do pool e
`allTeams.find` não o achava. ⚠️ **Quem deriva de um pool tem de saber ler o mesmo
pool de volta.**

---

## ⚠️ E O PORTÃO NOVO ACUSOU O CÓDIGO CERTO — o defeito era do teste

`qa:campeoes` reprovou "o adversário da supercopa é o campeão do outro torneio"
com *veio MALAGAXE, esperado BAR*. O plano estava certo: o Barcelona não pode ser
o próprio adversário da Supercopa dele. O **teste** é que calculava o esperado
chamando `campeaoDaCopaNacional("la_liga", 2026)` **sem a verdade do save**, e a
derivação livre devolvia o próprio Barcelona.

⚠️ **Comparar duas contas só vale quando as duas partem da mesma entrada.**

## As temperaturas foram medidas, não escolhidas

Com `T = 4` a Bundesliga saía com 63% dos títulos no Bayern e o Brasileirão com
21 de 40 no Flamengo — mais concentrado que a vida real. Em `T = 6`:

| Liga | favorito em 40 temporadas |
|---|---|
| Bundesliga (Bayern) | 42% |
| La Liga (Real Madrid) | 41% |
| Brasileirão (Flamengo) | 32% |
| Premier League (Man City) | 25% |
| Serie A (Inter) | 21% |

O portão trava a faixa **nos dois sentidos** — é a lição do fator de fúria da
1.0.383: nenhum clube passa de metade dos títulos, e o campeão sai do terço de
cima da competição em mais de 80% das temporadas.

---

## 4. Solidez: os Estados Unidos voltaram a ser um país só

A MLS declarava `country: "Estados Unidos"` e a NWSL declarava `country: "EUA"`.
A mesma federação aparecia com dois nomes na seleção de país e era **contada duas
vezes** na catraca de profundidade. `lib/country-normalize` já define "Estados
Unidos" como o nome canônico (o alias `EUA` aponta para ele) — a divergência era
só a NWSL e o catálogo de ligas.

⚠️ **`paises` cai de 72 para 71, e isso NÃO é perda de profundidade.** Nenhum
jogador perdeu uma federação; o número é que estava inflado. É a mesma correção
que a 1.0.384 fez com `ehNomeDeFachada`, e vem acompanhada da trava que impede o
erro de voltar: `qa:paridade` agora reprova dois rótulos de país que normalizam
para o mesmo país.

⚠️ **E a divisão do painel é a DAQUELA temporada, não a de hoje.** A primeira
versão passava sempre o clube atual — e o painel *Clubes treinados*, logo acima
na mesma tela, é a prova de que isso não serve: quem saiu do Brasil para a
Inglaterra veria a Copa do Brasil e a Libertadores listadas numa temporada em que
estava na Premier League. A divisão é o que decide o **país** da copa e a
**confederação** da continental, e o destaque dourado segue o clube da época pelo
mesmo motivo.

---

## ⚠️ A CATRACA DE TRADUÇÃO REPROVOU A VERSÃO, E ESTAVA CERTA

A seção *Campeões do mundo* somou duas frases e a cadeia parou em `qa:traducao`:
**5305 acima do teto de 5303**. É exatamente para isso que ela existe — sem ela,
duas frases viram vinte na versão seguinte e ninguém percebe.

Subir o teto seria o que o cabeçalho do portão proíbe. Em vez disso a tela
`/historico` **inteira** foi extraída: 26 chaves, das quais 24 estavam chumbadas
desde que a tela nasceu. **5303 → 5284.**

Somar duas e pagar vinte e quatro é o único jeito de a catraca andar para o lado
certo.

---

## Catraca de profundidade

| Medida | 1.0.384 | 1.0.385 |
|---|---|---|
| divisões jogáveis | 154 | 154 |
| países | 72 (inflado) | **71** (correto) |
| divisões com copa nacional | 154 | 154 |
| divisões com segunda copa | 10 | 10 |
| divisões com supercopa | 50 | 50 |
| clubes femininos com elenco real | 194 | 194 |
| **competições com campeão conhecido** | — | **278** |

---

## O que esta versão NÃO tem, e por quê

- **Chave completa das copas.** O caminho do usuário é real fase a fase
  (`cup-bracket.ts`), mas os outros confrontos da mesma copa não existem: o
  campeão é derivado, não apurado. Montar a chave inteira de 154 copas é o tipo
  de varredura que a 1.0.300 provou custar caro, e exige decidir onde ela mora
  (save ou derivação) antes de escrever a primeira linha.
- **Continental feminina.** `CONTINENTAIS_DE_CLUBE` é masculino, e o quadro de um
  clube feminino não inventa uma "Champions" para preencher a tabela — a mesma
  regra que a 1.0.382 aplicou às supercopas de países que não disputam nenhuma.
- **`PLAYOFF_TIPADO_COMO_COPA`** segue nomeado em `qa-copa-nacional-preservada`,
  como a 1.0.384 o deixou.

## Achados que ficam registrados, e não foram mexidos

- **`Hull City` tem prestígio 88** em `pool:Inglaterra` — acima do Tottenham (85)
  e do Newcastle (82). O clube entra na Premier League pelo pool com um número
  que o motor de partida também lê. Mexer em prestígio desloca a balança medida
  da 1.0.377 e não cabia junto com esta versão.
- **Nenhuma liga africana ou da Oceania é jogável**: 154 divisões em UEFA (109),
  CONMEBOL (30), AFC (11) e CONCACAF (4). A Austrália tem liga feminina e não tem
  masculina.

`npm run qa:release` verde. **NÃO buildada e NÃO publicada.**
