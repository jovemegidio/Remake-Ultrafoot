// COMISSÃO TÉCNICA — o auxiliar que lê o que o técnico não tem tempo de ler.
//
// ⚠️ SEM API, SEM REDE, SEM CUSTO. Isto NÃO é um modelo de linguagem: é análise
// determinística sobre o estado que o jogo já tem. A escolha foi deliberada — o
// Ultrafoot roda offline, e uma comissão que só funciona com internet e chave de
// API paga seria um recurso que falha justamente para quem joga no avião.
//
// A imersão vem de OUTRO lugar: cada parecer sai da boca do profissional que o
// daria de verdade. O preparador físico fala de desgaste, o médico de lesão, o
// olheiro de mercado, o analista do adversário. É o mesmo dado que estaria numa
// tabela, dito por quem tem autoridade sobre ele — e isso muda como se lê.
//
// REGRA DE OURO DESTE ARQUIVO: nenhum parecer sem número por trás. Recomendação
// genérica ("reforce o meio") é ruído; o que ajuda é "seu meio-campo é 4 pontos
// abaixo do resto do time e você tem 3 atletas para 4 vagas".

import { perfilDeElenco, necessidadeNaPosicao, setorDaPosicao, type AtletaDoElenco } from "@/lib/mercado-realista"

// ─── Quem fala ───────────────────────────────────────────────────────────────

export type MembroDaComissao =
  | "auxiliar"      // visão geral e escalação
  | "preparador"    // desgaste e rodízio
  | "medico"        // lesão e suspensão
  | "olheiro"       // mercado e base
  | "analista"      // adversário e desempenho
  | "diretor"       // dinheiro e contratos

export const MEMBROS: Record<MembroDaComissao, { nome: string; cargo: string }> = {
  auxiliar:   { nome: "Auxiliar técnico",   cargo: "Escalação e time titular" },
  preparador: { nome: "Preparador físico",  cargo: "Carga e recuperação" },
  medico:     { nome: "Departamento médico", cargo: "Lesões e disponibilidade" },
  olheiro:    { nome: "Olheiro-chefe",      cargo: "Mercado e categorias de base" },
  analista:   { nome: "Analista de desempenho", cargo: "Adversário e dados" },
  diretor:    { nome: "Diretoria",          cargo: "Contratos e finanças" },
}

export type Urgencia = "critico" | "atencao" | "sugestao"

export interface Parecer {
  id: string
  membro: MembroDaComissao
  urgencia: Urgencia
  titulo: string
  /** O porquê, com o número que sustenta a recomendação. */
  detalhe: string
  /** Para onde ir resolver, quando existe uma tela. */
  rota?: string
  rotuloAcao?: string
}

// ─── Entrada ─────────────────────────────────────────────────────────────────

export interface AtletaParaAnalise extends AtletaDoElenco {
  id: number
  nome: string
  energia: number
  forma: number
  titular: boolean
  lesionado: boolean
  jogosDeSuspensao: number
  /** Semana absoluta em que o contrato acaba (undefined = sem contrato no save). */
  fimDeContrato?: number
  potencial?: number
}

export interface EntradaDaComissao {
  elenco: readonly AtletaParaAnalise[]
  /** Semana absoluta corrente — para medir contrato a vencer. */
  semanaAtual: number
  /** Força do próximo adversário (0-100) e nome, quando há jogo marcado. */
  proximoAdversario?: { nome: string; forca: number; casa: boolean }
  /** Nível do próprio time, para comparar (0-100). */
  forcaDoTime?: number
  caixa: number
  saldoSemanal: number
  /** Últimos resultados, mais recente primeiro. */
  formaRecente?: ("V" | "E" | "D")[]
}

// ─── Limiares ────────────────────────────────────────────────────────────────
//
// Ficam nomeados e juntos de propósito: são as decisões editoriais da comissão,
// e o que separa um alerta útil de um alarme que o jogador aprende a ignorar.
const ENERGIA_CRITICA = 55        // abaixo disso, titular rende menos do que o reserva
const ENERGIA_ATENCAO = 70
const CONTRATO_ALERTA_SEMANAS = 26 // meio ano: ainda dá para renovar sem perder de graça
const NECESSIDADE_MINIMA = 0.35    // abaixo, o setor está atendido
const FORMA_RUIM = 45

