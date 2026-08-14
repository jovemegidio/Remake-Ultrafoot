"use client"

// Edicoes de JOGADOR (nome, posicao, overall) feitas no editor.
//
// Espelha o sistema de team-overrides: o save LOCAL vence, e um seed EMBUTIDO no build
// (data/seeds/player-overrides.json) e o fallback — e por ele que suas edicoes de jogador
// chegam a todos os jogadores. Aplicado em players-data.getPlayersForTeam.
//
// Chave: `${file_key}__${nomeOriginalNormalizado}` — usa o nome ORIGINAL para a edicao
// sobreviver mesmo depois de voce renomear o jogador.

import { storeGet, storeSet, storeRemove } from "@/lib/persistent-store"
import { guardarImagem, resolverImagem } from "@/lib/banco-de-imagens"
import { attributesFromOverall } from "@/lib/player-attributes"
import bundled from "@/data/seeds/player-overrides.json"
import { jogadorDoServidor } from "@/lib/atualizacao-elencos"
import { jogadorDoMod } from "@/lib/mods"

export interface PlayerOverride {
  nome?: string
  pos?: string
  base?: number
  idade?: number
  // Atributos individuais editados no editor (0-99). Aplicados na montagem do time da
  // partida (players-data). Quando ausentes, o jogo usa os valores padrao derivados do
  // overall+posicao.
  pace?: number
  shooting?: number
  passing?: number
  dribbling?: number
  defending?: number
  physical?: number
  preferredFoot?: "Direita" | "Esquerda" | "Ambidestro"
  reputation?: "normal" | "estrela" | "top_mundial"
  /** Nacionalidade editada manualmente (sobrepoe a do seed). */
  nac?: string
  traits?: string[]
  faceDataUrl?: string
  /**
   * Lado do campo em que o atleta atua. A POSICAO ja embute o lado em LD/LE/PD/PE,
   * mas zagueiro, volante, meia e atacante ficavam sem — um zagueiro canhoto e um
   * destro eram a mesma coisa no editor.
   */
  lado?: "E" | "D" | "C"
}

// ─── Caracteristicas ─────────────────────────────────────────────────────────
//
// O CATALOGO MUDOU DE CASA na 1.0.298: agora vive em
// `lib/caracteristicas-do-atleta.ts`, que e um modulo PURO. Este arquivo e
// `"use client"` e importa store/banco de imagens, entao o motor de partida nao
// podia le-lo — e sem o motor a caracteristica nunca sairia de rotulo.
//
// A reexportacao abaixo existe para todo import antigo (`from
// "@/lib/player-overrides"`) continuar valendo. Codigo novo deve importar do
// modulo puro.
export {
  MAX_CARACTERISTICAS,
  BONUS_CARACTERISTICA,
  CARACTERISTICAS_GOLEIRO,
  CARACTERISTICAS_LINHA,
  caracteristicasDaPosicao,
  caracteristicaPorId,
  bonusDasCaracteristicas,
} from "@/lib/caracteristicas-do-atleta"
export type { Caracteristica } from "@/lib/caracteristicas-do-atleta"

/**
 * Bonus de atributos por reputacao. Estrela e top mundial nao sao so um selo —
 * dao um salto real de qualidade (pedido: "melhora os atributos
 * significativamente"). Aplicado sobre os atributos-base do atleta.
 */
export function reputationBonus(rep?: "normal" | "estrela" | "top_mundial"): number {
  return rep === "top_mundial" ? 10 : rep === "estrela" ? 5 : 0
}

/** Atributos padrao derivados do overall + posicao (mesma logica do motor de partida). */
// Atributos por posição: DELEGA ao gerador canônico do motor (lib/player-attributes),
// que já traz perfis realistas por família (GOL/ZAG/lateral/volante/meia/ponta/atacante)
// com pesos por posição e RECONCILIAÇÃO do overall — o mesmo que a partida usa. Antes
// aqui havia uma fórmula própria, mais grosseira (3 baldes), que fazia o editor/elenco
// divergirem do motor (ponta com cara de centroavante, etc.). Unificando, tudo — editor,
// tela de elenco e simulação — mostra o MESMO atleta coerente com a posição.
export function defaultPlayerAttributes(base: number, pos: string): {
  pace: number; shooting: number; passing: number; dribbling: number; defending: number; physical: number
} {
  return attributesFromOverall(base, pos, `default:${pos}:${base}`)
}

const BUNDLED = bundled as Record<string, PlayerOverride>
const KEY = (k: string) => `ultrafoot:player-override:${k}`

export function normPlayerName(name: string): string {
  return (name ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")
}
export function playerOverrideKey(fileKey: string, originalName: string): string {
  return `${fileKey}__${normPlayerName(originalName)}`
}

export function getPlayerOverride(fileKey: string, originalName: string): PlayerOverride | null {
  const k = playerOverrideKey(fileKey, originalName)
  // Embutido < servidor < mod < local. Mesma ordem de team-overrides.
  const servidor = jogadorDoServidor(k)
  const mod = jogadorDoMod(k)
  const base = BUNDLED[k] || servidor || mod ? { ...BUNDLED[k], ...servidor, ...mod } : null
  const raw = typeof window === "undefined" ? null : storeGet(KEY(k))
  if (raw) {
    try {
      const local = JSON.parse(raw) as PlayerOverride
      const junto = { ...base, ...local }
      // O rosto importado agora mora num arquivo; `resolverImagem` devolve
      // intacto o que não for referência (o do canal e o do seed embutido).
      return junto.faceDataUrl
        ? { ...junto, faceDataUrl: resolverImagem(junto.faceDataUrl) ?? undefined }
        : junto
    } catch { /* save corrompido: cai na base */ }
  }
  return base
}

export function setPlayerOverride(fileKey: string, originalName: string, ov: PlayerOverride): void {
  if (!fileKey || !originalName) return
  const chave = KEY(playerOverrideKey(fileKey, originalName))
  const inline = JSON.stringify(ov)
  // Inline primeiro, banco depois (ver `setCustomLogoUrl`). O rosto em base64
  // dentro do override foi o que estourou a cota do save antes: agora ele vira
  // um arquivo e aqui fica só a referência.
  storeSet(chave, inline)
  const avisar = () => {
    if (typeof window !== "undefined")
      window.dispatchEvent(new CustomEvent("ultrafoot:player:changed", { detail: { fileKey, originalName } }))
  }
  avisar()

  if (!ov.faceDataUrl) return
  void guardarImagem(ov.faceDataUrl).then(ref => {
    if (!ref || ref === ov.faceDataUrl) return
    if (storeGet(chave) !== inline) return // editado de novo no meio-tempo
    storeSet(chave, JSON.stringify({ ...ov, faceDataUrl: ref }))
    avisar()
  })
}

export function clearPlayerOverride(fileKey: string, originalName: string): void {
  storeRemove(KEY(playerOverrideKey(fileKey, originalName)))
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("ultrafoot:player:changed", { detail: { fileKey, originalName } }))
}

/** Todas as edicoes locais de jogador — para o editor exportar. */
export function listLocalPlayerOverrides(): Record<string, PlayerOverride> {
  const out: Record<string, PlayerOverride> = {}
  if (typeof window === "undefined") return out
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k?.startsWith("ultrafoot:player-override:")) continue
    const raw = storeGet(k)
    if (!raw) continue
    try { out[k.replace("ultrafoot:player-override:", "")] = JSON.parse(raw) } catch { /* ignora */ }
  }
  return out
}
