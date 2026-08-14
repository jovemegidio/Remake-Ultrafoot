"use client"

import { storeGet, storeSet, storeRemove } from "@/lib/persistent-store"
import { guardarImagem, resolverImagem } from "@/lib/banco-de-imagens"
// Edicoes de clube EMBUTIDAS no jogo (escudos, uniformes, cores, nomes).
//
// Sem isto, o que voce edita no editor de clubes fica so no armazenamento global da instalação
// e NUNCA chega aos outros jogadores. Este seed viaja dentro do build: e o canal para
// as suas edicoes valerem para todo mundo que instalar o jogo.
//
// Fluxo: edita no editor -> "Exportar edicoes" -> roda scripts/merge-team-overrides.mjs
// -> as edicoes entram neste arquivo -> o proximo build ja sai com elas.
import bundledOverrides from "@/data/seeds/team-overrides.json"
import { timeDoServidor } from "@/lib/atualizacao-elencos"
import { timeDoMod } from "@/lib/mods"

const KEY = (fileKey: string) => `ultrafoot:team-override:${fileKey}`

// `as unknown as`: o seed embutido guarda kits que as vezes so tem imageUrl (sem
// primary/secondary/pattern), entao nao casa 1:1 com KitData no compilador — mas em runtime
// so lemos imageUrl (getCamisaUrl). O cast e seguro.
const BUNDLED = bundledOverrides as unknown as Record<string, TeamOverride>

export type KitPattern = "solid" | "stripes" | "diagonal" | "halves"

export interface KitData {
  primary: string
  secondary: string
  pattern: KitPattern
  imageUrl?: string // base64 data URL para imagem customizada
  /** Quando true, a equipe realmente nao possui esta variante (normalmente a terceira). */
  disabled?: boolean
}

export interface TeamOverride {
  /** Nome de EXIBICAO — o curto que aparece em tabela, escudo e placar. */
  nome?: string
  /** Nome OFICIAL do clube ("Clube de Regatas do Flamengo"). Ver lib/club-names. */
  nomeOficial?: string
  curto?: string
  cor1?: string
  cor2?: string
  prestigio?: number
  estadio_nome?: string
  estadio_cap?: number
  patrocinador?: string
  /** Técnico do clube e a nacionalidade dele — não existiam no editor. */
  tecnico?: string
  tecnicoPais?: string
  /** País do clube. Sem isto não dava para corrigir um clube importado no país errado. */
  pais?: string
  /**
   * Alcance da torcida e da marca. Separado do `prestigio` (que é a força do
   * elenco): um clube pode ser tradicional e estar mal montado, e vice-versa.
   */
  reputacao?: "regional" | "nacional" | "continental" | "mundial"
  // Escudo custom (data URL). O escudo é guardado no armazenamento global (ultrafoot:logo:*),
  // mas viaja no seed embutido POR AQUI para chegar aos outros jogadores. getCustomLogoUrl
  // (team-crest) usa este campo como fallback quando o jogador nao tem escudo proprio.
  logoUrl?: string
  kits?: {
    home?: KitData
    away?: KitData
    third?: KitData
  }
}

/**
 * Edicao do clube. A personalização LOCAL vence (o jogador pode personalizar a instalação),
 * e o seed EMBUTIDO e o fallback — e por ele que as suas edicoes chegam a todo mundo.
 */
/**
 * Troca referência do banco (`uf-img:…`) pela URL que `<img src>` entende.
 *
 * Aplicado no override JÁ MESCLADO, e não em cada camada: `resolverImagem`
 * devolve intacto tudo que não é referência, então o escudo do canal (que já
 * vem resolvido) e o do seed embutido (base64) passam sem alteração. Uma função
 * só, no fim, em vez de três lugares para esquecer um.
 */
function comImagensResolvidas(ov: TeamOverride): TeamOverride {
  const logoUrl = ov.logoUrl ? resolverImagem(ov.logoUrl) ?? undefined : ov.logoUrl
  if (!ov.kits) return logoUrl === ov.logoUrl ? ov : { ...ov, logoUrl }
  const kits = Object.fromEntries(
    Object.entries(ov.kits).map(([variante, k]) => [
      variante,
      k?.imageUrl ? { ...k, imageUrl: resolverImagem(k.imageUrl) ?? undefined } : k,
    ]),
  ) as TeamOverride["kits"]
  return { ...ov, logoUrl, kits }
}

