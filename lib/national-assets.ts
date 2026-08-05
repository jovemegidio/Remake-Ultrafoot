// Brasão e uniforme das SELEÇÕES.
//
// Ate agora a selecao nao tinha imagem nenhuma — so nome e cores. Aqui ficam os
// caminhos de:
//   escudo:   public/escudos/nations/<id>.png            (o usuario importa a parte)
//   uniforme: public/kits-nations/<id>_<variante>.png    (UEFA/CONCACAF importados;
//             as demais o usuario solta no mesmo formato PNG dos escudos)
// keyed pelo `id` da selecao (brasil, inglaterra...). Ver lib/national-teams.
// PNG nos dois para o usuario poder soltar o arquivo direto, sem converter.
//
// Tudo best-effort: quando o arquivo nao existe, o componente que renderiza cai
// num fallback (camisa desenhada com as cores da selecao). Assim nenhuma
// selecao fica "quebrada" enquanto os escudos nao chegam.

import { gameAssetUrl, isTauri } from "@/lib/game-asset"
import { getTeamOverride } from "@/lib/team-overrides"

const ULTRAFOOT_RAW_URL = "https://raw.githubusercontent.com/jovemegidio/Ultrafoot/main"

/** Escudo da selecao por id. No Tauri vem empacotado; na web, do repositorio. */
export function getNationalCrestUrl(id: string): string {
  const custom = getTeamOverride(`nation_${id}`)?.logoUrl
  if (custom) return custom
  // ⚠️ LOCAL E REMOTO DIVERGEM DE PROPÓSITO. O que viaja no instalador foi
  // convertido para WebP sem perdas; o repositório remoto é de terceiros e
  // continua servindo PNG. Este caminho montava UMA string para os dois — trocar
  // a extensão de uma vez quebraria o lado web em silêncio.
  if (isTauri()) return gameAssetUrl(`/escudos/nations/${id}.webp`)
  return `${ULTRAFOOT_RAW_URL}/teams/escudos/nations/${id}.png`
}

/** Uniforme da selecao (home/away/third). Mesmo esquema (e formato PNG) do escudo. */
export function getNationalKitUrl(id: string, variant: "home" | "away" | "third" = "home"): string {
  const kit = getTeamOverride(`nation_${id}`)?.kits?.[variant]
  if (kit?.disabled) return ""
  const custom = kit?.imageUrl
  if (custom) return custom
  const rel = `/kits-nations/${id}_${variant}.png`
  if (isTauri()) return gameAssetUrl(rel)
  return `${ULTRAFOOT_RAW_URL}/teams${rel}`
}
