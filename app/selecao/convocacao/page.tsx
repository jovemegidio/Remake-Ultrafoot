"use client"

// Tela de CONVOCAÇÃO — o "elenco" da seleção. No modo seleção o /elenco do clube
// não faz sentido (a seleção não tem elenco fixo), então é aqui que o técnico
// monta a lista que vai a campo.

import { Users } from "lucide-react"
import { NationalPageShell } from "@/components/national/national-page-shell"
import { NationalSquadManager } from "@/components/national/national-squad"

export default function ConvocacaoPage() {
  return (
    <NationalPageShell
      title="Convocação"
      subtitle="a lista que entra em campo pela seleção"
      icon={Users}
    >
      {nationalTeam => <NationalSquadManager nationalTeam={nationalTeam} />}
    </NationalPageShell>
  )
}
