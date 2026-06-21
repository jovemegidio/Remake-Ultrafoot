"use client"

import { Inbox, MessagesSquare } from "lucide-react"
import { HubScreen, type HubCard } from "@/components/hub-screen"

const cards: HubCard[] = [
  {
    id: 1,
    title: "Caixa de Entrada",
    subtitle: "E-mails nao lidos",
    icon: Inbox,
    description: "Mensagens da diretoria, comissao tecnica e departamento de futebol do clube.",
    route: "/mensagens",
  },
  {
    id: 2,
    title: "Conversas com Atletas",
    subtitle: "Mensagens nao lidas",
    icon: MessagesSquare,
    description: "Converse diretamente com os jogadores do elenco e acompanhe o clima do vestiario.",
    route: "/mensagens?tab=atletas",
  },
]

export default function NotificacoesHubPage() {
  return (
    <HubScreen
      tagline="Caixa de entrada e mensagens"
      cards={cards}
      primaryActionLabel="Entrar em caixa de entrada"
      primaryActionRoute="/mensagens"
    />
  )
}
