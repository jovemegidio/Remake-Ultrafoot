// FUTEBOL FEMININO — ligas, países, clubes, copas e calendário.
//
// O jogo dizia isto com todas as letras em `app/novo-jogo`: "este jogo não tem
// times femininos". Não era uma decisão de produto, era um buraco de dado — a
// máquina de carreira (calendário, tabela, copa, continental, mercado) nunca
// soube de gênero nenhum, ela sabe de DIVISÃO. Então a implementação inteira do
// modo feminino é dado: declarar as ligas, os clubes que as disputam, o tamanho
// oficial, a copa nacional e a competição continental de cada uma.
//
// ⚠️ ESTE MÓDULO NÃO IMPORTA `teams-data`. Ele é lido POR ele (a montagem dos
// `Team` acontece lá, onde o catálogo masculino existe para emprestar escudo,
// uniforme e cores). Só o TIPO vem de lá, e tipo não cria dependência em tempo
// de execução. Ver `construirTimesFemininos`.
//
// IDENTIDADE (as três regras que evitam o clube feminino atropelar o masculino):
//   1. `file_key` = `<file_key do masculino>__fem` — o sufixo é o que faz
//      `getEscudoUrl` e `getCamisaUrl` caírem no escudo/camisa do clube-mãe sem
//      duplicar um único arquivo de imagem;
//   2. `curto` ganha sufixo até não colidir com nenhum código masculino — a
//      tabela e o calendário são indexados por ele;
//   3. o ELENCO é separado por `file_key`, não pelo nome (1.0.335). O nome do
//      clube feminino é limpo ("Botafogo", não "Botafogo Feminino") porque é
//      ele que todas as telas mostram; quem impede `getPlayersByTeam` de
//      devolver o elenco MASCULINO é a guarda de `getPlayersForTeam` sobre o
//      sufixo `__fem`. Ver `construirTimesFemininos`.

import type { Regiao, Team } from "@/lib/teams-data"

/** Sufixo de `file_key`. Duplo `_` de propósito: nenhum clube real termina assim. */
export const SUFIXO_FEMININO = "__fem"

export type ConfederacaoFeminina = "CONMEBOL" | "UEFA" | "AFC" | "CONCACAF" | "OFC"

export interface ClubeFeminino {
  nome: string
  cidade: string
  estado?: string
  prestigio: number
  /**
   * `file_key` do clube MASCULINO equivalente. É de onde vêm escudo, uniforme,
   * cores e estádio. Ausente = clube que só existe no futebol feminino (as
   * franquias da NWSL, o Realidade Jovem, o Fleury 91): aí `cor1`/`cor2` são
   * obrigatórias, senão a identidade visual sai de um sorteio.
   */
  base?: string
  cor1?: string
  cor2?: string
}

export interface LigaFeminina {
  /** Id da divisão — a mesma chave que o motor usa para montar a liga. */
  id: string
  nome: string
  short: string
  pais: string
  codigoPais: string
  regiao: Regiao
  confederacao: ConfederacaoFeminina
  /** 1 = primeira divisão do país; 2 = divisão de acesso. */
  nivel: 1 | 2
  copaNacional: string
  continental: string | null
  continentalSecundaria?: string | null
  /** Só o Brasil disputa estadual, no feminino como no masculino. */
  temEstadual?: boolean
  /** Janela REAL da temporada (exibição — o motor roda por semana). */
  inicio: string
  fim: string
  /** Quantos sobem/descem. 0 nos dois = liga isolada nesta base. */
  sobe: number
  desce: number
  /**
   * Procedência do cadastro. `federation-snapshot` = composição conferida da
   * temporada corrente; `provisional` = divisão em que a composição real muda
   * todo ano e o que está aqui é a melhor aproximação. A tela de criação já
   * mostra isso ao jogador — mentir a procedência é pior do que não ter o dado.
   */
  procedencia: "federation-snapshot" | "provisional"
  clubes: ClubeFeminino[]
}

// ─── AS LIGAS ────────────────────────────────────────────────────────────────
//
// Toda liga tem número PAR de clubes. Não é estética: `buildRoundRobin` com
// número ímpar deixa um clube de folga por rodada, ninguém completa o
// turno-returno e a temporada nunca fecha (é o caso da Portuguesa, anotado em
// `completarLigaComPool`).

