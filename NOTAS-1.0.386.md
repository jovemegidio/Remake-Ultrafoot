# Ultrafoot 26 — 1.0.386

Base: 1.0.385 (commit `700c3f0`). Pedido: *"corrija o que tem a corrigir e
verifique se não tem algo que tem no EA FC 26 (modo carreira treinador / modo
carreira jogador) que falta em meu jogo ou dá para melhorar"*.

---

## A auditoria: o que o EA FC 26 tem e este jogo JÁ tinha

Antes de escrever qualquer coisa, verifiquei cada pilar no código. **Quase tudo
já existia**, vários com outro nome — o placar do padrão da casa segue subindo:

| Pilar do EA FC / FM | Onde já vive aqui |
|---|---|
| Player Roles + focos | `game-engine.PLAYER_ROLE_INFO` — **66 funções**, com `adequacaoAFuncao` |
| Arquétipos do modo jogador | `carreira-de-jogador.ARQUETIPOS` (maestro, explosivo, matador, muralha, general, guardião) |
| Reconversão de posição | `player.training.positionFocus`, com a mesma cobrança de energia do treino individual |
| Familiaridade de posição | `forcas-individuais` + `modelo-de-jogador` (teto em ~200 partidas) |
| Contratação de comissão | `comissao-tecnica.ts`, com competência, potencial e evolução por experiência |
| Objetivos da diretoria | `board-engine.ts` + `confianca-da-diretoria.ts` |
| Cláusulas do negócio | `clausulas-do-negocio.ts` (1.0.383): revenda, recompra, parcelamento |
| Empréstimo com opção de compra | `TransferRecordType.loan_buy` + `emprestimos.ts` |
| Olheiros por região e nível | `scout-engine.ts`: 4 níveis, 10 regiões, relatório por estágio |
| Goleiro jogável no modo jogador | `PosicaoDoAtleta` inclui `"GOL"`, com arquétipo `guardião` |
| Aposentadoria do atleta | `pontuacaoDeAposentadoria`, `legado-do-atleta` |
| Futebol feminino na carreira | modalidade própria desde a 1.0.322 |
| Vida fora de campo | `vida-noturna-do-atleta`, `patrocinio-pessoal`, `relacoes-do-atleta` |
| Convocação para seleção | `selecao-do-atleta.ts` |

Sobrou **uma** lacuna real, e ela é grande.

---

## ⚠️ A LACUNA: nada no jogo cobrava a falta de minutos

`form` só muda dentro de `processarDesempenhoPartida`, e aquele bloco roda **por
atleta que participou**. Quem ficou no banco mantém a forma **congelada** no
valor em que estava — e a `energia` até o **premia**, porque descansar recupera
energia.

Resultado medido: um centroavante três meses sem jogar entrava na quarta-feira
com a mesma força de quem jogou as doze partidas anteriores. Revezar era de
graça, e emprestar o garoto "para ele ganhar minutos" não tinha efeito nenhum.

⚠️ **E O JOGO JÁ PROMETIA O CONCEITO EM VOZ ALTA.** Em `lib/conversa-atleta.ts`,
linha 269, o atleta diz, com todas as letras:

> *"O que eu preciso é de ritmo de jogo, e isso o senhor é quem me dá."*

A fala existia, a queixa existia, a decisão de escalação existia — e não havia
mecânica atrás. É o padrão de "implementado porém desligado" **pelo avesso**: em
vez de motor sem tela, uma promessa de tela sem motor. Vale como sinal para as
próximas auditorias: **o que os diálogos do jogo prometem é uma lista de
funcionalidades esperadas.**

---

## `lib/ritmo-de-jogo.ts`

Três medidas que pareciam a mesma coisa e não são — e é por isso que somar a
nova não conta nada duas vezes:

| Medida | O que mede | Sobe quando |
|---|---|---|
| `energia` / `fadigaCronica` | quanto ele **aguenta** | descansa |
| `form` | como ele **vem jogando** | joga bem |
| `ritmo` *(novo)* | há quanto tempo ele **não joga** | entra em campo |

O reserva típico tem energia cheia, forma congelada e ritmo no chão — que é
exatamente o estado real de quem passou dois meses no banco.

O efeito entra no `mod` de `forcasDoPlantel`, o canal que já existe para
"condição do elenco" e que todos os chamadores somam por igual aos três setores.
⚠️ **Não entra no `overall` de cada setor**: as médias por setor decidem a
identidade de ataque e defesa do time, e ritmo não é qualidade do atleta — é o
estado dele nesta semana.

⚠️ **E vale para os dois lados pelo simples fato de morar ali.** É a regra que
abre `forca-do-plantel.ts`: a régua é única. O técnico adversário do co-op paga
o mesmo preço por revezar demais.

---

## ⚠️ POR QUE O MECANISMO TEM BÔNUS, E NÃO SÓ PENALIDADE

