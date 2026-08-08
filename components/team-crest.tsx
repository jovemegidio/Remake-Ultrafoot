"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { getEscudoUrl, getTeamByShort, type Team } from "@/lib/teams-data"
import { storeGet, storeSet, storeRemove } from "@/lib/persistent-store"
import { escudoDoServidor } from "@/lib/atualizacao-elencos"
import { gameAssetUrl, gameAssetUrlAlternativa, isTauri } from "@/lib/game-asset"
import { getLocalEscudoPath } from "@/lib/escudos-map"
// Escudos EMBUTIDOS no build (viajam no mesmo seed dos overrides, campo logoUrl). E por
// eles que um escudo importado no editor chega aos OUTROS jogadores, nao so ao save local.
import bundledOverrides from "@/data/seeds/team-overrides.json"

const BUNDLED_LOGOS = bundledOverrides as Record<string, { logoUrl?: string }>

interface TeamCrestProps {
  team?: Team
  teamShort?: string
  fileKey?: string
  size?: "xs" | "table" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl"
  className?: string
  showFallback?: boolean
}

const sizeMap = {
  xs: { container: "h-5 w-5", text: "text-[6px]", inner: "text-[5px]" },
  table: { container: "h-6 w-6", text: "text-[7px]", inner: "text-[6px]" },
  sm: { container: "h-8 w-8", text: "text-[8px]", inner: "text-[7px]" },
  md: { container: "h-12 w-12", text: "text-[10px]", inner: "text-[9px]" },
  lg: { container: "h-16 w-16", text: "text-xs", inner: "text-[10px]" },
  xl: { container: "h-20 w-20", text: "text-sm", inner: "text-xs" },
  "2xl": { container: "h-28 w-28", text: "text-lg", inner: "text-sm" },
  "3xl": { container: "h-36 w-36", text: "text-xl", inner: "text-base" },
  "4xl": { container: "h-44 w-44", text: "text-2xl", inner: "text-lg" },
}

const sizePixels = {
  xs: 20,
  table: 24,
  sm: 32,
  md: 48,
  lg: 64,
  xl: 80,
  "2xl": 112,
  "3xl": 144,
  "4xl": 176,
}

/**
 * Team crest component that loads real escudos from Ultrafoot repository
 * Falls back to styled shield with team colors if image fails to load
 */
const CUSTOM_LOGO_KEY = (key: string) => `ultrafoot:logo:${key}`

/**
 * SÓ o escudo que ESTA instalação importou — sem o canal e sem o build.
 *
 * ⚠️ Existe porque o editor precisa saber se há o que REMOVER. Enquanto ele
 * perguntava isso a `getCustomLogoUrl`, o botão "remover logo" passou a aparecer
 * em todo clube que apenas recebeu escudo publicado, e clicar nele não fazia
 * nada — apagava uma chave local que nunca existiu.
 */
export function getLocalCustomLogoUrl(fileKey: string): string | null {
  if (typeof window === "undefined") return null
  return storeGet(CUSTOM_LOGO_KEY(fileKey)) ?? null
}

export function getCustomLogoUrl(fileKey: string): string | null {
  // Save LOCAL vence (personalizacao propria); depois o escudo PUBLICADO pelo canal
  // de atualizacao; o escudo EMBUTIDO no build e o ultimo fallback.
  //
  // ⚠️ A CAMADA DO MEIO FALTAVA. Ate 03/08/2026 esta funcao lia so o save local e o
  // seed embutido — entao um escudo publicado pelo canal chegava ao manifesto, era
  // gravado no disco, e NUNCA aparecia na tela, porque TeamCrest e quem desenha todo
  // escudo do jogo e passa por aqui (nao por getTeamOverride). Sem erro nenhum: o
  // escudo velho continuava no lugar. Irmao do descasamento dos retratos do DF11.
  return getLocalCustomLogoUrl(fileKey) ?? escudoDoServidor(fileKey) ?? BUNDLED_LOGOS[fileKey]?.logoUrl ?? null
}

