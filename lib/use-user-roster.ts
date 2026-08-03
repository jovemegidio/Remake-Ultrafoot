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
import { attributesFromOverall } from "@/lib/player-attributes"
import { capGoalkeepers, pickStartingXI, repararEscalacao } from "@/lib/formations"
import type { Player as EnginePlayer } from "@/lib/game-engine"
import tmFisico from "@/data/seeds/tm-fisico.json"

// ─── ALTURA E PÉ REAIS ───────────────────────────────────────────────────────
//
// ⚠️ ANTES ERA TUDO INVENTADO. Altura saía de `seededInt` por posição (185–194
// para GOL/ZAG, 170–184 para o resto) e o pé de um `seededPick` entre dois
// valores. Era por isso que o Neymar aparecia com 1,88m — e não era um caso
// isolado: TODO atleta estava com medida fictícia.
//
// Agora o dado vem do Transfermarkt, casado pelo ID do próprio atleta (`ft`), e
// não pelo nome — há 1.660 nomes repetidos entre clubes, e casar por nome daria
// a medida do xará. Quem não tem ficha lá continua na estimativa por posição.

const FISICO = (tmFisico as { atletas?: Record<string, { a?: number; p?: string }> }).atletas ?? {}
const PE_LEGIVEL: Record<string, "Direita" | "Esquerda" | "Ambidestro"> = {
  D: "Direita", E: "Esquerda", A: "Ambidestro",
}

/** `ft` é "465821-1726761975"; o ID é a parte antes do hífen. */
function fisicoDe(ft?: string): { altura?: number; pe?: "Direita" | "Esquerda" | "Ambidestro" } | null {
  if (!ft) return null
  const dados = FISICO[ft.split("-")[0]]
  if (!dados) return null
  return { altura: dados.a, pe: dados.p ? PE_LEGIVEL[dados.p] : undefined }
}

/**
 * PESO a partir da altura real.
 *
 * O Transfermarkt não publica peso, então ele continua estimado — mas agora
 * DERIVA da altura, e não de um sorteio independente. Era a combinação solta que
 * produzia absurdos como 1,88m com 76kg. A faixa de IMC é a de atleta
 * profissional (22–24), com goleiro e zagueiro no topo e ponta/meia embaixo.
 */
