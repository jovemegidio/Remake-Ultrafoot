"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { useNotifications } from "@/components/notifications-system"
import { hardNavigate } from "@/lib/hard-navigation"

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
  const jaRedirecionou = useRef(false)

  useEffect(() => {
    if (!ROTAS_COM_PORTAO.includes(pathname)) {
      // Saiu do escritório: libera o portão para a próxima entrada.
      jaRedirecionou.current = false
      return
    }
    if (jaRedirecionou.current) return
    // `notifications.length === 0` com unreadCount 0 pode ser "ainda carregando".
    // Só agimos quando há de fato algo não lido.
    if (unreadCount <= 0) return

    jaRedirecionou.current = true
    hardNavigate("/notificacoes")
  }, [pathname, unreadCount, notifications.length])

  return null
}
