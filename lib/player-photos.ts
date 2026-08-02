import manifest from "@/data/seeds/faces-manifest.json"
import importedBF from "@/data/seeds/imported-bf2026.json"
import realSquadsTM from "@/data/seeds/real-squads-tm.json"
import tmPhotos from "@/data/seeds/tm-photos.json"
import { gameAssetUrl } from "@/lib/game-asset"
import { fotoDoServidor } from "@/lib/atualizacao-elencos"
import { storeGet, storeSet } from "@/lib/persistent-store"

// O manifesto contém apenas arquivos fisicamente empacotados. O mapa editorial é
// maior e inclui fotos planejadas; consultá-lo gerava milhares de 404 e prejudicava
// máquinas com pouca memória/disco lento.
const photoMap = (manifest as { entries: Record<string, string> }).entries

// ─── Fotos reais do Transfermarkt ─────────────────────────────────────────────
// O seed principal carrega `ft` ("371247-1780359299"), assado por
// scripts/apply-tm-squads.mjs com casamento exato de nome DENTRO do clube.
//
// OFFLINE-FIRST: scripts/download-tm-photos.mjs baixa as fotos usadas pelo jogo
// para a RAIZ de public/jogadores e registra o que esta em disco em
// tm-fotos-local.json. Raiz, e nao subpasta: o empacotador de resources do
// Tauri ACHATA os globs (constatei na 1.0.111 instalada — jogadores/tm sumiu e
// os arquivos cairam na raiz), entao subpasta funcionaria no navegador e
// quebraria no instalado. Os nomes nao colidem: ft e "id-timestamp.jpg", os
// arquivos antigos sao slugs de nome. So apontamos para arquivo local se ele esta
// no manifesto — um download que falhou cai na URL remota, nunca em imagem
// quebrada. Sem internet E sem arquivo, o onError do PlayerAvatar mostra as
// iniciais.
import fotosLocais from "@/data/seeds/tm-fotos-local.json"
const TM_LOCAL = new Set((fotosLocais as { fts: string[] }).fts)
const TM_PORTRAIT = "https://img.a.transfermarkt.technology/portrait/medium/"

interface SeedPlayerFt { nome: string; ft?: string }
interface SeedTeamFt { jogadores?: SeedPlayerFt[] }

let tmFotoMap: Map<string, string> | null = null
/**
 * nome normalizado -> ft. Construido UMA vez, na primeira consulta; o seed ja
 * esta no bundle por outros modulos, entao isto nao adiciona download nenhum.
 *
 * Nome REPETIDO entre pessoas diferentes (Rony do Santos x Rony do Santa Rosa,
 * Gabriel Barbosa do Santos x do Farense): antes viravam `null` e o CRAQUE
 * ficava sem foto — o pior dos mundos, porque e justamente ele que aparece na
 * tela. Agora fica a foto do atleta de MAIOR overall, que e quase sempre o certo
 * (o Gabigol de o~85 vence o xara de divisao de acesso). O namesake obscuro cai
 * na silhueta, o que e aceitavel.
 */
