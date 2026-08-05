// Selecoes nacionais montadas pela NACIONALIDADE DO ATLETA.
//
// ⚠️ ANTES ERA PELO CLUBE, e isso estava errado por definicao: o elenco saia de
// `allTeams.filter(t => t.pais === countryKey)` — os clubes DAQUELE PAIS. Numa
// selecao de verdade e o contrario: Mbappe joga no Real Madrid e defende a
// Franca. Com o filtro por clube, todo atleta que atua fora do proprio pais
// ficava invisivel para a sua selecao, e o que faltava era completado por
// `fallbackNationalPlayers`, que INVENTA nomes a partir do id da selecao
// ("Aalbania1", "Aalbania2"...).
//
// O comentario original dizia que "os jogadores do jogo nao tem nacionalidade
// explicita". Isso era verdade quando foi escrito e deixou de ser: a auditoria
// (scripts/auditar-nacionalidades.ts) encontra 16.891 atletas, 13.259 deles
// (78,5%) COM nacionalidade, cobrindo 145 paises. O dado chegou e o codigo nao
// acompanhou.
//
// ⚠️ E O CASAMENTO E SEM ACENTO. As selecoes usam id/countryKey sem acento
// ("Colombia", "Franca", "Italia") e os seeds usam o nome com acento
// ("Colômbia", "França", "Itália"). Comparando cru, 29 selecoes davam ZERO
// atletas tendo centenas no banco — Colombia 603, Franca 414, Italia 404,
// Belgica 224, Russia 196. Nao faltava dado; faltava normalizar.

import { allTeams, allBrazilianTeams, type Team } from "@/lib/teams-data"
import { getPlayersForTeam, sortByPosition, type Player } from "@/lib/players-data"
import { getTeamOverride } from "@/lib/team-overrides"
import { getPlayerOverride } from "@/lib/player-overrides"

export type Confederation = "CONMEBOL" | "UEFA" | "CONCACAF" | "AFC" | "CAF" | "OFC"

export interface NationalTeam {
  id: string
  name: string
  code: string
  confederation: Confederation
  cor1: string
  cor2: string
  // Nome do pais usado no campo `pais` dos clubes (vazio = clubes brasileiros)
  countryKey: string
  /** Forca-base editorial para selecoes cujo elenco ainda nao existe nos clubes locais. */
  baselineStrength?: number
}

