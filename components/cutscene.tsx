"use client"

import { useEffect, useRef, useState } from "react"

// Player de cutscene em tela cheia. Toca um MP4, permite pular (clique / Enter /
// Esc / botao) e chama onComplete ao terminar ou pular.
//
// Os videos ficam em public/cutscenes/ e sao pequenos (~2.5 MB), entao vao
// EMBUTIDOS no frontend (out/) — NAO sao removidos pelo prune-export-music, que so
// mexe em out/music. Por isso o caminho direto "/cutscenes/x.mp4" funciona tanto na
// web quanto no Tauri (asset embutido, com suporte a range para video).
export function Cutscene({
  src,
  onComplete,
  canSkip = true,
}: {
  src: string
  onComplete: () => void
  canSkip?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [done, setDone] = useState(false)

  const finish = () => {
    if (done) return
    setDone(true)
    onComplete()
  }

  useEffect(() => {
    // Alguns webviews bloqueiam autoplay com som; garante o play e cai pro fim se falhar.
    const v = videoRef.current
    if (v) v.play().catch(() => {})

    if (!canSkip) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") finish()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSkip])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      onClick={canSkip ? finish : undefined}
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay
        playsInline
        className="h-full w-full object-contain"
        onEnded={finish}
        onError={finish}
      />
      {canSkip && (
        <button
          onClick={(e) => { e.stopPropagation(); finish() }}
          className="absolute bottom-8 right-8 z-10 rounded-full border border-white/25 bg-black/50 px-5 py-2 text-sm font-semibold text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
        >
          Pular ⏭
        </button>
      )}
    </div>
  )
}
