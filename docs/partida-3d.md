# Motor 3D da partida — estado e decisões

Status: **em integração**. O motor roda dentro do jogo; a ponte com o
`match-engine` ainda não existe.

---

## O que é

`Pitch Engine PRO` — simulação de partida a passo fixo de 60 Hz com render
interpolado. Chegou como um HTML solto de 754 KB e virou:

```
docs/prototipos/simulacao-partida-3d.html   original, preservado como referência
scripts/converter-motor-3d.py               converte o HTML no motor
lib/partida-3d/motor.js                     o motor (3.297 linhas, GERADO)
lib/partida-3d/motor.d.ts                   tipos da API pública
components/partida/campo-3d.tsx             React, cuida do ciclo de vida
components/partida/painel-comparacao.tsx    diagnóstico 3D × match-engine
app/dev/partida-3d/page.tsx                 bancada de teste
```

**`motor.js` é gerado — não edite à mão.** Rode `python scripts/converter-motor-3d.py`.
O script existe para que a conversão seja auditável (12 transformações
declaradas, cada uma com contagem esperada) e repetível. Cada troca **aborta** se
não encontrar o número previsto de ocorrências: um `replace` que não acha nada
falha em silêncio, e o estrago só apareceria em runtime.

---

## Os dois simuladores

O jogo tem dois motores de partida com filosofias opostas:

| | `lib/match-engine.ts` | `lib/partida-3d/motor.js` |
|---|---|---|
| Passo | 1 **minuto** | 1/60 **segundo** |
| Gol | sorteado por xG | a bola cruza a linha |
| Bola | `{x, y}` em % | posição 3D, velocidade, rotação, Magnus |
| Jogadores | atributos numéricos | 22 corpos com IA |
| Estatísticas | calculadas | emergem da simulação |
| Passos em 90 min | 90 | ~324.000 |

**Decisão tomada: o `match-engine` manda no resultado.** O motor 3D é a câmera,
não o árbitro. Sem isso, um gol bonito na tela 3D poderia não bater com o placar
da carreira — e é a carreira que o jogador leva a sério.

Consequência: os bugs de comportamento do 3D (abaixo) não contaminam o
campeonato. Eles importam para o que se **vê**, não para o que se **ganha**.

---

## Ritmo: por que igualar as velocidades é impossível

**Isto foi medido, não estimado** (RTX 3060, 60 fps, `scripts` de calibração).

O 2D tem conta fechada: `minute += 1` por tick, e a taxa vem de
`SPEED_TICKS_PER_SEC`. O 3D foi medido variando `Sim.speed`:

| | tempo de jogo por segundo real |
|---|---|
| 2D **1x** (`normal`, 2 ticks/s) | 120 s |
| 2D 3x (`fast`, 6 ticks/s) | 360 s |
| 2D 5x (`ultra`, 10 ticks/s) | 600 s |
| **3D no máximo** (`mult` 8) | **7,6 s** |

**O 3D no teto é ~16× mais lento que o 2D no piso.** E não há multiplicador que
resolva: `Sim.list` termina em 8, e mesmo estendendo a lista o `cap` de subpassos
por quadro (`Math.min(20, …)`) trava tudo em 20 s/s — ainda 6× mais lento.

A conta confere com a medição: `8 passos/quadro × 1/60 s × 60 fps = 8,00 s/s`
previstos contra **7,6 medidos**.

Traduzindo para o que o jogador sentiria:

| | 90 minutos de jogo levam |
|---|---|
| 2D 1x | **45 segundos** |
| 3D hoje | **11,8 minutos** |

A causa é estrutural: o 2D avança **1 minuto por tick** (90 passos numa
partida); o 3D avança **1/60 de segundo por passo** (324.000 passos). Para
empatar, o 3D teria que rodar 7.200 passos de física por segundo com 22 IAs.

### A solução: o 3D encena, não simula em paralelo

`motor.encenar({ tipo, lado, minuto })` recebe os eventos que o `match-engine`
decidiu e põe a cena no estado certo. A velocidade dos dois **deixa de precisar
bater**, porque eles param de medir a mesma coisa.

Uma partida de 90 min gera ~40 eventos. O motor encena:

| Encena | Não encena (o lance já está em campo) |
|---|---|
| `goal` `penalty` `corner` `foul` | `shot` `shot_on_target` `miss` `post` |
| `red_card` `yellow_card` | `save` `offside` `counter_attack` |
| `kickoff` `halftime` `fulltime` | `sub` `var` `injury` |

`encenar` devolve `false` no segundo grupo — informativo, não é erro.

`definirVelocidade()` e `definirDuracaoDoTempo()` continuam existindo para
controlar o ritmo da encenação, mas já não são a ponte entre os motores.

### Tempo de cena: lance → conclusão → consequência

