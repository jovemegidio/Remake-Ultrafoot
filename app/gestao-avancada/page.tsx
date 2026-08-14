"use client"

import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { GameHeader } from "@/components/game-header"
import { useGameState } from "@/lib/save-system"
import { useGameEngine, type Player } from "@/lib/game-engine"
import { getTeamByShort, allTeams, serieATeams } from "@/lib/teams-data"
import { formatCurrency } from "@/lib/currency"
import { NATIONAL_TEAMS, getNationalStrength } from "@/lib/national-teams"
import {
  DESTINO_DO_PEDIDO, PRINCIPIOS, bonusPreparacao, consultarIntermediario, normalizarGestao282,
  pontuacaoTecnico, pontuacaoTime, verbaDoPedido282, type EntregaPauta, type EventoCarreira282,
  type MetaIndividual282, type PautaComissao, type PedidoDiretoria282,
  PUNICOES_CONDUTA_291, type Principio, type PunicaoConduta291, type RotinaBolaParada, type TipoConduta291,
} from "@/lib/gestao-282"
import { cn } from "@/lib/utils"
import { Award, ClipboardList, Goal, GraduationCap, Handshake, History, Landmark, Scale, Shield, Target, Users } from "lucide-react"
import { areaMaisFragil, confiancaPorArea, NOME_DA_AREA } from "@/lib/confianca-da-diretoria"

type Aba = "bolas" | "preparacao" | "mercado" | "metas" | "cultura" | "treino" | "diretoria" | "comissao" | "disciplina" | "timeline"
const ABAS: { id: Aba; nome: string; icon: typeof Goal }[] = [
  { id: "bolas", nome: "Bolas paradas", icon: Goal }, { id: "preparacao", nome: "Adversário", icon: Shield },
  { id: "mercado", nome: "Intermediários", icon: Handshake }, { id: "metas", nome: "Metas", icon: Target },
  { id: "cultura", nome: "Princípios", icon: Award }, { id: "treino", nome: "Unidades e mentoria", icon: Users },
  { id: "diretoria", nome: "Diretoria", icon: Landmark }, { id: "comissao", nome: "Comissão", icon: ClipboardList },
  { id: "disciplina", nome: "Disciplina", icon: Scale },
  { id: "timeline", nome: "Linha do tempo", icon: History },
]

const campo = "rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
const botao = "rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-40"

export default function GestaoAvancadaPage() {
  const { state, setState } = useGameState()
  const engine = useGameEngine()
  // `?aba=<id>` abre direto na aba pedida. Lido uma vez, no estado inicial:
  // depois disso quem manda é o clique.
  //
  // ⚠️ `?aba=rankings` NÃO existe mais — os rankings viraram tela própria
  // (/rankings). Um link antigo cai na primeira aba em vez de quebrar.
  const [aba, setAba] = useState<Aba>(() => {
    if (typeof window === "undefined") return "bolas"
    const pedida = new URLSearchParams(window.location.search).get("aba")
    return ABAS.some(a => a.id === pedida) ? (pedida as Aba) : "bolas"
  })
  const gestao = normalizarGestao282(state.gestao282)
  const team = getTeamByShort(state.selectedTeamShort ?? "") ?? serieATeams[0]
  const salvar = (patch: Partial<typeof gestao>, evento?: Omit<EventoCarreira282, "id" | "season" | "week">) => setState(prev => {
    const atual = normalizarGestao282(prev.gestao282)
    const linha = evento ? [{ ...evento, id: `${Date.now()}`, season: prev.season, week: prev.week }, ...atual.linhaDoTempo].slice(0, 200) : atual.linhaDoTempo
    return { ...prev, gestao282: { ...atual, ...patch, linhaDoTempo: linha } }
  })

  return <div className="min-h-screen bg-[#07090d] text-white"><GameHeader team={team} />
    <main className="mx-auto max-w-7xl p-5 pb-24">
      <div className="mb-5"><h1 className="text-2xl font-black">Central de Gestão</h1><p className="text-sm text-white/50">Modo {gestao.modoDeMundo.replaceAll("_", " ")} · sistemas integrados à carreira</p></div>
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">{ABAS.map(item => <button key={item.id} onClick={() => setAba(item.id)} className={cn("flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs", aba === item.id ? "border-emerald-400 bg-emerald-400/15 text-emerald-300" : "border-white/10 bg-white/5 text-white/60")}><item.icon className="h-4 w-4" />{item.nome}</button>)}</div>
      {aba === "bolas" && <Bolas gestao={gestao} jogadores={engine.squadPlayers} salvar={salvar} />}
      {aba === "preparacao" && <Preparacao gestao={gestao} state={state} salvar={salvar} />}
      {aba === "mercado" && <Mercado gestao={gestao} jogadores={engine.squadPlayers} week={engine.currentWeek} salvar={salvar} />}
      {aba === "metas" && <Metas gestao={gestao} jogadores={engine.squadPlayers} week={engine.currentWeek} salvar={salvar} />}
      {aba === "cultura" && <Cultura gestao={gestao} jogadores={engine.squadPlayers} salvar={salvar} />}
      {aba === "treino" && <Treino gestao={gestao} jogadores={engine.squadPlayers} salvar={salvar} />}
      {aba === "diretoria" && <Diretoria gestao={gestao} season={state.season} confidence={state.boardConfidence ?? 50} jogadores={engine.squadPlayers} liberarVerba={engine.liberarVerbaDaDiretoria} salvar={salvar} saldo={engine.balance} dividaTotal={state.debt?.enabled ? (state.debt.principal ?? 0) : 0} orcamento={engine.transferBudget} moralDoElenco={state.teamMorale ?? 65} />}
      {aba === "comissao" && <Comissao gestao={gestao} salvar={salvar} />}
      {aba === "disciplina" && <Disciplina gestao={gestao} salvar={salvar} />}
      {aba === "timeline" && <Linha eventos={gestao.linhaDoTempo} />}
    </main>
  </div>
}

