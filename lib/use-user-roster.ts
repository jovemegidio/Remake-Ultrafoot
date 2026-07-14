"use client"

// Elenco do time do usuario — FONTE UNICA para as telas que montam escalacao.
//
// Este codigo estava DUPLICADO, byte a byte, em app/elenco/gerenciamento/page.tsx e
// app/partida/escalacao/page.tsx — inclusive o mesmo bug:
//
//   const userTeam = getTeamByShort(state.selectedTeamShort || "BGT") || serieATeams[0]
//   const [players] = useState(buildElencoPlayers(userTeam).players)   // <- congela
//
// No Tauri o save hidrata de forma ASSINCRONA. O primeiro render acontece sem time, cai
// no default "BGT" (RB Bragantino), monta o elenco DELE, e o useState — que so roda o
// inicializador uma vez — congela esse elenco para sempre. Por isso a escalacao mostrava
// "nomes aleatorios" (os do Bragantino) enquanto a PARTIDA, que le o elenco na hora,
// mostrava os nomes certos.
//
// Corrigi o gerenciamento e a copia da escalacao ficou com o bug. Unificando aqui para
// que as duas telas nao possam mais divergir.

import { useEffect, useState } from "react"
import { getTeamByShort, serieATeams, type Team } from "@/lib/teams-data"
import { getPlayersForTeam, sortByPosition } from "@/lib/players-data"

function hashString(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0
  }
  return hash
}

export function seededInt(seed: string, salt: string, min: number, max: number): number {
  const range = max - min + 1
  return min + (hashString(`${seed}:${salt}`) % range)
}

export function seededPick<T>(items: readonly T[], seed: string, salt: string): T {
  return items[seededInt(seed, salt, 0, items.length - 1)]
}

// Converte jogadores do seed para o formato da tela de elenco
export function buildElencoPlayers(teamObj: ReturnType<typeof getTeamByShort>) {
  // Sem time nao ha elenco. Antes devolvia um elenco MOCK aqui, que era o que congelava.
  if (!teamObj) return { players: [], bench: [] }
  const rawPlayers = getPlayersForTeam(teamObj)
  if (rawPlayers.length < 11) return { players: [], bench: [] }
  const sorted = sortByPosition(rawPlayers)
  const moralOptions = ["Feliz", "Motivado", "Normal"] as const
  const footOptions = ["Direita", "Esquerda"] as const
  const convert = (p: ReturnType<typeof sortByPosition>[number], idx: number) => ({
    id: idx + 1,
    name: p.nome,
    position: p.pos,
    age: p.idade,
    overall: p.base,
    potential: Math.min(99, p.base + seededInt(`${teamObj.curto}-${p.nome}-${idx}`, "potential", 0, 7)),
    energy: seededInt(`${teamObj.curto}-${p.nome}-${idx}`, "energy", 70, 94),
    rhythm: seededInt(`${teamObj.curto}-${p.nome}-${idx}`, "rhythm", 70, 94),
    moral: seededPick(moralOptions, `${teamObj.curto}-${p.nome}-${idx}`, "moral"),
    foot: seededPick(footOptions, `${teamObj.curto}-${p.nome}-${idx}`, "foot"),
    acceleration: seededPick(["Explosivo", "Controlado", "Equilibrado"] as const, `${teamObj.curto}-${p.nome}-${idx}`, "acceleration"),
    function: p.pos === "GOL" ? "Goleiro" : p.pos === "ZAG" || p.pos === "LD" || p.pos === "LE" ? "Defensivo" : p.pos === "VOL" ? "Box-to-box" : p.pos === "MEI" ? "Meia Armador" : "Finalizador",
    focus: p.pos === "GOL" || p.pos === "ZAG" ? "Defesa" : p.pos === "ATA" || p.pos === "PE" || p.pos === "PD" ? "Ataque" : "Equilibrado",
    height: p.pos === "GOL" || p.pos === "ZAG" ? seededInt(`${teamObj.curto}-${p.nome}-${idx}`, "height", 185, 194) : seededInt(`${teamObj.curto}-${p.nome}-${idx}`, "height", 170, 184),
    pace: p.pos === "GOL" ? 45 : seededInt(`${teamObj.curto}-${p.nome}-${idx}`, "pace", 65, 89),
    shooting: p.pos === "GOL" ? 18 : p.pos === "ZAG" || p.pos === "LD" || p.pos === "LE" ? seededInt(`${teamObj.curto}-${p.nome}-${idx}`, "shooting", 40, 59) : seededInt(`${teamObj.curto}-${p.nome}-${idx}`, "shooting", 60, 84),
    passing: seededInt(`${teamObj.curto}-${p.nome}-${idx}`, "passing", 55, 84),
    dribbling: p.pos === "GOL" ? 30 : seededInt(`${teamObj.curto}-${p.nome}-${idx}`, "dribbling", 50, 79),
    defending: p.pos === "ATA" || p.pos === "PE" || p.pos === "PD" ? seededInt(`${teamObj.curto}-${p.nome}-${idx}`, "defending", 25, 44) : seededInt(`${teamObj.curto}-${p.nome}-${idx}`, "defending", 60, 84),
    physical: seededInt(`${teamObj.curto}-${p.nome}-${idx}`, "physical", 60, 84),
    fintas: p.pos === "PE" || p.pos === "PD" || p.pos === "MEI" ? 4 : p.pos === "ATA" ? 3 : 2,
  })
  return {
    players: sorted.slice(0, 11).map((p, i) => convert(p, i)),
    bench: sorted.slice(11, 18).map((p, i) => convert(p, 11 + i)),
  }
}

export type ElencoPlayer = ReturnType<typeof buildElencoPlayers>["players"][number]

/**
 * Elenco do time do usuario, seguro contra a hidratacao assincrona do save.
 *
 * `teamReady` fica false enquanto o save nao chega — a tela deve mostrar "carregando"
 * em vez de inventar um time. Quando o time resolve (ou muda), o roster e RECARREGADO.
 */
// Aceita null (nao so undefined) porque e esse o tipo de save.selectedTeamShort:
// "nenhum time" chega como null, e o hook so faz um teste de verdade com ele.
export function useUserRoster(selectedTeamShort: string | null | undefined) {
  const resolvedTeam: Team | undefined = selectedTeamShort
    ? getTeamByShort(selectedTeamShort)
    : undefined
  const userTeam = resolvedTeam ?? serieATeams[0]
  const teamReady = Boolean(resolvedTeam)

  const initial = teamReady ? buildElencoPlayers(userTeam) : { players: [], bench: [] }

  const [players, setPlayers] = useState(initial.players)
  const [bench, setBench] = useState(initial.bench)

  useEffect(() => {
    if (!teamReady) return
    const roster = buildElencoPlayers(userTeam)
    setPlayers(roster.players)
    setBench(roster.bench)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamReady, userTeam.curto])

  return { userTeam, teamReady, players, setPlayers, bench, setBench }
}
