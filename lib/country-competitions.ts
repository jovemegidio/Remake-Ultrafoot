import { competitionsByLeague } from "./international-competitions"
import { UEFA_EXPANSION_FEDERATIONS } from "./uefa-expansion"
import { DIVISOES_DE_ACESSO, IDS_DE_ACESSO } from "./divisao-de-acesso"
import { LIGAS_FEMININAS, ehDivisaoFeminina } from "./futebol-feminino"

// Competicoes por PAIS/LIGA.
//
// A tela de Competicoes era hardcoded em Brasil: quem jogava com o Barcelona via
// "Copa do Brasil", "Paulistao" e "Libertadores". Aqui cada liga declara a sua copa
// nacional, a sua competicao continental e se o pais tem estadual (so o Brasil tem).

export interface CountryCompetitions {
  country: string
  /** Copa nacional (mata-mata). */
  domesticCup: string
  /**
   * Supercopa nacional: campeao da liga contra campeao da copa, na abertura da
   * temporada seguinte.
   *
   * ⚠️ AUSENTE ATE A 1.0.381, e a lacuna era maior do que "falta a Supercopa da
   * Espanha": NENHUM pais tinha supercopa jogavel. So existiam as cinco
   * continentais/globais de `lib/super-cups.ts`. Nomes como "Supercopa de
   * Espana" e "DFL-Supercup" apareciam em `international-competitions` sem
   * gerar partida — o mesmo "arte sem jogo" que o cabecalho do super-cups
   * descreve para a Supercopa do Brasil antes de ela existir de verdade.
   *
   * ⚠️ O BRASIL NAO ENTRA AQUI. A Supercopa do Brasil ja e disputada pela via
   * continental (`supercopa_brasil`); repetir daria dois torneios com o mesmo
   * nome na mesma pre-temporada.
   *
   * `undefined` = o pais nao tem supercopa. Escocia e Mexico, por exemplo, nao
   * disputam — inventar uma para preencher a tabela seria pior que a ausencia.
   */
  superCup?: string
  /** Competicao continental principal. */
  continental: string
  /** Segunda competicao continental (null quando nao houver). */
  continentalSecondary: string | null
  /** Terceira competicao continental, quando houver. */
  continentalTertiary?: string | null
  /** So o Brasil disputa campeonato estadual. */
  hasStateChampionship: boolean
}

const UEFA = {
  continental: "UEFA Champions League",
  continentalSecondary: "UEFA Europa League",
  continentalTertiary: "UEFA Conference League",
  hasStateChampionship: false,
}

const CONMEBOL = {
  continental: "Libertadores",
  continentalSecondary: "Copa Sul-Americana",
}

