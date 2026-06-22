"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { TeamCrest } from "@/components/team-crest"
import { useActionBar } from "@/components/ea-action-bar"
import { useGameState } from "@/lib/save-system"
import { useGameManager } from "@/lib/use-game-manager"
import { getTeamByShort, serieATeams } from "@/lib/teams-data"

const MESES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

function formatLongDate(ts: number) {
  const d = new Date(ts || Date.now())
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()} ${hh}:${mm}`
}

type Tab = "principais" | "controle"

export default function SalvarPage() {
  const router = useRouter()
  const { state } = useGameState()
  const { seasonCalendar } = useGameManager()

  const [tab, setTab] = useState<Tab>("principais")
  const [naming, setNaming] = useState(false)
  const [saveName, setSaveName] = useState("Carreira de Manager - progresso 1")
  const [savedName, setSavedName] = useState("Carreira de Manager - progresso 1")

  const userTeam = useMemo(
    () => getTeamByShort(state.selectedTeamShort || "") || serieATeams[0],
    [state.selectedTeamShort],
  )
  const managerName = (state.managerName || "Tecnico").toUpperCase()
  const lastModified = formatLongDate(state.updatedAt)
  const nextMatch = seasonCalendar.nextUserMatch

  const currentDate = useMemo(() => {
    const d = new Date(state.updatedAt || Date.now())
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
  }, [state.updatedAt])

  // Barra de acoes inferior fiel a referencia
  useActionBar(
    naming
      ? [
          { keyLabel: "enter", label: "Pronto", onClick: () => setNaming(false) },
          { keyLabel: "Esc", label: "Voltar", onClick: () => setNaming(false) },
        ]
      : [
          { keyLabel: "enter", label: "Selecionar" },
          { keyLabel: "Esc", label: "Voltar", onClick: () => router.push("/configuracoes") },
          { keyLabel: "q", label: "Liberar espacos" },
        ],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (naming) setNaming(false)
        else router.push("/configuracoes")
      } else if (e.key === "Enter" && naming) {
        setSavedName(saveName)
        setNaming(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [naming, saveName, router])

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#05080a]">
      {/* Fundo de estadio com gradiente */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <Image src="/images/stadium-night.png" alt="" fill priority className="object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#05080a] via-[#05080a]/70 to-[#05080a]/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#05080a]/80 via-transparent to-[#05080a]/80" />
      </div>

      {/* Cabecalho: emblema mc + trilha Personalizar > Salvar + sub-abas */}
      <header className="relative z-10 flex h-20 shrink-0 items-center gap-5 px-10">
        <button
          onClick={() => router.push("/")}
          aria-label="Inicio"
          className="flex h-11 shrink-0 items-center justify-center rounded-lg px-1 transition-opacity hover:opacity-80"
        >
          <Image
            src="/brand/uf26-logo.png"
            alt="UF26"
            width={120}
            height={44}
            className="h-9 w-auto object-contain"
            priority
          />
        </button>

        {/* Secao pai */}
        <button
          onClick={() => router.push("/configuracoes")}
          className="group flex shrink-0 flex-col items-center gap-1"
        >
          <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded-[4px] border border-white/20 bg-white/[0.06] px-1 font-mono text-[9px] font-semibold text-white/70">
            W
          </kbd>
          <span className="text-[15px] font-semibold tracking-wide text-white/40 transition-colors group-hover:text-white/70">
            Personalizar
          </span>
        </button>

        {/* Pagina atual */}
        <span className="shrink-0 pb-[2px] text-[18px] font-extrabold tracking-tight text-white">Salvar</span>

        {/* Divisor */}
        <div className="mx-3 h-7 w-px bg-white/15" />

        {/* Sub-abas */}
        <nav className="flex items-end gap-7">
          <button
            onClick={() => setTab("principais")}
            className="group flex flex-col items-start gap-1"
          >
            <span className="flex gap-1">
              <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded-[4px] border border-white/20 bg-white/[0.06] px-1 font-mono text-[9px] font-semibold text-white/70">
                X
              </kbd>
              <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded-[4px] border border-white/20 bg-white/[0.06] px-1 font-mono text-[9px] font-semibold text-white/70">
                C
              </kbd>
            </span>
            <span
              className={cn(
                "text-[15px] font-bold tracking-tight transition-colors",
                tab === "principais" ? "text-white" : "text-white/40 group-hover:text-white/70",
              )}
            >
              Espacos Principais
            </span>
          </button>
          <button
            onClick={() => setTab("controle")}
            className="flex items-end pb-[2px]"
          >
            <span
              className={cn(
                "text-[15px] font-bold tracking-tight transition-colors",
                tab === "controle" ? "text-white" : "text-white/40 hover:text-white/70",
              )}
            >
              Pontos de Controle
            </span>
          </button>
        </nav>
      </header>

      {/* Conteudo */}
      <main className="relative z-10 flex-1 overflow-y-auto px-10 pb-24">
        {/* Linha de instrucao + espacos livres */}
        <div className="mb-8 mt-2 flex items-start justify-between gap-6">
          <p className="max-w-3xl text-[15px] leading-relaxed text-white/55">
            {tab === "principais"
              ? "Crie um arquivo para salvar o seu progresso. Todos os seus salvamentos automaticos usarao este espaco."
              : "Crie um ponto de controle no qual voce podera voltar a qualquer momento. O salvamento automatico nao altera os pontos de controle."}
          </p>
          <p className="shrink-0 text-[15px] font-bold text-white">
            Espacos livres <span className="ml-1 font-semibold text-white/70">15</span>
          </p>
        </div>

        {/* Grade de cards */}
        <div className="mx-auto grid max-w-[1080px] grid-cols-1 gap-6 md:grid-cols-2">
          {/* Card vazio: criar novo */}
          <button
            onClick={() => setNaming(true)}
            className="group flex h-[560px] items-center justify-center rounded-2xl border border-white/[0.07] bg-black/40 transition-colors hover:border-white/20 hover:bg-black/30"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white transition-transform group-hover:scale-105">
              <Plus className="h-10 w-10 text-black" strokeWidth={3} />
            </span>
          </button>

          {/* Card de save existente */}
          <div className="flex h-[560px] flex-col rounded-2xl border border-[#00ffc8]/60 bg-black/55 px-8 py-7 shadow-[0_0_34px_rgba(0,255,200,0.12)]">
            {/* Titulo com glifo mc */}
            <div className="flex items-center justify-center gap-1.5">
              <span
                className="text-[22px] font-bold italic leading-none text-white/85"
                style={{ fontFamily: "var(--font-display, var(--font-oswald)), sans-serif" }}
              >
                mc
              </span>
              <h2 className="truncate text-[22px] font-extrabold tracking-tight text-white">
                {savedName.length > 22 ? `${savedName.slice(0, 22)}` : savedName}
              </h2>
            </div>
            <p className="mt-1.5 text-center text-[13px] font-semibold text-[#00ffc8]">
              Ultima modificacao: {lastModified}
            </p>

            {/* Escudo + time + manager */}
            <div className="mt-5 flex flex-col items-center gap-3">
              <TeamCrest team={userTeam} size="2xl" />
              <p className="text-[15px] font-medium text-white">{userTeam.nome}</p>
              <p className="text-[18px] font-extrabold tracking-tight text-white">{managerName}</p>
            </div>

            <div className="mx-auto my-5 h-px w-[78%] bg-white/12" />

            {/* Proxima partida */}
            <p className="text-center text-[14px] font-medium text-white/70">Proxima partida</p>
            <div className="mt-4 flex flex-col items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center">
                <Image
                  src="/images/leagues-logos.png"
                  alt="Liga"
                  width={28}
                  height={28}
                  className="h-7 w-7 object-contain opacity-90"
                />
              </div>
              <div className="flex items-center gap-6">
                <TeamCrest team={userTeam} size="lg" />
                <span className="text-[15px] font-semibold text-white/70">X</span>
                <TeamCrest team={nextMatch ? (nextMatch.homeTeam.curto === userTeam.curto ? nextMatch.awayTeam : nextMatch.homeTeam) : serieATeams[1]} size="lg" />
              </div>
            </div>

            <p className="mt-auto pt-5 text-center text-[14px] text-white/60">Data atual: {currentDate}</p>
          </div>
        </div>

        {/* Botao gradiente: Substituir carreira */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => setNaming(true)}
            className="group relative inline-flex items-center gap-3 rounded-full p-[2px]"
            style={{ background: "linear-gradient(90deg, #00ffc8 0%, #00c8ff 45%, #8b5cf6 100%)" }}
          >
            <span className="flex items-center gap-3 rounded-full bg-[#0a0d12] px-7 py-3.5 transition-colors group-hover:bg-[#0d1117]">
              <kbd className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-white/15 bg-black/60 px-1.5 font-mono text-[13px] text-white/80">
                {"\u21B5"}
              </kbd>
              <span className="text-[15px] font-bold text-white">Substituir carreira</span>
            </span>
          </button>
        </div>
      </main>

      {/* Modal de nomear (ref 23) */}
      {naming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black animate-fade-in">
          <div
            className="w-[min(680px,90vw)] rounded-full p-[2px]"
            style={{ background: "linear-gradient(90deg, #00ffc8 0%, #00c8ff 100%)" }}
          >
            <div className="rounded-full bg-[#0d1015] px-8 py-5">
              <input
                autoFocus
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="w-full bg-transparent text-center text-[26px] font-medium tracking-tight text-white outline-none placeholder:text-white/30"
                placeholder="Nome do arquivo"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