type Props = { gestao: ReturnType<typeof normalizarGestao282>; salvar: (p: Partial<ReturnType<typeof normalizarGestao282>>, e?: Omit<EventoCarreira282, "id" | "season" | "week">) => void }

function Bolas({ gestao, jogadores, salvar }: Props & { jogadores: Player[] }) {
  const [tipo, setTipo] = useState<RotinaBolaParada["tipo"]>("escanteio_ofensivo")
  const [nome, setNome] = useState("Rotina principal")
  const [zona, setZona] = useState<RotinaBolaParada["zona"]>("segunda_trave")
  const [cobrador, setCobrador] = useState(0); const [ameaca, setAmeaca] = useState(0); const [sobra, setSobra] = useState(0)
  const criar = () => { if (!cobrador || !ameaca) return; const r: RotinaBolaParada = { id: `${Date.now()}`, nome, tipo, zona, cobradorId: cobrador, ameacaAereaId: ameaca, sobraId: sobra || undefined, ativa: true }; salvar({ rotinasBolaParada: [...gestao.rotinasBolaParada.filter(x => x.tipo !== tipo), r] }, { tipo: "elenco", titulo: "Nova rotina de bola parada", descricao: `${nome}: ${tipo.replaceAll("_", " ")} em ${zona.replaceAll("_", " ")}.` }) }
  return <Secao titulo="Criador completo de bolas paradas" texto="Uma rotina ativa por cenário. Os papéis acompanham o atleta, não a posição na escalação."><div className="grid gap-3 md:grid-cols-3"><select className={campo} value={tipo} onChange={e => setTipo(e.target.value as typeof tipo)}><option value="escanteio_ofensivo">Escanteio ofensivo</option><option value="escanteio_defensivo">Escanteio defensivo</option><option value="falta_ofensiva">Falta ofensiva</option><option value="falta_defensiva">Falta defensiva</option></select><input className={campo} value={nome} onChange={e => setNome(e.target.value)} /><select className={campo} value={zona} onChange={e => setZona(e.target.value as typeof zona)}><option value="primeira_trave">Primeira trave</option><option value="segunda_trave">Segunda trave</option><option value="centro">Centro</option><option value="curta">Curta</option></select><JogadorSelect jogadores={jogadores} value={cobrador} onChange={setCobrador} label="Cobrador" /><JogadorSelect jogadores={jogadores} value={ameaca} onChange={setAmeaca} label="Ameaça aérea" /><JogadorSelect jogadores={jogadores} value={sobra} onChange={setSobra} label="Jogador da sobra" /></div><button className={`${botao} mt-4`} onClick={criar}>Salvar e ativar rotina</button><Lista itens={gestao.rotinasBolaParada.map(r => `${r.nome} · ${r.tipo.replaceAll("_", " ")} · ${r.zona.replaceAll("_", " ")}`)} /></Secao>
}