const LEAGUE_COMPETITIONS_BASE: Record<string, CountryCompetitions> = {
  // Brasil — unico com estadual
  serie_a: { country: "Brasil", domesticCup: "Copa do Brasil", ...CONMEBOL, hasStateChampionship: true },
  serie_b: { country: "Brasil", domesticCup: "Copa do Brasil", ...CONMEBOL, hasStateChampionship: true },
  serie_c: { country: "Brasil", domesticCup: "Copa do Brasil", ...CONMEBOL, hasStateChampionship: true },
  serie_d: { country: "Brasil", domesticCup: "Copa do Brasil", ...CONMEBOL, hasStateChampionship: true },
  // Europa
  la_liga: { country: "Espanha", domesticCup: "Copa del Rey", superCup: "Supercopa de Espanha", ...UEFA },
  premier_league: { country: "Inglaterra", domesticCup: "FA Cup", superCup: "Community Shield", ...UEFA },
  serie_a_ita: { country: "Italia", domesticCup: "Coppa Italia", superCup: "Supercoppa Italiana", ...UEFA },
  bundesliga: { country: "Alemanha", domesticCup: "DFB-Pokal", superCup: "DFL-Supercup", ...UEFA },
  ligue_1: { country: "Franca", domesticCup: "Coupe de France", superCup: "Trofeu dos Campeoes", ...UEFA },
  primeira_liga: { country: "Portugal", domesticCup: "Taca de Portugal", superCup: "Supertaca Candido de Oliveira", ...UEFA },
  eredivisie: { country: "Holanda", domesticCup: "KNVB Beker", superCup: "Johan Cruijff Schaal", ...UEFA },
  scottish_prem: { country: "Escocia", domesticCup: "Scottish Cup", ...UEFA },
  super_lig: { country: "Turquia", domesticCup: "Turkish Cup", superCup: "Supercopa da Turquia", ...UEFA },
  pro_league_bel: { country: "Belgica", domesticCup: "Beker van Belgie", superCup: "Supercopa da Belgica", ...UEFA },
  russian_prem: { country: "Russia", domesticCup: "Copa da Russia", superCup: "Supercopa da Russia", ...UEFA },

  // America do Sul
  liga_argentina: { country: "Argentina", domesticCup: "Copa Argentina", superCup: "Supercopa Argentina", ...CONMEBOL, hasStateChampionship: false },
  primera_a_col: { country: "Colombia", domesticCup: "Copa Colombia", superCup: "Superliga da Colombia", ...CONMEBOL, hasStateChampionship: false },
  primera_div_chi: { country: "Chile", domesticCup: "Copa Chile", superCup: "Supercopa de Chile", ...CONMEBOL, hasStateChampionship: false },
  primera_div_ury: { country: "Uruguai", domesticCup: "Copa Uruguay", superCup: "Supercopa Uruguaia", ...CONMEBOL, hasStateChampionship: false },
  primera_a_ecu: { country: "Equador", domesticCup: "Copa Ecuador", superCup: "Supercopa do Equador", ...CONMEBOL, hasStateChampionship: false },

  // Demais
  saudi_pro: { country: "Arabia Saudita", domesticCup: "King's Cup", superCup: "Supercopa Saudita", continental: "AFC Champions League Elite", continentalSecondary: null, hasStateChampionship: false },
  j_league: { country: "Japao", domesticCup: "Copa do Imperador", superCup: "Supercopa do Japao", continental: "AFC Champions League Elite", continentalSecondary: null, hasStateChampionship: false },
  k_league_1: { country: "Coreia do Sul", domesticCup: "Korean FA Cup", continental: "AFC Champions League Elite", continentalSecondary: null, hasStateChampionship: false },
  chinese_super: { country: "China", domesticCup: "Chinese FA Cup", superCup: "Supercopa da China", continental: "AFC Champions League Elite", continentalSecondary: null, hasStateChampionship: false },
  mls: { country: "Estados Unidos", domesticCup: "US Open Cup", continental: "CONCACAF Champions Cup", continentalSecondary: null, hasStateChampionship: false },
  liga_mx: { country: "Mexico", domesticCup: "Liga MX Liguilla", continental: "CONCACAF Champions Cup", continentalSecondary: null, hasStateChampionship: false },

  // ── As 18 divisoes que caiam no FALLBACK ────────────────────────────────────
  //
  // A auditoria de 31/07/2026 achou dezoito divisoes JOGAVEIS sem entrada aqui.
  // Elas nao ficavam sem competicao: caiam no FALLBACK, e o clube disputava uma
  // "Copa Nacional" e uma "Copa Continental" — nomes inventados, iguais para
  // ingles, tcheco e boliviano. Quem escolhia o Hertha via o time competir numa
  // copa que nao existe, em vez da DFB-Pokal.
  //
  // SEGUNDAS DIVISOES: disputam a copa nacional do proprio pais (na vida real o
  // segundo escalao entra na FA Cup, na Copa del Rey, na Coppa Italia) e tem a
  // continental do pais como horizonte — chegar la depende de subir, e disso
  // cuida a piramide.
  championship: { country: "Inglaterra", domesticCup: "FA Cup", ...UEFA },
  la_liga_2: { country: "Espanha", domesticCup: "Copa del Rey", ...UEFA },
  serie_b_ita: { country: "Italia", domesticCup: "Coppa Italia", ...UEFA },
  bundesliga_2: { country: "Alemanha", domesticCup: "DFB-Pokal", ...UEFA },
  ligue_2: { country: "Franca", domesticCup: "Coupe de France", ...UEFA },
  primera_b_chi: { country: "Chile", domesticCup: "Copa Chile", ...CONMEBOL, hasStateChampionship: false },
  saudi_first_div: { country: "Arabia Saudita", domesticCup: "King's Cup", continental: "AFC Champions League Elite", continentalSecondary: null, hasStateChampionship: false },
  liga_portugal_2: { country: "Portugal", domesticCup: "Taca de Portugal", ...UEFA },
  eerste_divisie: { country: "Holanda", domesticCup: "KNVB Beker", ...UEFA },
  challenger_pro: { country: "Belgica", domesticCup: "Beker van Belgie", ...UEFA },
  tff_1_lig: { country: "Turquia", domesticCup: "Turkish Cup", ...UEFA },
  russian_first: { country: "Russia", domesticCup: "Copa da Russia", ...UEFA },
  primera_b_arg: { country: "Argentina", domesticCup: "Copa Argentina", ...CONMEBOL, hasStateChampionship: false },
  torneo_betplay: { country: "Colombia", domesticCup: "Copa Colombia", ...CONMEBOL, hasStateChampionship: false },
  segunda_div_ury: { country: "Uruguai", domesticCup: "Copa AUF Uruguay", ...CONMEBOL, hasStateChampionship: false },
  liga_2_per: { country: "Peru", domesticCup: "Copa de la Liga", ...CONMEBOL, hasStateChampionship: false },
  copa_simon_bolivar: { country: "Bolivia", domesticCup: "Copa de la División Profesional", ...CONMEBOL, hasStateChampionship: false },
  division_intermedia_par: { country: "Paraguai", domesticCup: "Copa Paraguay", ...CONMEBOL, hasStateChampionship: false },
  liga_futve_2: { country: "Venezuela", domesticCup: "Copa Venezuela", ...CONMEBOL, hasStateChampionship: false },
  j2_league: { country: "Japao", domesticCup: "Copa do Imperador", continental: "AFC Champions League Elite", continentalSecondary: "AFC Champions League Two", hasStateChampionship: false },
  k_league_2: { country: "Coreia do Sul", domesticCup: "Korea Cup", continental: "AFC Champions League Elite", continentalSecondary: "AFC Champions League Two", hasStateChampionship: false },
  scottish_champ: { country: "Escocia", domesticCup: "Scottish Cup", ...UEFA },
  serie_b_ecu: { country: "Equador", domesticCup: "Copa Ecuador", ...CONMEBOL, hasStateChampionship: false },
  china_league_one: { country: "China", domesticCup: "Chinese FA Cup", continental: "AFC Champions League Elite", continentalSecondary: "AFC Champions League Two", hasStateChampionship: false },

  // LIGAS NACIONAIS que existiam no catalogo sem competicoes declaradas. Sao as
  // mesmas onze que tinham menos de oito clubes e agora foram completadas pelo
  // pool (ver completarLigaComPool em lib/teams-data): sem estas entradas, o
  // campeonato ficava de pe mas a copa e a continental continuavam genericas.
  primera_div_per: { country: "Peru", domesticCup: "Copa de la Liga", superCup: "Supercopa Peruana", ...CONMEBOL, hasStateChampionship: false },
  primera_div_ven: { country: "Venezuela", domesticCup: "Copa Venezuela", ...CONMEBOL, hasStateChampionship: false },
  primera_div_bol: { country: "Bolivia", domesticCup: "Copa Bolivia", ...CONMEBOL, hasStateChampionship: false },
  primera_div_par: { country: "Paraguai", domesticCup: "Copa Paraguai", superCup: "Supercopa Paraguai", ...CONMEBOL, hasStateChampionship: false },
  super_league_gre: { country: "Grecia", domesticCup: "Copa da Grecia", ...UEFA },
  superliga_den: { country: "Dinamarca", domesticCup: "Copa da Dinamarca", ...UEFA },
  fortuna_liga_cze: { country: "Chequia", domesticCup: "Copa da Chequia", ...UEFA },
  premyer_liqa_aze: { country: "Azerbaijao", domesticCup: "Copa do Azerbaijao", ...UEFA },
  eliteserien_nor: { country: "Noruega", domesticCup: "Copa da Noruega", superCup: "Mesterfinalen", ...UEFA },
  protathlima_cyp: { country: "Chipre", domesticCup: "Copa do Chipre", superCup: "Supercopa do Chipre", ...UEFA },
  premier_liga_kaz: { country: "Cazaquistao", domesticCup: "Copa do Cazaquistao", superCup: "Supercopa do Cazaquistao", ...UEFA },
  betinia_liga: { country: "Dinamarca", domesticCup: "Copa da Dinamarca", ...UEFA },
  obos_ligaen: { country: "Noruega", domesticCup: "Copa da Noruega", ...UEFA },
  second_div_cyp: { country: "Chipre", domesticCup: "Copa do Chipre", ...UEFA },
  chance_narodni_liga: { country: "Chequia", domesticCup: "Copa da Chequia", ...UEFA },
  league_one_eng: { country: "Inglaterra", domesticCup: "FA Cup", ...UEFA },
  league_two_eng: { country: "Inglaterra", domesticCup: "FA Cup", ...UEFA },
  national_league_eng: { country: "Inglaterra", domesticCup: "FA Cup", ...UEFA },
  national_league_ns_eng: { country: "Inglaterra", domesticCup: "FA Cup", ...UEFA },
  primera_federacion_esp: { country: "Espanha", domesticCup: "Copa del Rey", ...UEFA },
  segunda_federacion_esp: { country: "Espanha", domesticCup: "Copa del Rey", ...UEFA },
  dritte_liga_ger: { country: "Alemanha", domesticCup: "DFB-Pokal", ...UEFA },
  national_fra: { country: "Franca", domesticCup: "Coupe de France", ...UEFA },
  liga_3_por: { country: "Portugal", domesticCup: "Taca de Portugal", ...UEFA },
  campeonato_portugal: { country: "Portugal", domesticCup: "Taca de Portugal", ...UEFA },
  scottish_league_one: { country: "Escocia", domesticCup: "Scottish Cup", ...UEFA },
  scottish_league_two: { country: "Escocia", domesticCup: "Scottish Cup", ...UEFA },
  first_national_bel: { country: "Belgica", domesticCup: "Beker van Belgie", ...UEFA },
  tff_2_lig: { country: "Turquia", domesticCup: "Turkish Cup", ...UEFA },
  super_league_2_gre: { country: "Grecia", domesticCup: "Copa da Grecia", ...UEFA },
}

