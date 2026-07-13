"use client"

import { gameAssetUrl } from "@/lib/game-asset"

export type PlayerRepeat = "off" | "all" | "one"

export interface Track {
  title: string
  artist: string
  cover: string
  src: string
  duration: number
}

export interface MusicState {
  tracks: Track[]
  currentTrack: number
  playing: boolean
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: PlayerRepeat
  liked: number[]
  isLoading: boolean
}

const initialState: MusicState = {
  tracks: [],
  currentTrack: 0,
  playing: false,
  currentTime: 0,
  duration: 0,
  volume: 70,
  muted: false,
  shuffle: false,
  repeat: "off",
  liked: [],
  isLoading: false,
}

// Estado e audio vivem no escopo do modulo (singleton),
// por isso sobrevivem a desmontagem/remontagem dos componentes
// quando o usuario navega entre paginas.
let state: MusicState = initialState
let audio: HTMLAudioElement | null = null
let initialized = false
let hasAutoplayed = false
let autoplayAttached = false
let lastSavedSecond = -1

const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function setState(patch: Partial<MusicState>) {
  state = { ...state, ...patch }
  emit()
}

function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

function loadTrack(index: number, autoplay: boolean) {
  if (!audio || state.tracks.length === 0) return
  const total = state.tracks.length
  const i = ((index % total) + total) % total
  const src = state.tracks[i].src
  setState({ currentTrack: i, currentTime: 0 })
  // No desktop os audios NAO ficam no bundle do frontend (o prune-export-music os
  // remove de out/) — eles vao como resource bundlado ao lado do exe e so sao
  // acessiveis via game-asset://. Usar o caminho cru dava 404 e o player nao tocava.
  audio.src = gameAssetUrl(src)
  audio.load()
  persist("ultrafoot:music-current-src", src)
  persist("ultrafoot:music-current-time", "0")
  if (autoplay) {
    audio.play().then(() => setState({ playing: true })).catch(() => {})
  }
}

function ensureInit() {
  if (initialized || typeof window === "undefined") return
  initialized = true

  audio = new Audio()
  audio.preload = "metadata"

  // Restaura preferencias persistidas
  const savedVolume = localStorage.getItem("ultrafoot:music-volume")
  const savedShuffle = localStorage.getItem("ultrafoot:music-shuffle")
  const savedRepeat = localStorage.getItem("ultrafoot:music-repeat")
  state = {
    ...state,
    volume: savedVolume !== null ? parseInt(savedVolume, 10) : state.volume,
    shuffle: savedShuffle !== null ? savedShuffle === "true" : state.shuffle,
    repeat: savedRepeat !== null ? (savedRepeat as PlayerRepeat) : state.repeat,
  }
  audio.volume = state.muted ? 0 : state.volume / 100

  audio.addEventListener("timeupdate", () => {
    if (!audio) return
    setState({ currentTime: audio.currentTime })
    const sec = Math.floor(audio.currentTime)
    if (sec !== lastSavedSecond) {
      lastSavedSecond = sec
      persist("ultrafoot:music-current-time", String(audio.currentTime))
    }
  })
  audio.addEventListener("durationchange", () => {
    if (!audio) return
    setState({ duration: audio.duration || state.tracks[state.currentTrack]?.duration || 0 })
  })
  audio.addEventListener("ended", () => {
    if (!audio) return
    if (state.repeat === "one") {
      audio.currentTime = 0
      audio.play().catch(() => {})
    } else {
      next()
    }
  })
  audio.addEventListener("canplay", () => setState({ isLoading: false }))
  audio.addEventListener("waiting", () => setState({ isLoading: true }))

  // Carrega faixas (embaralha apenas uma vez)
  fetch("/music/tracks.json")
    .then((r) => r.json())
    .then((data: Track[]) => {
      const isTauriProd =
        typeof window !== "undefined" &&
        "__TAURI_INTERNALS__" in window &&
        process.env.NODE_ENV === "production"
      // track.src ja vem percent-encoded do tracks.json ("/music/%20Ainda%20Bem...").
      // Antes fazia decodeURIComponent e montava a URL com o nome CRU (espacos, aspas):
      // URL invalida -> o webview re-encodava -> o Rust nao decodificava -> 404 silencioso.
      // Mantendo codificado, a URL e valida e o handler (que agora decodifica) acha o arquivo.
      const resolved = isTauriProd
        ? data.map((track) => ({ ...track, src: `game-asset://localhost${track.src}` }))
        : data
      const shuffled = [...resolved].sort(() => Math.random() - 0.5)

      // Tenta retomar a mesma faixa/posicao de antes (mesmo apos reload)
      const savedSrc = localStorage.getItem("ultrafoot:music-current-src")
      const savedTime = parseFloat(localStorage.getItem("ultrafoot:music-current-time") || "0")
      let startIndex = 0
      if (savedSrc) {
        const found = shuffled.findIndex((t) => t.src === savedSrc)
        if (found >= 0) startIndex = found
      }

      setState({ tracks: shuffled, currentTrack: startIndex })

      // Sem faixas cadastradas: nao tenta carregar nada (evita crash de indice).
      if (shuffled.length === 0) return

      if (audio) {
        audio.src = shuffled[startIndex].src
        audio.load()
        persist("ultrafoot:music-current-src", shuffled[startIndex].src)
        if (savedTime > 0) {
          const restore = () => {
            if (audio) audio.currentTime = savedTime
            audio?.removeEventListener("loadedmetadata", restore)
          }
          audio.addEventListener("loadedmetadata", restore)
        }
      }
    })
    .catch(() => {})
}

