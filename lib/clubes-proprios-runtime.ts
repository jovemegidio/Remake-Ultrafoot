"use client"

/**
 * A PONTE entre o registro de clubes próprios e as listas de `lib/teams-data`.
 *
 * ⚠️ Existe como módulo separado por causa de um ciclo de importação. Se
 * `lib/clubes-personalizados.ts` chamasse `setClubesPersonalizados` direto, ele
 * importaria `teams-data`, que puxa o pool de 8,9 MB — e o módulo de clubes
 * próprios é lido pela tela de nova carreira ANTES de qualquer decisão de
 * elenco. O peso de abertura foi o que motivou separar `time-da-carreira` de
 * `save-system`; repetir o erro aqui devolveria os MB ao arranque.
 *
 * Aqui é o único ponto onde os dois lados se encontram, e quem o chama é o
 * componente de ponte montado no layout.
 */

import {
  listarClubesPersonalizados, comImagensResolvidas, prestigioDeClubeNovo,
  DIVISAO_DE_REFERENCIA_FINANCEIRA, type ClubePersonalizado,
} from "@/lib/clubes-personalizados"
import { setClubesPersonalizados, getTeamsByDivision, type Team } from "@/lib/teams-data"
import { PYRAMIDS, divisionLabel } from "@/lib/league-pyramid"

/**
 * Clube criado -> `Team`, a forma que o resto do jogo entende.
 *
 * `torcida` e `saldo` saem do prestígio pela mesma lógica das outras entradas do
 * catálogo: são consequências do tamanho do clube, não escolhas do jogador.
 * Deixá-los editáveis transformaria a tela de criação num editor de dificuldade
 * — quem quiser um clube rico já tem o editor de equipes para isso.
 */
/**
 * CAIXA DE UM CLUBE CRIADO — sempre o de um clube de SEGUNDA DIVISÃO.
 *
 * ⚠️ O número é a MEDIANA do `saldo` dos clubes de Série B, lida do catálogo, e
 * não uma constante escrita aqui. Este projeto já errou três vezes por inventar
 * um número de dinheiro em vez de importar a escala que o jogo usa (o leilão
 * pagava R$0,8 mi por um overall 82 que vale R$19,3 mi; o caixa dos clubes saía
 * de `prestígio³` e deixava 43% dos leilões sem lance). Mediana, e não média,
 * porque um único clube rico deslocaria o valor.
 *
 * Cai para um piso conhecido se a Série B não puder ser lida — nunca para zero,
 * que faria o clube nascer falido.
 */
export function saldoDeClubeNovo(): number {
  const serieB = getTeamsByDivision(DIVISAO_DE_REFERENCIA_FINANCEIRA)
    .map(t => t.saldo ?? 0)
    .filter(s => s > 0)
    .sort((a, b) => a - b)
  if (!serieB.length) return 12_000_000
  return serieB[Math.floor(serieB.length / 2)]
}

export function clubeProprioComoTime(clube: ClubePersonalizado): Team {
  const resolvido = comImagensResolvidas(clube)
  // Força vem da DIVISÃO (o clube é fraco em campo); caixa vem da Série B (o
  // clube é estável no cofre). São grandezas separadas de propósito — ver o
  // aviso em DIVISAO_DE_REFERENCIA_FINANCEIRA.
  const naDivisao = getTeamsByDivision(clube.divisao).map(t => t.prestigio ?? 0).filter(p => p > 0)
  const prestigio = prestigioDeClubeNovo(clube.divisao, naDivisao.length ? Math.min(...naDivisao) : undefined)
  return {
    nome: resolvido.nome,
    curto: resolvido.curto,
    cidade: resolvido.cidade,
    estado: resolvido.estado,
    pais: resolvido.pais,
    cor1: resolvido.cor1,
    cor2: resolvido.cor2,
    prestigio,
    // A torcida acompanha a força, não o caixa: um clube recém-criado não tem
    // como ter arquibancada de Série B, e é dela que sai a bilheteria.
    torcida: Math.round(prestigio * 1200),
    estadio_cap: resolvido.estadioCap,
    saldo: saldoDeClubeNovo(),
    file_key: resolvido.fileKey,
    estadio_nome: resolvido.estadioNome,
    patrocinador: "",
    escudo_url: resolvido.logoUrl ?? "",
    divisao: resolvido.divisao as Team["divisao"],
  }
}

/**
 * As divisões em que um clube próprio pode nascer NAQUELE país, da base ao topo.
 *
 * Derivado de `PYRAMIDS` em vez de escrito à mão: a lista de divisões de um país
 * muda (a Divisão de Acesso acabou de acrescentar uma a treze deles), e uma
 * cópia aqui ficaria para trás oferecendo divisão que não existe mais — ou
 * escondendo a que passou a existir.
 */
export function divisoesParaClubeProprio(pais: string): { id: string; rotulo: string; nota: string }[] {
  const piramide = PYRAMIDS.find(p => p.country === pais)
  if (!piramide) return []
  // Da BASE para o topo: começar por baixo é o caminho natural de quem cria um
  // clube, e deixá-lo primeiro na lista é o que a tela mostra selecionado.
  return [...piramide.tiers].reverse().map((id, i, todas) => ({
    id,
    rotulo: divisionLabel(id),
    nota: i === 0
      ? `A base da pirâmide. ${todas.length - 1} ${todas.length === 2 ? "degrau" : "degraus"} até o topo.`
      : i === todas.length - 1
        ? "A elite. O clube nasce como o mais fraco dela."
        : `${todas.length - 1 - i} ${todas.length - 1 - i === 1 ? "degrau" : "degraus"} até o topo.`,
  }))
}

/** Relê o registro e publica os clubes em `teams-data`. Idempotente. */
export function sincronizarClubesProprios(): number {
  const clubes = listarClubesPersonalizados()
  setClubesPersonalizados(clubes.map(clubeProprioComoTime))
  return clubes.length
}
