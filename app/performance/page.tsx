"use client"

import { formatCurrency } from "@/lib/currency"
import { useEffect, useMemo, useState } from "react"
import { Activity, ArrowLeftRight, BarChart3, BrainCircuit, CalendarRange, Globe2, HeartPulse, Save, ShieldCheck } from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { usePaginacao, Paginador } from "@/components/lista-paginada"
import { MedicalModal } from "@/components/modals/medical-modal"
import { useGameEngine, type Player, type TratamentoMedico } from "@/lib/game-engine"
import { useUserTeam } from "@/lib/time-da-carreira"
import { cn } from "@/lib/utils"
import { initPersistentStore, storeGet, storeSet } from "@/lib/persistent-store"
import { buildDataHub, DEFAULT_PERFORMANCE_STATE, medicalRisk, mergePhaseTactic, normalizePerformanceState, performanceStorageKey, projectSquadNative, type PerformanceCenterState, type PlayerProjection, type SquadDecision } from "@/lib/performance-center"
import { useGameState } from "@/lib/save-system"

type Tab = "planejamento" | "taticas" | "dados" | "medico"
const TABS: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: "planejamento", label: "Planejamento plurianual", icon: CalendarRange },
  { id: "taticas", label: "Fases do jogo", icon: BrainCircuit },
  { id: "dados", label: "Data Hub", icon: BarChart3 },
  { id: "medico", label: "Departamento médico", icon: HeartPulse },
]

