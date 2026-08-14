"use client"

import { useEffect, useRef } from "react"
import { isTransferWindowOpen, useGameEngine } from "@/lib/game-engine"
import { useNotifications } from "@/components/notifications-system"
import { formatCurrency } from "@/lib/currency"

/**
 * Ponte entre FINANCAS/OBRAS (game-engine) e a CENTRAL DE NOTIFICACOES.
 *
 * Antes, o aviso de "obra concluida" vivia DENTRO da pagina de infraestrutura —
 * so disparava se o jogador estivesse justamente nela quando a obra terminava.
 * E nao havia nenhum alerta financeiro. Esta ponte roda em toda tela (montada no
 * provider global) e cobre:
 *   - OBRA concluida (uma area saiu de infraUpgradesInProgress e subiu de nivel);
 *   - CAIXA no vermelho / saldo baixo (alerta financeiro), uma vez por virada de
 *     estado, sem repetir a cada semana.
 */
const NOME_AREA: Record<string, string> = {
  stadium: "Estádio",
  acoustics: "Acústica",
  pitch: "Gramado",
  training: "Centro de Treinamento",
  youth: "Base/Academia",
  medical: "Centro Médico",
  security: "Segurança",
  data: "Departamento de Dados",
}

/** Faixas de alerta de caixa, da pior para a melhor. */
type FaixaCaixa = "negativo" | "baixo" | "ok"
function faixaDoCaixa(saldo: number): FaixaCaixa {
  if (saldo < 0) return "negativo"
  if (saldo < 1_000_000) return "baixo"
  return "ok"
}

export function FinanceInfraNotificationsBridge() {
  const { addNotification } = useNotifications()
  // Via REF: a identidade de addNotification muda a cada aviso criado; como
  // dependencia de efeito realimentaria o proprio efeito (React #185).
  const notificar = useRef(addNotification)
  notificar.current = addNotification

  const infraEmObra = useGameEngine(s => s.infraUpgradesInProgress)
  const infraNiveis = useGameEngine(s => s.clubInfrastructure)
  const saldo = useGameEngine(s => s.balance)
  const semana = useGameEngine(s => s.currentWeek)

  const obrasVistas = useRef<Record<string, number>>({})
  const faixaAnterior = useRef<FaixaCaixa | null>(null)
  const janelaAberta = useRef<boolean | null>(null)
  const primed = useRef(false)

  // Primeira passada: fotografa o estado atual SEM notificar, para nao despejar
  // avisos de obras/saldo antigos ao abrir o jogo.
  useEffect(() => {
    if (primed.current) return
    primed.current = true
    const foto: Record<string, number> = {}
    for (const [areaId, up] of Object.entries(infraEmObra ?? {})) foto[areaId] = up.targetLevel
    obrasVistas.current = foto
    faixaAnterior.current = faixaDoCaixa(saldo)
    janelaAberta.current = isTransferWindowOpen(semana)
  }, [infraEmObra, saldo, semana])

  // JANELA DE TRANSFERENCIAS: pop-up quando ABRE (fechada -> aberta). O pedido e
  // um aviso a cada abertura; nao repetimos enquanto ela seguir aberta.
  useEffect(() => {
    if (!primed.current) return
    const aberta = isTransferWindowOpen(semana)
    const antes = janelaAberta.current
    janelaAberta.current = aberta
    if (antes === false && aberta) {
      notificar.current({
        type: "transfer", priority: "high",
        title: "Janela de transferências ABERTA",
        message: "O mercado está aberto: contrate reforços, negocie saídas e ajuste o elenco. Vendas de atletas da base também se concretizam agora.",
      })
    }
  }, [semana])

  // OBRA CONCLUIDA: uma area que estava em obra saiu do mapa e o nivel novo ja
  // consta em clubInfrastructure.
  useEffect(() => {
    if (!primed.current) return
    const antes = obrasVistas.current
    for (const areaId of Object.keys(antes)) {
      if (!infraEmObra[areaId]) {
        const nivel = infraNiveis[areaId] ?? antes[areaId]
        notificar.current({
          type: "news", priority: "medium",
          title: "Obra concluída",
          message: `${NOME_AREA[areaId] ?? areaId} chegou ao nível ${nivel}. A melhoria já está ativa no clube.`,
        })
      }
    }
    const atual: Record<string, number> = {}
    for (const [areaId, up] of Object.entries(infraEmObra ?? {})) atual[areaId] = up.targetLevel
    obrasVistas.current = atual
  }, [infraEmObra, infraNiveis])

  // ALERTA FINANCEIRO: dispara quando a faixa do caixa PIORA (ok->baixo,
  // baixo->negativo). Nao repete enquanto o jogador seguir na mesma faixa.
  useEffect(() => {
    if (!primed.current) return
    const faixa = faixaDoCaixa(saldo)
    const antes = faixaAnterior.current
    faixaAnterior.current = faixa
    if (antes === null || faixa === antes) return
    const ordem: FaixaCaixa[] = ["negativo", "baixo", "ok"]
    if (ordem.indexOf(faixa) >= ordem.indexOf(antes)) return // melhorou: sem alerta

    if (faixa === "negativo") {
      notificar.current({
        type: "system", priority: "urgent",
        title: "Caixa no vermelho",
        message: `O clube está com saldo negativo (${formatCurrency(saldo)}). Corte despesas ou venda atletas para reequilibrar as contas.`,
      })
    } else if (faixa === "baixo") {
      notificar.current({
        type: "system", priority: "high",
        title: "Caixa baixo",
        message: `O saldo do clube caiu para ${formatCurrency(saldo)}. Atenção com novas contratações e obras.`,
      })
    }
  }, [saldo])

  return null
}
