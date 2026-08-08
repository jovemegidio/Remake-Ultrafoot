"use client"

import { Fragment, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { ControllerButton, useGamepadConnected } from "@/components/controller-buttons"
import { normalizeAppHref, toClientRoute } from "@/lib/hard-navigation"
import { initPersistentStore, storeGet, storeSet } from "@/lib/persistent-store"
import { applySavedFullscreen, toggleFullscreen } from "@/lib/fullscreen"
import { accessibilityStore } from "@/lib/accessibility-store"
import { syncCurrencyFromStore, getCurrencyCode } from "@/lib/currency"
import type { InGameUpdateOffer } from "@/lib/updater"

// Versao do "o que ha de novo". Trocar SO quando houver novidade a apresentar —
// e o que faz o modal reaparecer para quem ja viu a anterior.
const WHATS_NEW_VERSION = "1.0.271"
const WHATS_NEW_KEY = "ultrafoot:last-seen-whats-new"

export function NativeAppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  // Confirmacao antes de fechar o app (Alt+F4, botao X, barra de tarefas).
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)
  const [updateOffer, setUpdateOffer] = useState<InGameUpdateOffer | null>(null)
  const [showWhatsNew, setShowWhatsNew] = useState(false)

  useEffect(() => {
    const bridge = window as Window & {
      __ULTRAFOOT_NAVIGATION_READY__?: boolean
      __ULTRAFOOT_PENDING_NAVIGATION__?: { href: string; replace: boolean }
    }
    const navigate = (href: string, replace = false) => {
      const clientHref = toClientRoute(href)
      const previousHref = `${window.location.pathname}${window.location.search}${window.location.hash}`
      if (replace) router.replace(clientHref)
      else router.push(clientHref)

      // O App Router do Next 16 pode aceitar router.push sem trocar de pagina no
      // export estatico (principalmente partindo de `/`). Se isso acontecer, usa a
      // URL de diretorio realmente gerada pelo export. O atraso evita recarregar uma
      // navegacao SPA que esteja apenas aguardando o payload RSC.
      window.setTimeout(() => {
        const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`
        if (currentHref !== previousHref) return
        const staticHref = normalizeAppHref(clientHref)
        if (replace) window.location.replace(staticHref)
        else window.location.assign(staticHref)
      }, 900)
    }
    const onNavigate = (event: Event) => {
      const detail = (event as CustomEvent<{ href: string; replace?: boolean }>).detail
      if (!detail?.href) return
      navigate(detail.href, Boolean(detail.replace))
    }
    bridge.__ULTRAFOOT_NAVIGATION_READY__ = true
    window.addEventListener("ultrafoot:navigate", onNavigate)
    const pending = bridge.__ULTRAFOOT_PENDING_NAVIGATION__
    if (pending) {
      delete bridge.__ULTRAFOOT_PENDING_NAVIGATION__
      navigate(pending.href, pending.replace)
    }
    return () => {
      bridge.__ULTRAFOOT_NAVIGATION_READY__ = false
      window.removeEventListener("ultrafoot:navigate", onNavigate)
    }
  }, [router])

  // "O que ha de novo" aparece UMA unica vez por versao.
  //
  // Antes o flag era lido/gravado no localStorage cru e o modal voltava a cada
  // abertura: o WebView2 limpa o localStorage na atualizacao (e o efeito ainda
  // corria ANTES de initPersistentStore() espelhar o durável de volta, entao
  // mesmo sem limpeza a leitura via de um storage vazio). O flag agora vive no
  // store durável, e e gravado no momento em que o modal APARECE — fechar o
  // jogo com ele aberto nao faz reaparecer.
  // A BUSCA DE ELENCOS PELO SERVIDOR SAIU NA 1.0.240.
  //
  // Ela existia para corrigir elenco, transferencia e escudo sem reinstalar —
  // um pacote a parte, baixado no boot e aplicado por cima do build. Isso e
  // justamente a "atualizacao por partes" que deixou de existir: elenco e time
  // agora vem dentro da build, e quem traz a build e o Ultrafoot Launcher.
  //
  // Com ela saiu tambem o convite de consentimento, que so existia porque havia
  // uma conexao a autorizar no boot.

  useEffect(() => {
    let cancelled = false
    let timer = 0
    void initPersistentStore().then(() => {
      if (cancelled || storeGet(WHATS_NEW_KEY) === WHATS_NEW_VERSION) return
      timer = window.setTimeout(() => {
        if (cancelled) return
        storeSet(WHATS_NEW_KEY, WHATS_NEW_VERSION)
        setShowWhatsNew(true)
      }, 1200)
    })
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  // Perfil leve automático para hardware modesto. O usuário não precisa descobrir
  // uma configuração antes de conseguir navegar: reduz GPU/CPU já no primeiro boot.
  useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number }
    const lowCpu = (nav.hardwareConcurrency ?? 8) <= 4
    const lowMemory = (nav.deviceMemory ?? 8) <= 4
    const forced = localStorage.getItem("ultrafoot:performance-mode")
    const enabled = forced === "on" || (forced !== "off" && (lowCpu || lowMemory))
    document.documentElement.toggleAttribute("data-performance-mode", enabled)
    if (enabled) document.documentElement.setAttribute("data-a11y-reduce-motion", "")
  }, [])

  // Moeda de exibicao. O 1o render usa SEMPRE o padrao BRL (igual ao HTML do build) para
  // nao quebrar a hidratacao (#418). Apos montar, aplicamos a preferencia salva; so quem
  // escolheu moeda != BRL sofre um remount (via key) — usuarios BRL nao mudam nada.
  const [currencyKey, setCurrencyKey] = useState(0)
  useEffect(() => {
    const onUpdate = (event: Event) => {
      setUpdateOffer((event as CustomEvent<InGameUpdateOffer>).detail)
    }
    window.addEventListener("ultrafoot:update-available", onUpdate)
    return () => window.removeEventListener("ultrafoot:update-available", onUpdate)
  }, [])

  useEffect(() => {
    syncCurrencyFromStore()
    if (getCurrencyCode() !== "BRL") setCurrencyKey((k) => k + 1)
    const onChange = () => {
      syncCurrencyFromStore()
      setCurrencyKey((k) => k + 1)
    }
    window.addEventListener("ultrafoot:currency:changed", onChange)
    return () => window.removeEventListener("ultrafoot:currency:changed", onChange)
  }, [])

  // Intercepta o fechamento da janela no Tauri: pede confirmacao em vez de sair
  // direto. onCloseRequested cobre Alt+F4, o X e o fechar pela barra de tarefas.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("__TAURI_INTERNALS__" in window)) return

    let unlisten: (() => void) | undefined
    let cancelled = false
    void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      if (cancelled) return
      getCurrentWindow()
        .onCloseRequested((event) => {
          // Impede o fechamento imediato e mostra o aviso.
          event.preventDefault()
          setShowQuitConfirm(true)
        })
        .then((fn) => {
          if (cancelled) fn()
          else unlisten = fn
        })
    })

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])

  // Fechar o jogo NUNCA pode falhar.
  //
  // BUG que isto corrige ("nao consigo fechar o jogo nem no alt f4"): o onCloseRequested
  // faz preventDefault() e mostra este aviso; o "Sair" chamava destroy(). Só que
  // `core:window:default` do Tauri v2 NAO inclui `allow-destroy` — a chamada era negada
  // em silencio. Resultado: o fechamento estava bloqueado e nada o desbloqueava. O jogo
  // ficava impossivel de fechar.
  //
  // Alem de conceder a permissao (capabilities/default.json), aqui vai o cinto de
  // seguranca: se destroy() falhar, encerra o PROCESSO pelo plugin process.
  const confirmQuit = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window")
      await getCurrentWindow().destroy()
      return
    } catch {
      // cai no fallback abaixo
    }
    try {
      const { exit } = await import("@tauri-apps/plugin-process")
      await exit(0)
    } catch {
      // Ultimo recurso: libera o fechamento nativo removendo o bloqueio.
      window.close()
    }
  }

  useEffect(() => {
    void initPersistentStore()
    // Acessibilidade primeiro: reaplica fonte/contraste ANTES da UI pintar, senao o
    // usuario que aumentou a fonte veria a tela "pular" a cada boot.
    accessibilityStore.init()
    // Reaplica a tela cheia salva assim que o store carrega.
    void applySavedFullscreen()
  }, [])

  useEffect(() => {
    const disableContextMenu = (e: MouseEvent) => e.preventDefault()

    const disableBrowserShortcuts = (e: KeyboardEvent) => {
      // F11 alterna a tela cheia persistente do jogo (em vez do fullscreen do browser).
      if (e.key === "F11") {
        e.preventDefault()
        void toggleFullscreen()
        return
      }
      const blocked =
        e.key === "F5" ||
        e.key === "F12" ||
        (e.ctrlKey && e.key === "r") ||
        (e.ctrlKey && e.key === "R") ||
        (e.ctrlKey && e.key === "u") ||
        (e.ctrlKey && e.key === "U") ||
        (e.ctrlKey && e.shiftKey && e.key === "I") ||
        (e.ctrlKey && e.shiftKey && e.key === "i") ||
        (e.ctrlKey && e.shiftKey && e.key === "J") ||
        (e.ctrlKey && e.shiftKey && e.key === "j")

      if (blocked) e.preventDefault()
    }

    // Bloqueia o arrasto NATIVO de imagem/link/texto (é o que denuncia "isto é uma
    // pagina web"), mas nao o drag-and-drop do proprio jogo: cancelar todo dragstart
    // matava a escalacao, onde os jogadores sao [draggable].
    const disableDrag = (e: DragEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest?.("[draggable='true']")) return
      e.preventDefault()
    }

    const forceStaticAnchorNavigation = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return
      }

      const target = e.target as HTMLElement | null
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null
      if (!anchor || (anchor.target && anchor.target !== "_self")) return

      // Alguns componentes usam href temporario/vazio durante a hidratacao. No WebView
      // isso pode chegar como uma string que o construtor URL rejeita e derrubar a tela
      // inicial inteira. Link invalido simplesmente fica a cargo do navegador.
      let url: URL
      try {
        url = new URL(anchor.getAttribute("href") ?? anchor.href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return

      const nextHref = normalizeAppHref(`${url.pathname}${url.search}${url.hash}`)
      const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`
      if (nextHref === currentHref) return

      e.preventDefault()
      if (nextHref.startsWith("/")) {
        window.dispatchEvent(new CustomEvent("ultrafoot:navigate", {
          detail: { href: toClientRoute(nextHref), replace: false },
        }))
      }
      else window.location.assign(nextHref)
    }

    document.addEventListener("contextmenu", disableContextMenu)
    document.addEventListener("keydown", disableBrowserShortcuts)
    document.addEventListener("dragstart", disableDrag)
    document.addEventListener("click", forceStaticAnchorNavigation, true)
    document.documentElement.style.userSelect = "none"

    // Confere a versao publicada alguns segundos apos o boot, sem bloquear a
    // splash. No navegador (fora do Tauri) e no-op.
    //
    // NA 1.0.240 ISTO DEIXOU DE SER OPCIONAL. Antes passava por consentimento,
    // "atualizacao automatica" e canal "jogo" — tres chaves que, desligadas,
    // deixavam o jogador numa build velha conversando com o servidor online de
    // outra versao. Estar atualizado nao e preferencia; quem instala continua
    // sendo o Ultrafoot Launcher.
    const updateTimer = window.setTimeout(() => {
      void initPersistentStore().then(() => {
        void import("@/lib/updater").then((m) => m.checkForUpdates({ silent: true }))
      })
    }, 5000)

    return () => {
      window.clearTimeout(updateTimer)
      document.removeEventListener("contextmenu", disableContextMenu)
      document.removeEventListener("keydown", disableBrowserShortcuts)
      document.removeEventListener("dragstart", disableDrag)
      document.removeEventListener("click", forceStaticAnchorNavigation, true)
    }
  }, [router])

  return (
    <>
      <Fragment key={currencyKey}>{children}</Fragment>
      {showQuitConfirm && (
        <QuitConfirmDialog
          onCancel={() => setShowQuitConfirm(false)}
          onConfirm={confirmQuit}
        />
      )}
      {updateOffer && (
        <InGameUpdateDialog offer={updateOffer} onLater={() => setUpdateOffer(null)} />
      )}
      {showWhatsNew && (
        <WhatsNewDialog onClose={() => {
          storeSet(WHATS_NEW_KEY, WHATS_NEW_VERSION)
          setShowWhatsNew(false)
        }} />
      )}
    </>
  )
}

function WhatsNewDialog({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(0)
  const pages = [
    {
      eyebrow: "Temporada 2026 · Build 1.0.271",
      title: "A temporada volta a virar",
      body: "Carreiras ficavam presas no mesmo ano para sempre: os adversários da liga eram remontados a cada carregamento, então uma atualização do jogo reescrevia o campeonato no meio da temporada e o fim de ano nunca chegava — sem acesso e sem rebaixamento.",
      accent: "CARREIRA",
      bullets: [
        "Os adversários da temporada ficam gravados na carreira",
        "Liga com número ímpar de clubes voltou a poder terminar",
        "Acesso e rebaixamento aplicados de novo na virada",
      ],
    },
    {
      eyebrow: "Competições brasileiras",
      title: "Série D regulamentada, Série C completa",
      body: "A Série D rodava com 27 clubes — número ímpar, 52 rodadas e a temporada indo até a semana 86. E a Série C tinha só 12 dos 20 clubes reais: as outras oito vagas eram sorteadas por prestígio.",
      accent: "BRASILEIRÃO",
      bullets: [
        "Série D com 20 clubes e 38 rodadas",
        "Ituano, Anápolis, Brusque, Maranhão, Maringá, Ferroviária, Itabaiana e Barra-SC na Série C",
        "Dezembro deixou de acumular o dobro de jogos",
      ],
    },
    {
      eyebrow: "Prancheta e dia de jogo",
      title: "As instruções finalmente mudam alguma coisa",
      body: "O botão \"Com a bola / Sem a bola\" trocava apenas o próprio texto. E apagar a seta de movimentação não apagava a instrução que ela tinha gerado: mexeu uma vez, ficava para sempre.",
      accent: "TÁTICA",
      bullets: [
        "Com a bola / Sem a bola troca o que o arrasto edita",
        "Botão para zerar a movimentação de um atleta ou do time",
        "Prancheta e táticas abrem dentro do pré-jogo, sem sair da partida",
        "Estrelas e ATA/MEI/DEF saem do elenco de verdade",
      ],
    },
    {
      eyebrow: "Controle",
      title: "O joystick chega aos modais",
      body: "A ponte de gamepad só enxergava um tipo de janela, e a maior parte dos modais do jogo é feita de outro jeito. Mesa de negociação, batedor de pênalti, coletiva, contrato e exame médico eram becos sem saída no controle.",
      accent: "GAMEPAD",
      bullets: [
        "A aciona, B fecha e o direcional navega em 35 modais",
        "Aviso de saída com opção selecionada e dicas do controle ligado",
        "Leilão passou a respeitar a verba liberada pela diretoria",
      ],
    },
  ]
  const current = pages[page]
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
      else if (event.key === "Enter") {
        if (page < pages.length - 1) setPage(value => value + 1)
        else onClose()
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [page, onClose, pages.length])
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-[#020308]/82 p-5 backdrop-blur-xl">
      <section className="w-full max-w-3xl overflow-hidden border border-white/[0.08] bg-gradient-to-br from-[#171724]/98 via-[#11121c]/98 to-[#090b11]/98 shadow-[0_35px_120px_rgba(0,0,0,.75)]">
        <div className="grid min-h-[380px] md:grid-cols-[1.45fr_.75fr]">
          <div className="flex flex-col px-8 py-8 md:px-10">
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-[var(--brand)]">{current.eyebrow}</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-white">{current.title}</h2>
            <p className="mt-5 max-w-xl text-sm leading-6 text-white/62">{current.body}</p>
            <div className="mt-6 space-y-2">{current.bullets.map(item => <div key={item} className="flex items-center gap-3 text-xs text-white/72"><span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]"/>{item}</div>)}</div>
            <div className="mt-auto flex items-center gap-3 pt-8">
              <button disabled={page === 0} onClick={() => setPage(value => value - 1)} className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-white/50 disabled:opacity-25">‹</button>
              <span className="text-[10px] font-bold text-white/35">{page + 1} de {pages.length}</span>
              <button disabled={page === pages.length - 1} onClick={() => setPage(value => value + 1)} className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-white/50 disabled:opacity-25">›</button>
            </div>
          </div>
          <div className="relative grid min-h-[250px] place-items-center overflow-hidden border-t border-white/[0.06] bg-gradient-to-br from-[#44116e]/60 via-[#a2135f]/35 to-[#10182c] md:border-l md:border-t-0">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-fuchsia-500/25 blur-3xl"/>
            <div className="relative text-center"><div className="text-6xl font-black italic tracking-[-.08em] text-white">UF26</div><div className="mt-4 border-y border-white/20 py-3 text-[10px] font-black tracking-[.26em] text-white/70">{current.accent}</div><p className="mt-3 text-[10px] text-white/35">PRÓXIMA VERSÃO</p></div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-white/[0.07] px-8 py-4">
          <span className="text-[10px] text-white/30">Enter/A avança · Esc fecha após concluir</span>
          <button onClick={page < pages.length - 1 ? () => setPage(value => value + 1) : onClose} className="rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-[var(--brand)] px-7 py-2.5 text-xs font-black text-white shadow-[0_0_25px_rgba(0,255,200,.22)]">{page < pages.length - 1 ? "Avançar" : "Entrar no jogo"}</button>
        </div>
      </section>
    </div>
  )
}

function InGameUpdateDialog({ offer, onLater }: { offer: InGameUpdateOffer; onLater: () => void }) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-5 backdrop-blur-md">
      <section className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--brand)]/25 bg-[#0b1014] shadow-[0_24px_90px_rgba(0,255,200,.16)]">
        <div className="border-b border-white/10 bg-gradient-to-r from-[var(--brand)]/15 to-cyan-500/5 px-6 py-5">
          <p className="text-[11px] font-black uppercase tracking-[.22em] text-[var(--brand)]">Atualização do jogo</p>
          <h2 className="mt-1 text-2xl font-black text-white">Ultrafoot 26 v{offer.version}</h2>
          <p className="mt-1 text-sm text-white/55">Uma nova versão está disponível.</p>
        </div>
        <div className="px-6 py-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/50">Novidades</h3>
          <p className="mt-2 max-h-36 overflow-y-auto whitespace-pre-line text-sm leading-6 text-white/75">{offer.notes}</p>
          <div className="mt-5 rounded-lg border border-[var(--brand)]/20 bg-[var(--brand)]/5 p-4 text-sm leading-6 text-white/80">
            Para atualizar, feche o Ultrafoot 26 e abra o <strong className="text-white">Ultrafoot Launcher</strong>.
            Ele baixa e instala a nova versão automaticamente — não é mais preciso atualizar por dentro do jogo.
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={onLater} className="rounded-lg bg-[var(--brand)] px-5 py-2.5 text-sm font-black text-[var(--brand-ink)] hover:bg-[#4dffda]">Entendi</button>
          </div>
        </div>
      </section>
    </div>
  )
}

