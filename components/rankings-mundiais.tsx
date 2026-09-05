"use client"

// RANKINGS MUNDIAIS — tela propria desde a 1.0.305.
//
// ⚠️ ELES ERAM UMA ABA DA CENTRAL DE GESTAO, e a entrada do menu se chamava
// "Gestao e rankings" para avisar que estavam la dentro. Um rotulo que precisa
// explicar onde a coisa esta e o sintoma de ela estar no lugar errado: gestao e
// o que o tecnico DECIDE (bolas paradas, metas, comissao, disciplina); ranking e
// o que ele CONSULTA. Juntar as duas obrigava a passar por onze abas de decisao
// para ver uma tabela.
//
// A componente ficou aqui, e nao na pagina, porque pagina do Next nao e lugar de
// exportar componente para outra pagina importar.

import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useGameState } from "@/lib/save-system"
import { getTeamByShort, allTeams } from "@/lib/teams-data"
import { NATIONAL_TEAMS, getNationalStrength } from "@/lib/national-teams"
import { normalizarGestao282, pontuacaoTecnico, pontuacaoTime } from "@/lib/gestao-282"
import { cn } from "@/lib/utils"
import { GraduationCap } from "lucide-react"

const botao = "rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-40"

function Secao({ titulo, texto, children }: { titulo: string; texto: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-white/10 bg-[#10141b] p-5"><h2 className="uf-heading text-xl font-bold">{titulo}</h2><p className="mb-5 text-sm text-white/50">{texto}</p>{children}</section>
}

export function RankingsMundiais({ state }: {
  state: ReturnType<typeof useGameState>["state"]
}) {
  const [tipo, setTipo] = useState<"tecnicos"|"times"|"selecoes"|"academias">("tecnicos")
  const tecnicos = useMemo(() => { const vitorias = (state.results ?? []).filter(r => { const user = state.selectedTeamShort; return user && ((r.homeCurto === user && r.homeGoals > r.awayGoals) || (r.awayCurto === user && r.awayGoals > r.homeGoals)) }).length; const usuario = { nome: state.managerName, clube: getTeamByShort(state.selectedTeamShort ?? "")?.nome ?? "Sem clube", pontos: pontuacaoTecnico({ titulos: state.coachTotalTitles, reputacao: state.coachLegacy.reputationLevel, vitorias, temporadas: state.coachLegacy.totalSeasons }) }; const ia = (state.demissoesMundo ?? []).map((d,i)=>({nome:d.tecnico,clube:getTeamByShort(d.curto)?.nome??d.curto,pontos:Math.max(20,700-i*19-d.season)})); return [usuario,...ia].sort((a,b)=>b.pontos-a.pontos) }, [state])
  const times = useMemo(() => allTeams.map(t => { const tab = (state.standings ?? []).find(s=>s.curto===t.curto); return { nome:t.nome, detalhe:t.divisao, pontos:pontuacaoTime({prestigio:t.prestigio,pontos:tab?.points,saldo:tab ? tab.goalsFor-tab.goalsAgainst:0}) } }).sort((a,b)=>b.pontos-a.pontos).slice(0,100), [state.standings])
  const selecoes = useMemo(() => NATIONAL_TEAMS.map(n=>({nome:n.name,detalhe:n.confederation,pontos:getNationalStrength(n)*10})).sort((a,b)=>b.pontos-a.pontos), [])
  const gestao = normalizarGestao282(state.gestao282)
  const ultimoRegistro = gestao.historicoAcademia291[0]
  const academias = useMemo(() => allTeams.map(t => ({
    nome: t.nome,
    detalhe: `${t.pais ?? t.estado} · academia`,
    pontos: t.curto === state.selectedTeamShort && ultimoRegistro ? ultimoRegistro.pontuacao : Math.round(260 + t.prestigio * 7.2),
  })).sort((a,b)=>b.pontos-a.pontos).slice(0,100), [state.selectedTeamShort, ultimoRegistro])
  const lista = tipo === "tecnicos" ? tecnicos.map(x=>({nome:x.nome,detalhe:x.clube,pontos:x.pontos})) : tipo === "times" ? times : tipo === "selecoes" ? selecoes : academias
  return <Secao titulo="Rankings mundiais" texto="Atualizados pelos resultados da carreira, reputação, força e desempenho."><div className="mb-4 flex flex-wrap gap-2">{(["tecnicos","times","selecoes","academias"] as const).map(t=><button className={cn(botao,tipo!==t&&"bg-white/10 text-white")} onClick={()=>setTipo(t)} key={t}>{t === "academias" ? <><GraduationCap className="mr-1 inline h-4 w-4"/>academias</> : t}</button>)}</div>{lista.slice(0,50).map((r,i)=><div key={`${r.nome}-${i}`} className="grid grid-cols-[50px_1fr_100px] border-b border-white/5 py-3"><b className="text-emerald-300">#{i+1}</b><span>{r.nome}<small className="ml-2 text-white/35">{r.detalhe}</small></span><b className="text-right">{Math.round(r.pontos)}</b></div>)}{tipo === "academias" && gestao.historicoAcademia291.length > 0 && <div className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4"><h3 className="font-bold text-emerald-300">Histórico de formação</h3>{gestao.historicoAcademia291.map(registro => <p key={registro.season} className="mt-2 text-sm text-white/60">{registro.season}: nível {registro.nivel} · {registro.graduados} formados · {registro.minutosDeJovens} minutos · {registro.pontuacao} pontos</p>)}</div>}</Secao>
}

