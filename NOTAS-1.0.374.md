# 1.0.374 — a carreira de jogador fecha os sete buracos

Esta versão responde a uma lista concreta: sete itens que a auditoria da 1.0.373
apontou como ausentes ou parciais na carreira de jogador. Nenhum deles foi
entregue pela metade, e cada um tem teste próprio ligado ao `qa:gates`.

## 1. A bola voa — física no lugar do sorteio

Até aqui a mira virava um número que multiplicava uma probabilidade, e um dado
decidia. A `mira-do-atleta.tsx` chegou a ter controles de força e curva, mas o
desfecho continuava saindo de `distancia = Math.hypot(...)`: era a mesma roleta,
com outra roupa.

Agora não há dado no desfecho de finalização. Você aponta, a bola sai, e onde
ela termina é geometria — `lib/fisica-do-chute.ts`. O efeito curva o caminho, a
gravidade puxa, o goleiro parte do centro e alcança ou não alcança.

O atleta vive em três lugares, todos **antes** de a bola sair: desvio (a bola
não vai exatamente onde você apontou), potência (o teto de força) e efeito
(quanta curva ele imprime). Depois disso a física é igual para todos — e é por
isso que um atleta comum bem apontado supera um craque mal apontado.

Calibrado contra as taxas do futebol real: pênalti 66%, cara a cara 40%,
finalização na área 16%, de fora 9%, ângulo difícil marcado 5%.

**E o gol da tela agora é o gol da física.** Até a 1.0.373 o desenho ocupava de
24% a 76% da largura e o código aceitava como "dentro" qualquer mira entre 12% e
88%: o jogador mirava visivelmente fora das traves e contava como chute a gol.

## 2. O goleiro joga

Ele recebia as mesmas opções de todo mundo — desarme, drible, finalização — e a
defesa era um `roll` como outro qualquer. Um modo que deixa você escolher ser
goleiro e depois não o faz defender está prometendo o que não entrega.

Agora a defesa é a mesma geometria lida do outro lado: o adversário chuta com
trajetória de verdade, você escolhe para onde se jogar antes de saber onde a
bola vai, e o que decide é a distância entre a sua mão e a bola. Errar o lado
custa metade do alcance — não custa tudo, porque quem se joga errado ainda
estica a perna.

## 3. Altura e pé preferido decidem alguma coisa

Estavam na ficha desde a 1.0.322 e nada os lia. Dado de enfeite é pior que dado
nenhum: ele mente para o jogador na tela de criação, que é o momento em que ele
mais acredita no que o jogo diz.

- **Pé errado** — a bola sai torta e mole. 1 estrela: desvio 2,05×, potência
  0,74×. 5 estrelas anulam a penalidade. Quem escolhe o lado é a **jogada**, não
  o jogador: na bola parada ele bate com o pé bom.
- **Altura** — só no cabeceio, e só lá. Num chute com o pé, ser alto não ajuda a
  acertar o canto; inventar um bônus ali devolveria o enfeite com outro nome.
- **Altura do goleiro** — encurta a subida, não a corrida. O goleirão pega mais
  no ângulo e continua chegando mal no canto rasteiro.

## 4. Os companheiros de time têm nome

O `relacoes.elenco` da 1.0.373 é uma média, e responde "o grupo está com você?".
Não responde quem é o capitão, quem é o craque que decide se a bola chega em
você, nem quem disputa a sua vaga — e sem nome não há história.

São quatro, semeados pelo clube (voltar cinco temporadas depois reencontra as
mesmas pessoas), cada um com um efeito que nenhum outro tem:

| Papel | O que ele muda |
|---|---|
| Capitão | puxa o vestiário inteiro junto com ele |
| Craque | **quantos lances chegam em você** (0,78× a 1,22×) |
| Veterano | multiplica o que o treino rende |
| Concorrente | disputa a sua vaga com o treinador |

O concorrente é o único em que a relação boa **não** é a melhor: ficar amigo dele
ajuda o vestiário e atrapalha a sua vaga. Sem um laço assim, "seja legal com
todo mundo" seria a resposta ótima e as escolhas parariam de ser escolhas.

Junto vieram as quatro relações que faltavam — treinador, empresário, família e
imprensa —, estendendo `RelacoesDoAtleta` em vez de criar um sistema paralelo.
Cada uma move um número que o jogo já lia: piso da confiança, propostas que
chegam, recuperação semanal, velocidade da reputação.

## 5. Cassino, haras e eventos

A 1.0.373 já tinha patrimônio, mas casa, carro, relógio e lancha eram a mesma
decisão com preços diferentes. Nenhum podia dar errado — e com dinheiro sobrando,
comprar tudo é sempre certo. O que faltava não era mais itens: era **risco**.

