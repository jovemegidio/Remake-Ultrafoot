"use client"

// AMISTOSOS DE PREPARAÇÃO da seleção. Rota própria porque /amistosos é a tela de
// amistosos de CLUBE — ela monta a partida ao vivo com dois clubes do banco e,
// no modo seleção, não teria elenco de clube para carregar.

import { Swords } from "lucide-react"
import { NationalPageShell } from "@/components/national/national-page-shell"
import { NationalFriendlies } from "@/components/national/national-friendlies"

export default function AmistososSelecaoPage() {
  return (
    <NationalPageShell
      title="Amistosos de preparação"
      subtitle="teste a convocação antes da janela FIFA"
      icon={Swords}
    >
      {nationalTeam => <NationalFriendlies nationalTeam={nationalTeam} />}
    </NationalPageShell>
  )
}
