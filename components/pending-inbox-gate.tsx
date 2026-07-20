"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { useNotifications } from "@/components/notifications-system"
import { hardNavigate } from "@/lib/hard-navigation"
import { useGameState } from "@/lib/save-system"

/**
 * Antes de entrar no escritório, resolve a caixa de entrada.
 *
 * O sino do cabeçalho abria um drawer que sumia a cada navegação: mensagens da
 * diretoria e propostas passavam despercebidas e o jogador seguia a temporada
 * sem responder. Agora, ao abrir `/` (escritório) ou `/pre-office` com algo não
 * lido, o jogo leva para a Central de Notificações primeiro.
 *
 * Regras que evitam que isto vire uma armadilha:
 *   - só redireciona UMA vez por sessão de tela (o ref impede o laço quando o
 *     jogador volta ao escritório sem ter lido tudo);
 *   - nunca redireciona a partir da própria central, nem de fluxos de partida;
 *   - só age depois que as notificações carregaram do disco (o provider hidrata
 *     de forma assíncrona no Tauri; sem esperar, o contador é 0 no primeiro
 *     render e o portão nunca dispararia).
 */
const ROTAS_COM_PORTAO = ["/", "/pre-office"]

export function PendingInboxGate() {
  const pathname = usePathname()
  const { unreadCount, notifications } = useNotifications()
  const { state } = useGameState()
  // sessionStorage, NAO useRef: hardNavigate faz reload completo e um ref
  // zerava a cada navegacao — o portao redirecionava SEMPRE e prendia o
  // jogador na central sem conseguir abrir o office (bug relatado). A chave
  // dura a sessao do app: cobra a caixa UMA vez por abertura do jogo.
  const GATE_KEY = "ultrafoot:inbox-gate-shown"

  useEffect(() => {
    // Notificações pertencem à CARREIRA: sem clube selecionado (splash, novo
    // jogo, sem-clube) não há caixa de entrada a cobrar.
    if (!state.selectedTeamShort) return
    if (!ROTAS_COM_PORTAO.includes(pathname)) return
    if (sessionStorage.getItem(GATE_KEY)) return
    // `notifications.length === 0` com unreadCount 0 pode ser "ainda carregando".
    // Só agimos quando há de fato algo não lido.
    if (unreadCount <= 0) return

    sessionStorage.setItem(GATE_KEY, "1")
    hardNavigate("/notificacoes")
  }, [pathname, unreadCount, notifications.length, state.selectedTeamShort])

  return null
}
