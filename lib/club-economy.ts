// ECONOMIA DOS CLUBES — realista e diferenciada por DIVISAO e prestigio.
//
// O que a auditoria achou de irreal:
//   - Receita forcada a ser sempre >= 108% da folha (game-engine.ts:3904): todo
//     clube lucrava toda semana, por construcao. Ninguem operava no vermelho.
//   - Receita so em 4 degraus de prestigio, IGNORANDO a divisao: toda a Serie C
//     e D recebia o mesmo piso de 800k/semana (~R$42 mi/ano — irreal).
//   - Salario plano base*800: um jogador de Serie D "ganhava" ~R$166 mil/mes.
//
// Este modulo centraliza a economia por DIVISAO, com valores em R$/semana. A
// escala e RELATIVA e coerente: um gigante da Serie A opera na casa dos milhoes;
// um clube de Serie D, em dezenas de milhares — como na vida real.

/** Quanto uma divisao paga de salario, em relacao a Serie A (=1). */
const DIVISION_WAGE_FACTOR: Record<string, number> = {
  serie_a: 1.0, serie_b: 0.30, serie_c: 0.11, serie_d: 0.045,
  premier_league: 2.4, championship: 0.5,
  league_one_eng: 0.2, league_two_eng: 0.11,
  national_league_eng: 0.06, national_league_ns_eng: 0.035,
  la_liga: 1.9, la_liga_2: 0.4,
  primera_federacion_esp: 0.14, segunda_federacion_esp: 0.07,
  serie_a_ita: 1.6, serie_b_ita: 0.4,
  bundesliga: 1.7, bundesliga_2: 0.42,
  dritte_liga_ger: 0.16,
  ligue_1: 1.35, ligue_2: 0.35,
  national_fra: 0.13,
  primeira_liga: 0.8, liga_portugal_2: 0.28,
  liga_3_por: 0.1, campeonato_portugal: 0.05,
  eredivisie: 0.85, eerste_divisie: 0.28,
  scottish_prem: 0.6, scottish_champ: 0.18,
  scottish_league_one: 0.08, scottish_league_two: 0.045,
  super_lig: 0.7, tff_1_lig: 0.22,
  tff_2_lig: 0.08,
  pro_league_bel: 0.7, challenger_pro: 0.2,
  first_national_bel: 0.07,
  russian_prem: 0.9, russian_first: 0.25,
  saudi_pro: 1.4, saudi_first_div: 0.35,
  mls: 1.1, liga_mx: 0.95,
  liga_argentina: 0.5, primera_b_arg: 0.14,
  primera_a_col: 0.35, torneo_betplay: 0.11,
  primera_div_chi: 0.3, primera_b_chi: 0.1,
  primera_div_ury: 0.28, segunda_div_ury: 0.09,
  primera_a_ecu: 0.3, serie_b_ecu: 0.1,
  primera_div_per: 0.25, liga_2_per: 0.08,
  primera_div_bol: 0.18, copa_simon_bolivar: 0.06,
  primera_div_par: 0.22, division_intermedia_par: 0.07,
  primera_div_ven: 0.18, liga_futve_2: 0.06,
  super_league_gre: 0.45,
  super_league_2_gre: 0.12,
  superliga_den: 0.55, betinia_liga: 0.18,
  fortuna_liga_cze: 0.4, chance_narodni_liga: 0.14,
  premyer_liqa_aze: 0.28,
  eliteserien_nor: 0.48, obos_ligaen: 0.16,
  protathlima_cyp: 0.25, second_div_cyp: 0.08,
  premier_liga_kaz: 0.25,
  j_league: 0.9, j2_league: 0.28,
  k_league_1: 0.6, k_league_2: 0.18,
  chinese_super: 1.0, china_league_one: 0.25,
}
const DEFAULT_WAGE_FACTOR = 0.5

/**
 * SALARIO SEMANAL de um jogador (R$), por overall e divisao. A curva por overall
 * e super-linear — o craque custa muito mais que o titular mediano — e a divisao
 * escala o time todo. Serie D em milhares, Serie A em dezenas/centenas de milhar.
 */
export function playerSalaryWeekly(overall: number, division: string): number {
  const curva = Math.pow(Math.max(40, overall) / 50, 3.2) * 9000
  const fator = DIVISION_WAGE_FACTOR[division] ?? DEFAULT_WAGE_FACTOR
  return Math.max(700, Math.round(curva * fator))
}

