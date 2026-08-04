"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trophy,
  Star,
  FastForward,
  Play,
  Square,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { GamepadButton } from "@/components/gamepad-icons"
import { TeamCrest } from "@/components/team-crest"
import { faseDaPartida } from "@/lib/competition-phase"
import { getTeamByShort } from "@/lib/teams-data"
import { useUserTeam } from "@/lib/save-system"
import { GameHeader } from "@/components/game-header"
import { useGameManager, seasonMonthsForDivision, type Fixture } from "@/lib/use-game-manager"
import { diaDaPartida, ehAmistoso } from "@/lib/amistosos-calendario"
import { hardNavigate } from "@/lib/hard-navigation"
import { getGameDate } from "@/lib/game-date"
import { cn } from "@/lib/utils"
import { useDiscordActivity } from "@/hooks/use-discord-rpc"
import { useNotifications } from "@/components/notifications-system"

// `roundToDay`/`diaDaPartida` moraram aqui até a 1.0.222. Foram para
// lib/amistosos-calendario porque o amistoso precisa saber em que dia os jogos
// oficiais já caem para não abrir seu card em cima de um deles — e duas cópias
// da mesma regra em arquivos diferentes envelhecem em uma só.

// Os meses visiveis agora vem de seasonMonthsForDivision (derivado do
// LEAGUE_CALENDAR), garantindo que a aba do mes casa com o mes real dos jogos.
// As listas de regiao escritas a mao foram removidas por divergirem do calendario.

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

const MONTH_NAMES_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
]

const WEEK_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"]

const WEEKDAY_NAMES = [
  "DOMINGO", "SEGUNDA-FEIRA", "TERCA-FEIRA", "QUARTA-FEIRA", 
  "QUINTA-FEIRA", "SEXTA-FEIRA", "SABADO"
]

