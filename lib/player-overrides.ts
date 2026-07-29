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
import { attributesFromOverall } from "@/lib/player-attributes"
import bundled from "@/data/seeds/player-overrides.json"
import { jogadorDoServidor } from "@/lib/atualizacao-elencos"

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
// Duas por atleta, no maximo. Sao o "tempero" do jogador: onde ele e melhor do
// que o overall sozinho diria. Cada uma aponta para o atributo que reforca, e e
// assim que ela vira efeito de verdade na partida em vez de virar so um rotulo.

export const MAX_CARACTERISTICAS = 2

export interface Caracteristica {
  id: string
  nome: string
  /** Atributo reforcado. `null` = efeito amplo, tratado a parte. */
  atributo: "pace" | "shooting" | "passing" | "dribbling" | "defending" | "physical" | null
  descricao: string
}

/** Caracteristicas de goleiro. */
export const CARACTERISTICAS_GOLEIRO: Caracteristica[] = [
  { id: "colocacao", nome: "Colocação", atributo: "defending", descricao: "Escolhe bem a posição e encurta o ângulo do atacante." },
  { id: "defesa_penalty", nome: "Defesa Penalty", atributo: "defending", descricao: "Lê a cobrança e cresce na marca da cal." },
  { id: "reflexo", nome: "Reflexo", atributo: "pace", descricao: "Reage a finalização de curta distância." },
  { id: "saida_gol", nome: "Saída Gol", atributo: "physical", descricao: "Sai bem do gol e domina a área alta." },
  { id: "reposicao", nome: "Reposição", atributo: "passing", descricao: "Começa a jogada com o pé, não só chuta para frente." },
]

/** Caracteristicas de quem joga na linha — as mesmas para todas as posições. */
export const CARACTERISTICAS_LINHA: Caracteristica[] = [
  { id: "armacao", nome: "Armação", atributo: "passing", descricao: "Organiza a saída e acha o passe que quebra a linha." },
  { id: "cabeceio", nome: "Cabeceio", atributo: "physical", descricao: "Ganha a bola aérea nas duas áreas." },
  { id: "cruzamento", nome: "Cruzamento", atributo: "passing", descricao: "Bola na área com precisão pelos lados." },
  { id: "desarme", nome: "Desarme", atributo: "defending", descricao: "Chega no carrinho e no bote com limpeza." },
  { id: "drible", nome: "Drible", atributo: "dribbling", descricao: "Encara o marcador no um contra um." },
  { id: "finalizacao", nome: "Finalização", atributo: "shooting", descricao: "Converte o que aparece dentro e fora da área." },
  { id: "marcacao", nome: "Marcação", atributo: "defending", descricao: "Fecha espaço e não larga o homem." },
  { id: "passe", nome: "Passe", atributo: "passing", descricao: "Troca de bola limpa e sem perder a posse." },
  { id: "resistencia", nome: "Resistência", atributo: "physical", descricao: "Mantém o ritmo os noventa minutos." },
  { id: "velocidade", nome: "Velocidade", atributo: "pace", descricao: "Ganha no primeiro passo e no espaço aberto." },
  { id: "lideranca", nome: "Liderança", atributo: null, descricao: "Puxa o time quando o jogo aperta." },
]

/** O catálogo certo para a posição. Goleiro tem o seu; o resto compartilha. */
export function caracteristicasDaPosicao(posicao: string): Caracteristica[] {
  return posicao === "GOL" ? CARACTERISTICAS_GOLEIRO : CARACTERISTICAS_LINHA
}

const POR_ID = new Map(
  [...CARACTERISTICAS_GOLEIRO, ...CARACTERISTICAS_LINHA].map(c => [c.id, c]),
)

export function caracteristicaPorId(id: string): Caracteristica | undefined {
  return POR_ID.get(id)
}

/**
 * Quanto cada característica soma no atributo que reforça.
 *
 * Existe para a característica NAO ser enfeite. O valor é modesto de propósito:
 * ela desempata, não substitui o overall. Duas características somam no máximo
 * +12 num mesmo atributo — o suficiente para o atleta ter cara própria.
 */
export const BONUS_CARACTERISTICA = 6

export function bonusDasCaracteristicas(
  traits: string[] | undefined,
): Partial<Record<"pace" | "shooting" | "passing" | "dribbling" | "defending" | "physical", number>> {
  const saida: Partial<Record<"pace" | "shooting" | "passing" | "dribbling" | "defending" | "physical", number>> = {}
  for (const id of (traits ?? []).slice(0, MAX_CARACTERISTICAS)) {
    const c = POR_ID.get(id)
    if (!c?.atributo) continue
    saida[c.atributo] = (saida[c.atributo] ?? 0) + BONUS_CARACTERISTICA
  }
  return saida
}

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
  // Embutido < servidor < local. Mesma ordem de team-overrides.
  const servidor = jogadorDoServidor(k)
  const base = BUNDLED[k] || servidor ? { ...BUNDLED[k], ...servidor } : null
  const raw = typeof window === "undefined" ? null : storeGet(KEY(k))
  if (raw) {
    try {
      const local = JSON.parse(raw) as PlayerOverride
      return { ...base, ...local }
    } catch { /* save corrompido: cai na base */ }
  }
  return base
}

export function setPlayerOverride(fileKey: string, originalName: string, ov: PlayerOverride): void {
  if (!fileKey || !originalName) return
  storeSet(KEY(playerOverrideKey(fileKey, originalName)), JSON.stringify(ov))
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("ultrafoot:player:changed", { detail: { fileKey, originalName } }))
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
