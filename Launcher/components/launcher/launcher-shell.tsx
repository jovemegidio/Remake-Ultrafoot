"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { GameWithReleases, NewsWithGame, ReleaseWithChangelog } from "@/lib/data"
import { GameHero } from "./game-hero"
import { NewsFeed } from "./news-feed"
import { ChangelogView } from "./changelog-view"
import { RailDireita } from "./rail-direita"
import { SecurityPanel } from "./security-panel"
import { SettingsDialog } from "./settings-dialog"
import { AuthDialog } from "./auth-dialog"
import { SocialPanel } from "./social-panel"
import { ligarHub, usePresencaDoHub } from "@/lib/hub-store"
import { ChatDock } from "./chat-dock"
import { StorePanel } from "./store-panel"
import { sessaoSalva, sair, revalidar, type Sessao } from "@/lib/auth"
import {
  lerPreferencias, gravarPreferencias, aplicarPreferencias, iniciais, PADRAO,
  type Preferencias,
} from "@/lib/preferencias"
import { CommunityBar } from "./community-bar"
import { BarraDeTitulo, BordasParaRedimensionar } from "./barra-de-titulo"
import { ConfirmarSaida } from "./confirmar-saida"
import { GerenciarPanel } from "./gerenciar-panel"
import { ligarAtalhosDeTelaCheia } from "@/lib/tela-cheia"
import { cn } from "@/lib/utils"
import { useT } from "@/lib/i18n"
import { useLiveLatest } from "@/lib/use-live-latest"
import {
  getInstalledGame,
  fetchLatest,
  installOrUpdate,
  launchGame,
  checkLauncherUpdate,
  selfUpdate,
  getAutostartEnabled,
  setAutostartEnabled,
  aoPedirFechamento,
  esconderJanela,
  encerrarLauncher,
  fetchLauncherConfig,
  checkServerStatus,
  openExternal,
  versaoDoLauncher,
  atualizarPorPartes,
  garantirRequisitos,
  pausarDownload,
  retomarDownload,
  cancelarDownload,
  ouvirEstadoDoDownload,
  estadoDoJogo,
  ouvirEstadoDoJogo,
  ouvirCrashDoJogo,
  pararJogo,
  type ProgressPhase,
  type LatestInfo,
  type LauncherConfig,
  type ServerStatus,
  type EstadoDoJogo,
} from "@/lib/launcher-bridge"
import { Home, Newspaper, ScrollText, ShieldCheck, ShieldOff, Wifi, WifiOff, Settings, User, LogIn, Users, ShoppingBag, SlidersHorizontal } from "lucide-react"

const CLOSE_TO_TRAY_KEY = "ultrafoot-launcher:close-to-tray"
const MODE_KEY = "ultrafoot-launcher:mode"

export type GameStatus = "not-installed" | "downloading" | "update" | "playable"
export type LaunchMode = "online" | "offline"

export type InstallState = {
  version: string | null
  /**
   * O jogo EXISTE no disco, mesmo que a versão não tenha sido lida.
   *
   * Separado de `version` de propósito: o registro pode ter a entrada do jogo
   * com `DisplayVersion` vazio. Antes o status olhava só para `version`, então
   * esse caso virava "não instalado" e o launcher rebaixava o jogo inteiro a
   * cada abertura — 630 MB por vez, para sempre.
   */
  installed: boolean
  path: string | null
  downloading: boolean
  phase: ProgressPhase
  progress: number
  speed: number
  eta: number
}

type Tab = "home" | "loja" | "news" | "social" | "changelog" | "security" | "gerenciar"

/**
 * Normaliza "v1.0.239", "1.0.239.0" e "1.0.239 (x64)" no mesmo vetor numérico.
 *
 * ⚠️ É A MESMA REGRA DO `parse_versao` DO RUST, e existe pelo mesmo motivo: o
 * `DisplayVersion` do registro do Windows já chegou com prefixo `v`, com quarto
 * componente e com sufixo entre parênteses. Com `split(".")` cru,
 * `parseInt("v1")` é `NaN`, o `|| 0` o transforma em zero, e "v1.0.239" vira
 * [0, 0, 239] — daí QUALQUER versão publicada parece mais nova que a instalada.
 *
 * O Rust foi consertado quando isso apareceu; esta função ficou para trás, e é
 * ela quem decide o `status` da tela e dispara a atualização obrigatória. Era o
 * loop de "atualiza, sai, entro e atualiza dnv" esperando o registro devolver
 * um `v`.
 */
function partesDaVersao(bruto: string): number[] {
  return (bruto.match(/\d+/g) ?? []).map(parte => Number.parseInt(parte, 10))
}

function isNewerVersion(candidate: string, installed: string): boolean {
  const a = partesDaVersao(candidate)
  const b = partesDaVersao(installed)
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0)
    if (delta !== 0) return delta > 0
  }
  return false
}

