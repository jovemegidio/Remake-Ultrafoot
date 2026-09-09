"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { TeamCrest } from "@/components/team-crest"
import type { Team } from "@/lib/teams-data"
import { corDoClubeSobreEscuro } from "@/lib/cor-legivel"
import { siglaExibivel } from "@/lib/club-identity"

/**
 * Fecha a animacao sozinha depois de `ms` — e o que devolve a partida ao relogio.
 *
 * BUG GRAVE que isto corrige ("a tela da partida nao sai ate acabar o tempo"):
 * todas as animacoes faziam
 *
 *     useEffect(() => {
 *       const t = setTimeout(() => onComplete?.(), 4000)
 *       return () => clearTimeout(t)
 *     }, [onComplete])          // <- onComplete recriado a cada render do pai
 *
 * A tela da partida re-renderiza o tempo todo (relogio, eventos, radar), entao o pai
 * recriava `onComplete` a cada render, o efeito refazia o cleanup e REINICIAVA o
 * setTimeout. O timer nunca chegava ao fim: onComplete() NUNCA era chamado. Qualquer
 * gol/cartao congelava a partida — e como ela nunca concluia, nao gerava resultado, o
 * fixture nao era marcado como jogado e o mesmo adversario voltava ("6 jogos contra o
 * City"). Guardando onComplete num ref, o timer passa a depender so da duracao.
 */
function useAutoDismiss(onComplete: (() => void) | undefined, ms: number) {
  const ref = useRef(onComplete)
  useEffect(() => { ref.current = onComplete }, [onComplete])
  useEffect(() => {
    const timer = setTimeout(() => ref.current?.(), ms)
    return () => clearTimeout(timer)
  }, [ms])
}

// Tipos de eventos suportados
export type AnimatableEvent = "goal" | "penalty" | "yellow_card" | "red_card" | "foul" | "var"

interface EventAnimationProps {
  event: AnimatableEvent | null
  team?: Team
  player?: string
  minute?: number
  onComplete?: () => void
  isUserTeam?: boolean
  /**
   * O RITO DO VAR, vindo do motor (ver lib/match-engine, `varReview`).
   *
   * ⚠️ Sem isto a checagem era uma roda girando com "CHECANDO LANCE..." — e o
   * motor ja sabia MUITO mais: o que esta sendo olhado (`reason`), se e gol ou
   * penalti (`incident`) e, sobretudo, se o arbitro vai ao MONITOR ou se a
   * cabine resolve sozinha (`noMonitor`). Os tres ritos existem no motor com
   * comentario explicando por que sao tres; a tela mostrava um so.
   */
  varReview?: {
    incident: "goal" | "penalty" | "red_card"
    reason: string
    /** Ausente em evento antigo: sem ele a tela assume o rito da cabine. */
    noMonitor?: boolean
  }
}