/**
 * COPA NACIONAL E SUPERCOPA DAS FEDERACOES DA EXPANSAO UEFA.
 *
 * ⚠️ ELAS NASCERAM COM NOME DE FACHADA. O laco abaixo dava a todas
 * `domesticCup: "Copa nacional — <pais>"`, e o portao de paridade contava isso
 * como copa de verdade (ele so recusa a string exata "Copa Nacional"). Trinta e
 * sete paises apareciam no calendario disputando uma competicao que nao existe
 * com esse nome — o mesmo defeito que a auditoria de 31/07 achou nas dezoito
 * divisoes masculinas, sobrevivendo num canto novo.
 *
 * ⚠️ A SUPERCOPA SO ENTRA ONDE E DISPUTADA HOJE, a mesma regra da 1.0.383.
 * Ficam de fora, de proposito: Austria, Croacia, Eslovaquia e Suecia (tinham e
 * ENCERRARAM), e Suica, Luxemburgo, Pais de Gales, Bosnia, Montenegro e
 * Finlandia (nunca disputaram). Preencher a tabela com torneio que nao existe e
 * pior que a ausencia: quem percebe passa a duvidar do resto do calendario.
 */
const COMPETICOES_DA_EXPANSAO_UEFA: Record<string, { copa: string; supercopa?: string }> = {
  "Albania": { copa: "Copa da Albania", supercopa: "Supercopa da Albania" },
  "Andorra": { copa: "Copa Constitucio" },
  "Armenia": { copa: "Copa da Armenia", supercopa: "Supercopa da Armenia" },
  "Austria": { copa: "OFB-Cup" },
  "Belarus": { copa: "Copa de Belarus", supercopa: "Supercopa de Belarus" },
  "Bosnia e Herzegovina": { copa: "Copa da Bosnia" },
  "Bulgaria": { copa: "Copa da Bulgaria", supercopa: "Supercopa da Bulgaria" },
  "Croacia": { copa: "Copa da Croacia" },
  "Eslovaquia": { copa: "Copa da Eslovaquia" },
  "Eslovenia": { copa: "Copa da Eslovenia", supercopa: "Supercopa da Eslovenia" },
  "Estonia": { copa: "Copa da Estonia", supercopa: "Supercopa da Estonia" },
  "Finlandia": { copa: "Suomen Cup" },
  "Georgia": { copa: "Copa da Georgia", supercopa: "Supercopa da Georgia" },
  "Gibraltar": { copa: "Rock Cup" },
  "Hungria": { copa: "Magyar Kupa", supercopa: "Supercopa da Hungria" },
  "Ilhas Faroe": { copa: "Copa das Ilhas Faroe", supercopa: "Supercopa das Ilhas Faroe" },
  "Irlanda": { copa: "FAI Cup", supercopa: "President's Cup" },
  "Irlanda do Norte": { copa: "Irish Cup", supercopa: "Charity Shield" },
  "Islandia": { copa: "Copa da Islandia", supercopa: "Supercopa da Islandia" },
  "Israel": { copa: "Copa do Estado", supercopa: "Supercopa de Israel" },
  "Kosovo": { copa: "Copa do Kosovo", supercopa: "Supercopa do Kosovo" },
  "Letonia": { copa: "Copa da Letonia", supercopa: "Supercopa da Letonia" },
  "Liechtenstein": { copa: "Copa de Liechtenstein" },
  "Lituania": { copa: "Copa da Lituania", supercopa: "Supercopa da Lituania" },
  "Luxemburgo": { copa: "Copa de Luxemburgo" },
  "Macedonia do Norte": { copa: "Copa da Macedonia do Norte" },
  "Malta": { copa: "Copa de Malta", supercopa: "Supercopa de Malta" },
  "Moldavia": { copa: "Copa da Moldavia", supercopa: "Supercopa da Moldavia" },
  "Montenegro": { copa: "Copa de Montenegro" },
  "Pais de Gales": { copa: "Copa de Gales" },
  "Polonia": { copa: "Puchar Polski", supercopa: "Supercopa da Polonia" },
  "Romenia": { copa: "Copa da Romenia", supercopa: "Supercopa da Romenia" },
  "San Marino": { copa: "Coppa Titano" },
  "Servia": { copa: "Copa da Servia" },
  "Suecia": { copa: "Svenska Cupen" },
  "Suica": { copa: "Schweizer Cup" },
  "Ucrania": { copa: "Copa da Ucrania", supercopa: "Supercopa da Ucrania" },
}

