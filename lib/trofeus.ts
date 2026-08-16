// QUAL TROFÉU É O DESTA CONQUISTA.
//
// O acervo tem 72 peças — 26 estaduais, as quatro divisões brasileiras, ligas e
// copas de outros países, continentais, super copas e três genéricos — e **58
// delas nunca apareceram na tela**. Só 14 estavam referenciadas, todas em
// `competition-intro`; a cerimônia do campeão (`app/campeao`) mostrava um ícone
// de linha do lucide, o MESMO para quem ganhou o Paulistão e para quem ganhou a
// Champions, enquanto `tr_estadual_SP_d1.webp` ficava parado no disco.
//
// A entrada é o NOME EXIBIDO da competição ("Campeonato Paulista", "Brasileirão
// Série B"), porque é o que o save guarda em `ultrafoot-pending-champion` —
// não há id ali. Por isso o casamento é por padrão de texto, normalizado sem
// acento e em minúsculas, e SEMPRE termina num genérico: título sem arte é
// preferível a título sem troféu, e nunca deve quebrar a cerimônia.
//
// A ordem das regras importa: "Copa do Nordeste" tem de casar ANTES de "copa",
// e "Supercopa do Brasil" antes de "brasil".

const norm = (s: string) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

/** Estaduais: o nome do campeonato leva à UF, e a UF ao arquivo. */
const ESTADUAIS: [RegExp, string][] = [
  [/paulista|paulistao/, "tr_estadual_SP_d1"],
  [/carioca/, "tr_estadual_RJ"],
  [/mineiro/, "tr_estadual_MG"],
  [/gaucho/, "tr_estadual_RS_D1"],
  [/paranaense/, "tr_estadual_PR"],
  [/catarinense/, "tr_estadual_SC_d1"],
  [/baiano/, "tr_estadual_BA"],
  [/pernambucano/, "tr_estadual_PE_d1"],
  [/cearense/, "tr_estadual_CE"],
  [/goiano/, "tr_estadual_GO"],
  [/capixaba/, "tr_estadual_ES"],
  [/sergipano/, "tr_estadual_SE"],
  [/alagoano/, "tr_estadual_AL"],
  [/paraibano/, "tr_estadual_PB"],
  [/potiguar|norte-rio-grandense/, "tr_estadual_RN"],
  [/piauiense/, "tr_estadual_PI"],
  [/maranhense/, "tr_estadual_MA"],
  [/paraense/, "tr_estadual_PA"],
  [/amazonense/, "tr_estadual_AM"],
  [/acreano|acriano/, "tr_estadual_AC"],
  [/rondoniense/, "tr_estadual_RO"],
  [/roraimense/, "tr_estadual_RR"],
  [/amapaense/, "tr_estadual_AP"],
  [/tocantinense/, "tr_estadual_TO"],
  [/sul-?mato-?grossense/, "tr_estadual_MS"],
  [/mato-?grossense/, "tr_estadual_MT"],
  [/brasiliense|candango/, "tr_estadual_DF"],
]