export const LIGAS_FEMININAS: LigaFeminina[] = [
  {
    id: "brasileirao_fem_a1", nome: "Brasileirão Feminino A1", short: "Brasileirão A1",
    pais: "Brasil", codigoPais: "BRA", regiao: "brasil", confederacao: "CONMEBOL", nivel: 1,
    copaNacional: "Copa do Brasil Feminina", continental: "Copa Libertadores Feminina",
    continentalSecundaria: null, temEstadual: true,
    inicio: "2026-03-08", fim: "2026-09-20", sobe: 0, desce: 2,
    procedencia: "federation-snapshot",
    clubes: [
      { nome: "Corinthians", cidade: "São Paulo", estado: "SP", prestigio: 93, base: "corinthians_bra" },
      { nome: "Palmeiras", cidade: "São Paulo", estado: "SP", prestigio: 89, base: "palmeiras" },
      { nome: "São Paulo", cidade: "São Paulo", estado: "SP", prestigio: 83, base: "saopaulo_bra" },
      { nome: "Cruzeiro", cidade: "Belo Horizonte", estado: "MG", prestigio: 85, base: "cruzeiro_bra" },
      { nome: "Flamengo", cidade: "Rio de Janeiro", estado: "RJ", prestigio: 82, base: "flarj" },
      { nome: "Internacional", cidade: "Porto Alegre", estado: "RS", prestigio: 80, base: "internacional_bra" },
      { nome: "Ferroviária", cidade: "Araraquara", estado: "SP", prestigio: 79, base: "ferroviaria_sp" },
      { nome: "Grêmio", cidade: "Porto Alegre", estado: "RS", prestigio: 77, base: "gremio" },
      { nome: "Atlético Mineiro", cidade: "Belo Horizonte", estado: "MG", prestigio: 76, base: "atleticomg_bra" },
      { nome: "Santos", cidade: "Santos", estado: "SP", prestigio: 75, base: "santos" },
      { nome: "Fluminense", cidade: "Rio de Janeiro", estado: "RJ", prestigio: 73, base: "flurj" },
      { nome: "Bahia", cidade: "Salvador", estado: "BA", prestigio: 72, base: "bahia" },
      { nome: "Red Bull Bragantino", cidade: "Bragança Paulista", estado: "SP", prestigio: 70, base: "bragantino_bra" },
      { nome: "Juventude", cidade: "Caxias do Sul", estado: "RS", prestigio: 66, base: "juventude" },
      { nome: "Realidade Jovem", cidade: "São José dos Campos", estado: "SP", prestigio: 60, cor1: "#0b4da2", cor2: "#ffffff" },
      { nome: "3B da Amazônia", cidade: "Manaus", estado: "AM", prestigio: 58, cor1: "#0f7a3d", cor2: "#f5c518" },
    ],
  },
  {
    id: "brasileirao_fem_a2", nome: "Brasileirão Feminino A2", short: "Brasileirão A2",
    pais: "Brasil", codigoPais: "BRA", regiao: "brasil", confederacao: "CONMEBOL", nivel: 2,
    copaNacional: "Copa do Brasil Feminina", continental: null, temEstadual: true,
    inicio: "2026-04-05", fim: "2026-08-30", sobe: 2, desce: 2,
    procedencia: "provisional",
    clubes: [
      { nome: "Botafogo", cidade: "Rio de Janeiro", estado: "RJ", prestigio: 68, base: "botafogorj_bra" },
      { nome: "Vasco da Gama", cidade: "Rio de Janeiro", estado: "RJ", prestigio: 67, base: "vasco" },
      { nome: "Athletico Paranaense", cidade: "Curitiba", estado: "PR", prestigio: 65, base: "atleticopr_bra" },
      { nome: "Sport Recife", cidade: "Recife", estado: "PE", prestigio: 63, base: "sport" },
      { nome: "Ceará", cidade: "Fortaleza", estado: "CE", prestigio: 62, base: "ceara_bra" },
      { nome: "Fortaleza", cidade: "Fortaleza", estado: "CE", prestigio: 62, base: "fortaleza" },
      { nome: "Vitória", cidade: "Salvador", estado: "BA", prestigio: 61, base: "vitoria" },
      { nome: "Coritiba", cidade: "Curitiba", estado: "PR", prestigio: 60, base: "coritiba_bra" },
      { nome: "Avaí Kindermann", cidade: "Caçador", estado: "SC", prestigio: 60, base: "avai_bra" },
      { nome: "Atlético Goianiense", cidade: "Goiânia", estado: "GO", prestigio: 58, cor1: "#c8102e", cor2: "#000000" },
      { nome: "Remo", cidade: "Belém", estado: "PA", prestigio: 57, cor1: "#0b2c5e", cor2: "#ffffff" },
      { nome: "Paysandu", cidade: "Belém", estado: "PA", prestigio: 56, base: "paysandu" },
      { nome: "Náutico", cidade: "Recife", estado: "PE", prestigio: 55, cor1: "#c8102e", cor2: "#ffffff" },
      { nome: "Real Brasília", cidade: "Brasília", estado: "DF", prestigio: 59, cor1: "#0a3d91", cor2: "#f5c518" },
      { nome: "Minas Brasília", cidade: "Brasília", estado: "DF", prestigio: 55, cor1: "#1b7a3d", cor2: "#ffffff" },
      { nome: "Doce Mel", cidade: "Ipiaú", estado: "BA", prestigio: 53, cor1: "#e2711d", cor2: "#1c1c1c" },
    ],
  },
  {
    id: "wsl_ing", nome: "Women's Super League", short: "WSL",
    pais: "Inglaterra", codigoPais: "ENG", regiao: "europa", confederacao: "UEFA", nivel: 1,
    copaNacional: "Women's FA Cup", continental: "UEFA Women's Champions League",
    continentalSecundaria: "UEFA Women's Europa Cup",
    inicio: "2025-09-05", fim: "2026-05-16", sobe: 0, desce: 1,
    procedencia: "federation-snapshot",
    clubes: [
      { nome: "Arsenal", cidade: "Londres", prestigio: 91, base: "arsenal" },
      { nome: "Chelsea", cidade: "Londres", prestigio: 93, base: "chelsea" },
      { nome: "Manchester City", cidade: "Manchester", prestigio: 88, base: "manchester_city" },
      { nome: "Manchester United", cidade: "Manchester", prestigio: 86, base: "manchester_united" },
      { nome: "Tottenham Hotspur", cidade: "Londres", prestigio: 78, base: "tottenham" },
      { nome: "Liverpool", cidade: "Liverpool", prestigio: 79, base: "liverpool" },
      { nome: "Aston Villa", cidade: "Birmingham", prestigio: 76, base: "aston_villa" },
      { nome: "Brighton & Hove Albion", cidade: "Brighton", prestigio: 74, base: "brighton" },
      { nome: "Everton", cidade: "Liverpool", prestigio: 73, base: "everton" },
      { nome: "West Ham United", cidade: "Londres", prestigio: 72, base: "west_ham" },
      { nome: "Leicester City", cidade: "Leicester", prestigio: 70, cor1: "#003090", cor2: "#fdbe11" },
      { nome: "London City Lionesses", cidade: "Londres", prestigio: 69, cor1: "#111827", cor2: "#e11d48" },
    ],
  },
  {
    id: "wsl2_ing", nome: "Women's Super League 2", short: "WSL 2",
    pais: "Inglaterra", codigoPais: "ENG", regiao: "europa", confederacao: "UEFA", nivel: 2,
    copaNacional: "Women's FA Cup", continental: null,
    inicio: "2025-09-07", fim: "2026-05-10", sobe: 1, desce: 1,
    procedencia: "provisional",
    clubes: [
      { nome: "Birmingham City", cidade: "Birmingham", prestigio: 67, cor1: "#0000ff", cor2: "#ffffff" },
      { nome: "Crystal Palace", cidade: "Londres", prestigio: 66, base: "crystal_palace" },
      { nome: "Sunderland", cidade: "Sunderland", prestigio: 65, base: "sunderland" },
      { nome: "Newcastle United", cidade: "Newcastle", prestigio: 68, base: "newcastle" },
      { nome: "Nottingham Forest", cidade: "Nottingham", prestigio: 64, base: "nottingham_forest" },
      { nome: "Charlton Athletic", cidade: "Londres", prestigio: 62, cor1: "#c8102e", cor2: "#ffffff" },
      { nome: "Sheffield United", cidade: "Sheffield", prestigio: 62, cor1: "#ee2737", cor2: "#000000" },
      { nome: "Southampton", cidade: "Southampton", prestigio: 61, cor1: "#d71920", cor2: "#ffffff" },
      { nome: "Ipswich Town", cidade: "Ipswich", prestigio: 60, cor1: "#0044a9", cor2: "#ffffff" },
      { nome: "Portsmouth", cidade: "Portsmouth", prestigio: 58, cor1: "#001489", cor2: "#ffffff" },
      { nome: "Bristol City", cidade: "Bristol", prestigio: 63, cor1: "#e21c38", cor2: "#ffffff" },
      { nome: "Durham", cidade: "Durham", prestigio: 59, cor1: "#0d2c54", cor2: "#f5c518" },
    ],
  },
  {
    id: "liga_f_esp", nome: "Liga F", short: "Liga F",
    pais: "Espanha", codigoPais: "ESP", regiao: "europa", confederacao: "UEFA", nivel: 1,
    copaNacional: "Copa de la Reina", continental: "UEFA Women's Champions League",
    continentalSecundaria: "UEFA Women's Europa Cup",
    inicio: "2025-09-06", fim: "2026-05-17", sobe: 0, desce: 2,
    procedencia: "federation-snapshot",
    clubes: [
      { nome: "Barcelona", cidade: "Barcelona", prestigio: 96, base: "barcelona" },
      { nome: "Real Madrid", cidade: "Madri", prestigio: 89, base: "real_madrid" },
      { nome: "Atlético de Madrid", cidade: "Madri", prestigio: 85, base: "atletico_madrid" },
      { nome: "Levante", cidade: "Valência", prestigio: 79, base: "levante_esp" },
      { nome: "Real Sociedad", cidade: "San Sebastián", prestigio: 78, base: "real_sociedad" },
      { nome: "Athletic Club", cidade: "Bilbao", prestigio: 77, base: "athletic_bilbao" },
      { nome: "Sevilla", cidade: "Sevilha", prestigio: 74, base: "sevilla" },
      { nome: "Valencia", cidade: "Valência", prestigio: 73, base: "valencia" },
      { nome: "Real Betis", cidade: "Sevilha", prestigio: 72, base: "real_betis" },
      { nome: "Espanyol", cidade: "Barcelona", prestigio: 70, base: "espanyol" },
      { nome: "Granada", cidade: "Granada", prestigio: 68, cor1: "#c8102e", cor2: "#ffffff" },
      { nome: "Deportivo La Coruña", cidade: "A Coruña", prestigio: 68, cor1: "#009de0", cor2: "#ffffff" },
      { nome: "Madrid CFF", cidade: "Madri", prestigio: 67, cor1: "#7b1fa2", cor2: "#ffffff" },
      { nome: "Levante Badalona", cidade: "Badalona", prestigio: 64, cor1: "#1565c0", cor2: "#e53935" },
      { nome: "Eibar", cidade: "Eibar", prestigio: 63, cor1: "#0a4d8c", cor2: "#c8102e" },
      { nome: "Tenerife", cidade: "Santa Cruz de Tenerife", prestigio: 65, cor1: "#0b3d91", cor2: "#ffffff" },
    ],
  },
  {
    id: "premiere_ligue_fra", nome: "Première Ligue", short: "Première Ligue",
    pais: "Franca", codigoPais: "FRA", regiao: "europa", confederacao: "UEFA", nivel: 1,
    copaNacional: "Coupe de France Féminine", continental: "UEFA Women's Champions League",
    continentalSecundaria: "UEFA Women's Europa Cup",
    inicio: "2025-09-06", fim: "2026-05-30", sobe: 0, desce: 2,
    procedencia: "federation-snapshot",
    clubes: [
      { nome: "Olympique Lyonnais", cidade: "Lyon", prestigio: 95, base: "lyon" },
      { nome: "Paris Saint-Germain", cidade: "Paris", prestigio: 90, base: "psg" },
      { nome: "Paris FC", cidade: "Paris", prestigio: 82, base: "paris_fra" },
      { nome: "Montpellier", cidade: "Montpellier", prestigio: 74, cor1: "#003da5", cor2: "#f47b20" },
      { nome: "Fleury 91", cidade: "Fleury-Mérogis", prestigio: 70, cor1: "#0f766e", cor2: "#ffffff" },
      { nome: "Dijon", cidade: "Dijon", prestigio: 68, cor1: "#c8102e", cor2: "#ffffff" },
      { nome: "Stade de Reims", cidade: "Reims", prestigio: 72, cor1: "#c8102e", cor2: "#ffffff" },
      { nome: "Nantes", cidade: "Nantes", prestigio: 69, base: "nantes" },
      { nome: "Strasbourg", cidade: "Estrasburgo", prestigio: 68, base: "strasbourg" },
      { nome: "Le Havre", cidade: "Le Havre", prestigio: 66, base: "le_havre" },
      { nome: "Olympique de Marseille", cidade: "Marselha", prestigio: 75, base: "marseille" },
      { nome: "Saint-Étienne", cidade: "Saint-Étienne", prestigio: 67, cor1: "#0a8a3c", cor2: "#ffffff" },
    ],
  },
  {
    id: "frauen_bundesliga", nome: "Frauen-Bundesliga", short: "Frauen-Bundesliga",
    pais: "Alemanha", codigoPais: "GER", regiao: "europa", confederacao: "UEFA", nivel: 1,
    copaNacional: "DFB-Pokal Frauen", continental: "UEFA Women's Champions League",
    continentalSecundaria: "UEFA Women's Europa Cup",
    inicio: "2025-09-12", fim: "2026-05-24", sobe: 0, desce: 2,
    procedencia: "federation-snapshot",
    clubes: [
      { nome: "Bayern de Munique", cidade: "Munique", prestigio: 92, base: "bayern_munich" },
      { nome: "Wolfsburg", cidade: "Wolfsburg", prestigio: 91, base: "wolfsburg" },
      { nome: "Eintracht Frankfurt", cidade: "Frankfurt", prestigio: 84, base: "eintracht_frankfurt" },
      { nome: "Bayer Leverkusen", cidade: "Leverkusen", prestigio: 78, base: "bayer_leverkusen" },
      { nome: "Hoffenheim", cidade: "Sinsheim", prestigio: 77, base: "hoffenheim" },
      { nome: "Werder Bremen", cidade: "Bremen", prestigio: 74, base: "werder_bremen" },
      { nome: "SC Freiburg", cidade: "Freiburg", prestigio: 75, base: "freiburg" },
      { nome: "RB Leipzig", cidade: "Leipzig", prestigio: 74, base: "rb_leipzig" },
      { nome: "1. FC Köln", cidade: "Colônia", prestigio: 71, base: "fckoln_ale" },
      { nome: "SGS Essen", cidade: "Essen", prestigio: 70, cor1: "#c8102e", cor2: "#ffffff" },
      { nome: "Union Berlin", cidade: "Berlim", prestigio: 68, base: "union_berlin" },
      { nome: "Carl Zeiss Jena", cidade: "Jena", prestigio: 65, cor1: "#0a3d2e", cor2: "#f5c518" },
      { nome: "Nürnberg", cidade: "Nuremberg", prestigio: 64, cor1: "#8b1a1a", cor2: "#ffffff" },
      { nome: "Hamburger SV", cidade: "Hamburgo", prestigio: 66, base: "hamburgo_ale" },
    ],
  },
  {
    id: "serie_a_fem_ita", nome: "Serie A Femminile", short: "Serie A Femminile",
    pais: "Italia", codigoPais: "ITA", regiao: "europa", confederacao: "UEFA", nivel: 1,
    copaNacional: "Coppa Italia Femminile", continental: "UEFA Women's Champions League",
    continentalSecundaria: "UEFA Women's Europa Cup",
    inicio: "2025-09-13", fim: "2026-05-10", sobe: 0, desce: 2,
    procedencia: "federation-snapshot",
    clubes: [
      { nome: "Juventus", cidade: "Turim", prestigio: 86, base: "juventus" },
      { nome: "Roma", cidade: "Roma", prestigio: 87, base: "roma" },
      { nome: "Internazionale", cidade: "Milão", prestigio: 82, base: "inter_milan" },
      { nome: "Milan", cidade: "Milão", prestigio: 80, base: "ac_milan" },
      { nome: "Fiorentina", cidade: "Florença", prestigio: 79, base: "fiorentina" },
      { nome: "Sassuolo", cidade: "Sassuolo", prestigio: 72, base: "sassuolo_it" },
      { nome: "Napoli", cidade: "Nápoles", prestigio: 71, base: "napoli" },
      { nome: "Lazio", cidade: "Roma", prestigio: 73, base: "lazio" },
      { nome: "Como", cidade: "Como", prestigio: 68, base: "como" },
      { nome: "Parma", cidade: "Parma", prestigio: 66, base: "parma" },
    ],
  },
  {
    id: "campeonato_fem_por", nome: "Campeonato Nacional Feminino", short: "Nacional Feminino",
    pais: "Portugal", codigoPais: "POR", regiao: "europa", confederacao: "UEFA", nivel: 1,
    copaNacional: "Taça de Portugal Feminina", continental: "UEFA Women's Champions League",
    continentalSecundaria: "UEFA Women's Europa Cup",
    inicio: "2025-09-13", fim: "2026-05-23", sobe: 0, desce: 2,
    procedencia: "federation-snapshot",
    clubes: [
      { nome: "Benfica", cidade: "Lisboa", prestigio: 87, base: "benfica" },
      { nome: "Sporting CP", cidade: "Lisboa", prestigio: 84, base: "sporting" },
      { nome: "Braga", cidade: "Braga", prestigio: 80, base: "braga" },
      { nome: "Famalicão", cidade: "Vila Nova de Famalicão", prestigio: 70, base: "famalicao" },
      { nome: "Torreense", cidade: "Torres Vedras", prestigio: 66, cor1: "#0b3d91", cor2: "#ffffff" },
      { nome: "Racing Power", cidade: "Rio Maior", prestigio: 65, cor1: "#1b998b", cor2: "#111827" },
      { nome: "Damaiense", cidade: "Amadora", prestigio: 62, cor1: "#c8102e", cor2: "#000000" },
      { nome: "Länk Vilaverdense", cidade: "Vila Verde", prestigio: 64, cor1: "#0f7a3d", cor2: "#ffffff" },
      { nome: "Ouriense", cidade: "Ourém", prestigio: 60, cor1: "#f5c518", cor2: "#1c1c1c" },
      { nome: "Marítimo", cidade: "Funchal", prestigio: 63, cor1: "#0f7a3d", cor2: "#c8102e" },
      { nome: "Valadares Gaia", cidade: "Vila Nova de Gaia", prestigio: 61, cor1: "#1565c0", cor2: "#ffffff" },
      { nome: "Estoril Praia", cidade: "Estoril", prestigio: 62, base: "estoril" },
    ],
  },
  {
    id: "eredivisie_fem", nome: "Eredivisie Vrouwen", short: "Eredivisie Vrouwen",
    pais: "Holanda", codigoPais: "NED", regiao: "europa", confederacao: "UEFA", nivel: 1,
    copaNacional: "KNVB Beker Vrouwen", continental: "UEFA Women's Champions League",
    continentalSecundaria: "UEFA Women's Europa Cup",
    inicio: "2025-09-05", fim: "2026-05-24", sobe: 0, desce: 0,
    procedencia: "federation-snapshot",
    clubes: [
      { nome: "Ajax", cidade: "Amsterdã", prestigio: 84, base: "ajax" },
      { nome: "PSV", cidade: "Eindhoven", prestigio: 82, base: "psv" },
      { nome: "Twente", cidade: "Enschede", prestigio: 83, base: "twente" },
      { nome: "Feyenoord", cidade: "Roterdã", prestigio: 76, base: "feyenoord" },
      { nome: "AZ", cidade: "Alkmaar", prestigio: 72, base: "az_alkmaar" },
      { nome: "Utrecht", cidade: "Utrecht", prestigio: 71, base: "fc_utrecht" },
      { nome: "Fortuna Sittard", cidade: "Sittard", prestigio: 69, base: "fortuna_sittard" },
      { nome: "Heerenveen", cidade: "Heerenveen", prestigio: 68, base: "heerenveen" },
      { nome: "PEC Zwolle", cidade: "Zwolle", prestigio: 66, base: "pec_zwolle" },
      { nome: "Excelsior", cidade: "Roterdã", prestigio: 63, cor1: "#c8102e", cor2: "#000000" },
      { nome: "ADO Den Haag", cidade: "Haia", prestigio: 65, cor1: "#f5c518", cor2: "#0b7a3d" },
      { nome: "Telstar", cidade: "Velsen", prestigio: 61, cor1: "#ffffff", cor2: "#111827" },
    ],
  },
  {
    id: "swpl_sco", nome: "Scottish Women's Premier League", short: "SWPL 1",
    pais: "Escocia", codigoPais: "SCO", regiao: "europa", confederacao: "UEFA", nivel: 1,
    copaNacional: "Scottish Women's Cup", continental: "UEFA Women's Champions League",
    inicio: "2025-08-17", fim: "2026-05-17", sobe: 0, desce: 2,
    procedencia: "provisional",
    clubes: [
      { nome: "Glasgow City", cidade: "Glasgow", prestigio: 78, cor1: "#0b3d91", cor2: "#f5c518" },
      { nome: "Rangers", cidade: "Glasgow", prestigio: 79, base: "rangers" },
      { nome: "Celtic", cidade: "Glasgow", prestigio: 80, base: "celtic" },
      { nome: "Hibernian", cidade: "Edimburgo", prestigio: 72, base: "hibernian" },
      { nome: "Heart of Midlothian", cidade: "Edimburgo", prestigio: 70, base: "hearts" },
      { nome: "Partick Thistle", cidade: "Glasgow", prestigio: 66, cor1: "#f5c518", cor2: "#c8102e" },
      { nome: "Motherwell", cidade: "Motherwell", prestigio: 64, base: "motherwell" },
      { nome: "Aberdeen", cidade: "Aberdeen", prestigio: 65, base: "aberdeen" },
      { nome: "Dundee United", cidade: "Dundee", prestigio: 63, cor1: "#f47b20", cor2: "#111827" },
      { nome: "Montrose", cidade: "Montrose", prestigio: 58, cor1: "#0b3d91", cor2: "#ffffff" },
      { nome: "Queen's Park", cidade: "Glasgow", prestigio: 59, cor1: "#111827", cor2: "#ffffff" },
      { nome: "Spartans", cidade: "Edimburgo", prestigio: 60, cor1: "#c8102e", cor2: "#111827" },
    ],
  },
  {
    id: "damallsvenskan", nome: "Damallsvenskan", short: "Damallsvenskan",
    pais: "Suecia", codigoPais: "SWE", regiao: "europa", confederacao: "UEFA", nivel: 1,
    copaNacional: "Svenska Cupen Damer", continental: "UEFA Women's Champions League",
    continentalSecundaria: "UEFA Women's Europa Cup",
    inicio: "2026-03-21", fim: "2026-11-08", sobe: 0, desce: 2,
    procedencia: "provisional",
    clubes: [
      { nome: "BK Häcken", cidade: "Gotemburgo", prestigio: 82, cor1: "#f5c518", cor2: "#111827" },
      { nome: "FC Rosengård", cidade: "Malmö", prestigio: 80, cor1: "#0b3d91", cor2: "#ffffff" },
      { nome: "Hammarby", cidade: "Estocolmo", prestigio: 78, cor1: "#0f7a3d", cor2: "#ffffff" },
      { nome: "Djurgården", cidade: "Estocolmo", prestigio: 74, cor1: "#1565c0", cor2: "#111827" },
      { nome: "Linköping", cidade: "Linköping", prestigio: 72, cor1: "#1565c0", cor2: "#ffffff" },
      { nome: "Kristianstad", cidade: "Kristianstad", prestigio: 70, cor1: "#c8102e", cor2: "#ffffff" },
      { nome: "Piteå", cidade: "Piteå", prestigio: 68, cor1: "#c8102e", cor2: "#111827" },
      { nome: "Vittsjö", cidade: "Vittsjö", prestigio: 67, cor1: "#0f7a3d", cor2: "#f5c518" },
      { nome: "IFK Norrköping", cidade: "Norrköping", prestigio: 66, cor1: "#1565c0", cor2: "#ffffff" },
      { nome: "Brommapojkarna", cidade: "Estocolmo", prestigio: 63, cor1: "#c8102e", cor2: "#111827" },
      { nome: "AIK", cidade: "Estocolmo", prestigio: 69, cor1: "#111827", cor2: "#f5c518" },
      { nome: "Malmö FF", cidade: "Malmö", prestigio: 68, cor1: "#0b3d91", cor2: "#ffffff" },
      { nome: "Alingsås", cidade: "Alingsås", prestigio: 60, cor1: "#0f7a3d", cor2: "#ffffff" },
      { nome: "Trelleborg", cidade: "Trelleborg", prestigio: 59, cor1: "#c8102e", cor2: "#ffffff" },
    ],
  },
  {
    id: "toppserien_nor", nome: "Toppserien", short: "Toppserien",
    pais: "Noruega", codigoPais: "NOR", regiao: "europa", confederacao: "UEFA", nivel: 1,
    copaNacional: "Copa da Noruega Feminina", continental: "UEFA Women's Champions League",
    continentalSecundaria: "UEFA Women's Europa Cup",
    inicio: "2026-03-28", fim: "2026-11-14", sobe: 0, desce: 2,
    procedencia: "provisional",
    clubes: [
      { nome: "Vålerenga", cidade: "Oslo", prestigio: 78, cor1: "#0b3d91", cor2: "#c8102e" },
      { nome: "Brann", cidade: "Bergen", prestigio: 79, cor1: "#c8102e", cor2: "#ffffff" },
      { nome: "Rosenborg", cidade: "Trondheim", prestigio: 74, cor1: "#111827", cor2: "#ffffff" },
      { nome: "LSK Kvinner", cidade: "Lillestrøm", prestigio: 76, cor1: "#f5c518", cor2: "#111827" },
      { nome: "Stabæk", cidade: "Bærum", prestigio: 70, cor1: "#1565c0", cor2: "#ffffff" },
      { nome: "Åsane", cidade: "Bergen", prestigio: 64, cor1: "#0f7a3d", cor2: "#ffffff" },
      { nome: "Arna-Bjørnar", cidade: "Bergen", prestigio: 65, cor1: "#c8102e", cor2: "#111827" },
      { nome: "Røa", cidade: "Oslo", prestigio: 63, cor1: "#0b3d91", cor2: "#f5c518" },
      { nome: "Kolbotn", cidade: "Kolbotn", prestigio: 66, cor1: "#111827", cor2: "#f5c518" },
      { nome: "Avaldsnes", cidade: "Avaldsnes", prestigio: 64, cor1: "#1565c0", cor2: "#ffffff" },
      { nome: "Molde", cidade: "Molde", prestigio: 68, cor1: "#0b6fbb", cor2: "#ffffff" },
      { nome: "Lyn", cidade: "Oslo", prestigio: 60, cor1: "#c8102e", cor2: "#ffffff" },
    ],
  },
  {
    id: "kvindeligaen_den", nome: "Kvindeligaen", short: "Kvindeligaen",
    pais: "Dinamarca", codigoPais: "DEN", regiao: "europa", confederacao: "UEFA", nivel: 1,
    copaNacional: "Copa da Dinamarca Feminina", continental: "UEFA Women's Champions League",
    inicio: "2025-08-16", fim: "2026-05-30", sobe: 0, desce: 2,
    procedencia: "provisional",
    clubes: [
      { nome: "HB Køge", cidade: "Køge", prestigio: 76, cor1: "#0b3d91", cor2: "#f5c518" },
      { nome: "Brøndby", cidade: "Brøndby", prestigio: 78, cor1: "#f5c518", cor2: "#0b3d91" },
      { nome: "Nordsjælland", cidade: "Farum", prestigio: 72, cor1: "#f47b20", cor2: "#111827" },
      { nome: "AGF", cidade: "Aarhus", prestigio: 70, cor1: "#ffffff", cor2: "#1565c0" },
      { nome: "Fortuna Hjørring", cidade: "Hjørring", prestigio: 74, cor1: "#c8102e", cor2: "#ffffff" },
      { nome: "Kolding Q", cidade: "Kolding", prestigio: 66, cor1: "#1565c0", cor2: "#ffffff" },
      { nome: "B.93", cidade: "Copenhague", prestigio: 63, cor1: "#0f7a3d", cor2: "#ffffff" },
      { nome: "Vejle", cidade: "Vejle", prestigio: 65, cor1: "#c8102e", cor2: "#111827" },
    ],
  },
  {
    id: "nwsl_usa", nome: "National Women's Soccer League", short: "NWSL",
    pais: "EUA", codigoPais: "USA", regiao: "americas", confederacao: "CONCACAF", nivel: 1,
    copaNacional: "NWSL Challenge Cup", continental: "CONCACAF W Champions Cup",
    inicio: "2026-03-13", fim: "2026-11-21", sobe: 0, desce: 0,
    procedencia: "federation-snapshot",
    clubes: [
      { nome: "Portland Thorns", cidade: "Portland", prestigio: 84, cor1: "#8b1a1a", cor2: "#111827" },
      { nome: "Seattle Reign", cidade: "Seattle", prestigio: 80, cor1: "#1b3f8b", cor2: "#a5d8ff" },
      { nome: "Gotham FC", cidade: "Nova Jersey", prestigio: 85, cor1: "#111827", cor2: "#e11d48" },
      { nome: "Washington Spirit", cidade: "Washington", prestigio: 84, cor1: "#0b1e3d", cor2: "#c8102e" },
      { nome: "Orlando Pride", cidade: "Orlando", prestigio: 86, cor1: "#4b2e83", cor2: "#f5c518" },
      { nome: "North Carolina Courage", cidade: "Cary", prestigio: 79, cor1: "#0b3d91", cor2: "#f5c518" },
      { nome: "Kansas City Current", cidade: "Kansas City", prestigio: 87, cor1: "#e11d48", cor2: "#0b1e3d" },
      { nome: "Chicago Stars", cidade: "Chicago", prestigio: 74, cor1: "#0b3d91", cor2: "#e11d48" },
      { nome: "Houston Dash", cidade: "Houston", prestigio: 73, cor1: "#f47b20", cor2: "#111827" },
      { nome: "Angel City", cidade: "Los Angeles", prestigio: 78, cor1: "#f9a8d4", cor2: "#111827" },
      { nome: "San Diego Wave", cidade: "San Diego", prestigio: 80, cor1: "#0b3d91", cor2: "#f9a8d4" },
      { nome: "Racing Louisville", cidade: "Louisville", prestigio: 72, cor1: "#4b2e83", cor2: "#ffffff" },
      { nome: "Bay FC", cidade: "San Jose", prestigio: 75, cor1: "#0f766e", cor2: "#111827" },
      { nome: "Utah Royals", cidade: "Salt Lake City", prestigio: 70, cor1: "#f5c518", cor2: "#0b1e3d" },
    ],
  },
  {
    id: "liga_mx_femenil", nome: "Liga MX Femenil", short: "Liga MX Femenil",
    pais: "Mexico", codigoPais: "MEX", regiao: "americas", confederacao: "CONCACAF", nivel: 1,
    copaNacional: "Copa MX Femenil", continental: "CONCACAF W Champions Cup",
    inicio: "2026-01-09", fim: "2026-11-16", sobe: 0, desce: 0,
    procedencia: "federation-snapshot",
    clubes: [
      { nome: "América", cidade: "Cidade do México", prestigio: 86, base: "club_america" },
      { nome: "Tigres UANL", cidade: "Monterrey", prestigio: 89, base: "tigres" },
      { nome: "Guadalajara", cidade: "Guadalajara", prestigio: 84, base: "chivas" },
      { nome: "Monterrey", cidade: "Monterrey", prestigio: 85, base: "monterrey" },
      { nome: "Cruz Azul", cidade: "Cidade do México", prestigio: 76, base: "cruz_azul" },
      { nome: "Pumas UNAM", cidade: "Cidade do México", prestigio: 75, base: "pumas" },
      { nome: "Toluca", cidade: "Toluca", prestigio: 74, base: "toluca" },
      { nome: "Pachuca", cidade: "Pachuca", prestigio: 80, base: "pachuca" },
      { nome: "León", cidade: "León", prestigio: 72, base: "leon" },
      { nome: "Necaxa", cidade: "Aguascalientes", prestigio: 70, base: "necaxa" },
      { nome: "Atlas", cidade: "Guadalajara", prestigio: 71, base: "atlas" },
      { nome: "Santos Laguna", cidade: "Torreón", prestigio: 73, base: "santos_laguna" },
      { nome: "Puebla", cidade: "Puebla", prestigio: 66, base: "puebla" },
      { nome: "Querétaro", cidade: "Querétaro", prestigio: 65, base: "queretaro" },
      { nome: "Tijuana", cidade: "Tijuana", prestigio: 68, base: "tijuana" },
      { nome: "Juárez", cidade: "Ciudad Juárez", prestigio: 66, base: "fc_juarez" },
      { nome: "Mazatlán", cidade: "Mazatlán", prestigio: 64, base: "mazatlan_fc" },
      { nome: "Atlético San Luis", cidade: "San Luis Potosí", prestigio: 65, base: "atletico_san_luis" },
    ],
  },
  {
    id: "liga_femenina_col", nome: "Liga Femenina BetPlay", short: "Liga Femenina",
    pais: "Colombia", codigoPais: "COL", regiao: "americas", confederacao: "CONMEBOL", nivel: 1,
    copaNacional: "Copa Colombia Femenina", continental: "Copa Libertadores Feminina",
    inicio: "2026-02-14", fim: "2026-06-28", sobe: 0, desce: 0,
    procedencia: "provisional",
    clubes: [
      { nome: "Santa Fe", cidade: "Bogotá", prestigio: 80, base: "santa_fe_col" },
      { nome: "América de Cali", cidade: "Cali", prestigio: 78, base: "america_cali" },
      { nome: "Atlético Nacional", cidade: "Medellín", prestigio: 76, base: "atletico_nacional" },
      { nome: "Deportivo Cali", cidade: "Cali", prestigio: 75, base: "deportivo_cali" },
      { nome: "Millonarios", cidade: "Bogotá", prestigio: 72, base: "millonarios" },
      { nome: "Independiente Medellín", cidade: "Medellín", prestigio: 71, base: "ind_medellin" },
      { nome: "Junior", cidade: "Barranquilla", prestigio: 70, base: "junior_baq" },
      { nome: "Bucaramanga", cidade: "Bucaramanga", prestigio: 68, base: "bucaramanga" },
      { nome: "Deportivo Pereira", cidade: "Pereira", prestigio: 66, base: "dep_pereira" },
      { nome: "Once Caldas", cidade: "Manizales", prestigio: 65, base: "once_caldas" },
      { nome: "Deportes Tolima", cidade: "Ibagué", prestigio: 67, base: "deportes_tolima" },
      { nome: "Deportivo Pasto", cidade: "Pasto", prestigio: 63, base: "dep_pasto" },
      { nome: "Alianza", cidade: "Valledupar", prestigio: 62, base: "alianza_fc_col" },
      { nome: "Fortaleza CEIF", cidade: "Bogotá", prestigio: 61, base: "fortaleza_ceif" },
      { nome: "Real Santander", cidade: "Floridablanca", prestigio: 60, cor1: "#0f7a3d", cor2: "#ffffff" },
      { nome: "Llaneros", cidade: "Villavicencio", prestigio: 59, cor1: "#f5c518", cor2: "#0b3d91" },
    ],
  },
  {
    id: "campeonato_fem_arg", nome: "Campeonato Feminino YPF", short: "Feminino YPF",
    pais: "Argentina", codigoPais: "ARG", regiao: "americas", confederacao: "CONMEBOL", nivel: 1,
    copaNacional: "Copa Argentina Femenina", continental: "Copa Libertadores Feminina",
    inicio: "2026-03-07", fim: "2026-11-29", sobe: 0, desce: 2,
    procedencia: "provisional",
    clubes: [
      { nome: "Boca Juniors", cidade: "Buenos Aires", prestigio: 84, base: "boca_juniors" },
      { nome: "River Plate", cidade: "Buenos Aires", prestigio: 82, base: "river_plate" },
      { nome: "UAI Urquiza", cidade: "Villa Lynch", prestigio: 78, cor1: "#0b3d91", cor2: "#f5c518" },
      { nome: "San Lorenzo", cidade: "Buenos Aires", prestigio: 74, base: "san_lorenzo" },
      { nome: "Racing", cidade: "Avellaneda", prestigio: 73, base: "racing_arg" },
      { nome: "Independiente", cidade: "Avellaneda", prestigio: 72, base: "independiente_arg" },
      { nome: "Belgrano", cidade: "Córdoba", prestigio: 68, base: "belgrano_cordoba" },
      { nome: "Estudiantes", cidade: "La Plata", prestigio: 69, base: "estudiantes_lp" },
      { nome: "Gimnasia", cidade: "La Plata", prestigio: 67, base: "gimnasia_la_plata" },
      { nome: "Rosario Central", cidade: "Rosário", prestigio: 68, base: "rosario_central" },
      { nome: "Newell's Old Boys", cidade: "Rosário", prestigio: 67, base: "newells_old_boys" },
      { nome: "Platense", cidade: "Vicente López", prestigio: 63, base: "platense" },
      { nome: "Lanús", cidade: "Lanús", prestigio: 65, base: "lanus_arg" },
      { nome: "Banfield", cidade: "Banfield", prestigio: 64, base: "banfield_arg" },
      { nome: "Huracán", cidade: "Buenos Aires", prestigio: 64, base: "huracan_arg" },
      { nome: "Vélez Sarsfield", cidade: "Buenos Aires", prestigio: 66, base: "velez_sarsfield" },
    ],
  },
  {
    id: "campeonato_fem_chi", nome: "Campeonato Feminino do Chile", short: "Femenino Chile",
    pais: "Chile", codigoPais: "CHI", regiao: "americas", confederacao: "CONMEBOL", nivel: 1,
    copaNacional: "Copa Chile Femenina", continental: "Copa Libertadores Feminina",
    inicio: "2026-03-14", fim: "2026-11-22", sobe: 0, desce: 2,
    procedencia: "provisional",
    clubes: [
      { nome: "Colo-Colo", cidade: "Santiago", prestigio: 82, base: "colo_colo" },
      { nome: "Universidad de Chile", cidade: "Santiago", prestigio: 80, base: "u_de_chile" },
      { nome: "Universidad Católica", cidade: "Santiago", prestigio: 76, base: "u_catolica_chi" },
      { nome: "Santiago Morning", cidade: "Santiago", prestigio: 74, cor1: "#111827", cor2: "#ffffff" },
      { nome: "Palestino", cidade: "Santiago", prestigio: 70, base: "palestino" },
      { nome: "Everton", cidade: "Viña del Mar", prestigio: 68, base: "everton_vina" },
      { nome: "Audax Italiano", cidade: "Santiago", prestigio: 67, base: "audax_italiano" },
      { nome: "Huachipato", cidade: "Talcahuano", prestigio: 66, base: "huachipato" },
      { nome: "Ñublense", cidade: "Chillán", prestigio: 65, base: "nublense" },
      { nome: "O'Higgins", cidade: "Rancagua", prestigio: 64, base: "ohiggins" },
      { nome: "Coquimbo Unido", cidade: "Coquimbo", prestigio: 63, base: "coquimbo_unido" },
      { nome: "Deportes Iquique", cidade: "Iquique", prestigio: 62, base: "dep_iquique" },
      { nome: "Cobresal", cidade: "El Salvador", prestigio: 61, base: "cobresal" },
      { nome: "Unión La Calera", cidade: "La Calera", prestigio: 60, base: "union_la_calera" },
      { nome: "Deportes Antofagasta", cidade: "Antofagasta", prestigio: 59, base: "dep_antofagasta" },
      { nome: "Deportes La Serena", cidade: "La Serena", prestigio: 58, base: "dep_la_serena" },
    ],
  },
  {
    id: "we_league_jpn", nome: "WE League", short: "WE League",
    pais: "Japao", codigoPais: "JPN", regiao: "asia", confederacao: "AFC", nivel: 1,
    copaNacional: "Copa da Imperatriz", continental: "AFC Women's Champions League",
    inicio: "2025-09-06", fim: "2026-05-24", sobe: 0, desce: 0,
    procedencia: "provisional",
    clubes: [
      { nome: "Urawa Reds", cidade: "Saitama", prestigio: 82, base: "urawa_reds" },
      { nome: "INAC Kobe Leonessa", cidade: "Kobe", prestigio: 80, cor1: "#c8102e", cor2: "#111827" },
      { nome: "Tokyo Verdy Beleza", cidade: "Tóquio", prestigio: 81, base: "tokyo_verdy" },
      { nome: "Nojima Stella", cidade: "Kanagawa", prestigio: 72, cor1: "#0b3d91", cor2: "#ffffff" },
      { nome: "Mynavi Sendai", cidade: "Sendai", prestigio: 74, cor1: "#f5c518", cor2: "#111827" },
      { nome: "Albirex Niigata", cidade: "Niigata", prestigio: 73, base: "albirex_niigata" },
      { nome: "Sanfrecce Hiroshima", cidade: "Hiroshima", prestigio: 72, base: "sanfrecce_hiroshima" },
      { nome: "Cerezo Osaka", cidade: "Osaka", prestigio: 71, base: "cerezo_osaka" },
      { nome: "Omiya Ardija Ventus", cidade: "Saitama", prestigio: 70, cor1: "#f47b20", cor2: "#0b3d91" },
      { nome: "JEF United Chiba", cidade: "Chiba", prestigio: 69, cor1: "#f5c518", cor2: "#0f766e" },
      { nome: "Sagan Tosu", cidade: "Tosu", prestigio: 66, base: "sagan_tosu" },
      { nome: "Gamba Osaka", cidade: "Osaka", prestigio: 68, base: "gamba_osaka" },
    ],
  },
  {
    id: "a_league_women_aus", nome: "A-League Women", short: "A-League Women",
    pais: "Australia", codigoPais: "AUS", regiao: "asia", confederacao: "AFC", nivel: 1,
    copaNacional: "Australia Cup Women", continental: "AFC Women's Champions League",
    inicio: "2025-11-01", fim: "2026-05-03", sobe: 0, desce: 0,
    procedencia: "provisional",
    clubes: [
      { nome: "Melbourne City", cidade: "Melbourne", prestigio: 78, cor1: "#7ec8e3", cor2: "#111827" },
      { nome: "Melbourne Victory", cidade: "Melbourne", prestigio: 76, cor1: "#0b3d91", cor2: "#ffffff" },
      { nome: "Sydney FC", cidade: "Sydney", prestigio: 77, cor1: "#0b3d91", cor2: "#87ceeb" },
      { nome: "Western Sydney Wanderers", cidade: "Sydney", prestigio: 72, cor1: "#c8102e", cor2: "#111827" },
      { nome: "Brisbane Roar", cidade: "Brisbane", prestigio: 71, cor1: "#f47b20", cor2: "#111827" },
      { nome: "Adelaide United", cidade: "Adelaide", prestigio: 68, cor1: "#c8102e", cor2: "#111827" },
      { nome: "Perth Glory", cidade: "Perth", prestigio: 67, cor1: "#4b2e83", cor2: "#f5c518" },
      { nome: "Canberra United", cidade: "Camberra", prestigio: 70, cor1: "#0f766e", cor2: "#ffffff" },
      { nome: "Central Coast Mariners", cidade: "Gosford", prestigio: 69, cor1: "#f5c518", cor2: "#0b1e3d" },
      { nome: "Newcastle Jets", cidade: "Newcastle", prestigio: 66, cor1: "#c8102e", cor2: "#111827" },
      { nome: "Wellington Phoenix", cidade: "Wellington", prestigio: 64, cor1: "#f5c518", cor2: "#111827" },
      { nome: "Western United", cidade: "Melbourne", prestigio: 65, cor1: "#0f7a3d", cor2: "#111827" },
    ],
  },
]

