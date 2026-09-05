"use client"

import { useMemo, useState } from "react"
import { ArrowLeftRight, BadgeCheck, RadioTower, Search, Send, Target, XCircle } from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { formatCurrency } from "@/lib/currency"
import { useGameEngine } from "@/lib/game-engine"
import { hardNavigate } from "@/lib/hard-navigation"
import { useGameState } from "@/lib/save-system"
import { useUserTeam } from "@/lib/time-da-carreira"
import {
  avaliarPitch26,
  criarRequirement26,
  gerarOportunidadesPitch26,
  normalizarTransferRoom26,
  type PapelComBola26,
  type PapelSemBola26,
  type PerfilEtarioTransferRoom,
  type SetorTransferRoom,
  type TempoDeJogoTransferRoom,
  type TipoNegocioTransferRoom,
} from "@/lib/transferroom-26"

type Aba = "requirements" | "oportunidades" | "atividade"

const campo = "rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50"
const botao = "inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-black text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"

const ROTULOS: Record<string, string> = {
  GOL: "Goleiro", DEF: "Defesa", MEI: "Meio-campo", ATA: "Ataque",
  estrela: "Estrela", titular: "Titular", rotacao: "Rotação", profundidade: "Profundidade",
  compra: "Transferência", emprestimo: "Empréstimo", ambos: "Transferência ou empréstimo",
  promessa: "Promessa (16–22)", auge: "No auge (23–29)", experiente: "Experiente (29+)", qualquer: "Qualquer idade",
  construtor: "Construtor", amplitude: "Amplitude", infiltrador: "Infiltrador", finalizador: "Finalizador", apoio: "Apoio",
  pressao: "Pressão", cobertura: "Cobertura", marcacao: "Marcação", bloco_baixo: "Bloco baixo", saida: "Saída",
}

