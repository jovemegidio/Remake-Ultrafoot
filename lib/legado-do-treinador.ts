/**
 * O LEGADO DO TREINADOR (1.0.377) — a carreira vira história, e não tabela.
 *
 * ─── O QUE JÁ EXISTIA, E POR QUE NÃO BASTAVA ────────────────────────────────
 *
 * `lib/hall-of-fame-engine.ts` monta o consolidado da carreira: jogos, vitórias,
 * aproveitamento, títulos, passagens e uma reputação. Funciona, é lido pela tela
 * do técnico e pelo mercado de treinadores (`lib/coach-market`), e não vai ser
 * substituído por nada aqui.
 *
 * O que faltava é outra coisa. Um consolidado responde "quanto você fez"; ele
 * não responde "o que aconteceu com você". Uma carreira de doze temporadas
 * aparecia como sete números e uma lista de troféus — o mesmo formato de
 * qualquer outra carreira de doze temporadas. Não havia estreia, não havia a
 * noite do acesso, não havia a demissão que ninguém esperava, não havia a
 * invencibilidade de 19 jogos. Sem MOMENTOS, o legado é um extrato.
 *
 * ⚠️ E TUDO AQUI É DERIVADO, NÃO GRAVADO. Nenhum campo novo entra no save: a
 * linha do tempo sai de `SeasonRecord[]` e das passagens que o jogo já guarda.
 * A razão é a de sempre neste projeto — save que cresce a cada versão vira save
 * de 22 MB e trava o apito (1.0.300). Derivar custa milissegundos e alcança
 * quem já jogava: um técnico com dez temporadas gravadas abre a versão nova e
 * encontra a carreira dele inteira contada, sem migração nenhuma.
 *
 * ─── A CONDUTA ─────────────────────────────────────────────────────────────
 *
 * `lib/punicoes.ts` cuida da conduta dos ATLETAS. Não havia nada para o técnico:
 * ele podia ser expulso do banco em toda partida da temporada sem consequência
 * alguma. Aqui a conduta é um índice 0–100 derivado dos incidentes, e ele mexe
 * em duas coisas que já existem — a paciência da diretoria e o que a imprensa
 * publica.
 */

import type { SeasonRecord } from "@/lib/career-types"
import type { ClubTenure, ManagerCareerStats } from "@/lib/hall-of-fame-engine"

// ═══════════════════════════════════════════════════════════════════════════
// A LINHA DO TEMPO
// ═══════════════════════════════════════════════════════════════════════════

export type TipoDeMomento =
  | "estreia" | "titulo" | "acesso" | "rebaixamento" | "chegada" | "demissao"
  | "saida" | "campanha" | "travessia" | "marco"

export interface MomentoDaCarreira {
  id: string
  temporada: number
  tipo: TipoDeMomento
  titulo: string
  detalhe: string
  clubeCurto: string
  /** Quanto o momento pesa na história: 1 comum, 2 notável, 3 inesquecível. */
  peso: 1 | 2 | 3
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0)

/**
 * OS MOMENTOS DE UMA CARREIRA, em ordem.
 *
 * ⚠️ NEM TODA TEMPORADA VIRA MOMENTO, e é isso que faz a linha do tempo valer.
 * Se cada ano gerasse uma entrada, a lista teria o mesmo tamanho da tabela de
 * temporadas que já existe ao lado — e seria a mesma informação com outra
 * fonte. Um ano de meio de tabela, sem título, sem acesso e sem troca de clube,
 * corretamente não deixa marca nenhuma.
 */