export default function PerformancePage() {
  const { team } = useUserTeam()
  const { state: careerState } = useGameState()
  const engine = useGameEngine()
  const [tab, setTab] = useState<Tab>("planejamento")
  const [config, setConfig] = useState<PerformanceCenterState>(DEFAULT_PERFORMANCE_STATE)
  const [projections, setProjections] = useState<PlayerProjection[]>([])
  const [projectionEngine, setProjectionEngine] = useState<"rust" | "typescript">("typescript")
  const [selectedMedical, setSelectedMedical] = useState<Player | null>(null)
  const storageKey = performanceStorageKey(team.curto, engine.currentSeason)

  useEffect(() => {
    let active = true
    void initPersistentStore().then(() => {
      if (!active) return
      try { const raw = storeGet(storageKey); setConfig(normalizePerformanceState(raw ? JSON.parse(raw) : null)) }
      catch { setConfig(DEFAULT_PERFORMANCE_STATE) }
    })
    return () => { active = false }
  }, [storageKey])

  useEffect(() => {
    let active = true
    void projectSquadNative(engine.squadPlayers.map(p => ({ playerId: p.id, age: p.age, overall: p.overall, potential: p.potential })), engine.currentSeason).then(result => {
      if (active) { setProjections(result.projections); setProjectionEngine(result.engine) }
    })
    return () => { active = false }
  }, [engine.squadPlayers, engine.currentSeason])

  // O mesmo store durável dos saves: sobrevive a reinstalação e participa do
  // flush do botão Salvar. localStorage sozinho não oferece essa garantia.
  const saveConfig = (next = config) => { storeSet(storageKey, JSON.stringify(next)); setConfig(next) }
  const updatePlan = (playerId: number, patch: Partial<{ decision: SquadDecision; targetSeason: number; note: string }>) => {
    const previous = config.squadPlan.find(plan => plan.playerId === playerId)
    saveConfig({
      ...config,
      squadPlan: [
        ...config.squadPlan.filter(plan => plan.playerId !== playerId),
        {
          playerId,
          decision: patch.decision ?? previous?.decision ?? "manter",
          targetSeason: patch.targetSeason ?? previous?.targetSeason ?? engine.currentSeason + 1,
          note: patch.note ?? previous?.note ?? "",
        },
      ],
    })
  }
  const setDecision = (playerId: number, decision: SquadDecision) => {
    updatePlan(playerId, { decision })
  }
  const applyTactic = () => {
    engine.setFormation(config.phaseTactic.formation)
    engine.setTeamTactics(mergePhaseTactic(engine.teamTactics, config.phaseTactic))
    saveConfig()
  }

  const games = useMemo(() => engine.matchResults.filter(m => m.season === engine.currentSeason && (m.homeTeam === team.curto || m.awayTeam === team.curto)), [engine.matchResults, engine.currentSeason, team.curto])
  const data = useMemo(() => buildDataHub(games.map(match => {
    const home = match.homeTeam === team.curto
    const own = home ? match.performance?.home : match.performance?.away
    const opponent = home ? match.performance?.away : match.performance?.home
    return {
      home,
      scored: home ? match.homeScore : match.awayScore,
      conceded: home ? match.awayScore : match.homeScore,
      xG: own?.xG,
      xGA: opponent?.xG,
      shots: own?.shots,
      shotsAgainst: opponent?.shots,
      shotsOnTarget: own?.shotsOnTarget,
      possession: own?.possession,
      passAccuracy: own?.passAccuracy,
    }
  })), [games, team.curto])
  const medicalRows = useMemo(() => engine.squadPlayers.map(player => ({ player, risk: medicalRisk(player, engine.fadigaCronica[player.id] ?? 0) })).sort((a, b) => b.risk.score - a.risk.score), [engine.squadPlayers, engine.fadigaCronica])
  // 14 por pagina: a caixa da tabela tem ~710px e cada linha 41px. A linha aqui
  // e larga (min-w 1180px: atleta, posicao, 5 temporadas e a decisao), entao nao
  // aceita duas colunas — paginar e a unica forma de caber sem encolher texto.
  const paginaDoPlanejamento = usePaginacao(engine.squadPlayers, 12)
  const universe = careerState.universo286
  const universeStats = useMemo(() => {
    if (!universe) return null
    const players = Object.values(universe.jogadores)
    return {
      clubs: Object.keys(universe.clubes).length,
      leagues: Object.keys(universe.ligas).length,
      players: players.filter(player => player.condicao > 0).length,
      injured: players.filter(player => player.lesaoSemanas > 0).length,
      recentDeals: universe.negocios.slice(0, 6),
    }
  }, [universe])

  return <div className="flex h-screen flex-col overflow-hidden bg-transparent text-white">
    <GameHeader team={team} />
    <main className="flex min-h-0 flex-1 flex-col px-6 pb-8 pt-5">
      <div className="flex items-end justify-between border-b border-white/[0.07]"><div><p className="text-xs font-semibold uppercase tracking-[.22em] text-[var(--brand)]">Performance Center 286</p><h1 className="uf-heading mt-1 text-2xl font-black">Decisões de futebol integradas</h1></div><span className="mb-3 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50">Projeções: {projectionEngine === "rust" ? "motor Rust nativo" : "fallback TypeScript"}</span></div>
      <div className="flex gap-6 border-b border-white/[0.07] pt-5">{TABS.map(item => <button key={item.id} onClick={() => setTab(item.id)} className={cn("flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold", tab === item.id ? "border-[var(--brand)] text-white" : "border-transparent text-white/40 hover:text-white/70")}><item.icon className="h-4 w-4" />{item.label}</button>)}</div>
      <section className="min-h-0 flex-1 overflow-auto pt-5">
        {tab === "planejamento" && <div className="overflow-auto uf-card"><div className="grid min-w-[1180px] grid-cols-[minmax(190px,1.5fr)_90px_repeat(5,100px)_330px] bg-white/[0.04] px-4 py-3 text-xs uppercase text-white/45"><span>Atleta</span><span>Posição</span>{Array.from({length:5},(_,i)=><span key={i}>{engine.currentSeason+i}</span>)}<span>Decisão · prazo · observação</span></div>{paginaDoPlanejamento.fatia.map(player => { const projection = projections.find(p => p.playerId === player.id); const plan = config.squadPlan.find(p => p.playerId === player.id); const contractSeason = player.contract ? engine.currentSeason + Math.floor(Math.max(0, player.contract.endDate - engine.currentWeek) / 52) : null; return <div key={player.id} className="grid min-w-[1180px] grid-cols-[minmax(190px,1.5fr)_90px_repeat(5,100px)_330px] items-center border-t border-white/[0.05] px-4 py-2.5 text-sm hover:bg-white/[0.025]"><div><b>{player.name}</b><p className="text-xs text-white/35">{player.age} anos · contrato {contractSeason ?? "—"}</p></div><span className="text-white/60">{player.position}</span>{projection?.seasons.map(s => <span key={s.season} className={cn("font-bold", s.status === "evolucao" ? "text-emerald-400" : s.status === "declinio" ? "text-orange-400" : "text-white/75")}>{s.overall}<small className="ml-1 font-normal text-white/30">({s.age})</small></span>)}<div className="grid grid-cols-[135px_80px_1fr] gap-2"><select aria-label={`Decisão para ${player.name}`} value={plan?.decision ?? "manter"} onChange={e => setDecision(player.id, e.target.value as SquadDecision)} className="rounded-lg border border-white/10 bg-[#15151b] px-2 py-2 text-xs"><option value="manter">Manter</option><option value="renovar">Renovar</option><option value="emprestar">Emprestar</option><option value="vender">Vender</option><option value="substituir">Substituir</option></select><select aria-label={`Temporada-alvo para ${player.name}`} value={plan?.targetSeason ?? engine.currentSeason + 1} onChange={e => updatePlan(player.id,{targetSeason:Number(e.target.value)})} className="rounded-lg border border-white/10 bg-[#15151b] px-2 py-2 text-xs">{Array.from({length:5},(_,i)=>engine.currentSeason+i).map(season=><option key={season}>{season}</option>)}</select><input aria-label={`Observação sobre ${player.name}`} value={plan?.note ?? ""} onChange={e=>updatePlan(player.id,{note:e.target.value.slice(0,80)})} placeholder="Sucessor, meta, função…" className="min-w-0 rounded-lg border border-white/10 bg-[#15151b] px-2 py-2 text-xs outline-none focus:border-[var(--brand)]"/></div></div>})}<Paginador lista={paginaDoPlanejamento} rotulo="atletas" /></div>}

        {tab === "taticas" && <div className="grid gap-5 lg:grid-cols-3"><PhaseCard title="Com posse" color="text-cyan-400">{select("Estrutura com bola", config.phaseTactic.inPossession.formation, ["2-3-5","3-2-5","3-4-3","4-2-3-1","4-3-3","4-4-2"], v => setConfig({...config,phaseTactic:{...config.phaseTactic,inPossession:{...config.phaseTactic.inPossession,formation:v}}}))}{select("Construção", config.phaseTactic.inPossession.buildUp, ["curto","misto","longo"], v => setConfig({...config,phaseTactic:{...config.phaseTactic,inPossession:{...config.phaseTactic.inPossession,buildUp:v as never}}}))}{select("Ritmo", config.phaseTactic.inPossession.tempo,["lento","normal","rapido"],v=>setConfig({...config,phaseTactic:{...config.phaseTactic,inPossession:{...config.phaseTactic.inPossession,tempo:v as never}}}))}{select("Criação",config.phaseTactic.inPossession.chanceCreation,["largura","centro","misto"],v=>setConfig({...config,phaseTactic:{...config.phaseTactic,inPossession:{...config.phaseTactic.inPossession,chanceCreation:v as never}}}))}</PhaseCard><PhaseCard title="Sem posse" color="text-orange-400">{select("Estrutura defensiva", config.phaseTactic.outOfPossession.formation, ["4-4-2","4-1-4-1","4-2-3-1","5-3-2","5-4-1","3-4-3"], v => setConfig({...config,phaseTactic:{...config.phaseTactic,outOfPossession:{...config.phaseTactic.outOfPossession,formation:v}}}))}{select("Linha defensiva",config.phaseTactic.outOfPossession.defensiveLine,["baixa","media","alta"],v=>setConfig({...config,phaseTactic:{...config.phaseTactic,outOfPossession:{...config.phaseTactic.outOfPossession,defensiveLine:v as never}}}))}{select("Pressão",config.phaseTactic.outOfPossession.pressingIntensity,["baixa","media","alta","muito_alta"],v=>setConfig({...config,phaseTactic:{...config.phaseTactic,outOfPossession:{...config.phaseTactic.outOfPossession,pressingIntensity:v as never}}}))}{select("Marcação",config.phaseTactic.outOfPossession.markingStyle,["zonal","individual","misto"],v=>setConfig({...config,phaseTactic:{...config.phaseTactic,outOfPossession:{...config.phaseTactic.outOfPossession,markingStyle:v as never}}}))}</PhaseCard><PhaseCard title="Transições" color="text-[var(--brand)]">{select("Formação para escalação",config.phaseTactic.formation,["4-3-3","4-2-3-1","4-4-2","3-5-2","5-3-2"],v=>setConfig({...config,phaseTactic:{...config.phaseTactic,formation:v}}))}<Toggle label="Contra-atacar" checked={config.phaseTactic.transition.counterAttack} onChange={v=>setConfig({...config,phaseTactic:{...config.phaseTactic,transition:{...config.phaseTactic.transition,counterAttack:v}}})}/><Toggle label="Contrapressão" checked={config.phaseTactic.outOfPossession.counterPress} onChange={v=>setConfig({...config,phaseTactic:{...config.phaseTactic,outOfPossession:{...config.phaseTactic.outOfPossession,counterPress:v}}})}/><button onClick={applyTactic} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-3 font-bold text-[var(--brand-ink)]"><Save className="h-4 w-4"/>Ativar no motor</button></PhaseCard></div>}

        {tab === "dados" && <div className="space-y-5"><div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[["Partidas",data.played],["Pontos/jogo",data.pointsPerGame.toFixed(2)],["xG diferencial",data.xGDPerGame?.toFixed(2) ?? "—"],["Jogos sem sofrer",`${data.cleanSheetRate.toFixed(0)}%`]].map(([label,value])=><Metric key={label} label={String(label)} value={value}/>)}</div><div className="grid gap-5 lg:grid-cols-3"><PhaseCard title="Produção" color="text-cyan-400"><Bar label="Gols por jogo" value={data.goalsForPerGame} max={3}/><Bar label="xG por jogo" value={data.xGPerGame ?? 0} max={3}/><Bar label="Conversão de chutes" value={data.shotConversion ?? 0} max={30}/><Bar label="Chutes no alvo" value={data.shotAccuracy ?? 0} max={70}/></PhaseCard><PhaseCard title="Controle" color="text-violet-300"><Bar label="Posse média" value={data.averagePossession ?? 0} max={100}/><Bar label="Precisão de passe" value={data.averagePassAccuracy ?? 0} max={100}/><Bar label="PPG em casa" value={data.homePPG ?? 0} max={3}/><Bar label="PPG fora" value={data.awayPPG ?? 0} max={3}/><p className="text-xs text-white/35">Amostra avançada: {data.sampleWithAdvancedData}/{data.played} partidas</p></PhaseCard><PhaseCard title="Diagnóstico automático" color="text-[var(--brand)]"><Insight ok={data.pointsPerGame >= 1.7} text={data.pointsPerGame >= 1.7 ? "Ritmo competitivo para a parte alta da tabela." : "Produção de pontos abaixo de um candidato ao título."}/><Insight ok={(data.xGDPerGame ?? data.goalsForPerGame-data.goalsAgainstPerGame) >= 0} text={(data.xGDPerGame ?? data.goalsForPerGame-data.goalsAgainstPerGame) >= 0 ? "Produção ofensiva sustenta os resultados." : "O adversário cria mais perigo; reveja proteção e pressão."}/><Insight ok={medicalRows.filter(r=>r.risk.score>=45).length<4} text={`${medicalRows.filter(r=>r.risk.score>=45).length} atletas estão em risco médico alto ou crítico.`}/><div className="pt-2 text-xs text-white/45">Forma: {data.form.length ? data.form.join(" · ") : "sem jogos"}</div></PhaseCard></div>{universeStats&&<section className="rounded-xl border border-cyan-400/15 bg-[var(--uf-bg-surface)] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-black text-cyan-300"><Globe2 className="h-5 w-5"/>Universo persistente 286</h2><p className="mt-1 text-xs text-white/40">Ligas, elencos, contratos, lesões e mercado da CPU salvos na carreira.</p></div><div className="flex flex-wrap gap-2 text-[10px] font-bold"><span className="rounded-full bg-white/5 px-3 py-1.5">{universeStats.leagues} ligas</span><span className="rounded-full bg-white/5 px-3 py-1.5">{universeStats.clubs} clubes</span><span className="rounded-full bg-white/5 px-3 py-1.5">{universeStats.players} atletas</span><span className="rounded-full bg-orange-500/10 px-3 py-1.5 text-orange-300">{universeStats.injured} lesionados</span></div></div><div className="mt-4 grid gap-2 lg:grid-cols-2">{universeStats.recentDeals.length?universeStats.recentDeals.map(deal=><div key={deal.id} className="flex items-center gap-3 rounded-lg bg-black/25 p-3"><ArrowLeftRight className="h-4 w-4 shrink-0 text-[var(--brand)]"/><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{deal.jogador} · {deal.posicao}</p><p className="truncate text-[10px] text-white/40">{deal.de} → {deal.para} · {deal.motivo}</p></div><b className="shrink-0 text-xs text-emerald-300">{formatCurrency(deal.valor)}</b></div>):<p className="text-xs text-white/35">A janela ainda não registrou negócios.</p>}</div></section>}</div>}

        {tab === "medico" && <div className="overflow-hidden uf-card"><div className="grid grid-cols-[1.5fr_100px_110px_150px_150px] bg-white/[0.04] px-4 py-3 text-xs uppercase text-white/45"><span>Atleta</span><span>Energia</span><span>Risco</span><span>Restrição</span><span>Ação</span></div>{medicalRows.map(({player,risk})=><div key={player.id} className="grid grid-cols-[1.5fr_100px_110px_150px_150px] items-center border-t border-white/[0.05] px-4 py-3 text-sm"><div><b>{player.name}</b><p className="text-xs text-white/35">{player.injury ? `${player.injury.type} · ${player.injury.weeksRemaining} sem.` : `${engine.fadigaCronica[player.id] ?? 0}% fadiga crônica`}</p></div><span>{player.energy}%</span><span className={cn("font-bold",risk.score>=70?"text-red-400":risk.score>=45?"text-orange-400":risk.score>=22?"text-yellow-300":"text-emerald-400")}>{risk.label} · {risk.score}</span><select value={config.medicalRestrictions[player.id] ?? (player.injury?"afastado":"liberado")} onChange={e=>saveConfig({...config,medicalRestrictions:{...config.medicalRestrictions,[player.id]:e.target.value as never}})} className="mr-3 rounded border border-white/10 bg-[#15151b] p-2 text-xs"><option value="liberado">Liberado</option><option value="minutos">Limite de minutos</option><option value="sem-contato">Sem contato</option><option value="afastado">Afastado</option></select><button disabled={!player.injury} onClick={()=>setSelectedMedical(player)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/5 disabled:opacity-30">{player.injury?"Definir tratamento":"Sem lesão"}</button></div>)}</div>}
      </section>
    </main>
    <MedicalModal open={!!selectedMedical} onOpenChange={open=>{if(!open)setSelectedMedical(null)}} player={selectedMedical} onTreatment={(id,treatment:TratamentoMedico)=>{engine.tratarLesao(id,treatment)}}/>
  </div>
}

function PhaseCard({title,color,children}:{title:string;color:string;children:React.ReactNode}) { return <div className="uf-card p-5"><h2 className={cn("mb-5 flex items-center gap-2 text-lg font-black",color)}><ShieldCheck className="h-5 w-5"/>{title}</h2><div className="space-y-4">{children}</div></div> }
function select(label:string,value:string,options:string[],onChange:(v:string)=>void){return <label className="block text-xs text-white/50">{label}<select value={value} onChange={e=>onChange(e.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#15151b] px-3 py-2.5 text-sm text-white">{options.map(o=><option key={o}>{o}</option>)}</select></label>}
function Toggle({label,checked,onChange}:{label:string;checked:boolean;onChange:(v:boolean)=>void}){return <label className="flex items-center justify-between rounded-lg bg-white/[0.04] p-3 text-sm"><span>{label}</span><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} className="h-4 w-4 accent-emerald-400"/></label>}
function Metric({label,value}:{label:string;value:string|number}){return <div className="uf-card p-5"><p className="text-xs uppercase text-white/40">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>}
function Bar({label,value,max}:{label:string;value:number;max:number}){return <div><div className="mb-1 flex justify-between text-xs"><span className="text-white/55">{label}</span><b>{value.toFixed(2)}</b></div><div className="h-2 overflow-hidden rounded bg-white/10"><div className="h-full bg-[var(--brand)]" style={{width:`${Math.min(100,value/max*100)}%`}}/></div></div>}
function Insight({ok,text}:{ok:boolean;text:string}){return <div className="flex gap-3 rounded-lg bg-white/[0.04] p-3 text-sm"><span className={ok?"text-emerald-400":"text-orange-400"}>{ok?"●":"▲"}</span><span className="text-white/70">{text}</span></div>}