function Preparacao({ gestao, state, salvar }: Props & { state: ReturnType<typeof useGameState>["state"] }) {
  const proxima = state.fixtures?.find(f => !f.played && f.isUserMatch)
  const adversario = proxima ? (proxima.homeCurto === state.selectedTeamShort ? proxima.awayNome : proxima.homeNome) : "Próximo rival"
  const [foco, setFoco] = useState<"pressionar" | "contra_atacar" | "controlar" | "fechar_espacos">("controlar")
  const confirmar = () => { const bonus = bonusPreparacao(foco, gestao.rotinasBolaParada.length); salvar({ preparacao: { season: state.season, week: state.week, adversario, focoTatico: foco, focoBolaParada1: "defender_escanteios", focoBolaParada2: "segunda_bola", bonus } }, { tipo: "elenco", titulo: `Preparação para ${adversario}`, descricao: `Foco ${foco.replaceAll("_", " ")}; bônus de preparação ${bonus}%.` }) }
  return <Secao titulo={`Preparação: ${adversario}`} texto="O plano vale para o próximo jogo e combina análise tática com as rotinas ensaiadas."><select className={campo} value={foco} onChange={e => setFoco(e.target.value as typeof foco)}><option value="pressionar">Pressionar saída</option><option value="contra_atacar">Contra-atacar</option><option value="controlar">Controlar posse</option><option value="fechar_espacos">Fechar espaços</option></select><button onClick={confirmar} className={`${botao} ml-3`}>Confirmar sessão</button>{gestao.preparacao && <p className="mt-4 text-emerald-300">Plano ativo: {gestao.preparacao.focoTatico} · bônus {gestao.preparacao.bonus}%</p>}</Secao>
}

function Mercado({ gestao, jogadores, week, salvar }: Props & { jogadores: Player[]; week: number }) {
  const [id, setId] = useState(0); const p = jogadores.find(x => x.id === id)
  const consultar = () => { if (!p) return; const resultado = consultarIntermediario(p, week); salvar({ intermediarios: { ...gestao.intermediarios, [p.id]: resultado } }, { tipo: "mercado", titulo: `Intermediário consultado: ${p.name}`, descricao: `${resultado.interesse.length} mercados; valor sugerido ${formatCurrency(resultado.valorSugerido)}.` }) }
  const r = id ? gestao.intermediarios[id] : null
  return <Secao titulo="Intermediários e interesse de mercado" texto="A consulta é determinística por semana e considera valor e qualidade do atleta."><JogadorSelect jogadores={jogadores} value={id} onChange={setId} label="Escolha o atleta" /><button className={`${botao} ml-3`} onClick={consultar}>Consultar agente</button>{r && <div className="mt-5 rounded-xl bg-white/5 p-4"><b>Faixa sugerida: {formatCurrency(r.valorSugerido)}</b><p className="text-white/60">Interesse: {r.interesse.join(", ")}</p></div>}</Secao>
}

function Metas({ gestao, jogadores, week, salvar }: Props & { jogadores: Player[]; week: number }) {
  const [id, setId] = useState(0); const [tipo, setTipo] = useState<MetaIndividual282["tipo"]>("gols"); const [alvo, setAlvo] = useState(5); const p = jogadores.find(x => x.id === id)
  const valor = (x: typeof p) => !x ? 0 : tipo === "gols" ? x.seasonStats.goals : tipo === "assistencias" ? x.seasonStats.assists : tipo === "treino" ? x.training.weeksTrained : x.seasonStats.matchesPlayed
  const criar = () => { if (!p) return; const m: MetaIndividual282 = { id: `${Date.now()}`, playerId: p.id, jogador: p.name, tipo, alvo, inicial: valor(p), prazoSemana: week + 12, concluida: false, falhou: false }; salvar({ metasIndividuais: [...gestao.metasIndividuais, m] }, { tipo: "elenco", titulo: `Meta definida para ${p.name}`, descricao: `${alvo} em ${tipo}, prazo de 12 semanas.` }) }
  const metas = gestao.metasIndividuais.map(m => { const j = jogadores.find(x => x.id === m.playerId); const atual = j ? (m.tipo === "gols" ? j.seasonStats.goals : m.tipo === "assistencias" ? j.seasonStats.assists : m.tipo === "treino" ? j.training.weeksTrained : j.seasonStats.matchesPlayed) : m.inicial; return `${m.jogador}: ${Math.max(0, atual - m.inicial)}/${m.alvo} ${m.tipo} · até semana ${m.prazoSemana}` })
  return <Secao titulo="Metas individuais" texto="Objetivos têm valor inicial e prazo; estatísticas anteriores não contam retroativamente."><div className="flex flex-wrap gap-3"><JogadorSelect jogadores={jogadores} value={id} onChange={setId} label="Atleta" /><select className={campo} value={tipo} onChange={e => setTipo(e.target.value as typeof tipo)}><option value="gols">Gols</option><option value="assistencias">Assistências</option><option value="treino">Semanas de treino</option><option value="jogos_emprestimo">Jogos no empréstimo</option></select><input className={`${campo} w-24`} type="number" min={1} value={alvo} onChange={e => setAlvo(Math.max(1, Number(e.target.value)))} /><button className={botao} onClick={criar}>Definir meta</button></div><Lista itens={metas} /></Secao>
}

