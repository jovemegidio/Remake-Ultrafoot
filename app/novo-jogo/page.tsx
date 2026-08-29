"use client"

import { useMemo, useState, useEffect, useCallback, useRef } from "react"
import { safeLocalSet } from "@/lib/safe-storage"
import { getClubFacts } from "@/lib/club-facts"
import { getTeamStadiumBackground } from "@/lib/pre-match-bg"
import Image from "next/image"
import { motion } from "framer-motion"
import { ChevronLeft, ChevronRight, User, Play, Check, Trophy, Award, Globe, Building2, CornerDownLeft, ArrowLeft, Shuffle, Repeat, Settings2, Sparkles, X } from "lucide-react"
import {
  serieATeams,
  serieBTeams,
  serieCTeams,
  serieDTeams,
  getTeamUniforms,
  completarLigaComPool,
  getTeamsByDivision,
  getTeamsFemininosByDivision,
  getCamisaUrl,
  getEscudoUrl,
  isKitVariantAvailable,
  type Divisao,
  type Team,
  type Regiao,
} from "@/lib/teams-data"
import { Jersey } from "@/components/jersey"
import {
  premierLeagueTeams,
  laLigaTeams,
  serieAItaTeams,
  bundesligaTeams,
  ligue1Teams,
  saudiProTeams,
  saudiFirstDivTeams,
  mlsTeams,
  ligaMXTeams,
  primeiraLigaTeams,
  jLeagueTeams,
  eredivisieTeams,
  scottishPremTeams,
  superLigTeams,
  proLeagueBelTeams,
  russianPremTeams,
  ligaArgentinaTeams,
  primeiraAColTeams,
  primeraDivChileTeams,
  primeraBChileTeams,
  ecuadorTeams,
  primeraDivUryTeams,
  kLeague1Teams,
  kLeague2Teams,
  chineseSuperTeams,
  championshipTeams,
  serieBItaTeams,
  bundesliga2Teams,
  ligue2Teams,
  laLiga2Teams,
} from "@/lib/international-teams"
import { getLeagueLogo } from "@/lib/league-logos"
import { useVersaoDoJogo } from "@/lib/versao-do-jogo"
import { useGameManager } from "@/lib/use-game-manager"
import { listCareerSaves, useGameState } from "@/lib/save-system"
import { contaLogada } from "@/lib/conta-ultrafoot"
import { LIMITE_SAVES_SEM_REGISTRO, PAISES_SEM_REGISTRO, ROTA_DE_REGISTRO, useJogoRegistrado } from "@/lib/beneficios"
import { DIVISOES_DE_ACESSO } from "@/lib/divisao-de-acesso"
import { createYouthCareer } from "@/lib/youth-career-engine"
import { createClubDebt, type DebtPreset } from "@/lib/debt-engine"
import { createScoutingDepartment } from "@/lib/scout-engine"
import { createStadiumPitch } from "@/lib/infrastructure-engine"
import { generateOffers } from "@/lib/sponsor-engine"
import { TeamCrest, getCustomLogoUrl } from "@/components/team-crest"
import { Escudo3D } from "@/components/novo-jogo/escudo-3d"
import { NumeroQueConta } from "@/components/novo-jogo/numero-que-conta"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import { hardNavigate } from "@/lib/hard-navigation"
import { useTranslation } from "@/lib/i18n"
import { useRouter } from "next/navigation"
import { carregarElencosDoPool } from "@/lib/pool-elencos"
import { carregarElencosReaisTM } from "@/lib/elencos-reais-tm"
import { carregarElencosFemininos, clubesComElencoFeminino } from "@/lib/elencos-femininos"
import { LIGAS_FEMININAS } from "@/lib/futebol-feminino"
import { MODALIDADES, MODALIDADE_DE_JOGADOR, type ModalidadeDeCarreira } from "@/lib/modalidade-de-carreira"
import {
  ORIGENS, POSICOES_JOGAVEIS, arquetiposDaPosicao, clubesDeEstreia, criarAtletaDaCarreira, criarCarreiraDeJogador,
  type ArquetipoId, type OrigemDoAtleta, type PosicaoDoAtleta,
} from "@/lib/carreira-de-jogador"
import qualidadeDasLigas from "@/data/seeds/qualidade-das-ligas.json"
import { flushPersistentStore } from "@/lib/persistent-store"
import { UEFA_EXPANSION_FEDERATIONS } from "@/lib/uefa-expansion"
import { criarEstadoGestao282, type ModoDeMundo } from "@/lib/gestao-282"
import { CONFIGURACOES_INICIAIS_283, resolverPerfilDesempenho283, type ConfiguracoesIniciais283 } from "@/lib/configuracoes-iniciais-283"
import { applyPerformanceProfile } from "@/components/performance-profile"
import {
  iniciarRodada, MAXIMO_DE_TECNICOS, validarTecnicos, type TecnicoDoSave,
} from "@/lib/tecnicos-do-save"
import { bandeiraUrl } from "@/lib/bandeiras"
import {
  PERFIL_TREINADOR_26_PADRAO,
  criarPerfilTreinador26,
  efeitosIniciaisPerfil26,
  type AreaAnterior26,
  type EstiloTreinador26,
  type LicencaTreinador26,
  type NivelComoJogador26,
  type PersonalidadeTreinador26,
  type RelevanciaAnterior26,
} from "@/lib/manager-profile-26"

const FLAG_MAP: Record<string, string> = {
  BRA: "br", ENG: "gb-eng", ESP: "es", ITA: "it",
  GER: "de", FRA: "fr", POR: "pt", USA: "us",
  MEX: "mx", KSA: "sa", NED: "nl", SCO: "gb-sct",
  TUR: "tr", BEL: "be", RUS: "ru", ARG: "ar",
  COL: "co", CHI: "cl", URU: "uy", JPN: "jp",
  KOR: "kr", CHN: "cn", PER: "pe", BOL: "bo",
  PAR: "py", VEN: "ve", GRE: "gr", DEN: "dk",
  CZE: "cz", AZE: "az", NOR: "no", CYP: "cy", KAZ: "kz",
}

/**
 * Explicações escritas à mão para os casos em que a liga NÃO tem acesso por
 * decisão do futebol real — não por falta de dado. As duas coisas apareciam
 * iguais na tela e não são a mesma coisa: a MLS não rebaixa ninguém na vida
 * real; a J-League rebaixa e o jogo é que não traz a J2.
 */
// ⚠️ O MAPA GUARDA A CHAVE, NÃO A FRASE (1.0.358): o texto vive no dicionário
// (`t.novoJogo.piramide_*`) e a tela resolve na hora de mostrar. Frase escrita
// aqui era frase intraduzível — ver a catraca do `qa:traducao`.
type AvisoDePiramide = "piramide_liga_fechada" | "piramide_acesso_suspenso"
  | "piramide_segunda_indisponivel" | "piramide_inferior_indisponivel"
const PYRAMID_SCOPE_291: Partial<Record<Divisao, AvisoDePiramide>> = {
  mls: "piramide_liga_fechada",
  liga_mx: "piramide_acesso_suspenso",
  j_league: "piramide_segunda_indisponivel",
  premyer_liqa_aze: "piramide_inferior_indisponivel",
  premier_liga_kaz: "piramide_inferior_indisponivel",
}

/**
 * QUALIDADE MEDIDA DA LIGA (gerada por scripts/gerar-qualidade-das-ligas.ts).
 *
 * Antes desta versão o mapa acima cobria CINCO ligas escolhidas à mão, enquanto
 * a medição de 11/08/2026 achou **37 ligas jogáveis que não sobem nem descem** e
 * **480 clubes com menos de 18 atletas de fonte real** (320 sem nenhum). O jogo
 * preenchia o buraco com atleta gerado e a tela não dizia nada — quem escolhia a
 * liga só descobria depois de começar a carreira.
 *
 * Enquanto os elencos não são importados (é trabalho de dado, não de código), a
 * tela ao menos não promete o que não tem.
 */
const QUALIDADE_DAS_LIGAS = qualidadeDasLigas as Record<string, {
  clubes: number
  clubesComElencoReal: number
  elenco: "real" | "parcial" | "generico"
  piramide: "viva" | "ponta" | "isolada"
  sobe: number
  desce: number
}>

function getFlagUrl(code: string) {
  // ⚠️ A EXTENSAO NAO E MAIS CRAVADA (1.0.350). Chegaram 71 bandeiras em WebP,
  // mas o acervo cobre de "Afghanistan" a "Grenada": `it`, `mx`, `pt`, `sa` e
  // `us` seguem so no PNG antigo. Quem decide e `lib/bandeiras`, pelo manifesto.
  const key = FLAG_MAP[code] || code.toLowerCase()
  return bandeiraUrl(key) ?? `/flags/${key}.png`
}

interface LeagueTab {
  key: Divisao
  label: string
  short: string
  teams: Team[]
  /**
   * Liga montada com o pool do proprio pais (as segundas divisoes ligadas em
   * 04/08). ⚠️ NAO da para resolver isso no escopo do modulo: o caminho passa
   * por `applyTeamOverride`, que le o persistent-store, e no Tauri o store
   * hidrata DEPOIS do import — o clube apareceria com o nome e o escudo de
   * antes das suas edicoes, e nunca se corrigiria. Ver
   * [[ultrafoot-efeito-que-grava-antes-de-hidratar]].
   */
  doPool?: boolean
  /** Lista TODOS os clubes da divisao, e nao a tabela de 20. Ver o uso abaixo. */
  todosDaDivisao?: boolean
}

interface CountryTab {
  name: string
  code: string
  region: Regiao
  leagues: LeagueTab[]
}

const CORE_COUNTRIES: CountryTab[] = [
  {
    name: "Brasil", code: "BRA", region: "brasil",
    leagues: [
      { key: "serie_a", label: "Brasileirao Serie A", short: "Serie A", teams: serieATeams },
      { key: "serie_b", label: "Brasileirao Serie B", short: "Serie B", teams: serieBTeams },
      { key: "serie_c", label: "Brasileirao Serie C", short: "Serie C", teams: serieCTeams },
      { key: "serie_d", label: "Brasileirao Serie D", short: "Serie D", teams: serieDTeams },
    ],
  },
  {
    name: "Inglaterra", code: "ENG", region: "europa",
    leagues: [
      { key: "premier_league", label: "Premier League", short: "Premier League", teams: premierLeagueTeams },
      { key: "championship", label: "Championship", short: "Championship", teams: championshipTeams },
      { key: "league_one_eng", label: "League One", short: "League One", teams: [], doPool: true },
      { key: "league_two_eng", label: "League Two", short: "League Two", teams: [], doPool: true },
      { key: "national_league_eng", label: "National League", short: "National League", teams: [], doPool: true },
      { key: "national_league_ns_eng", label: "National League North/South", short: "National N/S", teams: [], doPool: true },
    ],
  },
  {
    name: "Espanha", code: "ESP", region: "europa",
    leagues: [
      { key: "la_liga", label: "La Liga", short: "La Liga", teams: laLigaTeams },
      { key: "la_liga_2", label: "La Liga 2", short: "La Liga 2", teams: laLiga2Teams },
      { key: "primera_federacion_esp", label: "Primera Federacion", short: "Primera Fed.", teams: [], doPool: true },
      { key: "segunda_federacion_esp", label: "Segunda Federacion", short: "Segunda Fed.", teams: [], doPool: true },
    ],
  },
  {
    name: "Italia", code: "ITA", region: "europa",
    leagues: [
      { key: "serie_a_ita", label: "Serie A", short: "Serie A", teams: serieAItaTeams },
      { key: "serie_b_ita", label: "Serie B", short: "Serie B", teams: serieBItaTeams },
    ],
  },
  {
    name: "Alemanha", code: "GER", region: "europa",
    leagues: [
      { key: "bundesliga", label: "Bundesliga", short: "Bundesliga", teams: bundesligaTeams },
      { key: "bundesliga_2", label: "2. Bundesliga", short: "2. Bundesliga", teams: bundesliga2Teams },
      { key: "dritte_liga_ger", label: "3. Liga", short: "3. Liga", teams: [], doPool: true },
    ],
  },
  {
    name: "Franca", code: "FRA", region: "europa",
    leagues: [
      { key: "ligue_1", label: "Ligue 1", short: "Ligue 1", teams: ligue1Teams },
      { key: "ligue_2", label: "Ligue 2", short: "Ligue 2", teams: ligue2Teams },
      { key: "national_fra", label: "Championnat National", short: "National", teams: [], doPool: true },
    ],
  },
  {
    name: "Portugal", code: "POR", region: "europa",
    leagues: [
      { key: "primeira_liga", label: "Primeira Liga", short: "Primeira Liga", teams: primeiraLigaTeams },
      { key: "liga_portugal_2", label: "Liga Portugal 2", short: "Liga 2", teams: [], doPool: true },
      { key: "liga_3_por", label: "Liga 3", short: "Liga 3", teams: [], doPool: true },
      { key: "campeonato_portugal", label: "Campeonato de Portugal", short: "Campeonato", teams: [], doPool: true },
    ],
  },
  {
    name: "Holanda", code: "NED", region: "europa",
    leagues: [
      { key: "eredivisie", label: "Eredivisie", short: "Eredivisie", teams: eredivisieTeams },
      { key: "eerste_divisie", label: "Eerste Divisie", short: "Eerste Div", teams: [], doPool: true },
    ],
  },
  {
    name: "Escocia", code: "SCO", region: "europa",
    leagues: [
      { key: "scottish_prem", label: "Scottish Premiership", short: "Scottish Prem", teams: scottishPremTeams },
      { key: "scottish_champ", label: "Scottish Championship", short: "Championship", teams: [], doPool: true },
      { key: "scottish_league_one", label: "Scottish League One", short: "League One", teams: [], doPool: true },
      { key: "scottish_league_two", label: "Scottish League Two", short: "League Two", teams: [], doPool: true },
    ],
  },
  {
    name: "Turquia", code: "TUR", region: "europa",
    leagues: [
      { key: "super_lig", label: "Super Lig", short: "Super Lig", teams: superLigTeams },
      { key: "tff_1_lig", label: "TFF 1. Lig", short: "1. Lig", teams: [], doPool: true },
      { key: "tff_2_lig", label: "TFF 2. Lig", short: "2. Lig", teams: [], doPool: true },
    ],
  },
  {
    name: "Belgica", code: "BEL", region: "europa",
    leagues: [
      { key: "pro_league_bel", label: "Belgian Pro League", short: "Pro League", teams: proLeagueBelTeams },
      { key: "challenger_pro", label: "Challenger Pro League", short: "Challenger", teams: [], doPool: true },
      { key: "first_national_bel", label: "Belgian National Division 1", short: "National 1", teams: [], doPool: true },
    ],
  },
  {
    name: "Russia", code: "RUS", region: "europa",
    leagues: [
      { key: "russian_prem", label: "Russian Premier League", short: "Russian Prem", teams: russianPremTeams },
      { key: "russian_first", label: "Russian First League", short: "First League", teams: [], doPool: true },
    ],
  },
  {
    name: "EUA", code: "USA", region: "americas",
    leagues: [
      { key: "mls", label: "MLS", short: "MLS", teams: mlsTeams },
    ],
  },
  {
    name: "Mexico", code: "MEX", region: "americas",
    leagues: [
      { key: "liga_mx", label: "Liga MX", short: "Liga MX", teams: ligaMXTeams },
    ],
  },
  {
    name: "Argentina", code: "ARG", region: "americas",
    leagues: [
      { key: "liga_argentina", label: "Liga Profesional", short: "Liga Argentina", teams: ligaArgentinaTeams },
      { key: "primera_b_arg", label: "Primera Nacional", short: "Primera Nacional", teams: [], doPool: true },
    ],
  },
  {
    name: "Colombia", code: "COL", region: "americas",
    leagues: [
      { key: "primera_a_col", label: "Primera A", short: "Primera A", teams: primeiraAColTeams },
      { key: "torneo_betplay", label: "Torneo BetPlay", short: "Torneo BetPlay", teams: [], doPool: true },
    ],
  },
  {
    name: "Chile", code: "CHI", region: "americas",
    leagues: [
      { key: "primera_div_chi", label: "Primera Division", short: "Primera Div", teams: primeraDivChileTeams },
      { key: "primera_b_chi", label: "Primera B", short: "Primera B", teams: primeraBChileTeams },
    ],
  },
  {
    // A LigaPro existia inteira (16 clubes, escudo em todos, regulamento
    // proprio) e nao aparecia aqui — o pais nao era oferecido.
    name: "Equador", code: "ECU", region: "americas",
    leagues: [
      { key: "primera_a_ecu", label: "LigaPro Serie A", short: "LigaPro", teams: ecuadorTeams },
      { key: "serie_b_ecu", label: "LigaPro Serie B", short: "LigaPro B", teams: [], doPool: true },
    ],
  },
  {
    name: "Uruguai", code: "URU", region: "americas",
    leagues: [
      { key: "primera_div_ury", label: "Primera Division", short: "Primera Div", teams: primeraDivUryTeams },
      { key: "segunda_div_ury", label: "Segunda Division", short: "Segunda Div", teams: [], doPool: true },
    ],
  },
  {
    name: "Arabia Saudita", code: "KSA", region: "asia",
    leagues: [
      { key: "saudi_pro", label: "Saudi Pro League", short: "Saudi Pro", teams: saudiProTeams },
      { key: "saudi_first_div", label: "Saudi First Division", short: "Saudi 1a Div", teams: saudiFirstDivTeams },
    ],
  },
  {
    name: "Japao", code: "JPN", region: "asia",
    leagues: [
      { key: "j_league", label: "J-League", short: "J-League", teams: jLeagueTeams },
    ],
  },
  {
    name: "Coreia do Sul", code: "KOR", region: "asia",
    leagues: [
      { key: "k_league_1", label: "K-League 1", short: "K-League 1", teams: kLeague1Teams },
      { key: "k_league_2", label: "K-League 2", short: "K-League 2", teams: kLeague2Teams },
    ],
  },
  {
    name: "China", code: "CHN", region: "asia",
    leagues: [
      { key: "chinese_super", label: "Chinese Super League", short: "Super League", teams: chineseSuperTeams },
      { key: "china_league_one", label: "China League One", short: "China Liga 1", teams: [], doPool: true },
    ],
  },
]

