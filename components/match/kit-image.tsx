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
import { getCamisaUrl, getLocalCamisaPath, isKitVariantAvailable, type Team } from "@/lib/teams-data"
import { gameAssetUrl } from "@/lib/game-asset"

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
  /** 0 = URL como veio; 1 = a OUTRA forma (caminho <-> game-asset://). Ver handleError. */
  const [formaDaUrl, setFormaDaUrl] = useState(0)
  // revision faz o componente reler o override depois que o store assincrono
  // termina de hidratar ou quando o editor salva/importa uma camisa.
  const urlBase = getCamisaUrl(team.file_key, variant, team.nome)
  // SEGUNDA FORMA: o caminho EMPACOTADO da camisa, que existe no disco do
  // jogador independentemente de ambiente (ver handleError). Nao se aplica a
  // uniforme importado pelo usuario (data:/blob:), que ja e o dado em si.
  const proximaForma = /^(data:|blob:)/i.test(urlBase ?? "") || !team.file_key
    ? null
    : gameAssetUrl(getLocalCamisaPath(team.file_key, variant))
  const url = formaDaUrl === 1 ? (proximaForma ?? urlBase) : urlBase
  const [failed, setFailed] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const refresh = (event?: Event) => {
      const key = (event as CustomEvent<{ key?: string }> | undefined)?.detail?.key
      if (!key || key === team.file_key) setRevision(value => value + 1)
    }
    window.addEventListener("ultrafoot:store:ready", refresh)
    window.addEventListener("ultrafoot:team:changed", refresh)
    // O pacote de atualizacao chega DEPOIS da montagem: sem re-resolver, o
    // uniforme publicado pelo canal so apareceria ao reabrir o jogo (o mesmo
    // motivo de TeamCrest e PlayerAvatar escutarem este evento). O evento nao
    // traz `key`, entao cai no ramo que atualiza qualquer clube.
    window.addEventListener("ultrafoot:elencos:atualizados", refresh)
    // Uniforme salvo no banco chega primeiro como referencia e vira blob URL
    // depois da leitura assíncrona do AppData.
    window.addEventListener("ultrafoot:imagem:pronta", refresh)
    return () => {
      window.removeEventListener("ultrafoot:store:ready", refresh)
      window.removeEventListener("ultrafoot:team:changed", refresh)
      window.removeEventListener("ultrafoot:elencos:atualizados", refresh)
      window.removeEventListener("ultrafoot:imagem:pronta", refresh)
    }
  }, [team.file_key])

  // Troca de time/variante: volta a tentar a arte.
  useEffect(() => { setFailed(false); setRetryCount(0); setFormaDaUrl(0) }, [urlBase, revision])

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
    // ⚠️ ANTES DE DESISTIR, TENTA O CAMINHO EMPACOTADO (relato: "uniformes
    // foram perdidos", desde a 1.0.266).
    //
    // `getCamisaUrl` decide por ambiente, igual ao escudo:
    //     isTauri()  -> game-asset://localhost/camisas/x.webp  (empacotado)
    //     senao      -> https://.../teams/camisas/x.png        (repo remoto)
    //
    // O export e estatico: o HTML sai pre-renderizado do build, onde `isTauri()`
    // e FALSO — entao o `src` gravado e a URL REMOTA, e ela permanece dentro do
    // aplicativo (o React nao corrige atributo divergente na hidratacao). Sem
    // rede, ou com o repositorio de terceiros fora do ar, a arte 404 e o clube
    // cai na camisa desenhada. Repetir a MESMA url quatro vezes nunca resolveu:
    // o problema nao e instabilidade, e a url errada.
    if (formaDaUrl === 0 && proximaForma) {
      setFormaDaUrl(1)
      setRetryCount(0)
      return
    }
    setFailed(true)
  }

  if (!isKitVariantAvailable(team.file_key, variant)) return null
  if (failed || !url) return <DrawnKit team={team} variant={variant} />
  const source = /^(data:|blob:)/i.test(url)
    ? url
    : `${url}${url.includes("?") ? "&" : "?"}uf_retry=${retryCount}`

  return (
    // <img> cru (nao next/image): precisamos do onError para cair no desenho.
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
