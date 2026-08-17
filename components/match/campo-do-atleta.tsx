"use client"

// O CAMPO DA PARTIDA VIVIDA — a visualização que faltava ao modo atleta.
//
// ⚠️ POR QUE ESTE ARQUIVO EXISTE. "Viver a partida" (1.0.329) era 140 linhas de
// texto: placar, narração e três botões. A tela do técnico tem campo, radar,
// escalação e relógio — e a diferença fazia o modo de atleta parecer um
// protótipo do modo de verdade, que foi exatamente o relato do usuário.
//
// ⚠️ E NÃO HÁ SIMULAÇÃO NOVA AQUI. O placar da partida já está FECHADO antes de
// a tela abrir (o motor resolveu a rodada inteira em `jogarProximaRodada`), e
// os momentos do atleta já estão sorteados. Este campo ENCENA o que já foi
// decidido — a mesma regra do motor 3D do jogo. Escrever uma segunda simulação
// para desenhar bonequinho seria criar dois sistemas discordando sobre o mesmo
// jogo, que é o erro recorrente deste projeto.
//
// O XI sai de `getPlayersForTeam`, a MESMA fonte que `hierarquiaDaPosicao` já
// usa para decidir se o atleta joga. Duas listas de elenco para o mesmo clube
// discordariam na primeira transferência.

import { useMemo } from "react"

import { LivePitch } from "@/components/match/live-pitch"
import { getPlayersForTeam } from "@/lib/players-data"
import { getTeamByFileKey, getTeamByShort } from "@/lib/teams-data"
import type { BallPosition } from "@/lib/match-engine"
import type { TipoDeMomento } from "@/lib/partida-do-atleta"
import type { AtletaDaCarreira } from "@/lib/carreira-de-jogador"

/** O XI que o campo desenha: um por posição, do melhor para o pior. */
const ESQUELETO: { pos: string[]; quantos: number }[] = [
  { pos: ["GOL"], quantos: 1 },
  { pos: ["ZAG"], quantos: 2 },
  { pos: ["LD", "LE"], quantos: 2 },
  { pos: ["VOL", "MEI"], quantos: 3 },
  { pos: ["ATA", "PE", "PD"], quantos: 3 },
]

type JogadorNoCampo = {
  id: number; number: number; name: string; position: string; rating: number; stamina: number
}

/**
 * Onze nomes reais do clube, na ordem que o campo espera.
 *
 * Se o clube não tiver atleta suficiente numa posição, a vaga é preenchida com
 * o melhor que sobrou — o campo precisa de onze, e deixar buraco faria a tela
 * parecer quebrada por um detalhe de elenco.
 */
export function onzeDoClube(nomeOuFileKey: string, porFileKey: boolean): JogadorNoCampo[] {
  const clube = porFileKey ? getTeamByFileKey(nomeOuFileKey) : getTeamByShort(nomeOuFileKey)
  const elenco = clube ? getPlayersForTeam(clube) : []
  const ordenado = [...elenco].sort((a, b) => b.base - a.base)
  const usados = new Set<string>()
  const xi: JogadorNoCampo[] = []

  for (const faixa of ESQUELETO) {
    const candidatos = ordenado.filter(p => faixa.pos.includes(String(p.pos)) && !usados.has(p.nome))
    for (let i = 0; i < faixa.quantos; i++) {
      const escolhido = candidatos[i] ?? ordenado.find(p => !usados.has(p.nome))
      if (!escolhido) break
      usados.add(escolhido.nome)
      xi.push({
        id: xi.length + 1,
        number: xi.length + 1,
        name: escolhido.nome,
        position: String(escolhido.pos),
        rating: escolhido.base,
        stamina: 100,
      })
    }
  }
  return xi
}

/**
 * ONDE A BOLA ESTÁ, dado o momento que o atleta está vivendo.
 *
 * Não é posição simulada: é a LEITURA do tipo de momento. Se a narração diz que
 * a bola está no seu pé no último terço, o campo não pode mostrá-la na defesa —
 * era essa incoerência que tornaria a encenação pior que texto nenhum.
 */
export function bolaDoMomento(tipo: TipoDeMomento | undefined, emCasa: boolean): BallPosition {
  const meu = emCasa ? "home" : "away"
  const dele = emCasa ? "away" : "home"
  switch (tipo) {
    case "ataque": return { x: emCasa ? 82 : 18, y: 50, side: meu as BallPosition["side"] }
    case "bola_parada": return { x: emCasa ? 76 : 24, y: 28, side: meu as BallPosition["side"] }
    case "criacao": return { x: 50, y: 50, side: meu as BallPosition["side"] }
    case "defesa": return { x: emCasa ? 24 : 76, y: 58, side: dele as BallPosition["side"] }
    case "entrada": return { x: 50, y: 50, side: meu as BallPosition["side"] }
    default: return { x: 50, y: 50, side: meu as BallPosition["side"] }
  }
}

export function CampoDoAtleta({
  atleta, clubeFileKey, adversarioCurto, emCasa, tipoDoMomento, destaque,
}: {
  atleta: AtletaDaCarreira
  clubeFileKey: string
  adversarioCurto: string
  emCasa: boolean
  tipoDoMomento: TipoDeMomento | undefined
  /** Piscada de gol/chance, como no campo do técnico. */
  destaque?: { side: "home" | "away"; type: "goal" | "card" | "chance" } | null
}) {
  const meuClube = getTeamByFileKey(clubeFileKey)
  const adversario = getTeamByShort(adversarioCurto)

  const { mandante, visitante } = useMemo(() => {
    const meuXI = onzeDoClube(clubeFileKey, true)
    // ⚠️ O ATLETA TEM DE ESTAR EM CAMPO. Ele não vem de `getPlayersForTeam` (foi
    // criado pelo jogador, não semeado), então entrava um XI onde o dono da
    // carreira não aparecia — ver o próprio jogo e não se achar nele é pior do
    // que não ver campo nenhum. Ele toma o lugar do pior atleta da família da
    // posição dele, que é a vaga que ele realmente disputa.
    const familia = ESQUELETO.find(f => f.pos.includes(atleta.posicao))?.pos ?? [atleta.posicao]
    const alvo = [...meuXI].reverse().find(p => familia.includes(p.position))
    const comigo = meuXI.map(p => p.name === alvo?.name
      ? { ...p, name: atleta.nome, position: atleta.posicao, rating: atleta.overall, number: atleta.numero }
      : p)
    const delesXI = onzeDoClube(adversarioCurto, false)
    return emCasa
      ? { mandante: comigo, visitante: delesXI }
      : { mandante: delesXI, visitante: comigo }
  }, [clubeFileKey, adversarioCurto, emCasa, atleta])

  if (!meuClube || !adversario) return null

  return (
    <LivePitch
      ball={bolaDoMomento(tipoDoMomento, emCasa)}
      homeTeam={emCasa ? meuClube : adversario}
      awayTeam={emCasa ? adversario : meuClube}
      homePlayers={mandante}
      awayPlayers={visitante}
      selectedPlayer={null}
      onSelectPlayer={() => { /* o atleta nao escala ninguem: ele e um dos onze */ }}
      flash={destaque ?? null}
    />
  )
}
