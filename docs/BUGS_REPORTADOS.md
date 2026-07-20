# Bugs reportados por jogadores

Registro de relatos vindos de jogadores reais, com a investigação feita e o
estado da correção. Serve para não perder contexto entre sessões.

---

## #1 — Calendário dessincroniza e o clube do usuário é rebaixado sem jogar

**Reportado em:** 2026-07-20 · **Versão:** 1.0.98 · **Estado:** CORRIGIDO (1.0.101)
**Severidade:** alta — arruína a temporada do jogador

> **Resolução.** O relato descrevia DOIS sintomas ("rebaixado com 15 jogos" e
> "fica aguardando sorteio") que se revelaram **três causas distintas**:
>
> 1. Partidas do usuário nunca resolvidas — só os adversários eram simulados.
>    Corrigido em `lib/fixture-catchup.ts` (`ddf6b84`, 14 testes).
> 2. Quatro ligas com `LEAGUE_CALENDAR` divergente do calendário gerado
>    (Série C 30x38, Série D 36x38, Scottish 22x38, Pro League BEL 30x34):
>    `leagueFixturesComplete` era impossível e a temporada nunca fechava.
>    Corrigido em `4cb8123`, achado por `scripts/audit-competicoes.ts`.
> 3. Temporada presa ao contador de semanas mesmo sem competições restantes.
>    Corrigido por `isSeasonOver()` em `ddf6b84`.
>
> Verificado com o calendário REAL da Série A: usuário para na rodada 15,
> 23 partidas pendentes, todas recuperadas, termina 38/38 como os rivais.
>
> ⚠️ A 1.0.98 já continha uma tentativa de correção deste bug (travar o fim de
> temporada até a liga completar). Ela foi publicada **sem teste** e apenas
> trocou o sintoma: virou a carreira presa em "aguardando sorteio". É a razão
> de a lógica agora viver em funções puras com teste.

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

**Reportado em:** 2026-07-20 · **Versão:** 1.0.98 · **Estado:** CORRIGIDO (1.0.100)
**Severidade:** média — mercado fica confuso, mas não quebra a carreira

> **Resolução.** A hipótese inicial ("dado do pool errado") estava certa, mas a
> causa era mais simples: `mapPos` em `lib/transfer-engine.ts` tinha
> `return "MEI"` como fallback e conhecia só 9 códigos. O banco importado marca
> todo atleta fora dos 11 titulares como `BAN` (banco, não posição) — 25.078
> registros. Somados a `CA` e `LAT`, o mercado virava um depósito de meias.
>
> Medido em 53.406 atletas (`scripts/test-market-positions.ts`):
> PD 0 (0,0%) → 2.078 (3,9%) · PE 0 → 2.077 · VOL 53 → 2.155 · MEI 61,2% → 22,0%
>
> Existiam **zero pontas no banco inteiro** — por isso a busca por ponta
> devolvia qualquer outra coisa. Os elencos já tratavam `BAN` corretamente
> (`FILLER_POSITION_ORDER`); só o mercado não.

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