A primeira versão de `encenar` pulava direto para a conclusão: chamava
`Rules.goal()` e a bola já estava na rede sem nunca ter sido chutada. Teleporte,
não futebol.

Agora cada evento é uma pequena roteirização com tempo próprio, consumida pelo
loop (`_roteiro` + `_passoRoteiro`). Medido no navegador:

| tempo | placar | bola |
|---|---|---|
| 100 ms | 0 | 79 km/h, subindo (0,41 m) |
| 300 ms | 0 | 76 km/h, apex (0,68 m) |
| **500 ms** | **1** | 74 km/h, chegando (0,48 m) |
| 900 ms | 1 | 62 km/h, assentando |

O gol entra quando a bola **chega**, não quando o evento é recebido.

A consequência veio junto. O motor tinha 6 poses, todas de **ação** (o que se faz
com a bola) e nenhuma de **reação**: quem sofria um gol voltava a correr, e um
cartão amarelo não mudava nada no corpo de ninguém. Foram acrescentadas quatro:

| pose | quando |
|---|---|
| `maos_cabeca` | gol sofrido, gol perdido — goleiro e defesa |
| `reclamar` | falta cometida, cartão, pênalti contra |
| `maos_quadril` | resignação, esperando a bola voltar ao meio |
| `aponta` | cobrança ao companheiro |

As reações são dessincronizadas de propósito (`poseT` com variação aleatória e
chance por jogador) — os 11 fazendo a mesma coisa no mesmo instante pareceria
coreografia, não gente.

**Nada disso toca física, IA ou regras**, então o resultado que o `match-engine`
decidiu continua intacto.

Verificação: com a simulação **congelada** (`definirPausa(true)`), encenar um gol
muda 99,4% dos bytes da imagem — com a cena parada, só as poses podem alterar o
que se vê.

---

## Medição do comportamento (30/07/2026)

14,7 minutos simulados na RTX 3060, 52.766 passos de física, extrapolado para 90:

| Métrica | Motor 3D | Futebol real | |
|---|---|---|---|
| Passes certos | 424 × 522 | ~400 por time | ✅ |
| Posse | 47% × 53% | 50/50 médio | ✅ |
| Finalizações | **0** × 12,3 | ~12 por time | ⚠️ |
| No gol | 0 × **12,3** | ~4 por time | ⚠️ |
| Faltas | 30,7 × **43,0** | ~11 por time | ⚠️ |
| Gols | 0 × 0 | ~1,5 × ~1,2 | ⚠️ |

**A física está boa** — passes e posse batem com futebol de verdade. O problema
é a camada de decisão:

1. **O time da casa nunca finaliza.** Zero em 15 minutos contra 2 do visitante.
   Assimetria nessa escala não é aleatoriedade.
2. **Toda finalização vai no gol.** No futebol real é ~1/3. Ou `onTarget` conta
   errado, ou não há erro de pontaria.
3. **Faltas 4× acima do real, e nenhum cartão.** Casa com o que se vê na tela:
   os jogadores se **empilham**, geram contato e viram falta.

Ressalva honesta: extrapolado de 15 minutos, não de uma partida inteira. As
taxas exatas podem mudar em 90 — mas a assimetria casa/fora não se explica por
amostra curta.

---

## Ambiente de teste

Testes de navegador precisam de **GPU real**. Com SwiftShader (render por
software) o motor roda a ~2 fps, o teto de subpassos por quadro estoura e a
simulação anda a passo de tartaruga — 17 segundos de jogo em 45 de tempo real.

```js
chromium.launch({
  headless: false,
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
})
```

Com isso: **61 fps**, 30× mais rápido. `headless: true` não acorda o driver
NVIDIA no Windows.

---

## Pendente

- [ ] **Ponte de eventos**: o `match-engine` decide, o 3D encena. É o que falta
      para os dois deixarem de ser simulações paralelas.
- [ ] **HUD de transmissão** em React (placar, estatísticas, radar). O motor
      escreve em 40 ids que hoje não existem; ele sobrevive graças ao objeto
      inerte `DEAD` do autor original.
- [ ] **Times reais**: hoje a simulação usa BAY/TOT fictícios, não o elenco da
      carreira.
- [ ] Os três bugs de comportamento acima.
- [ ] Calibrar a tabela de velocidades com 90 minutos reais dos dois motores.

### Nota sobre o `dev`

`package.json` tem `"dev": "next dev"` sem flag, mas o projeto tem config de
webpack e o Next 16 usa Turbopack por padrão — o dev server **cai** com erro. O
`build` já passa `--webpack`; o `dev` não. Para rodar a bancada:

```bash
node node_modules/next/dist/bin/next dev --webpack
```

Isso é pré-existente e não tem relação com o motor 3D.