/**
 * SALARIO SEMANAL do PRIMEIRO contrato de quem sobe da base (R$).
 *
 * Cria nao negocia como contratado pronto: parte da mesma curva do profissional
 * (por overall E por divisao) e leva o desconto de quem ainda tem tudo a provar.
 *
 * Por que existe como funcao propria: os dois caminhos que levam um garoto ao
 * elenco — `promoverDaBase` (o botao PROMOVER) e a reposicao de aposentados no
 * virar da temporada — calculavam o salario cada um do seu jeito, e nenhum dos
 * dois olhava a divisao. Numa Serie D (fator 0.045) o profissional de overall 58
 * ganha R$ 700/semana e o promovido saia com R$ 13.920 — vinte vezes mais que o
 * titular ao lado dele. Era o relato "salario dos juvenis".
 *
 * O piso e o MESMO do profissional (R$ 700): sem ele o desconto derrubaria o
 * garoto de divisao pequena para um salario simbolico.
 */
export function youthPromotionSalaryWeekly(overall: number, division: string): number {
  const DESCONTO_DE_CRIA = 0.6
  return Math.max(700, Math.round(playerSalaryWeekly(overall, division) * DESCONTO_DE_CRIA))
}

/** Valor de mercado (R$) — coerente com o salario/divisao. */
export function playerMarketValue(overall: number, division: string): number {
  const anualEquivalente = playerSalaryWeekly(overall, division) * 52
  // Multiplicador de valor sobe com o overall (ativo mais valioso, nao so caro).
  const mult = overall >= 85 ? 9 : overall >= 78 ? 6.5 : overall >= 70 ? 4.5 : 3
  return Math.round(anualEquivalente * mult)
}

/** Receita operacional semanal base por divisao (R$), ANTES do prestigio. Cobre
 *  TV, socios e receita comercial — a bilheteria e o patrocinio entram por fora. */
const DIVISION_INCOME_BASE: Record<string, number> = {
  // Calibrado para a receita OPERACIONAL cobrir ~1,2-1,6x a folha de um clube bem
  // gerido — a bilheteria e o patrocinio (por fora) fecham o lucro. Assim o
  // gigante lucra, mas apertar a folha (contratacoes caras) leva ao vermelho.
  serie_a: 1_050_000, serie_b: 340_000, serie_c: 110_000, serie_d: 35_000,
  premier_league: 4_200_000, championship: 620_000,
  league_one_eng: 210_000, league_two_eng: 115_000,
  national_league_eng: 62_000, national_league_ns_eng: 36_000,
  la_liga: 2_800_000, la_liga_2: 300_000,
  primera_federacion_esp: 115_000, segunda_federacion_esp: 58_000,
  serie_a_ita: 2_300_000, serie_b_ita: 300_000,
  bundesliga: 2_500_000, bundesliga_2: 320_000,
  dritte_liga_ger: 135_000,
  ligue_1: 1_800_000, ligue_2: 240_000,
  national_fra: 105_000,
  primeira_liga: 650_000, liga_portugal_2: 180_000,
  liga_3_por: 72_000, campeonato_portugal: 38_000,
  eredivisie: 720_000, eerste_divisie: 190_000,
  scottish_prem: 380_000, scottish_champ: 120_000,
  scottish_league_one: 54_000, scottish_league_two: 32_000,
  super_lig: 520_000, tff_1_lig: 145_000,
  tff_2_lig: 58_000,
  pro_league_bel: 480_000, challenger_pro: 135_000,
  first_national_bel: 52_000,
  russian_prem: 800_000, russian_first: 180_000,
  saudi_pro: 1_600_000, saudi_first_div: 230_000,
  mls: 1_050_000, liga_mx: 1_000_000,
  liga_argentina: 440_000, primera_b_arg: 105_000,
  primera_a_col: 270_000, torneo_betplay: 80_000,
  primera_div_chi: 230_000, primera_b_chi: 70_000,
  primera_div_ury: 190_000, segunda_div_ury: 60_000,
  primera_a_ecu: 220_000, serie_b_ecu: 70_000,
  primera_div_per: 185_000, liga_2_per: 55_000,
  primera_div_bol: 130_000, copa_simon_bolivar: 42_000,
  primera_div_par: 160_000, division_intermedia_par: 48_000,
  primera_div_ven: 125_000, liga_futve_2: 40_000,
  super_league_gre: 315_000,
  super_league_2_gre: 82_000,
  superliga_den: 390_000, betinia_liga: 120_000,
  fortuna_liga_cze: 285_000, chance_narodni_liga: 95_000,
  premyer_liqa_aze: 195_000,
  eliteserien_nor: 350_000, obos_ligaen: 110_000,
  protathlima_cyp: 175_000, second_div_cyp: 52_000,
  premier_liga_kaz: 180_000,
  j_league: 850_000, j2_league: 190_000,
  k_league_1: 440_000, k_league_2: 125_000,
  chinese_super: 950_000, china_league_one: 175_000,
}
const DEFAULT_INCOME_BASE = 300_000

