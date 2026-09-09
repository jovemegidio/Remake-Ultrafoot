"use client"

// O ESCRITORIO como HUB — a porta unica das telas de direcao do clube.
//
// ⚠️ POR QUE ESTA TELA EXISTE. O menu (W) tinha DEZESSEIS entradas em quatro
// secoes, e o relatorio (PDF Ultra26, p.1) marcou a coluna inteira em vermelho:
// "diminua um pouco dessas paginas, junte em uma pagina so os itens que tem que
// juntar para nao ficar diversas paginas".
//
// ⚠️ E POR QUE NENHUMA ENTRADA FOI APAGADA. Cada linha daquele menu tem uma
// historia registrada em components/game-header.tsx: a Comissao Tecnica existia
// e NENHUM menu levava a ela; os Desafios eram um modo inteiro inalcancavel;
// Gestao e Rankings ja foram fundidos numa entrada so e tiveram de ser
// separados de novo. Encurtar o menu apagando destino repetiria exatamente
// esses defeitos. Aqui as telas nao somem — elas passam a morar atras de UMA
// porta em vez de dez, que e o que a referencia do relatorio faz.
//
// ⚠️ OS ROTULOS SAO CHAVES DE TRADUCAO, e nao texto solto. A catraca do
// scripts/qa-traducao.mjs reprova tela nova que nasce chumbada — com razao: a
// extracao e um projeto longo e sem o aperto ela para na metade. Por isso os
// cards sao montados DENTRO do componente, onde o gancho `t` alcanca.

import { useMemo } from "react"
import {
  Heart, TrendingUp, Building2, Users, Calendar, Trophy,
  Target, BarChart3, History, Newspaper, ClipboardList, Handshake,
} from "lucide-react"
import { HubScreen, type HubCard } from "@/components/hub-screen"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { hardNavigate } from "@/lib/hard-navigation"
import { useTranslation } from "@/lib/i18n"

export default function EscritorioHubPage() {
  const t = useTranslation()

  // Controle: convencao unica (B volta). Ver hooks/use-tela-gamepad.ts.
  useTelaGamepad({ aoVoltar: () => hardNavigate("/"), contexto: "GLOBAL" })

  const cards: HubCard[] = useMemo(() => [
    {
      id: 1,
      title: t.escritorioHub.central_do_clube,
      subtitle: t.escritorioHub.o_dia_a_dia,
      icon: Heart,
      description: t.escritorioHub.central_desc,
      route: "/central",
    },
    {
      id: 2,
      title: t.escritorioHub.financas,
      subtitle: t.escritorioHub.orcamento_e_folha,
      icon: TrendingUp,
      description: t.escritorioHub.financas_desc,
      route: "/financas",
    },
    {
      id: 3,
      title: t.escritorioHub.infraestrutura,
      subtitle: t.escritorioHub.estadio_e_centro_de_treino,
      icon: Building2,
      description: t.escritorioHub.infraestrutura_desc,
      route: "/infraestrutura",
    },
    {
      id: 4,
      title: t.escritorioHub.comissao_tecnica,
      subtitle: t.escritorioHub.quem_trabalha_com_voce,
      icon: Users,
      description: t.escritorioHub.comissao_desc,
      route: "/comissao",
    },
    {
      id: 5,
      title: t.escritorioHub.calendario,
      subtitle: t.escritorioHub.a_temporada,
      icon: Calendar,
      description: t.escritorioHub.calendario_desc,
      route: "/calendario",
    },
    {
      id: 6,
      title: t.escritorioHub.competicoes,
      subtitle: t.escritorioHub.tabelas_e_chaves,
      icon: Trophy,
      description: t.escritorioHub.competicoes_desc,
      route: "/competicoes",
    },
    {
      id: 7,
      title: t.escritorioHub.gestao,
      subtitle: t.escritorioHub.as_suas_decisoes,
      icon: Target,
      description: t.escritorioHub.gestao_desc,
      route: "/gestao-avancada",
    },
    {
      id: 8,
      title: t.escritorioHub.rankings,
      subtitle: t.escritorioHub.onde_voce_esta,
      icon: BarChart3,
      description: t.escritorioHub.rankings_desc,
      route: "/rankings",
    },
    {
      id: 9,
      title: t.escritorioHub.historico,
      subtitle: t.escritorioHub.o_que_ja_aconteceu,
      icon: History,
      description: t.escritorioHub.historico_desc,
      route: "/historico",
    },
    {
      id: 10,
      title: t.escritorioHub.imprensa,
      subtitle: t.escritorioHub.coletivas_e_repercussao,
      icon: Newspaper,
      description: t.escritorioHub.imprensa_desc,
      route: "/imprensa",
    },
    {
      id: 11,
      title: t.escritorioHub.reunioes,
      subtitle: t.escritorioHub.com_a_diretoria,
      icon: Handshake,
      description: t.escritorioHub.reunioes_desc,
      route: "/reunioes",
    },
    {
      id: 12,
      title: t.escritorioHub.analise,
      subtitle: t.escritorioHub.depois_do_apito,
      icon: ClipboardList,
      description: t.escritorioHub.analise_desc,
      route: "/analise-partida",
    },
  ], [t])

  return (
    <HubScreen
      tagline={t.escritorioHub.direcao_do_clube}
      cards={cards}
      primaryActionLabel={t.escritorioHub.entrar_na_central}
      primaryActionRoute="/central"
    />
  )
}
