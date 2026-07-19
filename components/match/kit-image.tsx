"use client"

// Camisa do time, com FALLBACK desenhado.
//
// Problema que isto resolve: 25 clubes (Velo Clube, Noroeste, Agua Santa, Remo...) nao
// tem arte de camisa. O modal usava <Image> direto na URL, entao a imagem 404 e o browser
// mostrava o TEXTO ALTERNATIVO ("Velo Clube Casa") — o modal parecia quebrado.
//
// Agora, quando a arte nao carrega, desenhamos uma camisa em SVG com as CORES do clube.
// Sempre ha algo apresentavel, e o time nao fica com um buraco na tela.

import { useEffect, useRef, useState } from "react"
import { getCamisaUrl, type Team } from "@/lib/teams-data"

export type KitVariant = "home" | "away" | "third"

/** Cores da camisa por variante — derivadas das cores do clube. */
export function getKitColors(team: Team, variant: KitVariant): { body: string; accent: string } {
  const c1 = team.cor1 || "#2a2a2a"
  const c2 = team.cor2 || "#ffffff"
  switch (variant) {
    case "home":
      return { body: c1, accent: c2 }
    case "away":
      // Visitante: inverte (o classico "manda a segunda cor pra frente").
      return { body: c2, accent: c1 }
    default:
      // Terceiro: escuro, com a cor do clube como detalhe.
      return { body: "#15161a", accent: c1 }
  }
}

/** Camisa desenhada — usada quando nao ha arte para o clube. */
function DrawnKit({ team, variant }: { team: Team; variant: KitVariant }) {
  const { body, accent } = getKitColors(team, variant)
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label={`Uniforme ${team.nome}`}>
      {/* Corpo + mangas */}
      <path
        d="M30 18 L42 12 Q50 18 58 12 L70 18 L82 28 L74 40 L68 34 L68 86 Q50 90 32 86 L32 34 L26 40 L18 28 Z"
        fill={body}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="1.5"
      />
      {/* Faixa central (dá contraste sem inventar um escudo) */}
      <rect x="44" y="20" width="12" height="66" fill={accent} opacity="0.85" />
      {/* Punhos e gola */}
      <path d="M18 28 L26 40 L22 44 L14 32 Z" fill={accent} opacity="0.9" />
      <path d="M82 28 L74 40 L78 44 L86 32 Z" fill={accent} opacity="0.9" />
      <path d="M42 12 Q50 20 58 12 L54 10 Q50 14 46 10 Z" fill={accent} />
      {/* Sigla do clube no peito */}
      <text
        x="50"
        y="62"
        textAnchor="middle"
        fontSize="13"
        fontWeight="800"
        fill="rgba(255,255,255,0.9)"
        stroke="rgba(0,0,0,0.4)"
        strokeWidth="0.4"
      >
        {team.curto}
      </text>
    </svg>
  )
}

export function KitImage({ team, variant }: { team: Team; variant: KitVariant }) {
  const [revision, setRevision] = useState(0)
  const [retryCount, setRetryCount] = useState(0)
  // revision faz o componente reler o override depois que o store assincrono
  // termina de hidratar ou quando o editor salva/importa uma camisa.
  const url = getCamisaUrl(team.file_key, variant, team.nome)
  const [failed, setFailed] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const refresh = (event?: Event) => {
      const key = (event as CustomEvent<{ key?: string }> | undefined)?.detail?.key
      if (!key || key === team.file_key) setRevision(value => value + 1)
    }
    window.addEventListener("ultrafoot:store:ready", refresh)
    window.addEventListener("ultrafoot:team:changed", refresh)
    return () => {
      window.removeEventListener("ultrafoot:store:ready", refresh)
      window.removeEventListener("ultrafoot:team:changed", refresh)
    }
  }, [team.file_key])

  // Troca de time/variante: volta a tentar a arte.
  useEffect(() => { setFailed(false); setRetryCount(0) }, [url, revision])

  // Imagem em CACHE nao dispara onError/onLoad depois do mount — checa na mao.
  // (Mesmo problema que ja tinha derrubado os escudos no TeamCrest.)
  useEffect(() => {
    const img = imgRef.current
    if (img?.complete && img.naturalWidth === 0) setFailed(true)
  }, [url, retryCount, revision])

  const handleError = () => {
    // O protocolo customizado pode receber a primeira requisicao antes de os
    // recursos extraidos estarem prontos. Quatro novas tentativas evitam marcar
    // kits existentes como ausentes (caso visto em Arsenal/Manchester/Real).
    if (retryCount < 4) {
      window.setTimeout(() => setRetryCount(value => value + 1), 140)
      return
    }
    setFailed(true)
  }

  if (failed || !url) return <DrawnKit team={team} variant={variant} />
  const source = /^(data:|blob:)/i.test(url)
    ? url
    : `${url}${url.includes("?") ? "&" : "?"}uf_retry=${retryCount}`

  return (
    // <img> cru (nao next/image): precisamos do onError para cair no desenho.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={source}
      alt={`Uniforme ${team.nome}`}
      className="h-full w-full object-contain"
      onError={handleError}
      draggable={false}
    />
  )
}