export function linhaDoTempoDoTreinador(
  historico: SeasonRecord[],
  passagens: { teamCurto: string; endReason: "fired" | "resigned"; season: number }[] = [],
): MomentoDaCarreira[] {
  if (historico.length === 0) return []

  const ordenado = [...historico].sort((a, b) => a.season - b.season)
  const momentos: MomentoDaCarreira[] = []
  let clubeAnterior = ""
  let titulosAteAqui = 0

  const primeira = ordenado[0]
  momentos.push({
    id: `estreia_${primeira.season}`,
    temporada: primeira.season,
    tipo: "estreia",
    titulo: "A estreia",
    detalhe: `Primeira temporada como treinador, no ${primeira.teamNome}.`,
    clubeCurto: primeira.teamCurto,
    peso: 3,
  })

  for (const s of ordenado) {
    const jogos = s.won + s.drawn + s.lost
    const saldo = s.goalsFor - s.goalsAgainst

    if (s.teamCurto !== clubeAnterior && clubeAnterior !== "") {
      const saida = passagens.find(p => p.teamCurto === clubeAnterior && p.season <= s.season)
      momentos.push({
        id: `chegada_${s.season}_${s.teamCurto}`,
        temporada: s.season,
        tipo: saida?.endReason === "fired" ? "demissao" : "chegada",
        titulo: saida?.endReason === "fired"
          ? `Demitido, e recomeço no ${s.teamNome}`
          : `Assume o ${s.teamNome}`,
        detalhe: saida?.endReason === "fired"
          ? `A passagem pelo ${clubeAnterior} terminou em demissão.`
          : `Nova casa depois do ${clubeAnterior}.`,
        clubeCurto: s.teamCurto,
        peso: saida?.endReason === "fired" ? 3 : 2,
      })
    }
    clubeAnterior = s.teamCurto

    const foiCampeao = s.position === 1 || s.champion === s.teamCurto
    if (foiCampeao) {
      titulosAteAqui++
      momentos.push({
        id: `titulo_${s.season}_${s.competition}`,
        temporada: s.season,
        tipo: "titulo",
        titulo: titulosAteAqui === 1 ? `O primeiro título: ${s.competition}` : `Campeão: ${s.competition}`,
        detalhe: `${s.teamNome} · ${s.points} pontos em ${jogos} jogos${saldo > 0 ? ` · saldo +${saldo}` : ""}.`,
        clubeCurto: s.teamCurto,
        peso: titulosAteAqui === 1 ? 3 : 2,
      })
    }

    if (s.promoted) {
      momentos.push({
        id: `acesso_${s.season}_${s.teamCurto}`,
        temporada: s.season,
        tipo: "acesso",
        titulo: `Acesso com o ${s.teamNome}`,
        detalhe: `${s.position}º lugar em ${s.competition} — subiu de divisão.`,
        clubeCurto: s.teamCurto,
        peso: 3,
      })
    }

    if (s.relegated) {
      momentos.push({
        id: `queda_${s.season}_${s.teamCurto}`,
        temporada: s.season,
        tipo: "rebaixamento",
        titulo: `Rebaixamento com o ${s.teamNome}`,
        detalhe: `${s.position}º em ${s.competition}, ${s.won} vitórias em ${jogos} jogos.`,
        clubeCurto: s.teamCurto,
        peso: 3,
      })
    }

    // ⚠️ CAMPANHA EXCEPCIONAL SEM TÍTULO TAMBÉM É MOMENTO. Um vice com 78% de
    // aproveitamento é uma das melhores temporadas que um técnico faz, e ela
    // desaparecia por completo porque a única coisa registrada era quem levou a
    // taça. Registrar só o campeão apaga metade das carreiras reais.
    if (!foiCampeao && jogos >= 20 && pct(s.won, jogos) >= 65) {
      momentos.push({
        id: `campanha_${s.season}_${s.teamCurto}`,
        temporada: s.season,
        tipo: "campanha",
        titulo: `A campanha de ${s.season}`,
        detalhe: `${s.won} vitórias em ${jogos} jogos (${pct(s.won, jogos)}%) e ${s.position}º lugar.`,
        clubeCurto: s.teamCurto,
        peso: 2,
      })
    }

    if (!foiCampeao && jogos >= 20 && saldo >= 40) {
      momentos.push({
        id: `ataque_${s.season}_${s.teamCurto}`,
        temporada: s.season,
        tipo: "marco",
        titulo: `O time que goleava`,
        detalhe: `${s.goalsFor} gols marcados e saldo de +${saldo} em ${jogos} jogos.`,
        clubeCurto: s.teamCurto,
        peso: 1,
      })
    }
  }

  // A TRAVESSIA: uma sequência longa no mesmo clube é história por si só.
  for (const t of longasPassagens(ordenado)) {
    momentos.push({
      id: `travessia_${t.clubeCurto}_${t.fim}`,
      temporada: t.fim,
      tipo: "travessia",
      titulo: `${t.anos} temporadas no ${t.clubeCurto}`,
      detalhe: `De ${t.inicio} a ${t.fim}, sem sair.`,
      clubeCurto: t.clubeCurto,
      peso: t.anos >= 8 ? 3 : 2,
    })
  }

  return momentos.sort((a, b) => a.temporada - b.temporada || b.peso - a.peso)
}

function longasPassagens(historico: SeasonRecord[]): { clubeCurto: string; inicio: number; fim: number; anos: number }[] {
  const saida: { clubeCurto: string; inicio: number; fim: number; anos: number }[] = []
  let atual: { clubeCurto: string; inicio: number; fim: number; anos: number } | null = null
  for (const s of historico) {
    if (atual && atual.clubeCurto === s.teamCurto) { atual.fim = s.season; atual.anos++ }
    else {
      if (atual && atual.anos >= 5) saida.push(atual)
      atual = { clubeCurto: s.teamCurto, inicio: s.season, fim: s.season, anos: 1 }
    }
  }
  if (atual && atual.anos >= 5) saida.push(atual)
  return saida
}