export default function TransferRoomPage() {
  const { state, setState } = useGameState()
  const { team: userTeam } = useUserTeam()
  const game = useGameEngine()
  const transferRoom = normalizarTransferRoom26(state.transferRoom26)
  const [aba, setAba] = useState<Aba>("requirements")
  const [setor, setSetor] = useState<SetorTransferRoom>("ATA")
  const [papelComBola, setPapelComBola] = useState<PapelComBola26>("finalizador")
  const [papelSemBola, setPapelSemBola] = useState<PapelSemBola26>("pressao")
  const [tempoDeJogo, setTempoDeJogo] = useState<TempoDeJogoTransferRoom>("titular")
  const [tipoNegocio, setTipoNegocio] = useState<TipoNegocioTransferRoom>("compra")
  const [perfilEtario, setPerfilEtario] = useState<PerfilEtarioTransferRoom>("qualquer")
  const [jogadorId, setJogadorId] = useState<number | null>(null)
  const [tipoPitch, setTipoPitch] = useState<"compra" | "emprestimo">("compra")
  const [filtroSetor, setFiltroSetor] = useState<SetorTransferRoom | "TODOS">("TODOS")

  const salvar = (proximo: typeof transferRoom) => setState({ transferRoom26: proximo })
  const oportunidades = useMemo(
    () => gerarOportunidadesPitch26(state.universo286, userTeam?.curto, state.season, state.week),
    [state.universo286, userTeam?.curto, state.season, state.week],
  )
  const oportunidadesFiltradas = filtroSetor === "TODOS" ? oportunidades : oportunidades.filter(item => item.setor === filtroSetor)
  const elenco = game.squadPlayers.filter(player => !player.isLoanedIn)
  const jogador = elenco.find(player => player.id === jogadorId) ?? null

  const publicar = () => {
    const requirement = criarRequirement26(
      { setor, papelComBola, papelSemBola, tempoDeJogo, tipoNegocio, perfilEtario },
      state.season,
      state.week,
      state.universo286,
      userTeam?.curto,
    )
    salvar({ ...transferRoom, requirements: [requirement, ...transferRoom.requirements].slice(0, 20) })
  }

  const encerrar = (id: string) => salvar({
    ...transferRoom,
    requirements: transferRoom.requirements.map(item => item.id === id ? { ...item, status: "encerrado" as const } : item),
  })

  const oferecer = (oportunidadeId: string) => {
    const oportunidade = oportunidades.find(item => item.id === oportunidadeId)
    if (!oportunidade || !jogador) return
    const pitch = avaliarPitch26(oportunidade, jogador, tipoPitch, state.season, state.week)
    salvar({ ...transferRoom, pitches: [pitch, ...transferRoom.pitches].slice(0, 50) })
    setAba("atividade")
  }

  const concluir = (pitchId: string) => {
    const pitch = transferRoom.pitches.find(item => item.id === pitchId)
    if (!pitch || pitch.status !== "aceito") return
    if (pitch.tipoNegocio === "compra") game.sellPlayer(pitch.jogadorId, pitch.valor)
    else if (!(game.loanListedIds ?? []).includes(pitch.jogadorId)) game.toggleLoanListed(pitch.jogadorId)
    salvar({
      ...transferRoom,
      pitches: transferRoom.pitches.map(item => item.id === pitchId ? { ...item, status: "concluido" as const } : item),
    })
  }

  if (!userTeam) return null

  return (
    <div className="min-h-screen bg-[#05070b] pb-20 text-white">
      <GameHeader team={userTeam} />
      <main className="mx-auto max-w-[1500px] p-4 md:p-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cyan-400/15 bg-gradient-to-r from-cyan-400/10 to-transparent p-5">
          <div className="flex items-center gap-4">
            <TeamCrest team={userTeam} size="lg" />
            <div><p className="text-xs font-black uppercase tracking-[.25em] text-cyan-300">Mercado direto entre clubes</p><h1 className="uf-heading text-2xl font-black">TransferRoom Ultrafoot</h1><p className="mt-1 text-sm text-white/50">Publique necessidades, receba jogadores compatíveis e ofereça excedentes diretamente.</p></div>
          </div>
          <RadioTower className="h-10 w-10 text-cyan-300" />
        </header>

        <nav className="mb-5 flex gap-2 overflow-x-auto">
          {([["requirements", "Necessidades", Target], ["oportunidades", "Oportunidades", Search], ["atividade", "Atividade", ArrowLeftRight]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setAba(id)} className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${aba === id ? "bg-cyan-400 text-black" : "bg-white/5 text-white/60 hover:bg-white/10"}`}><Icon className="h-4 w-4" />{label}</button>
          ))}
        </nav>

        {aba === "requirements" && <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
          <section className="rounded-2xl border border-white/10 bg-white/[.035] p-5">
            <h2 className="font-black">Publicar necessidade</h2><p className="mt-1 text-xs text-white/45">Os clubes do universo respondem com atletas que realmente pertencem aos seus elencos.</p>
            <div className="mt-5 grid gap-3">
              <Select label="Setor" value={setor} values={["GOL", "DEF", "MEI", "ATA"]} onChange={v => setSetor(v as SetorTransferRoom)} />
              <Select label="Papel com bola" value={papelComBola} values={["construtor", "amplitude", "infiltrador", "finalizador", "apoio"]} onChange={v => setPapelComBola(v as PapelComBola26)} />
              <Select label="Papel sem bola" value={papelSemBola} values={["pressao", "cobertura", "marcacao", "bloco_baixo", "saida"]} onChange={v => setPapelSemBola(v as PapelSemBola26)} />
              <Select label="Tempo de jogo" value={tempoDeJogo} values={["estrela", "titular", "rotacao", "profundidade"]} onChange={v => setTempoDeJogo(v as TempoDeJogoTransferRoom)} />
              <Select label="Negócio" value={tipoNegocio} values={["compra", "emprestimo", "ambos"]} onChange={v => setTipoNegocio(v as TipoNegocioTransferRoom)} />
              <Select label="Idade" value={perfilEtario} values={["qualquer", "promessa", "auge", "experiente"]} onChange={v => setPerfilEtario(v as PerfilEtarioTransferRoom)} />
              <button className={botao} onClick={publicar}><Send className="h-4 w-4" />Circular para todos os clubes</button>
            </div>
          </section>
          <section className="space-y-4">
            {transferRoom.requirements.length === 0 && <Vazio texto="Nenhuma necessidade publicada." />}
            {transferRoom.requirements.map(requirement => <article key={requirement.id} className="rounded-2xl border border-white/10 bg-white/[.035] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><Tag>{ROTULOS[requirement.setor]}</Tag><Tag>{ROTULOS[requirement.tempoDeJogo]}</Tag><Tag>{ROTULOS[requirement.tipoNegocio]}</Tag><Tag>{ROTULOS[requirement.perfilEtario]}</Tag></div><p className="mt-3 text-sm text-white/65">{ROTULOS[requirement.papelComBola]} com bola · {ROTULOS[requirement.papelSemBola]} sem bola</p></div><div className="text-right"><b className={requirement.status === "ativo" ? "text-emerald-300" : "text-white/35"}>{requirement.status.toUpperCase()}</b><p className="text-xs text-white/35">{requirement.respostas.length} respostas</p></div></div>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {requirement.respostas.slice(0, 8).map(resposta => <button key={resposta.jogadorId} onClick={() => hardNavigate(`/mercado?jogador=${encodeURIComponent(resposta.jogador)}`)} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/25 p-3 text-left hover:border-cyan-400/30"><div><b className="text-sm">{resposta.jogador}</b><p className="text-xs text-white/40">{resposta.clube} · {resposta.posicao} · {resposta.idade} anos</p></div><div className="text-right"><b className="text-cyan-300">{resposta.pontuacao}%</b><p className="text-[10px] text-white/35">{formatCurrency(resposta.valor)}</p></div></button>)}
              </div>
              {requirement.status === "ativo" && <button onClick={() => encerrar(requirement.id)} className="mt-4 text-xs font-bold text-red-300 hover:text-red-200">Encerrar anúncio</button>}
            </article>)}
          </section>
        </div>}

        {aba === "oportunidades" && <section>
          <div className="mb-4 grid gap-3 rounded-2xl border border-white/10 bg-white/[.035] p-4 md:grid-cols-3">
            <label className="grid gap-1 text-xs text-white/50">Atleta<select className={campo} value={jogadorId ?? ""} onChange={e => setJogadorId(Number(e.target.value) || null)}><option value="">Selecione do elenco</option>{elenco.map(player => <option key={player.id} value={player.id}>{player.name} · {player.position} · {player.age} · GER {player.overall}</option>)}</select></label>
            <Select label="Modalidade" value={tipoPitch} values={["compra", "emprestimo"]} onChange={v => setTipoPitch(v as "compra" | "emprestimo")} />
            <Select label="Filtrar setor" value={filtroSetor} values={["TODOS", "GOL", "DEF", "MEI", "ATA"]} onChange={v => setFiltroSetor(v as SetorTransferRoom | "TODOS")} />
          </div>
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">{oportunidadesFiltradas.map(item => <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><div className="flex justify-between gap-3"><div><b>{item.clube}</b><p className="text-xs text-white/40">{item.pais}</p></div><Tag>{ROTULOS[item.setor]}</Tag></div><p className="mt-4 text-sm text-white/65">Procura: {ROTULOS[item.tempoDeJogo]} · {ROTULOS[item.perfilEtario]}</p><p className="mt-1 text-xs text-white/40">{ROTULOS[item.papelComBola]} / {ROTULOS[item.papelSemBola]} · {ROTULOS[item.tipoNegocio]}</p><div className="mt-4 flex items-center justify-between"><span className="text-sm font-bold text-emerald-300">até {formatCurrency(item.orcamento)}</span><button disabled={!jogador} onClick={() => oferecer(item.id)} className={botao}><Send className="h-4 w-4" />Oferecer</button></div></article>)}</div>
        </section>}

        {aba === "atividade" && <section className="space-y-3">
          {transferRoom.pitches.length === 0 && <Vazio texto="Nenhum atleta foi oferecido por este canal." />}
          {transferRoom.pitches.map(pitch => <article key={pitch.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4"><div className="flex items-center gap-3">{pitch.status === "rejeitado" ? <XCircle className="h-6 w-6 text-red-400" /> : <BadgeCheck className="h-6 w-6 text-emerald-300" />}<div><b>{pitch.jogador} → {pitch.clube}</b><p className="text-xs text-white/45">{pitch.justificativa}</p></div></div><div className="flex items-center gap-3"><div className="text-right"><b className={pitch.status === "rejeitado" ? "text-red-300" : "text-emerald-300"}>{pitch.status.toUpperCase()}</b>{pitch.valor > 0 && <p className="text-xs text-white/45">{formatCurrency(pitch.valor)}</p>}</div>{pitch.status === "aceito" && <button className={botao} onClick={() => concluir(pitch.id)}>{pitch.tipoNegocio === "compra" ? "Concluir venda" : "Liberar empréstimo"}</button>}</div></article>)}
        </section>}
      </main>
    </div>
  )
}

function Select({ label, value, values, onChange }: { label: string; value: string; values: readonly string[]; onChange: (value: string) => void }) {
  return <label className="grid gap-1 text-xs text-white/50">{label}<select className={campo} value={value} onChange={event => onChange(event.target.value)}>{values.map(item => <option key={item} value={item}>{ROTULOS[item] ?? (item === "TODOS" ? "Todos" : item)}</option>)}</select></label>
}
function Tag({ children }: { children: React.ReactNode }) { return <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-[10px] font-black uppercase text-cyan-200">{children}</span> }
function Vazio({ texto }: { texto: string }) { return <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-white/35">{texto}</div> }