export function LauncherShell({
  game,
  news,
}: {
  game: GameWithReleases
  news: NewsWithGame[]
}) {
  const t = useT()
  const [tab, setTab] = useState<Tab>("home")

  // Download pausado pelo jogador (o estado real mora no Rust).
  const [pausado, setPausado] = useState(false)
  // O jogo está aberto AGORA. O launcher sobrevive a ele desde jogo.rs, então
  // este estado existe de verdade — antes o processo já teria morrido aqui.
  const [jogo, setJogo] = useState<EstadoDoJogo | null>(null)
  const [avisoDeCrash, setAvisoDeCrash] = useState(false)

  // Modo de execucao. Comeca SEMPRE "online" para o HTML do export estatico
  // bater com o 1o render (hidratacao); a preferencia salva e a ausencia de rede
  // sao aplicadas logo depois, no efeito de preferencias.
  const [mode, setMode] = useState<LaunchMode>("online")
  // Distingue "o usuario escolheu offline" de "esta sem rede": voltando a rede,
  // so reconectamos sozinhos quem nao pediu offline explicitamente.
  const [forcedOffline, setForcedOffline] = useState(false)

  // Última versão publicada: parte do dado estático embutido e é confirmada em
  // runtime pelo latest.json — assim o launcher reconhece uma versão nova sem
  // precisar ser recompilado.
  const [latest, setLatest] = useState<{
    version: string | null
    url: string | null
    /** Manifesto de arquivos: é ele que habilita a atualização diferencial. */
    manifesto: string | null
    /**
     * O que o instalador baixado TEM de ser (1.0.346). Sem isto o launcher
     * executava o .exe que viesse da rede, sem conferir nada.
     */
    sha256: string | null
    size: number | null
  }>(() => ({
    version: game.latestRelease?.version ?? null,
    url: game.latestRelease?.downloadUrl ?? null,
    manifesto: null,
    sha256: null,
    size: null,
  }))

  const [install, setInstall] = useState<InstallState>({
    version: null,
    installed: false,
    path: null,
    downloading: false,
    phase: "downloading",
    progress: 0,
    speed: 0,
    eta: 0,
  })

  // Auto-update do PRÓPRIO launcher: se há versão nova, atualiza sozinho ao abrir.
  const [launcherUpdate, setLauncherUpdate] = useState<LatestInfo | null>(null)
  const [selfUpdateProgress, setSelfUpdateProgress] = useState<{ phase: ProgressPhase; percent: number }>({
    phase: "downloading",
    percent: 0,
  })
  /**
   * Por que a falha VAI PARA A TELA: antes ela era engolida, e o sintoma que o
   * jogador via era "o launcher fica atualizando para sempre". Um aviso curto,
   * que não bloqueia o Jogar, troca um travamento mudo por uma informação.
   */
  const [falhaAoAtualizar, setFalhaAoAtualizar] = useState<string | null>(null)

  // Configurações do launcher.
  const [showSettings, setShowSettings] = useState(false)
  // CONTA. BAIXAR o jogo exige conta (instalar, atualizar e reparar); JOGAR nao.
  // A separacao e proposital: ha jogadores ativos com registro por codigo serial,
  // e travar o Jogar deixaria quem ja pagou sem abrir o que ja esta instalado.
  const [sessao, setSessao] = useState<Sessao | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  // Motivo de o jogo nao ter aberto, quando o clique em Jogar falha.
  const [erroAoAbrir, setErroAoAbrir] = useState<string | null>(null)
  // Preferencias visuais. Aplicadas ANTES do primeiro render util para o
  // launcher nao piscar no tema padrao antes de trocar para o escolhido.
  const [prefs, setPrefs] = useState<Preferencias>(PADRAO)
  useEffect(() => {
    const p = lerPreferencias()
    setPrefs(p)
    aplicarPreferencias(p)
  }, [])

  // TELA CHEIA: o launcher abre em fullscreen, e nela o Tauri esconde a barra de
  // título — some o X. Como esta janela não tem controles próprios, os atalhos
  // são a única saída; sem eles o jogador fica preso. Ver lib/tela-cheia.ts.
  useEffect(() => ligarAtalhosDeTelaCheia(), [])
  const salvarPrefs = (p: Preferencias) => { setPrefs(p); gravarPreferencias(p) }

  useEffect(() => {
    const s = sessaoSalva()
    setSessao(s)
    // Sessao guardada: confirma com o servidor em segundo plano. Se ele disser
    // que caiu, ai sim pedimos login — nunca por falha de rede.
    if (s) {
      void revalidar().then(atualizada => {
        setSessao(atualizada)
        if (!atualizada) setShowAuth(true)
      })
    }
    // ABRE JA NO LOGIN, como Epic e EA App fazem. O dialogo segue FECHAVEL de
    // proposito: quem ja tem o jogo instalado continua jogando sem conta. O que
    // a conta destrava e o DOWNLOAD (instalar/atualizar/reparar).
    //
    // SEM REDE (ou no modo offline) o launcher NAO pede login: nenhum login
    // funcionaria, e a primeira coisa na tela seria um formulario condenado a
    // falhar. Offline o launcher abre direto no Jogar, como o jogo faz.
    const querOffline = typeof window !== "undefined" && localStorage.getItem(MODE_KEY) === "offline"
    const temRede = typeof navigator === "undefined" || navigator.onLine
    if (!s && temRede && !querOffline) setShowAuth(true)
  }, [])
  // Versão do próprio launcher, para o rodapé da lateral.
  const [versaoLauncher, setVersaoLauncher] = useState("")
  useEffect(() => {
    void versaoDoLauncher().then(setVersaoLauncher)
  }, [])
  const [autostart, setAutostart] = useState(false)
  const [closeToTray, setCloseToTray] = useState(false)
  const closeToTrayRef = useRef(false)
  closeToTrayRef.current = closeToTray
  const [confirmandoSaida, setConfirmandoSaida] = useState(false)

  // PEDIDO DE FECHAMENTO (X da barra, Alt+F4, fechar pelo sistema).
  //
  // Com "minimizar para a bandeja" ligado não há o que confirmar: nada está
  // sendo fechado, a janela só some. Sem a opção, a saída é definitiva — aí a
  // pergunta aparece. O ref existe porque este callback é registrado uma vez no
  // ouvinte do Tauri e não pode congelar o valor da preferência.
  const pedirParaFechar = useCallback(() => {
    if (closeToTrayRef.current) {
      void esconderJanela()
      return
    }
    setConfirmandoSaida(true)
  }, [])

  useEffect(() => {
    // Carrega preferências e liga o "fechar para a bandeja".
    setCloseToTray(typeof window !== "undefined" && localStorage.getItem(CLOSE_TO_TRAY_KEY) === "1")
    const saved = localStorage.getItem(MODE_KEY)
    if (saved === "offline") {
      setForcedOffline(true)
      setMode("offline")
    } else if (!navigator.onLine) {
      // Sem rede: abre em offline por conta propria, sem gravar a preferencia.
      setMode("offline")
    }
    void getAutostartEnabled().then(setAutostart)
    let cleanup = () => {}
    void aoPedirFechamento(pedirParaFechar).then((un) => {
      cleanup = un
    })
    return () => cleanup()
  }, [pedirParaFechar])

  const toggleCloseToTray = useCallback((value: boolean) => {
    setCloseToTray(value)
    if (typeof window !== "undefined") localStorage.setItem(CLOSE_TO_TRAY_KEY, value ? "1" : "0")
  }, [])

  const toggleAutostart = useCallback(async (value: boolean) => {
    setAutostart(value)
    try {
      await setAutostartEnabled(value)
    } catch {
      setAutostart(!value) // reverte se falhar
    }
  }, [])

  // Troca de modo pelo seletor: a escolha e lembrada entre sessoes.
  //
  // Pedir "Online" SEM REDE nao coloca o launcher online — so registra a vontade.
  // Sem isso, um clique no seletor fazia o launcher se achar conectado e tentar
  // rede que nao existe: loja girando, chat mudo e botao de instalar morto. O
  // modo volta sozinho quando a rede volta (o ouvinte de `online` abaixo).
  const changeMode = useCallback((value: LaunchMode) => {
    setForcedOffline(value === "offline")
    if (typeof window !== "undefined") localStorage.setItem(MODE_KEY, value)
    if (value === "online" && typeof navigator !== "undefined" && !navigator.onLine) {
      setMode("offline")
      return
    }
    setMode(value)
  }, [])

  // Rede caindo/voltando durante a sessao. Quem escolheu offline no seletor
  // permanece offline mesmo com a rede de volta.
  useEffect(() => {
    const goOffline = () => setMode("offline")
    const goOnline = () => setMode(forcedOffline ? "offline" : "online")
    window.addEventListener("offline", goOffline)
    window.addEventListener("online", goOnline)
    return () => {
      window.removeEventListener("offline", goOffline)
      window.removeEventListener("online", goOnline)
    }
  }, [forcedOffline])

  const online = mode === "online"
  // Porteiro do download: sem sessao, nada e baixado (ver startDownload).
  const logado = !!sessao

  // Config remota (comunidade): notícias, banner, redes e status do servidor.
  const [config, setConfig] = useState<LauncherConfig | null>(null)
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null)

  useEffect(() => {
    if (!online) return
    let alive = true
    void (async () => {
      const cfg = await fetchLauncherConfig()
      if (!alive) return
      setConfig(cfg)
      if (cfg?.serverStatusUrl) {
        const st = await checkServerStatus(cfg.serverStatusUrl)
        if (alive) setServerStatus(st)
      }
    })()
    return () => {
      alive = false
    }
  }, [online])

  // Notícias remotas (config) têm prioridade sobre as embutidas.
  const effectiveNews: NewsWithGame[] =
    config?.news && config.news.length > 0
      ? config.news
          .map((n, i) => ({
            id: 100000 + i,
            gameId: game.id,
            title: n.title,
            category: n.category ?? "Novidades",
            excerpt: n.body ?? null,
            body: n.body ?? null,
            image: null,
            isPinned: n.pinned ?? false,
            publishedAt: n.date ? new Date(n.date) : new Date(),
            gameName: null,
          }))
          .sort((a, b) => {
            if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
            return b.publishedAt.getTime() - a.publishedAt.getTime()
          })
      : news

  // Changelog remoto (config) tem prioridade sobre o embutido.
  const effectiveReleases: ReleaseWithChangelog[] | undefined =
    config?.changelog && config.changelog.length > 0
      ? config.changelog.map((r, ri) => ({
          id: 200000 + ri,
          gameId: game.id,
          version: r.version,
          channel: "stable",
          title: r.title ?? null,
          downloadUrl: null,
          sizeMb: 0,
          isLatest: r.latest ?? ri === 0,
          isRequired: false,
          releasedAt: r.date ? new Date(r.date) : new Date(),
          createdAt: r.date ? new Date(r.date) : new Date(),
          changelog: (r.changes ?? []).map((c, ci) => ({
            id: 300000 + ri * 100 + ci,
            releaseId: 200000 + ri,
            type: c.type ?? "added",
            description: c.text,
            sortOrder: ci,
          })),
        }))
      : undefined

  useEffect(() => {
    if (!online) return
    let alive = true
    void (async () => {
      const upd = await checkLauncherUpdate()
      if (!alive || !upd) return

      // ⚠️ `auto === false` = esta versão JÁ FALHOU as vezes permitidas.
      //
      // Insistir era o loop de 02/08/2026: instalação falhava calada, o launcher
      // reabria na versão velha, via a atualização de novo e recomeçava. Agora
      // ele desiste de tentar sozinho e deixa o jogador seguir jogando — o botão
      // Jogar continua valendo com a versão instalada.
      if (upd.auto === false) {
        setFalhaAoAtualizar(
          "Não consegui instalar a atualização do launcher. Você pode continuar jogando normalmente.",
        )
        return
      }

      setLauncherUpdate(upd)
      // Atualiza automaticamente: baixa, instala e reabre (o app fecha no fim).
      selfUpdate(upd, (p) => {
        if (alive) setSelfUpdateProgress({ phase: p.phase, percent: p.percent })
      }).catch((e) => {
        // Falhou: não trava o launcher — segue normal nesta versão. O motivo vai
        // para a tela porque "não acontece nada" é o pior diagnóstico possível.
        if (!alive) return
        setLauncherUpdate(null)
        setFalhaAoAtualizar(String(e?.message ?? e ?? "falha ao atualizar o launcher"))
      })
    })()
    return () => {
      alive = false
    }
  }, [online])

  // Ao abrir: detecta a versão instalada (registro do Windows) e confirma a
  // última versão publicada (latest.json do GitHub). A deteccao do que esta
  // instalado e LOCAL e roda tambem no offline — e ela que libera o botao Jogar.
  useEffect(() => {
    let alive = true
    void (async () => {
      const installed = await getInstalledGame()
      if (!alive) return
      setInstall((prev) => ({
        ...prev,
        version: installed.version,
        installed: installed.installed,
        path: installed.path,
      }))
      if (!online) return
      const remote = await fetchLatest()
      if (alive && remote) {
        setLatest({
          version: remote.version,
          url: remote.url,
          manifesto: remote.manifesto ?? null,
          sha256: remote.sha256 ?? null,
          size: remote.size ?? null,
        })
      }
    })()
    return () => {
      alive = false
    }
  }, [online])

  // Confirmacao em RUNTIME pela API do GitHub (fetch JS puro, sem depender do
  // comando Rust `fetch_latest`, que pode falhar e deixar o launcher preso na
  // versao estatica). Sempre que resolve, atualiza a versao/URL reais.
  const live = useLiveLatest(online)
  useEffect(() => {
    // Fora do Windows o `live` nao traz URL (o pacote do SO vem do release
    // desktop-*, resolvido pelo Rust): preserva a que o `fetchLatest` ja achou
    // em vez de zera-la, senao o download cairia na URL estatica do Windows.
    if (live?.version) {
      setLatest(prev => ({
        version: live.version,
        url: live.downloadUrl || prev.url,
        // O manifesto vem do latest.json (comando Rust); a API do GitHub não o
        // conhece. Preservar em vez de zerar é o que mantém o delta disponível.
        manifesto: prev.manifesto,
        // Mesma razão para o hash: a API do GitHub não publica sha256. Zerar
        // aqui faria o launcher voltar a instalar sem conferir nada.
        sha256: prev.sha256,
        size: prev.size,
      }))
    }
  }, [live])

  // ── Estado do download (pausa/cancelamento) e do jogo em execução ──
  useEffect(() => {
    let limparDownload = () => {}
    let limparJogo = () => {}
    let limparCrash = () => {}
    void ouvirEstadoDoDownload((e) => setPausado(e.pausado)).then((un) => {
      limparDownload = un
    })
    void ouvirEstadoDoJogo(setJogo).then((un) => {
      limparJogo = un
    })
    // O jogo caiu: o launcher está vivo para perceber (era o que faltava) e
    // aponta para o único conserto que costuma resolver.
    void ouvirCrashDoJogo(() => setAvisoDeCrash(true)).then((un) => {
      limparCrash = un
    })
    void estadoDoJogo().then(setJogo)
    return () => {
      limparDownload()
      limparJogo()
      limparCrash()
    }
  }, [])

  const latestVersion = latest.version

  // No offline nao existe "atualizar": nao da para baixar nada, e oferecer o
  // botao so levaria a um erro de rede. O jogo instalado fica jogavel.
  //
  // "Instalado" e `install.installed` (o jogo existe no disco), NAO
  // `version !== null`. Com a entrada do registro sem DisplayVersion, a regra
  // antiga dizia "nao instalado" e reinstalava 630 MB toda vez que o launcher
  // abria. Sem versao legivel o jogo fica JOGAVEL: nao da para afirmar que
  // esta velho, e insistir em atualizar era exatamente o loop relatado.
  const status: GameStatus = install.downloading
    ? "downloading"
    : !install.installed
      ? "not-installed"
      : online && latestVersion && install.version && isNewerVersion(latestVersion, install.version)
        ? "update"
        : "playable"

  const runInstall = useCallback(
    (url: string) => {
      setInstall((prev) => ({ ...prev, downloading: true, phase: "downloading", progress: 0, speed: 0, eta: 0 }))
      const aoProgredir = (p: { phase: ProgressPhase; percent: number; speed: number; eta: number }) => {
        setInstall((prev) => ({
          ...prev,
          downloading: p.phase !== "done",
          phase: p.phase,
          progress: p.percent,
          speed: p.speed,
          eta: p.eta,
        }))
      }

      /**
       * ATUALIZAÇÃO DIFERENCIAL PRIMEIRO, INSTALADOR DEPOIS.
       *
       * Com manifesto publicado e o jogo já no disco, dá para baixar só os
       * arquivos que mudaram — uma correção pequena vira alguns megabytes em vez
       * do pacote inteiro. O delta é OTIMIZAÇÃO: qualquer falha (sem manifesto,
       * arquivo travado, rede) cai no instalador completo, que é o caminho que
       * sempre funcionou. Atualizar não pode depender de o atalho dar certo.
       */
      const caminho = async () => {
        // ── REQUISITOS DO SISTEMA, ANTES DE QUALQUER BYTE ──
        //
        // Sem WebView2 ou sem o runtime do Visual C++, o jogo instala "com
        // sucesso" e não abre — e o jogador só descobre depois de esperar o
        // download inteiro. Conferir aqui custa a leitura de duas chaves do
        // registro quando está tudo certo (o caso comum) e evita o pior relato
        // que existe: "instalei e não acontece nada".
        //
        // Nunca bloqueia: se um requisito falhar, o download acontece do mesmo
        // jeito e a pendência fica visível na aba Gerenciar.
        setInstall((prev) => ({ ...prev, phase: "prereq", progress: 0 }))
        const instalados = await garantirRequisitos()
        if (instalados.length > 0) {
          console.info(`[launcher] requisitos instalados: ${instalados.join(", ")}`)
        }

        if (latest.manifesto && install.installed) {
          try {
            const r = await atualizarPorPartes(latest.manifesto, aoProgredir)
            console.info(
              `[launcher] delta: ${r.arquivos_baixados} arquivos, ${r.bytes_baixados} de ${r.bytes_da_versao} bytes`,
            )
            return
          } catch (e) {
            // Cancelar é ordem do jogador, não falha: não vale cair no
            // instalador completo logo depois de pedirem para parar.
            if (String(e).includes("cancelado")) throw e
            console.warn("[launcher] delta falhou, usando o instalador completo:", e)
          }
        }
        // O hash/tamanho esperados viajam junto: e o que permite ao Rust RECUSAR
        // um instalador que nao seja o publicado, em vez de executa-lo.
        await installOrUpdate(url, latest.version ?? "", aoProgredir, {
          sha256: latest.sha256,
          size: latest.size,
        })
      }

      caminho()
        .then(async () => {
          // RECONFERE NO REGISTRO em vez de assumir que instalou a versao
          // pedida. Antes isto gravava `version: latest.version` direto no
          // estado: a tela dizia "atualizado", mas a abertura seguinte relia o
          // registro e via a versao velha de novo — o loop que o betatester
          // descreveu ("atualiza, sai, entro e atualiza dnv"). Se o instalador
          // nao mexeu no registro, e melhor a UI mostrar isso na hora.
          const real = await getInstalledGame()
          setInstall((prev) => ({
            ...prev,
            version: real.version ?? prev.version,
            installed: real.installed || prev.installed,
            path: real.path ?? prev.path,
            downloading: false,
            phase: "done",
            progress: 100,
          }))

          /**
           * ABRE O JOGO SOZINHO AO TERMINAR (pedido).
           *
           * Instalar ou atualizar so tem um proposito: jogar. Terminar a barra e
           * deixar o launcher parado esperando um segundo clique nao serve a
           * ninguem — ainda mais na atualizacao OBRIGATORIA, em que a pessoa ja
           * apertou Jogar uma vez e foi interrompida pelo download.
           *
           * ⚠️ So abre se o caminho existir DE VERDADE (`real.path`): sem isso a
           * chamada falharia e o erro apareceria do nada, sem ninguem ter pedido
           * nada. E o erro continua sendo mostrado, nao engolido — foi assim que
           * um `void launchGame(...)` escondeu falha de abertura antes.
           */
          const caminhoDoJogo = real.path ?? install.path
          if (real.installed && caminhoDoJogo) {
            launchGame(caminhoDoJogo).catch((e: unknown) => {
              console.error("[launcher] instalou mas nao abriu:", e)
            })
          }
        })
        .catch((err) => {
          console.error("[launcher] falha ao instalar:", err)
          setInstall((prev) => ({ ...prev, downloading: false }))
        })
    },
    [latest.version, latest.manifesto, install.installed],
  )

  // ATUALIZACAO E OBRIGATORIA. Havendo versao nova e rede, o launcher baixa e
  // instala sozinho — nao ha adiar, nao ha escolher pedaco, e nao ha jogar
  // desatualizado com o servidor online do outro lado.
  //
  // ANTES ISTO EXIGIA CONTA (`if (!logado) return`), no mesmo porteiro do
  // download inicial. So que o efeito era o oposto do pretendido: quem nao tinha
  // conta ficava PARADO numa versao velha para sempre, com o botao escrito
  // "Entrar para atualizar" e nenhum jeito de jogar. Instalar de primeira
  // continua exigindo conta; MANTER ATUALIZADO quem ja tem o jogo, nao.
  const autoUpdateAttemptRef = useRef<string | null>(null)
  useEffect(() => {
    if (status !== "update" || install.downloading || !online || !latestVersion) return
    const url = latest.url ?? game.latestRelease?.downloadUrl
    // O ref impede repetir a MESMA versao quando uma falha de rede devolve o
    // estado para "update" — senao isto viraria um laco de download.
    if (!url || autoUpdateAttemptRef.current === latestVersion) return
    autoUpdateAttemptRef.current = latestVersion
    runInstall(url)
  }, [
    status,
    install.downloading,
    online,
    latestVersion,
    latest.url,
    game.latestRelease?.downloadUrl,
    runInstall,
  ])

  const startDownload = useCallback(() => {
    if (install.downloading) return
    if (status === "playable") {
      // O ERRO PRECISA APARECER. Isto aqui era `void launchGame(...)`: quando o
      // Rust respondia "nao encontrei o jogo instalado" (registro sem o caminho
      // do .exe), a promessa rejeitava sem ninguem ouvindo e a tela nao mudava
      // nada. O relato que chegou foi "clico em Jogar Offline e simplesmente
      // nao acontece nada" — e nao havia como o jogador saber o motivo.
      setErroAoAbrir(null)
      launchGame(install.path).catch((e: unknown) => {
        setErroAoAbrir(typeof e === "string" ? e : (e as Error)?.message || "não consegui abrir o jogo")
      })
      return
    }
    // A REDE VEM ANTES DA CONTA: sem rede nao ha login nem download, e abrir o
    // formulario de login ali seria pedir uma coisa impossivel. O botao ja diz
    // "sem internet" nesse caso (ver DownloadControl).
    if (!online) return
    // INSTALAR DE PRIMEIRA exige conta; ATUALIZAR quem ja tem o jogo, nao — ver
    // o efeito de auto-update acima. Em vez de um botao morto, o clique abre o
    // login: quem ainda nao tem conta cria ali e volta no mesmo fluxo.
    if (status === "not-installed" && !logado) {
      setShowAuth(true)
      return
    }
    const url = latest.url ?? game.latestRelease?.downloadUrl
    if (!url) return
    runInstall(url)
  }, [install.downloading, install.path, status, logado, online, latest.url, game.latestRelease?.downloadUrl, runInstall])

  // Reparar: reinstala a versão atual por cima, corrigindo arquivos danificados.
  // Baixa o instalador inteiro, entao passa pelo mesmo porteiro da conta.
  const startRepair = useCallback(() => {
    if (install.downloading) return
    if (!online) return
    if (!logado) {
      setShowAuth(true)
      return
    }
    const url = latest.url ?? game.latestRelease?.downloadUrl
    if (!url) return
    runInstall(url)
  }, [install.downloading, logado, online, latest.url, game.latestRelease?.downloadUrl, runInstall])

  // PRESENCA DO LAUNCHER INTEIRO, numa sondagem so.
  //
  // A batida vivia dentro do painel do FC Hub: a pessoa so aparecia online
  // enquanto AQUELA aba estivesse aberta, e em Inicio ou Loja sumia da lista dos
  // outros com o launcher aberto na frente dela. Agora quem sonda e o
  // `lib/hub-store`, e ele serve o painel da direita, a doca de conversa e a aba
  // do FC Hub com a MESMA resposta — inclusive pedidos de amizade e nao lidas,
  // que alimentam o selo vermelho sem uma segunda requisicao.
  //
  // ⚠️ Desligar quando nao ha sessao/rede/servidor tambem LIMPA o estado: manter
  // a lista de amigos de quem acabou de sair mostraria dado alheio para a
  // proxima pessoa a entrar.
  const servidorNoAr = serverStatus?.online ?? false
  useEffect(() => {
    ligarHub(Boolean(sessao) && online && servidorNoAr)
  }, [sessao, online, servidorNoAr])
  const presencaHub = usePresencaDoHub()
  const avisosDoHub = (presencaHub?.pedidos ?? 0) + (presencaHub?.nao_lidas ?? 0)

  const tabs: { key: Tab; label: string; icon: typeof Home }[] = [
    { key: "home", label: t("nav.inicio"), icon: Home },
    { key: "loja", label: t("nav.loja"), icon: ShoppingBag },
    { key: "news", label: t("nav.novidades"), icon: Newspaper },
    { key: "social", label: t("nav.hub"), icon: Users },
    { key: "gerenciar", label: t("nav.gerenciar"), icon: SlidersHorizontal },
    { key: "changelog", label: t("nav.changelog"), icon: ScrollText },
    { key: "security", label: t("nav.seguranca"), icon: ShieldCheck },
  ]

  // Recarrega o estado da instalação depois de reparar ou desinstalar.
  const recarregarInstalacao = useCallback(() => {
    void getInstalledGame().then((real) =>
      setInstall((prev) => ({
        ...prev,
        version: real.version,
        installed: real.installed,
        path: real.path,
      })),
    )
  }, [])

  return (
    <div className="launcher-shell relative flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      {/* Janela sem decoração do sistema: os controles e o arrasto vêm daqui. */}
      <BordasParaRedimensionar />
      <BarraDeTitulo titulo="Ultrafoot Launcher" aoFechar={pedirParaFechar} />
      {confirmandoSaida && (
        <ConfirmarSaida
          jogoRodando={!!jogo?.rodando}
          baixando={install.downloading}
          aoCancelar={() => setConfirmandoSaida(false)}
          aoMinimizar={() => {
            setConfirmandoSaida(false)
            void esconderJanela()
          }}
          aoConfirmar={() => {
            void encerrarLauncher()
          }}
        />
      )}
      <div className="relative flex min-h-0 flex-1 w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-40 launcher-grid" />
      {launcherUpdate && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 p-6 backdrop-blur">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center">
            <h2 className="font-display text-lg font-bold text-foreground">{t("launcher.atualizando")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("launcher.novaVersao", { versao: launcherUpdate.version })}
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  "h-full rounded-full bg-primary transition-all duration-200",
                  selfUpdateProgress.phase === "installing" && "animate-pulse",
                )}
                style={{
                  width:
                    selfUpdateProgress.phase === "downloading"
                      ? `${selfUpdateProgress.percent}%`
                      : "100%",
                }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {selfUpdateProgress.phase === "installing"
                ? "Instalando e reiniciando…"
                : `Baixando… ${selfUpdateProgress.percent}%`}
            </p>

            {/* SAIDA. Esta tela cobre tudo, e foi ela que o jogador ficou vendo
                sem fim em 02/08/2026. Durante o DOWNLOAD nada foi alterado ainda,
                entao sair e seguro: o launcher continua na versao instalada e a
                atualizacao e reoferecida na proxima abertura. Some na instalacao,
                onde interromper deixaria o programa pela metade. */}
            {selfUpdateProgress.phase !== "installing" && (
              <button
                onClick={() => setLauncherUpdate(null)}
                className="mt-4 text-xs text-muted-foreground underline underline-offset-4 transition hover:text-foreground"
              >
                {t("launcher.semAtualizar")}
              </button>
            )}
          </div>
        </div>
      )}
      {falhaAoAtualizar && (
        // Faixa, não modal: a atualização do launcher falhou, mas jogar continua
        // possível. Bloquear a tela aqui seria repetir o travamento de 02/08.
        <div className="fixed inset-x-0 top-0 z-[210] flex items-center justify-center gap-3 bg-amber-500/15 px-4 py-2 text-xs text-amber-200 backdrop-blur">
          <span className="truncate">{falhaAoAtualizar}</span>
          <button
            onClick={() => setFalhaAoAtualizar(null)}
            className="shrink-0 rounded px-2 py-0.5 font-medium text-amber-100 transition hover:bg-amber-500/20"
          >
            Fechar
          </button>
        </div>
      )}
      {/* O JOGO CAIU. Só existe porque o launcher agora continua vivo enquanto o
          jogo roda — antes ninguém sobrava para ver o código de saída. Aponta
          para o conserto que costuma resolver em vez de deixar a pessoa
          adivinhando. */}
      {avisoDeCrash && (
        <div className="fixed inset-x-0 top-9 z-[210] flex items-center justify-center gap-3 bg-red-500/15 px-4 py-2 text-xs text-red-200 backdrop-blur">
          <span className="truncate">{t("aviso.jogoCaiu")}</span>
          <button
            onClick={() => {
              setAvisoDeCrash(false)
              setTab("gerenciar")
            }}
            className="shrink-0 rounded bg-red-500/20 px-2 py-0.5 font-medium text-red-100 transition hover:bg-red-500/30"
          >
            {t("acao.verificar")}
          </button>
          <button
            onClick={() => setAvisoDeCrash(false)}
            className="shrink-0 rounded px-2 py-0.5 font-medium text-red-100 transition hover:bg-red-500/20"
          >
            {t("acao.fechar")}
          </button>
        </div>
      )}
      {showAuth && (
        <AuthDialog
          inicial={sessao ? "ativar" : "entrar"}
          online={online}
          onClose={() => setShowAuth(false)}
          onEntrou={setSessao}
        />
      )}
      {showSettings && (
        <SettingsDialog
          autostart={autostart}
          closeToTray={closeToTray}
          prefs={prefs}
          nomeDaConta={sessao?.nome || sessao?.email || ""}
          onAutostart={toggleAutostart}
          onCloseToTray={toggleCloseToTray}
          onPrefs={salvarPrefs}
          onClose={() => setShowSettings(false)}
        />
      )}
      {/* NAVEGACAO LATERAL — padrao de launcher de plataforma (Epic, EA App).
          As abas horizontais viviam no header e faziam a tela parecer um site;
          na lateral, o conteudo ganha a largura toda e a navegacao fica fixa. */}
      <aside className="relative z-20 flex w-[76px] shrink-0 flex-col items-center gap-1 border-r border-white/[0.07] bg-background/95 py-4 backdrop-blur-xl lg:w-[210px] lg:items-stretch lg:px-3">
        <div className="mb-5 flex items-center gap-2.5 px-1 lg:px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/games/ultrafoot-logo.png" alt="Ultrafoot 26" className="h-9 w-auto object-contain" />
          <div className="hidden lg:block">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Game Center</p>
          </div>
        </div>

        {tabs.map((item) => {
          const active = tab === item.key
          return (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              title={item.label}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all",
                "justify-center lg:justify-start",
                active
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground",
              )}
            >
              {/* Marcador da aba ativa: leitura imediata mesmo na barra estreita. */}
              <span className={cn(
                "absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary transition-opacity",
                active ? "opacity-100" : "opacity-0",
              )} />
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              <span className="hidden lg:inline">{item.label}</span>
              {/* Pedido de amizade e mensagem nova avisam na lateral: quem esta
                  em Inicio nao tem por que adivinhar que ha algo no FC Hub. Na
                  barra estreita (sem rotulo) o selo vira um ponto no canto. */}
              {item.key === "social" && avisosDoHub > 0 && (
                <span className="absolute right-2 top-2 rounded-full bg-red-500/90 px-1.5 text-[10px] font-black text-white lg:static lg:ml-auto">
                  <span className="hidden lg:inline">{avisosDoHub}</span>
                  <span className="lg:hidden">&nbsp;</span>
                </span>
              )}
            </button>
          )
        })}

        {/* JOGOS INSTALADOS — a secao que faltava para a lateral responder
            "o que eu tenho aqui?" sem trocar de aba.
            ⚠️ So aparece com o jogo INSTALADO: uma secao com titulo e nada
            embaixo e pior que secao nenhuma, e no modo estreito (76px) ela
            viraria um titulo cortado sem item visivel. */}
        {install.installed && (
          <div className="mt-5 hidden w-full lg:block">
            <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
              Jogos instalados
            </p>
            <button
              onClick={() => setTab("home")}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors",
                tab === "home" ? "bg-white/[0.06]" : "hover:bg-white/[0.04]",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/games/ultrafoot-logo.png" alt="" className="h-8 w-8 shrink-0 rounded-lg object-contain" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium text-foreground">{game.name}</span>
                <span className="block truncate text-[10px] text-primary">
                  {jogo?.rodando
                    ? "Jogando agora"
                    : install.downloading
                      ? "Baixando…"
                      : status === "update"
                        ? "Atualização disponível"
                        : `v${install.version ?? game.latestRelease?.version ?? ""}`}
                </span>
              </span>
            </button>
          </div>
        )}


        {/* PERFIL NO RODAPE DA LATERAL — e onde EA App e Epic colocam a conta.
            Fica sempre visivel, sem competir com os botoes de acao do topo. */}
        <div className="mt-auto w-full">
          {sessao ? (
            <button
              onClick={() => { void sair().then(() => setSessao(null)) }}
              title={`${sessao.email} — clique para sair`}
              className="flex w-full items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2 text-left transition-colors hover:bg-white/[0.07] lg:px-2.5"
            >
              {prefs.fotoAvatar ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={prefs.fotoAvatar} alt=""
                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                  style={{ boxShadow: `0 0 0 1.5px ${prefs.corAvatar}` }}
                />
              ) : (
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                  style={{ background: `${prefs.corAvatar}22`, color: prefs.corAvatar }}
                >
                  {prefs.avatar || iniciais(sessao.nome || sessao.email)}
                </span>
              )}
              <span className="hidden min-w-0 lg:block">
                <span className="block truncate text-xs font-semibold text-white">
                  {sessao.nome || sessao.email}
                </span>
                <span className="block text-[10px] text-white/35">Sair da conta</span>
              </span>
            </button>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="flex w-full items-center gap-2.5 rounded-xl border border-primary/25 bg-primary/10 p-2 text-left text-primary transition-colors hover:bg-primary/20 lg:px-2.5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15">
                <LogIn className="h-4 w-4" />
              </span>
              <span className="hidden min-w-0 lg:block">
                <span className="block truncate text-xs font-semibold">Entrar</span>
                <span className="block text-[10px] text-primary/60">Compras e progresso</span>
              </span>
            </button>
          )}
          {/* ⚠️ AQUI É A VERSÃO DO LAUNCHER, NÃO A DO JOGO.
              A do jogo já aparece duas vezes nesta tela — no item da lista de
              jogos instalados, logo acima, e na etiqueta do hero. Uma terceira
              não informava nada. A do LAUNCHER, por outro lado, não aparecia em
              lugar nenhum, e é justamente a que o suporte precisa perguntar
              quando alguém relata que "não atualiza" ou "fecha sozinho". */}
          <p className="mt-2 hidden px-1 text-[10px] text-white/20 lg:block">
            Ultrafoot Launcher{versaoLauncher ? ` · v${versaoLauncher}` : ""}
          </p>
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="relative z-10 flex shrink-0 flex-col border-b border-white/[0.07] bg-background/88 px-4 backdrop-blur-xl md:px-6">
        <div className="flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div>
              <p className="text-sm font-bold text-white">{tabs.find(item => item.key === tab)?.label}</p>
              <p className="text-[10px] text-white/30">{t("nav.subtitulo")}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {online ? (
              <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                <ShieldCheck className="h-4 w-4 text-primary" /> {t("rede.anticheat")}
              </span>
            ) : (
              <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                <ShieldOff className="h-4 w-4 text-accent" /> {t("rede.edicaoLiberada")}
              </span>
            )}

            {/* Seletor de modo Online / Offline */}
            <div className="flex items-center rounded-lg border border-white/10 bg-black/25 p-1">
              <button
                onClick={() => changeMode("online")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  online
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Wifi className="h-3.5 w-3.5" /> {t("rede.online")}
              </button>
              <button
                onClick={() => changeMode("offline")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  !online
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <WifiOff className="h-3.5 w-3.5" /> {t("rede.offline")}
              </button>
            </div>

            <button
              onClick={() => setShowSettings(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground"
              title="Configurações"
              aria-label="Configurações"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

      </header>

      <CommunityBar config={config} tecnicosOnline={presencaHub?.online.length} onOpen={openExternal} />

      <div className="relative z-[1] flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-6 p-4 md:p-6 lg:p-8">
            {/* ⚠️ A COLUNA DE NOTICIAS SO VOLTA EM 2xl (1536px+).
                O painel da direita ocupa 248px em xl (1280px). Com a lateral de
                210px, sobravam ~820px para hero + 360px de noticias — o hero
                ficava com 460px e a arte do jogo espremida. Agora, entre 1280 e
                1536, o hero pega a largura toda e as noticias descem para
                baixo dele; a partir de 1536 as duas colunas cabem de novo. */}
          {tab === "home" && (
            <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
              <GameHero
                game={game}
                status={status}
                install={install}
                mode={mode}
                logado={logado}
                erroAoAbrir={erroAoAbrir}
                pausado={pausado}
                jogando={!!jogo?.rodando}
                onDownload={startDownload}
                onRepair={startRepair}
                onPausar={() => void pausarDownload()}
                onRetomar={() => void retomarDownload()}
                onCancelar={() => void cancelarDownload(false)}
                onPararJogo={() => void pararJogo().catch(() => {})}
              />
              <NewsFeed news={effectiveNews.slice(0, 4)} title="Últimas novidades" compact />
            </div>
          )}

          {tab === "loja" && <StorePanel online={online} onEntrar={() => setShowAuth(true)} />}

          {tab === "news" && <NewsFeed news={effectiveNews} title={`Novidades de ${game.name}`} />}

          {tab === "social" && (
            <SocialPanel
              presenca={presencaHub}
              sessao={sessao}
              prefs={prefs}
              serverStatus={serverStatus}
              config={config}
              ativado={!!sessao?.ativado}
              ehAdmin={!!sessao?.admin}
              comRede={online}
              onEntrar={() => setShowAuth(true)}
              onAtivar={() => setShowAuth(true)}
              onOpen={openExternal}
            />
          )}

          {tab === "gerenciar" && (
            <GerenciarPanel
              instalado={install.installed}
              manifesto={latest.manifesto}
              online={online}
              aoMudarInstalacao={recarregarInstalacao}
            />
          )}

          {tab === "changelog" && <ChangelogView game={game} releases={effectiveReleases} />}

          {tab === "security" && <SecurityPanel mode={mode} />}
        </div>
      </div>
      </div>

      {/* O painel da direita acompanha TODAS as abas: conta e quem esta online
          sao as duas coisas que dizem se da para jogar com alguem agora, e
          antes sumiam assim que se saia da Inicio. Ver rail-direita.tsx. */}
      <RailDireita
        sessao={sessao}
        serverStatus={serverStatus}
        comRede={online}
        onEntrar={() => setShowAuth(true)}
        onAbrirHub={() => setTab("social")}
      />

      {/* CONVERSA FLUTUANTE, como nos launchers grandes: acompanha a pessoa por
          Loja, Changelog e download em vez de morrer ao trocar de aba. */}
      <ChatDock />
      </div>
    </div>
  )
}