const EXPANSION_COUNTRIES: CountryTab[] = UEFA_EXPANSION_FEDERATIONS
  .filter(federation => federation.top?.participants.length)
  .map(federation => ({
    name: federation.country,
    code: federation.code.toUpperCase(),
    region: "europa",
    leagues: [federation.top, federation.second]
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry?.participants.length))
      .map(entry => ({
        key: entry.id,
        label: entry.name,
        short: entry.name,
        teams: [],
        // Resolve depois da hidratação para respeitar overrides e saves.
        doPool: true,
      })),
  }))

/**
 * Países que já possuíam clubes, competição e pirâmide, mas não apareciam na
 * criação de carreira. As equipes são resolvidas do catálogo no momento da
 * hidratação para respeitar atualização de elenco e edição do usuário.
 */
const CATALOG_COUNTRIES: CountryTab[] = [
  { name: "Peru", code: "PER", region: "americas", leagues: [
    { key: "primera_div_per", label: "Liga 1 do Peru", short: "Liga 1", teams: [], doPool: true },
    { key: "liga_2_per", label: "Liga 2 do Peru", short: "Liga 2", teams: [], doPool: true },
  ] },
  { name: "Bolivia", code: "BOL", region: "americas", leagues: [
    { key: "primera_div_bol", label: "Division Profesional", short: "Division Profesional", teams: [], doPool: true },
    { key: "copa_simon_bolivar", label: "Copa Simon Bolivar", short: "Simon Bolivar", teams: [], doPool: true },
  ] },
  { name: "Paraguai", code: "PAR", region: "americas", leagues: [
    { key: "primera_div_par", label: "Division de Honor", short: "Primera", teams: [], doPool: true },
    { key: "division_intermedia_par", label: "Division Intermedia", short: "Intermedia", teams: [], doPool: true },
  ] },
  { name: "Venezuela", code: "VEN", region: "americas", leagues: [
    { key: "primera_div_ven", label: "Liga FUTVE 1", short: "FUTVE 1", teams: [], doPool: true },
    { key: "liga_futve_2", label: "Liga FUTVE 2", short: "FUTVE 2", teams: [], doPool: true },
  ] },
  { name: "Grecia", code: "GRE", region: "europa", leagues: [
    { key: "super_league_gre", label: "Super League Greece", short: "Super League", teams: [], doPool: true },
    { key: "super_league_2_gre", label: "Super League Greece 2", short: "Super League 2", teams: [], doPool: true },
  ] },
  { name: "Dinamarca", code: "DEN", region: "europa", leagues: [
    { key: "superliga_den", label: "3F Superliga", short: "Superliga", teams: [], doPool: true },
    { key: "betinia_liga", label: "Betinia Liga", short: "Betinia Liga", teams: [], doPool: true },
  ] },
  { name: "Chequia", code: "CZE", region: "europa", leagues: [
    { key: "fortuna_liga_cze", label: "Chance Liga", short: "Chance Liga", teams: [], doPool: true },
    { key: "chance_narodni_liga", label: "Chance Narodni Liga", short: "Narodni Liga", teams: [], doPool: true },
  ] },
  { name: "Azerbaijao", code: "AZE", region: "europa", leagues: [
    { key: "premyer_liqa_aze", label: "Misli Premyer Liqasi", short: "Premyer Liqa", teams: [], doPool: true },
  ] },
  { name: "Noruega", code: "NOR", region: "europa", leagues: [
    { key: "eliteserien_nor", label: "Eliteserien", short: "Eliteserien", teams: [], doPool: true },
    { key: "obos_ligaen", label: "OBOS-ligaen", short: "OBOS-ligaen", teams: [], doPool: true },
  ] },
  { name: "Chipre", code: "CYP", region: "europa", leagues: [
    { key: "protathlima_cyp", label: "Cyprus League", short: "Cyprus League", teams: [], doPool: true },
    { key: "second_div_cyp", label: "Cyprus Second Division", short: "Second Division", teams: [], doPool: true },
  ] },
  { name: "Cazaquistao", code: "KAZ", region: "europa", leagues: [
    { key: "premier_liga_kaz", label: "Kazakhstan Premier League", short: "Premier Liga", teams: [], doPool: true },
  ] },
]

/**
 * A DIVISÃO DE ACESSO É ANEXADA À ABA DO PRÓPRIO PAÍS.
 *
 * Escrever uma linha por país aqui (são treze) é o que faz esta lista sair de
 * sincronia com o catálogo — foi assim que onze segundas divisões existiram
 * declaradas e sem aparecer em lugar nenhum. O casamento é pelo `name` da aba,
 * que usa a mesma grafia das pirâmides.
 *
 * ⚠️ `todosDaDivisao` em vez de `doPool`: a base tem centenas de clubes para 20
 * vagas na tabela, e mostrar só as 20 esconderia justamente o clube pequeno que
 * o jogador foi procurar. Ver o uso mais abaixo.
 */
const porNomeDoPais = (a: CountryTab, b: CountryTab) =>
  a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })

const COUNTRIES: CountryTab[] = [...CORE_COUNTRIES, ...CATALOG_COUNTRIES, ...EXPANSION_COUNTRIES]
  .map(pais => {
    const acesso = DIVISOES_DE_ACESSO.find(a => a.country === pais.name)
    if (!acesso || pais.leagues.some(l => l.key === acesso.id)) return pais
    return {
      ...pais,
      leagues: [...pais.leagues, {
        // O catálogo guarda o id como `string`; a aba pede `Divisao`. A união já
        // aceita `acesso_${string}`, e o teste confere que todo id do catálogo
        // tem pirâmide, rótulo e regulamento — a garantia é lá, não no tipo.
        key: acesso.id as Divisao,
        label: acesso.rotulo,
        short: acesso.rotulo.length > 14 ? "Acesso" : acesso.rotulo,
        teams: [],
        todosDaDivisao: true,
      }],
    }
  })
  /**
   * ORDEM ALFABÉTICA — pedido do usuário (1.0.322): "as 70 ligas devem começar
   * por ordem alfabética... para jogadores registrados começar ABCDEFG".
   *
   * A ordem antiga era a de CADASTRO: primeiro os países do catálogo original
   * (Brasil, Inglaterra, Espanha...), depois os do catálogo estendido, e por
   * último os 36 da expansão UEFA. Funcionava enquanto eram dez países; com
   * setenta virou uma lista sem regra nenhuma, em que achar a Dinamarca exigia
   * varrer o carrossel inteiro.
   *
   * `localeCompare` com `sensitivity: "base"` porque os nomes convivem com e sem
   * acento na base ("Azerbaijao"/"Azerbaijão"): comparar bytes jogaria os
   * acentuados para o fim da lista.
   */
  .sort(porNomeDoPais)

/**
 * PAÍSES COM FUTEBOL FEMININO.
 *
 * Sai inteiro do cadastro de `lib/futebol-feminino` — país, liga, tamanho, copa
 * e continental moram lá, num lugar só. Os clubes são resolvidos na HIDRATAÇÃO
 * (`doPool`), pelo mesmo motivo das segundas divisões masculinas: o
 * persistent-store carrega depois do import e um clube resolvido cedo demais
 * apareceria com o nome e o escudo de antes das edições do jogador.
 */
const COUNTRIES_FEMININOS: CountryTab[] = Object.values(
  LIGAS_FEMININAS.reduce<Record<string, CountryTab>>((mapa, liga) => {
    const pais = (mapa[liga.codigoPais] ??= {
      name: liga.pais, code: liga.codigoPais, region: liga.regiao, leagues: [],
    })
    pais.leagues.push({ key: liga.id as Divisao, label: liga.nome, short: liga.short, teams: [], doPool: true })
    return mapa
  }, {}),
).sort(porNomeDoPais)

// Fundo trocado a pedido do usuario (2026-07-20): foto in-game 7.
const STADIUM_BG = "/images/pre-jogo/in-game-7.webp"

