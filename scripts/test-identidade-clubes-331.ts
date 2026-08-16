import { readFileSync } from "node:fs"
import path from "node:path"
import { normalizeCountry } from "../lib/country-normalize"
import {
  completarLigaComPool,
  getDivisoes2026,
  getTeamByFileKey,
  getTeamByShort,
  initialDivision,
} from "../lib/teams-data"

function exigir(ok: unknown, mensagem: string): asserts ok {
  if (!ok) throw new Error(mensagem)
}

const alagoinhas = getTeamByFileKey("atleticoalagoinhas_bra")
const rafaela = getTeamByFileKey("atleticorafaela_arg")
exigir(alagoinhas, "Atletico Alagoinhas nao foi encontrado pelo file_key")
exigir(rafaela, "Atletico Rafaela nao foi encontrado pelo file_key")
exigir(alagoinhas.curto !== rafaela.curto, "Alagoinhas e Rafaela ainda compartilham a mesma identidade jogavel")
exigir(getTeamByShort(alagoinhas.curto)?.file_key === alagoinhas.file_key, "A sigla de Alagoinhas resolve outro clube")
exigir(getTeamByShort(rafaela.curto)?.file_key === rafaela.file_key, "A sigla de Rafaela resolve outro clube")

const curtoBrasileiro = Object.keys(getDivisoes2026())[0]
exigir(curtoBrasileiro, "Tabela brasileira de divisoes vazia")
const divisaoEstrangeira = initialDivision({
  curto: curtoBrasileiro,
  divisao: "pool:Argentina",
  pais: "Argentina",
  file_key: "qa_homonimo_argentino",
})
exigir(divisaoEstrangeira === "pool:Argentina", `Homonimo argentino herdou divisao brasileira: ${divisaoEstrangeira}`)

for (const divisao of ["serie_a", "serie_b", "serie_c", "serie_d"]) {
  const clubes = completarLigaComPool(divisao)
  const estrangeiros = clubes.filter(team => normalizeCountry(team.pais ?? team.estado) !== "Brasil")
  exigir(estrangeiros.length === 0, `${divisao} recebeu clubes estrangeiros: ${estrangeiros.map(t => t.nome).join(", ")}`)
}

const cabecalho = readFileSync(path.resolve(import.meta.dirname, "../components/game-header.tsx"), "utf8")
const inicioMenu = cabecalho.indexOf("const NAV_MENU_ITEMS")
const fimMenu = cabecalho.indexOf("const NAV_MENU_NATIONAL", inicioMenu)
exigir(inicioMenu >= 0 && fimMenu > inicioMenu, "Nao foi possivel localizar o menu W")
const menuW = cabecalho.slice(inicioMenu, fimMenu)
exigir(!menuW.includes("/base/carreira"), "Menu W ainda contem Carreira na base")
exigir(!menuW.includes("/carreira/jogador"), "Menu W ainda contem Carreira de jogador")

console.log(`OK 331: ${alagoinhas.nome} (${alagoinhas.curto}) e ${rafaela.nome} (${rafaela.curto}) sao identidades distintas`)
console.log("OK 331: divisoes brasileiras sem estrangeiros e menu W exclusivo da carreira de treinador")