function getTmFotoMap(): Map<string, string> {
  if (tmFotoMap) return tmFotoMap
  const melhor = new Map<string, { ft: string; overall: number }>()
  const add = (nome: string, ft?: string, overall = 0) => {
    if (!ft) return
    const k = normalizePlayerKey(nome)
    if (!k) return
    const atual = melhor.get(k)
    if (!atual || overall > atual.overall) melhor.set(k, { ft, overall })
  }
  // Elencos REAIS primeiro: e a foto do roster que o jogo de fato usa.
  for (const roster of Object.values(realSquadsTM as Record<string, { n: string; f?: string; o?: number }[]>)) {
    for (const p of roster) add(p.n, p.f, p.o ?? 0)
  }
  // Seed importado depois (clubes ficticios que nao viraram elenco real).
  for (const team of ((importedBF as { teams?: SeedTeamFt[] }).teams) ?? []) {
    for (const j of team.jogadores ?? []) add(j.nome, j.ft, (j as { overall?: number }).overall ?? 0)
  }
  // CACHE DO TRANSFERMARKT por ultimo (menor prioridade, so preenche o que
  // faltou). Clubes CURADOS — Liverpool, Bayern — sao servidos pelo overlay de
  // elencos, que quase nao tem retrato: o Liverpool aparecia com 1 foto em 22
  // atletas. Este mapa cobre 17 mil nomes que o TM ja tinha baixado.
  for (const [chave, ft] of Object.entries(tmPhotos as Record<string, string>)) {
    if (!melhor.has(chave)) melhor.set(chave, { ft, overall: -1 })
  }
  tmFotoMap = new Map([...melhor].map(([k, v]) => [k, v.ft]))
  return tmFotoMap
}

let sobrenomeMap: Map<string, string> | null = null
/**
 * SOBRENOME -> foto, apenas para sobrenomes UNICOS no acervo.
 *
 * Clubes curados (Bayern, Liverpool) trazem o nome ABREVIADO — "D. Upamecano",
 * "M. Neuer" — enquanto o Transfermarkt guarda "Dayot Upamecano". As chaves nao
 * casavam e esses elencos apareciam inteiros sem foto (Bayern 0 de 25), mesmo
 * com o retrato baixado.
 *
 * So entra sobrenome que aparece UMA vez: "silva" e "santos" ficam de fora, e a
 * silhueta e melhor do que a cara de outra pessoa.
 */
function getSobrenomeMap(): Map<string, string> {
  if (sobrenomeMap) return sobrenomeMap
  const contagem = new Map<string, { ft: string; vezes: number }>()
  for (const [chave, ft] of getTmFotoMap()) {
    const partes = chave.split("-")
    if (partes.length < 2) continue
    const sobrenome = partes[partes.length - 1]
    if (sobrenome.length < 4) continue
    const atual = contagem.get(sobrenome)
    if (atual) atual.vezes++
    else contagem.set(sobrenome, { ft, vezes: 1 })
  }
  sobrenomeMap = new Map()
  for (const [s, v] of contagem) if (v.vezes === 1) sobrenomeMap.set(s, v.ft)
  return sobrenomeMap
}

/** Nome abreviado ("D. Upamecano") -> tenta o sobrenome. */
function fotoPorSobrenome(name: string): string | undefined {
  const chave = normalizePlayerKey(name)
  const partes = chave.split("-")
  if (partes.length < 2) return undefined
  const sobrenome = partes[partes.length - 1]
  if (sobrenome.length < 4) return undefined
  return getSobrenomeMap().get(sobrenome)
}

// Normalizes a player name into a lookup key: "Gabriel Barbosa" → "gabriel-barbosa"
export function normalizePlayerKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

let nomesAmbiguos: Set<string> | null = null
/**
 * Nomes que pertencem a MAIS DE UM clube no jogo.
 *
 * ⚠️ POR QUE ISTO EXISTE (relato de 02/08/2026: "a foto do Carlos Miguel do
 * Palmeiras está se repetindo em outro jogador; o Kaio Cesar do Corinthians
 * aparece em jogadores de outros clubes").
 *
 * As duas fontes de foto por NOME — a edição local do editor
 * (`ultrafoot:player-photo:`) e o pacote do servidor — são indexadas só pelo
 * nome, porque `getPlayerPhotoUrl` não recebe o clube. Enquanto cada rosto vinha
 * de um atleta único isso passou despercebido; publicar elencos inteiros expôs a
 * falha. No pool de 66 mil atletas há "Carlos Miguel" no Palmeiras E no Benfica
 * B, "Kaio Cesar" no Corinthians E em dois Operários.
 *
 * Enquanto a busca não souber o clube, nome repetido não recebe rosto: silhueta
 * é melhor do que a cara de outra pessoa — a mesma regra que a importação do
 * DF11 já seguia.
 */