/** Tudo que não é estadual. Avaliado NESTA ordem. */
const REGRAS: [RegExp, string][] = [
  // Continentais e seleções — o mais específico primeiro.
  [/libertadores/, "tr_libertadores"],
  [/sul-?americana/, "tr_sulamericana"],
  [/recopa sul-?americana/, "tr_recopasulamaericana"],
  [/champions league|liga dos campeoes|ligacampeoes/, "tr_ligacampeoes"],
  [/europa league|liga europa/, "tr_ligaeuropa"],
  [/conference/, "tr_conference"],
  [/supercopa da uefa|recopa europeia/, "tr_recopaeuropa"],
  [/mundial de clubes|intercontinental/, "tr_mundial"],
  [/copa do mundo/, "tr_copamundo"],
  [/eurocopa|euro\b/, "tr_eurocopa"],
  [/copa america/, "tr_copaamerica"],
  [/copa ouro|gold cup/, "tr_copaouro"],
  [/copa africa|can\b/, "tr_copaafrica"],
  [/copa da asia|asian cup/, "tr_copaasia"],
  [/nations league.*c\b|liga das nacoes.*c\b/, "tr_liganacoesC"],
  [/nations league|liga das nacoes/, "tr_liganacoes"],
  [/finalissima/, "tr_finalissima"],
  [/ofc nations|copa das nacoes da oceania/, "tr_copaofc"],
  [/afc champions|liga dos campeoes da asia/, "tr_ligaafc"],
  [/caf champions|liga dos campeoes da africa/, "tr_ligacaf"],
  [/concacaf champions|liga dos campeoes da concacaf/, "tr_ligaconcacaf"],
  [/ofc champions/, "tr_ligaofc"],

  // Copas nacionais e regionais do Brasil.
  // A Taça Guanabara é o título da PRIMEIRA FASE do Carioca, não o Carioca:
  // por isso NÃO recebe `tr_estadual_RJ`. Dar a arte do troféu estadual a ela
  // colocaria duas conquistas diferentes da mesma temporada com o mesmo
  // desenho no histórico — quem ganhou só a fase pareceria campeão carioca.
  // Enquanto não houver arte própria, a taça genérica diz a verdade.
  [/taca guanabara/, "tr_copa"],
  [/copa do nordeste/, "tr_copanordeste"],
  [/copa verde/, "tr_copaverde"],
  [/rio-?sao paulo/, "tr_riosaopaulo"],
  [/supercopa do brasil|supercopa rei/, "tr_supercopa_BRA"],
  [/copa do brasil/, "tr_copa_BRA"],

  // Ligas nacionais por divisão.
  [/brasileirao serie d|serie d\b/, "tr_nacional_BRA_d4"],
  [/brasileirao serie c|serie c\b/, "tr_nacional_BRA_d3"],
  [/brasileirao serie b|serie b\b/, "tr_nacional_BRA_d2"],
  [/brasileirao|serie a\b/, "tr_nacional_BRA_d1"],

  // Outros países.
  [/supercopa da espanha/, "tr_supercopa_ESP"],
  [/copa del rey|copa do rei/, "tr_copa_ESP"],
  [/la liga 2|segunda division/, "tr_nacional_ESP_d2"],
  [/la liga|espanhol/, "tr_nacional_ESP"],
  [/fa cup|copa da inglaterra/, "tr_copa_ING"],
  [/premier league|ingles/, "tr_nacional_ING"],
  [/coppa italia|copa da italia/, "tr_copa_ITA"],
  [/serie a italiana|italiano/, "tr_nacional_ITA"],
  [/copa da nova zelandia/, "tr_copa_NZE"],
  [/nova zelandia/, "tr_nacional_NZE"],
]

/** Genéricos — o último recurso, por natureza da competição. */
const GENERICO_COPA = "tr_copa"
const GENERICO_ESTADUAL = "tr_estadualgenerico"
const GENERICO_NACIONAL = "tr_nacionalgenerico"
const GENERICO_SUPERCOPA = "tr_supercopa_generico"

/**
 * Caminho da arte do troféu desta competição.
 *
 * `tipo` só é usado no fallback: quando o nome não casa com nada, uma copa
 * recebe a taça genérica e uma liga recebe o escudo genérico — errar o desenho
 * é bem menos grave que mostrar taça para quem foi campeão de pontos corridos.
 */
export function trofeuDaCompeticao(nome: string, tipo?: "league" | "cup"): string {
  const n = norm(nome)
  if (!n) return `/trofeus/${tipo === "cup" ? GENERICO_COPA : GENERICO_NACIONAL}.webp`

  for (const [re, arq] of ESTADUAIS) if (re.test(n)) return `/trofeus/${arq}.webp`
  for (const [re, arq] of REGRAS) if (re.test(n)) return `/trofeus/${arq}.webp`

  if (/supercopa|super cup/.test(n)) return `/trofeus/${GENERICO_SUPERCOPA}.webp`
  if (/campeonato .*(ense|ano|eiro|ista|ano)\b/.test(n)) return `/trofeus/${GENERICO_ESTADUAL}.webp`
  if (/copa|cup|taca/.test(n) || tipo === "cup") return `/trofeus/${GENERICO_COPA}.webp`
  return `/trofeus/${GENERICO_NACIONAL}.webp`
}