for (const federation of UEFA_EXPANSION_FEDERATIONS) {
  for (const division of [federation.top, federation.second]) {
    if (!division?.participants.length) continue
    // Vai para a BASE, e nao para o objeto exportado: este laço roda antes de o
    // derivado existir, e é a base que a derivação lê.
    const reais = COMPETICOES_DA_EXPANSAO_UEFA[federation.country]
    LEAGUE_COMPETITIONS_BASE[division.id] = {
      country: federation.country,
      domesticCup: reais?.copa ?? `Copa nacional — ${federation.country}`,
      // ⚠️ SUPERCOPA SO NA PRIMEIRA DIVISAO: quem disputa e o campeao da liga
      // contra o da copa, e a segunda divisao nao tem nem um nem outro.
      ...(division.id === federation.top?.id && reais?.supercopa ? { superCup: reais.supercopa } : {}),
      ...UEFA,
    }
  }
}

// ─── FUTEBOL FEMININO ────────────────────────────────────────────────────────
//
// Cada liga feminina declara a PRÓPRIA copa e a PRÓPRIA continental. Sem estas
// entradas o clube feminino cairia no FALLBACK e disputaria uma "Copa Nacional"
// contra uma "Copa Continental" — nomes que não existem, o mesmo defeito que a
// auditoria de 31/07 achou nas dezoito divisões masculinas.
//
// ⚠️ Vai para a BASE (e não para o objeto exportado) pelo mesmo motivo do laço
// da expansão UEFA logo acima: é a base que a derivação das divisões de acesso
// lê, e ela roda depois.
//
// ⚠️ `hasStateChampionship` fica FALSE mesmo no Brasil, onde o Paulista e o
// Carioca femininos existem de verdade: quem monta o estadual escolhe os
// participantes entre os clubes das divisões MASCULINAS por estado, então
// declarar `true` aqui colocaria o Corinthians feminino num Paulistão de clubes
// masculinos. Estadual feminino é trabalho de dado próprio, não de flag.
/**
 * SUPERCOPA FEMININA, onde ela e disputada de verdade.
 *
 * ⚠️ MESMA REGRA DA 1.0.383, aplicada ao feminino: so entra quem tem uma. Ficam
 * de fora a Inglaterra, a Alemanha, os Estados Unidos, a Holanda e o Japao, que
 * nao disputam supercopa feminina — e a chave e a PRIMEIRA divisao apenas
 * (`brasileirao_fem_a1`, nunca a A2), porque quem joga a supercopa e o campeao
 * da liga contra o campeao da copa.
 */