/**
 * Rodape de dicas do controle do aviso de saida.
 *
 * Componente separado de proposito: `useGamepadConnected` faz polling a cada 2s
 * e nao pode ficar dentro do dialogo re-renderizando os botoes de escolha.
 */
function QuitPadHints() {
  const { connected, type } = useGamepadConnected()
  if (!connected) return null
  return (
    <div className="relative mt-6 flex items-center justify-center gap-4 text-[10px] text-white/40">
      <span className="flex items-center gap-1.5">
        <ControllerButton button="DPAD_UP" controller={type} size="xs" showLabel={false} />
        escolher
      </span>
      <span className="flex items-center gap-1.5">
        <ControllerButton button="A" controller={type} size="xs" showLabel={false} />
        confirmar
      </span>
      <span className="flex items-center gap-1.5">
        <ControllerButton button="B" controller={type} size="xs" showLabel={false} />
        voltar
      </span>
    </div>
  )
}

// Aviso de saida. O jogo salva sozinho, mas o usuario pediu a confirmacao para nao
// fechar sem querer. Esc/B cancela, A aciona a opcao selecionada (teclado + controle).
function QuitConfirmDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  /**
   * SELECAO NAVEGAVEL. Antes o A confirmava a saida direto e nao havia como
   * ANDAR entre as duas opcoes: no controle o dialogo era cego — nenhuma marca
   * de foco, nenhuma dica de botao, so "(Enter)" e "(Esc)" escritos na tela,
   * que nao existem no joystick. Agora o D-pad/analogico move, A aciona o que
   * ESTA SELECIONADO e B continua sendo o cancelar direto.
   *
   * Comeca em "nao": o botao perigoso nunca pode ser o padrao de um toque.
   */
  const [escolha, setEscolha] = useState<"sim" | "nao">("nao")
  const escolhaRef = useRef(escolha)
  escolhaRef.current = escolha

  useEffect(() => {
    const acionar = () => (escolhaRef.current === "sim" ? onConfirm() : onCancel())
    // FASE DE CAPTURA + stopImmediatePropagation: enquanto o aviso de saida esta aberto,
    // Esc/Enter pertencem SO a ele. Sem isso, a tela de fundo (ex.: menu da splash, que
    // tambem escuta Enter/Esc no document) reagia a mesma tecla — o usuario apertava
    // Enter e, em vez de sair, disparava a acao do menu atras do modal.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault(); e.stopImmediatePropagation(); onCancel()
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Tab") {
        e.preventDefault(); e.stopImmediatePropagation()
        setEscolha(v => (v === "sim" ? "nao" : "sim"))
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault(); e.stopImmediatePropagation()
        // Teclado mantem o contrato historico: Enter = sim. Quem chegou aqui
        // pelo teclado ja apertava Enter para sair desde sempre.
        onConfirm()
      }
    }
    // Controle: A aciona a selecao, B cancela — mesma gramatica do resto do jogo.
    const onPad = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail
      if (button === "A") acionar()
      else if (button === "B") onCancel()
      else if (button === "DPAD_UP" || button === "DPAD_DOWN") {
        setEscolha(v => (v === "sim" ? "nao" : "sim"))
      }
    }
    document.addEventListener("keydown", onKey, true)
    window.addEventListener("gamepad:button", onPad)
    return () => {
      document.removeEventListener("keydown", onKey, true)
      window.removeEventListener("gamepad:button", onPad)
    }
  }, [onCancel, onConfirm])

  return (
    <div
      // Este aviso trata o proprio controle (selecao + A/B logo acima), entao
      // fica FORA da ponte generica — senao o A seria processado duas vezes.
      data-gamepad-modal="off"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#080912]/82 backdrop-blur-xl"
      onClick={onCancel}
    >
      <div
        className="relative w-[520px] max-w-[92vw] overflow-hidden border border-white/[0.07] bg-[#11121d]/92 px-8 py-10 text-center shadow-[0_35px_120px_rgba(0,0,0,.75)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute bottom-[-34px] left-1/2 -translate-x-1/2 text-[150px] font-black text-white/[0.025]">⚙</div>
        <p className="text-[10px] font-black uppercase tracking-[.24em] text-[var(--brand)]">Confirmação</p>
        <h2 className="relative mt-3 text-2xl font-black leading-tight text-white">Tem certeza de que deseja sair do Ultrafoot 26?</h2>
        <p className="relative mx-auto mt-3 max-w-sm text-xs leading-5 text-white/45">Seu progresso atual será gravado antes do encerramento.</p>
        <div className="relative mx-auto mt-7 flex w-44 flex-col gap-2">
          <button
            onClick={onConfirm}
            onMouseEnter={() => setEscolha("sim")}
            aria-selected={escolha === "sim"}
            className={cn(
              "rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-[var(--brand)] px-5 py-2.5 text-sm font-black text-white transition-all",
              // O ANEL E A MARCA DA SELECAO. Sem ele o controle move o foco e
              // nada muda na tela — foi o relato de "o controle nao funciona".
              escolha === "sim"
                ? "shadow-[0_0_22px_rgba(0,255,200,.45)] ring-2 ring-white/80 scale-[1.03]"
                : "opacity-70",
            )}
          >
            Sim <span className="text-white/60">(Enter)</span>
          </button>
          <button
            onClick={onCancel}
            onMouseEnter={() => setEscolha("nao")}
            aria-selected={escolha === "nao"}
            className={cn(
              "rounded-full px-5 py-2.5 text-sm font-semibold transition-all",
              escolha === "nao"
                ? "bg-white/20 text-white ring-2 ring-white/70 scale-[1.03]"
                : "bg-white/10 text-white/75 hover:bg-white/15",
            )}
          >
            Não <span className="text-white/35">(Esc)</span>
          </button>
        </div>

        {/* DICAS DO CONTROLE — so aparecem com um controle ligado, e com os
            simbolos do controle que o jogador escolheu (Xbox/PlayStation).
            Antes a tela so oferecia "(Enter)" e "(Esc)", que nao existem no
            joystick: quem jogava de controle nao tinha o que apertar. */}
        <QuitPadHints />
      </div>
    </div>
  )
}
