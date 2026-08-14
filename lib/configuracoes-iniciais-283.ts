export type SistemaSalarios283 = "mensal" | "semanal"
export type SistemaForca283 = "individual" | "classico"
export type PerfilDesempenho283 = "automatico" | "economico" | "equilibrado" | "qualidade"

export interface ConfiguracoesIniciais283 {
  versao: 1
  jogarEstaduais: boolean
  jogarRegionais: boolean
  jogarInternacionaisClubes: boolean
  jogarInternacionaisSelecoes: boolean
  sistemaSalarios: SistemaSalarios283
  sistemaForca: SistemaForca283
  perfilDesempenho: PerfilDesempenho283
  temporadaInicial: number
}

export const CONFIGURACOES_INICIAIS_283: ConfiguracoesIniciais283 = {
  versao: 1,
  jogarEstaduais: true,
  jogarRegionais: true,
  jogarInternacionaisClubes: true,
  jogarInternacionaisSelecoes: true,
  sistemaSalarios: "mensal",
  sistemaForca: "individual",
  perfilDesempenho: "automatico",
  temporadaInicial: 2026,
}

export function normalizarConfiguracoes283(valor?: Partial<ConfiguracoesIniciais283> | null): ConfiguracoesIniciais283 {
  return { ...CONFIGURACOES_INICIAIS_283, ...(valor ?? {}), versao: 1, temporadaInicial: 2026 }
}

type FixtureConfiguravel = { competition: string; competitionType: string }

/** Aplica as escolhas ao calendário real, sem apagar resultados já disputados. */
export function competicaoHabilitada283(fixture: FixtureConfiguravel, config?: Partial<ConfiguracoesIniciais283> | null) {
  const c = normalizarConfiguracoes283(config)
  const nome = fixture.competition.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  const regional = /regional|copa do nordeste|copa verde/.test(nome)
  if (regional) return c.jogarRegionais
  if (fixture.competitionType === "state") return c.jogarEstaduais
  if (fixture.competitionType === "continental") return c.jogarInternacionaisClubes
  if (fixture.competitionType === "fifa_break") return c.jogarInternacionaisSelecoes
  return true
}

/**
 * O motor mantém salário SEMANAL como unidade canônica para não corromper saves;
 * esta função só muda a apresentação.
 *
 * O fator é 4, e não 52/12: o teto salarial do clube (`excedeTetoSalarial` no
 * game-engine) compara folha semanal × 4 com o `wageBudget`. Usar 4,333 aqui
 * mostraria ao jogador um salário mensal que não fecha com a conta que a
 * diretoria faz para aprovar a contratação.
 */
export function salarioPorPeriodo283(salarioSemanal: number, sistema: SistemaSalarios283) {
  return sistema === "mensal" ? Math.round(salarioSemanal * 4) : Math.round(salarioSemanal)
}

/** Sufixo para acompanhar o valor na tela ("/sem" ou "/mês"). */
export function sufixoSalario283(sistema: SistemaSalarios283) {
  return sistema === "mensal" ? "/mês" : "/sem"
}

/**
 * Traduz a escolha da criação de carreira para o perfil que o resto do jogo usa.
 *
 * Só RESOLVE o nome; quem aplica é `applyPerformanceProfile` (components/
 * performance-profile). Esta função já gravou o localStorage por conta própria e
 * isso era um defeito de dois lados: não marcava a escolha como sendo DO JOGADOR
 * (então o detector automático passava por cima dela na abertura seguinte) e não
 * avisava o `performanceStore`, então o framer-motion continuava animando até a
 * página recarregar. Ter um único ponto de aplicação evita os dois.
 */
export function resolverPerfilDesempenho283(perfil: PerfilDesempenho283): "economy" | "balanced" | "quality" {
  if (perfil === "economico") return "economy"
  if (perfil === "qualidade") return "quality"
  if (perfil === "equilibrado") return "balanced"
  // Automático: máquina modesta cai no econômico.
  if (typeof navigator === "undefined") return "balanced"
  const nav = navigator as Navigator & { deviceMemory?: number }
  return (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4 ? "economy" : "balanced"
}