export default function CalendarioPage() {
  const router = useRouter()
  const { team: userTeam } = useUserTeam()
  const { addNotification } = useNotifications()
  useDiscordActivity("Vendo o calendario", userTeam.nome)
  const {
    seasonCalendar,
    currentWeek,
    currentSeason,
    advanceWeek,
    standings,
    hydrated,
    league,
  } = useGameManager()

  const seasonMonths = useMemo(() => seasonMonthsForDivision(league ?? "serie_a"), [league])
  const [currentMonth, setCurrentMonth] = useState(() => seasonMonths[0])
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [showChampionScreen, setShowChampionScreen] = useState(false)
  const [championTeam, setChampionTeam] = useState<string | null>(null)

  // Filtra fixtures por mes usando o campo month do fixture
  const monthFixtures = useMemo(() => {
    return seasonCalendar.fixtures.filter(f => {
      return f.month === currentMonth
    })
  }, [seasonCalendar.fixtures, currentMonth])

  // Proxima partida do usuario
  const nextUserMatch = seasonCalendar.nextUserMatch

  // Fixture selecionada
  const selectedFixture = useMemo(() => {
    if (!selectedDay) return nextUserMatch
    return monthFixtures.find(f => {
      const fixtureDay = diaDaPartida(f)
      return fixtureDay === selectedDay && f.isUserMatch
    }) || nextUserMatch
  }, [selectedDay, monthFixtures, nextUserMatch])

  // Data que corre na animacao (DIA a DIA, para dar imersao — antes o jogo pulava
  // de semana em semana). O engine continua avancando por semana nos bastidores:
  // a cada ~7 dias percorridos chamamos advanceWeek() (que usa refs, por isso pode
  // ser chamado em sequencia com seguranca).
  const [simDate, setSimDate] = useState<Date | null>(null)
  const [simProgress, setSimProgress] = useState(0)
  // PARADA DA SIMULAÇÃO.
  //
  // Em `ref`, não em estado: o laço roda dentro de um `useCallback` que capturou
  // o valor de quando começou. Com `useState`, a leitura lá dentro seria sempre
  // `false` e o botão não faria nada — o clássico closure velho. A `ref` é a
  // mesma caixa do começo ao fim.
  const pedidoDeParar = useRef(false)
  const [parando, setParando] = useState(false)

  // Fila de partidas pendentes — usada so para EXIBIR quantas serao simuladas.
  // (advanceWeek avanca UMA SEMANA por chamada; com copas em meio de semana, a
  // posicao na fila deixou de medir semanas — a conta certa e target.week.)
  const filaPendentes = useMemo(
    () => seasonCalendar.fixtures
      .filter(f => f.isUserMatch && !f.played)
      .sort((a, b) => a.week - b.week || a.id - b.id),
    [seasonCalendar.fixtures],
  )

  /** Quantas partidas serao simuladas antes da selecionada; null se ela nao esta na fila.
   *  Amistoso nao entra na contagem: ele nunca e simulado pelo motor — se a data
   *  passar sem o jogo, ele e cancelado (ver lib/amistosos-calendario). */
  const partidasAntesDoAlvo = useMemo(() => {
    if (!selectedFixture) return null
    const i = filaPendentes.findIndex(f => f.id === selectedFixture.id)
    if (i < 0) return null
    return filaPendentes.slice(0, i).filter(f => !ehAmistoso(f)).length
  }, [filaPendentes, selectedFixture])

  const simulateUntilMatch = useCallback(
    async (target: Fixture) => {
      if (isSimulating) return
      pedidoDeParar.current = false
      setParando(false)
      setIsSimulating(true)

      // Semanas REAIS ate o alvo (target.week - semana atual). O indice na fila
      // de pendentes nao serve mais: com as copas em MEIO DE SEMANA, duas
      // partidas dividem a mesma semana — o indice superestimava e a simulacao
      // parava/estourava no lugar errado ("simulo ate dezembro e para na
      // metade"). A data final tambem sai da semana (7 dias por rodada), nao do
      // palpite mes+dia.
      const weeks = Math.max(0, (target.week ?? 0) - currentWeek)
      const start = getGameDate(currentSeason, currentWeek)
      const end = getGameDate(currentSeason, target.week ?? currentWeek)
      const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000))

      // Quanto mais longe a data, mais rapido o dia corre (mantem a animacao curta).
      const delay = totalDays > 60 ? 18 : totalDays > 30 ? 32 : 55
      const perWeek = totalDays / Math.max(1, weeks)

      // BLINDAGEM (relato: "ao simular por um tempo o jogo crasha e fica
      // carregando"). Se advanceWeek lançar (ex.: virada de temporada complexa), o
      // loop abortava e isSimulating ficava true PARA SEMPRE — a tela ficava presa
      // em "carregando". Agora um erro numa semana INTERROMPE a simulação com
      // segurança, e o finally SEMPRE devolve a tela ao estado normal.
      let advanced = 0
      let falhou = false
      try {
        for (let d = 1; d <= totalDays && !falhou && !pedidoDeParar.current; d++) {
          setSimDate(new Date(start.getTime() + d * 86_400_000))
          setSimProgress(Math.round((d / totalDays) * 100))

          if (advanced < weeks && d >= Math.round((advanced + 1) * perWeek)) {
            try {
              await advanceWeek()
              advanced++
            } catch (e) {
              console.error("[calendario] falha ao avançar a semana durante a simulação:", e)
              falhou = true
            }
          }
          await new Promise(r => setTimeout(r, delay))
        }
        // O "recupera o que faltou" também precisa parar: sem isto, apertar
        // Parar no dia 3 de 200 ainda avançaria todas as semanas restantes de
        // uma vez — o oposto do que a pessoa pediu.
        while (advanced < weeks && !falhou && !pedidoDeParar.current) {
          try { await advanceWeek(); advanced++ }
          catch (e) { console.error("[calendario] falha ao avançar a semana:", e); falhou = true }
        }
      } finally {
        setIsSimulating(false)
        setSimProgress(0)
        setParando(false)
      }

      if (pedidoDeParar.current) {
        pedidoDeParar.current = false
        addNotification({
          type: "system", priority: "medium",
          title: "Simulação interrompida",
          message: advanced > 0
            ? `Você parou depois de avançar ${advanced} ${advanced === 1 ? "semana" : "semanas"}. `
              + "O que já passou continua valendo — dá para seguir daqui quando quiser."
            : "Nada foi avançado: você parou antes da primeira semana virar.",
        })
        return
      }

      if (falhou) {
        addNotification({
          type: "system", priority: "high",
          title: "Simulação interrompida",
          message: "Ocorreu um erro ao avançar as semanas. O progresso foi salvo até aqui — tente simular novamente ou avance uma partida por vez.",
        })
        return
      }
      hardNavigate("/partida")
    },
    [advanceWeek, currentWeek, currentSeason, isSimulating, addNotification],
  )

  // Esc para a simulação. É o gesto que a pessoa tenta primeiro numa tela cheia
  // que tomou conta do jogo; sem isto, o Esc não faz nada e parece travado.
  useEffect(() => {
    if (!isSimulating) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.preventDefault()
      pedidoDeParar.current = true
      setParando(true)
    }
    window.addEventListener("keydown", aoTeclar)
    return () => window.removeEventListener("keydown", aoTeclar)
  }, [isSimulating])

  // Dias do calendario
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(2026, currentMonth + 1, 0).getDate()
    const firstDayOfMonth = new Date(2026, currentMonth, 1).getDay()
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1
    const prevMonthDays = new Date(2026, currentMonth, 0).getDate()
    
    const days: { day: number; isCurrentMonth: boolean; fixture: Fixture | null }[] = []
    
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, isCurrentMonth: false, fixture: null })
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
      const fixture = monthFixtures.find(f => {
        const fixtureDay = diaDaPartida(f)
        return fixtureDay === d && f.isUserMatch
      })
      days.push({ day: d, isCurrentMonth: true, fixture: fixture || null })
    }
    
    const remaining = 42 - days.length
    for (let d = 1; d <= remaining; d++) {
      days.push({ day: d, isCurrentMonth: false, fixture: null })
    }
    
    return days
  }, [currentMonth, monthFixtures])

  // Janela de transferencias
  const transferWindow = useMemo(() => {
    const currentMonthNum = currentMonth + 1
    const isOpen = (currentMonthNum >= 1 && currentMonthNum <= 2) || (currentMonthNum >= 7 && currentMonthNum <= 8)
    const nextOpenMonth = currentMonthNum < 7 ? 7 : 1
    const daysUntil = isOpen ? 0 : Math.abs((nextOpenMonth - currentMonthNum) * 30)
    return { isOpen, daysUntil }
  }, [currentMonth])

  // Ha data FIFA neste mes? Nela o campeonato de clubes fica parado (a pausa foi
  // inserida no calendario por aplicarPausasFifa em use-game-manager).
  const dataFifaNoMes = useMemo(
    () => seasonCalendar.fixtures.some(f => f.competitionType === "fifa_break" && f.month === currentMonth),
    [seasonCalendar.fixtures, currentMonth],
  )
  // Em ano de Mundial, a pausa de junho/julho e a COPA DO MUNDO — muito maior que
  // uma data FIFA comum. O relato "nao aparece no calendario os jogos da copa em
  // junho/julho" vinha de a pausa aparecer so como um "Data FIFA" generico. Aqui
  // detectamos o Mundial no mes e as SEMANAS que ele ocupa, para destaca-lo.
  const mundialNoMes = useMemo(
    () => seasonCalendar.fixtures.some(f => f.competitionType === "fifa_break" && f.month === currentMonth && /copa do mundo/i.test(f.competition)),
    [seasonCalendar.fixtures, currentMonth],
  )

  const seasonCompetitions = useMemo(() => {
    const comps = new Set<string>()
    // Inclui todas as competicoes presentes nos fixtures do usuario
    seasonCalendar.fixtures.filter(f => f.isUserMatch).forEach(f => comps.add(f.competition))
    if (comps.size === 0) comps.add("Liga")
    return Array.from(comps)
  }, [seasonCalendar.fixtures])

  // handleAdvanceRound/canSimulate sairam junto com o rodape: eram usados so por
  // ele. Simular pelo calendario continua vivo em "Simular ate esta partida", na
  // barra lateral, que e o caminho que o jogador de fato usa.

  useEffect(() => {
    const handleGamepadButton = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail
      switch (button) {
        case "B":
          router.back()
          break
        case "LB":
          setCurrentMonth(m => {
            const idx = seasonMonths.indexOf(m)
            return seasonMonths[(idx - 1 + seasonMonths.length) % seasonMonths.length]
          })
          break
        case "RB":
          setCurrentMonth(m => {
            const idx = seasonMonths.indexOf(m)
            return seasonMonths[(idx + 1) % seasonMonths.length]
          })
          break
      }
    }
    window.addEventListener("gamepad:button", handleGamepadButton)
    return () => window.removeEventListener("gamepad:button", handleGamepadButton)
  }, [router, seasonMonths])

  useEffect(() => {
    if (nextUserMatch) {
      // diaDaPartida (e nao roundToDay) porque o amistoso tem dia proprio e
      // round 0 — roundToDay o jogaria para o dia 15 de qualquer mes.
      setSelectedDay(diaDaPartida(nextUserMatch))
      // Navega para o mes da proxima partida
      setCurrentMonth(nextUserMatch.month)
    }
  }, [nextUserMatch])

  if (!hydrated) {
    return (
      <div className="h-screen overflow-hidden md:pl-0 pl-0 pb-20 md:pb-0 bg-[#1a1a1a] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    )
  }

  // Data atual formatada usando month do fixture
  const matchMonth = nextUserMatch ? nextUserMatch.month : seasonMonths[0]
  const matchDay = nextUserMatch ? diaDaPartida(nextUserMatch) : 15
  const matchDate = new Date(2026, matchMonth, matchDay)
  const dayOfWeek = WEEKDAY_NAMES[matchDate.getDay()]
  const dayNum = matchDate.getDate()
  const monthName = MONTH_NAMES_SHORT[matchDate.getMonth()].toUpperCase()

  return (
  <div className="relative flex h-screen flex-col overflow-hidden md:pl-0 pl-0 pb-20 md:pb-0 bg-[#050508]">

  {/* Overlay de simulacao DIA A DIA (imersao: a data corre dia por dia ate a partida) */}
  {isSimulating && simDate && (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm">
      {/* Grade de calendário ao fundo: dá o assunto da tela sem escrever nada.
          Puro CSS — nenhuma imagem para carregar no meio de uma simulação. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(ellipse at center, #000 20%, transparent 72%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, #000 20%, transparent 72%)",
        }}
      />

      <div className="relative flex flex-col items-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[var(--brand)]">
          Simulando dias
        </div>

        {/* FOLHA DE CALENDÁRIO. A metáfora é a de arrancar a folha do dia: faixa
            do mês no topo, número grande, dia da semana embaixo. `key` no número
            faz o React remontar o nó a cada data — é o que dá o "vira a folha"
            sem biblioteca de animação. */}
        <div className="mt-5 w-[13.5rem] overflow-hidden rounded-2xl border border-white/12 bg-[#0b0b10] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.9)]">
          <div className="flex items-center justify-center bg-gradient-to-r from-[var(--brand)] to-[var(--brand-2)] py-2">
            <span className="text-sm font-black uppercase tracking-[0.2em] text-[var(--brand-ink)]">
              {MONTH_NAMES_SHORT[simDate.getMonth()]}
            </span>
          </div>
          <div className="flex flex-col items-center px-4 pb-4 pt-3">
            <div
              key={simDate.toDateString()}
              className="animate-in fade-in zoom-in-95 text-[5.5rem] font-black leading-none tabular-nums text-white duration-150"
            >
              {String(simDate.getDate()).padStart(2, "0")}
            </div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.25em] text-white/45">
              {["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"][simDate.getDay()]}
            </div>
          </div>
        </div>

        {/* A SEMANA CORRENDO. Sete casas, a de hoje acesa: mostra o movimento
            entre um dia e o outro, que é justamente o que a tela está fazendo e
            que o número sozinho não comunica. */}
        <div className="mt-5 flex items-center gap-1.5">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((letra, i) => (
            <div
              key={i}
              className={
                i === simDate.getDay()
                  ? "flex h-7 w-7 items-center justify-center rounded-md bg-[var(--brand)] text-[11px] font-black text-[var(--brand-ink)]"
                  : "flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.06] text-[11px] font-bold text-white/30"
              }
            >
              {letra}
            </div>
          ))}
        </div>

        <div className="mt-7 h-1.5 w-72 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-2)] transition-[width] duration-100"
            style={{ width: `${simProgress}%` }}
          />
        </div>
        {/* Diz PARA ONDE está indo. A barra sozinha informava só quanto falta —
            e o técnico não tinha como conferir se escolheu a data certa. */}
        <div className="mt-3 flex items-center gap-2 text-xs text-white/35">
          <span className="tabular-nums">{simProgress}%</span>
          {nextUserMatch && (
            <>
              <span className="text-white/15">·</span>
              <span>até {dayOfWeek} {String(dayNum).padStart(2, "0")} {monthName}</span>
            </>
          )}
        </div>
      </div>

      {/* PARAR. A simulação corre sozinha até a partida-alvo; sem saída, quem
          escolheu a data errada assiste meses passarem sem poder intervir.
          O aviso é explícito porque a parada NÃO desfaz o que já passou —
          descobrir isso depois de parar seria pior do que não ter o botão. */}
      <button
        onClick={() => { pedidoDeParar.current = true; setParando(true) }}
        disabled={parando}
        className="mt-9 flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white/80 transition-colors hover:border-white/30 hover:bg-white/[0.12] hover:text-white disabled:opacity-50"
      >
        <Square className="h-3.5 w-3.5" />
        {parando ? "Parando…" : "Parar simulação"}
      </button>
      <p className="mt-2.5 text-[11px] text-white/30">
        {parando
          ? "Terminando o dia atual…"
          : "Esc para parar. Os dias que já passaram continuam valendo."}
      </p>
    </div>
  )}

  {/* Background Image - Futuristic Grid */}
  {/* Sem md:ml-16: a margem reservava 64px para uma sidebar que NAO existe nesta
      tela, deixando uma faixa sem fundo na esquerda a partir do breakpoint md. */}
  <div className="absolute inset-0">
  <Image
  src="/images/pre-jogo/in-game-6.png"
  alt="Calendar Background"
  fill
  className="object-cover"
  priority
  />
  {/* Professional Vignette Overlays */}
  {/* Base dark overlay for readability */}
  <div className="absolute inset-0 bg-black/30" />
  
  {/* Left vignette - stronger for sidebar info */}
  <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />
  
  {/* Top vignette for month tabs */}
  <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent" />
  
  {/* Bottom vignette for footer controls */}
  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
  
  {/* Radial vignette for cinematic depth */}
  <div className="absolute inset-0" style={{ 
  background: "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 30%, rgba(0,0,0,0.5) 100%)" 
  }} />
  
  {/* Subtle corner accents to complement cyan glow */}
  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/40" />
  </div>

      {/* GameHeader padrão: dá ao calendário o menu [W], salvar e avançar —
          a página só tinha o header local de navegação de mês (relato). */}
      <div className="relative z-20"><GameHeader team={userTeam} /></div>

      {/* Top Navigation Bar */}
      <header className="relative z-10 flex items-center justify-between h-12 px-6 bg-black/30 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center gap-6">
          <span className="text-white/60 text-sm font-medium">Escritorio</span>
          <span className="text-white text-sm font-bold">Calendario</span>
          {/* Month Tabs */}
          <div className="flex items-center gap-1 ml-4">
            <button
              onClick={() => setCurrentMonth(m => {
                const idx = seasonMonths.indexOf(m)
                return seasonMonths[(idx - 1 + seasonMonths.length) % seasonMonths.length]
              })}
              className="p-1 text-white/40 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {seasonMonths.map((monthIndex) => (
              <button
                key={monthIndex}
                onClick={() => setCurrentMonth(monthIndex)}
                className={cn(
                  "px-3 py-1 text-xs font-medium transition-all rounded",
                  monthIndex === currentMonth
                    ? "bg-white/20 text-white"
                    : "text-white/50 hover:text-white/80"
                )}
              >
                {MONTH_NAMES[monthIndex]}
              </button>
            ))}
            <button
              onClick={() => setCurrentMonth(m => {
                const idx = seasonMonths.indexOf(m)
                return seasonMonths[(idx + 1) % seasonMonths.length]
              })}
              className="p-1 text-white/40 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* User Team */}
        <div className="flex items-center gap-2">
          <TeamCrest team={userTeam} size="xs" />
          <span className="text-white text-sm font-medium">{userTeam.nome}</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex min-h-0 flex-1 p-6 gap-6">
        {/* Left Panel - Match Info (EA FC Style) */}
        <aside className="w-56 flex-shrink-0 flex flex-col">
          {/* Current Date - Large */}
          <div className="mb-8">
            <div className="text-white/60 text-xs font-medium tracking-wider uppercase mb-1">
              {dayOfWeek}
            </div>
            <div className="text-white text-3xl font-black tracking-tight">
              {monthName} {dayNum}
            </div>
            <div className="text-white/50 text-sm">
              {2026}
            </div>
          </div>

          {/* Competition */}
          {selectedFixture && (
            <div className="mb-6">
              <div className="text-white text-sm font-bold">
                {selectedFixture.competition === "Brasileirao Serie A" ? "Brasileirao Serie A" : selectedFixture.competition}
              </div>
              {/* Fase do regulamento: sem isto o painel dizia so o nome da
                  competicao, e uma semifinal parecia rodada comum. */}
              {(() => {
                const fase = faseDaPartida(selectedFixture)
                if (!fase) return null
                return (
                  <div
                    className="mt-1.5 inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                    style={fase.isFinal
                      ? { background: "rgba(255,196,0,0.16)", borderColor: "rgba(255,196,0,0.55)", color: "#ffe08a" }
                      : fase.isKnockout
                        ? { background: "rgba(190,120,255,0.14)", borderColor: "rgba(190,120,255,0.5)", color: "#dcbcff" }
                        : { background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.55)" }}
                  >
                    {fase.label}
                  </div>
                )
              })()}
            </div>
          )}

          <Link href="/competicoes" className="mb-6 group block">
            <div className="flex items-center gap-2 text-white/50 text-xs font-medium uppercase tracking-wider mb-2 group-hover:text-white/70 transition-colors">
              <Trophy className="h-3.5 w-3.5 text-yellow-400" />
              Campeonatos
            </div>
            <div className="space-y-1.5">
              {seasonCompetitions.map((competition) => (
                <div key={competition} className="text-white/80 text-xs font-semibold leading-tight group-hover:text-white transition-colors">
                  {competition}
                </div>
              ))}
            </div>
          </Link>

          {/* Opponent Team with Stars */}
          {selectedFixture && (
            <div className="mb-8">
              {/* Stars */}
              <div className="flex gap-0.5 mb-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star 
                    key={star} 
                    className={cn(
                      "h-4 w-4",
                      star <= 3 ? "fill-yellow-400 text-yellow-400" : "text-white/20"
                    )} 
                  />
                ))}
              </div>
              
              {/* Large Team Crest */}
              <div className="relative mb-4">
                <TeamCrest 
                  team={selectedFixture.homeTeam.curto === userTeam.curto ? selectedFixture.awayTeam : selectedFixture.homeTeam} 
                  size="2xl" 
                />
              </div>
              
              {/* Team Name */}
              <div className="text-white text-xl font-black">
                {selectedFixture.homeTeam.curto === userTeam.curto
                  ? selectedFixture.awayTeam.nome
                  : selectedFixture.homeTeam.nome}
              </div>
            </div>
          )}

          {/* Simular ate a partida selecionada e ir para o jogo.
              Condicao pela FILA e nao por `week > currentWeek`: uma partida da
              semana corrente ainda nao jogada tambem precisa deste botao. */}
          {selectedFixture && !selectedFixture.played && selectedFixture.isUserMatch && partidasAntesDoAlvo !== null && (
            <button
              onClick={() => simulateUntilMatch(selectedFixture)}
              disabled={isSimulating}
              className={cn(
                "mb-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all",
                "bg-gradient-to-r from-[var(--brand)] to-[var(--brand-2)] text-black hover:brightness-110",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {isSimulating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Simulando...
                </>
              ) : partidasAntesDoAlvo === 0 ? (
                <>
                  <Play className="h-4 w-4" />
                  Ir para o jogo
                </>
              ) : (
                <>
                  <FastForward className="h-4 w-4" />
                  {/* Diz QUANTAS serao simuladas: o jogador escolhe sabendo o que
                      vai perder de jogar, em vez de descobrir depois. */}
                  Simular {partidasAntesDoAlvo} {partidasAntesDoAlvo === 1 ? "partida" : "partidas"} e jogar esta
                </>
              )}
            </button>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Transfer Window */}
          <div className="border-t border-white/10 pt-4">
            <div className="text-white/50 text-xs font-medium mb-1">
              {transferWindow.isOpen ? "Janela de Transferencias" : "Janela de Transferencias Fechada"}
            </div>
            {!transferWindow.isOpen ? (
              <>
                <div className="text-white text-4xl font-black">
                  {transferWindow.daysUntil}
                </div>
                <div className="text-white/50 text-xs">
                  Dias Ate Abrir
                </div>
              </>
            ) : (
              <div className="text-[#00ff88] text-lg font-bold">
                Aberta
              </div>
            )}
          </div>

          {/* Data FIFA: campeonato de clubes parado enquanto a janela de selecoes
              esta aberta (amistosos, Eliminatorias, Copa America/Euro, Mundial). */}
          {dataFifaNoMes && (
            <div className="border-t border-white/10 pt-4 mt-4">
              {mundialNoMes ? (
                <>
                  <div className="text-[var(--brand)] text-xs font-bold mb-1">🏆 Copa do Mundo FIFA</div>
                  <div className="text-white/60 text-xs leading-snug">
                    O Mundial toma junho e julho. O campeonato de clubes está pausado enquanto as seleções disputam o torneio.
                  </div>
                </>
              ) : (
                <>
                  <div className="text-amber-300/90 text-xs font-semibold mb-1">🌍 Data FIFA</div>
                  <div className="text-white/55 text-xs leading-snug">
                    Campeonato de clubes pausado — janela de seleções.
                  </div>
                </>
              )}
            </div>
          )}
        </aside>

        {/* Calendar Grid (EA FC Glassmorphism Style) */}
        <main className="flex-1 flex flex-col">
          <div className="flex-1 bg-white/10 backdrop-blur-md rounded-xl overflow-hidden border border-white/10">
            {/* Week days header */}
            <div className="grid grid-cols-7 border-b border-white/10">
              {WEEK_DAYS.map((day) => (
                <div key={day} className="p-3 text-center text-xs font-bold text-white/40 uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>

            {/* Faixa do Mundial: em junho/julho de ano de Copa, o torneio ocupa o
                mes. Antes so havia o card de clube (vazio na pausa) e o jogador
                achava que "a Copa nao aparecia". Agora ela toma a tela. */}
            {mundialNoMes && (
              <div className="flex items-center justify-center gap-2 border-b border-[var(--brand)]/25 bg-[var(--brand)]/[0.10] px-4 py-2 text-center">
                <Trophy className="h-4 w-4 text-[var(--brand)]" />
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand)]">Copa do Mundo FIFA em andamento</span>
                <span className="text-[11px] text-white/55">· clubes pausados</span>
              </div>
            )}

            {/* Calendar days */}
            <div className={cn("grid grid-cols-7 auto-rows-fr", mundialNoMes ? "h-[calc(100%-80px)]" : "h-[calc(100%-44px)]")}>
              {calendarDays.map((item, i) => {
                const isSelected = item.isCurrentMonth && item.day === selectedDay
                const hasMatch = item.fixture !== null
                const isHome = item.fixture?.homeTeam.curto === userTeam.curto
                const opponent = item.fixture ? (isHome ? item.fixture.awayTeam : item.fixture.homeTeam) : null
                // Mata-mata precisa saltar aos olhos no calendario: uma final nao pode
                // ter o mesmo cartao de uma rodada qualquer de pontos corridos.
                const fase = faseDaPartida(item.fixture)
                // Amistoso tem cara PROPRIA (cinza, tracejado): a pessoa precisa
                // distinguir de relance o jogo-treino do compromisso oficial —
                // era exatamente por nao aparecer aqui que ele parecia inexistente.
                const amistoso = ehAmistoso(item.fixture)
                const cores = amistoso
                  ? { fundo: "rgba(255,255,255,0.14)", borda: "rgba(255,255,255,0.45)", texto: "#e6e6e6" }
                  : fase?.isFinal
                  ? { fundo: "rgba(255, 196, 0, 0.38)", borda: "rgba(255, 196, 0, 0.85)", texto: "#ffe08a" }
                  : fase?.isKnockout
                    ? { fundo: "rgba(190, 120, 255, 0.32)", borda: "rgba(190, 120, 255, 0.7)", texto: "#dcbcff" }
                    : isHome
                      ? { fundo: "rgba(0, 136, 255, 0.35)", borda: "rgba(0, 136, 255, 0.6)", texto: "#8ed0ff" }
                      : { fundo: "rgba(0, 204, 102, 0.35)", borda: "rgba(0, 204, 102, 0.6)", texto: "#86ffb0" }
                
                return (
                  <button
                    key={i}
                    onClick={() => {
                      if (item.isCurrentMonth) setSelectedDay(item.day)
                    }}
                    disabled={!item.isCurrentMonth}
                    className={cn(
                      "relative overflow-hidden border-r border-b border-white/5 transition-all",
                      item.isCurrentMonth ? "hover:bg-white/5" : "opacity-30",
                      isSelected && "bg-white/10",
                    )}
                  >
                    {/* Day number */}
                    <span className={cn(
                      "absolute left-0 right-0 z-10 text-center font-bold",
                      !item.isCurrentMonth && "text-white/20",
                      item.isCurrentMonth && !hasMatch && "text-white/50",
                      hasMatch && "text-white"
                    )}
                    style={{ top: 8, fontSize: 24, lineHeight: "24px" }}
                    >
                      {item.day}
                    </span>

                    {/* Match Card (EA FC Style) */}
                    {hasMatch && opponent && (
                      <div
                        className="absolute left-2 right-2 rounded-lg px-2 flex items-center justify-center gap-1.5 overflow-hidden shadow-lg border"
                        style={{
                          bottom: 6,
                          height: 32,
                          backgroundColor: cores.fundo,
                          borderColor: cores.borda,
                          borderStyle: amistoso ? "dashed" : "solid",
                          boxShadow: fase?.isFinal ? "0 0 12px rgba(255,196,0,0.45)" : undefined,
                        }}
                      >
                        <TeamCrest team={opponent} size="xs" />
                        <div className="min-w-0 flex flex-col items-start leading-none">
                          <div
                            className="font-black uppercase"
                            style={{
                              color: cores.texto,
                              fontSize: 9,
                              lineHeight: "10px",
                            }}
                          >
                            {amistoso ? "Amistoso" : fase?.isKnockout ? fase.label : isHome ? "Casa" : "Fora"}
                          </div>
                          <div
                            className="font-bold text-white/60 uppercase"
                            style={{ fontSize: 8, lineHeight: "9px" }}
                          >
                            {amistoso
                              ? (item.fixture?.played
                                  ? `${item.fixture.homeScore ?? 0}x${item.fixture.awayScore ?? 0}`
                                  : isHome ? "Casa" : "Fora")
                              : fase?.isKnockout
                              ? (isHome ? "Casa" : "Fora")
                              : item.fixture?.competition === "Brasileirao Serie A" ? "Liga" : "Copa"}
                          </div>
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </main>
      </div>

      {/* Sem barra de acao no rodape: "Avancar" ja esta no cabecalho e o menu [W]
          cobre competicoes/partida. A barra so repetia o que ja havia e comia
          altura util do calendario. */}

      {/* Champion Screen */}
      {showChampionScreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative flex flex-col items-center gap-6 rounded-2xl bg-[#1a1a1a] p-10 max-w-md w-full mx-4 text-center border border-white/10">
            <Trophy className="h-16 w-16 text-yellow-500" />
            <h2 className="text-3xl font-black text-white tracking-tight">CAMPEAO!</h2>
            {championTeam && (
              <div className="flex flex-col items-center gap-3">
                <TeamCrest team={getTeamByShort(championTeam) ?? undefined} size="2xl" />
                <p className="text-xl font-bold text-white/80">
                  {getTeamByShort(championTeam)?.nome ?? championTeam}
                </p>
              </div>
            )}
            <p className="text-white/50 text-sm">Temporada {currentSeason} encerrada. Nova temporada iniciando!</p>
            <button
              onClick={() => setShowChampionScreen(false)}
              className="mt-2 px-8 py-3 rounded-xl bg-[#0088ff] text-white font-bold text-lg hover:bg-[#0066cc] transition-colors"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isSimulating && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-white" />
            <span className="text-white font-medium">Simulando...</span>
          </div>
        </div>
      )}
    </div>
  )
}
