// medicao temporaria
import { allTeams } from "@/lib/teams-data"
import { criarAtletaDaCarreira, criarCarreiraDeJogador } from "@/lib/carreira-de-jogador"

const atleta = criarAtletaDaCarreira({
  nome: "Medida", posicao: "ATA", idade: 19, nacionalidade: "Brasil",
  pePreferido: "direito", alturaCm: 180, pesoKg: 74, numero: 9,
})
const alvos = ["FLA", "SAN", "ABC", "REA", "MCI", "BAR", "JUV", "PSG", "BOC", "RIV"]
for (const curto of alvos) {
  const time = allTeams.find(t => t.curto === curto)
  if (!time) { console.log(curto, "nao achei"); continue }
  const t0 = Date.now()
  const c = criarCarreiraDeJogador(time, atleta, String(time.divisao), 2026)
  console.log(`${curto.padEnd(4)} ${String(Date.now() - t0).padStart(6)} ms  liga ${c.tabela.length} clubes, ${c.calendario.length} jogos, copa=${Boolean(c.copa)} cont=${Boolean(c.continental)}`)
}
