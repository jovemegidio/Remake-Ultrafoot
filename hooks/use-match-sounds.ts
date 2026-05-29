"use client"

import { useRef, useCallback, useEffect } from "react"

export type MatchSoundType =
  | "gol"
  | "apito_inicio"
  | "apito_falta"
  | "apito_intervalo"
  | "apito_fim"
  | "cartao_amarelo"
  | "cartao_vermelho"
  | "substituicao"
  | "penalti"

export function useMatchSounds() {
  const ctxRef = useRef<AudioContext | null>(null)

  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null
    try {
      if (!ctxRef.current) {
        ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      if (ctxRef.current.state === "suspended") {
        ctxRef.current.resume()
      }
      return ctxRef.current
    } catch {
      return null
    }
  }, [])

  // Apito realista: oscilador + ruído de ar
  const whistle = useCallback((
    ctx: AudioContext,
    startAt: number,
    duration: number,
    freq = 2700,
    vol = 0.35,
  ) => {
    // Tom principal
    const osc = ctx.createOscillator()
    const gainOsc = ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(freq, startAt)
    osc.frequency.linearRampToValueAtTime(freq * 1.04, startAt + 0.06)
    osc.frequency.linearRampToValueAtTime(freq * 0.97, startAt + duration - 0.06)
    gainOsc.gain.setValueAtTime(0, startAt)
    gainOsc.gain.linearRampToValueAtTime(vol, startAt + 0.02)
    gainOsc.gain.setValueAtTime(vol, startAt + duration - 0.04)
    gainOsc.gain.linearRampToValueAtTime(0, startAt + duration)
    osc.connect(gainOsc)
    gainOsc.connect(ctx.destination)
    osc.start(startAt)
    osc.stop(startAt + duration + 0.05)

    // 2º harmônico
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = "sine"
    osc2.frequency.value = freq * 1.5
    gain2.gain.setValueAtTime(0, startAt)
    gain2.gain.linearRampToValueAtTime(vol * 0.12, startAt + 0.03)
    gain2.gain.linearRampToValueAtTime(0, startAt + duration)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(startAt)
    osc2.stop(startAt + duration + 0.05)
  }, [])

  // Ruído de torcida (white noise filtrado)
  const crowd = useCallback((
    ctx: AudioContext,
    startAt: number,
    duration: number,
    vol = 0.12,
    peakAt = 0.15,
  ) => {
    const bufferSize = Math.ceil(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

    const src = ctx.createBufferSource()
    src.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = "bandpass"
    filter.frequency.value = 700
    filter.Q.value = 0.4

    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(0, startAt)
    gainNode.gain.linearRampToValueAtTime(vol, startAt + peakAt)
    gainNode.gain.setValueAtTime(vol, startAt + duration * 0.55)
    gainNode.gain.linearRampToValueAtTime(0, startAt + duration)

    src.connect(filter)
    filter.connect(gainNode)
    gainNode.connect(ctx.destination)
    src.start(startAt)
  }, [])

  // Fanfarra de gol (ascendente)
  const goalFanfare = useCallback((ctx: AudioContext, startAt: number) => {
    const notes = [
      { freq: 523.25, t: 0.00, dur: 0.18 },   // C5
      { freq: 659.25, t: 0.15, dur: 0.18 },   // E5
      { freq: 783.99, t: 0.30, dur: 0.18 },   // G5
      { freq: 1046.5, t: 0.45, dur: 0.45 },   // C6
      { freq: 783.99, t: 0.65, dur: 0.20 },   // G5
      { freq: 1046.5, t: 0.85, dur: 0.60 },   // C6 longa
    ]
    notes.forEach(({ freq, t, dur }) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = "triangle"
      osc.frequency.value = freq
      g.gain.setValueAtTime(0, startAt + t)
      g.gain.linearRampToValueAtTime(0.25, startAt + t + 0.03)
      g.gain.linearRampToValueAtTime(0.2, startAt + t + dur - 0.04)
      g.gain.linearRampToValueAtTime(0, startAt + t + dur)
      osc.connect(g)
      g.connect(ctx.destination)
      osc.start(startAt + t)
      osc.stop(startAt + t + dur + 0.05)
    })
  }, [])

  const play = useCallback((sound: MatchSoundType) => {
    const ctx = getCtx()
    if (!ctx) return
    const now = ctx.currentTime

    try {
      switch (sound) {
        // ── Início de jogo: apito simples
        case "apito_inicio":
          whistle(ctx, now, 0.55, 2750, 0.38)
          break

        // ── Falta: apito curto e agudo
        case "apito_falta":
          whistle(ctx, now, 0.25, 3100, 0.32)
          break

        // ── Intervalo: dois apitos
        case "apito_intervalo":
          whistle(ctx, now, 0.45, 2750, 0.38)
          whistle(ctx, now + 0.65, 0.45, 2750, 0.38)
          crowd(ctx, now + 0.3, 2.0, 0.08)
          break

        // ── Fim de jogo: três apitos
        case "apito_fim":
          whistle(ctx, now, 0.55, 2700, 0.40)
          whistle(ctx, now + 0.75, 0.55, 2700, 0.40)
          whistle(ctx, now + 1.50, 0.85, 2650, 0.42)
          crowd(ctx, now + 1.0, 4.0, 0.14, 0.5)
          break

        // ── GOL: apito + fanfarra + torcida
        case "gol":
          whistle(ctx, now, 0.35, 2600, 0.36)
          goalFanfare(ctx, now + 0.2)
          crowd(ctx, now + 0.1, 4.5, 0.18, 0.3)
          break

        // ── Cartão amarelo: bip seco
        case "cartao_amarelo": {
          const osc = ctx.createOscillator()
          const g = ctx.createGain()
          osc.type = "sine"
          osc.frequency.value = 880
          g.gain.setValueAtTime(0.22, now)
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
          osc.connect(g); g.connect(ctx.destination)
          osc.start(now); osc.stop(now + 0.3)
          break
        }

        // ── Cartão vermelho: tom grave descendente + apito
        case "cartao_vermelho": {
          const osc = ctx.createOscillator()
          const g = ctx.createGain()
          osc.type = "sawtooth"
          osc.frequency.setValueAtTime(320, now)
          osc.frequency.linearRampToValueAtTime(90, now + 0.55)
          g.gain.setValueAtTime(0.28, now)
          g.gain.linearRampToValueAtTime(0, now + 0.55)
          osc.connect(g); g.connect(ctx.destination)
          osc.start(now); osc.stop(now + 0.6)
          whistle(ctx, now + 0.15, 0.22, 3000, 0.28)
          crowd(ctx, now + 0.3, 1.5, 0.08)
          break
        }

        // ── Substituição: acorde suave ascendente
        case "substituicao": {
          const chords = [440, 554, 659]
          chords.forEach((freq, i) => {
            const osc = ctx.createOscillator()
            const g = ctx.createGain()
            osc.type = "sine"
            osc.frequency.value = freq
            const t = now + i * 0.07
            g.gain.setValueAtTime(0, t)
            g.gain.linearRampToValueAtTime(0.14, t + 0.05)
            g.gain.linearRampToValueAtTime(0, t + 0.45)
            osc.connect(g); g.connect(ctx.destination)
            osc.start(t); osc.stop(t + 0.5)
          })
          break
        }

        // ── Pênalti: apito longo + tensão
        case "penalti":
          whistle(ctx, now, 0.65, 2800, 0.40)
          crowd(ctx, now + 0.3, 2.0, 0.07)
          break
      }
    } catch {
      // Ignora erros de áudio silenciosamente
    }
  }, [getCtx, whistle, crowd, goalFanfare])

  useEffect(() => {
    return () => { ctxRef.current?.close().catch(() => {}) }
  }, [])

  return { play }
}