// ─── Índices ────────────────────────────────────────────────────────────────

const POR_ID = new Map(LIGAS_FEMININAS.map(liga => [liga.id, liga]))

/** É uma divisão do futebol feminino? (a pergunta que todo motor faz) */
export function ehDivisaoFeminina(divisao: string | undefined): boolean {
  return Boolean(divisao && POR_ID.has(divisao))
}

export function ligaFeminina(divisao: string | undefined): LigaFeminina | undefined {
  return divisao ? POR_ID.get(divisao) : undefined
}

/** Clube feminino? Vale para clube do catálogo e para nome de `file_key`. */
export function ehClubeFeminino(fileKey: string | undefined): boolean {
  return Boolean(fileKey?.endsWith(SUFIXO_FEMININO))
}

/** `file_key` do clube MASCULINO de onde saem escudo e uniforme. */
export function chaveDeAssetMasculina(fileKey: string): string {
  return fileKey.endsWith(SUFIXO_FEMININO) ? fileKey.slice(0, -SUFIXO_FEMININO.length) : fileKey
}

/** Tamanho oficial de cada liga feminina — alimenta `TAMANHO_OFICIAL_DA_LIGA`. */
export const TAMANHO_DAS_LIGAS_FEMININAS: Record<string, number> = Object.fromEntries(
  LIGAS_FEMININAS.map(liga => [liga.id, liga.clubes.length]),
)

