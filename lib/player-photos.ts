import manifest from "@/data/seeds/faces-manifest.json"
import importedBF from "@/data/seeds/imported-bf2026.json"
import { gameAssetUrl } from "@/lib/game-asset"
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

let tmFotoMap: Map<string, string | null> | null = null
/**
 * nome normalizado -> ft. Construido UMA vez, na primeira consulta; o seed ja
 * esta no bundle por outros modulos, entao isto nao adiciona download nenhum.
 * Nome que aparece com DOIS ft diferentes vira null: dois atletas distintos com
 * o mesmo nome, e mostrar a foto de um no outro e pior do que nao mostrar.
 */
function getTmFotoMap(): Map<string, string | null> {
  if (tmFotoMap) return tmFotoMap
  tmFotoMap = new Map()
  for (const team of ((importedBF as { teams?: SeedTeamFt[] }).teams) ?? []) {
    for (const j of team.jogadores ?? []) {
      if (!j.ft) continue
      const k = normalizePlayerKey(j.nome)
      if (!k) continue
      const prev = tmFotoMap.get(k)
      if (prev === undefined) tmFotoMap.set(k, j.ft)
      else if (prev !== j.ft) tmFotoMap.set(k, null)
    }
  }
  return tmFotoMap
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

// Returns the photo URL for a player, or undefined if none is registered.
export function getPlayerPhotoUrl(name: string, playerId?: string): string | undefined {
  const custom = typeof window !== "undefined" ? storeGet(`ultrafoot:player-photo:${normalizePlayerKey(name)}`) : null
  if (custom) return custom
  const rawUrl =
    (playerId && photoMap[playerId]) ? photoMap[playerId] : photoMap[normalizePlayerKey(name)]
  if (rawUrl) return gameAssetUrl(rawUrl)
  // Sem arquivo empacotado: foto real do Transfermarkt — local (offline) quando
  // baixada; remota como reserva.
  const ft = getTmFotoMap().get(normalizePlayerKey(name))
  if (!ft) return undefined
  return TM_LOCAL.has(ft) ? gameAssetUrl(`/jogadores/${ft}.jpg`) : `${TM_PORTRAIT}${ft}.jpg`
}

export function setPlayerPhotoOverride(name: string, dataUrl: string): void {
  if (!name || !dataUrl.startsWith("data:image/")) return
  storeSet(`ultrafoot:player-photo:${normalizePlayerKey(name)}`, dataUrl)
}