export default function NovoJogoPage() {
  const t = useTranslation()
  const { initializeNewGame } = useGameManager()
  const { registrado } = useJogoRegistrado()
  const versaoDoJogo = useVersaoDoJogo()
  const [limiteDeSaves, setLimiteDeSaves] = useState(false)
  const { setTheme, setTeamColors } = useTheme()

  const [countryIndex, setCountryIndex] = useState(0)
  const [leagueIndex, setLeagueIndex] = useState(0)
  const [teamIndex, setTeamIndex] = useState(0)
  const [uniformIndex, setUniformIndex] = useState(0)
  const [kitError, setKitError] = useState(false)
  const [kitRetryCount, setKitRetryCount] = useState(0)
  const [managerName, setManagerName] = useState("")
  /**
   * O nome já vem preenchido com o da CONTA do launcher.
   *
   * Quem entrou na conta já se identificou uma vez; pedir o nome de novo aqui é
   * atrito puro — e era o único campo que barrava o botão de começar. Continua
   * editável: o técnico pode usar outro nome na carreira se quiser.
   *
   * `nome` vazio cai na parte do e-mail antes do @, porque cadastro por Google
   * às vezes chega sem nome preenchido e um placeholder vazio anularia o ganho.
   */
  const nomePreenchido = useRef(false)
  useEffect(() => {
    if (nomePreenchido.current) return
    let vivo = true

    const aplicar = (nome: string) => {
      const limpo = nome.trim().slice(0, 32)
      if (!vivo || !limpo || nomePreenchido.current) return
      nomePreenchido.current = true
      // Só preenche campo VAZIO: se a pessoa já começou a digitar, manda ela.
      setManagerName(atual => (atual.trim().length > 0 ? atual : limpo))
    }

    void (async () => {
      // 1) CONTA DO LAUNCHER. Só existe dentro do app: `contaLogada` chama o
      //    comando Tauri `ler_sessao_do_launcher`, que no NAVEGADOR sempre
      //    falha e devolve null. Por isso o campo continuava vazio no preview
      //    web — não era o código não rodar, era não haver conta para ler ali.
      const conta = await contaLogada()
      const doEmail = (conta?.email ?? "").split("@")[0]?.trim() ?? ""
      const daConta = (conta?.nome ?? "").trim() || doEmail
      if (daConta) return aplicar(daConta)

      // 2) SEM CONTA: usa o nome da carreira mais recente. Quem já jogou não
      //    precisa redigitar o próprio nome a cada carreira nova — e isso vale
      //    inclusive na versão web, onde a conta do launcher não existe.
      try {
        const anteriores = await Promise.resolve(listCareerSaves())
        const ultimo = [...(anteriores ?? [])]
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .find(c => (c.managerName ?? "").trim().length > 0)
        if (ultimo) aplicar(ultimo.managerName)
      } catch { /* preencher o nome e conforto: nunca pode travar a tela */ }
    })()

    return () => { vivo = false }
  }, [])
  /**
   * A MODALIDADE DA CARREIRA (1.0.322).
   *
   * Substitui o antigo `careerStart`, que era um seletor de uma opção só: ele
   * nunca deixava de ser "professional" porque não havia botão para o sub-20 —
   * o motor da base existia inteiro (`youth-career-engine`, `/base/carreira`) e
   * era inalcançável. Agora as quatro carreiras que o jogo tem são escolha.
   */
  const [modalidade, setModalidade] = useState<ModalidadeDeCarreira>("profissional")
  /**
   * A CARREIRA DE JOGADOR CHEGA PELO MENU PRINCIPAL (1.0.324).
   *
   * `/novo-jogo?modo=jogador` trava a modalidade: esta tela continua sendo a
   * mesma (o atleta também precisa escolher um clube), mas o seletor de
   * modalidade some — quem entrou por aquela porta já escolheu.
   *
   * Lido num efeito, e não no inicializador do `useState`: o export é ESTÁTICO e
   * o componente é pré-renderizado no Node, onde `window` não existe.
   */
  // O modo online e uma preferencia do SAVE (multiplayerEnabled). Aqui a tela
  // ainda nao tem carreira, entao a leitura vem do estado global do jogo.
  const modoOnlineLigado = Boolean(useGameState().state.multiplayerEnabled)
  const [modoTravado, setModoTravado] = useState(false)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("modo") !== "jogador") return
    setModalidade("jogador")
    setModoTravado(true)
    // ⚠️ O MODAL DO ATLETA ABRE SOZINHO (1.0.335).
    //
    // Relato do usuário: "ao selecionar a opção de carreira de jogador, deve
    // abrir o modal com as informações do jogador". Quem escolhia a carreira de
    // atleta no menu principal caía nesta tela e via um seletor de CLUBE — o
    // corpo (posição, idade, arquétipo, origem) ficava escondido atrás do botão
    // "Configurações iniciais", que ninguém tem motivo para abrir. Dava para
    // começar a carreira inteira sem nunca decidir quem se é em campo, e o
    // atleta nascia no padrão: atacante, 18 anos, "matador".
    //
    // Quem decide o corpo primeiro e o clube depois é a ordem do próprio modo —
    // e é por isso que a carreira de atleta entra por outra porta.
    //
    // ⚠️ E O QUE ABRE É O PAINEL DO ATLETA, não as configurações da carreira
    // (1.0.358): as duas coisas deixaram de morar na mesma caixa.
    setShowAtletaSetup(true)
  }, [])
  /**
   * O ATLETA da carreira de jogador. Só é usado quando a modalidade é
   * "jogador"; fica aqui, e não num modal separado, porque é decisão de CRIAÇÃO
   * — depois que a carreira existe não há como trocar de corpo.
   */
  const [atleta, setAtleta] = useState<{
    nome: string; posicao: PosicaoDoAtleta; idade: number
    nacionalidade: string; pePreferido: "direito" | "esquerdo"
    alturaCm: number; pesoKg: number; numero: number
    arquetipo: ArquetipoId; origem: OrigemDoAtleta
  }>({ nome: "", posicao: "ATA", idade: 18, nacionalidade: "Brasil", pePreferido: "direito", alturaCm: 178, pesoKg: 72, numero: 9, arquetipo: "matador", origem: "joia" })
  // Trocar de modalidade troca o catálogo inteiro: os índices de país, liga e
  // clube não significam a mesma coisa nos dois, e mantê-los abriria a tela num
  // clube que não é o que o carrossel está mostrando.
  useEffect(() => { setCountryIndex(0); setLeagueIndex(0); setTeamIndex(0) }, [modalidade])
  /**
   * O QUE A CRIAÇÃO ESTÁ FAZENDO AGORA — medido, não decorativo (1.0.358).
   *
   * ⚠️ Do clique em "Iniciar carreira" até o escritório abrir passam ~10 s na
   * build (elencos do pool + TM + feminino são ~10 MB, e depois vem a montagem
   * da temporada e a gravação). A tela ficava PARADA esse tempo inteiro, sem
   * botão desabilitado e sem uma palavra — e dez segundos de nada é
   * indistinguível de travado. Foi metade do relato "coloco os dados e
   * simplesmente não termina": a outra metade era o guarda do nome, acima.
   */
  const [criando, setCriando] = useState<string | null>(null)

  /**
   * ⚠️ OS ELENCOS COMEÇAM A VIR ENQUANTO A PESSOA ESCOLHE — e isto vale mais que
   * qualquer otimização de render nesta tela.
   *
   * Medido na build: abrir o escritório depois do clique baixava ~15 MB em 81
   * requisições e levava 16 s aqui (30 s no relato do usuário, com o overlay
   * parado em "Montando a sua temporada…"). A maior fatia são os três seeds de
   * elenco — pool, Transfermarkt e feminino — que a criação PRECISA ter quentes
   * antes de gravar (com eles frios, o save nasce com atleta gerado no lugar do
   * licenciado, para sempre).
   *
   * Eles não dependem de nada que a pessoa escolhe: podem começar a carregar no
   * instante em que a tela abre e chegar prontos no clique. O `await` lá embaixo
   * continua — quem chegar antes da hora espera; quem chegar depois, não espera
   * nada, porque a promessa é compartilhada (ver lib/pool-elencos).
   *
   * `requestIdleCallback` porque a tela ainda está montando carrossel e escudos:
   * disputar CPU com a primeira pintura seria trocar um engasgo por outro.
   */
  useEffect(() => {
    const puxar = () => {
      void carregarElencosDoPool()
      void carregarElencosReaisTM()
      void carregarElencosFemininos()
    }
    const janela = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
    if (janela.requestIdleCallback) janela.requestIdleCallback(puxar, { timeout: 2500 })
    else window.setTimeout(puxar, 800)
  }, [])

  /**
   * E A TELA DE DESTINO TAMBÉM VEM ANTES. No export estático o código de uma
   * rota só é baixado na primeira visita: sem isto, o `hardNavigate` do fim da
   * criação ainda esperava ~2 MB de JavaScript com o overlay na tela. É o mesmo
   * aquecimento que o cabeçalho faz com as rotas mais visitadas — aqui a rota
   * mais visitada a seguir é conhecida: a que esta carreira vai abrir.
   */
  const roteador = useRouter()
  useEffect(() => {
    const destino = modalidade === "sub20" ? "/base/carreira"
      : modalidade === "jogador" ? "/carreira/jogador"
        : "/"
    const aquecer = () => roteador.prefetch(destino)
    const janela = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
    if (janela.requestIdleCallback) janela.requestIdleCallback(aquecer, { timeout: 3000 })
    else window.setTimeout(aquecer, 1200)
  }, [modalidade, roteador])
  const [debtPreset, setDebtPreset] = useState<DebtPreset>("none")
  const [modoDeMundo, setModoDeMundo] = useState<ModoDeMundo>("original")
  const [showInitialSettings, setShowInitialSettings] = useState(false)
  /**
   * O PAINEL DO ATLETA — separado das configurações iniciais (1.0.358).
   *
   * Quem entra pela porta do atleta decide um CORPO: posição, idade, pé,
   * camisa, perfil de jogo e de onde ele vem. Isso não é configuração de
   * carreira (modo de mundo, dívida, mesa de co-op) e não devia dividir caixa
   * com ela — era o pedido, e é também o motivo de o painel abrir sozinho
   * nessa porta: é a primeira decisão do modo.
   */
  const [showAtletaSetup, setShowAtletaSetup] = useState(false)
  const [configuracoes283, setConfiguracoes283] = useState<ConfiguracoesIniciais283>(CONFIGURACOES_INICIAIS_283)
  const [managerProfile26, setManagerProfile26] = useState(PERFIL_TREINADOR_26_PADRAO)
  const atualizarPerfil26 = useCallback((patch: Partial<Pick<typeof managerProfile26, "nivelComoJogador" | "areaAnterior" | "relevanciaAnterior" | "licenca" | "estilos" | "personalidades">>) => {
    setManagerProfile26(atual => criarPerfilTreinador26({
      nivelComoJogador: patch.nivelComoJogador ?? atual.nivelComoJogador,
      areaAnterior: patch.areaAnterior ?? atual.areaAnterior,
      relevanciaAnterior: patch.relevanciaAnterior ?? atual.relevanciaAnterior,
      licenca: patch.licenca ?? atual.licenca,
      estilos: patch.estilos ?? atual.estilos,
      personalidades: patch.personalidades ?? atual.personalidades,
    }))
  }, [])
  const alternarEstilo26 = useCallback((estilo: EstiloTreinador26) => {
    const atuais = managerProfile26.estilos
    atualizarPerfil26({ estilos: atuais.includes(estilo) ? atuais.filter(item => item !== estilo) : atuais.length < 3 ? [...atuais, estilo] : atuais })
  }, [managerProfile26.estilos, atualizarPerfil26])
  const alternarPersonalidade26 = useCallback((personalidade: PersonalidadeTreinador26) => {
    const atuais = managerProfile26.personalidades
    atualizarPerfil26({ personalidades: atuais.includes(personalidade) ? atuais.filter(item => item !== personalidade) : atuais.length < 2 ? [...atuais, personalidade] : atuais })
  }, [managerProfile26.personalidades, atualizarPerfil26])
  const [nameError, setNameError] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Enquanto o registro nao hidrata (o arquivo do store carrega de forma
  // assincrona) valem os tres paises livres: o indice 0 e o Brasil nos dois
  // casos, entao a lista so CRESCE quando o codigo aparece — nunca encolhe
  // debaixo do dedo de quem ja estava escolhendo.
  // O store hidrata assincrono; enquanto isso as ligas do pool ficam vazias e
  // esta revisao as recalcula quando ele avisa.
  const [storeHidratado, setStoreHidratado] = useState(0)
  useEffect(() => {
    const avisar = () => setStoreHidratado(v => v + 1)
    window.addEventListener("ultrafoot:store:ready", avisar)
    return () => window.removeEventListener("ultrafoot:store:ready", avisar)
  }, [])

  const paises = useMemo(
    () => {
      // A MODALIDADE decide o catálogo. Feminino tem país, liga e clube
      // próprios; profissional, sub-20 e carreira de jogador partem todos do
      // mesmo mundo masculino (a base de um clube é do clube, e o atleta nasce
      // num clube que existe).
      const catalogo = modalidade === "feminino" ? COUNTRIES_FEMININOS : COUNTRIES
      const lista = registrado ? catalogo : catalogo.filter(c => PAISES_SEM_REGISTRO.includes(c.code))
      // CARREIRA DE ATLETA: os grandes da liga ficam de fora da ESTREIA.
      // Aplicado sobre a lista já montada (e não em cada ramo abaixo) para que
      // nenhum caminho — liga curada, do pool ou Divisão de Acesso — escape da
      // regra. Ver `clubesDeEstreia`.
      const comRegraDeEstreia = <L extends { teams: Team[] }>(liga: L): L =>
        modalidade === "jogador" ? { ...liga, teams: clubesDeEstreia(liga.teams) } : liga
      return lista.map(pais => ({
        ...pais,
        leagues: pais.leagues.map(liga => {
          if (modalidade === "feminino") return comRegraDeEstreia({ ...liga, teams: getTeamsFemininosByDivision(liga.key) })
          // A Divisao de Acesso e o unico nivel em que a lista de ESCOLHA nao
          // pode ser a tabela: sao 260 clubes disputando 20 vagas, e mostrar so
          // as 20 deixaria o Serra-ES invisivel — que e exatamente o clube que
          // este nivel existe para tornar jogavel. A tabela dele e montada em
          // torno da escolha (ver a ancora em completarLigaComPool).
          if (liga.todosDaDivisao) {
            return comRegraDeEstreia({
              ...liga,
              teams: [...getTeamsByDivision(liga.key)].sort((a, b) =>
                (a.estado || "ZZ").localeCompare(b.estado || "ZZ")
                || a.nome.localeCompare(b.nome)),
            })
          }
          return comRegraDeEstreia(liga.doPool ? { ...liga, teams: completarLigaComPool(liga.key) } : liga)
        }),
      }))
    },
    [registrado, storeHidratado, modalidade],
  )
  const paisesBloqueados = (modalidade === "feminino" ? COUNTRIES_FEMININOS.length : COUNTRIES.length) - paises.length

  const activeCountry = paises[Math.min(countryIndex, paises.length - 1)]
  const activeLeague = activeCountry.leagues[Math.min(leagueIndex, activeCountry.leagues.length - 1)]
  const teams = activeLeague.teams
  const selectedTeam = teams[teamIndex]

  // ── TÉCNICOS CONVIDADOS (multitécnico estilo Brasfoot) ───────────────────
  //
  // Um save, um mundo, até oito pessoas comandando clubes diferentes dentro
  // dele. O anfitrião é quem está escolhendo o time aqui; os convidados entram
  // nesta lista.
  //
  // ⚠️ A validação roda na CRIAÇÃO porque é a única hora barata de barrar dois
  // técnicos no mesmo clube. Depois de a carreira existir, dois humanos no
  // mesmo registro seriam dois elencos titulares e dois caixas disputando o
  // mesmo clube — não é uma variante do modo, é um mundo incoerente.
  const [convidados, setConvidados] = useState<TecnicoDoSave[]>([])

  // ── O CONVIDADO ESCOLHE NA MESMA TELA QUE O ANFITRIÃO ─────────────────────
  //
  // Antes o convidado tinha um `<select>` com os clubes da liga em que o
  // anfitrião por acaso estava. Isso decidia por ele duas coisas que são dele:
  // o país e a divisão. Agora ele entra NESTA tela — escudo, uniforme, estádio,
  // elenco, tudo — e escolhe como qualquer um.
  //
  // ⚠️ É a MESMA tela, e não uma cópia. Uma segunda tela de escolha nasceria
  // desatualizada na primeira vez que esta ganhasse um campo, e o convidado
  // passaria a escolher com menos informação do que o anfitrião — que é
  // exatamente o que se quer evitar.
  const [escolhaDeConvidado, setEscolhaDeConvidado] = useState<{
    /** Índice em `convidados`, ou `null` quando é um técnico novo. */
    indice: number | null
    nome: string
    /** Onde o anfitrião estava, para a tela dele voltar intacta. */
    voltarPara: { pais: number; liga: number; time: number }
  } | null>(null)
  const escolhendoConvidado = escolhaDeConvidado !== null

  /**
   * O clube do ANFITRIÃO.
   *
   * ⚠️ Não é `selectedTeam` enquanto um convidado escolhe: aí os índices da tela
   * são os DELE. O clube do anfitrião fica onde a tela estava quando ele passou
   * a vez, guardado em `voltarPara`.
   */
  const posicaoDoAnfitriao = escolhaDeConvidado?.voltarPara
    ?? { pais: countryIndex, liga: leagueIndex, time: teamIndex }
  const anfitriao = useMemo(() => {
    const pais = paises[Math.min(posicaoDoAnfitriao.pais, paises.length - 1)]
    const liga = pais.leagues[Math.min(posicaoDoAnfitriao.liga, pais.leagues.length - 1)]
    return { time: liga.teams[posicaoDoAnfitriao.time], liga, pais }
  }, [paises, posicaoDoAnfitriao.pais, posicaoDoAnfitriao.liga, posicaoDoAnfitriao.time])

  const tecnicosDaMesa = useMemo<TecnicoDoSave[]>(() => [
    {
      id: "tecnico-1",
      nome: managerName.trim() || "Técnico",
      clubeCurto: anfitriao.time?.curto ?? null,
      clubeFileKey: anfitriao.time?.file_key,
      clubeNome: anfitriao.time?.nome,
      ligaLabel: anfitriao.liga.label,
      paisNome: anfitriao.pais.name,
      tipo: "humano",
    },
    ...convidados,
  ], [managerName, anfitriao, convidados])
  const errosDosTecnicos = useMemo(
    () => (convidados.length ? validarTecnicos(tecnicosDaMesa) : []),
    [convidados.length, tecnicosDaMesa],
  )

  /** Clubes já tomados por outra pessoa da mesa — um clube, um técnico. */
  const clubesOcupados = useMemo(() => {
    const tomados = new Set<string>()
    const doAnfitriao = anfitriao.time?.file_key ?? anfitriao.time?.curto
    if (doAnfitriao) tomados.add(doAnfitriao)
    convidados.forEach((tec, i) => {
      if (escolhaDeConvidado?.indice === i) return // o próprio, trocando de clube
      const chave = tec.clubeFileKey ?? tec.clubeCurto
      if (chave) tomados.add(chave)
    })
    return tomados
  }, [anfitriao.time, convidados, escolhaDeConvidado?.indice])

  const clubeJaOcupado = Boolean(
    escolhendoConvidado && selectedTeam
    && clubesOcupados.has(selectedTeam.file_key ?? selectedTeam.curto),
  )

  /** Abre a tela de escolha para um convidado (novo, ou trocando de clube). */
  const escolherClubeDoConvidado = useCallback((indice: number | null, nome: string) => {
    setEscolhaDeConvidado({
      indice, nome,
      voltarPara: { pais: countryIndex, liga: leagueIndex, time: teamIndex },
    })
    setShowInitialSettings(false)
  }, [countryIndex, leagueIndex, teamIndex])

  /** Devolve a tela ao anfitrião, exatamente onde ele a deixou. */
  const voltarParaOAnfitriao = useCallback(() => {
    setEscolhaDeConvidado(atual => {
      if (atual) {
        setCountryIndex(atual.voltarPara.pais)
        setLeagueIndex(atual.voltarPara.liga)
        setTeamIndex(atual.voltarPara.time)
      }
      return null
    })
    setShowInitialSettings(true)
  }, [])

  const confirmarClubeDoConvidado = useCallback(() => {
    if (!escolhaDeConvidado || !selectedTeam || clubeJaOcupado) return
    const dados = {
      nome: escolhaDeConvidado.nome,
      clubeCurto: selectedTeam.curto,
      // ⚠️ O `file_key` é a identidade que importa: `curto` se repete entre
      // países, e agora o convidado pode estar em qualquer um deles.
      clubeFileKey: selectedTeam.file_key,
      clubeNome: selectedTeam.nome,
      ligaLabel: activeLeague.label,
      paisNome: activeCountry.name,
      tipo: "humano" as const,
    }
    setConvidados(lista => escolhaDeConvidado.indice === null
      ? [...lista, { id: `tecnico-${lista.length + 2}`, ...dados }]
      : lista.map((t, i) => (i === escolhaDeConvidado.indice ? { ...t, ...dados } : t)))
    voltarParaOAnfitriao()
  }, [escolhaDeConvidado, selectedTeam, clubeJaOcupado, activeLeague.label, activeCountry.name, voltarParaOAnfitriao])
  const [squadQuality, setSquadQuality] = useState<{ total: number; sourced: number; provisional: number; status: "verificado" | "complementado" | "provisorio" } | null>(null)
  useEffect(() => {
    let cancelled = false
    setSquadQuality(null)
    if (!selectedTeam) return
    // A procedência é informativa e não deve atrasar o primeiro desenho. O
    // módulo pesado de atletas só é solicitado depois que a escolha estabiliza.
    const timer = window.setTimeout(() => {
      void import("@/lib/players-data").then(({ getPlayersForTeam }) => {
        if (cancelled) return
        const squad = getPlayersForTeam(selectedTeam, { raw: true })
        const provisional = squad.filter(player => player.generatedOrigin === "provisional").length
        setSquadQuality({
          total: squad.length,
          sourced: squad.length - provisional,
          provisional,
          status: provisional === 0 && squad.length >= 18 ? "verificado" : provisional < 6 ? "complementado" : "provisorio",
        })
      })
    }, 180)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [selectedTeam])

  // Dados de perfil do clube, derivados de forma deterministica (estaveis por time)
  // Modal com a FOTO real do estádio (acervo de 1785 fotos, por nome do clube).
  const [showStadiumPhoto, setShowStadiumPhoto] = useState(false)
  const stadiumPhoto = useMemo(
    () => getTeamStadiumBackground(selectedTeam?.nome, selectedTeam?.estadio_nome),
    [selectedTeam?.nome, selectedTeam?.estadio_nome],
  )

  // URL do escudo para a cena 3D, resolvida na MESMA ordem do TeamCrest (save
  // local > canal > build). Resolvida num efeito, e nao direto no render, porque
  // `getCustomLogoUrl` le o persistent-store, que hidrata depois da montagem —
  // ler cedo devolveria o escudo do build e a cena ficaria com o antigo.
  const [escudo3dUrl, setEscudo3dUrl] = useState<string | null>(null)
  /** A cena assumiu? Enquanto for false, quem aparece e o TeamCrest normal. */
  const [escudo3dAtivo, setEscudo3dAtivo] = useState(false)
  useEffect(() => {
    const chave = selectedTeam?.file_key
    // Trocou de clube: a reserva volta AGORA. Sem isto o escudo do time anterior
    // ficaria escondido enquanto a textura nova carrega, e a tela piscaria vazia.
    setEscudo3dAtivo(false)
    if (!chave) { setEscudo3dUrl(null); return }
    const resolver = () => setEscudo3dUrl(getCustomLogoUrl(chave) ?? getEscudoUrl(chave))
    resolver()
    window.addEventListener("ultrafoot:store:ready", resolver)
    window.addEventListener("ultrafoot:elencos:atualizados", resolver)
    return () => {
      window.removeEventListener("ultrafoot:store:ready", resolver)
      window.removeEventListener("ultrafoot:elencos:atualizados", resolver)
    }
  }, [selectedTeam?.file_key])

  const profile = useMemo(() => {
    const t = selectedTeam
    const name = t?.nome || ""
    const prest = t?.prestigio || 50
    // hash 0..1 estavel
    const h = (seed: number) => {
      let x = seed
      for (let i = 0; i < name.length; i++) x = ((x << 5) - x + name.charCodeAt(i)) | 0
      return Math.abs(x % 1000) / 1000
    }
    const tierFactor = prest / 100
    // Fatos REAIS (lib/club-facts): fundacao e titulos eram inventados por hash
    // — Corinthians saia como 1895/11 ligas (real: 1910/7). Sem curadoria, "—".
    const facts = getClubFacts(t?.curto)
    const foundation = facts?.foundation ?? null
    const ligas = facts?.ligas ?? null
    const copas = facts?.copas ?? null
    const continental = facts?.continental ?? null
    const clubValue = (t?.saldo || 0) * (3 + tierFactor * 5) + (t?.estadio_cap || 0) * 45000
    const transferBudget = t?.saldo || 0
    // niveis 0..100
    const fanAdmiration = Math.round(Math.min(100, prest * 0.7 + h(11) * 45))
    const youthFacilities = Math.round(Math.min(100, 25 + h(12) * 70 + tierFactor * 15))
    const financialStability = Math.round(Math.min(100, 30 + tierFactor * 45 + h(13) * 30))
    // expectativa da diretoria por faixa de prestigio
    const board =
      prest >= 88 ? "VENÇA TUDO, EM CASA E NO EXTERIOR"
      : prest >= 76 ? "CONQUISTE TÍTULOS NACIONAIS"
      : prest >= 62 ? "BRIGUE PELO TÍTULO DA LIGA"
      : prest >= 48 ? "CLASSIFIQUE PARA TORNEIOS CONTINENTAIS"
      : prest >= 32 ? "TERMINE NA PRIMEIRA METADE DA TABELA"
      : "EVITE O REBAIXAMENTO"
    return { foundation, ligas, copas, continental, clubValue, transferBudget, fanAdmiration, youthFacilities, financialStability, board }
  }, [selectedTeam])

  // Mapeia score 0..100 para rotulo + gradiente (heatmap estilo EA FC)
  const levelInfo = (score: number) => {
    // Cores da referência (EA FC): o degradê vai do tom VIVO no topo para uma
    // versão mais funda embaixo — nunca para quase-preto, que era o que fazia
    // os três cards virarem manchas marrons indistinguíveis na tela.
    if (score >= 80) return { label: "MUITO ALTA", grad: "from-[#f43f5e] via-[#c81e4a] to-[#7d1533]" }
    if (score >= 62) return { label: "ALTA", grad: "from-[#fb923c] via-[#e35d12] to-[#8f3a0c]" }
    if (score >= 44) return { label: "MÉDIA", grad: "from-[#2dd4bf] via-[#0f9e8c] to-[#0a4f47]" }
    if (score >= 26) return { label: "BAIXA", grad: "from-[#60a5fa] via-[#2563eb] to-[#1a3f96]" }
    return { label: "MUITO BAIXA", grad: "from-[#94a3b8] via-[#5b6b7f] to-[#2b3542]" }
  }

  const uniforms = useMemo(() => (selectedTeam ? getTeamUniforms(selectedTeam) : null), [selectedTeam])
  const uniformVariants = useMemo(
    () => (["home", "away", "third"] as const).filter(variant => !selectedTeam || isKitVariantAvailable(selectedTeam.file_key, variant)),
    [selectedTeam],
  )
  const activeVariant = uniformVariants[uniformIndex % uniformVariants.length] ?? "home"
  const activeUniform = uniforms ? uniforms[activeVariant] : null
  const cycleUniform = useCallback(() => setUniformIndex(prev => (prev + 1) % uniformVariants.length), [uniformVariants.length])

  const formatCompact = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 2 }).format(v)

  /**
   * O nome que batiza a carreira. No modo atleta é o do ATLETA (o rodapé edita
   * o mesmo valor); nas três de técnico é o do treinador. Ver o guarda abaixo.
   */
  const nomeDaCarreira = modalidade === "jogador"
    ? (atleta.nome.trim() || managerName.trim())
    : managerName.trim()

  const handleStart = useCallback(async () => {
    // Clique duplo não cria duas carreiras: enquanto a primeira corre, esta
    // volta na hora. (O botão também fica desabilitado — cinto e suspensório.)
    if (criando) return
    if (!selectedTeam) return
    // ⚠️ A trava vale para TODO caminho de "começar" (botão, Enter, gamepad),
    // por isso vive aqui e não em cada um deles.
    //
    // Mesa inválida não vira carreira: depois de criada, não há conserto barato.
    if (escolhendoConvidado) return
    if (errosDosTecnicos.length > 0) {
      setShowInitialSettings(true)
      return
    }
    // ⚠️ NA CARREIRA DE ATLETA QUEM DÁ NOME É O ATLETA (1.0.358).
    //
    // Este guarda exigia `managerName` — o "Nome do técnico..." do rodapé — em
    // TODA modalidade. Quem entrava pela porta do atleta preenchia o nome no
    // painel de criação ("Nome", junto de posição, idade e camisa), clicava em
    // "Iniciar carreira" e **nada acontecia**: a função voltava aqui, marcava um
    // erro num campo que a pessoa nem estava olhando e a tela ficava parada para
    // sempre. Foi o relato "coloco os dados e simplesmente não termina".
    //
    // Um atleta não tem nome de técnico: o nome dele É o nome da carreira.
    if (nomeDaCarreira.length === 0) {
      setNameError(true)
      // foca o input para o usuario digitar o nome
      nameInputRef.current?.focus()
      return
    }
    // TETO DE CARREIRAS SEM REGISTRO (lib/beneficios.ts). Note o que isto NAO
    // faz: nao interrompe carreira nenhuma, nao apaga save e nao aparece no meio
    // do jogo. So diz, ANTES de comecar mais uma, que o slot acabou — e apagar
    // uma carreira antiga libera o espaco na hora.
    if (!registrado && listCareerSaves().length >= LIMITE_SAVES_SEM_REGISTRO) {
      setLimiteDeSaves(true)
      return
    }
    // Marcador pequeno e sincrono para recuperar a navegacao no WebView caso o
    // sessionStorage seja descartado durante o reload do protocolo Tauri.
    safeLocalSet("ultrafoot:career-bootstrap", JSON.stringify({
      teamShort: selectedTeam.curto,
      managerName: nomeDaCarreira,
      createdAt: Date.now(),
    }))
    // ⚠️ ESPERA OBRIGATÓRIA. Os elencos do pool (7,91 MB) passaram a chegar sob
    // demanda para tirar o seed do chunk de toda rota. Criar a carreira com eles
    // frios não dá erro nenhum: dá clube inteiro com atleta GERADO no lugar do
    // licenciado — e isso vai para o save, para sempre. Ver `lib/pool-elencos.ts`.
    // O elenco FEMININO entra na mesma espera e pelo mesmo motivo: criar a
    // carreira com ele frio grava atleta gerado no lugar da atleta real, no
    // save, para sempre.
    setCriando(t.novoJogo.carregando_elencos)
    await Promise.all([carregarElencosDoPool(), carregarElencosReaisTM(), carregarElencosFemininos()])
    setCriando(modalidade === "jogador" ? t.novoJogo.montando_sua_temporada : t.novoJogo.montando_temporada)
    setTeamColors({ primary: selectedTeam.cor1, secondary: selectedTeam.cor2 })
    setTheme("team")
    // "user" trava o detector automático: a escolha do jogador manda a partir daqui.
    applyPerformanceProfile(resolverPerfilDesempenho283(configuracoes283.perfilDesempenho), "user")
    const efeitosDoPerfil = efeitosIniciaisPerfil26(managerProfile26)

    // ── CARREIRA DE BASE (Sub-20) ──
    // O motor e a tela existiam desde sempre e não havia como chegar até eles.
    // A carreira nasce com o elenco da base gerado a partir do prestígio do
    // clube; o profissional daquele clube fica de fora — quem dirige a base não
    // dirige o time principal, e é dessa distância que sai o modo.
    const daBase = modalidade === "sub20" ? createYouthCareer(selectedTeam, 2026) : null

    // ── CARREIRA DE JOGADOR ──
    const doAtleta = modalidade === "jogador"
      ? criarCarreiraDeJogador(
          selectedTeam,
          criarAtletaDaCarreira({ ...atleta, nome: nomeDaCarreira }),
          activeLeague.label,
          2026,
        )
      : null

    initializeNewGame(selectedTeam.curto, nomeDaCarreira, {
      modalidade,
      ...(daBase ? { youthCareer: daBase.career, youthPlayers: daBase.players, youthCareerStartSeason: 2026 } : {}),
      ...(doAtleta ? { carreiraDeJogador: doAtleta } : {}),
      // Só grava a lista quando há mais de um: um save de técnico único fica
      // exatamente como sempre foi, e `tecnicosDoSave` o lê como lista de um.
      ...(convidados.length > 0 ? {
        tecnicos: tecnicosDaMesa,
        tecnicoAtivoId: tecnicosDaMesa[0].id,
        rodadaCompartilhada: iniciarRodada(0),
      } : {}),
      gestao282: criarEstadoGestao282(modoDeMundo),
      configuracoesIniciais283: configuracoes283,
      managerProfile26,
      ...efeitosDoPerfil,
      debt: createClubDebt(debtPreset, profile?.clubValue ?? 100_000_000),
      scoutingDepartment: createScoutingDepartment(),
      stadiumPitch: createStadiumPitch(selectedTeam.prestigio, 2026),
      sponsorOffers: generateOffers(selectedTeam.prestigio, 1, 2026),
      activeSponsors: [],
    }, selectedTeam.file_key)
    window.sessionStorage.setItem("ultrafoot:session-active", "true")
    setCriando(t.novoJogo.salvando_carreira)
    // Cutscene de início de carreira REMOVIDA (pedido): vai DIRETO ao escritório.
    // Ainda aguardamos o plugin-store persistir — sem isso, o reload da WebView
    // podia destruir o cache antes de o novo clube chegar ao disco e a home
    // carregava para sempre. O limite de 5s evita prender a UI se o FS falhar.
    await Promise.race([
      flushPersistentStore(),
      new Promise<void>(resolve => window.setTimeout(resolve, 5000)),
    ])
    // CADA MODALIDADE ABRE ONDE ELA ACONTECE. Mandar as quatro para o escritório
    // do técnico era o caminho mais curto e o mais errado: quem escolheu ser
    // atleta cairia numa tela de mercado e de folha salarial que não é dele.
    setCriando(modalidade === "jogador" ? t.novoJogo.abrindo_seu_escritorio : t.novoJogo.abrindo_escritorio)
    // `recarregar`: a navegação client-side não pega logo depois de criar a
    // carreira (medido), e o caminho direto poupa a espera do socorro.
    hardNavigate(
      modalidade === "sub20" ? "/base/carreira"
        : modalidade === "jogador" ? "/carreira/jogador"
          : "/?career=1",
      false,
      { recarregar: true },
    )
  }, [criando, selectedTeam, nomeDaCarreira, initializeNewGame, setTeamColors, setTheme, modalidade, atleta, activeLeague.label, debtPreset, profile, modoDeMundo, configuracoes283, managerProfile26, convidados.length, tecnicosDaMesa, errosDosTecnicos.length, escolhendoConvidado, registrado])

  const isNameValid = nomeDaCarreira.length > 0

  const nextTeam = useCallback(() => setTeamIndex(prev => (prev + 1) % teams.length), [teams.length])
  const prevTeam = useCallback(() => setTeamIndex(prev => (prev - 1 + teams.length) % teams.length), [teams.length])

  const nextCountry = useCallback(() => {
    setCountryIndex(prev => (prev + 1) % paises.length)
    setLeagueIndex(0)
    setTeamIndex(0)
  }, [paises.length])
  const prevCountry = useCallback(() => {
    setCountryIndex(prev => (prev - 1 + paises.length) % paises.length)
    setLeagueIndex(0)
    setTeamIndex(0)
  }, [paises.length])

  // O registro chega depois do primeiro render: a lista de paises cresce e o
  // indice precisa continuar dentro dela.
  useEffect(() => {
    setCountryIndex(prev => Math.min(prev, paises.length - 1))
  }, [paises.length])

  const nextLeague = useCallback(() => {
    setLeagueIndex(prev => (prev + 1) % activeCountry.leagues.length)
    setTeamIndex(0)
  }, [activeCountry.leagues.length])
  const prevLeague = useCallback(() => {
    setLeagueIndex(prev => (prev - 1 + activeCountry.leagues.length) % activeCountry.leagues.length)
    setTeamIndex(0)
  }, [activeCountry.leagues.length])

  const selectRandomTeam = useCallback(() => setTeamIndex(Math.floor(Math.random() * teams.length)), [teams.length])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // NAO sequestrar teclas quando o jogador esta digitando (ex.: nome). Antes, apagar
      // (Backspace) durante a digitacao do nome VOLTAVA ao menu, e as setas trocavam de time.
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return
      switch (e.key) {
        case "ArrowLeft": prevTeam(); break
        case "ArrowRight": nextTeam(); break
        case "ArrowUp": prevCountry(); break
        case "ArrowDown": nextCountry(); break
        // ⚠️ Com um convidado escolhendo, Enter NÃO pode iniciar a carreira: o
        // anfitrião ainda nem voltou à tela dele, e a mesa começaria sem o clube
        // que essa pessoa está no meio de escolher.
        case "Enter": if (escolhendoConvidado) confirmarClubeDoConvidado(); else handleStart(); break
        // Esc NÃO volta mais à splash (relato: expulsava do seletor). Fecha o
        // modal da foto do estádio quando aberto; senão é no-op. Sair do
        // seletor fica no Backspace e no botão Voltar.
        case "Escape": setShowStadiumPhoto(false); break
        case "Backspace": if (escolhendoConvidado) voltarParaOAnfitriao(); else hardNavigate("/splash"); break
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleStart, prevTeam, nextTeam, prevCountry, nextCountry, escolhendoConvidado, confirmarClubeDoConvidado, voltarParaOAnfitriao])

  useEffect(() => {
    const handleGamepadButton = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail
      switch (button) {
        case "B": hardNavigate("/splash"); break
        case "A":
        case "START": handleStart(); break
        case "DPAD_LEFT": prevTeam(); break
        case "DPAD_RIGHT": nextTeam(); break
        case "LB": prevCountry(); break
        case "RB": nextCountry(); break
        case "LT": prevLeague(); break
        case "RT": nextLeague(); break
        case "X": selectRandomTeam(); break
      }
    }
    window.addEventListener("gamepad:button", handleGamepadButton)
    return () => window.removeEventListener("gamepad:button", handleGamepadButton)
  }, [handleStart, prevTeam, nextTeam, prevCountry, nextCountry, prevLeague, nextLeague, selectRandomTeam])

  const leagueLogo = getLeagueLogo(activeLeague.key)
  const qualidadeDaLiga = QUALIDADE_DAS_LIGAS[activeLeague.key]
  // Avaliacao em estrelas com suporte a meia-estrela (passos de 0.5)
  const ratingHalf = Math.max(0, Math.min(5, Math.round(((selectedTeam?.prestigio || 50) / 20) * 2) / 2))
  const cor1 = selectedTeam?.cor1 || "#10b981"
  const cor2 = selectedTeam?.cor2 || "#059669"
  const hasMultipleLeagues = activeCountry.leagues.length > 1

  /**
   * TAMANHO DA FONTE DO NOME — em degraus, pelo comprimento.
   *
   * Não é `clamp()` do CSS porque o que aperta aqui não é a largura da tela: é
   * a quantidade de letras num espaço fixo. Dois clubes na MESMA tela precisam
   * de tamanhos diferentes, e só o texto sabe disso. Degrau, e não conta
   * contínua, para o título não mudar de tamanho a cada clube por um caractere
   * de diferença — o que faria a tela tremer ao navegar com as setas.
   */
  const tamanhoDoNome = useMemo(() => {
    const letras = (selectedTeam?.nome ?? "").length
    if (letras <= 11) return "2.5rem"
    if (letras <= 15) return "2.05rem"
    if (letras <= 19) return "1.7rem"
    if (letras <= 24) return "1.4rem"
    return "1.2rem"
  }, [selectedTeam?.nome])

  // Reseta o uniforme exibido ao trocar de time
  useEffect(() => { setUniformIndex(0) }, [teamIndex, leagueIndex, countryIndex])
  // Tenta novamente a imagem real ao trocar de time ou de uniforme
  useEffect(() => { setKitError(false); setKitRetryCount(0) }, [teamIndex, leagueIndex, countryIndex, uniformIndex])

  // O protocolo game-asset:// (Tauri) por vezes falha numa primeira tentativa logo apos
  // a janela abrir. Antes de cair pro uniforme generico, tenta de novo algumas vezes.
  const handleKitError = useCallback(() => {
    setKitRetryCount((c) => {
      if (c < 4) {
        setTimeout(() => setKitRetryCount((n) => n + 1), 120)
        return c
      }
      setKitError(true)
      return c
    })
  }, [])

  // Cartão da referência: azul-ardósia translúcido, canto BEM arredondado e
  // borda quase invisível. O antigo tinha canto menor e fundo mais opaco, o que
  // dava um ar de "caixa de formulário" em vez do vidro suave do FIFA 26.
  const cardBase = "rounded-[20px] bg-[#141b28]/72 border border-white/[0.06] backdrop-blur-md shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)]"
  const fan = levelInfo(profile.fanAdmiration)
  const youth = levelInfo(profile.youthFacilities)
  const fin = levelInfo(profile.financialStability)

  return (
    <main className="h-screen w-screen overflow-hidden relative">

      {/* ── FUNDO ────────────────────────────────────────────────────────────
          A referência (FIFA 26) usa um fundo CINEMATOGRÁFICO e desfocado, não
          uma foto nítida: névoa escura com um halo frio de um lado e quente do
          outro. A foto do estádio continua ali, mas borrada e dessaturada — ela
          dá profundidade sem disputar atenção com os cartões, que é o problema
          de usá-la nítida. */}
      <div className="absolute inset-0 z-0">
        {/* A ARTE é o fundo (Nova pasta/Fundo 2.png -> WebP, 53 KB): gramado
            noturno com névoa e profundidade de campo. Substitui a foto de
            estádio, que mudava a cada clube e fazia a tela trocar de
            temperatura sem que isso dissesse nada sobre o time. */}
        <Image
          src="/images/escolha-time-bg.webp"
          alt=""
          fill
          className="object-cover"
          priority
          unoptimized
        />
        {/* Véu leve (30%). A arte já nasce escura; véu forte apagaria o gramado
            e sobraria um retângulo preto. O suficiente para o texto branco
            assentar sobre a área mais clara do campo. */}
        <div className="absolute inset-0 bg-[#06080b]/30" />
        {/* Halos do clube nos cantos SUPERIORES: a metade de baixo da arte é o
            gramado iluminado, e halo colorido ali vira mancha suja. Em cima, na
            névoa escura, a cor do time aparece limpa. */}
        <div
          aria-hidden
          className="absolute inset-0 transition-[background] duration-700"
          style={{
            background:
              `radial-gradient(50% 45% at 8% 12%, ${cor1}3a 0%, transparent 66%),`
              + ` radial-gradient(45% 40% at 94% 10%, ${cor2}26 0%, transparent 62%)`,
          }}
        />
        {/* Vinheta + escurecimento do rodapé: fecha os cantos e garante contraste
            para os controles, agora que a barra de baixo é transparente. */}
        <div className="absolute inset-0 bg-[radial-gradient(120%_95%_at_50%_40%,transparent_38%,rgba(0,0,0,0.7)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 to-transparent" />
      </div>

      <div className="relative z-10 h-full flex flex-col">

        {/* ── QUEM ESTÁ ESCOLHENDO AGORA ────────────────────────────────────
            A tela é a mesma do anfitrião, então ela precisa dizer de quem é a
            vez — sem isto o convidado escolheria achando que está mexendo no
            time do dono da carreira. */}
        {escolhaDeConvidado && (
          <div className="shrink-0 border-b border-[var(--brand)]/25 bg-[var(--brand)]/[0.08] px-4 sm:px-8 py-2.5">
            <div className="mx-auto flex max-w-[1480px] flex-wrap items-center gap-3">
              <span className="rounded-md bg-[var(--brand)]/20 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--brand)]">
                Técnico {(escolhaDeConvidado.indice ?? convidados.length) + 2} de {MAXIMO_DE_TECNICOS}
              </span>
              <input
                value={escolhaDeConvidado.nome}
                onChange={e => setEscolhaDeConvidado(a => (a ? { ...a, nome: e.target.value } : a))}
                placeholder="Nome de quem vai comandar..."
                maxLength={24}
                className="h-9 w-56 rounded-lg border border-white/15 bg-black/45 px-3 text-sm text-white placeholder:text-white/30"
              />
              <span className="text-xs text-white/60">
                Escolha o país, a liga e o clube. O mundo é o mesmo do
                <strong className="text-white/80"> {managerName.trim() || "anfitrião"}</strong> —
                só o clube é seu.
              </span>
            </div>
          </div>
        )}

        {/* ── Conteudo principal: 4 zonas (estilo EA FC) ── */}
        <div className="flex-1 flex items-center justify-center px-4 sm:px-8 overflow-y-auto py-6">
          <div className="flex flex-col lg:flex-row items-stretch justify-center gap-3 lg:gap-4 w-full max-w-[1480px]">

            {/* ── Zona 1: Info do clube ── */}
            <div className="flex flex-col w-full lg:w-[300px] shrink-0">

              {/* ── AS TRÊS CARREIRAS DE TÉCNICO, EM BOTÃO ────────────────────
                  Pedido do usuário (1.0.324), com print apontando este espaço.
                  A escolha existia só no `<select>` do rodapé, junto de "modo de
                  mundo" e "dívida inicial" — três controles cinzas iguais, e o
                  que decide o JOGO INTEIRO era o do meio. Aqui em cima ela vira
                  a primeira decisão da tela, que é o que ela de fato é: trocar
                  de modalidade troca o país, a liga e o clube embaixo.

                  Some quando a carreira é de ATLETA (entrou pelo menu
                  principal): ali a modalidade já está decidida. */}
              {!modoTravado && (
                <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-black/45 p-1">
                  {MODALIDADES.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setModalidade(m.id)}
                      title={m.resumo}
                      aria-pressed={modalidade === m.id}
                      className={cn(
                        "rounded-lg px-2 py-2 text-[10px] font-black uppercase leading-tight tracking-wide transition-colors",
                        modalidade === m.id
                          ? "bg-[var(--brand)] text-[var(--brand-ink)]"
                          : "text-white/55 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      {m.id === "profissional" ? "Profissional" : m.id === "feminino" ? "Feminino" : "Sub-20"}
                    </button>
                  ))}
                </div>
              )}

              {/* ONLINE — só com o modo online ligado (1.0.327).
                  Fica junto da escolha de modalidade porque é o mesmo tipo de
                  decisão: que carreira você vai jogar. Desligado, não existe. */}
              {modoOnlineLigado && (
                <button
                  onClick={() => hardNavigate("/online")}
                  className="mb-3 flex w-full items-center gap-2 rounded-xl border border-sky-400/25 bg-sky-400/[0.07] px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-sky-100/80 transition-colors hover:border-sky-400/45 hover:bg-sky-400/[0.12]"
                >
                  <Globe className="h-4 w-4 text-sky-300" />
                  Jogar online contra outros técnicos
                </button>
              )}

              {/* Pais (com setas, navega nos dois sentidos pelos paises disponiveis) */}
              <div className="flex items-center gap-1.5 mb-2">
                <button
                  onClick={prevCountry}
                  aria-label="Pais anterior"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-white/45 hover:text-white hover:bg-white/10 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={nextCountry}
                  aria-label={`Pais: ${activeCountry.name}. Trocar pais`}
                  className="group flex items-center gap-1.5"
                >
                  <span className="text-base font-bold uppercase tracking-wide text-white/80 group-hover:text-white transition-colors">{activeCountry.name}</span>
                  <span className="text-white/35 text-[10px]">{Math.min(countryIndex, paises.length - 1) + 1}/{paises.length}</span>
                </button>
                <button
                  onClick={nextCountry}
                  aria-label="Proximo pais"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-white/45 hover:text-white hover:bg-white/10 transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Aviso das ligas que o codigo libera. Fica junto do seletor porque
                  e ali que a falta aparece — some assim que o jogo e registrado. */}
              {paisesBloqueados > 0 && (
                <button
                  type="button"
                  onClick={() => hardNavigate(ROTA_DE_REGISTRO)}
                  className="mb-3 flex w-full items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.07] px-2.5 py-2 text-left text-[11px] leading-snug text-amber-100/80 transition-colors hover:border-amber-400/45 hover:bg-amber-400/[0.12]"
                >
                  <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                  <span>
                    {/* A lista vem de `PAISES_SEM_REGISTRO`, não escrita à mão:
                        o texto dizia "Brasil, França ou Espanha" desde
                        30/07/2026 e a regra virou SÓ o Brasil no dia seguinte. */}
                    Sem registro voce comeca no <strong className="font-semibold text-amber-100">Brasil</strong>.
                    Registre o jogo para abrir os outros {paisesBloqueados} paises.
                  </span>
                </button>
              )}

              {/* CRIAR O PRÓPRIO CLUBE. Fica aqui, e não num menu distante,
                  porque a hora em que alguém quer o próprio clube é exatamente a
                  hora em que está escolhendo um. O convite aparece para todos —
                  o portão de registro é da TELA de criação, pela regra "só
                  benefício, nunca trava": esconder a existência do recurso é
                  pior do que mostrá-lo e explicar o que ele pede. */}
              <button
                type="button"
                onClick={() => hardNavigate("/clube-novo")}
                className="mb-3 flex w-full items-start gap-2 rounded-lg border border-cyan-400/25 bg-cyan-400/[0.07] px-2.5 py-2 text-left text-[11px] leading-snug text-cyan-100/80 transition-colors hover:border-cyan-400/45 hover:bg-cyan-400/[0.12]"
              >
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />
                <span>
                  Nao achou o seu time? <strong className="font-semibold text-cyan-100">{t.novoJogo.crie_o_seu_proprio_clube}</strong> —
                  nome, cores, escudo, uniformes e estadio, comecando da Divisao de Acesso.
                </span>
              </button>

              {/* NOME + ESCUDO, na hierarquia da referência: o nome manda, o
                  escudo vem grande logo abaixo, sem moldura nem círculo. O halo
                  fica na COR DO CLUBE e troca junto com ele. */}
              {/* O NOME CABE EM UMA LINHA, SEMPRE.
                  "RB Bragantino" quebrava em duas e empurrava o escudo para
                  baixo — a tela inteira dançava conforme o clube selecionado.
                  `text-balance` piorava: ele existe justamente para distribuir
                  o texto em várias linhas. A regra é o contrário — nunca
                  quebrar, e encolher a fonte na medida do nome. Os cortes saem
                  da largura real da coluna (~330px) com a fonte black e o
                  `tracking` apertado; nomes de verdade que forçam cada faixa:
                  "Vasco da Gama" (13), "RB Bragantino" (13), "Sampaio Corrêa-RJ"
                  (17), "Borussia Mönchengladbach" (24). */}
              <h1
                className="whitespace-nowrap font-black uppercase tracking-[-0.02em] text-white leading-[1.05]"
                style={{ fontSize: tamanhoDoNome }}
                title={selectedTeam?.nome}
              >
                {selectedTeam?.nome}
              </h1>
              {squadQuality && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white/60" title={`${squadQuality.sourced} atletas provenientes da base e ${squadQuality.provisional} complementos provisórios`}>
                  <span className={cn("h-2 w-2 rounded-full", squadQuality.status === "verificado" ? "bg-emerald-400" : squadQuality.status === "complementado" ? "bg-amber-300" : "bg-orange-500")} />
                  Elenco {squadQuality.status === "verificado" ? "verificado" : squadQuality.status === "complementado" ? "complementado" : "provisório"}
                  <span className="text-white/35">{squadQuality.sourced}/{squadQuality.total} da base</span>
                </div>
              )}
              {qualidadeDaLiga && (qualidadeDaLiga.elenco !== "real" || qualidadeDaLiga.piramide !== "viva") && (
                <div className="mt-2 max-w-sm space-y-1 rounded-lg border border-sky-400/15 bg-sky-400/[0.06] px-3 py-2 text-[10px] leading-relaxed text-sky-100/65">
                  {qualidadeDaLiga.piramide !== "viva" && (
                    <p>
                      Pirâmide da liga:{" "}
                      {(() => {
                        const chave = PYRAMID_SCOPE_291[activeLeague.key]
                        return chave ? t.novoJogo[chave] : null
                      })() ?? (
                        qualidadeDaLiga.piramide === "isolada"
                          ? "sem acesso nem rebaixamento nesta base — os clubes desta liga não trocam de divisão."
                          : qualidadeDaLiga.desce > 0
                            ? `${qualidadeDaLiga.desce} rebaixados, sem divisão acima para subir.`
                            : `${qualidadeDaLiga.sobe} promovidos, sem divisão abaixo para cair.`
                      )}
                    </p>
                  )}
                  {qualidadeDaLiga.elenco !== "real" && (
                    <p>
                      Elencos da liga: {qualidadeDaLiga.clubesComElencoReal} de {qualidadeDaLiga.clubes} clubes
                      {" "}com elenco real completo — os demais entram com atletas gerados.
                    </p>
                  )}
                </div>
              )}

              {/* ESCUDO — o elemento mais importante da tela, e agora com o
                  tamanho que isso exige. Halo duplo (cor do clube + brilho
                  quente) para ele descolar do fundo em qualquer escudo, claro
                  ou escuro. */}
              <div className="relative my-7 flex items-center justify-center">
                {/* ── SETAS DE TROCAR DE TIME ────────────────────────────────
                    Elas chamam `prevTeam`/`nextTeam`, que são EXATAMENTE os
                    mesmos callbacks de ←/→ no teclado e do direcional do
                    controle. Nada de lógica nova: o botão na tela passa a ser
                    a terceira porta para o mesmo comando, e por isso não há
                    como as três discordarem.
                    Ficam por FORA do halo (`-left-2`/`-right-2`, acima dele em
                    z) porque o borrão de 288px cobre a largura toda da coluna:
                    dentro dele, o clique cairia no halo e não no botão. */}
                <button
                  onClick={prevTeam}
                  aria-label="Time anterior"
                  className="absolute -left-2 z-20 flex h-16 w-9 items-center justify-center rounded-xl text-white/40 transition-all hover:bg-white/10 hover:text-white active:scale-95 sm:-left-4"
                >
                  <ChevronLeft className="h-7 w-7" />
                </button>
                <button
                  onClick={nextTeam}
                  aria-label="Próximo time"
                  className="absolute -right-2 z-20 flex h-16 w-9 items-center justify-center rounded-xl text-white/40 transition-all hover:bg-white/10 hover:text-white active:scale-95 sm:-right-4"
                >
                  <ChevronRight className="h-7 w-7" />
                </button>
                <div
                  aria-hidden
                  className="absolute h-72 w-72 rounded-full blur-[70px] transition-colors duration-500"
                  style={{ backgroundColor: `${cor1}55` }}
                />
                <div
                  aria-hidden
                  className="absolute h-44 w-44 rounded-full bg-white/[0.06] blur-2xl"
                />
                <motion.div
                  key={selectedTeam?.curto}
                  initial={{ opacity: 0, scale: 0.86, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="relative"
                >
                  {/* O TeamCrest e a RESERVA, e some quando a cena 3D assume — os
                      dois visiveis ao mesmo tempo davam escudo duplicado, porque a
                      placa 3D e o <img> nao ocupam o mesmo espaco. Ele continua
                      montado (nao e `&&`) de proposito: e ele que resolve escudo
                      local, do canal e do build, e volta a aparecer sozinho se
                      faltar WebGL, se a textura falhar ou se o jogador ligar
                      "reduzir movimento". */}
                  <TeamCrest
                    team={selectedTeam}
                    size="4xl"
                    className={cn(
                      "h-56 w-56 drop-shadow-[0_18px_46px_rgba(0,0,0,0.8)] sm:h-64 sm:w-64 transition-opacity duration-300",
                      escudo3dAtivo && "opacity-0",
                    )}
                  />
                  {escudo3dUrl && (
                    <Escudo3D
                      key={escudo3dUrl}
                      src={escudo3dUrl}
                      cor1={selectedTeam?.cor1}
                      cor2={selectedTeam?.cor2}
                      onPronto={setEscudo3dAtivo}
                      className="pointer-events-none absolute inset-0"
                    />
                  )}
                </motion.div>
              </div>

              {/* Estrelas — medida de força do clube, discretas sob o escudo. */}
              <div className="mb-5 flex items-center justify-center gap-1.5">
                {Array.from({ length: 5 }).map((_, i) => {
                  const fill = ratingHalf - i
                  return (
                    <span
                      key={i}
                      className={cn(
                        "h-2.5 w-2.5 rotate-45 rounded-[1px] transition-colors",
                        fill >= 1 ? "bg-amber-400"
                          : fill >= 0.5 ? "bg-gradient-to-br from-amber-400 from-50% to-white/12 to-50%"
                            : "bg-white/12",
                      )}
                    />
                  )
                })}
              </div>

              {/* PÍLULAS DE AÇÃO — o formato da referência. "Trocar de time" no
                  lugar das setas soltas em volta do escudo: fica claro que é
                  ação, e não decoração do brasão.
                  (A referência tem também "ÍDOLOS e Heróis/Heroínas"; fora daqui
                  de propósito — este jogo não tem times femininos.) */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={nextTeam}
                  className="group flex h-11 w-full max-w-[260px] items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-5 text-sm font-semibold text-white/85 transition-all hover:border-white/30 hover:bg-white/[0.13] hover:text-white"
                >
                  <Shuffle className="h-4 w-4 opacity-70" />
                  Trocar de time
                </button>
                <button
                  onClick={selectRandomTeam}
                  className="flex h-10 w-full max-w-[260px] items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 text-[13px] font-medium text-white/60 transition-all hover:border-white/25 hover:bg-white/[0.1] hover:text-white"
                >
                  Surpreenda-me
                </button>
              </div>

              {/* Liga (com setas se houver multiplas no pais) */}
              <div className="flex items-center justify-center gap-2 mt-auto pt-4">
                {hasMultipleLeagues && (
                  <button onClick={prevLeague} aria-label="Liga anterior" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/45 hover:text-white hover:bg-white/10 transition-all">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={hasMultipleLeagues ? nextLeague : undefined}
                  aria-label={hasMultipleLeagues ? `Liga: ${activeLeague.label}. Trocar liga` : activeLeague.label}
                  className={cn("flex flex-col items-center gap-2", hasMultipleLeagues && "cursor-pointer")}
                >
                  {leagueLogo && (
                    <Image
                      src={leagueLogo}
                      alt={activeLeague.label}
                      width={150}
                      height={36}
                      className="object-contain h-7 w-auto max-w-[160px]"
                      style={{ mixBlendMode: "screen" }}
                      unoptimized
                    />
                  )}
                  {hasMultipleLeagues && (
                    <span className="text-white/35 text-[10px]">{leagueIndex + 1} / {activeCountry.leagues.length} ligas</span>
                  )}
                </button>
                {hasMultipleLeagues && (
                  <button onClick={nextLeague} aria-label="Proxima liga" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/45 hover:text-white hover:bg-white/10 transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* ── Zona 2: Uniforme + Estadio ──
                Coluna mais larga para a camisa CABER GRANDE: era 220px e a
                camisa saía com 150px, menor que o escudo do card ao lado. */}
            <div className="flex flex-col gap-3 w-full lg:w-[268px] shrink-0">
              {/* Card Uniforme */}
              <button onClick={cycleUniform} className={cn(cardBase, "flex-1 flex flex-col items-center px-5 py-4 transition-colors hover:border-[var(--brand)]/30")} aria-label="Trocar uniforme">
                <span className="text-xs text-white/50 tracking-wide">Uniforme</span>
                <span className="text-base font-black uppercase tracking-wide text-white mb-2">Uniforme {(uniformIndex % uniformVariants.length) + 1}</span>
                <motion.div
                  key={`${selectedTeam?.curto}-${activeVariant}`}
                  initial={{ opacity: 0, y: 10, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="flex-1 flex items-center justify-center w-full px-2"
                >
                  {selectedTeam && !kitError ? (
                    <Image
                      key={`${selectedTeam.file_key}-${activeVariant}-${kitRetryCount}`}
                      src={getCamisaUrl(selectedTeam.file_key, activeVariant, selectedTeam.nome)}
                      alt={`Uniforme ${(uniformIndex % uniformVariants.length) + 1} do ${selectedTeam.nome}`}
                      width={230}
                      height={288}
                      className="max-w-[230px] w-full h-auto object-contain drop-shadow-[0_14px_34px_rgba(0,0,0,0.65)]"
                      onError={handleKitError}
                      unoptimized
                    />
                  ) : activeUniform ? (
                    <Jersey
                      variant={activeVariant}
                      primary={activeUniform.primary}
                      secondary={activeUniform.secondary}
                      pattern={activeUniform.pattern}
                      className="max-w-[230px]"
                    />
                  ) : null}
                </motion.div>
                {/* Indicador de carrossel */}
                <div className="flex items-center gap-2 mt-3">
                  <ChevronLeft className="w-3.5 h-3.5 text-white/30" />
                  {[0, 1, 2].map(i => (
                    <span key={i} className={cn("w-1.5 h-1.5 rounded-full transition-colors", i === uniformIndex ? "bg-[var(--brand)]" : "bg-white/20")} />
                  ))}
                  <ChevronRight className="w-3.5 h-3.5 text-white/30" />
                </div>
              </button>

              {/* Card Estadio — clique/hover abre modal com a FOTO real do
                  estádio (acervo de 1785 fotos já embutido, por nome do clube). */}
              <button
                onClick={() => stadiumPhoto && setShowStadiumPhoto(true)}
                onMouseEnter={() => stadiumPhoto && setShowStadiumPhoto(true)}
                className={cn(cardBase, "flex flex-col items-center px-5 py-4 gap-2", stadiumPhoto && "cursor-pointer hover:ring-1 hover:ring-[var(--brand)]/40")}
              >
                <span className="text-xs text-white/50 tracking-wide">{t.novoJogo.nome_do_estadio}</span>
                <span className="text-sm font-black uppercase tracking-wide text-white text-center text-balance leading-tight">{selectedTeam?.estadio_nome}</span>
                <Building2 className="w-9 h-9 text-white/70 mt-1" strokeWidth={1.5} />
                <span className="text-[11px] text-white/40 tabular-nums">{(selectedTeam?.estadio_cap || 0).toLocaleString("pt-BR")} lugares</span>
              </button>

              {showStadiumPhoto && stadiumPhoto && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                  onClick={() => setShowStadiumPhoto(false)}
                  onMouseLeave={() => setShowStadiumPhoto(false)}
                >
                  <div className="relative mx-4 w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10">
                    {/* <img> cru: a foto do estadio vem de caminho resolvido em runtime. */}
                    <img src={stadiumPhoto} alt={selectedTeam?.estadio_nome ?? "Estádio"} className="h-auto w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4">
                      <p className="text-lg font-black text-white">{selectedTeam?.estadio_nome}</p>
                      <p className="text-xs text-white/60">{(selectedTeam?.estadio_cap || 0).toLocaleString("pt-BR")} lugares · {selectedTeam?.nome}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Zona 3: Estatisticas + Diretoria ── */}
            <div className="flex flex-col gap-3 w-full lg:flex-1 lg:max-w-[440px]">
              {/* O conteúdo se DISTRIBUI na altura do cartão (justify-between +
                  py maior). Antes tudo se amontoava no topo e sobrava um vazio
                  grande embaixo — na referência o cartão é preenchido de ponta
                  a ponta, e é isso que o faz parecer um painel e não uma lista
                  que acabou cedo. */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className={cn(cardBase, "flex-1 px-7 py-7 flex flex-col justify-center gap-8")}
              >
                {/* FUNDAÇÃO com a moldura de louros da referência. São dois
                    ramos em CSS (bordas arredondadas cortadas), não um asset:
                    o card precisa funcionar em qualquer clube sem depender de
                    arte que não temos. */}
                {/* O DESTAQUE SO ACENDE QUANDO HA FATO CURADO. Brilho e moldura
                    dourada em cima de "—" chamam atencao para o que o jogo NAO
                    sabe; sem dado, a moldura fica discreta e o rotulo explica.
                    Ver lib/club-facts: fundacao e titulo sao afirmacoes sobre
                    clube real, entao ou vem de curadoria ou nao vem. */}
                <div className="relative text-center">
                  <span className="text-[13px] text-white/55 tracking-wide">Fundação</span>
                  <motion.div
                    key={`fund-${selectedTeam?.file_key ?? ""}`}
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className="relative mx-auto mt-1 flex w-fit items-center gap-3"
                  >
                    <span aria-hidden className={cn(
                      "h-12 w-6 rounded-l-full border-y-2 border-l-2 transition-colors duration-500",
                      profile.foundation ? "border-[color:var(--brand)]/70" : "border-white/20",
                    )} />
                    <div className="relative">
                      {profile.foundation && (
                        <motion.span
                          aria-hidden
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0, 0.5, 0.28] }}
                          transition={{ duration: 1.1, times: [0, 0.45, 1] }}
                          className="pointer-events-none absolute -inset-4 rounded-full bg-[color:var(--brand)]/25 blur-2xl"
                        />
                      )}
                      <NumeroQueConta
                        valor={profile.foundation}
                        tipo="ano"
                        className="relative text-6xl font-black text-white tabular-nums leading-none"
                      />
                    </div>
                    <span aria-hidden className={cn(
                      "h-12 w-6 rounded-r-full border-y-2 border-r-2 transition-colors duration-500",
                      profile.foundation ? "border-[color:var(--brand)]/70" : "border-white/20",
                    )} />
                  </motion.div>
                  {!profile.foundation && (
                    <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/25">{t.novoJogo.sem_registro_historico}</p>
                  )}
                </div>

                {/* Titulos */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: Award, label: "Ligas nacionais", value: profile.ligas },
                    { icon: Trophy, label: "Copas nacionais", value: profile.copas },
                    { icon: Globe, label: "Continental", value: profile.continental },
                  ].map(({ icon: Icon, label, value }, i) => (
                    <motion.div
                      key={`${label}-${selectedTeam?.file_key ?? ""}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: 0.08 + i * 0.06 }}
                      className="flex flex-col items-center text-center"
                    >
                      {/* Sala de troféus: quem TEM título ganha ícone aceso e
                          número na cor do tema; quem tem zero (ou não tem dado)
                          fica apagado. É a diferença entre a vitrine do clube
                          grande e a do clube pequeno, que é justamente o que
                          esta tela deveria comunicar. */}
                      <Icon
                        className={cn(
                          "w-9 h-9 transition-colors duration-500",
                          value ? "text-[color:var(--brand)]" : "text-white/35",
                        )}
                        strokeWidth={1.5}
                      />
                      <span className="text-[11px] text-white/50 mt-2 leading-tight">{label}</span>
                      <NumeroQueConta
                        valor={value}
                        duracao={700}
                        className={cn(
                          "text-4xl font-black tabular-nums mt-1 leading-none",
                          value ? "text-white" : "text-white/35",
                        )}
                      />
                    </motion.div>
                  ))}
                </div>

                <div className="h-px bg-white/[0.09]" />

                {/* Valores */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <span className="text-[12px] text-white/50">{t.novoJogo.valor_do_clube}</span>
                    <div className="text-2xl font-black gradient-text-primary tabular-nums leading-tight">{formatCompact(profile.clubValue)}</div>
                  </div>
                  <div className="text-center">
                    <span className="text-[12px] text-white/50">{t.novoJogo.verba_de_transf}</span>
                    <div className="text-2xl font-black text-white tabular-nums leading-tight">{formatCompact(profile.transferBudget)}</div>
                  </div>
                </div>
              </motion.div>

              {/* Card Diretoria */}
              <div className={cn(cardBase, "px-6 py-4 text-center")}>
                <span className="text-xs text-white/50 tracking-wide">{t.novoJogo.expectativa_da_diretoria}</span>
                <p className="text-sm font-black uppercase tracking-wide text-white mt-1 text-balance leading-snug">{profile.board}</p>
              </div>
            </div>

            {/* ── Zona 4: Cards de nivel ──
                O DEGRADÊ é o dado aqui: a cor diz o nível antes de a pessoa ler
                a palavra. Antes um `bg-black/20` cobria o cartão inteiro e
                apagava justamente isso — restava um retângulo cinza-avermelhado
                em que "MUITO ALTA" e "BAIXA" pareciam a mesma coisa. Agora o véu
                é só um degradê de baixo para cima, para o texto continuar
                legível sem matar a cor. */}
            <div className="flex flex-col gap-3 w-full lg:w-[232px] shrink-0">
              {[
                { title: "Admiração da Torcida", info: fan },
                { title: "Instalações da Base", info: youth },
                { title: "Estabilidade financeira", info: fin },
              ].map(({ title, info }, i) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.06 * i, ease: [0.16, 1, 0.3, 1] }}
                  className={cn(
                    "relative flex flex-1 flex-col justify-between overflow-hidden rounded-[20px] bg-gradient-to-b px-5 py-5 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)]",
                    info.grad,
                  )}
                >
                  {/* Brilho SÓ no topo, como na referência: dá volume ao cartão
                      sem o véu preto que antes cobria tudo e apagava a cor —
                      era ele que deixava os três cards com a mesma cara. */}
                  <div aria-hidden className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.14] to-transparent" />
                  <span className="relative text-[15px] font-semibold leading-tight text-white text-balance drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]">
                    {title}
                  </span>
                  <motion.span
                    key={info.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28 }}
                    className="relative text-[1.7rem] font-black uppercase leading-none tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]"
                  >
                    {info.label}
                  </motion.span>
                </motion.div>
              ))}
            </div>

          </div>
        </div>

        {/* ── Barra inferior (estilo EA FC) ── */}
        {/* RODAPÉ TRANSPARENTE — a barra opaca cortava a arte do fundo numa
            faixa reta e fazia a tela parecer duas imagens coladas. Sem fundo
            nem borda: só um degradê muito suave por baixo, para os controles
            claros não sumirem quando a arte tiver área clara ali. */}
        <footer className="relative shrink-0 bg-gradient-to-t from-black/55 to-transparent px-4 sm:px-8 py-3">
          <div className="flex items-center justify-between gap-4 max-w-[1480px] mx-auto flex-wrap">

            {/* Dicas de controle */}
            <div className="flex items-center gap-3 sm:gap-5 text-xs text-white/55">
              <span className="flex items-center gap-1.5">
                <kbd className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded bg-white/10 border border-white/15"><CornerDownLeft className="w-3.5 h-3.5" /></kbd>
                Avançar
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded bg-white/10 border border-white/15"><ArrowLeft className="w-3.5 h-3.5" /></kbd>
                Voltar
              </span>
              <button onClick={selectRandomTeam} className="flex items-center gap-1.5 hover:text-white transition-colors">
                <kbd className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded bg-white/10 border border-white/15"><Shuffle className="w-3.5 h-3.5" /></kbd>
                Aleatório
              </button>
              {hasMultipleLeagues && (
                <button onClick={nextLeague} className="hidden sm:flex items-center gap-1.5 hover:text-white transition-colors">
                  <kbd className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded bg-white/10 border border-white/15"><Repeat className="w-3.5 h-3.5" /></kbd>
                  Trocar liga
                </button>
              )}
              <span className="text-white/30 font-mono tabular-nums">{teamIndex + 1} / {teams.length}</span>
            </div>

            {/* ESCOLHA DE CONVIDADO: os controles da carreira somem enquanto ele
                escolhe. Dívida, modo de mundo e nome do anfitrião são decisões
                da CARREIRA, não do clube dele — deixá-los à mão convidaria o
                convidado a mexer no que não é dele. */}
            {escolhaDeConvidado ? (
              <div className="flex items-center gap-3">
                {clubeJaOcupado && (
                  <p className="text-[11px] font-medium text-amber-400">
                    Este clube já é de outro técnico da mesa.
                  </p>
                )}
                <button
                  onClick={voltarParaOAnfitriao}
                  className="h-11 rounded-xl border border-white/15 bg-black/70 px-4 text-[11px] font-bold uppercase text-white/70 hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarClubeDoConvidado}
                  aria-disabled={clubeJaOcupado || !escolhaDeConvidado.nome.trim()}
                  className="relative h-11 px-6 rounded-xl font-black text-sm tracking-[0.15em] uppercase text-white transition-all active:scale-[0.97] inline-flex items-center gap-2"
                  style={{
                    background: `linear-gradient(135deg, ${cor1} 0%, ${cor2} 100%)`,
                    boxShadow: `0 6px 22px ${cor1}45`,
                    opacity: clubeJaOcupado || !escolhaDeConvidado.nome.trim() ? 0.55 : 1,
                    filter: clubeJaOcupado || !escolhaDeConvidado.nome.trim() ? "grayscale(0.4)" : "none",
                  }}
                >
                  <Check className="h-4 w-4" />
                  Confirmar clube
                </button>
              </div>
            ) : (
            /* Nome do tecnico + iniciar */
            /* ⚠️ ESTA LINHA IMPEDIA COMEÇAR UMA CARREIRA NO CELULAR. São cinco
               controles em fila (configurações, modo de mundo, dívida, nome e o
               botão de iniciar): 709px medidos numa faixa de 365px. O rodapé de
               fora já tinha `flex-wrap`, mas quebra de linha só acontece ENTRE os
               filhos — este filho é um só, e um só não quebra: passava direto da
               borda levando junto o campo do nome e o botão de começar. */
            <div className="flex flex-wrap items-center justify-center gap-3 md:flex-nowrap md:justify-end">
              {/* ⚠️ DUAS PORTAS, DUAS COISAS (1.0.358). "Criar atleta" é o corpo
                  de quem joga; "Configurações iniciais" são as regras da
                  carreira. Antes o primeiro morava dentro do segundo. */}
              {modalidade === "jogador" && (
                <button
                  onClick={() => setShowAtletaSetup(true)}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--brand)]/35 bg-[var(--brand)]/10 px-3 text-[10px] font-bold uppercase text-[var(--brand)] hover:bg-[var(--brand)]/20"
                >
                  <User className="h-4 w-4" /> {t.novoJogo.criar_atleta}
                </button>
              )}
              <button onClick={() => setShowInitialSettings(true)} className="h-11 rounded-xl border border-white/15 bg-black/70 px-3 text-[10px] font-bold uppercase text-white/80 hover:bg-white/10 inline-flex items-center gap-2">
                <Settings2 className="h-4 w-4" /> {t.novoJogo.configuracoes_iniciais}
              </button>
              <select value={modoDeMundo} onChange={event => setModoDeMundo(event.target.value as ModoDeMundo)} aria-label="Modo do mundo" className="h-11 rounded-xl border border-white/15 bg-black/70 px-3 text-[10px] font-bold uppercase text-white/75">
                <option value="original">Original</option><option value="mundo_real">Mundo Real</option><option value="seu_mundo">Seu Mundo</option>
              </select>
              {/* ⚠️ O SELETOR DE MODALIDADE NÃO MORA MAIS AQUI (1.0.335).
                  Pedido do usuário: "implemente a seleção de profissional,
                  sub-20, feminino ao invés de ficar no rodapé". Ele existia nos
                  DOIS lugares — nos botões do alto da coluna do clube e neste
                  `<select>` —, e dois controles para a mesma decisão é pior que
                  um no lugar errado: enfileirado entre "modo de mundo" e
                  "dívida inicial", o que decide o jogo inteiro parecia a
                  terceira configuração cinza da fila.

                  O que sobra aqui é o RÓTULO de quem entrou pelo menu principal
                  na carreira de atleta: ali a escolha já foi feita na tela
                  anterior, os botões do alto somem, e sem esta faixa o rodapé
                  não diria que carreira está sendo criada. */}
              {/* ── A ESPERA COM ROSTO (1.0.358) ────────────────────────────
                  Ela cobre a tela porque a criação NÃO pode ser interrompida no
                  meio: metade de uma carreira gravada é save quebrado. E diz em
                  que passo está, porque "carregando" sozinho, por dez segundos,
                  volta a parecer travado. */}
              {criando && (
                <div className="fixed inset-0 z-[120] grid place-items-center bg-black/85 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-4 px-6 text-center">
                    <span
                      className="h-10 w-10 animate-spin rounded-full border-2 border-white/15"
                      style={{ borderTopColor: cor1 }}
                    />
                    <p className="text-lg font-black text-white">{criando}</p>
                    <p className="max-w-sm text-[12px] leading-relaxed text-white/45">
                      {modalidade === "jogador" ? t.novoJogo.espera_do_atleta : t.novoJogo.espera_do_tecnico}
                    </p>
                  </div>
                </div>
              )}
              {modoTravado && (
                <span className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--brand)]/35 bg-[var(--brand)]/10 px-3 text-[10px] font-bold uppercase tracking-wide text-[var(--brand)]">
                  <User className="h-4 w-4" />
                  {MODALIDADE_DE_JOGADOR.titulo}
                </span>
              )}
              <select value={debtPreset} onChange={event => setDebtPreset(event.target.value as DebtPreset)} aria-label={t.novoJogo.divida_inicial} className="h-11 rounded-xl border border-white/15 bg-black/70 px-3 text-[10px] font-bold uppercase text-white/75">
                <option value="none">{t.novoJogo.sem_divida}</option><option value="light">{t.novoJogo.divida_leve}</option><option value="realistic">{t.novoJogo.divida_realista}</option><option value="high">{t.novoJogo.divida_alta}</option>
              </select>
              <div className="relative">
                {nameError && (
                  <p className="absolute -top-7 right-0 whitespace-nowrap text-[11px] font-medium text-red-400">
                    {modalidade === "jogador" ? t.novoJogo.digite_nome_do_atleta : t.novoJogo.digite_nome_do_treinador}
                  </p>
                )}
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: `${cor1}90` }} />
                {/* ⚠️ UM CAMPO, UM NOME. No modo atleta este input edita o
                    NOME DO ATLETA — o mesmo que aparece no painel de criação.
                    Antes eram dois campos parecidos com donos diferentes: a
                    pessoa preenchia o do painel, o do rodapé continuava vazio, e
                    "Iniciar carreira" voltava em silêncio. */}
                <input
                  ref={nameInputRef}
                  value={modalidade === "jogador" ? atleta.nome : managerName}
                  onChange={e => {
                    if (modalidade === "jogador") setAtleta(a => ({ ...a, nome: e.target.value }))
                    else setManagerName(e.target.value)
                    if (nameError) setNameError(false)
                  }}
                  placeholder={modalidade === "jogador" ? t.novoJogo.nome_do_atleta : t.novoJogo.nome_do_tecnico}
                  maxLength={32}
                  aria-invalid={nameError}
                  className="h-11 w-44 sm:w-56 rounded-xl pl-10 pr-3 text-sm text-white placeholder:text-white/30 focus:outline-none transition-all bg-black/55"
                  style={{ borderWidth: "1px", borderStyle: "solid", borderColor: nameError ? "#ef4444" : `${cor1}40` }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = nameError ? "#ef4444" : `${cor1}80`
                    e.currentTarget.style.boxShadow = nameError ? "0 0 0 3px rgba(239,68,68,0.15)" : `0 0 0 3px ${cor1}20`
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = nameError ? "#ef4444" : `${cor1}40`
                    e.currentTarget.style.boxShadow = "none"
                  }}
                />
              </div>

              <button
                onClick={handleStart}
                disabled={Boolean(criando)}
                aria-disabled={!isNameValid || Boolean(criando)}
                className="relative h-11 px-6 rounded-xl font-black text-sm tracking-[0.15em] uppercase text-white transition-all active:scale-[0.97] inline-flex items-center gap-2"
                style={{
                  background: `linear-gradient(135deg, ${cor1} 0%, ${cor2} 100%)`,
                  boxShadow: `0 6px 22px ${cor1}45`,
                  opacity: isNameValid ? 1 : 0.55,
                  filter: isNameValid ? "none" : "grayscale(0.4)",
                }}
              >
                <Play className="h-4 w-4" fill="currentColor" strokeWidth={0} />
                {criando ? t.novoJogo.criando : t.novoJogo.iniciar_carreira}
              </button>
            </div>
            )}

          </div>
        </footer>
      </div>

      {/* ── PAINEL DO ATLETA (1.0.358) ─────────────────────────────────────
          Separado das configurações iniciais a pedido do usuário. Aqui só se
          decide QUEM É VOCÊ EM CAMPO; as regras da carreira ficam no outro
          painel, e as duas portas não se misturam mais. */}
      {showAtletaSetup && modalidade === "jogador" && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4" onClick={() => setShowAtletaSetup(false)}>
          <section
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-[#091624] p-5 shadow-2xl sm:p-7"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="criar-atleta-titulo"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--brand)]">
                  {MODALIDADE_DE_JOGADOR.titulo}
                </p>
                <h3 id="criar-atleta-titulo" className="mt-1 text-2xl font-black text-white">{t.novoJogo.criar_atleta}</h3>
                <p className="mt-1 text-[12px] text-white/45">
                  {t.novoJogo.corpo_da_carreira}
                </p>
              </div>
              <button
                onClick={() => setShowAtletaSetup(false)}
                aria-label={t.novoJogo.fechar_criacao_do_atleta}
                className="rounded-xl border border-white/10 p-2 text-white/60 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

              <div className="mt-4 border-t border-white/10 pt-4">
                <h4 className="text-sm font-bold text-white">{t.novoJogo.quem_e_voce_em_campo}</h4>
                <p className="mt-0.5 text-[11px] text-white/45">
                  Começa como promessa: overall modesto e teto alto. Quem decide se você joga é o treinador —
                  e ele decide pela sua nota.
                </p>
                {/* A lista de clubes encolheu de propósito, e a tela precisa
                    dizer isso: sem esta linha, não achar o Flamengo no
                    carrossel parece defeito, não regra. */}
                <p className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-[11px] leading-relaxed text-amber-100/70">
                  Ninguém estreia num gigante: os clubes mais fortes de cada liga não aparecem no seletor.
                  Chegar a um deles é o que a carreira conquista — por proposta, depois das suas temporadas.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="text-[11px] text-white/55">
                    Nome
                    <input
                      value={atleta.nome}
                      onChange={e => setAtleta(a => ({ ...a, nome: e.target.value }))}
                      placeholder="Nome do atleta"
                      maxLength={28}
                      className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-black/50 px-3 text-sm text-white placeholder:text-white/25"
                    />
                  </label>
                  <label className="text-[11px] text-white/55">
                    Posição
                    <select
                      value={atleta.posicao}
                      onChange={e => setAtleta(a => ({ ...a, posicao: e.target.value as PosicaoDoAtleta }))}
                      className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-black/50 px-3 text-sm text-white"
                    >
                      {POSICOES_JOGAVEIS.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </label>
                  <label className="text-[11px] text-white/55">
                    Idade
                    <input
                      type="number" min={16} max={24} value={atleta.idade}
                      onChange={e => setAtleta(a => ({ ...a, idade: Math.max(16, Math.min(24, Number(e.target.value) || 18)) }))}
                      className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-black/50 px-3 text-sm text-white"
                    />
                  </label>
                  <label className="text-[11px] text-white/55">
                    Nacionalidade
                    <input
                      value={atleta.nacionalidade}
                      onChange={e => setAtleta(a => ({ ...a, nacionalidade: e.target.value }))}
                      maxLength={24}
                      className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-black/50 px-3 text-sm text-white"
                    />
                  </label>
                  <label className="text-[11px] text-white/55">
                    Pé preferido
                    <select
                      value={atleta.pePreferido}
                      onChange={e => setAtleta(a => ({ ...a, pePreferido: e.target.value as "direito" | "esquerdo" }))}
                      className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-black/50 px-3 text-sm text-white"
                    >
                      <option value="direito">Direito</option>
                      <option value="esquerdo">Esquerdo</option>
                    </select>
                  </label>
                  <label className="text-[11px] text-white/55">
                    Camisa
                    <input
                      type="number" min={1} max={99} value={atleta.numero}
                      onChange={e => setAtleta(a => ({ ...a, numero: Math.max(1, Math.min(99, Number(e.target.value) || 9)) }))}
                      className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-black/50 px-3 text-sm text-white"
                    />
                  </label>
                  {/* ARQUÉTIPO — a identidade do atleta (1.0.325). Dois
                      overalls 85 têm de jogar diferente: é ele que decide
                      quais atributos crescem mais rápido e que caminho de
                      especialização abre lá na frente. */}
                  <label className="text-[11px] text-white/55">
                    Perfil de jogo
                    <select
                      value={atleta.arquetipo}
                      onChange={e => setAtleta(a => ({ ...a, arquetipo: e.target.value as ArquetipoId }))}
                      className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-black/50 px-3 text-sm text-white"
                    >
                      {arquetiposDaPosicao(atleta.posicao).map(a => (
                        <option key={a.id} value={a.id}>{a.nome}</option>
                      ))}
                    </select>
                  </label>
                  {/* ORIGEM — a história de partida. Não é enfeite: mexe no
                      overall inicial, no teto e na personalidade. */}
                  <label className="text-[11px] text-white/55">
                    Como sua história começa
                    <select
                      value={atleta.origem}
                      onChange={e => setAtleta(a => ({ ...a, origem: e.target.value as OrigemDoAtleta }))}
                      className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-black/50 px-3 text-sm text-white"
                    >
                      {ORIGENS.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                    </select>
                  </label>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-white/40">
                  {ORIGENS.find(o => o.id === atleta.origem)?.efeito}{" "}
                  {arquetiposDaPosicao(atleta.posicao).find(a => a.id === atleta.arquetipo)?.descricao}{" "}
                  O seu TETO fica escondido: a comissão só arrisca uma faixa, e ela aperta conforme você joga.
                </p>
                <div className="hidden">
                </div>
              </div>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
              <span className="text-[11px] text-white/40">
                {t.novoJogo.regras_ficam_nas_configuracoes} <b className="text-white/60">{t.novoJogo.configuracoes_iniciais}</b>.
              </span>
              <button
                onClick={() => setShowAtletaSetup(false)}
                className="rounded-xl bg-[var(--brand)] px-5 py-2 text-sm font-black text-[var(--brand-ink)] transition-colors hover:bg-[#00d9b0]"
              >
                {t.novoJogo.pronto}
              </button>
            </div>
          </section>
        </div>
      )}

      {showInitialSettings && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4" onClick={() => setShowInitialSettings(false)}>
          <section className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl border border-white/10 bg-[#091624] p-5 sm:p-7 shadow-2xl" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="configuracoes-iniciais-titulo">
            <div className="flex items-start justify-between gap-4">
              {/* ⚠️ A versão vem de `useVersaoDoJogo`, não escrita à mão: este
                  rótulo ficou preso em "1.0.283" por vinte versões, dizendo a
                  quem criava carreira que o jogo era outro. É exatamente o que
                  o comentário de `lib/versao-do-jogo.ts` prevê que acontece com
                  número de versão repetido no código. */}
              <div><p className="text-xs font-black uppercase tracking-[.25em] text-emerald-400">Ultrafoot {versaoDoJogo}</p><h2 id="configuracoes-iniciais-titulo" className="mt-1 text-2xl font-black text-white">{t.novoJogo.configuracoes_iniciais}</h2><p className="mt-1 text-sm text-white/55">{t.novoJogo.estas_regras_ficam_vinculadas_a_esta}</p></div>
              <button onClick={() => setShowInitialSettings(false)} aria-label="Fechar configurações" className="rounded-xl border border-white/10 p-2 text-white/60 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

{/* MODALIDADE + O ATLETA. Estas são as decisões que não têm volta:
                depois da carreira criada não se troca de modo nem de corpo. */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4">
              <h3 className="text-sm font-bold text-white">
                {modoTravado ? MODALIDADE_DE_JOGADOR.titulo : "Tipo de carreira"}
              </h3>
              <div className={cn("mt-3 grid gap-2 sm:grid-cols-2", modoTravado && "hidden")}>
                {MODALIDADES.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setModalidade(m.id)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors",
                      modalidade === m.id
                        ? "border-[var(--brand)]/50 bg-[var(--brand)]/10"
                        : "border-white/10 bg-black/30 hover:border-white/25",
                    )}
                  >
                    <p className="text-sm font-bold text-white">{m.titulo}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-white/50">{m.resumo}</p>
                    <p className="mt-1 text-[10px] text-white/35">{m.detalhe}</p>
                  </button>
                ))}
              </div>

              {modalidade === "feminino" && (
                <p className="mt-3 rounded-lg border border-sky-400/20 bg-sky-400/[0.06] px-3 py-2 text-[11px] leading-relaxed text-sky-100/70">
                  {/* ⚠️ ESTE TEXTO JA MENTIU AO CONTRARIO. Ele dizia "a modalidade ainda nao tem
                      elenco real importado" DEPOIS de a 1.0.322 importar 182 clubes — negar o que
                      se tem e tao ruim quanto prometer o que nao se tem. Os numeros vem de
                      `data/seeds/elencos-femininos.json` (182 chaves, 4.741 atletas) contra os 282
                      clubes de `LIGAS_FEMININAS`; para reconferir, contar as chaves do seed. */}
                  {COUNTRIES_FEMININOS.length} países com futebol feminino jogável e {LIGAS_FEMININAS.length} ligas,
                  cada uma com o próprio calendário, a própria copa nacional e a continental da confederação.
                  182 dos 282 clubes têm elenco real (nome, posição e nacionalidade vindos da Wikipédia);
                  idade e overall são derivados do prestígio, e os 100 clubes restantes têm elenco gerado.
                </p>
              )}
              {modalidade === "sub20" && (
                <p className="mt-3 rounded-lg border border-sky-400/20 bg-sky-400/[0.06] px-3 py-2 text-[11px] leading-relaxed text-sky-100/70">
                  Você comanda a base do clube escolhido — Copinha, Brasileirão Sub-20 e Copa do Brasil Sub-20
                  (ou as competições de base do país do clube). Reputação alta abre propostas do futebol
                  profissional, e os atletas que você formar continuam sendo acompanhados depois de saírem.
                </p>
              )}

              {/* ⚠️ O ATLETA SAIU DAQUI (1.0.358, pedido: "separe os dados de
                  criar jogador de configurações iniciais").

                  Ele morava no meio das CONFIGURAÇÕES DA CARREIRA — perfil do
                  técnico, modo de mundo, dívida inicial, mesa de co-op — que são
                  regras do jogo, não o corpo de quem joga. Duas decisões de
                  natureza diferente na mesma caixa, e a mais importante do modo
                  atleta ficava abaixo da dobra de um painel de opções.

                  Agora ele tem painel próprio (`showAtletaSetup`), que é o que
                  abre ao entrar pela porta do atleta. Ver mais abaixo. */}
            </div>

                        {/* TÉCNICOS NA MESA. Fica aqui, junto das outras decisões de
                criação, porque é uma delas — e porque depois de a carreira
                existir não há como acrescentar alguém sem refazer o mundo. */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">{t.novoJogo.tecnicos_nesta_carreira}</h3>
                  <p className="mt-0.5 text-xs text-white/45">
                    Até {MAXIMO_DE_TECNICOS} pessoas no mesmo mundo, cada uma com seu clube.
                    A rodada só avança quando todas fecham as decisões.
                  </p>
                </div>
                {/* Leva para a TELA DE ESCOLHA, em vez de acrescentar uma linha
                    de formulário: escolher clube é escolher país, liga e divisão,
                    e isso não cabe num `<select>`. */}
                <button
                  type="button"
                  disabled={tecnicosDaMesa.length >= MAXIMO_DE_TECNICOS}
                  onClick={() => escolherClubeDoConvidado(null, "")}
                  className="shrink-0 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white hover:bg-white/[0.12] disabled:opacity-30"
                >
                  + Adicionar técnico
                </button>
              </div>

              <div className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--brand)]/25 bg-[var(--brand)]/[0.06] px-3 py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand)]">Você</span>
                <span className="text-sm text-white">{managerName.trim() || "Técnico"}</span>
                <span className="ml-auto text-right text-sm text-white/60">
                  {anfitriao.time?.nome ?? "—"}
                  <span className="block text-[10px] text-white/35">{anfitriao.pais.name} · {anfitriao.liga.short}</span>
                </span>
              </div>

              {convidados.map((tec, i) => (
                <div key={tec.id} className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
                  <input
                    value={tec.nome}
                    onChange={e => setConvidados(c => c.map((t, j) => j === i ? { ...t, nome: e.target.value } : t))}
                    placeholder={`Nome do técnico ${i + 2}`}
                    maxLength={24}
                    className="min-w-[140px] flex-1 rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-sm text-white placeholder:text-white/25"
                  />
                  <button
                    type="button"
                    onClick={() => escolherClubeDoConvidado(i, tec.nome)}
                    className="min-w-[170px] flex-1 rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-left text-sm text-white hover:border-[var(--brand)]/50"
                  >
                    {tec.clubeNome ?? tec.clubeCurto ?? "Escolher clube…"}
                    <span className="block text-[10px] text-white/35">
                      {tec.clubeCurto ? `${tec.paisNome ?? ""} · ${tec.ligaLabel ?? ""}` : "país, liga e clube"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConvidados(c => c.filter((_, j) => j !== i))}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 hover:border-red-500/40 hover:text-red-400"
                  >
                    Remover
                  </button>
                </div>
              ))}

              {errosDosTecnicos.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {errosDosTecnicos.map((erro, i) => (
                    <li key={i} className="text-xs text-red-400">{erro.mensagem}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <ConfigGroup title="Competições nacionais">
                <ConfigCheck label="Jogar campeonatos estaduais" checked={configuracoes283.jogarEstaduais} onChange={v => setConfiguracoes283(c => ({ ...c, jogarEstaduais: v }))} />
                <ConfigCheck label="Jogar competições regionais" checked={configuracoes283.jogarRegionais} onChange={v => setConfiguracoes283(c => ({ ...c, jogarRegionais: v }))} />
              </ConfigGroup>
              <ConfigGroup title="Competições internacionais">
                <ConfigCheck label="Competições internacionais de clubes" checked={configuracoes283.jogarInternacionaisClubes} onChange={v => setConfiguracoes283(c => ({ ...c, jogarInternacionaisClubes: v }))} />
                <ConfigCheck label="Competições e datas de seleções" checked={configuracoes283.jogarInternacionaisSelecoes} onChange={v => setConfiguracoes283(c => ({ ...c, jogarInternacionaisSelecoes: v }))} />
              </ConfigGroup>
              <ConfigGroup title="Sistema de salários">
                <ConfigRadio label="Mensal" checked={configuracoes283.sistemaSalarios === "mensal"} onChange={() => setConfiguracoes283(c => ({ ...c, sistemaSalarios: "mensal" }))} />
                <ConfigRadio label="Semanal" checked={configuracoes283.sistemaSalarios === "semanal"} onChange={() => setConfiguracoes283(c => ({ ...c, sistemaSalarios: "semanal" }))} />
              </ConfigGroup>
              <ConfigGroup title="Força dos jogadores">
                <ConfigRadio label="Individual — atributos detalhados" checked={configuracoes283.sistemaForca === "individual"} onChange={() => setConfiguracoes283(c => ({ ...c, sistemaForca: "individual" }))} />
                <ConfigRadio label="Clássico — nota geral" checked={configuracoes283.sistemaForca === "classico"} onChange={() => setConfiguracoes283(c => ({ ...c, sistemaForca: "classico" }))} />
              </ConfigGroup>
              <ConfigGroup title="Desempenho do computador">
                <select value={configuracoes283.perfilDesempenho} onChange={e => setConfiguracoes283(c => ({ ...c, perfilDesempenho: e.target.value as ConfiguracoesIniciais283["perfilDesempenho"] }))} className="w-full rounded-xl border border-white/15 bg-black/35 p-3 text-sm text-white">
                  <option value="automatico">{t.novoJogo.automatico_recomendado}</option><option value="economico">Econômico</option><option value="equilibrado">Equilibrado</option><option value="qualidade">{t.novoJogo.qualidade_maxima}</option>
                </select>
              </ConfigGroup>
              <ConfigGroup title="Temporada de início"><div className="rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-white">2026 <span className="ml-2 text-white/45">{t.novoJogo.base_de_dados_atual}</span></div></ConfigGroup>
              <div className="md:col-span-2">
                <ConfigGroup title="Perfil e histórico do treinador — FM26">
                  <p className="mb-4 text-xs text-white/45">{t.novoJogo.seu_passado_altera_reputacao_atributos_iniciai}</p>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <label className="grid gap-1 text-xs text-white/55">Carreira como jogador<select value={managerProfile26.nivelComoJogador} onChange={e => atualizarPerfil26({ nivelComoJogador: e.target.value as NivelComoJogador26 })} className="rounded-xl border border-white/15 bg-black/35 p-3 text-sm text-white"><option value="superastro">Superastro</option><option value="profissional">Profissional</option><option value="semiprofissional">Semiprofissional</option><option value="amador">Amador</option><option value="recreativo">Futebol recreativo</option></select></label>
                    <label className="grid gap-1 text-xs text-white/55">Experiência anterior<select value={managerProfile26.areaAnterior} onChange={e => atualizarPerfil26({ areaAnterior: e.target.value as AreaAnterior26 })} className="rounded-xl border border-white/15 bg-black/35 p-3 text-sm text-white"><option value="treinamento">Treinamento</option><option value="recrutamento">{t.novoJogo.operacoes_e_recrutamento}</option><option value="medica">Departamento médico</option><option value="midia">{t.novoJogo.midia_e_analise}</option><option value="arbitragem">Arbitragem</option><option value="nenhuma">Nenhuma</option></select></label>
                    <label className="grid gap-1 text-xs text-white/55">Reconhecimento anterior<select value={managerProfile26.relevanciaAnterior} onChange={e => atualizarPerfil26({ relevanciaAnterior: e.target.value as RelevanciaAnterior26 })} className="rounded-xl border border-white/15 bg-black/35 p-3 text-sm text-white"><option value="internacional">Internacional</option><option value="nacional">Nacional</option><option value="regional">Regional</option><option value="anonimo">Desconhecido</option></select></label>
                    <label className="grid gap-1 text-xs text-white/55">Licença<select value={managerProfile26.licenca} onChange={e => atualizarPerfil26({ licenca: e.target.value as LicencaTreinador26 })} className="rounded-xl border border-white/15 bg-black/35 p-3 text-sm text-white"><option value="pro">{t.novoJogo.licenca_pro}</option><option value="a">{t.novoJogo.licenca_a}</option><option value="b">{t.novoJogo.licenca_b}</option><option value="c">{t.novoJogo.licenca_c}</option><option value="nenhuma">{t.novoJogo.sem_licenca}</option></select></label>
                  </div>
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/55">Estilos ({managerProfile26.estilos.length}/3)</p>
                    <div className="flex flex-wrap gap-2">{([["tatico","Tático"],["motivador","Motivador"],["desenvolvedor","Desenvolvedor"],["disciplinador","Disciplinador"],["inovador","Inovador"],["gestor","Gestor"],["recrutador","Recrutador"],["fisico","Preparador físico"],["analista","Analista"]] as [EstiloTreinador26,string][]).map(([id,label]) => <button type="button" key={id} onClick={() => alternarEstilo26(id)} className={`rounded-full border px-3 py-2 text-xs font-bold ${managerProfile26.estilos.includes(id) ? "border-emerald-300 bg-emerald-400/15 text-emerald-200" : "border-white/10 bg-white/5 text-white/45"}`}>{label}</button>)}</div>
                  </div>
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/55">Personalidade ({managerProfile26.personalidades.length}/2)</p>
                    <div className="flex flex-wrap gap-2">{([["carismatico","Carismático"],["exigente","Exigente"],["calmo","Calmo"],["ambicioso","Ambicioso"],["leal","Leal"],["pragmatico","Pragmático"]] as [PersonalidadeTreinador26,string][]).map(([id,label]) => <button type="button" key={id} onClick={() => alternarPersonalidade26(id)} className={`rounded-full border px-3 py-2 text-xs font-bold ${managerProfile26.personalidades.includes(id) ? "border-cyan-300 bg-cyan-400/15 text-cyan-200" : "border-white/10 bg-white/5 text-white/45"}`}>{label}</button>)}</div>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">{Object.entries(managerProfile26.atributos).map(([nome, valor]) => <div key={nome} className="rounded-xl bg-black/25 p-3 text-center"><b className="text-lg text-emerald-300">{valor}</b><p className="mt-1 truncate text-[9px] uppercase text-white/35">{nome.replace(/([A-Z])/g, " $1")}</p></div>)}</div>
                </ConfigGroup>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3"><button onClick={() => { setConfiguracoes283(CONFIGURACOES_INICIAIS_283); setManagerProfile26(PERFIL_TREINADOR_26_PADRAO) }} className="rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-white/70">{t.novoJogo.restaurar_padrao}</button><button onClick={() => setShowInitialSettings(false)} className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-black">{t.novoJogo.aplicar_a_carreira}</button></div>
          </section>
        </div>
      )}

      {/* Teto de carreiras de quem não registrou. Aparece ANTES de comecar mais
          uma — nunca no meio de carreira nenhuma — e sai daqui por dois caminhos:
          apagar uma antiga (Carregar jogo) ou registrar. */}
      {limiteDeSaves && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/75 p-6" onClick={() => setLimiteDeSaves(false)}>
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0c14] p-6 text-center"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-white">
              Você já tem {LIMITE_SAVES_SEM_REGISTRO} carreiras salvas
            </h2>
            <p className="mt-2 text-sm text-white/60">
              Sem registro o jogo guarda {LIMITE_SAVES_SEM_REGISTRO} carreiras ao mesmo tempo. Apague uma antiga
              para abrir espaço, ou registre o jogo e tenha quantas quiser — junto com save na
              nuvem, FC Hub, editor de equipes e a Central de Atualizações.
            </p>
            <p className="mt-2 text-xs text-white/35">
              Nenhuma carreira sua é apagada ou interrompida por isso.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => hardNavigate(ROTA_DE_REGISTRO)}
                className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-black text-[var(--brand-ink)] transition-all hover:brightness-110"
              >
                Registrar o jogo
              </button>
              <button
                onClick={() => hardNavigate("/splash?menu=1")}
                className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/15"
              >
                Gerenciar carreiras
              </button>
              <button
                onClick={() => setLimiteDeSaves(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white/50 transition-colors hover:text-white"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function ConfigGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <fieldset className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><legend className="px-1 text-sm font-black uppercase tracking-wide text-amber-300">{title}</legend><div className="mt-2 space-y-3">{children}</div></fieldset>
}

function ConfigCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex cursor-pointer items-center gap-3 text-sm text-white/80"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-4 w-4 accent-emerald-500" />{label}</label>
}

function ConfigRadio({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return <label className="flex cursor-pointer items-center gap-3 text-sm text-white/80"><input type="radio" checked={checked} onChange={onChange} className="h-4 w-4 accent-emerald-500" />{label}</label>
}