Neste jogo o adversário da CPU é medido pelo **prestígio do clube**, não por
atletas. Logo, **qualquer efeito de nível de atleta só pode atingir o lado
humano.** Um ritmo que apenas penalizasse seria um imposto silencioso sobre quem
atualizou o jogo, e deslocaria para baixo a calibragem de placar que a 1.0.377
mediu com harness.

Com o bônus, o elenco que joga sua base regularmente fica em `+1` e o que
revezou demais paga: o custo é de uma **decisão do técnico**, não da versão.

Esta é uma consequência do desenho assimétrico do motor que **não estava escrita
em lugar nenhum** — e que vai valer para toda funcionalidade futura de nível de
atleta.

---

## ⚠️ O PORTÃO REPROVOU O DESENHO NA PRIMEIRA EXECUÇÃO

Com o piso em 80, partindo do neutro (85), **uma única semana sem jogar já
derrubava para 78 e cobrava força**. Poupar um titular por uma rodada é gestão
normal de técnico — cobrar por isso transformaria a mecânica no imposto que ela
existe justamente para não ser.

Em 70 a curva ficou com a forma certa: uma ou duas rodadas de descanso saem de
graça (85 → 78 → 71), a penalidade começa por volta da terceira semana e só fica
pesada perto dos dois meses. E o custo de poupar **não é zero**: quem estava
afiado perde o `+1` na hora. A decisão tem preço sem ter punição.

⚠️ **Segunda reprovação, e essa era do TESTE.** Ao descer o piso de 80 para 70,
as amostras de `rotuloDoRitmo` (70 e 85) passaram a cair as duas em "Em ritmo" e
o portão acusou faixas repetidas. O código estava certo. **Retunar limites obriga
a revisitar quem os amostra.**

---

## Correções

- **`acabouDeVoltar` e `rotuloDoHistorico` eram órfãs.** Exportadas desde a
  1.0.374, testadas por script, documentadas como *"serve para avisar na tela"* —
  e **sem um consumidor sequer**. O aviso de fragilidade pós-lesão nunca chegou a
  tela nenhuma. Agora aparece na ficha do atleta, ao lado do ritmo, que é onde a
  informação decide alguma coisa.
- **A ficha lê o registro do motor pela ponte que a própria página já usava** (por
  NOME, como o empréstimo faz): `players` é uma visão estreita da tela e não
  carrega `ritmo` nem `historicoDeLesoes`.

## Correções do que eu mesmo afirmei na 1.0.385

- **"Falta o calendário no modo seleção" estava ERRADO.**
  `app/selecao/calendario/page.tsx` existe, e `buildNavMenuItems` já filtra os
  itens `clubOnly` e injeta os da seleção. A memória que me levou a isso era de
  07/08 e estava vencida. Resíduo real e pequeno: o **menu rápido do controle**
  (`components/input/menu-rapido.tsx`) aponta para `/calendario` sem olhar o modo.
- **`PLAYOFF_TIPADO_COMO_COPA` já estava resolvido** pelo commit `4d37cd1` — o
  conjunto está vazio. Nada a fazer.

---

## Compatibilidade com save antigo

⚠️ **`ritmo` é opcional, e a ausência vale o neutro (85), não zero.** Tratá-la
como zero daria −6 de força a um elenco inteiro na primeira partida depois de
atualizar — punição por atualizar o jogo, exatamente o erro que o retrato de
minutos de `game-engine` já documenta. E a primeira virada de semana depois de
atualizar **não cobra queda de ninguém**: sem retrato anterior, não há semana
medida.

O portão trava as três coisas: valor neutro dá efeito zero, XI sem o campo dá o
`mod` idêntico ao de antes da versão, e neutro explícito é indistinguível de
ausência.

## Catraca de tradução

5284 → **5281**. O painel de ritmo somou uma frase, e ela era **falso positivo**
da heurística: `cn("text-sm font-bold", …)` casa com o padrão de frase porque a
guarda de atributo técnico só olha `className=` colado. Não remodelei o código
para enganar a contagem — paguei extraindo quatro rótulos reais.

⚠️ **E cuidado com o que a heurística enxerga:** extrair "Informações do Atleta"
**não mexeu no número**, porque `TEXTO_JSX` exige o texto na mesma linha entre
`>` e `</`, e aquele estava quebrado em três linhas. Conferir o delta depois de
cada extração, nunca supor.

---

## O que esta versão NÃO tem, e por quê

- **Pré-temporada não zera o ritmo de ninguém.** Seria realista, mas atingiria só
  o lado humano (a CPU é prestígio) e viraria uma penalidade de início de
  temporada em toda carreira. Modelar só a inatividade mantém o custo sob
  controle do técnico.
- **Minutos parciais são estimados por faixa**, porque o motor credita 90 minutos
  fixos a quem participa. Modelar substituição minuto a minuto é trabalho do
  motor de partida, não deste módulo.
- **O menu rápido do controle** continua apontando para o calendário do clube no
  modo seleção. Fica nomeado aqui.

`npm run qa:release` verde. **NÃO buildada e NÃO publicada.**