const SUPERCOPAS_FEMININAS: Record<string, string> = {
  brasileirao_fem_a1: "Supercopa do Brasil Feminina",
  liga_f_esp: "Supercopa da Espanha Feminina",
  serie_a_fem_ita: "Supercopa da Italia Feminina",
  premiere_ligue_fra: "Trofeu das Campeas",
  campeonato_fem_por: "Supertaca Feminina",
  liga_mx_femenil: "Campeon de Campeonas",
}

for (const liga of LIGAS_FEMININAS) {
  LEAGUE_COMPETITIONS_BASE[liga.id] = {
    country: liga.pais,
    domesticCup: liga.copaNacional,
    ...(SUPERCOPAS_FEMININAS[liga.id] ? { superCup: SUPERCOPAS_FEMININAS[liga.id] } : {}),
    continental: liga.continental ?? "—",
    continentalSecondary: liga.continentalSecundaria ?? null,
    hasStateChampionship: false,
  }
}

const FALLBACK: CountryCompetitions = {
  country: "Internacional",
  domesticCup: "Copa Nacional",
  continental: "Copa Continental",
  continentalSecondary: null,
  hasStateChampionship: false,
}

/**
 * ⚠️ AS DIVISOES DE ACESSO ENTRAM AQUI, DEPOIS — nao dentro do objeto acima.
 *
 * Elas HERDAM a configuracao da divisao logo acima delas: mesmo pais, mesma copa
 * nacional, mesma continental, mesmo estadual. E o certo por construcao (um
 * clube nao muda de pais nem de copa ao subir um degrau) e evita que a base
 * fique com dado velho quando a divisao de cima for corrigida.
 *
 * A copa nacional entra junto porque e assim na vida real: a vaga do clube
 * pequeno sai da base, e sortear o gigante na primeira fase e justamente a
 * recompensa de comecar por baixo.
 *
 * Um objeto nao pode se referenciar durante a propria inicializacao — por isso a
 * derivacao mora fora dele.
 */