// Animacao de GOL - Estilo EA FC
function GoalAnimation({ team, player, minute, onComplete }: Omit<EventAnimationProps, "event">) {
  useAutoDismiss(onComplete, 4000)

  // Usada no texto, no brilho e nas particulas: se a cor do clube nao se le sobre
  // o overlay escuro, tudo isso desaparecia junto.
  const corDoGol = corDoClubeSobreEscuro(team?.cor1, team?.cor2) || "#00ffc8"

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onComplete}
      className="fixed inset-0 z-50 flex items-center justify-center uf-veu cursor-pointer"
    >
      {/* Particulas de fundo */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              opacity: 0,
              x: "50%",
              y: "50%",
              scale: 0
            }}
            animate={{ 
              opacity: [0, 1, 0],
              x: `${Math.random() * 100}%`,
              y: `${Math.random() * 100}%`,
              scale: [0, 1, 0.5]
            }}
            transition={{ 
              duration: 2,
              delay: Math.random() * 0.5,
              ease: "easeOut"
            }}
            className="absolute w-2 h-2 rounded-full"
            style={{ backgroundColor: corDoGol }}
          />
        ))}
      </div>

      {/* Conteudo principal */}
      <div className="relative flex flex-col items-center">
        {/* Flash de luz */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 3, 2], opacity: [0, 0.5, 0] }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="absolute w-64 h-64 rounded-full"
          style={{ 
            background: `radial-gradient(circle, ${corDoGol}40, transparent)`
          }}
        />

        {/* Escudo do time */}
        {/*
          `spring` so aceita DOIS keyframes. Com `scale: [0, 1.2, 1]` o Framer
          Motion lanca "Only two keyframes currently supported with spring and
          inertia animations", o erro sobe como Runtime Error e a partida TRAVA
          — no gol, que e o evento mais comum do jogo.

          O keyframe do meio existia para o escudo passar de 1 e voltar. O
          proprio spring com `bounce` ja faz isso: ele ultrapassa o alvo e
          assenta. Dois keyframes bastam, e o efeito visual continua o mesmo.
        */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
        >
          {team && <TeamCrest team={team} size="2xl" className="w-28 h-28" />}
        </motion.div>

        {/* Texto GOL */}
        <motion.div
          initial={{ scale: 0, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, type: "spring" }}
          className="mt-6"
        >
          <h1
            className="text-7xl md:text-9xl font-black tracking-tighter"
            style={{
              // Corinthians tem cor1 "#000000": o GOOOL saia PRETO sobre o
              // overlay preto e ninguem lia o lance mais importante do jogo.
              // corDoClubeSobreEscuro cai na SEGUNDA cor do clube (branco, no
              // caso) em vez de abandonar a identidade.
              color: corDoGol,
              textShadow: `0 0 60px ${corDoGol}80`
            }}
          >
            GOOOL!
          </h1>
        </motion.div>

        {/* Nome do jogador */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="mt-4 flex items-center gap-3"
        >
          <span className="text-white/60 text-xl">{minute}&apos;</span>
          <span className="text-white text-2xl md:text-3xl font-bold">{player || "Jogador"}</span>
        </motion.div>

        {/* Barra animada inferior */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="mt-8 h-1 w-64 rounded-full origin-left"
          style={{ backgroundColor: team?.cor1 || "#00ffc8" }}
        />
      </div>
    </motion.div>
  )
}

// Animacao de PENALTI
function PenaltyAnimation({ team, minute, onComplete }: Omit<EventAnimationProps, "event">) {
  useAutoDismiss(onComplete, 3000)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onComplete}
      className="fixed inset-0 z-50 flex items-center justify-center uf-veu cursor-pointer"
    >
      {/* Spotlight */}
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="absolute w-96 h-96 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(255,200,0,0.2) 0%, transparent 70%)"
        }}
      />

      <div className="relative flex flex-col items-center">
        {/* Icone de penalti (ponto + bola) */}
        {/* Mesmo caso do gol: spring nao aceita 3 keyframes. O bounce do
            proprio spring da o "estica e volta" que o 1.3 fazia. */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.6, type: "spring", bounce: 0.5 }}
          className="relative"
        >
          <div className="w-32 h-32 rounded-full border-4 border-amber-400 flex items-center justify-center bg-amber-400/10">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="w-12 h-12 rounded-full bg-white shadow-lg"
            />
          </div>
        </motion.div>

        {/* Texto PENALTI */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-6 text-5xl md:text-7xl font-black text-amber-400 tracking-tight"
          style={{ textShadow: "0 0 40px rgba(255,200,0,0.5)" }}
        >
          PENALTI!
        </motion.h1>

        {/* Info do time */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-4 flex items-center gap-3"
        >
          {team && <TeamCrest team={team} size="sm" />}
          <span className="text-white/80 text-lg">{team?.nome}</span>
          <span className="text-white/40 text-sm">{minute}&apos;</span>
        </motion.div>
      </div>
    </motion.div>
  )
}

