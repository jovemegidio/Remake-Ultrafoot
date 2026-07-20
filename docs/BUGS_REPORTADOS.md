# Bugs reportados por jogadores

Registro de relatos vindos de jogadores reais, com a investigação feita e o
estado da correção. Serve para não perder contexto entre sessões.

---

## #1 — Calendário dessincroniza e o clube do usuário é rebaixado sem jogar

**Reportado em:** 2026-07-20 · **Versão:** 1.0.98 · **Estado:** aberto
**Severidade:** alta — arruína a temporada do jogador

### Relato

> Campeonato brasileiro começa pro time comandado com os demais com 10-11
> rodadas de diferença e o time comandado por nós só joga 15 jogos e é
> rebaixado. Campeonato paulista meu time jogou 10 jogos, os demais 8 e 9,
> depois parou e começou o brasileiro. Aí fica aguardando sorteio.

### Investigação

Em `lib/use-game-manager.ts`, o avanço de semana simula apenas as partidas dos
adversários:

```ts
roundFixtures = fixtures.filter(
  f => f.week > currentWeek && f.week <= newWeek && !f.isUserMatch && !f.played
)
```

As partidas do usuário (`isUserMatch`) ficam pendentes aguardando disputa
manual. Quem avança o calendário sem jogar acumula partidas não realizadas: os
adversários somam pontos em 38 rodadas e o usuário fica com as poucas que
disputou. O rebaixamento é consequência aritmética, não aleatoriedade.

O "aguardando sorteio" do estadual é o mesmo efeito: o usuário termina fora de
fase em relação ao chaveamento das eliminatórias.

### Direção de correção

Não basta esconder o sintoma. As opções reais:

1. Simular automaticamente (ou dar W.O.) a partida do usuário quando a semana
   avança sem que ela tenha sido disputada.
2. Bloquear o avanço de semana enquanto existir partida do usuário pendente.

A (1) preserva o fluxo atual; a (2) é mais explícita mas interrompe quem quer
avançar rápido. Provavelmente (1) com aviso na central de notificações.

⚠️ Mexe no motor de temporada — exige teste de uma temporada inteira antes de
ir para os jogadores.

---

## #2 — Busca por posição retorna atletas de outra posição

**Reportado em:** 2026-07-20 · **Versão:** 1.0.98 · **Estado:** aberto
**Severidade:** média — mercado fica confuso, mas não quebra a carreira

### Relato

> Na central de transferência "buscar atleta": pesquisa ponta direita aparece
> lateral direito, e no ponta esquerda lateral direito; atacante aparece MEI e
> quando pesquisa volante aparece MEI também.

### Investigação

O filtro em `app/mercado/page.tsx` compara a string exata, sem normalizar:

```ts
if (selectedPosition !== "Tudo" && p.position !== selectedPosition
    && !p.secondaryPositions?.includes(selectedPosition)) return false
```

As opções são `GOL, ZAG, LD, LE, VOL, MEI, PD, PE, ATA`. Como o filtro casa
pelo MESMO campo que a lista exibe, um filtro furado mostraria a posição pedida
na tela. O jogador vê posição DIFERENTE da pedida — o que aponta para o dado do
pool estar errado, não a tela. Suspeita: muitos atletas gravados como MEI por
padrão, e laterais/pontas trocados.

Relacionado (mesma família, já corrigido na 1.0.99): os filtros por setor da aba
"Rede Mundial" comparavam com uma única sigla, então "Ata" escondia pontas,
"Mei" escondia volantes e "Def" escondia laterais.

### Direção de correção

Auditar as posições no banco de jogadores (`lib/players-data.ts`, pool e
`real-positions`), não o componente. Verificar quantos atletas caem em MEI e se
LD/PD e LE/PE estão trocados na importação.