export const LEAGUE_COMPETITIONS: Record<string, CountryCompetitions> = {
  ...LEAGUE_COMPETITIONS_BASE,
  ...Object.fromEntries(DIVISOES_DE_ACESSO.map(acesso =>
    [acesso.id, { ...(LEAGUE_COMPETITIONS_BASE[acesso.acima] ?? FALLBACK) }])),
}


export function getCountryCompetitions(divisao: string | undefined): CountryCompetitions {
  if (!divisao) return FALLBACK
  return LEAGUE_COMPETITIONS[divisao] ?? FALLBACK
}

/** Atalho: o time disputa campeonato estadual? (so clubes brasileiros) */
export function hasStateChampionship(divisao: string | undefined): boolean {
  return getCountryCompetitions(divisao).hasStateChampionship
}

// ─── Confederacao ────────────────────────────────────────────────────────────
//
// Nao basta acertar o NOME da competicao continental: os ADVERSARIOS tambem precisam
// vir do continente certo. A tela sorteava a continental a partir de uma lista fixa de
// clubes sul-americanos (Boca, River, Penarol...), entao a Juventus caia num chaveamento
// contra o Boca Juniors. Aqui derivamos a confederacao a partir da liga do clube e, com
// ela, quais ligas fornecem os participantes.

export type Confederation = "CONMEBOL" | "UEFA" | "AFC" | "CONCACAF" | "UNAFFILIATED"