// ═══════════════════════════════════════════════════════════════════════════
// CONDUTA
// ═══════════════════════════════════════════════════════════════════════════

export type TipoDeIncidente = "expulsao" | "critica_publica" | "atraso" | "briga_com_arbitro" | "recusa_de_entrevista"

export interface IncidenteDoTreinador {
  id: string
  temporada: number
  tipo: TipoDeIncidente
  descricao: string
}

const PESO_DO_INCIDENTE: Record<TipoDeIncidente, number> = {
  expulsao: 12,
  briga_com_arbitro: 16,
  critica_publica: 9,
  recusa_de_entrevista: 5,
  atraso: 4,
}

export const ROTULO_DO_INCIDENTE: Record<TipoDeIncidente, string> = {
  expulsao: "Expulso do banco",
  briga_com_arbitro: "Confronto com a arbitragem",
  critica_publica: "Crítica pública ao clube",
  recusa_de_entrevista: "Recusa de entrevista",
  atraso: "Atraso a compromisso do clube",
}

/**
 * A CONDUTA (0–100). Começa em 100 e só desce com o que você fez.
 *
 * ⚠️ ELA PERDOA COM O TEMPO, e isso não é bondade: sem prescrição, uma expulsão
 * na primeira temporada pesaria igual na décima segunda, e a partir de certo
 * ponto a única jogada racional seria começar outra carreira. Incidentes de
 * mais de três temporadas atrás valem um terço.
 */
export function condutaDoTreinador(incidentes: IncidenteDoTreinador[], temporadaAtual: number): number {
  let dano = 0
  for (const i of incidentes) {
    const idade = Math.max(0, temporadaAtual - i.temporada)
    const fator = idade <= 1 ? 1 : idade <= 3 ? 0.6 : 0.33
    dano += PESO_DO_INCIDENTE[i.tipo] * fator
  }
  return Math.max(0, Math.min(100, Math.round(100 - dano)))
}

export function rotuloDaConduta(v: number): { texto: string; tom: "bom" | "neutro" | "ruim" } {
  if (v >= 85) return { texto: "Conduta exemplar", tom: "bom" }
  if (v >= 65) return { texto: "Sem problemas", tom: "bom" }
  if (v >= 42) return { texto: "Marcado pela arbitragem", tom: "neutro" }
  if (v >= 20) return { texto: "Reincidente", tom: "ruim" }
  return { texto: "Caso de disciplina", tom: "ruim" }
}

/**
 * O QUE A CONDUTA MUDA — os dois efeitos, e nenhum a mais.
 *
 * ⚠️ ELA NÃO MEXE NO PLACAR, DE PROPÓSITO. Fazer conduta virar desempenho em
 * campo seria inventar uma física ("técnico educado ganha mais jogos") que
 * ninguém consegue justificar. O que ela muda é o que a conduta muda na vida
 * real: quanto o clube aguenta antes de demitir, e o tom do que sai publicado.
 */
export function pacienciaDaDiretoriaPelaConduta(conduta: number): number {
  return 0.8 + (conduta / 100) * 0.4
}

export function tomDaImprensaPelaConduta(conduta: number): "favoravel" | "neutro" | "hostil" {
  return conduta >= 70 ? "favoravel" : conduta >= 40 ? "neutro" : "hostil"
}

// ═══════════════════════════════════════════════════════════════════════════
// HALL DA FAMA — insígnias e patamar
// ═══════════════════════════════════════════════════════════════════════════

export interface InsigniaDoTreinador {
  id: string
  nome: string
  descricao: string
  conquistada: boolean
  /** 0 a 1 — quanto falta, para a tela mostrar progresso em vez de cadeado. */
  progresso: number
}

/**
 * AS INSÍGNIAS.
 *
 * ⚠️ CADA UMA PRECISA SER ALCANÇÁVEL POR UM CAMINHO DIFERENTE, senão é uma
 * régua só com várias marcas. "Dez títulos" e "vinte títulos" seriam a mesma
 * insígnia duas vezes; "acesso com três clubes" e "invicto numa temporada" não
 * se parecem em nada, e é isso que faz o conjunto descrever carreiras
 * diferentes em vez de medir a mesma.
 */