// Catalogo de selecoes suportadas. countryKey casa com o campo `pais` dos clubes.
export const NATIONAL_TEAMS: NationalTeam[] = [
  // CONMEBOL
  { id: "brasil", name: "Brasil", code: "BRA", confederation: "CONMEBOL", cor1: "#ffd400", cor2: "#009b3a", countryKey: "" },
  { id: "argentina", name: "Argentina", code: "ARG", confederation: "CONMEBOL", cor1: "#6cace4", cor2: "#ffffff", countryKey: "Argentina" },
  { id: "uruguai", name: "Uruguai", code: "URU", confederation: "CONMEBOL", cor1: "#5cbfeb", cor2: "#ffffff", countryKey: "Uruguai" },
  { id: "colombia", name: "Colombia", code: "COL", confederation: "CONMEBOL", cor1: "#fcd116", cor2: "#003893", countryKey: "Colombia" },
  { id: "chile", name: "Chile", code: "CHI", confederation: "CONMEBOL", cor1: "#d52b1e", cor2: "#0039a6", countryKey: "Chile" },
  { id: "peru", name: "Peru", code: "PER", confederation: "CONMEBOL", cor1: "#d91023", cor2: "#ffffff", countryKey: "Peru", baselineStrength: 76 },
  { id: "venezuela", name: "Venezuela", code: "VEN", confederation: "CONMEBOL", cor1: "#8a1538", cor2: "#f4c300", countryKey: "Venezuela", baselineStrength: 76 },
  // UEFA
  { id: "inglaterra", name: "Inglaterra", code: "ENG", confederation: "UEFA", cor1: "#ffffff", cor2: "#cf081f", countryKey: "Inglaterra" },
  { id: "espanha", name: "Espanha", code: "ESP", confederation: "UEFA", cor1: "#c60b1e", cor2: "#ffc400", countryKey: "Espanha" },
  { id: "italia", name: "Italia", code: "ITA", confederation: "UEFA", cor1: "#0066cc", cor2: "#ffffff", countryKey: "Italia" },
  { id: "franca", name: "Franca", code: "FRA", confederation: "UEFA", cor1: "#0055a4", cor2: "#ef4135", countryKey: "Franca" },
  { id: "alemanha", name: "Alemanha", code: "GER", confederation: "UEFA", cor1: "#000000", cor2: "#dd0000", countryKey: "Alemanha" },
  { id: "portugal", name: "Portugal", code: "POR", confederation: "UEFA", cor1: "#006600", cor2: "#cf0921", countryKey: "Portugal" },
  { id: "holanda", name: "Holanda", code: "NED", confederation: "UEFA", cor1: "#f36c21", cor2: "#21468b", countryKey: "Holanda" },
  { id: "belgica", name: "Belgica", code: "BEL", confederation: "UEFA", cor1: "#e30613", cor2: "#fdda24", countryKey: "Belgica" },
  { id: "turquia", name: "Turquia", code: "TUR", confederation: "UEFA", cor1: "#e30a17", cor2: "#ffffff", countryKey: "Turquia" },
  { id: "russia", name: "Russia", code: "RUS", confederation: "UEFA", cor1: "#0039a6", cor2: "#d52b1e", countryKey: "Russia" },
  { id: "escocia", name: "Escocia", code: "SCO", confederation: "UEFA", cor1: "#0065bf", cor2: "#ffffff", countryKey: "Escocia" },
  // CONCACAF
  { id: "mexico", name: "Mexico", code: "MEX", confederation: "CONCACAF", cor1: "#006847", cor2: "#ce1126", countryKey: "Mexico" },
  { id: "estados_unidos", name: "Estados Unidos", code: "USA", confederation: "CONCACAF", cor1: "#0a3161", cor2: "#b31942", countryKey: "Estados Unidos" },
  { id: "canada", name: "Canada", code: "CAN", confederation: "CONCACAF", cor1: "#d52b1e", cor2: "#ffffff", countryKey: "Canada" },
  // AFC
  { id: "japao", name: "Japao", code: "JPN", confederation: "AFC", cor1: "#0a1e5e", cor2: "#ffffff", countryKey: "Japao" },
  { id: "coreia_do_sul", name: "Coreia do Sul", code: "KOR", confederation: "AFC", cor1: "#c60c30", cor2: "#003478", countryKey: "Coreia do Sul" },
  { id: "arabia_saudita", name: "Arabia Saudita", code: "KSA", confederation: "AFC", cor1: "#006c35", cor2: "#ffffff", countryKey: "Arabia Saudita" },
  { id: "china", name: "China", code: "CHN", confederation: "AFC", cor1: "#de2910", cor2: "#ffde00", countryKey: "China" },
  // Demais selecoes masculinas classificadas para a Copa do Mundo FIFA 2026.
  { id: "argelia", name: "Argelia", code: "ALG", confederation: "CAF", cor1: "#006233", cor2: "#ffffff", countryKey: "Argelia", baselineStrength: 80 },
  { id: "australia", name: "Australia", code: "AUS", confederation: "AFC", cor1: "#ffcd00", cor2: "#00843d", countryKey: "Australia", baselineStrength: 80 },
  { id: "austria", name: "Austria", code: "AUT", confederation: "UEFA", cor1: "#ed2939", cor2: "#ffffff", countryKey: "Austria", baselineStrength: 84 },
  { id: "bosnia", name: "Bosnia e Herzegovina", code: "BIH", confederation: "UEFA", cor1: "#002395", cor2: "#feca00", countryKey: "Bosnia e Herzegovina", baselineStrength: 78 },
  { id: "cabo_verde", name: "Cabo Verde", code: "CPV", confederation: "CAF", cor1: "#003893", cor2: "#cf2027", countryKey: "Cabo Verde", baselineStrength: 75 },
  { id: "congo_dr", name: "RD Congo", code: "COD", confederation: "CAF", cor1: "#007fff", cor2: "#ce1021", countryKey: "RD Congo", baselineStrength: 77 },
  { id: "costa_do_marfim", name: "Costa do Marfim", code: "CIV", confederation: "CAF", cor1: "#f77f00", cor2: "#009e60", countryKey: "Costa do Marfim", baselineStrength: 82 },
  { id: "croacia", name: "Croacia", code: "CRO", confederation: "UEFA", cor1: "#ff0000", cor2: "#ffffff", countryKey: "Croacia", baselineStrength: 86 },
  { id: "curacao", name: "Curacao", code: "CUW", confederation: "CONCACAF", cor1: "#002b7f", cor2: "#f9e814", countryKey: "Curacao", baselineStrength: 73 },
  { id: "tchequia", name: "Tchequia", code: "CZE", confederation: "UEFA", cor1: "#d7141a", cor2: "#11457e", countryKey: "Tchequia", baselineStrength: 81 },
  { id: "equador", name: "Equador", code: "ECU", confederation: "CONMEBOL", cor1: "#ffdd00", cor2: "#034ea2", countryKey: "Equador", baselineStrength: 84 },
  { id: "egito", name: "Egito", code: "EGY", confederation: "CAF", cor1: "#ce1126", cor2: "#ffffff", countryKey: "Egito", baselineStrength: 82 },
  { id: "gana", name: "Gana", code: "GHA", confederation: "CAF", cor1: "#ce1126", cor2: "#fcd116", countryKey: "Gana", baselineStrength: 80 },
  { id: "haiti", name: "Haiti", code: "HAI", confederation: "CONCACAF", cor1: "#00209f", cor2: "#d21034", countryKey: "Haiti", baselineStrength: 72 },
  { id: "ira", name: "Ira", code: "IRN", confederation: "AFC", cor1: "#239f40", cor2: "#da0000", countryKey: "Ira", baselineStrength: 80 },
  { id: "iraque", name: "Iraque", code: "IRQ", confederation: "AFC", cor1: "#ce1126", cor2: "#000000", countryKey: "Iraque", baselineStrength: 75 },
  { id: "jordania", name: "Jordania", code: "JOR", confederation: "AFC", cor1: "#007a3d", cor2: "#ce1126", countryKey: "Jordania", baselineStrength: 75 },
  { id: "marrocos", name: "Marrocos", code: "MAR", confederation: "CAF", cor1: "#c1272d", cor2: "#006233", countryKey: "Marrocos", baselineStrength: 86 },
  { id: "nova_zelandia", name: "Nova Zelandia", code: "NZL", confederation: "OFC", cor1: "#101820", cor2: "#ffffff", countryKey: "Nova Zelandia", baselineStrength: 74 },
  { id: "noruega", name: "Noruega", code: "NOR", confederation: "UEFA", cor1: "#ba0c2f", cor2: "#00205b", countryKey: "Noruega", baselineStrength: 86 },
  { id: "panama", name: "Panama", code: "PAN", confederation: "CONCACAF", cor1: "#d21034", cor2: "#ffffff", countryKey: "Panama", baselineStrength: 77 },
  { id: "paraguai", name: "Paraguai", code: "PAR", confederation: "CONMEBOL", cor1: "#d52b1e", cor2: "#0038a8", countryKey: "Paraguai", baselineStrength: 80 },
  { id: "qatar", name: "Catar", code: "QAT", confederation: "AFC", cor1: "#8a1538", cor2: "#ffffff", countryKey: "Catar", baselineStrength: 76 },
  { id: "africa_do_sul", name: "Africa do Sul", code: "RSA", confederation: "CAF", cor1: "#007749", cor2: "#ffb81c", countryKey: "Africa do Sul", baselineStrength: 76 },
  { id: "senegal", name: "Senegal", code: "SEN", confederation: "CAF", cor1: "#00853f", cor2: "#fdef42", countryKey: "Senegal", baselineStrength: 84 },
  { id: "suecia", name: "Suecia", code: "SWE", confederation: "UEFA", cor1: "#006aa7", cor2: "#fecc02", countryKey: "Suecia", baselineStrength: 81 },
  { id: "suica", name: "Suica", code: "SUI", confederation: "UEFA", cor1: "#d52b1e", cor2: "#ffffff", countryKey: "Suica", baselineStrength: 84 },
  { id: "tunisia", name: "Tunisia", code: "TUN", confederation: "CAF", cor1: "#e70013", cor2: "#ffffff", countryKey: "Tunisia", baselineStrength: 78 },
  { id: "uzbequistao", name: "Uzbequistao", code: "UZB", confederation: "AFC", cor1: "#1eb53a", cor2: "#0099b5", countryKey: "Uzbequistao", baselineStrength: 76 },
  // A CONMEBOL tem 10 federacoes e a Bolivia era a unica ausente — as
  // Eliminatorias sul-americanas rodavam com 9 seçoes, numero IMPAR, que deixa
  // uma seleçao de folga por rodada e nao fecha o turno-returno de 18 jogos.
  { id: "bolivia", name: "Bolivia", code: "BOL", confederation: "CONMEBOL", cor1: "#007934", cor2: "#ffe000", countryKey: "Bolivia", baselineStrength: 70 },

  // ─── ACRESCENTADAS EM 05/08/2026 ────────────────────────────────────────
  //
  // UEFA tinha 18 dos 55 membros e CONCACAF 6 dos 41 — faltavam Polonia,
  // Servia, Ucrania, Dinamarca, Irlanda, Pais de Gales, Jamaica, Costa Rica...
  // (a CONMEBOL ja estava completa, com os 10.)
  //
  // ⚠️ AS CORES SAEM DA ARTE DO UNIFORME, nao de memoria: `cor1` e a cor
  // dominante da camisa 1 e `cor2` a da camisa 2, extraidas por
  // scripts/gerar-selecoes-faltantes.ts. Escrever 49 pares de cores de cabeca
  // seria chute, e chute errado nao da erro — so aparece como camisa errada.
  //
  // ⚠️ E SO ENTROU QUEM TEM ATLETA REAL NO BANCO (o numero em cada linha). O
  // pool e por NACIONALIDADE agora, entao `countryKey` casa com o `nac` do
  // seed. Cadastrar pais sem atleta o faria jogar com nomes de
  // `fallbackNationalPlayers` — o defeito que acabamos de tirar de 27 selecoes.
  // As 23 micronacoes sem dado ficaram de fora de proposito.
  { id: "albania", name: "Albania", code: "ALB", confederation: "UEFA", cor1: "#b5131b", cor2: "#e9e8e8", countryKey: "Albânia" }, // 24 atletas reais
  { id: "andorra", name: "Andorra", code: "AND", confederation: "UEFA", cor1: "#cd1818", cor2: "#e7e8e8", countryKey: "Andorra" }, // 3 atletas reais
  { id: "armenia", name: "Armenia", code: "ARM", confederation: "UEFA", cor1: "#cc1827", cor2: "#e8e8e8", countryKey: "Armênia" }, // 8 atletas reais
  { id: "azerbaijao", name: "Azerbaijao", code: "AZE", confederation: "UEFA", cor1: "#1951b1", cor2: "#e8e9e9", countryKey: "Azerbaijão" }, // 2 atletas reais
  { id: "bielorrussia", name: "Bielorrussia", code: "BLR", confederation: "UEFA", cor1: "#752530", cor2: "#92b7ab", countryKey: "Bielorrússia" }, // 7 atletas reais
  { id: "bulgaria", name: "Bulgaria", code: "BUL", confederation: "UEFA", cor1: "#e7e7e7", cor2: "#b51314", countryKey: "Bulgária" }, // 9 atletas reais
  { id: "chipre", name: "Chipre", code: "CYP", confederation: "UEFA", cor1: "#13388c", cor2: "#d2d2d3", countryKey: "Chipre" }, // 9 atletas reais
  { id: "dinamarca", name: "Dinamarca", code: "DEN", confederation: "UEFA", cor1: "#ae141b", cor2: "#d5cccd", countryKey: "Dinamarca" }, // 80 atletas reais
  { id: "estonia", name: "Estonia", code: "EST", confederation: "UEFA", cor1: "#2a4e8a", cor2: "#e7e7e7", countryKey: "Estônia" }, // 3 atletas reais
  { id: "ilhas_faroe", name: "Ilhas Faroe", code: "FRO", confederation: "UEFA", cor1: "#e8e7e8", cor2: "#12182e", countryKey: "Ilhas Faroé" }, // 1 atletas reais
  { id: "finlandia", name: "Finlandia", code: "FIN", confederation: "UEFA", cor1: "#e9e9e9", cor2: "#274784", countryKey: "Finlândia" }, // 14 atletas reais
  { id: "georgia", name: "Georgia", code: "GEO", confederation: "UEFA", cor1: "#e8eaea", cor2: "#252525", countryKey: "Geórgia" }, // 15 atletas reais
  { id: "grecia", name: "Grecia", code: "GRE", confederation: "UEFA", cor1: "#e8e8e8", cor2: "#134472", countryKey: "Grécia" }, // 18 atletas reais
  { id: "hungria", name: "Hungria", code: "HUN", confederation: "UEFA", cor1: "#b71823", cor2: "#e8e8e8", countryKey: "Hungria" }, // 13 atletas reais
  { id: "islandia", name: "Islandia", code: "ISL", confederation: "UEFA", cor1: "#158acc", cor2: "#d6d4d5", countryKey: "Islândia" }, // 11 atletas reais
  { id: "irlanda", name: "Irlanda", code: "IRL", confederation: "UEFA", cor1: "#0f5834", cor2: "#d5d8d6", countryKey: "Irlanda" }, // 58 atletas reais
  { id: "israel", name: "Israel", code: "ISR", confederation: "UEFA", cor1: "#d5d5d5", cor2: "#3a6cb3", countryKey: "Israel" }, // 14 atletas reais
  { id: "cazaquistao", name: "Cazaquistao", code: "KAZ", confederation: "UEFA", cor1: "#ebd32d", cor2: "#184494", countryKey: "Cazaquistão" }, // 1 atletas reais
  { id: "kosovo", name: "Kosovo", code: "KVX", confederation: "UEFA", cor1: "#153672", cor2: "#d2d3d2", countryKey: "Kosovo" }, // 13 atletas reais
  { id: "letonia", name: "Letonia", code: "LVA", confederation: "UEFA", cor1: "#752533", cor2: "#e7e7e7", countryKey: "Letônia" }, // 1 atletas reais
  { id: "lituania", name: "Lituania", code: "LTU", confederation: "UEFA", cor1: "#d7b516", cor2: "#1b4b4d", countryKey: "Lituânia" }, // 8 atletas reais
  { id: "luxemburgo", name: "Luxemburgo", code: "LUX", confederation: "UEFA", cor1: "#ae181c", cor2: "#1b2f46", countryKey: "Luxemburgo" }, // 6 atletas reais
  { id: "moldavia", name: "Moldavia", code: "MDA", confederation: "UEFA", cor1: "#314b92", cor2: "#ebca29", countryKey: "Moldávia" }, // 4 atletas reais
  { id: "montenegro", name: "Montenegro", code: "MNE", confederation: "UEFA", cor1: "#b41718", cor2: "#e9e9e9", countryKey: "Montenegro" }, // 7 atletas reais
  { id: "macedonia_do_norte", name: "Macedonia do Norte", code: "MKD", confederation: "UEFA", cor1: "#cd1712", cor2: "#d3d3d3", countryKey: "Macedônia do Norte" }, // 5 atletas reais
  { id: "irlanda_do_norte", name: "Irlanda do Norte", code: "NIR", confederation: "UEFA", cor1: "#104b4e", cor2: "#e9e9e8", countryKey: "Irlanda do Norte" }, // 22 atletas reais
  { id: "polonia", name: "Polonia", code: "POL", confederation: "UEFA", cor1: "#e9e9e9", cor2: "#cf1818", countryKey: "Polônia" }, // 46 atletas reais
  { id: "romenia", name: "Romenia", code: "ROU", confederation: "UEFA", cor1: "#ead01d", cor2: "#ce1a27", countryKey: "Romênia" }, // 24 atletas reais
  { id: "servia", name: "Servia", code: "SRB", confederation: "UEFA", cor1: "#1b43b9", cor2: "#e8e7e7", countryKey: "Sérvia" }, // 54 atletas reais
  { id: "eslovaquia", name: "Eslovaquia", code: "SVK", confederation: "UEFA", cor1: "#243c85", cor2: "#e7e7e7", countryKey: "Eslováquia" }, // 23 atletas reais
  { id: "eslovenia", name: "Eslovenia", code: "SVN", confederation: "UEFA", cor1: "#e7e7e7", cor2: "#175793", countryKey: "Eslovênia" }, // 22 atletas reais
  { id: "ucrania", name: "Ucrania", code: "UKR", confederation: "UEFA", cor1: "#d8cc17", cor2: "#185596", countryKey: "Ucrânia" }, // 26 atletas reais
  { id: "pais_de_gales", name: "Pais de Gales", code: "WAL", confederation: "UEFA", cor1: "#b31212", cor2: "#d6d6d6", countryKey: "País de Gales" }, // 38 atletas reais
  { id: "barbados", name: "Barbados", code: "BRB", confederation: "CONCACAF", cor1: "#e6b710", cor2: "#283487", countryKey: "Barbados" }, // 1 atletas reais
  { id: "costa_rica", name: "Costa Rica", code: "CRC", confederation: "CONCACAF", cor1: "#aa182d", cor2: "#b3c7d4", countryKey: "Costa Rica" }, // 10 atletas reais
  { id: "republica_dominicana", name: "Republica Dominicana", code: "DOM", confederation: "CONCACAF", cor1: "#253954", cor2: "#e8e8e8", countryKey: "República Dominicana" }, // 10 atletas reais
  { id: "el_salvador", name: "El Salvador", code: "SLV", confederation: "CONCACAF", cor1: "#264b73", cor2: "#cdd1d4", countryKey: "El Salvador" }, // 5 atletas reais
  { id: "guiana_francesa", name: "Guiana Francesa", code: "GYF", confederation: "CONCACAF", cor1: "#e8d449", cor2: "#2c7268", countryKey: "Guiana Francesa" }, // 1 atletas reais
  { id: "guadalupe", name: "Guadalupe", code: "GLP", confederation: "CONCACAF", cor1: "#af1212", cor2: "#147845", countryKey: "Guadalupe" }, // 8 atletas reais
  { id: "guatemala", name: "Guatemala", code: "GUA", confederation: "CONCACAF", cor1: "#e9e9e9", cor2: "#232323", countryKey: "Guatemala" }, // 2 atletas reais
  { id: "guiana", name: "Guiana", code: "GUY", confederation: "CONCACAF", cor1: "#cb992f", cor2: "#1c774d", countryKey: "Guiana" }, // 2 atletas reais
  { id: "honduras", name: "Honduras", code: "HON", confederation: "CONCACAF", cor1: "#eae9e9", cor2: "#171717", countryKey: "Honduras" }, // 6 atletas reais
  { id: "jamaica", name: "Jamaica", code: "JAM", confederation: "CONCACAF", cor1: "#d4a933", cor2: "#252726", countryKey: "Jamaica" }, // 29 atletas reais
  { id: "martinica", name: "Martinica", code: "MTQ", confederation: "CONCACAF", cor1: "#151514", cor2: "#cf1212", countryKey: "Martinica" }, // 6 atletas reais
  { id: "porto_rico", name: "Porto Rico", code: "PUR", confederation: "CONCACAF", cor1: "#102c54", cor2: "#c9ced4", countryKey: "Porto Rico" }, // 2 atletas reais
  { id: "santa_lucia", name: "Santa Lucia", code: "LCA", confederation: "CONCACAF", cor1: "#f0ca2e", cor2: "#1549b7", countryKey: "Santa Lúcia" }, // 1 atletas reais
  { id: "sao_vicente", name: "Sao Vicente e Granadinas", code: "VIN", confederation: "CONCACAF", cor1: "#e9b536", cor2: "#1152aa", countryKey: "São Vicente e Granadinas" }, // 1 atletas reais
  { id: "suriname", name: "Suriname", code: "SUR", confederation: "CONCACAF", cor1: "#e8e8e8", cor2: "#1c7650", countryKey: "Suriname" }, // 12 atletas reais
  { id: "trinidad_e_tobago", name: "Trinidad e Tobago", code: "TRI", confederation: "CONCACAF", cor1: "#b52e45", cor2: "#f1eaea", countryKey: "Trinidad e Tobago" }, // 6 atletas reais
]