const CONFEDERATION_DIVISIONS: Record<Confederation, string[]> = {
  CONMEBOL: [
    "serie_a", "serie_b", "serie_c", "serie_d",
    "liga_argentina", "primera_a_col", "primera_div_chi", "primera_div_ury", "primera_a_ecu",
    "primera_b_arg", "torneo_betplay", "primera_b_chi", "segunda_div_ury", "serie_b_ecu",
    "primera_div_per", "primera_div_ven", "primera_div_bol", "primera_div_par",
    "liga_2_per", "copa_simon_bolivar", "division_intermedia_par", "liga_futve_2",
  ],
  UEFA: [
    "premier_league", "la_liga", "serie_a_ita", "bundesliga", "ligue_1",
    "primeira_liga", "eredivisie", "scottish_prem", "super_lig",
    "pro_league_bel", "russian_prem",
    "championship", "la_liga_2", "serie_b_ita", "bundesliga_2", "ligue_2",
    "liga_portugal_2", "eerste_divisie", "scottish_champ", "tff_1_lig",
    "challenger_pro", "russian_first", "super_league_gre", "superliga_den",
    "fortuna_liga_cze", "premyer_liqa_aze", "eliteserien_nor", "protathlima_cyp",
    "premier_liga_kaz", "betinia_liga", "obos_ligaen", "second_div_cyp", "chance_narodni_liga",
    "league_one_eng", "league_two_eng", "national_league_eng", "national_league_ns_eng",
    "primera_federacion_esp", "segunda_federacion_esp", "dritte_liga_ger", "national_fra",
    "liga_3_por", "campeonato_portugal", "scottish_league_one", "scottish_league_two",
    "first_national_bel", "tff_2_lig", "super_league_2_gre",
  ],
  AFC: ["saudi_pro", "saudi_first_div", "j_league", "j2_league", "k_league_1", "k_league_2", "chinese_super", "china_league_one"],
  CONCACAF: ["mls", "liga_mx"],
  UNAFFILIATED: [],
}

// As ligas femininas entram na confederação DELAS: é isso que faz o sorteio da
// continental buscar adversárias no continente certo (uma equipe da NWSL não
// pode cair num chaveamento da Libertadores Feminina).
for (const liga of LIGAS_FEMININAS) {
  CONFEDERATION_DIVISIONS[liga.confederacao === "OFC" ? "UNAFFILIATED" : liga.confederacao].push(liga.id)
}

CONFEDERATION_DIVISIONS.UEFA.push(...UEFA_EXPANSION_FEDERATIONS.flatMap(federation =>
  [federation.top, federation.second]
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry?.participants.length))
    .map(entry => entry.id),
))

