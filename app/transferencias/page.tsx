"use client"

import { Search, ArrowLeftRight, ClipboardList, Eye, History } from "lucide-react"
import { HubScreen, type HubCard } from "@/components/hub-screen"

const cards: HubCard[] = [
  {
    id: 1,
    title: "Buscar atletas",
    subtitle: "Procurar no mercado",
    icon: Search,
    description: "Procure por atletas especificos para comprar, contratar por emprestimo ou observar.",
    route: "/mercado",
  },
  {
    id: 2,
    title: "Central de Transf.",
    subtitle: "Propostas e negociacoes",
    icon: ArrowLeftRight,
    description: "Acompanhe propostas enviadas e recebidas e gerencie as negociacoes em andamento.",
    route: "/mercado?tab=central",
  },
  {
    id: 3,
    title: "Historico de Transferencias",
    subtitle: "Mundo todo",
    icon: History,
    description: "Confira as ultimas transferencias no mundo todo.",
    route: "/mercado?tab=historico",
  },
  {
    id: 4,
    title: "Relatorio de Observacao",
    subtitle: "Qualquer posicao",
    icon: ClipboardList,
    description: "Veja os alvos recomendados pela sua comissao tecnica e olheiros.",
    route: "/mercado?tab=relatorio",
  },
  {
    id: 5,
    title: "Olheiros",
    subtitle: "Observando",
    icon: Eye,
    description: "Gerencie seus olheiros e as regioes observadas para descobrir novos talentos.",
    route: "/mercado?tab=olheiros",
  },
]

export default function TransferenciasHubPage() {
  return (
    <HubScreen
      tagline="Mercado de transferencias"
      cards={cards}
      primaryActionLabel="Entrar em buscar atletas"
      primaryActionRoute="/mercado"
    />
  )
}