function Cultura({ gestao, jogadores, salvar }: Props & { jogadores: Player[] }) {
  const alternar = (id: Principio) => { const tem = gestao.principios.includes(id); const next = tem ? gestao.principios.filter(x => x !== id) : gestao.principios.length < 3 ? [...gestao.principios, id] : gestao.principios; salvar({ principios: next }) }
  const adesao = jogadores.map(p => ({ nome: p.name, valor: gestao.adesao[p.id] ?? Math.max(20, Math.min(100, 50 + p.form / 2 + (p.morale === "Feliz" ? 15 : p.morale === "Infeliz" ? -20 : 0))) })).sort((a,b)=>b.valor-a.valor)
  return <Secao titulo="Princípios e adesão do elenco" texto="Escolha até três princípios. A adesão combina forma, moral e coerência do treinador."><div className="grid gap-3 md:grid-cols-3">{PRINCIPIOS.map(p => <button onClick={() => alternar(p.id)} key={p.id} className={cn("rounded-xl border p-4 text-left", gestao.principios.includes(p.id) ? "border-emerald-400 bg-emerald-400/10" : "border-white/10 bg-white/5")}><b>{p.nome}</b><p className="text-xs text-white/50">{p.efeito}</p></button>)}</div><div className="mt-5 grid gap-2 md:grid-cols-2">{adesao.slice(0, 12).map(a => <div key={a.nome} className="flex justify-between rounded bg-white/5 px-3 py-2"><span>{a.nome}</span><b>{Math.round(a.valor)}%</b></div>)}</div></Secao>
}

function Treino({ gestao, jogadores, salvar }: Props & { jogadores: Player[] }) {
  const [mentor, setMentor] = useState(0); const [jovem, setJovem] = useState(0)
  const unidade = (id: number, valor: "goleiros" | "defesa" | "ataque") => salvar({ unidadesTreino: { ...gestao.unidadesTreino, [id]: valor } })
  const criar = () => { const m = jogadores.find(x => x.id === mentor), j = jogadores.find(x => x.id === jovem); if (!m || !j || m.id === j.id) return; salvar({ mentorias: [...gestao.mentorias, { id: `${Date.now()}`, mentorId: m.id, mentor: m.name, jovensIds: [j.id], jovens: [j.name], foco: "profissionalismo" }] }, { tipo: "elenco", titulo: "Grupo de mentoria criado", descricao: `${m.name} orientará ${j.name}.` }) }
  return <Secao titulo="Unidades de treino e mentoria" texto="Cada atleta trabalha numa unidade; veteranos podem orientar jovens."><div className="max-h-72 overflow-y-auto">{jogadores.map(p => <div key={p.id} className="flex items-center justify-between border-b border-white/5 py-2"><span>{p.name} · {p.position}</span><select className={campo} value={gestao.unidadesTreino[p.id] ?? (p.position === "GOL" ? "goleiros" : ["ZAG","LD","LE","VOL"].includes(p.position) ? "defesa" : "ataque")} onChange={e => unidade(p.id, e.target.value as "goleiros"|"defesa"|"ataque")}><option value="goleiros">Goleiros</option><option value="defesa">Defesa</option><option value="ataque">Ataque</option></select></div>)}</div><div className="mt-5 flex flex-wrap gap-3"><JogadorSelect jogadores={jogadores.filter(p=>p.age>=27)} value={mentor} onChange={setMentor} label="Mentor veterano" /><JogadorSelect jogadores={jogadores.filter(p=>p.age<=23)} value={jovem} onChange={setJovem} label="Jovem" /><button className={botao} onClick={criar}>Criar mentoria</button></div><Lista itens={gestao.mentorias.map(m => `${m.mentor} → ${m.jovens.join(", ")} (${m.foco})`)} /></Secao>
}