export function insigniasDoTreinador(
  stats: ManagerCareerStats,
  historico: SeasonRecord[],
): InsigniaDoTreinador[] {
  const acessos = historico.filter(s => s.promoted)
  const clubesComAcesso = new Set(acessos.map(s => s.teamCurto)).size
  const invictas = historico.filter(s => s.lost === 0 && s.won + s.drawn + s.lost >= 18).length
  const clubesTitulados = new Set(stats.trophies.map(t => t.clubCurto)).size
  const maiorPassagem = Math.max(0, ...stats.clubs.map(c => c.toSeason - c.fromSeason + 1))
  const competicoesGanhas = new Set(stats.trophies.map(t => t.competition)).size

  const faz = (
    id: string, nome: string, descricao: string, atual: number, alvo: number,
  ): InsigniaDoTreinador => ({
    id, nome, descricao,
    conquistada: atual >= alvo,
    progresso: Math.max(0, Math.min(1, atual / alvo)),
  })

  return [
    faz("primeiro_titulo", "O primeiro", "Ganhe o seu primeiro título.", stats.trophies.length, 1),
    faz("colecionador", "Colecionador", "Dez títulos na carreira.", stats.trophies.length, 10),
    faz("poliglota", "De qualquer competição", "Vença quatro competições diferentes.", competicoesGanhas, 4),
    faz("construtor", "Construtor", "Consiga acesso com três clubes diferentes.", clubesComAcesso, 3),
    faz("invencivel", "Invencível", "Uma temporada inteira sem derrota.", invictas, 1),
    faz("longevo", "Longevidade", "Oito temporadas no mesmo clube.", maiorPassagem, 8),
    faz("nomade", "Rodado", "Títulos por três clubes diferentes.", clubesTitulados, 3),
    faz("veterano", "Veterano", "Quinhentas partidas no comando.", stats.totalMatches, 500),
    faz("vencedor", "Máquina de pontos", "Aproveitamento de 65% em 200 jogos ou mais.",
      stats.totalMatches >= 200 ? stats.winRate : 0, 65),
  ]
}

export type PatamarDoTreinador = "iniciante" | "respeitado" | "consagrado" | "lenda" | "imortal"

export interface PosicaoNaHistoria {
  patamar: PatamarDoTreinador
  rotulo: string
  /** Pontuação bruta, para a tela mostrar a distância até o próximo patamar. */
  pontos: number
  /** Quanto falta, de 0 a 1, para o próximo patamar. */
  progressoParaOProximo: number
  proximo: string | null
}

const PATAMARES: { id: PatamarDoTreinador; rotulo: string; minimo: number }[] = [
  { id: "iniciante", rotulo: "Em construção", minimo: 0 },
  { id: "respeitado", rotulo: "Nome respeitado", minimo: 60 },
  { id: "consagrado", rotulo: "Treinador consagrado", minimo: 160 },
  { id: "lenda", rotulo: "Lenda do futebol", minimo: 340 },
  { id: "imortal", rotulo: "Imortal", minimo: 620 },
]

/**
 * O PATAMAR NA HISTÓRIA.
 *
 * ⚠️ ELE NÃO SUBSTITUI `rankInHistory`, que continua respondendo "que posição
 * eu ocupo" e é lida pelo mercado de treinadores. O que este acrescenta é a
 * pergunta que a tela não conseguia responder: QUANTO FALTA. Uma posição que
 * salta de 150 para 50 sem aviso não dá ao jogador nenhum objetivo entre uma e
 * outra — e objetivo entre marcos é o que faz uma carreira longa continuar.
 *
 * A pontuação é aberta de propósito: títulos pesam mais, mas tempo e
 * aproveitamento também contam, para que o técnico que nunca pegou um clube
 * grande ainda consiga atravessar os patamares.
 */
export function posicaoNaHistoria(
  stats: ManagerCareerStats,
  insignias: InsigniaDoTreinador[],
): PosicaoNaHistoria {
  const pontos = Math.round(
    stats.trophies.length * 28
    + stats.totalSeasons * 6
    + stats.winRate * 1.4
    + insignias.filter(i => i.conquistada).length * 15
    + stats.clubs.filter(c => c.trophies > 0).length * 10,
  )

  let indice = 0
  for (let i = 0; i < PATAMARES.length; i++) if (pontos >= PATAMARES[i].minimo) indice = i

  const atual = PATAMARES[indice]
  const proximo = PATAMARES[indice + 1] ?? null
  const progresso = proximo
    ? Math.max(0, Math.min(1, (pontos - atual.minimo) / (proximo.minimo - atual.minimo)))
    : 1

  return {
    patamar: atual.id,
    rotulo: atual.rotulo,
    pontos,
    progressoParaOProximo: Math.round(progresso * 100) / 100,
    proximo: proximo?.rotulo ?? null,
  }
}

/** Resumo curto de uma passagem, para a linha do tempo e o hall. */
export function resumoDaPassagem(t: ClubTenure): string {
  const anos = t.toSeason - t.fromSeason + 1
  const desfecho =
    t.endReason === "fired" ? "demitido"
      : t.endReason === "resigned" ? "pediu para sair"
        : t.endReason === "still_active" ? "em atividade"
          : "fim de contrato"
  return `${anos} temporada${anos > 1 ? "s" : ""} · ${t.matches} jogos · ${t.trophies} título${t.trophies === 1 ? "" : "s"} · ${desfecho}`
}
