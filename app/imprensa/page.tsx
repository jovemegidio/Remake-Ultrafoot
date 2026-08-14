"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { Calendar, ChevronRight, Flame, History, Meh, MessageCircle, MicOff, Newspaper, Quote, Shield, ThumbsDown, ThumbsUp, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useGameEngine, type PressConference, type PressResponse } from "@/lib/game-engine"
import { cn } from "@/lib/utils"

function toneFromConference(conference: PressConference): "positivo" | "neutro" | "negativo" {
  let positive = 0
  let negative = 0
  for (const response of conference.responses) {
    const question = conference.questions.find(item => item.id === response.questionId)
    const tone = question?.options[response.selectedOption]?.tone
    if (tone === "positivo") positive++
    if (tone === "negativo" || tone === "agressivo") negative++
  }
  return positive > negative ? "positivo" : negative > positive ? "negativo" : "neutro"
}

export default function ImprensaPage() {
  const router = useRouter()
  const gameEngine = useGameEngine()
  const initialized = useRef(false)
  const [showResult, setShowResult] = useState(false)
  const [lastResponses, setLastResponses] = useState<PressResponse[]>([])
  const {
    nextPressConference,
    currentConferenceResponses,
    pressConferences,
    squadMorale,
    generatePressConference,
    respondToPressConference,
  } = gameEngine

  useEffect(() => {
    const handler = (event: Event) => {
      if ((event as CustomEvent).detail?.button === "B") router.back()
    }
    window.addEventListener("gamepad:button", handler)
    return () => window.removeEventListener("gamepad:button", handler)
  }, [router])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    if (!nextPressConference && pressConferences.length === 0) generatePressConference()
  }, [generatePressConference, nextPressConference, pressConferences.length])

  const currentQuestion = nextPressConference?.find(
    question => !currentConferenceResponses.some(response => response.questionId === question.id),
  ) ?? null
  const questionNumber = currentConferenceResponses.length + 1
  const questionCount = nextPressConference?.length ?? Math.max(lastResponses.length, 1)
  const totalImpact = lastResponses.reduce((sum, response) => sum + response.impact, 0)

  const history = useMemo(() => [...pressConferences].reverse(), [pressConferences])

  const answerQuestion = (optionIndex: number) => {
    if (!currentQuestion || !nextPressConference) return
    const option = currentQuestion.options[optionIndex]
    if (!option) return
    const response: PressResponse = { questionId: currentQuestion.id, selectedOption: optionIndex, impact: option.impact }
    const completed = [...currentConferenceResponses, response]
    const isLast = completed.length >= nextPressConference.length
    if (isLast) setLastResponses(completed)
    respondToPressConference(currentQuestion.id, optionIndex)
    if (isLast) setShowResult(true)
  }

  const restartConference = () => {
    setLastResponses([])
    setShowResult(false)
    generatePressConference()
  }

  return (
    <div className="h-screen bg-[#050508] flex flex-col overflow-hidden">
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <header className="mx-auto mb-6 flex w-full max-w-3xl items-center justify-between">
          <div><h1 className="text-2xl font-bold text-white md:text-3xl">Sala de Imprensa</h1><p className="text-sm text-white/50">As respostas alteram e ficam registradas na carreira</p></div>
          <Button variant="ghost" size="icon" onClick={() => router.push("/pre-office")} className="text-white/60"><X className="h-5 w-5" /><span className="sr-only">Fechar</span></Button>
        </header>

        <AnimatePresence mode="wait">
          {!showResult && currentQuestion ? (
            <motion.section key="conference" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="mx-auto max-w-3xl">
              <div className="mb-6"><div className="mb-2 flex justify-between text-sm"><span className="text-white/70">Pergunta {questionNumber} de {questionCount}</span><span className="font-medium text-primary">{Math.round((currentConferenceResponses.length / questionCount) * 100)}%</span></div><Progress value={(currentConferenceResponses.length / questionCount) * 100} className="h-2" /></div>
              <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 md:p-8">
                <div className="mb-8 flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15"><Newspaper className="h-6 w-6 text-primary" /></div><div><p className="font-medium text-white">Jornalista credenciado</p><p className="text-sm text-white/50">Coletiva oficial · Semana {gameEngine.currentWeek}</p></div></div>
                <div className="mb-8 flex items-start gap-3"><Quote className="mt-1 h-6 w-6 shrink-0 text-primary" /><p className="text-xl leading-relaxed text-white">{currentQuestion.question}</p></div>
                <div className="space-y-3">
                  {currentQuestion.options.map((option, index) => {
                    const ToneIcon = option.tone === "positivo" ? ThumbsUp : option.tone === "neutro" ? Meh : option.tone === "agressivo" ? Flame : ThumbsDown
                    return <motion.button key={option.text} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={() => answerQuestion(index)} className="w-full rounded-lg border border-white/10 bg-white/5 p-4 text-left transition-colors hover:border-white/20 hover:bg-white/10"><div className="flex items-start gap-3"><ToneIcon className={cn("mt-0.5 h-5 w-5", option.impact > 0 ? "text-green-400" : option.impact < 0 ? "text-red-400" : "text-yellow-400")} /><div className="flex-1"><p className="text-white">“{option.text}”</p><p className={cn("mt-2 text-xs", option.impact > 0 ? "text-green-400" : option.impact < 0 ? "text-red-400" : "text-white/50")}>{option.impact > 0 ? "+" : ""}{option.impact} de moral</p></div><ChevronRight className="h-5 w-5 text-white/30" /></div></motion.button>
                  })}
                </div>
              </div>
            </motion.section>
          ) : showResult ? (
            <motion.section key="result" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto max-w-2xl rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20"><MicOff className="h-8 w-8 text-primary" /></div>
              <h2 className="text-2xl font-bold text-white">Coletiva encerrada</h2><p className="mt-2 text-white/60">As respostas e o impacto foram gravados no histórico da carreira.</p>
              <div className="mt-7 grid grid-cols-2 gap-4"><div className="rounded-lg bg-white/5 p-4"><p className="text-2xl font-bold text-white">{lastResponses.length}</p><p className="text-xs text-white/50">Respostas registradas</p></div><div className="rounded-lg bg-white/5 p-4"><p className={cn("text-2xl font-bold", totalImpact > 0 ? "text-green-400" : totalImpact < 0 ? "text-red-400" : "text-yellow-400")}>{totalImpact > 0 ? "+" : ""}{totalImpact}</p><p className="text-xs text-white/50">Impacto na moral</p></div></div>
              <div className="mt-7 flex gap-3"><Button onClick={() => router.push("/pre-office")} className="flex-1">Fechar</Button><Button variant="outline" onClick={restartConference} className="flex-1 border-white/10 bg-transparent text-white">Nova coletiva</Button></div>
            </motion.section>
          ) : (
            <motion.section key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6"><h2 className="flex items-center gap-2 text-lg font-bold text-white"><Shield className="h-5 w-5 text-primary" />Situação atual</h2><div className="mt-4 grid grid-cols-2 gap-4"><div className="rounded-lg bg-white/5 p-4 text-center"><p className="text-2xl font-bold text-white">{squadMorale.overall}%</p><p className="text-xs text-white/50">Moral do elenco</p></div><div className="rounded-lg bg-white/5 p-4 text-center"><p className="text-2xl font-bold text-white">{pressConferences.length}</p><p className="text-xs text-white/50">Coletivas gravadas</p></div></div><Button onClick={restartConference} className="mt-5 w-full"><MessageCircle className="mr-2 h-4 w-4" />Iniciar coletiva</Button></div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6"><h2 className="flex items-center gap-2 text-lg font-bold text-white"><History className="h-5 w-5 text-primary" />Histórico real</h2><div className="mt-4 max-h-96 space-y-3 overflow-y-auto">{history.length === 0 ? <p className="rounded-lg bg-white/5 p-5 text-center text-sm text-white/40">Nenhuma coletiva concluída nesta carreira.</p> : history.map((conference, index) => { const tone = toneFromConference(conference); return <div key={`${conference.week}-${index}`} className="rounded-lg bg-white/5 p-4"><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm text-white/70"><Calendar className="h-4 w-4" />Semana {conference.week}</span><span className={cn("text-xs", tone === "positivo" ? "text-green-400" : tone === "negativo" ? "text-red-400" : "text-yellow-400")}>{tone}</span></div><div className="mt-2 flex gap-3 text-xs text-white/45"><span>{conference.responses.length} respostas</span><span className={conference.moraleImpact >= 0 ? "text-green-400" : "text-red-400"}>{conference.moraleImpact > 0 ? "+" : ""}{conference.moraleImpact} moral</span></div></div> })}</div></div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