function Diretoria({ gestao, season, confidence, jogadores, liberarVerba, salvar, saldo, dividaTotal, orcamento, moralDoElenco }: Props & {
  season: number; confidence: number; jogadores: Player[]
  liberarVerba: (valor: number, destino: "transferencias" | "caixa") => void
  saldo: number; dividaTotal: number; orcamento: number; moralDoElenco: number
}) {
  const [tipo, setTipo] = useState<PedidoDiretoria282["tipo"]>("orcamento"); const [texto, setTexto] = useState(""); const [prioridade, setPrioridade] = useState(false)
  const prioridadeUsada = gestao.pedidosDiretoria.some(p => p.season === season && p.prioridade)
  // O tamanho do elenco em dinheiro é o termômetro do porte do clube.
  const valorDoElenco = useMemo(() => jogadores.reduce((s, p) => s + (p.marketValue ?? 0), 0), [jogadores])
  const previsto = verbaDoPedido282({ tipo, prioridade }, { valorDoElenco, confianca: confidence })
  const enviar = () => {
    if (!texto.trim() || (prioridade && prioridadeUsada)) return
    const score = confidence + (prioridade ? 25 : 0) + Math.min(10, texto.length / 8)
    const status: PedidoDiretoria282["status"] = score >= 70 ? "aprovado" : score >= 48 ? "analise" : "recusado"
    const p: PedidoDiretoria282 = { id: `${Date.now()}`, tipo, justificativa: texto.trim(), prioridade, season, status }
    // APROVADO agora significa dinheiro na mesa. Antes era só um rótulo: a tela
    // dizia "aprovado" e nem o orçamento nem o caixa mudavam.
    const verba = status === "aprovado" ? verbaDoPedido282(p, { valorDoElenco, confianca: confidence }) : 0
    if (verba > 0) liberarVerba(verba, DESTINO_DO_PEDIDO[tipo])
    salvar(
      { pedidosDiretoria: [{ ...p, verbaLiberada: verba || undefined }, ...gestao.pedidosDiretoria] },
      {
        tipo: "diretoria",
        titulo: `Pedido ${status}`,
        descricao: verba > 0
          ? `${tipo}: ${texto.trim()} — ${formatCurrency(verba)} liberados em ${DESTINO_DO_PEDIDO[tipo] === "transferencias" ? "verba de transferências" : "caixa"}.`
          : `${tipo}: ${texto.trim()}`,
      },
    )
    setTexto("")
  }
  /**
   * A CONFIANÇA, ABERTA POR ÁREA.
   *
   * O número sozinho não orientava decisão: 72 podia ser o campeão que quebrou o
   * clube ou o arrumado que não vence. Aberto, o técnico vê ONDE está o problema
   * — e cada área se resolve de um jeito diferente. Ver lib/confianca-da-diretoria.
   *
   * Tudo aqui sai de dado que o save já tem; nenhuma área inventa medida nova.
   */
  const areasDaDiretoria = useMemo(() => confiancaPorArea({
    confiancaEsportiva: confidence,
    // A penalidade de governanca ja esta embutida no `confidence` que chega
    // aqui; some-la de novo contaria duas vezes.
    bonusDeGovernanca: 0,
    saldo,
    dividaTotal,
    // Orcamento CONSUMIDO: o que sobrou contra o que o elenco vale e o proxy
    // honesto que esta tela tem. Orcamento zerado com elenco caro = gastou.
    gastoDoOrcamento: valorDoElenco > 0 ? Math.max(0, 1 - orcamento / (valorDoElenco * 0.35)) : 0.5,
    // Garotos da base que ja estao no profissional.
    promovidosDaBase: jogadores.filter(j => (j.age ?? 30) <= 21 && (j.overall ?? 0) >= 60).length,
    moralDoElenco,
  }), [confidence, saldo, dividaTotal, orcamento, valorDoElenco, jogadores, moralDoElenco])
  const fragil = useMemo(() => areaMaisFragil(areasDaDiretoria), [areasDaDiretoria])

  return <>
    <Secao titulo="Confiança da diretoria" texto={fragil
      ? `A diretoria está preocupada com ${NOME_DA_AREA[fragil.area].toLowerCase()}: ${fragil.leitura}`
      : "Nenhuma área preocupa a diretoria no momento."}>
      <div className="grid gap-2 md:grid-cols-2">
        {areasDaDiretoria.map(a => (
          <div key={a.area} className="rounded-xl bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">{NOME_DA_AREA[a.area]}</span>
              <span className={`font-mono text-sm font-bold tabular-nums ${
                a.nota >= 70 ? "text-emerald-400" : a.nota >= 45 ? "text-amber-400" : "text-red-400"
              }`}>{a.nota}</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
              <div className={`h-full rounded-full ${
                a.nota >= 70 ? "bg-emerald-400/70" : a.nota >= 45 ? "bg-amber-400/70" : "bg-red-400/70"
              }`} style={{ width: `${a.nota}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-white/45">{a.leitura}</p>
          </div>
        ))}
      </div>
    </Secao>
    <Secao titulo="Pedidos contextuais à diretoria" texto="Um pedido pode ser marcado como prioridade por temporada. Confiança e justificativa afetam a resposta — e o que for aprovado vira verba de verdade."><div className="flex flex-wrap gap-3"><select className={campo} value={tipo} onChange={e => setTipo(e.target.value as typeof tipo)}><option value="orcamento">Orçamento</option><option value="estadio">Estádio</option><option value="treino">Centro de treino</option><option value="base">Categorias de base</option><option value="staff">Comissão técnica</option></select><input className={`${campo} min-w-72 flex-1`} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Por que o clube precisa disto agora?" /><label className="flex items-center gap-2"><input type="checkbox" disabled={prioridadeUsada} checked={prioridade} onChange={e => setPrioridade(e.target.checked)} /> Prioridade anual</label><button className={botao} onClick={enviar}>Enviar</button></div>
    <p className="mt-3 text-sm text-white/50">Se aprovado, a diretoria libera cerca de <b className="text-emerald-300">{formatCurrency(previsto)}</b> em {DESTINO_DO_PEDIDO[tipo] === "transferencias" ? "verba de transferências" : "caixa"}.</p>
    <Lista itens={gestao.pedidosDiretoria.map(p => `${p.tipo} · ${p.status}${p.prioridade ? " · PRIORITÁRIO" : ""}${p.verbaLiberada ? ` · ${formatCurrency(p.verbaLiberada)}` : ""}: ${p.justificativa}`)} /></Secao>
  </>
}

function Comissao({ gestao, salvar }: Props) {
  const pautas: { id: PautaComissao; nome: string }[] = [{id:"treino",nome:"Treinamento"},{id:"mercado",nome:"Recrutamento"},{id:"medico",nome:"Departamento médico"},{id:"base",nome:"Categorias de base"},{id:"adversario",nome:"Próximo adversário"}]
  return <Secao titulo="Reuniões de comissão configuráveis" texto="Defina como cada pauta chega: reunião completa, resumo na caixa ou ignorar. Os relatórios são gerados na virada de cada semana.">
    <div className="grid gap-3 md:grid-cols-2">{pautas.map(p => <label key={p.id} className="flex items-center justify-between rounded-xl bg-white/5 p-4"><span>{p.nome}</span><select className={campo} value={gestao.pautaComissao[p.id]} onChange={e => salvar({ pautaComissao: { ...gestao.pautaComissao, [p.id]: e.target.value as EntregaPauta } })}><option value="reuniao">Na reunião</option><option value="resumo">Resumo na caixa</option><option value="ignorar">Ignorar</option></select></label>)}</div>
    <h3 className="mb-3 mt-8 text-lg font-bold">Reunião desta semana</h3>
    {gestao.relatoriosComissao.length === 0
      ? <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/35">Nada marcado para a reunião. Avance uma semana ou mude alguma pauta para &quot;Na reunião&quot;.</p>
      : <div className="space-y-3">{gestao.relatoriosComissao.map(r => <div key={r.pauta} className="rounded-xl border border-white/10 bg-white/5 p-4"><b className="text-emerald-300">{r.titulo}</b><p className="mt-1 text-sm text-white/65">{r.texto}</p></div>)}</div>}
  </Secao>
}

function Disciplina({ gestao, salvar }: Props) {
  const tipos: { id: TipoConduta291; nome: string }[] = [
    { id: "tres_amarelos", nome: "Acúmulo de três amarelos" },
    { id: "vermelho", nome: "Cartão vermelho" },
    { id: "falta_treino", nome: "Falta ao treinamento" },
    { id: "rede_social", nome: "Conduta em rede social" },
  ]
  const alterar = (tipo: TipoConduta291, punicao: PunicaoConduta291) => salvar({
    codigoConduta291: {
      ...gestao.codigoConduta291,
      regras: {
        ...gestao.codigoConduta291.regras,
        [tipo]: { tipo, punicao, multaPercentualSalario: PUNICOES_CONDUTA_291[punicao].multa },
      },
    },
  }, { tipo: "elenco", titulo: "Código de conduta atualizado", descricao: `${tipo.replaceAll("_", " ")}: ${PUNICOES_CONDUTA_291[punicao].nome}.` })
  return <Secao titulo="Código de conduta da temporada" texto="As regras são persistentes e aplicadas automaticamente a cartões e ocorrências internas. Multas são descontadas do profissional, entram no caixa do clube e punições afetam a moral.">
    <div className="grid gap-3 md:grid-cols-2">{tipos.map(tipo => <label key={tipo.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-4"><span>{tipo.nome}</span><select className={campo} value={gestao.codigoConduta291.regras[tipo.id].punicao} onChange={event => alterar(tipo.id, event.target.value as PunicaoConduta291)}>{Object.entries(PUNICOES_CONDUTA_291).map(([id, punicao]) => <option key={id} value={id}>{punicao.nome}{punicao.multa ? ` · ${punicao.multa}% salário` : ""}</option>)}</select></label>)}</div>
    <h3 className="mb-3 mt-7 font-bold">Histórico disciplinar</h3>
    {gestao.codigoConduta291.incidentes.length ? <div className="max-h-80 space-y-2 overflow-y-auto">{gestao.codigoConduta291.incidentes.map(incidente => <div key={incidente.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm"><span>{incidente.jogador} · {incidente.tipo.replaceAll("_", " ")}</span><span className="text-amber-300">{PUNICOES_CONDUTA_291[incidente.punicao].nome}{incidente.multa ? ` · ${formatCurrency(incidente.multa)}` : ""}</span></div>)}</div> : <Vazio />}
  </Secao>
}

function Linha({ eventos }: { eventos: EventoCarreira282[] }) { return <Secao titulo="Linha do tempo dinâmica" texto="Decisões da 282 entram automaticamente; os eventos mais recentes aparecem primeiro.">{eventos.length ? eventos.map(e => <div key={e.id} className="relative ml-3 border-l border-emerald-400/30 pb-6 pl-6"><span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-emerald-400"/><b>{e.titulo}</b><p className="text-xs text-white/40">Temporada {e.season} · semana {e.week} · {e.tipo}</p><p className="text-sm text-white/65">{e.descricao}</p></div>) : <Vazio />}</Secao> }

function Secao({ titulo, texto, children }: { titulo: string; texto: string; children: ReactNode }) { return <section className="rounded-2xl border border-white/10 bg-[#10141b] p-5"><h2 className="text-xl font-bold">{titulo}</h2><p className="mb-5 text-sm text-white/50">{texto}</p>{children}</section> }
function JogadorSelect({ jogadores, value, onChange, label }: { jogadores: Player[]; value: number; onChange: (n:number)=>void; label:string }) { return <select className={campo} value={value} onChange={e=>onChange(Number(e.target.value))}><option value={0}>{label}</option>{jogadores.map(p=><option key={p.id} value={p.id}>{p.name} · {p.position} · {p.overall}</option>)}</select> }
function Lista({ itens }: { itens: string[] }) { return itens.length ? <div className="mt-5 space-y-2">{itens.map((x,i)=><div key={`${x}-${i}`} className="rounded-lg bg-white/5 px-3 py-2 text-sm text-white/70">{x}</div>)}</div> : null }
function Vazio() { return <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-white/35">Nenhum registro ainda.</p> }