// Animacao de CARTAO AMARELO
function YellowCardAnimation({ team, player, minute, onComplete }: Omit<EventAnimationProps, "event">) {
  useAutoDismiss(onComplete, 2500)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onComplete}
      className="fixed inset-0 z-50 flex items-center justify-center uf-veu cursor-pointer"
    >
      <div className="flex flex-col items-center">
        {/* Cartao */}
        <motion.div
          initial={{ rotateY: 90, y: -100 }}
          animate={{ rotateY: 0, y: 0 }}
          transition={{ duration: 0.6, type: "spring", bounce: 0.3 }}
          className="w-24 h-36 md:w-32 md:h-48 rounded-lg bg-gradient-to-b from-yellow-400 to-yellow-500 shadow-2xl"
          style={{ 
            boxShadow: "0 0 60px rgba(234,179,8,0.6)",
            transformStyle: "preserve-3d"
          }}
        />

        {/* Texto */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-center"
        >
          <h2 className="uf-heading text-3xl md:text-4xl font-bold text-yellow-400">CARTAO AMARELO</h2>
          <div className="mt-2 flex items-center justify-center gap-3">
            {team && <TeamCrest team={team} size="xs" />}
            <span className="text-white text-lg">{player}</span>
            <span className="text-white/40">{minute}&apos;</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

// Animacao de CARTAO VERMELHO
function RedCardAnimation({ team, player, minute, onComplete }: Omit<EventAnimationProps, "event">) {
  useAutoDismiss(onComplete, 3500)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onComplete}
      className="fixed inset-0 z-50 flex items-center justify-center uf-veu cursor-pointer"
    >
      {/* Flash vermelho */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.3, 0, 0.2, 0] }}
        transition={{ duration: 1.5, times: [0, 0.2, 0.4, 0.6, 1] }}
        className="absolute inset-0 bg-red-600"
      />

      <div className="relative flex flex-col items-center">
        {/* Cartao com efeito de "jogando" */}
        {/*
          Mesmo caso do gol e do penalti — aqui com QUATRO keyframes em tres
          propriedades. O `[null, 0, 5, 0]` fazia o cartao chegar, passar um
          pouco e assentar; o bounce do spring reproduz isso partindo do
          `initial`, e sem quebrar a partida.
        */}
        <motion.div
          initial={{ rotateZ: -45, y: -200, x: -100 }}
          animate={{ rotateZ: 0, y: 0, x: 0 }}
          transition={{ duration: 0.8, type: "spring", bounce: 0.45 }}
          className="w-28 h-40 md:w-36 md:h-52 rounded-lg bg-gradient-to-b from-red-500 to-red-700 shadow-2xl"
          style={{ 
            boxShadow: "0 0 80px rgba(239,68,68,0.7)"
          }}
        />

        {/* Texto EXPULSO */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.2, 1] }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="mt-8"
        >
          <h1 className="uf-heading text-5xl md:text-7xl font-black text-red-500 tracking-tight"
            style={{ textShadow: "0 0 40px rgba(239,68,68,0.8)" }}
          >
            EXPULSO!
          </h1>
        </motion.div>

        {/* Info do jogador */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="mt-4 flex items-center gap-3"
        >
          {team && <TeamCrest team={team} size="sm" />}
          <span className="text-white text-xl font-semibold">{player}</span>
          <span className="text-white/40">{minute}&apos;</span>
        </motion.div>
      </div>
    </motion.div>
  )
}