export function getTeamOverride(fileKey: string): TeamOverride | null {
  // BASE = embutido no build + atualizacao do servidor por cima. E o que faz uma
  // correcao de escudo/uniforme chegar sem reinstalar o jogo (ver
  // lib/atualizacao-elencos). O que o JOGADOR editou continua vencendo os dois.
  const embutido = BUNDLED[fileKey]
  const servidor = timeDoServidor(fileKey)
  // O MOD entra depois do canal e antes da edicao local (ver lib/mods.ts): quem
  // instalou o pacote quis que ele valesse mais que o canal, mas instalar um
  // pacote nao pode apagar o escudo que a pessoa importou a mao.
  const mod = timeDoMod(fileKey)
  const base = embutido || servidor || mod
    ? {
        ...embutido,
        ...servidor,
        ...mod,
        kits: { ...embutido?.kits, ...servidor?.kits, ...mod?.kits },
      }
    : null

  const raw = storeGet(KEY(fileKey))
  if (raw) {
    try {
      const local = JSON.parse(raw) as TeamOverride
      return comImagensResolvidas(
        base ? { ...base, ...local, kits: { ...base.kits, ...local.kits } } : local,
      )
    } catch { /* save corrompido: cai na base */ }
  }
  return base ? comImagensResolvidas(base) : null
}

/** Todas as edicoes locais — usado pelo editor para exportar. */
export function listLocalTeamOverrides(): Record<string, TeamOverride> {
  const out: Record<string, TeamOverride> = {}
  if (typeof window === "undefined") return out
  // O persistent-store espelha as chaves no localStorage; varremos pelo prefixo.
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k?.startsWith("ultrafoot:team-override:")) continue
    const fileKey = k.replace("ultrafoot:team-override:", "")
    const raw = storeGet(k)
    if (!raw) continue
    try { out[fileKey] = JSON.parse(raw) } catch { /* ignora entrada corrompida */ }
  }
  return out
}

export function setTeamOverride(fileKey: string, override: TeamOverride): void {
  if (!fileKey) return
  // Grava inline primeiro e promove para o banco depois — mesma razão de
  // `setCustomLogoUrl`: o disco é assíncrono e a edição não pode depender dele
  // para existir. Um uniforme em resolução nativa passa de 0,5 MB, e era isso
  // que fazia cada clube editado somar meio mega ao JSON reescrito a cada save.
  storeSet(KEY(fileKey), JSON.stringify(override))
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("ultrafoot:team:changed", { detail: { key: fileKey } }))

  void promoverImagensDoOverride(fileKey, override)
}

async function promoverImagensDoOverride(fileKey: string, override: TeamOverride): Promise<void> {
  const inline = JSON.stringify(override)
  const logoUrl = (await guardarImagem(override.logoUrl)) ?? undefined
  const kits = override.kits
    ? ((await (async () => {
        const pares = await Promise.all(
          Object.entries(override.kits!).map(async ([variante, k]) => [
            variante,
            k?.imageUrl ? { ...k, imageUrl: (await guardarImagem(k.imageUrl)) ?? undefined } : k,
          ]),
        )
        return Object.fromEntries(pares)
      })()) as TeamOverride["kits"])
    : undefined

  const promovido = JSON.stringify({ ...override, logoUrl, ...(kits ? { kits } : {}) })
  if (promovido === inline) return // web, ou nada era imagem inline
  // Se o jogador editou o clube de novo enquanto o disco respondia, a edição
  // nova é a boa — não sobrescreve.
  if (storeGet(KEY(fileKey)) !== inline) return
  storeSet(KEY(fileKey), promovido)
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("ultrafoot:team:changed", { detail: { key: fileKey } }))
}

export function clearTeamOverride(fileKey: string): void {
  storeRemove(KEY(fileKey))
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("ultrafoot:team:changed", { detail: { key: fileKey } }))
}

export function applyTeamOverride<T extends { file_key?: string; cor1?: string; cor2?: string }>(team: T): T {
  if (!team.file_key) return team
  const override = getTeamOverride(team.file_key)
  if (!override) return team
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { ...team, ...(override as any) }
}