function getNomesAmbiguos(): Set<string> {
  if (nomesAmbiguos) return nomesAmbiguos
  const doClube = new Map<string, string>()
  const repetidos = new Set<string>()
  const ver = (nome: string, clube: string) => {
    const k = normalizePlayerKey(nome)
    if (!k || !clube) return
    const anterior = doClube.get(k)
    if (anterior === undefined) doClube.set(k, clube)
    else if (anterior !== clube) repetidos.add(k)
  }
  for (const [chave, roster] of Object.entries(realSquadsTM as Record<string, { n: string }[]>)) {
    const clube = chave.split("|")[1] ?? chave
    for (const p of roster ?? []) ver(p.n, clube)
  }
  for (const team of ((importedBF as { teams?: (SeedTeamFt & { nome?: string })[] }).teams) ?? []) {
    for (const j of team.jogadores ?? []) ver(j.nome, team.nome ?? "")
  }
  nomesAmbiguos = repetidos
  return repetidos
}

// Returns the photo URL for a player, or undefined if none is registered.
export function getPlayerPhotoUrl(name: string, playerId?: string, fileKey?: string): string | undefined {
  // COM O CLUBE não há xará: a busca no pacote do servidor vira exata
  // (`fileKey__nome`). Sem ele, nenhuma busca por nome vale — o manifesto
  // embutido só responde por `playerId`, que identifica o atleta de verdade.
  if (fileKey && typeof window !== "undefined") {
    const exata = fotoDoServidor(name, fileKey)
    if (exata) return exata
  }
  const ambiguo = getNomesAmbiguos().has(normalizePlayerKey(name))

  const custom = !ambiguo && typeof window !== "undefined"
    ? storeGet(`ultrafoot:player-photo:${normalizePlayerKey(name)}`)
    : null
  if (custom) return custom
  // Retrato publicado no servidor: entra DEPOIS da edição local (o trabalho de
  // quem edita na própria máquina sempre vence) e ANTES do manifesto embutido,
  // que é o piso do build. É por aqui que uma foto licenciada no editor chega a
  // todo mundo sem instalador novo.
  const doServidor = !ambiguo && typeof window !== "undefined" ? fotoDoServidor(name) : null
  if (doServidor) return doServidor
  // Xará ainda pode receber rosto POR ID — ali o atleta é identificado de fato,
  // não pelo nome.
  const rawUrl = ambiguo
    ? (playerId ? photoMap[playerId] : undefined)
    : ((playerId && photoMap[playerId]) ? photoMap[playerId] : photoMap[normalizePlayerKey(name)])
  if (rawUrl) return gameAssetUrl(rawUrl)
  // Sem arquivo empacotado: foto real do Transfermarkt — local (offline) quando
  // baixada; remota como reserva. Também por nome, então também vale a trava.
  if (ambiguo) return undefined
  const ft = getTmFotoMap().get(normalizePlayerKey(name)) ?? fotoPorSobrenome(name)
  if (!ft) return undefined
  // O `ft` traz a EXTENSAO quando nao e jpg ("275412-1771071867.png"): o TM serve
  // boa parte das fotos como png, e cravar ".jpg" aqui dava 404 nelas. Token sem
  // ponto continua sendo jpg, que e o formato da maioria e o que ja estava gravado.
  const arquivo = ft.includes(".") ? ft : `${ft}.jpg`
  return TM_LOCAL.has(ft) ? gameAssetUrl(`/jogadores/${arquivo}`) : `${TM_PORTRAIT}${arquivo}`
}

export function setPlayerPhotoOverride(name: string, dataUrl: string): void {
  if (!name || !dataUrl.startsWith("data:image/")) return
  storeSet(`ultrafoot:player-photo:${normalizePlayerKey(name)}`, dataUrl)
}