/**
 * O parecer completo da comissão, ordenado por urgência.
 *
 * Puro e sem efeitos: recebe o estado, devolve a lista. Isso o torna testável
 * sem React e sem save — e é o que permite o `scripts/test-comissao-tecnica.ts`
 * cobrir cada regra isoladamente.
 */
export function analisarComComissao(entrada: EntradaDaComissao): Parecer[] {
  const { elenco, semanaAtual, proximoAdversario, caixa, saldoSemanal, formaRecente = [] } = entrada
  const pareceres: Parecer[] = []
  if (elenco.length === 0) return pareceres

  const disponiveis = elenco.filter(a => !a.lesionado && a.jogosDeSuspensao <= 0)
  const titulares = elenco.filter(a => a.titular)
  const perfil = perfilDeElenco(elenco)

  // ── MÉDICO: quem não pode entrar em campo ─────────────────────────────────
  const lesionadosEscalados = titulares.filter(a => a.lesionado)
  if (lesionadosEscalados.length > 0) {
    pareceres.push({
      id: "medico-lesionado-escalado",
      membro: "medico", urgencia: "critico",
      titulo: `${lesionadosEscalados.length} lesionado(s) na escalação`,
      detalhe: `${lesionadosEscalados.map(a => a.nome).join(", ")} não têm condições físicas. `
        + "Entrar assim aumenta o tempo de recuperação.",
      rota: "/elenco/gerenciamento", rotuloAcao: "Refazer escalação",
    })
  }
  const suspensosEscalados = titulares.filter(a => a.jogosDeSuspensao > 0)
  if (suspensosEscalados.length > 0) {
    pareceres.push({
      id: "medico-suspenso-escalado",
      membro: "medico", urgencia: "critico",
      titulo: `${suspensosEscalados.length} suspenso(s) na escalação`,
      detalhe: `${suspensosEscalados.map(a => a.nome).join(", ")} cumprem suspensão — impedidos pelo regulamento.`,
      rota: "/elenco/gerenciamento", rotuloAcao: "Refazer escalação",
    })
  }

  // ── PREPARADOR: desgaste ──────────────────────────────────────────────────
  const desgastados = titulares.filter(a => !a.lesionado && a.energia < ENERGIA_CRITICA)
  if (desgastados.length > 0) {
    // Só sugere trocar se HOUVER por quem trocar: recomendar poupar sem reserva
    // é empurrar o problema para o técnico.
    const substitutos = desgastados
      .map(a => {
        const banco = disponiveis
          .filter(b => !b.titular && setorDaPosicao(b.posicao) === setorDaPosicao(a.posicao) && b.energia > ENERGIA_ATENCAO)
          .sort((x, y) => y.overall - x.overall)[0]
        return banco ? { titular: a, banco } : null
      })
      .filter((x): x is { titular: AtletaParaAnalise; banco: AtletaParaAnalise } => Boolean(x))

    pareceres.push({
      id: "preparador-desgaste",
      membro: "preparador", urgencia: desgastados.length >= 3 ? "critico" : "atencao",
      titulo: `${desgastados.length} titular(es) abaixo de ${ENERGIA_CRITICA}% de energia`,
      detalhe: substitutos.length > 0
        ? substitutos.slice(0, 3).map(s =>
            `${s.titular.nome} (${s.titular.energia}%) → ${s.banco.nome} (${s.banco.energia}%, ${s.banco.overall})`,
          ).join(" · ")
        : `${desgastados.map(a => a.nome).join(", ")} — sem reserva descansado no setor. `
          + "Vale considerar rodízio nas próximas semanas.",
      rota: "/elenco/gerenciamento", rotuloAcao: "Ver elenco",
    })
  }

  // ── AUXILIAR: buracos na escalação ────────────────────────────────────────
  if (titulares.length !== 11 && titulares.length > 0) {
    pareceres.push({
      id: "auxiliar-onze-incompleto",
      membro: "auxiliar", urgencia: "critico",
      titulo: `Escalação com ${titulares.length} de 11`,
      detalhe: titulares.length < 11
        ? "Faltam titulares definidos — o motor completa sozinho, e nem sempre como você faria."
        : "Há mais de onze marcados como titulares.",
      rota: "/elenco/gerenciamento", rotuloAcao: "Ajustar",
    })
  }

  // Titular fora de forma com reserva melhor no mesmo setor.
  const trocasPorForma = titulares
    .filter(a => !a.lesionado && a.forma < FORMA_RUIM)
    .map(a => {
      const melhor = disponiveis
        .filter(b => !b.titular && setorDaPosicao(b.posicao) === setorDaPosicao(a.posicao)
          && b.forma > a.forma + 15 && b.overall >= a.overall - 4)
        .sort((x, y) => (y.overall + y.forma) - (x.overall + x.forma))[0]
      return melhor ? { a, melhor } : null
    })
    .filter((x): x is { a: AtletaParaAnalise; melhor: AtletaParaAnalise } => Boolean(x))
  if (trocasPorForma.length > 0) {
    pareceres.push({
      id: "auxiliar-forma",
      membro: "auxiliar", urgencia: "sugestao",
      titulo: "Mudança sugerida por momento de forma",
      detalhe: trocasPorForma.slice(0, 2).map(t =>
        `${t.a.nome} está em baixa (forma ${t.a.forma}); ${t.melhor.nome} vive fase melhor (${t.melhor.forma}).`,
      ).join(" "),
      rota: "/elenco/gerenciamento", rotuloAcao: "Ver elenco",
    })
  }

  // ── ANALISTA: o próximo adversário ────────────────────────────────────────
  if (proximoAdversario && typeof entrada.forcaDoTime === "number") {
    const dif = entrada.forcaDoTime - proximoAdversario.forca
    const leitura = dif >= 8 ? "favorito claro" : dif >= 3 ? "ligeiro favorito"
      : dif > -3 ? "jogo equilibrado" : dif > -8 ? "azarão" : "muito superior a você"
    const conselho = dif >= 8
      ? "Dá para impor o jogo desde o início; postura ofensiva rende."
      : dif <= -8
        ? "Time bem postado e transição rápida evita o placar elástico."
        : "Equilíbrio pede atenção à bola parada e ao primeiro tempo."
    pareceres.push({
      id: "analista-adversario",
      membro: "analista", urgencia: "sugestao",
      titulo: `Próximo: ${proximoAdversario.nome} — ${dif <= -8 ? "adversário " : ""}${leitura}`,
      detalhe: `Força ${proximoAdversario.forca} contra os seus ${entrada.forcaDoTime}`
        + `, ${proximoAdversario.casa ? "em casa" : "fora"}. ${conselho}`,
      rota: "/adversarios", rotuloAcao: "Estudar adversário",
    })
  }

  // Sequência ruim: só fala depois de três jogos, senão vira alarme por acaso.
  if (formaRecente.length >= 3) {
    const ultimos3 = formaRecente.slice(0, 3)
    if (ultimos3.every(r => r === "D")) {
      pareceres.push({
        id: "analista-sequencia",
        membro: "analista", urgencia: "atencao",
        titulo: "Três derrotas seguidas",
        detalhe: "A diretoria costuma reagir a sequências assim. Vale mexer na postura ou no time titular.",
        rota: "/taticas", rotuloAcao: "Rever táticas",
      })
    }
  }

  // ── OLHEIRO: onde o elenco pede reforço ───────────────────────────────────
  const POSICOES = ["GOL", "ZAG", "LD", "LE", "VOL", "MEI", "PD", "PE", "ATA"]
  const carencias = POSICOES
    .map(pos => ({ pos, n: necessidadeNaPosicao(perfil, pos) }))
    .filter(c => c.n > NECESSIDADE_MINIMA)
    .sort((a, b) => b.n - a.n)
  if (carencias.length > 0) {
    const pior = carencias[0]
    const setor = setorDaPosicao(pior.pos)
    pareceres.push({
      id: "olheiro-carencia",
      membro: "olheiro",
      urgencia: pior.n > 0.7 ? "atencao" : "sugestao",
      titulo: `Prioridade de reforço: ${carencias.slice(0, 3).map(c => c.pos).join(", ")}`,
      detalhe: `O setor ${setor} tem ${perfil.tamanhoPorSetor[setor]} atleta(s) e média abaixo do nível do time `
        + `(${Math.round(perfil.nivelDoTime)}). ${pior.pos} é a lacuna mais urgente.`,
      rota: "/mercado", rotuloAcao: "Buscar no mercado",
    })
  }

  // Elenco curto é problema mesmo com qualidade: 18 é o piso para uma temporada.
  if (disponiveis.length < 18) {
    pareceres.push({
      id: "olheiro-elenco-curto",
      membro: "olheiro", urgencia: "critico",
      titulo: `Só ${disponiveis.length} atletas disponíveis`,
      detalhe: "Abaixo de 18 o rodízio some e qualquer lesão vira desfalque sem reposição.",
      rota: "/mercado", rotuloAcao: "Contratar",
    })
  }

  // ── DIRETORIA: dinheiro e contratos ───────────────────────────────────────
  if (saldoSemanal < 0) {
    const semanas = caixa > 0 ? Math.floor(caixa / Math.abs(saldoSemanal)) : 0
    pareceres.push({
      id: "diretor-caixa",
      membro: "diretor",
      urgencia: semanas <= 8 ? "critico" : "atencao",
      titulo: semanas <= 0 ? "Caixa no vermelho" : `Caixa cobre ${semanas} semana(s)`,
      detalhe: `O clube perde no ritmo atual. Cortar folha ou vender ativo evita chegar ao limite.`,
      rota: "/financas", rotuloAcao: "Ver finanças",
    })
  }

  const aVencer = elenco.filter(a =>
    typeof a.fimDeContrato === "number" &&
    a.fimDeContrato - semanaAtual <= CONTRATO_ALERTA_SEMANAS &&
    a.fimDeContrato >= semanaAtual,
  ).sort((a, b) => b.overall - a.overall)
  if (aVencer.length > 0) {
    const chaves = aVencer.filter(a => a.overall >= perfil.nivelDoTime - 3)
    pareceres.push({
      id: "diretor-contratos",
      membro: "diretor",
      urgencia: chaves.length > 0 ? "atencao" : "sugestao",
      titulo: `${aVencer.length} contrato(s) acabando`,
      detalhe: chaves.length > 0
        ? `Entre eles, ${chaves.slice(0, 3).map(a => `${a.nome} (${a.overall})`).join(", ")} — `
          + "titulares que sairiam de graça."
        : "Nenhum titular na lista, mas renovar cedo custa menos.",
      rota: "/contratos", rotuloAcao: "Renovar",
    })
  }

  // ── OLHEIRO: joias prontas ────────────────────────────────────────────────
  const promessas = elenco.filter(a =>
    a.idade <= 21 && (a.potencial ?? 0) >= perfil.nivelDoTime + 5 && !a.titular,
  ).sort((a, b) => (b.potencial ?? 0) - (a.potencial ?? 0))
  if (promessas.length > 0) {
    pareceres.push({
      id: "olheiro-promessa",
      membro: "olheiro", urgencia: "sugestao",
      titulo: "Jovem com teto acima do elenco",
      detalhe: promessas.slice(0, 2).map(a =>
        `${a.nome}, ${a.idade} anos — ${a.overall} hoje, potencial ${a.potencial}. Minutos aceleram a evolução.`,
      ).join(" "),
      rota: "/elenco", rotuloAcao: "Ver elenco",
    })
  }

  const ordem: Record<Urgencia, number> = { critico: 0, atencao: 1, sugestao: 2 }
  return pareceres.sort((a, b) => ordem[a.urgencia] - ordem[b.urgencia])
}