/** Países com futebol feminino jogável, na ordem em que a tela deve mostrá-los. */
export const PAISES_COM_FUTEBOL_FEMININO = [...new Set(LIGAS_FEMININAS.map(l => l.codigoPais))]

/** As ligas de um país (primeira divisão antes da segunda). */
export function ligasFemininasDoPais(codigoPais: string): LigaFeminina[] {
  return LIGAS_FEMININAS.filter(l => l.codigoPais === codigoPais).sort((a, b) => a.nivel - b.nivel)
}

// ─── Montagem dos clubes ────────────────────────────────────────────────────

const semAcento = (s: string) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")

function slug(nome: string): string {
  return semAcento(nome).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
}

/** Código curto candidato: três letras do nome, sem acento e sem artigo. */
function codigoBase(nome: string): string {
  const limpo = semAcento(nome).toUpperCase().replace(/[^A-Z ]/g, " ").trim()
  const palavras = limpo.split(/\s+/).filter(p => p.length > 2 && !["DE", "DA", "DO", "THE", "FC", "CF", "SC", "AC"].includes(p))
  const fonte = palavras.join("") || limpo.replace(/\s+/g, "")
  return (fonte + "XXX").slice(0, 3)
}

/**
 * Monta os `Team` das ligas femininas.
 *
 * `resolverMasculino` e `codigosEmUso` são INJETADOS porque este módulo não pode
 * importar `teams-data` (seria circular) — quem chama é ele, que já tem o
 * catálogo e o pool na mão. Do clube masculino vêm cores, estádio, torcida e
 * cidade quando o dado feminino não disser outra coisa; o escudo e o uniforme
 * chegam pelo sufixo do `file_key`, sem duplicar um único arquivo.
 */