const NT_BY_ID = new Map(NATIONAL_TEAMS.map(nt => [nt.id, nt]))

export function nationalTeamFileKey(id: string): string {
  return `nation_${id}`
}

function applyNationalTeamOverride(nt: NationalTeam): NationalTeam {
  const override = getTeamOverride(nationalTeamFileKey(nt.id))
  if (!override) return nt
  return {
    ...nt,
    name: override.nome?.trim() || nt.name,
    code: override.curto?.trim().toUpperCase() || nt.code,
    cor1: override.cor1 || nt.cor1,
    cor2: override.cor2 || nt.cor2,
  }
}

export function getNationalTeamById(id: string | null | undefined): NationalTeam | undefined {
  if (!id) return undefined
  const team = NT_BY_ID.get(id)
  return team ? applyNationalTeamOverride(team) : undefined
}

export function getNationalTeamsByConfederation(conf: Confederation): NationalTeam[] {
  return NATIONAL_TEAMS
    .filter(nt => nt.confederation === conf)
    .map(applyNationalTeamOverride)
}

export function getAllNationalTeams(): NationalTeam[] {
  return NATIONAL_TEAMS.map(applyNationalTeamOverride)
}

/** Chave de comparacao de nacionalidade: sem acento, sem caixa, sem sobra. */
function chaveDeNacao(v?: string | null): string {
  return (v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}

/**
 * Grafias que os seeds usam e que NAO se resolvem so tirando acento.
 *
 * Mantido curto de proposito: cada linha aqui e uma divergencia real encontrada
 * na auditoria, nao um chute. Acento sozinho ja resolve a maioria
 * (Colômbia→Colombia, França→Franca, Itália→Italia...).
 */
const ALIAS_DE_NACAO: Record<string, string[]> = {
  tchequia: ["republica tcheca", "chequia", "czechia"],
  ira: ["irao", "iran"],
  "estados unidos": ["eua", "estados unidos da america"],
  "coreia do sul": ["coreia", "republica da coreia"],
  "bosnia e herzegovina": ["bosnia", "bosnia-herzegovina"],
  "africa do sul": ["republica sul-africana"],
  "rd congo": ["congo", "republica democratica do congo", "congo-kinshasa"],
  "arabia saudita": ["arabia"],
  holanda: ["paises baixos"],
}

/** Todas as chaves sob as quais uma selecao aceita um atleta. */
function chavesDaSelecao(nt: NationalTeam): Set<string> {
  const base = [nt.name, nt.countryKey].filter(Boolean).map(chaveDeNacao)
  const extras = base.flatMap(k => ALIAS_DE_NACAO[k] ?? []).map(chaveDeNacao)
  // O Brasil tem countryKey vazio (clubes brasileiros nao repetem o pais).
  if (nt.id === "brasil") base.push("brasil")
  return new Set([...base, ...extras].filter(Boolean))
}

/**
 * INDICE nacionalidade -> atletas, montado UMA VEZ.
 *
 * ⚠️ Sem cache isto seria inviavel: cada consulta a uma selecao varreria os
 * ~2.400 clubes chamando `getPlayersForTeam` (que resolve seed + overrides por
 * clube). A tela de convocacao consulta varias vezes por render.
 *
 * O indice e invalidado pelos MESMOS eventos que o resto do jogo usa quando o
 * elenco muda — pacote do canal aplicado e store do Tauri hidratado —, senao
 * uma atualizacao de elencos ficaria invisivel ate reiniciar.
 */
type FonteDeAtleta = { player: Player; team: Team }
const indicePorNacao = new Map<string, Map<string, FonteDeAtleta[]>>()

if (typeof window !== "undefined") {
  const limpar = () => indicePorNacao.clear()
  window.addEventListener("ultrafoot:elencos:atualizados", limpar)
  window.addEventListener("ultrafoot:store:ready", limpar)
}

function getIndicePorNacao(raw: boolean): Map<string, FonteDeAtleta[]> {
  const cacheKey = raw ? "raw" : "normal"
  const pronto = indicePorNacao.get(cacheKey)
  if (pronto) return pronto

  const idx = new Map<string, FonteDeAtleta[]>()
  for (const team of allTeams) {
    for (const player of getPlayersForTeam(team, raw ? { raw: true } : undefined)) {
      const k = chaveDeNacao(player.nac)
      // Sem nacionalidade o atleta simplesmente nao entra: adivinhar pela liga
      // colocaria um brasileiro do Porto na selecao de Portugal.
      if (!k) continue
      const lista = idx.get(k)
      if (lista) lista.push({ player, team })
      else idx.set(k, [{ player, team }])
    }
  }
  indicePorNacao.set(cacheKey, idx)
  return idx
}

/** Atletas REAIS elegiveis para a selecao, de qualquer clube do mundo. */
function atletasDaNacao(nt: NationalTeam, raw: boolean): FonteDeAtleta[] {
  const idx = getIndicePorNacao(raw)
  const out: FonteDeAtleta[] = []
  for (const chave of chavesDaSelecao(nt)) {
    const lista = idx.get(chave)
    if (lista) out.push(...lista)
  }
  // Melhores primeiro: a convocacao mostra os 60 primeiros.
  return out.sort((a, b) => (b.player.base ?? 0) - (a.player.base ?? 0))
}

const NATIONAL_FALLBACK_POSITIONS = [
  "GOL", "GOL", "GOL",
  "LD", "LD", "ZAG", "ZAG", "ZAG", "ZAG", "LE", "LE",
  "VOL", "VOL", "VOL", "MEI", "MEI", "MEI", "MEI",
  "PD", "PE", "ATA", "ATA", "ATA",
] as const

const NATIONAL_FIRST_NAMES = [
  "Alex", "Daniel", "Lucas", "Martin", "David", "Samuel", "Victor", "Nicolas",
  "Gabriel", "Adam", "Leo", "Marco", "Ivan", "Youssef", "Omar", "Ryan",
]

/**
 * Elenco editorial para países sem atletas suficientes nos clubes do banco.
 * É estável por seleção e fornece 23 pessoas reais para o editor e as partidas,
 * em vez de uma tela vazia sustentada apenas pelo overall abstrato da seleção.
 */
function fallbackNationalPlayers(nt: NationalTeam): Player[] {
  const strength = NATIONAL_STRENGTH_2026[nt.id] ?? nt.baselineStrength ?? 68
  let seed = [...nt.id].reduce((sum, char) => (sum * 33 + char.charCodeAt(0)) >>> 0, 5381)
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  return NATIONAL_FALLBACK_POSITIONS.map((pos, index) => {
    const first = NATIONAL_FIRST_NAMES[Math.floor(next() * NATIONAL_FIRST_NAMES.length)]
    const surname = `${nt.code.charAt(0)}${nt.id.replaceAll("_", "").slice(0, 6)}${index + 1}`
    const age = 19 + Math.floor(next() * 15)
    const base = Math.max(55, Math.min(92, strength - 5 + Math.floor(next() * 11)))
    return {
      nome: `${first} ${surname}`,
      pos,
      idade: age,
      base,
      time: nt.name,
      nac: nt.name,
    }
  })
}

function applyNationalPlayerOverride(nt: NationalTeam, player: Player): Player {
  const override = getPlayerOverride(nationalTeamFileKey(nt.id), player.nome)
  if (!override) return player
  return {
    ...player,
    nome: override.nome ?? player.nome,
    pos: override.pos ?? player.pos,
    idade: override.idade ?? player.idade,
    base: Math.max(1, Math.min(99, override.base ?? player.base)),
    nac: override.nac ?? player.nac,
    pace: override.pace ?? player.pace,
    shooting: override.shooting ?? player.shooting,
    passing: override.passing ?? player.passing,
    dribbling: override.dribbling ?? player.dribbling,
    defending: override.defending ?? player.defending,
    physical: override.physical ?? player.physical,
    preferredFoot: override.preferredFoot ?? player.preferredFoot,
    reputation: override.reputation ?? player.reputation,
    traits: override.traits ?? player.traits,
  }
}

/** Jogador e clube de origem, para o editor persistir a alteração no atleta real. */
export function getNationalPlayerSources(
  nt: NationalTeam,
  opts?: { raw?: boolean },
): Array<{ player: Player; team: Team }> {
  const sources = atletasDaNacao(nt, Boolean(opts?.raw))
  if (sources.length < 23) {
    const virtualTeam = {
      nome: nt.name,
      curto: nt.code,
      pais: nt.name,
      file_key: nationalTeamFileKey(nt.id),
    } as Team
    const complement = fallbackNationalPlayers(nt)
      .slice(0, 23 - sources.length)
      .map(player => ({
      player,
      team: virtualTeam,
    }))
    sources.push(...complement)
  }
  if (opts?.raw) return sources
  return sources.map(source => ({
    ...source,
    player: applyNationalPlayerOverride(nt, source.player),
  }))
}

// Pool completo de jogadores disponiveis para a selecao
export function getNationalPlayerPool(nt: NationalTeam): Player[] {
  return getNationalPlayerSources(nt).map(entry => entry.player)
}

// Normaliza posicoes para os 4 setores
export type NationalSector = "GOL" | "DEF" | "MEI" | "ATA"

export function nationalSector(pos: string): NationalSector {
  const p = pos.toUpperCase()
  if (p === "GOL") return "GOL"
  if (["ZAG", "LD", "LE", "LAT", "DEF"].includes(p)) return "DEF"
  if (["VOL", "MEI", "MC", "ME", "MD"].includes(p)) return "MEI"
  return "ATA"
}

/** Tamanho da lista e cota por setor — MESMA regra que a tela de convocacao mostra. */
export const NATIONAL_SQUAD_SIZE = 23
export const NATIONAL_SQUAD_QUOTAS: Record<NationalSector, number> = { GOL: 3, DEF: 8, MEI: 7, ATA: 5 }
export const NATIONAL_SECTOR_LABEL: Record<NationalSector, string> = {
  GOL: "Goleiros",
  DEF: "Defensores",
  MEI: "Meio-campistas",
  ATA: "Atacantes",
}

// Monta uma convocacao equilibrada (~23 jogadores) com os melhores de cada setor.
/** Chave estavel de um jogador (nome + clube) — usada por cortes/convocacoes manuais. */
export function nationalPlayerKey(p: { nome: string; time?: string }): string {
  return `${p.nome}__${p.time ?? ""}`
}

/**
 * Convocacao da selecao.
 *
 * Antes era 100% automatica (23 melhores por cota). Agora o tecnico pode intervir:
 *   - `cuts`: jogadores CORTADOS — saem e o proximo melhor entra no lugar;
 *   - `calls`: jogadores CONVOCADOS a dedo — entram primeiro, mesmo fora do top por cota.
 * Sem cuts/calls, o comportamento e identico ao automatico de antes.
 */
export function getNationalSquad(
  nt: NationalTeam,
  opts: { cuts?: string[]; calls?: string[] } = {},
): Player[] {
  const cuts = new Set(opts.cuts ?? [])
  const calls = new Set(opts.calls ?? [])
  const pool = [...getNationalPlayerPool(nt)]
    .filter((p) => !cuts.has(nationalPlayerKey(p)))
    .sort((a, b) => b.base - a.base)

  const quotas = NATIONAL_SQUAD_QUOTAS
  const picked: Player[] = []
  const counters: Record<NationalSector, number> = { GOL: 0, DEF: 0, MEI: 0, ATA: 0 }
  const seen = new Set<string>()

  // 1) Convocados a dedo entram primeiro (respeitando o limite da lista).
  for (const p of pool) {
    if (!calls.has(nationalPlayerKey(p))) continue
    const key = nationalPlayerKey(p)
    if (seen.has(key)) continue
    picked.push(p)
    counters[nationalSector(p.pos)]++
    seen.add(key)
    if (picked.length >= NATIONAL_SQUAD_SIZE) break
  }

  // 2) Preenche por cota com os melhores restantes.
  for (const p of pool) {
    const key = nationalPlayerKey(p)
    if (seen.has(key)) continue
    const sector = nationalSector(p.pos)
    if (counters[sector] >= quotas[sector]) continue
    picked.push(p)
    counters[sector]++
    seen.add(key)
    if (picked.length >= NATIONAL_SQUAD_SIZE) break
  }

  // 3) Completa com os melhores restantes caso falte gente em algum setor
  if (picked.length < NATIONAL_SQUAD_SIZE) {
    for (const p of pool) {
      const key = nationalPlayerKey(p)
      if (seen.has(key)) continue
      picked.push(p)
      seen.add(key)
      if (picked.length >= NATIONAL_SQUAD_SIZE) break
    }
  }

  return sortByPosition(picked)
}

// Forca da selecao = media dos 11 melhores (0-100)
// FORCA CURADA das selecoes (hierarquia real 2026), para a Copa do Mundo, os
// amistosos e as competicoes de selecao ficarem imersivos. Antes a forca vinha
// SO da media do elenco puxado da base de clubes — e um pais forte com poucos
// jogadores na base ficava fraco (Brasil abaixo de uma selecao menor). Agora a
// forca e ANCORADA nesta tabela (ranking real) e so ajustada pelo elenco, nunca
// dominada por ele. Escala ~66 (fracas) a ~91 (Argentina, campea/1o do ranking).
export const NATIONAL_STRENGTH_2026: Record<string, number> = {
  // CONMEBOL
  argentina: 91, brasil: 89, uruguai: 84, colombia: 84, equador: 80, paraguai: 76, chile: 76,
  // UEFA
  franca: 90, espanha: 89, inglaterra: 88, portugal: 88, holanda: 87, alemanha: 87, belgica: 85,
  croacia: 85, italia: 84, noruega: 82, suica: 80, turquia: 80, austria: 79, tchequia: 78,
  suecia: 78, escocia: 77, bosnia: 76, russia: 76,
  // CONCACAF
  mexico: 82, estados_unidos: 82, canada: 79, panama: 72, curacao: 68, haiti: 66,
  // AFC
  japao: 82, coreia_do_sul: 80, ira: 79, australia: 78, arabia_saudita: 74, qatar: 74,
  uzbequistao: 73, iraque: 72, jordania: 71, china: 68,
  // CAF
  marrocos: 85, senegal: 83, costa_do_marfim: 81, argelia: 80, egito: 80, gana: 78,
  congo_dr: 76, tunisia: 76, africa_do_sul: 74, cabo_verde: 72,
  // OFC
  nova_zelandia: 68,
}

export function getNationalStrength(nt: NationalTeam, squad?: Player[]): number {
  const editedStrength = getTeamOverride(nationalTeamFileKey(nt.id))?.prestigio
  if (Number.isFinite(editedStrength)) {
    return Math.max(1, Math.min(99, Math.round(editedStrength!)))
  }
  const ancora = NATIONAL_STRENGTH_2026[nt.id] ?? nt.baselineStrength ?? 55
  const pool = [...(squad ?? getNationalPlayerPool(nt))].sort((a, b) => b.base - a.base)
  const top = pool.slice(0, 11)
  if (!top.length) return ancora
  // Ancora manda (70%); o elenco real ajusta (30%). Assim o Brasil nunca cai
  // abaixo do seu patamar por falta de jogadores na base, mas um elenco forte
  // ou fraco ainda move a agulha.
  const elenco = top.reduce((s, p) => s + p.base, 0) / top.length
  return Math.round(ancora * 0.7 + elenco * 0.3)
}

// Cache simples das forcas (nao muda durante a sessao)
let strengthCache: Record<string, number> | null = null
export function getAllNationalStrengths(): Record<string, number> {
  if (strengthCache) return strengthCache
  strengthCache = Object.fromEntries(NATIONAL_TEAMS.map(nt => [nt.id, getNationalStrength(nt)]))
  return strengthCache
}

export const CONFEDERATION_LABEL: Record<Confederation, string> = {
  CONMEBOL: "CONMEBOL (America do Sul)",
  UEFA: "UEFA (Europa)",
  CONCACAF: "CONCACAF (America do Norte/Central)",
  AFC: "AFC (Asia)",
  CAF: "CAF (Africa)",
  OFC: "OFC (Oceania)",
}