// A divisao de acesso fica na MESMA confederacao da divisao acima dela — o clube
// nao muda de continente ao subir um degrau. Derivado em vez de escrito a mao
// porque uma base fora de confederacao sortearia adversario continental de outro
// continente, que e um defeito que a Juventus x Boca ja produziu uma vez.
for (const acesso of DIVISOES_DE_ACESSO) {
  for (const divs of Object.values(CONFEDERATION_DIVISIONS)) {
    if (divs.includes(acesso.acima) && !divs.includes(acesso.id)) { divs.push(acesso.id); break }
  }
}

export function getConfederation(divisao: string | undefined): Confederation {
  if (!divisao) return "UNAFFILIATED"
  for (const [conf, divs] of Object.entries(CONFEDERATION_DIVISIONS)) {
    if (divs.includes(divisao)) return conf as Confederation
  }
  // Nunca inventar continente: uma divisao nova precisa ser cadastrada antes de
  // receber adversarios continentais. O fallback antigo mandava qualquer liga
  // desconhecida para a Libertadores.
  return "UNAFFILIATED"
}

/**
 * Ligas que fornecem os participantes da continental do clube.
 *
 * ⚠️ A MODALIDADE FILTRA. As divisões femininas entram nas mesmas confederações
 * das masculinas (e têm de entrar: a Libertadores Feminina é da CONMEBOL), mas
 * misturá-las aqui produziria o Corinthians feminino sorteado contra o Boca
 * Juniors masculino — exatamente o erro que a nota acima descreve no caso da
 * Juventus contra o Boca, só que atravessando também o gênero.
 */
export function getContinentalDivisions(divisao: string | undefined): string[] {
  const daConfederacao = CONFEDERATION_DIVISIONS[getConfederation(divisao)]
  const feminina = ehDivisaoFeminina(divisao)
  return daConfederacao.filter(div => ehDivisaoFeminina(div) === feminina)
}

// ─── Qual continental o clube disputa ────────────────────────────────────────
//
// Nao basta saber o continente: o clube nao "joga a Champions" por ser europeu — ele
// joga a Champions OU a Europa League conforme ONDE TERMINOU. Antes a tela fixava a
// competicao principal, entao um 6o colocado aparecia na Champions.

export interface ContinentalSpot {
  /** Nome da competicao que ele disputa; null se nao se classificou. */
  competition: string | null
  qualified: boolean
  /** true quando e a secundaria (Europa League / Sul-Americana). */
  isSecondary: boolean
}

/**
 * @param position Posicao na liga (1 = lider). 0/undefined = temporada nao comecou.
 */
export function getContinentalSpot(
  divisao: string | undefined,
  position: number | undefined,
): ContinentalSpot {
  const comps = getCountryCompetitions(divisao)
  const league = divisao
    ? competitionsByLeague[divisao as keyof typeof competitionsByLeague]?.find(competition => competition.type === "league")
    : undefined
  const allocations = league?.continentalSpots ?? []
  const primarySpots = allocations[0]?.spots ?? 0
  const secondarySpots = allocations[1]?.spots ?? 0
  const tertiarySpots = allocations[2]?.spots ?? 0

  if (!position || position <= 0) {
    return { competition: comps.continental, qualified: false, isSecondary: false }
  }

  if (position <= primarySpots) {
    return { competition: comps.continental, qualified: true, isSecondary: false }
  }

  if (position <= primarySpots + secondarySpots && comps.continentalSecondary) {
    return { competition: comps.continentalSecondary, qualified: true, isSecondary: true }
  }

  if (position <= primarySpots + secondarySpots + tertiarySpots && comps.continentalTertiary) {
    return { competition: comps.continentalTertiary, qualified: true, isSecondary: true }
  }

  // Fora das vagas: mostra a principal como alvo, mas nao classificado.
  return { competition: comps.continental, qualified: false, isSecondary: false }
}