export function construirTimesFemininos(
  resolverMasculino: (fileKey: string) => Team | undefined,
  codigosEmUso: ReadonlySet<string>,
): Team[] {
  const usados = new Set(codigosEmUso)
  const times: Team[] = []

  for (const liga of LIGAS_FEMININAS) {
    for (const clube of liga.clubes) {
      const masculino = clube.base ? resolverMasculino(clube.base) : undefined
      // Código curto único no jogo INTEIRO: a tabela, o calendário e o motor
      // indexam por ele, e um código repetido com um clube masculino faria a
      // tela do time feminino desenhar o escudo do outro.
      let curto = `${codigoBase(clube.nome)}F`
      for (let n = 2; usados.has(curto); n++) curto = `${codigoBase(clube.nome)}F${n}`
      usados.add(curto)

      const chave = `${clube.base ?? slug(clube.nome)}${SUFIXO_FEMININO}`
      const cor1 = clube.cor1 ?? masculino?.cor1 ?? "#0b3d91"
      const cor2 = clube.cor2 ?? masculino?.cor2 ?? "#ffffff"

      times.push({
        // NOME LIMPO (1.0.335). Até aqui era `${clube.nome} Feminino`, e o
        // sufixo aparecia em toda tela — "Botafogo Feminino" na tabela, no
        // calendário, no cabeçalho e na escalação (pedido do usuário para
        // removê-lo). Ele nunca foi um rótulo: era a TRAVA que impedia o índice
        // curado de atletas, que é POR NOME, de devolver o elenco masculino
        // inteiro para o clube feminino.
        //
        // ⚠️ A trava não sumiu, MUDOU DE LUGAR: `getPlayersForTeam` agora fecha
        // as três fontes masculinas (índice curado, CSV de elenco real e
        // Transfermarkt) para quem tem `file_key` terminado em `__fem`. Se
        // alguém reabrir qualquer uma delas, o Corinthians feminino volta a
        // entrar em campo com o elenco masculino — o defeito que este sufixo
        // existia para evitar. Ver a nota em `lib/players-data.ts`.
        nome: clube.nome,
        curto,
        cidade: clube.cidade,
        estado: clube.estado ?? masculino?.estado ?? "",
        cor1, cor2,
        prestigio: clube.prestigio,
        // A torcida do feminino é uma fração da do masculino — é o que sustenta
        // bilheteria e receita coerentes com a realidade da modalidade.
        torcida: Math.round((masculino?.torcida ?? clube.prestigio * 12_000) * 0.06),
        estadio_cap: Math.max(1_500, Math.round((masculino?.estadio_cap ?? 12_000) * 0.22)),
        saldo: Math.round((masculino?.saldo ?? 8_000_000) * 0.12),
        file_key: chave,
        estadio_nome: masculino?.estadio_nome ?? `Estádio ${clube.nome}`,
        patrocinador: masculino?.patrocinador ?? "",
        escudo_url: "",
        divisao: liga.id,
        regiao: liga.regiao,
        pais: liga.pais,
        promotionEligible: liga.sobe > 0 || liga.desce > 0,
        dataQuality: liga.procedencia === "federation-snapshot" ? "federation-snapshot" : "provisional",
      })
    }
  }

  return times
}

