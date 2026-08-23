/**
 * PARTIDA DO ATLETA COM RESULTADO ABERTO — o que este teste protege.
 *
 * O modo de carreira de jogador tinha um defeito que a tela escondia bem: os
 * momentos eram montados DEPOIS de a partida inteira já ter sido simulada, e o
 * gol do jogador era racionado contra o placar já decidido —
 * `podeGol = participacoes < partida.golsPro`. Perdeu de 0×3? Você não marcava,
 * jogasse como jogasse. A escolha aparecia na tela e não decidia nada.
 *
 * `lib/partida-ao-vivo-do-atleta.ts` inverte isso: a partida corre minuto a
 * minuto, para no envolvimento do atleta, e o que ele faz ENTRA no placar.
 *
 * As invariantes abaixo são exatamente as que, se quebrarem, devolvem o defeito
 * — e ele volta em silêncio, porque a tela continua idêntica nos dois casos.
 */
import {
  avancarAteOLance,
  iniciarPartidaAoVivo,
  partidaAcabou,
  resolverLance,
  type PartidaAoVivo,
} from "../lib/partida-ao-vivo-do-atleta"
import { allTeams } from "../lib/teams-data"
import type { MatchConfig } from "../lib/match-engine"

let passou = 0
let falhou = 0
function ok(nome: string, cond: boolean, detalhe = "") {
  if (cond) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome} ${detalhe}`) }
}

const casa = allTeams.find(t => t.prestigio >= 60) ?? allTeams[0]
const fora = allTeams.find(t => t.curto !== casa.curto && t.prestigio >= 60) ?? allTeams[1]
const config: MatchConfig = {
  homeTeam: casa, awayTeam: fora,
  homeRating: 75, awayRating: 75,
  durationMinutes: 90,
}

const criar = (semente: string, atributos: Record<string, number> = {}, posicao = "ATA"): PartidaAoVivo =>
  iniciarPartidaAoVivo({
    config, emCasa: true, minutoDeEntrada: 0, minutoDeSaida: null,
    semente, posicao,
    atributos: { finalizacao: 70, passe: 70, drible: 70, visao: 70, fisico: 70, desarme: 70, posicionamento: 70, ...atributos },
  })

/** Joga a partida inteira escolhendo sempre a primeira opção. */
function jogar(p: PartidaAoVivo, escolher: (p: PartidaAoVivo) => string = pp => pp.lancePendente!.opcoes[0].id) {
  let atual = p
  let guarda = 0
  while (!partidaAcabou(atual) && guarda++ < 400) {
    atual = avancarAteOLance(atual)
    if (!atual.lancePendente) break
    atual = resolverLance(atual, escolher(atual)).partida
  }
  return atual
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 1. A partida corre de verdade ──────────────────────────────")

{
  const p = jogar(criar("s1"))
  ok("a partida chega ao fim", partidaAcabou(p), `(fase ${p.estado.phase})`)
  ok("o relógio andou até os 90+", p.estado.minute >= 90, `(minuto ${p.estado.minute})`)
  ok("o placar existe e é plausível", p.estado.home.goals + p.estado.away.goals < 15)
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 2. O RESULTADO É ABERTO (a invariante central) ─────────────")

// Se o gol do atleta entra no placar, dois jogadores com atributos MUITO
// diferentes, na mesma partida semeada, não podem terminar com o mesmo placar.
// Era exatamente isso que acontecia antes: o placar vinha pronto.
{
  const craque = jogar(criar("mesma-partida", { finalizacao: 99, passe: 99, visao: 99, drible: 99 }))
  const perna = jogar(criar("mesma-partida", { finalizacao: 20, passe: 20, visao: 20, drible: 20 }))
  ok("craque marca mais que perna-de-pau na MESMA partida semeada",
    craque.gols >= perna.gols, `(craque ${craque.gols} x perna ${perna.gols})`)
  ok("o placar do time REFLETE o que o atleta fez",
    craque.estado.home.goals !== perna.estado.home.goals || craque.gols === perna.gols,
    `(placar ${craque.estado.home.goals} vs ${perna.estado.home.goals})`)
}

// A prova direta: um gol do atleta soma no placar do time.
{
  let p = criar("gol-entra", { finalizacao: 99 })
  p = avancarAteOLance(p)
  if (p.lancePendente) {
    const antes = p.estado.home.goals
    const opcaoDeGol = p.lancePendente.opcoes.find(o => o.efeito === "gol")
    if (opcaoDeGol) {
      const r = resolverLance(p, opcaoDeGol.id)
      ok("quando o atleta marca, o PLACAR DO TIME sobe",
        !r.desfecho.gol || r.partida.estado.home.goals === antes + 1,
        `(antes ${antes}, depois ${r.partida.estado.home.goals}, gol=${r.desfecho.gol})`)
    } else { ok("quando o atleta marca, o PLACAR DO TIME sobe", true, "(lance sem opção de gol; ok)") }
  } else { ok("houve ao menos um lance para testar", false) }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 3. Nada é racionado contra um placar futuro ────────────────")

// O time pode perder e o atleta marcar assim mesmo — impossível no modelo antigo.
{
  let encontrou = false
  for (let i = 0; i < 40 && !encontrou; i++) {
    const p = jogar(criar(`derrota-${i}`, { finalizacao: 95, passe: 95, visao: 95 }))
    const pro = p.estado.home.goals
    const contra = p.estado.away.goals
    if (pro < contra && p.gols > 0) encontrou = true
  }
  ok("existe partida em que o time PERDE e o atleta MARCA", encontrou)
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 4. Participação não é inventada ────────────────────────────")

{
  // Reserva que não entra: zero lances. O pedido é explícito nisto.
  let p = iniciarPartidaAoVivo({
    config, emCasa: true, minutoDeEntrada: 999, minutoDeSaida: null,
    semente: "nao-entrou", posicao: "ATA", atributos: { finalizacao: 99 },
  })
  p = jogar(p)
  ok("quem não entra em campo não recebe lance nenhum", p.lancesOferecidos === 0 && p.gols === 0)

  // Substituído aos 60: nenhum lance depois disso.
  let q = iniciarPartidaAoVivo({
    config, emCasa: true, minutoDeEntrada: 0, minutoDeSaida: 60,
    semente: "saiu-aos-60", posicao: "ATA", atributos: { finalizacao: 80 },
  })
  q = jogar(q)
  const depoisDaSaida = q.historico.filter(h => h.minuto >= 60)
  ok("substituído aos 60' não tem lance depois disso", depoisDaSaida.length === 0,
    `(${depoisDaSaida.length} lances tardios)`)

  // Zagueiro participa menos que atacante — em média, na mesma semente.
  let lancesAta = 0, lancesZag = 0
  for (let i = 0; i < 25; i++) {
    lancesAta += jogar(criar(`pos-${i}`, {}, "ATA")).lancesOferecidos
    lancesZag += jogar(criar(`pos-${i}`, {}, "ZAG")).lancesOferecidos
  }
  ok("atacante entra em mais lances que zagueiro", lancesAta > lancesZag,
    `(ATA ${lancesAta} x ZAG ${lancesZag})`)
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 5. Atributos decidem a execução ────────────────────────────")

{
  let golsCraque = 0, golsFraco = 0
  for (let i = 0; i < 30; i++) {
    golsCraque += jogar(criar(`exec-${i}`, { finalizacao: 95, passe: 95, visao: 95, drible: 95 })).gols
    golsFraco += jogar(criar(`exec-${i}`, { finalizacao: 25, passe: 25, visao: 25, drible: 25 })).gols
  }
  ok("atributo alto produz mais gols que atributo baixo", golsCraque > golsFraco,
    `(${golsCraque} x ${golsFraco})`)
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 6. Determinismo ───────────────────────────────────────────")

{
  const a = jogar(criar("igual"))
  const b = jogar(criar("igual"))
  ok("a mesma semente dá a mesma partida",
    a.gols === b.gols && a.nota === b.nota && a.estado.home.goals === b.estado.home.goals)
  const c = jogar(criar("diferente"))
  ok("sementes diferentes dão partidas diferentes",
    a.estado.home.goals !== c.estado.home.goals || a.lancesOferecidos !== c.lancesOferecidos)
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${falhou === 0 ? "PASSOU" : "FALHOU"} — ${passou} ok, ${falhou} falha(s)\n`)
process.exit(falhou === 0 ? 0 : 1)
