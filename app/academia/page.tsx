"use client"

// A ACADEMIA — treino, base e preparacao fisica atras de uma porta so.
//
// Nome da referencia (PDF Ultra26, p.4: "Academia" no menu do topo). Junta o
// que antes eram tres entradas separadas na secao "Elenco" do menu (W):
// Treinamento, Juniores e Performance Center. Nenhuma das tres foi apagada — o
// Performance Center, em particular, e a UNICA porta para as "Fases do jogo",
// o planejamento plurianual e o Data Hub, e tira-lo do menu deixaria quatro
// abas sem entrada nenhuma (ver o comentario em components/game-header.tsx).
//
// Os rotulos sao chaves de traducao pelo mesmo motivo do hub do escritorio: a
// catraca de scripts/qa-traducao.mjs nao deixa tela nova nascer chumbada.

import { useMemo } from "react"
import { Dumbbell, Sprout, HeartPulse, ClipboardList, Users } from "lucide-react"
import { HubScreen, type HubCard } from "@/components/hub-screen"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { hardNavigate } from "@/lib/hard-navigation"
import { useTranslation } from "@/lib/i18n"

export default function AcademiaHubPage() {
  const t = useTranslation()

  useTelaGamepad({ aoVoltar: () => hardNavigate("/"), contexto: "GLOBAL" })

  const cards: HubCard[] = useMemo(() => [
    {
      id: 1,
      title: t.academiaHub.treinamento,
      subtitle: t.academiaHub.a_semana_de_trabalho,
      icon: Dumbbell,
      description: t.academiaHub.treinamento_desc,
      route: "/treinamento",
    },
    {
      id: 2,
      title: t.academiaHub.plano_de_treino,
      subtitle: t.academiaHub.automatico_ou_manual,
      icon: ClipboardList,
      description: t.academiaHub.plano_desc,
      route: "/elenco/plano-de-treino",
    },
    {
      id: 3,
      title: t.academiaHub.planos_de_desenvolvimento,
      subtitle: t.academiaHub.atleta_por_atleta,
      icon: Users,
      description: t.academiaHub.desenvolvimento_desc,
      route: "/elenco/desenvolvimento",
    },
    {
      id: 4,
      title: t.academiaHub.juniores,
      subtitle: t.academiaHub.a_base_do_clube,
      icon: Sprout,
      description: t.academiaHub.juniores_desc,
      route: "/base",
    },
    {
      id: 5,
      title: t.academiaHub.performance,
      subtitle: t.academiaHub.fases_do_jogo_e_data_hub,
      icon: HeartPulse,
      description: t.academiaHub.performance_desc,
      route: "/performance",
    },
  ], [t])

  return (
    <HubScreen
      tagline={t.academiaHub.treino_e_desenvolvimento}
      cards={cards}
      primaryActionLabel={t.academiaHub.entrar_em_treinamento}
      primaryActionRoute="/treinamento"
    />
  )
}