/** Escudos custom no save local (ultrafoot:logo:*), por fileKey — usado pelo editor ao exportar. */
export function listLocalCustomLogos(): Record<string, string> {
  const out: Record<string, string> = {}
  if (typeof window === "undefined") return out
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k?.startsWith("ultrafoot:logo:")) continue
    const val = storeGet(k)
    if (val) out[k.replace("ultrafoot:logo:", "")] = val
  }
  return out
}

export function setCustomLogoUrl(fileKey: string, dataUrl: string): void {
  storeSet(CUSTOM_LOGO_KEY(fileKey), dataUrl)
  window.dispatchEvent(new CustomEvent("ultrafoot:logo:changed", { detail: { key: fileKey } }))
}

export function removeCustomLogoUrl(fileKey: string): void {
  storeRemove(CUSTOM_LOGO_KEY(fileKey))
  window.dispatchEvent(new CustomEvent("ultrafoot:logo:changed", { detail: { key: fileKey } }))
}

export function TeamCrest({
  team,
  teamShort,
  fileKey,
  size = "md",
  className,
  showFallback = true,
}: TeamCrestProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  /** 0 = URL como veio; 1 = a OUTRA forma (caminho <-> game-asset://). Ver handleError. */
  const [formaDaUrl, setFormaDaUrl] = useState(0)
  const [customLogo, setCustomLogo] = useState<string | null>(null)
  const MAX_RETRIES = 4

  // Resolve team data
  const resolvedTeam = team || (teamShort ? getTeamByShort(teamShort) : undefined)

  // O time do USUARIO vem do save (SavedTeam), que nomeia a chave como `fileKey`
  // (camelCase) — enquanto Team (teams-data) usa `file_key` (snake_case). Lendo so
  // `file_key`, a chave do proprio time do jogador saia undefined: sem URL, sem <img>,
  // e como o onError nunca disparava nem o fallback aparecia. Resultado: escudo do SEU
  // time em branco (e so o dele). Aceita as duas formas e, em ultimo caso, resolve
  // pelo curto no teams-data.
  const escudoKey =
    fileKey ||
    resolvedTeam?.file_key ||
    (resolvedTeam as unknown as { fileKey?: string })?.fileKey ||
    (resolvedTeam?.curto ? getTeamByShort(resolvedTeam.curto)?.file_key : undefined)

  const escudoUrl = escudoKey ? getEscudoUrl(escudoKey) : null

  // Check for custom imported logo
  useEffect(() => {
    if (!escudoKey) return
    const refresh = () => setCustomLogo(getCustomLogoUrl(escudoKey))
    refresh()
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.key === escudoKey) refresh()
    }
    window.addEventListener("ultrafoot:logo:changed", handler)
    // O persistent-store carrega o cache do disco de forma assincrona (e cada
    // navegacao reinicia esse cache). Sem re-ler aqui, um escudo ja importado
    // continuaria caindo no fallback ate ser reimportado.
    window.addEventListener("ultrafoot:store:ready", refresh)
    // O pacote de atualizacao chega DEPOIS da montagem: sem re-resolver, o escudo
    // novo seria baixado e gravado, e a tela continuaria com o antigo ate reabrir
    // o jogo (o mesmo motivo de PlayerAvatar escutar este evento).
    window.addEventListener("ultrafoot:elencos:atualizados", refresh)
    return () => {
      window.removeEventListener("ultrafoot:logo:changed", handler)
      window.removeEventListener("ultrafoot:store:ready", refresh)
      window.removeEventListener("ultrafoot:elencos:atualizados", refresh)
    }
  }, [escudoKey])

  const { container, text, inner } = sizeMap[size]
  const pixels = sizePixels[size]

  useEffect(() => {
    setImageError(false)
    setImageLoaded(false)
    setRetryCount(0)
    // ⚠️ NO APP INSTALADO COMECA JA PELO ARQUIVO EMPACOTADO.
    //
    // O `src` do HTML pre-renderizado e sempre a URL REMOTA (no build `window`
    // nao existe, entao `isTauri()` e falso). Ate agora o caminho local so era
    // tentado DEPOIS de o remoto falhar — quatro tentativas mais o 404. Isso
    // funcionava com internet boa; sem rede, com o GitHub lento ou com o clube
    // faltando no repositorio de terceiros (o caso de brasiliense_df, que la
    // nao existe com esse nome), a cadeia acabava no ESCUDO DESENHADO. Era o
    // relato "apareceu a versao desenhada".
    //
    // Depois da hidratacao `isTauri()` responde a verdade, e o arquivo local
    // esta garantido: `public/escudos/**/*` inteiro vai em bundle.resources.
    setFormaDaUrl(isTauri() && escudoKey && !customLogo ? 1 : 0)
  }, [escudoUrl, customLogo, escudoKey])

  /**
   * Imagem JA em cache nao dispara onLoad.
   *
   * O <img> so fica visivel quando imageLoaded vira true (opacity-0 -> opacity-100).
   * Quando a imagem ja esta no cache do webview, o evento `load` acontece ANTES do React
   * anexar o handler: onLoad nunca e chamado, imageLoaded fica false para sempre e o
   * escudo some — sem erro, entao nem o fallback aparecia. Era exatamente o caso do
   * escudo do TIME DO USUARIO, que aparece em toda tela e por isso e o mais cacheado.
   *
   * Aqui perguntamos ao proprio elemento se ele ja terminou de carregar.
   */
  useEffect(() => {
    const img = imgRef.current
    if (img?.complete && img.naturalWidth > 0) setImageLoaded(true)
  }, [escudoUrl, customLogo, retryCount, formaDaUrl])

  // SELEÇÃO (Task 2): o "time" de uma seleção usa file_key `nation_<id>`, que NÃO
  // existe no mapa de escudos de clubes. Nesse caso o escudo real vem do próprio
  // `escudo_url` (getNationalCrestUrl). Restrito a `nation_` para não alterar em
  // nada a resolução dos clubes.
  const isNationKey = (escudoKey ?? "").startsWith("nation_")
  const nationCrest = isNationKey ? (resolvedTeam?.escudo_url || null) : null
  const urlBase = customLogo ?? nationCrest ?? escudoUrl
  // SEGUNDA FORMA da URL (ver handleError):
  //   • com chave do clube -> o caminho EMPACOTADO via game-asset:// (cobre o
  //     caso principal, em que a base veio como URL remota do pre-render);
  //   • sem chave -> o flip simples caminho <-> protocolo.
  // `null` quando nao ha segunda forma possivel (data:/blob:).
  const proximaForma = /^(data:|blob:)/i.test(urlBase ?? "")
    ? null
    : escudoKey
      ? gameAssetUrl(getLocalEscudoPath(escudoKey))
      : gameAssetUrlAlternativa(urlBase ?? "")
  const activeUrl = formaDaUrl === 1 ? (proximaForma ?? urlBase) : urlBase

  // ⚠️ O QUE ESTAVA ACONTECENDO (relato: "escudos e uniformes foram perdidos" —
  // escudo generico e imagem quebrada no app instalado, desde a 1.0.266).
  //
  // `getEscudoUrl` decide a URL por ambiente:
  //
  //     if (isTauri())  ->  game-asset://localhost/escudos/x.webp   (empacotado)
  //     senao           ->  https://.../teams/escudos/x.png         (repo remoto)
  //
  // O jogo e EXPORT ESTATICO: o HTML e pre-renderizado no build, onde `window`
  // nao existe e `isTauri()` e FALSO. Entao o `src` que vai gravado no HTML e a
  // URL REMOTA — e o React nao corrige atributo divergente na hidratacao, entao
  // ela permanece dentro do aplicativo. O escudo passou a depender de internet e
  // de um repositorio de terceiros: sem rede (ou com ele fora do ar), 404 ->
  // escudo generico.
  //
  // Repetir a MESMA url quatro vezes, que era o que este handler fazia, nunca
  // resolveria: o problema nao e instabilidade, e a url errada.
  //
  // A saida e cair no CAMINHO EMPACOTADO, que existe no disco do jogador
  // independentemente de ambiente (`getLocalEscudoPath` — o mesmo que o
  // preflight de release usa). So depois disso desistimos para o desenho.
  const handleError = () => {
    if (retryCount < MAX_RETRIES) {
      setTimeout(() => setRetryCount((c) => c + 1), 120)
      return
    }
    if (formaDaUrl === 0 && proximaForma) {
      setFormaDaUrl(1)
      setRetryCount(0)
      return
    }
    setImageError(true)
  }

  // Professional fallback shield component
  const FallbackShield = () => {
    const cor1 = resolvedTeam?.cor1 || "#10b981"
    const cor2 = resolvedTeam?.cor2 || "#064e3b"
    const initial = resolvedTeam?.curto?.charAt(0) || teamShort?.charAt(0) || "?"
    const shortName = resolvedTeam?.curto || teamShort || "?"
    
    return (
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden",
          container,
          className,
        )}
        aria-label={`Escudo ${resolvedTeam?.nome || teamShort || 'Time'}`}
      >
        <svg 
          viewBox="0 0 100 120" 
          className="w-full h-full"
          style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.4))" }}
        >
          {/* Shield shape with gradient */}
          <defs>
            <linearGradient id={`shield-grad-${escudoKey || 'default'}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={cor1} />
              <stop offset="100%" stopColor={cor2} />
            </linearGradient>
            <linearGradient id={`shine-${escudoKey || 'default'}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
            <clipPath id={`shield-clip-${escudoKey || 'default'}`}>
              <path d="M50 0 L95 15 L95 70 Q95 100 50 120 Q5 100 5 70 L5 15 Z" />
            </clipPath>
          </defs>
          
          {/* Shield background */}
          <path 
            d="M50 0 L95 15 L95 70 Q95 100 50 120 Q5 100 5 70 L5 15 Z"
            fill={`url(#shield-grad-${escudoKey || 'default'})`}
          />
          
          {/* Inner border */}
          <path 
            d="M50 6 L89 19 L89 68 Q89 94 50 113 Q11 94 11 68 L11 19 Z"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
          />
          
          {/* Shine overlay */}
          <path 
            d="M50 0 L95 15 L95 70 Q95 100 50 120 Q5 100 5 70 L5 15 Z"
            fill={`url(#shine-${escudoKey || 'default'})`}
          />
          
          {/* Horizontal stripe */}
          <rect 
            x="5" 
            y="45" 
            width="90" 
            height="20" 
            fill="rgba(0,0,0,0.15)"
            clipPath={`url(#shield-clip-${escudoKey || 'default'})`}
          />
          
          {/* Team abbreviation */}
          <text 
            x="50" 
            y="72" 
            textAnchor="middle" 
            fill="white" 
            fontSize="28"
            fontWeight="900"
            fontFamily="system-ui, -apple-system, sans-serif"
            style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}
          >
            {shortName.substring(0, 3)}
          </text>
        </svg>
      </div>
    )
  }

  if (!activeUrl || (imageError && showFallback)) {
    return <FallbackShield />
  }

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center",
        container,
        className,
      )}
      aria-label={`Escudo ${resolvedTeam?.nome || teamShort || 'Time'}`}
    >
      {/* Loading shimmer */}
      {!imageLoaded && !imageError && (
        <div
          className={cn(
            "absolute inset-0 rounded-xl animate-pulse bg-gradient-to-br from-white/10 to-white/5",
            container
          )}
        />
      )}

      <Image
        ref={imgRef}
        key={`${escudoKey ?? ""}-${retryCount}-${formaDaUrl}-${customLogo ? "custom" : "default"}`}
        src={activeUrl}
        alt={`Escudo ${resolvedTeam?.nome || 'Time'}`}
        width={pixels}
        height={pixels}
        className={cn(
          "object-contain transition-all duration-300",
          imageLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95",
        )}
        style={{
          filter: imageLoaded ? "drop-shadow(0 4px 12px rgba(0,0,0,0.4))" : undefined,
        }}
        onLoad={() => setImageLoaded(true)}
        onError={handleError}
        unoptimized
      />
    </div>
  )
}

// Export a simpler version for lists
export function TeamCrestSmall({ 
  team, 
  teamShort,
  className 
}: { 
  team?: Team
  teamShort?: string
  className?: string 
}) {
  return (
    <TeamCrest 
      team={team} 
      teamShort={teamShort}
      size="sm" 
      className={className} 
    />
  )
}