- **Cassino** — risco imediato, retorno negativo em todas as quatro mesas
  (`chance × pagamento < 1`). É o único sistema do modo cuja decisão ótima é não
  jogar, e existe para que haja uma tentação de verdade. A noite cobra forma
  mesmo quando você ganha, e cobra a família sempre — e a família é justamente o
  laço que multiplica a recuperação. O ciclo se fecha sozinho.
- **Haras** — risco lento, retorno quase neutro. O campeão de haras é melhor no
  papel e pior na prática para quase todo mundo: 74 mil por semana mesmo nas
  semanas em que não corre. A decisão não é "qual rende mais", é "qual eu
  aguento manter". Não pagar devolve o animal, em vez de gerar dívida infinita.
- **Eventos** — cinco convites, dois por semana, e nenhum é só bom. A noite na
  cidade dá moral e cobra forma, família e imprensa: sair para se divertir tem
  preço.

## 6. O legado — a carreira termina com um número

Ela acabava com uma frase e o save parado para sempre. Sem pontuação, sem
conquista, sem com o que comparar: dez temporadas de decisões e nenhum motivo
para recomeçar melhor.

**Pontuação de 0 a 1000**, em seis eixos que competem entre si e têm teto
próprio — longevidade, produção, troféus, patamar, seleção e regularidade. Ela
não é maximizável por uma coisa só: 900 gols travam no teto de produção e não
chegam a 700 pontos. A regularidade é o único eixo que não acumula, e é o
contrapeso de todos os outros.

Dinheiro **não** pontua. O cassino entra pelo lado oposto, como desconto de até
60 pontos — o bastante para custar um patamar, longe do bastante para destruir
uma carreira boa.

**16 conquistas**, verificadas durante a carreira e não só no fim, e um
**ranking** com dez lendas de referência. Sem régua, a primeira carreira do
jogador seria a melhor e a pior de todos os tempos ao mesmo tempo.

> O ranking é local: compara com as lendas de referência e com as suas carreiras
> encerradas. Não há placar online nesta versão.

## 7. O controle finalmente navega

As cinco telas do atleta faziam exatamente isto:

```ts
useTelaGamepad({ aoVoltar: () => hardNavigate("/carreira/jogador") })
```

E só. Pior: `useTelaGamepad` marca a tela como dona do gamepad, e isso **desliga
a `GamepadNavegacaoGlobal`** — a camada que teria dado navegação de graça.
Declarar meio handler deixava a tela pior do que não declarar nenhum, e nenhum
dos dois arquivos, lido sozinho, mostrava o problema.

A geometria de navegação saiu de dentro do componente global para
`lib/focus/varredura.ts` e agora serve os dois. Nas telas do atleta: D-pad e
analógico navegam, A confirma, LB/RB passam de tela, LT/RT rolam. A tela de
partida desliga a troca por ombro — sair da carreira no meio de um lance
pendente seria perder o lance.

## 8. A imprensa escreve sobre você

Era um post gerado ao responder entrevista, e o tom nunca mudava: o mesmo jogo
rendia a mesma frase para quem cultivou a imprensa dez temporadas e para quem a
hostilizou desde a estreia. Agora a mesma atuação vira três manchetes diferentes
conforme o nível da relação — generosa, neutra ou hostil.

## Tela nova: Vida fora de campo

`/carreira/jogador/vida` reúne as cinco relações, os quatro companheiros, os
convites da semana, o cassino, o haras e o legado (pontuação, conquistas e
ranking). Ela **não** duplica a visão geral: parceira, bens, patrocínio e aposta
continuam onde já funcionavam.

A tela de treino já existia — é a `/carreira/jogador/evolucao`.

## Verificação

- `qa:374` — 112 asserções em quatro suítes novas, ligadas ao `qa:gates`:
  `test-fisica-do-chute` (23), `test-corpo-do-atleta` (16),
  `test-relacoes-do-atleta` (30), `test-legado-e-vida-noturna` (43)
- `tsc --noEmit` limpo; `eslint` sem nenhum aviso nos arquivos tocados
- `qa:nss`, `qa:nao-regride`, `qa:idiomas`, `qa:youth-career`, `qa:atleta-copa`,
  `qa:narracao-atleta`, `qa:treino-atleta`, `qa:conversas-atleta`,
  `qa:campo-atleta`, `qa:smoke`, `qa:gameplay`, `qa:simular-persiste`,
  `qa:economia-modelo`, `qa:modelo-jogador`, `qa:sem-clube`,
  `audit-feature-gaps` — todos OK
- `next build --webpack` OK, com `/carreira/jogador/vida` no export estático
- Catraca de tradução: **5618 → 5612**. A tela nova nasceu extraída e os cinco
  rótulos do menu do atleta, chumbados desde que o modo existe, viraram chave.