function play() {
  if (!audio) return
  audio.play().then(() => setState({ playing: true })).catch(() => setState({ playing: false }))
}

function pause() {
  if (!audio) return
  audio.pause()
  setState({ playing: false })
}

function next() {
  const wasPlaying = state.playing
  if (state.shuffle) {
    loadTrack(Math.floor(Math.random() * state.tracks.length), wasPlaying)
  } else {
    loadTrack(state.currentTrack + 1, wasPlaying)
  }
}

function prev() {
  if (audio && audio.currentTime > 3) {
    audio.currentTime = 0
    setState({ currentTime: 0 })
    return
  }
  loadTrack(state.currentTrack - 1, state.playing)
}

export const musicStore = {
  subscribe(listener: () => void) {
    ensureInit()
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  getSnapshot() {
    return state
  },
  getServerSnapshot() {
    return initialState
  },
  toggle() {
    state.playing ? pause() : play()
  },
  play,
  pause,
  next,
  prev,
  setCurrentTrack(index: number) {
    loadTrack(index, state.playing)
  },
  seekRatio(ratio: number) {
    if (!audio || state.duration <= 0) return
    const t = (ratio / 100) * state.duration
    audio.currentTime = t
    setState({ currentTime: t })
  },
  setVolume(v: number) {
    if (audio) audio.volume = state.muted ? 0 : v / 100
    setState({ volume: v, muted: false })
    persist("ultrafoot:music-volume", String(v))
  },
  setMuted(m: boolean) {
    if (audio) audio.volume = m ? 0 : state.volume / 100
    setState({ muted: m })
  },
  setShuffle(s: boolean) {
    setState({ shuffle: s })
    persist("ultrafoot:music-shuffle", String(s))
  },
  cycleRepeat() {
    const r: PlayerRepeat = state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off"
    setState({ repeat: r })
    persist("ultrafoot:music-repeat", r)
  },
  toggleLike(index: number) {
    const liked = state.liked.includes(index)
      ? state.liked.filter((i) => i !== index)
      : [...state.liked, index]
    setState({ liked })
  },
  requestAutoplay() {
    if (hasAutoplayed) return

    // onInteract fica anexado ate a musica REALMENTE tocar (nao usa {once}), pois:
    //  - o webview costuma bloquear autoplay sem gesto do usuario;
    //  - as faixas podem carregar depois do primeiro gesto (attempt sai cedo se
    //    tracks.length===0). Com listener persistente, o proximo gesto ja toca.
    const onInteract = () => attempt()
    const detach = () => {
      document.removeEventListener("pointerdown", onInteract)
      document.removeEventListener("keydown", onInteract)
      document.removeEventListener("touchstart", onInteract)
    }
    const attempt = () => {
      if (hasAutoplayed || !audio || state.tracks.length === 0) return
      audio
        .play()
        .then(() => {
          hasAutoplayed = true
          setState({ playing: true })
          detach()
        })
        .catch(() => {})
    }

    // Tenta de imediato (alguns webviews permitem) e novamente conforme as faixas carregam.
    attempt()
    const timers = [setTimeout(attempt, 400), setTimeout(attempt, 1200), setTimeout(attempt, 3000)]

    if (!autoplayAttached) {
      autoplayAttached = true
      document.addEventListener("pointerdown", onInteract)
      document.addEventListener("keydown", onInteract)
      document.addEventListener("touchstart", onInteract)
    }
    return () => timers.forEach(clearTimeout)
  },
}