function pesoDe(alturaCm: number, pos: string, semente: string): number {
  const encorpado = pos === "GOL" || pos === "ZAG" || pos === "ATA"
  const imc = (encorpado ? 23.2 : 22.2) + seededInt(semente, "imc", 0, 12) / 10
  const m = alturaCm / 100
  return Math.round(imc * m * m)
}

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
  // capGoalkeepers: rebaixa goleiros EXCEDENTES para o fim da lista (=> banco).
  //
  // Sem isso, sortByPosition poe GOL primeiro e o slice(0,11) escalava OS TRES goleiros
  // de um elenco com 3 — era o bug "o time esta com 3 goleiros" que o usuario reportou.
  // Ja estava corrigido no elenco da PARTIDA, mas nao aqui (que alimenta Gerenciamento,
  // Escalacao e Atribuicoes) — por isso a tela continuava mostrando 3 GOL.
  const sorted = capGoalkeepers(sortByPosition(rawPlayers), (p) => p.pos)
  const moralOptions = ["Feliz", "Motivado", "Normal"] as const
  const footOptions = ["Direita", "Esquerda"] as const
  const convert = (p: ReturnType<typeof sortByPosition>[number], idx: number) => ({
    id: idx + 1,
    name: p.nome,
    position: p.pos,
    age: p.idade,
    // Teto rígido de 99: relatos de "overall 99+" vinham de dados/saves com valor
    // acima do máximo. O overall NUNCA passa de 99 nem cai abaixo de 1.
    overall: Math.min(99, Math.max(1, p.base)),
    potential: Math.min(99, Math.max(1, p.base) + seededInt(`${teamObj.curto}-${p.nome}-${idx}`, "potential", 0, 7)),
    energy: seededInt(`${teamObj.curto}-${p.nome}-${idx}`, "energy", 70, 94),
    rhythm: seededInt(`${teamObj.curto}-${p.nome}-${idx}`, "rhythm", 70, 94),
    moral: seededPick(moralOptions, `${teamObj.curto}-${p.nome}-${idx}`, "moral"),
    foot: fisicoDe(p.ft)?.pe ?? seededPick(footOptions, `${teamObj.curto}-${p.nome}-${idx}`, "foot"),
    acceleration: seededPick(["Explosivo", "Controlado", "Equilibrado"] as const, `${teamObj.curto}-${p.nome}-${idx}`, "acceleration"),
    function: p.pos === "GOL" ? "Goleiro" : p.pos === "ZAG" || p.pos === "LD" || p.pos === "LE" ? "Defensivo" : p.pos === "VOL" ? "Box-to-box" : p.pos === "MEI" ? "Meia Armador" : "Finalizador",
    focus: p.pos === "GOL" || p.pos === "ZAG" ? "Defesa" : p.pos === "ATA" || p.pos === "PE" || p.pos === "PD" ? "Ataque" : "Equilibrado",
    // ALTURA REAL quando o atleta tem ficha no Transfermarkt; senão, a estimativa
    // por posição de sempre. Ver `fisicoDe` no topo do arquivo.
    height: fisicoDe(p.ft)?.altura
      ?? (p.pos === "GOL" || p.pos === "ZAG"
        ? seededInt(`${teamObj.curto}-${p.nome}-${idx}`, "height", 185, 194)
        : seededInt(`${teamObj.curto}-${p.nome}-${idx}`, "height", 170, 184)),
    weight: pesoDe(
      fisicoDe(p.ft)?.altura
        ?? (p.pos === "GOL" || p.pos === "ZAG"
          ? seededInt(`${teamObj.curto}-${p.nome}-${idx}`, "height", 185, 194)
          : seededInt(`${teamObj.curto}-${p.nome}-${idx}`, "height", 170, 184)),
      p.pos,
      `${teamObj.curto}-${p.nome}-${idx}`,
    ),
    // Atributos REALISTAS por posição: gerador canônico do motor (perfis por
    // família + pesos + reconciliação do overall), com semente por jogador para
    // variação individual. É o MESMO usado na partida — editor, elenco e simulação
    // não divergem mais. Antes eram faixas genéricas (ponta = centroavante).
    ...attributesFromOverall(Math.min(99, Math.max(1, p.base)), p.pos, `${teamObj.curto}-${p.nome}-${idx}`),
    fintas: p.pos === "PE" || p.pos === "PD" || p.pos === "MEI" ? 4 : p.pos === "ATA" ? 3 : 2,
  })
  return {
    players: sorted.slice(0, 11).map((p, i) => convert(p, i)),
    // O banco era cortado em sete atletas (slice 11..18), embora os elencos
    // licenciados tragam até 25/33 jogadores. Mantemos todo o restante disponível;
    // a própria tela já possui rolagem para acomodá-los.
    bench: sorted.slice(11).map((p, i) => convert(p, 11 + i)),
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
function enginePlayerToElenco(p: EnginePlayer) {
  return {
    id: p.id,
    name: p.name,
    position: p.position,
    age: p.age,
    // Teto rígido de 99 (relato "overall 99+"): mesmo que o motor/save traga um
    // valor corrompido acima de 99, a tela nunca exibe além de 99.
    overall: Math.min(99, Math.max(1, p.overall)),
    // Potencial NUNCA pode ser menor que o overall atual (relato: overall 75 com
    // potencial 73), nem passar de 99. Quando o atleta evolui alem do potencial
    // inicial, o teto sobe junto — mas sempre limitado a 99.
    potential: Math.min(99, Math.max(Math.min(99, Math.max(1, p.overall)), p.potential)),
    energy: p.energy,
    rhythm: p.form,
    moral: p.morale === "Feliz" ? "Feliz" as const
      : p.morale === "Motivado" ? "Motivado" as const : "Normal" as const,
    foot: "Direita" as const,
    acceleration: "Equilibrado" as const,
    function: p.position === "GOL" ? "Goleiro" : p.position === "ZAG" || p.position === "LD" || p.position === "LE" ? "Defensivo" : p.position === "VOL" ? "Box-to-box" : p.position === "MEI" ? "Meia Armador" : "Finalizador",
    focus: p.position === "GOL" || p.position === "ZAG" ? "Defesa" : p.position === "ATA" || p.position === "PE" || p.position === "PD" ? "Ataque" : "Equilibrado",
    height: p.position === "GOL" || p.position === "ZAG" ? 190 : 179,
    // Mesmo formato do outro caminho: as duas listas se encontram nas telas de
    // elenco, e um campo a menos aqui quebra o tipo compartilhado.
    weight: pesoDe(p.position === "GOL" || p.position === "ZAG" ? 190 : 179, p.position, `engine-${p.name}-${p.id}`),
    pace: p.pace,
    shooting: p.shooting,
    passing: p.passing,
    dribbling: p.dribbling,
    defending: p.defending,
    physical: p.physical,
    shirtNumber: p.shirtNumber,
    fintas: p.position === "PE" || p.position === "PD" || p.position === "MEI" ? 4 : p.position === "ATA" ? 3 : 2,
  }
}

// Reexportado para as telas que ja importam daqui; a implementacao mora em
// lib/escalacao-ids.ts, sem dependencia de seeds, para poder ser testada isolada.
export { resolverIdsDosTitulares } from "@/lib/escalacao-ids"

export function useUserRoster(
  selectedTeamShort: string | null | undefined,
  engineSquad: EnginePlayer[] = [],
  /**
   * Formacao do tecnico. So importa quando a escalacao precisa ser CONSERTADA
   * (titular vendido, lesionado, XI incompleto): o reparo completa o time pelos
   * slots que o esquema pede. Sem ela o conserto assumia 4-3-3 e devolvia um
   * time com a forma errada para quem joga 5-3-2 ou 4-2-3-1.
   */
  formation = "4-3-3",
) {
  const resolvedTeam: Team | undefined = selectedTeamShort
    ? getTeamByShort(selectedTeamShort)
    : undefined
  const userTeam = resolvedTeam ?? serieATeams[0]
  const teamReady = Boolean(resolvedTeam)

  const rosterFromSource = () => {
    if (!teamReady) return { players: [], bench: [] }
    if (engineSquad.length >= 11) {
      const available = engineSquad.filter(p => !p.loanedOut)
      const declared = available.filter(p => p.isStarter)
      // NAO descarta o XI do tecnico quando a conta nao fecha em 11: conserta.
      // Um 12o titular (promessa na conversa com reserva) ou um titular vendido
      // derrubava a escalacao inteira de volta para a automatica — e a tela
      // gravava a automatica por cima, perdendo a escalacao salva para sempre.
      const reparado = repararEscalacao(declared, available, p => p.position, p => p.overall, formation)
      const starters = reparado?.starters
        ?? pickStartingXI(available, p => p.position, p => p.overall, formation).starters
      const starterIds = new Set(starters.map(p => p.id))
      return {
        players: starters.map(enginePlayerToElenco),
        bench: available.filter(p => !starterIds.has(p.id)).map(enginePlayerToElenco),
      }
    }
    return buildElencoPlayers(userTeam)
  }

  const initial = rosterFromSource()

  const [players, setPlayers] = useState(initial.players)
  const [bench, setBench] = useState(initial.bench)

  // Inclui nome/status, nao apenas ID. Assim uma contratacao, venda, emprestimo ou
  // troca de titular atualiza a tela mesmo se um fornecedor externo reutilizar um ID.
  const squadIdentity = engineSquad
    .map(p => `${p.id}:${p.name}:${p.isStarter ? 1 : 0}:${p.loanedOut ? 1 : 0}`)
    .sort()
    .join("|")
  useEffect(() => {
    if (!teamReady) return
    const roster = rosterFromSource()

    // SO troca o estado quando o CONTEUDO mudou.
    //
    // `rosterFromSource` monta objetos novos toda vez (enginePlayerToElenco
    // retorna um literal), entao `setPlayers` sempre recebia um array com
    // identidade diferente — mesmo quando os jogadores eram exatamente os
    // mesmos. Isso fazia `players` mudar de referencia, o que redisparava o
    // efeito de sincronia da tela de gerenciamento (que depende de `players`),
    // que por sua vez mexia no motor e voltava para ca: "Maximum update depth
    // exceeded" ao abrir /elenco/gerenciamento.
    //
    // Comparar por id+titularidade quebra o ciclo sem perder atualizacao real:
    // contratacao, venda, emprestimo ou troca de titular mudam a assinatura.
    //
    // A assinatura e ORDENADA de proposito. Antes ela era `map(id).join(",")` na
    // ordem da lista, e a ordem do motor nunca e a da tela: ao promover um
    // reserva, o tecnico o coloca NO SLOT do titular que saiu, enquanto o motor
    // devolve o XI na ordem do array do elenco. As duas assinaturas divergiam
    // mesmo com o time IDENTICO, o roster sobrescrevia a lista e o jogador
    // "pulava" de posicao em campo — parecia que a escalacao nao tinha sido
    // salva. Comparando o CONJUNTO, a arrumacao do tecnico permanece.
    const assinatura = (lista: { id: number }[]) =>
      lista.map(p => p.id).sort((a, b) => a - b).join(",")

    setPlayers(atual =>
      assinatura(atual) === assinatura(roster.players) ? atual : roster.players)
    setBench(atual =>
      assinatura(atual) === assinatura(roster.bench) ? atual : roster.bench)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamReady, userTeam.curto, squadIdentity, formation])

  return { userTeam, teamReady, players, setPlayers, bench, setBench }
}
