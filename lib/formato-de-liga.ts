"use client"

// FORMATO DE LIGA EM DADOS.
//
// Os formatos de competição eram CÓDIGO: número de rebaixados, existência de
// playoff e fase de grupos ficavam embutidos em lib/national-competitions. Mudar
// a Série B de 4 para 2 rebaixados exigia editar lógica.
//
// Aqui os parâmetros viram dado. Deliberadamente NÃO copiei o modelo inteiro do
// Brasfoot (14 campos, incluindo coisas como `rebaixadoPeloGrupo` e
// `duasVoltasMataMataSobe`): a maior parte daquilo serve a formatos que o
// Ultrafoot não usa, e cada campo a mais é uma combinação a testar. Ficaram os
// seis que descrevem 95% das ligas reais.

export interface FormatoLiga {
  id: string
  nome: string
  /** Quantos clubes disputam. */
  times: number
  /** Turno e returno? false = turno único. */
  doisTurnos: boolean
  /** Quantos caem direto para a divisão de baixo. */
  rebaixadosDireto: number
  /** Quantos sobem direto. */
  promovidosDireto: number
  /**
   * Vagas decididas em playoff, ALÉM das diretas. 0 = não há playoff.
   * É o que diferencia a Série B brasileira (sem) do Championship inglês (com).
   */
  vagasPorPlayoff: number
  /** Fase de grupos antes do mata-mata (estaduais e copas usam). 0 = liga corrida. */
  grupos: number
  /** Classificados por grupo, quando há grupos. */
  classificadosPorGrupo: number
}

const PADRAO: Omit<FormatoLiga, "id" | "nome" | "times"> = {
  doisTurnos: true,
  rebaixadosDireto: 4,
  promovidosDireto: 4,
  vagasPorPlayoff: 0,
  grupos: 0,
  classificadosPorGrupo: 0,
}

/**
 * Formatos conhecidos. Quem não estiver aqui cai no padrão brasileiro de 20
 * clubes — que é o que o jogo já fazia antes, então nada regride.
 */
export const FORMATOS: Record<string, FormatoLiga> = {
  // BASE DA PIRAMIDE (divisoes de acesso). Formato eliminatorio: quatro grupos
  // regionais de cinco, dois avancam por grupo, e o mata-mata decide o acesso.
  // A tabela que o jogo joga e unica, de 20 — mesmo compromisso da Serie D.
  divisao_de_acesso: { id: "divisao_de_acesso", nome: "Divisao de Acesso", times: 20, ...PADRAO, doisTurnos: true, grupos: 4, classificadosPorGrupo: 2, rebaixadosDireto: 0, promovidosDireto: 4 },
  brasileirao_a: { id: "brasileirao_a", nome: "Brasileirão Série A", times: 20, ...PADRAO },
  brasileirao_b: { id: "brasileirao_b", nome: "Brasileirão Série B", times: 20, ...PADRAO },
  brasileirao_c: { id: "brasileirao_c", nome: "Brasileirão Série C", times: 20, ...PADRAO, rebaixadosDireto: 4, promovidosDireto: 4 },
  brasileirao_d: { id: "brasileirao_d", nome: "Brasileirão Série D", times: 64, ...PADRAO, doisTurnos: false, grupos: 8, classificadosPorGrupo: 2, rebaixadosDireto: 0, promovidosDireto: 4 },
  premier_league: { id: "premier_league", nome: "Premier League", times: 20, ...PADRAO, rebaixadosDireto: 3, promovidosDireto: 2 },
  championship: { id: "championship", nome: "Championship", times: 24, ...PADRAO, rebaixadosDireto: 3, promovidosDireto: 2, vagasPorPlayoff: 1 },
  la_liga: { id: "la_liga", nome: "La Liga", times: 20, ...PADRAO, rebaixadosDireto: 3, promovidosDireto: 2, vagasPorPlayoff: 1 },
  estadual_grande: { id: "estadual_grande", nome: "Estadual (16 clubes)", times: 16, ...PADRAO, doisTurnos: false, grupos: 4, classificadosPorGrupo: 2, rebaixadosDireto: 2, promovidosDireto: 2 },
  estadual_pequeno: { id: "estadual_pequeno", nome: "Estadual (8 clubes)", times: 8, ...PADRAO, doisTurnos: true, grupos: 0, rebaixadosDireto: 1, promovidosDireto: 1 },
}

export function formatoDaLiga(id: string | undefined): FormatoLiga {
  return (id && FORMATOS[id]) || FORMATOS.brasileirao_a
}

/** Total de rodadas do formato — útil para montar o calendário. */
export function rodadasDoFormato(f: FormatoLiga): number {
  if (f.grupos > 0) {
    const porGrupo = Math.max(2, Math.round(f.times / f.grupos))
    const faseGrupos = (porGrupo - 1) * (f.doisTurnos ? 2 : 1)
    // Mata-mata a partir dos classificados: log2 dos que passam.
    const passam = f.grupos * f.classificadosPorGrupo
    return faseGrupos + Math.ceil(Math.log2(Math.max(2, passam)))
  }
  return (f.times - 1) * (f.doisTurnos ? 2 : 1)
}

/** Posições que caem, para a tela pintar a zona de rebaixamento. */
export function zonaDeRebaixamento(f: FormatoLiga): number[] {
  const zona: number[] = []
  for (let i = 0; i < f.rebaixadosDireto; i++) zona.push(f.times - i)
  return zona
}

/** Posições que sobem direto. */
export function zonaDeAcesso(f: FormatoLiga): number[] {
  return Array.from({ length: f.promovidosDireto }, (_, i) => i + 1)
}

/** Posições que disputam o playoff de acesso (vazio quando não há). */
export function zonaDePlayoff(f: FormatoLiga): number[] {
  if (f.vagasPorPlayoff <= 0) return []
  const inicio = f.promovidosDireto + 1
  // 4 clubes disputam cada vaga de playoff — semifinal e final, como no Championship.
  return Array.from({ length: 4 * f.vagasPorPlayoff }, (_, i) => inicio + i)
}