// Animacao de FALTA
function FoulAnimation({ team, minute, onComplete }: Omit<EventAnimationProps, "event">) {
  useAutoDismiss(onComplete, 2000)

  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50"
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        className="bg-black/90 backdrop-blur-sm border border-white/10 rounded-xl px-8 py-4 flex items-center gap-4"
      >
        <motion.div
          animate={{ rotate: [0, -10, 10, 0] }}
          transition={{ duration: 0.5, repeat: 2 }}
        >
          <svg className="w-8 h-8 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
        </motion.div>
        <div>
          <span className="text-amber-400 font-bold text-lg">FALTA</span>
          <div className="flex items-center gap-2 text-white/60 text-sm">
            {team && <TeamCrest team={team} size="xs" />}
            <span>{team ? siglaExibivel(team.curto, team.nome) : ""}</span>
            <span>{minute}&apos;</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── VAR ────────────────────────────────────────────────────────────────────
//
// ⚠️ ISTO ERA UMA RODA GIRANDO. O modal do VAR mostrava um circulo azul e a
// frase "CHECANDO LANCE...", igual para todo lance do jogo — e o pedido do
// relatorio (PDF Ultra26, p.2) foi direto: "esse modal do var deve ser imersivo
// como o modal de penalty".
//
// A imersao ja estava PRONTA, do lado errado da fronteira. O motor
// (lib/match-engine) produz, para cada checagem: o que esta sendo olhado
// (`reason` — impedimento, toque de mao, falta na origem), se e gol ou penalti
// (`incident`) e, o mais importante, se o arbitro VAI AO MONITOR ou se a cabine
// resolve sozinha (`noMonitor`). Aquele arquivo tem um comentario inteiro
// explicando por que os ritos sao TRES e por que isso importa — "a primeira
// versao mandava todo penalti ao monitor e 84% das checagens viravam revisao em
// campo; o rito raro virou rotina, que e como se mata a tensao".
//
// A tela desenhava um rito so. Este componente passa a desenhar os tres.
//
// ⚠️ E ELE CONTINUA SEM ENTREGAR A DECISAO. O motor e explicito: "o texto da
// checagem diz o que esta sendo olhado, nunca o que vai dar". A decisao chega
// num SEGUNDO overlay, depois de `resolveVar()` — a espera e a graca do lance,
// e adiantar o resultado aqui destruiria a unica coisa que ele tem a oferecer.

/** As fases do rito, encenadas em sequencia como a narracao do penalti. */
const PASSOS_DA_CHECAGEM = [
  "Lance parado. O arbitro leva a mao ao ouvido.",
  "A cabine do VAR revisa as imagens.",
] as const

function VarAnimation({ team, varReview, onComplete }: Omit<EventAnimationProps, "event">) {
  // Um pouco mais longa que os 3s de antes: a apreensao precisa de tempo para
  // existir, e agora ha o que ler na tela enquanto ela dura.
  useAutoDismiss(onComplete, 4200)

  const [passo, setPasso] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setPasso(p => Math.min(p + 1, PASSOS_DA_CHECAGEM.length)), 1300)
    return () => window.clearInterval(timer)
  }, [])

  const incidente = varReview?.incident === "penalty" ? "MARCACAO DE PENALTI"
    : varReview?.incident === "red_card" ? "CARTAO VERMELHO"
      : "LANCE DO GOL"
  const aoMonitor = varReview ? !varReview.noMonitor : false

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onComplete}
      className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center uf-veu"
    >
      {/* Varredura: uma linha atravessando a tela, como o monitor do arbitro. */}
      <motion.div
        animate={{ top: ["8%", "92%", "8%"] }}
        transition={{ repeat: Infinity, duration: 3.4, ease: "linear" }}
        className="pointer-events-none absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-400/70 to-transparent"
      />

      <div className="relative flex w-[min(560px,90vw)] flex-col items-center px-6">
        {/* Quem esta sob revisao. O escudo era o dado mais obvio que faltava:
            a tela nao dizia de QUEM era o lance sendo checado. */}
        {team && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 flex items-center gap-2.5"
          >
            <TeamCrest team={team} size="sm" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/45">
              {incidente}
            </span>
          </motion.div>
        )}

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.08, 1] }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
            className="h-28 w-28 rounded-full border-4 border-blue-400/25 border-t-blue-400"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-black tracking-wider text-blue-400">VAR</span>
          </div>
        </motion.div>

        {/* O MOTIVO — o dado que o motor sorteia e que ninguem lia. */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="mt-6 text-center"
        >
          <h2 className="uf-heading text-xl font-bold text-blue-400">CHECANDO...</h2>
          {varReview?.reason && (
            <p className="mt-1.5 text-sm font-semibold capitalize text-white/80">{varReview.reason}</p>
          )}
        </motion.div>

        {/* A encenacao, falas entrando uma a uma — o mesmo recurso que o modal
            de penalti usa para transformar espera em tensao. */}
        <div className="mt-5 flex min-h-[46px] flex-col items-center gap-1">
          {PASSOS_DA_CHECAGEM.slice(0, passo).map((fala, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[12px] text-white/45"
            >
              {fala}
            </motion.p>
          ))}
          {/* ⚠️ O TERCEIRO RITO. So aparece quando o motor diz que o arbitro foi
              chamado ao monitor — e e o unico caso em que o estadio para. Ele nao
              revela a decisao: ir ao monitor nao diz o que vai sair de la. */}
          {aoMonitor && passo >= PASSOS_DA_CHECAGEM.length && (
            <motion.p
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-1 rounded-full border border-blue-400/40 bg-blue-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-blue-300"
            >
              O arbitro vai ao monitor
            </motion.p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// Componente principal que renderiza a animacao correta
export function EventAnimation({ event, team, player, minute, onComplete, varReview }: EventAnimationProps) {
  if (!event) return null

  return (
    <AnimatePresence mode="wait">
      {event === "goal" && (
        <GoalAnimation 
          key="goal"
          team={team} 
          player={player} 
          minute={minute} 
          onComplete={onComplete} 
        />
      )}
      {event === "penalty" && (
        <PenaltyAnimation 
          key="penalty"
          team={team} 
          minute={minute} 
          onComplete={onComplete} 
        />
      )}
      {event === "yellow_card" && (
        <YellowCardAnimation 
          key="yellow"
          team={team} 
          player={player} 
          minute={minute} 
          onComplete={onComplete} 
        />
      )}
      {event === "red_card" && (
        <RedCardAnimation 
          key="red"
          team={team} 
          player={player} 
          minute={minute} 
          onComplete={onComplete} 
        />
      )}
      {event === "foul" && (
        <FoulAnimation 
          key="foul"
          team={team} 
          minute={minute} 
          onComplete={onComplete} 
        />
      )}
      {event === "var" && (
        <VarAnimation
          key="var"
          team={team}
          varReview={varReview}
          onComplete={onComplete}
        />
      )}
    </AnimatePresence>
  )
}