/**
 * RECEITA OPERACIONAL SEMANAL (R$) por divisao e prestigio. Sem piso que garanta
 * lucro: um clube pode operar no vermelho se a folha superar a receita.
 */
export function weeklyIncomeFor(division: string, prestige: number): number {
  const base = DIVISION_INCOME_BASE[division] ?? DEFAULT_INCOME_BASE
  // prestigio 10 -> 0.63x; 50 -> 1.15x; 90 -> 1.67x. Diferencia gigante de medio.
  const mult = 0.5 + (Math.max(0, Math.min(100, prestige)) / 100) * 1.3
  return Math.round(base * mult)
}

/**
 * CUSTO OPERACIONAL SEMANAL — a despesa que NÃO encolhe com o elenco.
 *
 * O problema que isto resolve (auditoria 4.0): a única despesa recorrente era a
 * folha. Quando o técnico parava de agir, o elenco encolhia até o piso, a folha
 * despencava junto e o caixa crescia para sempre — 10 temporadas passivas
 * multiplicavam o caixa do Manchester City por 4,2 e o do ABC por 9,3. Não agir
 * era, literalmente, a jogada mais lucrativa do jogo.
 *
 * Estádio, centro de treinamento, base, viagens, comissão administrativa e
 * folha não-atleta existem tendo elenco de 30 ou de 18. São 22% da receita
 * recorrente do clube: pesa o suficiente para o caixa parado não render, e não
 * tanto que um clube bem tocado quebre.
 *
 * Escala pela MESMA régua da receita de propósito — assim a conta continua justa
 * na Série D e na Premier League, sem tabela nova para manter em dia.
 */
export const FRACAO_DO_CUSTO_OPERACIONAL = 0.22

export function custoOperacionalSemanal(division: string, prestige: number): number {
  return Math.round(weeklyIncomeFor(division, prestige) * FRACAO_DO_CUSTO_OPERACIONAL)
}

/** Premiacao de LIGA por posicao final (R$), creditada no fim da temporada. Antes
 *  aparecia no painel mas nunca entrava no caixa. Escala com a divisao. */
export function leaguePrizeMoney(division: string, position: number, size: number): number {
  const topPrize: Record<string, number> = {
    serie_a: 30_000_000, serie_b: 8_000_000, serie_c: 2_500_000, serie_d: 800_000,
    premier_league: 90_000_000, championship: 12_000_000,
    la_liga: 60_000_000, serie_a_ita: 45_000_000, bundesliga: 50_000_000,
    ligue_1: 35_000_000, saudi_pro: 40_000_000,
    primeira_liga: 18_000_000, eredivisie: 20_000_000,
    scottish_prem: 12_000_000, super_lig: 16_000_000,
    pro_league_bel: 13_000_000, russian_prem: 18_000_000,
    liga_argentina: 12_000_000, primera_a_col: 8_000_000,
    primera_div_chi: 6_000_000, primera_div_ury: 5_000_000,
    primera_a_ecu: 5_000_000, primera_div_per: 4_500_000,
    primera_div_bol: 3_000_000, primera_div_par: 3_500_000,
    primera_div_ven: 2_500_000, super_league_gre: 9_000_000,
    superliga_den: 10_000_000, fortuna_liga_cze: 8_000_000,
    premyer_liqa_aze: 4_000_000, eliteserien_nor: 8_000_000,
    protathlima_cyp: 3_500_000, premier_liga_kaz: 4_000_000,
    j_league: 18_000_000, k_league_1: 10_000_000,
    chinese_super: 16_000_000, mls: 22_000_000, liga_mx: 18_000_000,
  }
  const top = topPrize[division] ?? 5_000_000
  if (position < 1 || size < 1) return 0
  // Decai linearmente do campeao (100%) ao ultimo (~10%). Todo mundo leva algo
  // (cota de participacao), mas o campeao leva muito mais.
  const frac = 1 - ((position - 1) / Math.max(1, size - 1)) * 0.9
  return Math.round(top * frac)
}