// ─── Nomes de atleta ────────────────────────────────────────────────────────
//
// O gerador de elenco do jogo sorteia nome pelo PAÍS do clube. Sem esta tabela,
// o Corinthians feminino entraria em campo com "Lucas Silva" e "Pedro Costa" —
// o mesmo defeito que `nomes-por-pais` resolveu para a base masculina, agora do
// outro lado. Os sobrenomes são os mesmos do país; só os prenomes mudam.

interface ParDeNomes { pri: readonly string[]; ult: readonly string[] }

const FEMININOS_POR_PAIS: Record<string, ParDeNomes> = {
  brasil: {
    pri: ["Ana", "Bia", "Duda", "Gabi", "Júlia", "Letícia", "Larissa", "Camila", "Vitória", "Yasmin", "Tamires", "Jheniffer", "Kerolin", "Marta", "Adriana", "Isabela", "Nycole", "Rafa", "Millene", "Gio"],
    ult: ["Silva", "Santos", "Oliveira", "Lima", "Costa", "Ferreira", "Ribeiro", "Alves", "Carvalho", "Nascimento", "Gomes", "Martins", "Pereira", "Araújo", "Souza", "Rocha", "Barbosa", "Moraes", "Cardoso", "Pinto"],
  },
  argentina: {
    pri: ["Sofía", "Martina", "Camila", "Valentina", "Yamila", "Florencia", "Estefanía", "Agustina", "Julieta", "Micaela", "Milagros", "Aldana"],
    ult: ["González", "Rodríguez", "Fernández", "López", "Martínez", "Pérez", "Sosa", "Romero", "Álvarez", "Benítez", "Acosta", "Medina"],
  },
  espanha: {
    pri: ["Aitana", "Alexia", "Irene", "Lucía", "Mariona", "Salma", "Claudia", "Esther", "Ona", "Patri", "Jenni", "Athenea"],
    ult: ["García", "Martín", "Sánchez", "Ruiz", "Torres", "Navarro", "Molina", "Iglesias", "Vidal", "Serrano", "Castillo", "Ortega"],
  },
  inglaterra: {
    pri: ["Lauren", "Ella", "Grace", "Chloe", "Beth", "Lucy", "Millie", "Georgia", "Jess", "Alessia", "Niamh", "Maya"],
    ult: ["Smith", "Taylor", "Brown", "Wilson", "Davies", "Walker", "Hughes", "Bennett", "Clarke", "Foster", "Hayes", "Reid"],
  },
  franca: {
    pri: ["Léa", "Marie", "Amel", "Kadidiatou", "Sakina", "Delphine", "Selma", "Clara", "Élisa", "Maëlle", "Inès", "Océane"],
    ult: ["Martin", "Bernard", "Dubois", "Moreau", "Laurent", "Lefebvre", "Girard", "Fontaine", "Diallo", "Traoré", "Camara", "Rousseau"],
  },
  italia: {
    pri: ["Giulia", "Chiara", "Sofia", "Martina", "Valentina", "Cristiana", "Barbara", "Arianna", "Elisa", "Manuela", "Emma", "Alice"],
    ult: ["Rossi", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno", "Gallo", "Conti"],
  },
  alemanha: {
    pri: ["Lea", "Lena", "Klara", "Jule", "Sydney", "Laura", "Sara", "Giulia", "Nicole", "Sjoeke", "Selina", "Vivien"],
    ult: ["Müller", "Schmidt", "Weber", "Wagner", "Becker", "Hoffmann", "Schäfer", "Koch", "Richter", "Klein", "Wolf", "Neumann"],
  },
  portugal: {
    pri: ["Inês", "Carole", "Kika", "Diana", "Telma", "Fátima", "Andreia", "Joana", "Matilde", "Beatriz", "Marta", "Catarina"],
    ult: ["Silva", "Ferreira", "Pereira", "Sousa", "Fernandes", "Gonçalves", "Marques", "Lopes", "Ramos", "Teixeira", "Correia", "Almeida"],
  },
  "paises baixos": {
    pri: ["Lieke", "Vivianne", "Danielle", "Jill", "Sherida", "Esmee", "Wieke", "Damaris", "Kerstin", "Romée", "Chasity", "Marisa"],
    ult: ["de Jong", "van Dijk", "Bakker", "Visser", "Smit", "Meijer", "Mulder", "de Boer", "van Rijn", "Groenen", "Roord", "Beerensteyn"],
  },
  suecia: {
    pri: ["Fridolina", "Stina", "Hanna", "Magdalena", "Kosovare", "Filippa", "Rebecka", "Johanna", "Nathalie", "Elin", "Emma", "Amanda"],
    ult: ["Andersson", "Johansson", "Karlsson", "Nilsson", "Eriksson", "Larsson", "Olsson", "Persson", "Svensson", "Rolfö", "Blomqvist", "Sembrant"],
  },
  noruega: {
    pri: ["Ada", "Guro", "Caroline", "Ingrid", "Frida", "Karina", "Emilie", "Vilde", "Thea", "Julie", "Synne", "Marit"],
    ult: ["Hansen", "Johansen", "Olsen", "Larsen", "Andersen", "Nilsen", "Pedersen", "Kristiansen", "Berg", "Solberg", "Reiten", "Bøe"],
  },
  dinamarca: {
    pri: ["Pernille", "Signe", "Nadia", "Sofie", "Josefine", "Katrine", "Emma", "Amalie", "Mille", "Rikke", "Sanne", "Frederikke"],
    ult: ["Nielsen", "Jensen", "Hansen", "Andersen", "Pedersen", "Christensen", "Larsen", "Sørensen", "Rasmussen", "Madsen", "Harder", "Bruun"],
  },
  escocia: {
    pri: ["Erin", "Caroline", "Kirsty", "Rachel", "Claire", "Jenna", "Sam", "Lisa", "Nicola", "Emma", "Abbi", "Martha"],
    ult: ["Campbell", "Stewart", "Robertson", "McLean", "McGregor", "Fraser", "Murray", "Gordon", "Morrison", "Ferguson", "Cuthbert", "Weir"],
  },
  "estados unidos": {
    pri: ["Sophia", "Trinity", "Mallory", "Emily", "Lindsey", "Naomi", "Alyssa", "Crystal", "Rose", "Jaedyn", "Ashley", "Casey"],
    ult: ["Smith", "Johnson", "Williams", "Brown", "Jones", "Davis", "Miller", "Wilson", "Moore", "Rodman", "Horan", "Swanson"],
  },
  mexico: {
    pri: ["Charlyn", "Alicia", "Jacqueline", "Kenti", "Diana", "Lizbeth", "Stephany", "Karla", "Nicolette", "Rebeca", "Jimena", "Aerial"],
    ult: ["Hernández", "García", "Martínez", "López", "González", "Pérez", "Sánchez", "Ramírez", "Cruz", "Flores", "Ovalle", "Corral"],
  },
  colombia: {
    pri: ["Linda", "Catalina", "Leicy", "Mayra", "Daniela", "Manuela", "Ivonne", "Carolina", "Yoreli", "Gabriela", "Marcela", "Wendy"],
    ult: ["Caicedo", "Usme", "Santos", "Ramírez", "Arias", "Vanegas", "Montoya", "Bedoya", "Rincón", "Salazar", "Restrepo", "Ospina"],
  },
  chile: {
    pri: ["Christiane", "Yanara", "Karen", "Rosario", "Fernanda", "Javiera", "Camila", "Daniela", "Yastin", "Sonya", "Michelle", "Millaray"],
    ult: ["Endler", "Aedo", "Araya", "Balmaceda", "Pinilla", "Zamora", "Guerrero", "Lara", "Rojas", "Fuentes", "Navarrete", "Urrutia"],
  },
  japao: {
    pri: ["Yui", "Hina", "Mina", "Riko", "Saki", "Aoba", "Momoko", "Honoka", "Yuka", "Kiko", "Maika", "Hikaru"],
    ult: ["Sato", "Suzuki", "Takahashi", "Tanaka", "Watanabe", "Ito", "Yamamoto", "Nakamura", "Kobayashi", "Kato", "Ueki", "Miyazawa"],
  },
  australia: {
    pri: ["Sam", "Caitlin", "Ellie", "Hayley", "Steph", "Mary", "Cortnee", "Kyra", "Charlotte", "Emily", "Amy", "Tameka"],
    ult: ["Kerr", "Foord", "Carpenter", "Raso", "Catley", "Fowler", "Vine", "Cooney-Cross", "Gorry", "Hunt", "Sayer", "Yallop"],
  },
}

const NEUTRO_FEMININO: ParDeNomes = {
  pri: ["Anna", "Maria", "Elena", "Sara", "Nina", "Lara", "Eva", "Mila", "Alba", "Ivana", "Amira", "Zara"],
  ult: ["Novak", "Petrova", "Horvat", "Popescu", "Kovač", "Nowak", "Andersson", "Jansen", "Hassan", "Yilmaz", "Marković", "Nilsen"],
}

const APELIDOS_DE_PAIS: Record<string, string> = {
  "franca": "franca", "frança": "franca", "italia": "italia", "itália": "italia",
  "holanda": "paises baixos", "países baixos": "paises baixos", "paises baixos": "paises baixos",
  "inglaterra": "inglaterra", "espanha": "espanha", "alemanha": "alemanha",
  "portugal": "portugal", "brasil": "brasil", "argentina": "argentina",
  "suecia": "suecia", "suécia": "suecia", "noruega": "noruega", "dinamarca": "dinamarca",
  "escocia": "escocia", "escócia": "escocia", "eua": "estados unidos",
  "estados unidos": "estados unidos", "mexico": "mexico", "méxico": "mexico",
  "colombia": "colombia", "colômbia": "colombia", "chile": "chile",
  "japao": "japao", "japão": "japao", "australia": "australia", "austrália": "australia",
}

/** Nome completo FEMININO para o país, com o sorteio do chamador (determinismo). */
export function nomeDeAtletaFeminina(pais: string | undefined, sorteio: () => number): string {
  const chave = semAcento(pais ?? "").toLowerCase().trim()
  const par = FEMININOS_POR_PAIS[APELIDOS_DE_PAIS[chave] ?? chave] ?? NEUTRO_FEMININO
  return `${par.pri[Math.floor(sorteio() * par.pri.length)]} ${par.ult[Math.floor(sorteio() * par.ult.length)]}`
}

/** Listas de nome feminino do país — usada pelo preenchimento de elenco. */
export function nomesFemininosDoPais(pais: string | undefined): ParDeNomes {
  const chave = semAcento(pais ?? "").toLowerCase().trim()
  return FEMININOS_POR_PAIS[APELIDOS_DE_PAIS[chave] ?? chave] ?? NEUTRO_FEMININO
}

// ─── Competições femininas ──────────────────────────────────────────────────
//
// A tela de Competições resolve copa nacional e continental pela DIVISÃO
// (`lib/country-competitions`). Estas entradas alimentam aquele mapa — sem elas
// o clube feminino disputaria a "Copa Nacional" genérica, que é exatamente o
// defeito que a auditoria de 31/07 achou nas dezoito divisões masculinas.

export interface CompeticaoFemininaInternacional {
  id: string
  nomes: string[]
  inicio: string
  fim: string
  confederacao: ConfederacaoFeminina | "FIFA"
}

export const COMPETICOES_FEMININAS_INTERNACIONAIS: CompeticaoFemininaInternacional[] = [
  { id: "uwcl", nomes: ["UEFA Women's Champions League", "Champions League Feminina"], inicio: "2025-09-09", fim: "2026-05-23", confederacao: "UEFA" },
  { id: "uwel", nomes: ["UEFA Women's Europa Cup"], inicio: "2025-09-10", fim: "2026-05-09", confederacao: "UEFA" },
  { id: "libertadores_fem", nomes: ["Copa Libertadores Feminina", "CONMEBOL Libertadores Feminina"], inicio: "2026-10-02", fim: "2026-10-25", confederacao: "CONMEBOL" },
  { id: "concacaf_w", nomes: ["CONCACAF W Champions Cup"], inicio: "2025-08-19", fim: "2026-05-24", confederacao: "CONCACAF" },
  { id: "afc_wcl", nomes: ["AFC Women's Champions League"], inicio: "2025-10-06", fim: "2026-05-17", confederacao: "AFC" },
  // A Copa do Mundo Feminina de 2027 é no Brasil (24/jun a 25/jul). Fica aqui
  // porque a carreira feminina chega lá: é o horizonte da seleção.
  { id: "copa_mundo_fem", nomes: ["Copa do Mundo Feminina"], inicio: "2027-06-24", fim: "2027-07-25", confederacao: "FIFA" },
]
