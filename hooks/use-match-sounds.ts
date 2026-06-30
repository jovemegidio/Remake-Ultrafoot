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
  const masterRef = useRef<GainNode | null>(null)

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

  // Bus master: compressor + leve reverb (gluing) -> destino
  const getMaster = useCallback((ctx: AudioContext): AudioNode => {
    if (masterRef.current) return masterRef.current

    const master = ctx.createGain()
    master.gain.value = 0.9

    // Compressor para "colar" os elementos e evitar clipping
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.knee.value = 24
    comp.ratio.value = 3.5
    comp.attack.value = 0.004
    comp.release.value = 0.25

    // Reverb curto (impulso sintetico) para dar sensacao de estadio
    const convolver = ctx.createConvolver()
    const irLen = Math.floor(ctx.sampleRate * 1.1)
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch)
      for (let i = 0; i < irLen; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.4)
      }
    }
    convolver.buffer = ir

    const wet = ctx.createGain()
    wet.gain.value = 0.12
    const dry = ctx.createGain()
    dry.gain.value = 1

    master.connect(comp)
    comp.connect(dry)
    comp.connect(convolver)
    convolver.connect(wet)
    dry.connect(ctx.destination)
    wet.connect(ctx.destination)

    masterRef.current = master
    return master
  }, [])

  // Buffer de ruido rosa (mais natural que ruido branco)
  const pinkNoise = useCallback((ctx: AudioContext, duration: number): AudioBuffer => {
    const len = Math.max(1, Math.ceil(ctx.sampleRate * duration))
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const out = buf.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.969 * b2 + white * 0.153852
      b3 = 0.8665 * b3 + white * 0.3104856
      b4 = 0.55 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.016898
      out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
      b6 = white * 0.115926
    }
    return buf
  }, [])

  // Apito de arbitro realista: tom + trinado da "ervilha" + sopro de ar
  const whistle = useCallback((
    ctx: AudioContext,
    dest: AudioNode,
    startAt: number,
    duration: number,
    freq = 3200,
    vol = 0.35,
  ) => {
    // Tom principal
    const osc = ctx.createOscillator()
    const gainOsc = ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(freq * 0.99, startAt)
    osc.frequency.linearRampToValueAtTime(freq, startAt + 0.05)
    osc.frequency.setValueAtTime(freq, startAt + duration - 0.06)
    osc.frequency.linearRampToValueAtTime(freq * 0.95, startAt + duration)

    // Trinado caracteristico (ervilha girando dentro do apito)
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.type = "sine"
    lfo.frequency.value = 32
    lfoGain.gain.value = freq * 0.05
    lfo.connect(lfoGain)
    lfoGain.connect(osc.frequency)
    lfo.start(startAt)
    lfo.stop(startAt + duration + 0.05)

    gainOsc.gain.setValueAtTime(0, startAt)
    gainOsc.gain.linearRampToValueAtTime(vol, startAt + 0.02)
    gainOsc.gain.setValueAtTime(vol, startAt + duration - 0.04)
    gainOsc.gain.linearRampToValueAtTime(0, startAt + duration)
    osc.connect(gainOsc)
    gainOsc.connect(dest)
    osc.start(startAt)
    osc.stop(startAt + duration + 0.05)

    // 2o harmonico (brilho)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = "sine"
    osc2.frequency.value = freq * 1.5
    gain2.gain.setValueAtTime(0, startAt)
    gain2.gain.linearRampToValueAtTime(vol * 0.1, startAt + 0.03)
    gain2.gain.setValueAtTime(vol * 0.1, startAt + duration - 0.04)
    gain2.gain.linearRampToValueAtTime(0, startAt + duration)
    osc2.connect(gain2)
    gain2.connect(dest)
    osc2.start(startAt)
    osc2.stop(startAt + duration + 0.05)

    // Sopro de ar (ruido filtrado no ataque)
    const noise = ctx.createBufferSource()
    noise.buffer = pinkNoise(ctx, duration + 0.05)
    const nf = ctx.createBiquadFilter()
    nf.type = "highpass"
    nf.frequency.value = 2400
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0, startAt)
    ng.gain.linearRampToValueAtTime(vol * 0.5, startAt + 0.015)
    ng.gain.exponentialRampToValueAtTime(vol * 0.08, startAt + 0.12)
    ng.gain.linearRampToValueAtTime(0, startAt + duration)
    noise.connect(nf)
    nf.connect(ng)
    ng.connect(dest)
    noise.start(startAt)
    noise.stop(startAt + duration + 0.05)
  }, [pinkNoise])

  // Rugido de torcida em camadas (rumble + corpo + chiado), com ondas
  const crowd = useCallback((
    ctx: AudioContext,
    dest: AudioNode,
    startAt: number,
    duration: number,
    vol = 0.12,
    peakAt = 0.2,
  ) => {
    const src = ctx.createBufferSource()
    src.buffer = pinkNoise(ctx, duration + 0.1)
    src.loop = true

    // Corpo do rugido
    const body = ctx.createBiquadFilter()
    body.type = "bandpass"
    body.frequency.value = 520
    body.Q.value = 0.5

    // Rumble grave
    const low = ctx.createBiquadFilter()
    low.type = "lowpass"
    low.frequency.value = 320

    const bodyGain = ctx.createGain()
    bodyGain.gain.value = 0.7
    const lowGain = ctx.createGain()
    lowGain.gain.value = 0.5

    const env = ctx.createGain()
    env.gain.setValueAtTime(0, startAt)
    env.gain.linearRampToValueAtTime(vol, startAt + peakAt)
    env.gain.setValueAtTime(vol, startAt + duration * 0.5)
    env.gain.linearRampToValueAtTime(0, startAt + duration)

    // Ondas de torcida (modulacao lenta da amplitude)
    const wave = ctx.createOscillator()
    const waveGain = ctx.createGain()
    wave.type = "sine"
    wave.frequency.value = 0.7
    waveGain.gain.value = vol * 0.25
    wave.connect(waveGain)
    waveGain.connect(env.gain)
    wave.start(startAt)
    wave.stop(startAt + duration + 0.05)

    src.connect(body)
    src.connect(low)
    body.connect(bodyGain)
    low.connect(lowGain)
    bodyGain.connect(env)
    lowGain.connect(env)
    env.connect(dest)
    src.start(startAt)
    src.stop(startAt + duration + 0.1)
  }, [pinkNoise])

  // Buzina de estadio (air horn) — som de gol classico
  const airHorn = useCallback((
    ctx: AudioContext,
    dest: AudioNode,
    startAt: number,
    duration: number,
    vol = 0.22,
  ) => {
    const partials = [1, 2, 3, 4.02, 5.01]
    const base = 233 // ~Bb3
    const out = ctx.createGain()
    out.gain.setValueAtTime(0, startAt)
    out.gain.linearRampToValueAtTime(vol, startAt + 0.04)
    out.gain.setValueAtTime(vol, startAt + duration - 0.08)
    out.gain.linearRampToValueAtTime(0, startAt + duration)

    const lp = ctx.createBiquadFilter()
    lp.type = "lowpass"
    lp.frequency.value = 2600
    out.connect(lp)
    lp.connect(dest)

    partials.forEach((p, i) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = "sawtooth"
      osc.frequency.value = base * p
      osc.detune.value = (i - 2) * 4
      g.gain.value = 0.6 / (i + 1)
      osc.connect(g)
      g.connect(out)
      osc.start(startAt)
      osc.stop(startAt + duration + 0.05)
    })
  }, [])

  const play = useCallback((sound: MatchSoundType) => {
    const ctx = getCtx()
    if (!ctx) return
    const dest = getMaster(ctx)
    const now = ctx.currentTime

    try {
      switch (sound) {
        // Inicio de jogo: apito simples + leve murmurio
        case "apito_inicio":
          whistle(ctx, dest, now, 0.55, 3200, 0.4)
          crowd(ctx, dest, now, 1.5, 0.05, 0.4)
          break

        // Falta: apito curto e agudo
        case "apito_falta":
          whistle(ctx, dest, now, 0.22, 3500, 0.34)
          break

        // Intervalo: dois apitos + torcida
        case "apito_intervalo":
          whistle(ctx, dest, now, 0.45, 3200, 0.4)
          whistle(ctx, dest, now + 0.6, 0.5, 3150, 0.4)
          crowd(ctx, dest, now + 0.3, 2.4, 0.07)
          break

        // Fim de jogo: tres apitos + ovacao
        case "apito_fim":
          whistle(ctx, dest, now, 0.5, 3200, 0.42)
          whistle(ctx, dest, now + 0.65, 0.5, 3200, 0.42)
          whistle(ctx, dest, now + 1.3, 0.85, 3100, 0.44)
          crowd(ctx, dest, now + 0.8, 4.5, 0.16, 0.6)
          break

        // GOL: rugido explosivo + buzina + apito
        case "gol":
          crowd(ctx, dest, now, 5.0, 0.22, 0.18)
          airHorn(ctx, dest, now + 0.1, 0.5, 0.2)
          airHorn(ctx, dest, now + 0.7, 0.5, 0.2)
          airHorn(ctx, dest, now + 1.3, 1.1, 0.22)
          whistle(ctx, dest, now, 0.3, 3000, 0.3)
          break

        // Cartao amarelo: apito + bip seco
        case "cartao_amarelo": {
          whistle(ctx, dest, now, 0.22, 3400, 0.3)
          const osc = ctx.createOscillator()
          const g = ctx.createGain()
          osc.type = "square"
          osc.frequency.value = 880
          g.gain.setValueAtTime(0.16, now + 0.18)
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.42)
          osc.connect(g); g.connect(dest)
          osc.start(now + 0.18); osc.stop(now + 0.45)
          break
        }

        // Cartao vermelho: apito + tom grave descendente + reacao
        case "cartao_vermelho": {
          whistle(ctx, dest, now, 0.3, 3300, 0.34)
          const osc = ctx.createOscillator()
          const g = ctx.createGain()
          osc.type = "sawtooth"
          osc.frequency.setValueAtTime(300, now + 0.2)
          osc.frequency.exponentialRampToValueAtTime(80, now + 0.75)
          g.gain.setValueAtTime(0.24, now + 0.2)
          g.gain.linearRampToValueAtTime(0, now + 0.78)
          osc.connect(g); g.connect(dest)
          osc.start(now + 0.2); osc.stop(now + 0.8)
          crowd(ctx, dest, now + 0.3, 2.2, 0.1)
          break
        }

        // Substituicao: acorde suave ascendente (notificacao)
        case "substituicao": {
          const chords = [523.25, 659.25, 783.99]
          chords.forEach((freq, i) => {
            const osc = ctx.createOscillator()
            const g = ctx.createGain()
            osc.type = "triangle"
            osc.frequency.value = freq
            const t = now + i * 0.08
            g.gain.setValueAtTime(0, t)
            g.gain.linearRampToValueAtTime(0.13, t + 0.04)
            g.gain.linearRampToValueAtTime(0, t + 0.5)
            osc.connect(g); g.connect(dest)
            osc.start(t); osc.stop(t + 0.55)
          })
          break
        }

        // Penalti: apito longo + tensao da torcida
        case "penalti":
          whistle(ctx, dest, now, 0.7, 3300, 0.42)
          crowd(ctx, dest, now + 0.3, 2.8, 0.09, 0.8)
          break
      }
    } catch {
      // Ignora erros de audio silenciosamente
    }
  }, [getCtx, getMaster, whistle, crowd, airHorn])

  useEffect(() => {
    return () => {
      masterRef.current = null
      ctxRef.current?.close().catch(() => {})
    }
  }, [])

  return { play }
}
