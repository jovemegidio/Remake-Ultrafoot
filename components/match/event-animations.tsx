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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md cursor-pointer"
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md cursor-pointer"
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm cursor-pointer"
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
          <h2 className="text-3xl md:text-4xl font-bold text-yellow-400">CARTAO AMARELO</h2>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md cursor-pointer"
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
          <h1 className="text-5xl md:text-7xl font-black text-red-500 tracking-tight"
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

// Animacao de VAR
function VarAnimation({ onComplete }: Omit<EventAnimationProps, "event">) {
  useAutoDismiss(onComplete, 3000)
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onComplete}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md cursor-pointer"
    >
      <div className="flex flex-col items-center">
        {/* Linhas de scan */}
        <motion.div
          animate={{ y: [0, 100, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="absolute w-full h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-50"
        />

        {/* Logo VAR */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.1, 1] }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
            className="w-32 h-32 rounded-full border-4 border-blue-400/30 border-t-blue-400"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-black text-blue-400">VAR</span>
          </div>
        </motion.div>

        {/* Texto */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-center"
        >
          <h2 className="text-2xl font-bold text-blue-400">CHECANDO LANCE...</h2>
          <p className="text-white/50 text-sm mt-1">Video Assistant Referee</p>
        </motion.div>
      </div>
    </motion.div>
  )
}

// Componente principal que renderiza a animacao correta
export function EventAnimation({ event, team, player, minute, onComplete }: EventAnimationProps) {
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
          onComplete={onComplete} 
        />
      )}
    </AnimatePresence>
  )
}
