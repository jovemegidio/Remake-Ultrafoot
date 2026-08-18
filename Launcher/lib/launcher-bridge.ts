/**
 * Ponte entre a UI (Next.js) e o backend nativo (Tauri/Rust) do launcher.
 *
 * Quando roda dentro do app Tauri, chama os comandos Rust reais (baixar, instalar
 * silencioso, detectar versão instalada, abrir o jogo). Quando roda no navegador
 * (dev / `pnpm dev`), cai em fallbacks simulados para a UI continuar navegável.
 */

export type InstalledGame = {
  installed: boolean
  version: string | null
  path: string | null
}

export type LatestInfo = {
  version: string
  notes: string
  url: string
  /** sha256/tamanho esperados do instalador — o launcher recusa o que não bater. */
  sha256?: string | null
  size?: number | null
  /**
   * false = não instalar sozinho. O Rust devolve false quando esta mesma versão
   * já falhou duas vezes; sem isso o launcher repetia o ciclo para sempre.
   */
  auto?: boolean
  /**
   * Manifesto de arquivos desta versão. Presente = dá para atualizar baixando só
   * o que mudou (ver `atualizarPorPartes`). Ausente = publicação no formato
   * antigo, e o caminho continua sendo o instalador inteiro.
   */
  manifesto?: string | null
}

/**
 * `checking` = conferindo o que já está no disco (fase do delta, antes de baixar).
 * `applying` = trocando os arquivos, já com tudo baixado — não dá para cancelar.
 */
export type ProgressPhase =
  | "prereq"
  | "checking"
  | "downloading"
  | "installing"
  | "applying"
  | "done"

export type ProgressPayload = {
  phase: ProgressPhase
  percent: number
  downloaded: number
  total: number
  /** bytes por segundo (0 quando não aplicável) */
  speed: number
  /** segundos restantes estimados (0 quando desconhecido) */
  eta: number
}

/** true quando o código roda dentro do runtime do Tauri (app desktop). */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
}

/** Versão instalada do jogo (lida do registro do Windows). */
export async function getInstalledGame(): Promise<InstalledGame> {
  if (!isTauri()) return { installed: false, version: null, path: null }
  const { invoke } = await import("@tauri-apps/api/core")
  return invoke<InstalledGame>("get_installed_game")
}

/** Última versão publicada (lê o latest.json do GitHub). Null se offline. */
export async function fetchLatest(): Promise<LatestInfo | null> {
  if (!isTauri()) return null
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return await invoke<LatestInfo>("fetch_latest")
  } catch {
    return null
  }
}

/**
 * Baixa o setup.exe e instala/atualiza em silêncio (/S). Reporta progresso real
 * pelo callback. Só funciona dentro do Tauri; no navegador simula para a demo.
 */
export async function installOrUpdate(
  url: string,
  version: string,
  onProgress: (p: ProgressPayload) => void,
  /**
   * ⚠️ O QUE O INSTALADOR BAIXADO TEM DE SER (1.0.346).
   *
   * Sem isto o Rust nao tinha contra o que conferir e EXECUTAVA o .exe que
   * viesse da rede. Vem do `latest.json`, que passou a publicar `sha256` e
   * `size` na mesma versao. Opcional de proposito: release antigo nao tem os
   * campos, e ai a conferencia cai no que da para checar sozinha (cabecalho e
   * tamanho anunciado) em vez de impedir a instalacao.
   */
  esperado?: { sha256?: string | null; size?: number | null },
): Promise<void> {
  if (!isTauri()) {
    // Simulação para o modo navegador (dev): download depois instalação.
    await simulate(onProgress)
    return
  }
  const { invoke } = await import("@tauri-apps/api/core")
  const { listen } = await import("@tauri-apps/api/event")
  const unlisten = await listen<ProgressPayload>("launcher://progress", (e) => onProgress(e.payload))
  try {
    await invoke("download_and_install", {
      url,
      version,
      sha256: esperado?.sha256 ?? null,
      size: esperado?.size ?? null,
    })
  } finally {
    unlisten()
  }
}

/** Há uma versão mais nova do PRÓPRIO launcher? Null se já está atualizado. */
export async function checkLauncherUpdate(): Promise<LatestInfo | null> {
  if (!isTauri()) return null
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return await invoke<LatestInfo | null>("check_launcher_update")
  } catch {
    return null
  }
}

/**
 * Baixa e instala uma nova versão do PRÓPRIO launcher e reabre. O launcher fecha
 * no fim (o instalador troca o .exe em uso e reabre o app).
 */
export async function selfUpdate(
  info: LatestInfo,
  onProgress: (p: ProgressPayload) => void,
): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import("@tauri-apps/api/core")
  const { listen } = await import("@tauri-apps/api/event")
  const unlisten = await listen<ProgressPayload>("launcher://progress", (e) => onProgress(e.payload))
  try {
    // A versão vai junto porque é a chave do contador de tentativas do lado Rust
    // — é ele que impede o loop quando a instalação não pega.
    await invoke("self_update", {
      url: info.url,
      version: info.version,
      sha256: info.sha256 ?? null,
      size: info.size ?? null,
    })
  } finally {
    unlisten()
  }
}

// ─── Config remota / comunidade ──────────────────────────────────────────────

export type LauncherConfig = {
  announcement?: { text: string; level?: "info" | "warning" }
  news?: Array<{ title: string; category?: string; body?: string; date?: string; pinned?: boolean }>
  changelog?: Array<{
    version: string
    date?: string
    title?: string
    latest?: boolean
    changes?: Array<{ type?: "added" | "fixed" | "changed" | "removed"; text: string }>
  }>
  social?: { discord?: string; youtube?: string; tiktok?: string; instagram?: string }
  serverStatusUrl?: string
}

export type ServerStatus = { online: boolean; game_version: string | null }

/** Configuração remota (notícias/banner/redes/status). Null se offline. */
export async function fetchLauncherConfig(): Promise<LauncherConfig | null> {
  if (!isTauri()) return null
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return await invoke<LauncherConfig>("fetch_launcher_config")
  } catch {
    return null
  }
}

/** Status do servidor multiplayer (ping em {url}/health). */
export async function checkServerStatus(url: string): Promise<ServerStatus | null> {
  if (!isTauri()) return null
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return await invoke<ServerStatus>("check_server_status", { url })
  } catch {
    return null
  }
}

/** Abre um link no navegador padrão do sistema. */
export async function openExternal(url: string): Promise<void> {
  if (!isTauri()) {
    if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer")
    return
  }
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener")
    await openUrl(url)
  } catch {
    /* ignore */
  }
}

// ─── Configurações ───────────────────────────────────────────────────────────

/** O launcher está configurado para iniciar com o Windows? */
export async function getAutostartEnabled(): Promise<boolean> {
  if (!isTauri()) return false
  try {
    const { isEnabled } = await import("@tauri-apps/plugin-autostart")
    return await isEnabled()
  } catch {
    return false
  }
}

/** Liga/desliga iniciar o launcher com o Windows. */
export async function setAutostartEnabled(enabled: boolean): Promise<void> {
  if (!isTauri()) return
  const { enable, disable } = await import("@tauri-apps/plugin-autostart")
  if (enabled) await enable()
  else await disable()
}

/**
 * TODO PEDIDO DE FECHAMENTO PASSA PELA TELA.
 *
 * Vale para o Alt+F4 e para qualquer fechamento vindo do sistema (o X próprio da
 * barra de título chama isto direto). O padrão é SEMPRE barrado: quem decide o
 * que acontece — sumir na bandeja ou perguntar antes de sair — é o launcher.
 *
 * O padrão precisava ser barrado de qualquer forma. Não barrado, o `@tauri-apps/api`
 * responde chamando `window.destroy()`, que exige a permissão `core:window:allow-destroy`;
 * ela não estava na lista de capabilities, então a chamada era recusada em
 * silêncio (promessa rejeitada, sem ninguém ouvindo) e o launcher simplesmente
 * NÃO FECHAVA. A permissão foi adicionada, mas a saída de verdade é
 * `encerrarLauncher()`, que derruba o processo inteiro em vez de só a janela.
 *
 * Retorna a função que remove o ouvinte.
 */
export async function aoPedirFechamento(quandoPedir: () => void): Promise<() => void> {
  if (!isTauri()) return () => {}
  const { getCurrentWindow } = await import("@tauri-apps/api/window")
  const win = getCurrentWindow()
  const unlisten = await win.onCloseRequested((event) => {
    event.preventDefault()
    quandoPedir()
  })
  return unlisten
}

/** Some para a bandeja (o launcher continua vivo no relógio). */
export async function esconderJanela(): Promise<void> {
  if (!isTauri()) return
  const { getCurrentWindow } = await import("@tauri-apps/api/window")
  await getCurrentWindow().hide()
}

/** Fecha o launcher de verdade — processo, bandeja e downloads incluídos. */
export async function encerrarLauncher(): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import("@tauri-apps/api/core")
  await invoke("encerrar_launcher")
}

/** Abre o jogo instalado. O launcher CONTINUA VIVO supervisionando (ver jogo.rs). */
export async function launchGame(path: string | null): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import("@tauri-apps/api/core")
  await invoke("launch_game", { path })
}

// ─── Atualização diferencial (delta) e integridade ───────────────────────────

export type RelatorioDoPatch = {
  versao: string
  arquivos_no_total: number
  arquivos_baixados: number
  bytes_baixados: number
  bytes_da_versao: number
  arquivos_removidos: number
  ok: boolean
  problemas: string[]
}

/** Há manifesto publicado nesse endereço? Decide entre delta e instalador. */
export async function temManifesto(url: string): Promise<boolean> {
  if (!isTauri()) return false
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return await invoke<boolean>("tem_manifesto", { urlDoManifesto: url })
  } catch {
    return false
  }
}

/**
 * Atualiza baixando SÓ os arquivos que mudaram.
 *
 * Erro aqui não é fim de linha: quem chama cai no instalador completo. O delta é
 * otimização — a atualização precisa acontecer de um jeito ou de outro.
 */
export async function atualizarPorPartes(
  urlDoManifesto: string,
  onProgress: (p: ProgressPayload) => void,
): Promise<RelatorioDoPatch> {
  const { invoke } = await import("@tauri-apps/api/core")
  const { listen } = await import("@tauri-apps/api/event")
  const unlisten = await listen<ProgressPayload>("launcher://progress", (e) => onProgress(e.payload))
  try {
    return await invoke<RelatorioDoPatch>("atualizar_por_partes", { urlDoManifesto })
  } finally {
    unlisten()
  }
}

/** "Verificar integridade": confere arquivo por arquivo e, com `reparar`, conserta. */
export async function verificarArquivos(
  urlDoManifesto: string,
  reparar: boolean,
  onProgress: (p: ProgressPayload) => void,
): Promise<RelatorioDoPatch> {
  const { invoke } = await import("@tauri-apps/api/core")
  const { listen } = await import("@tauri-apps/api/event")
  const unlisten = await listen<ProgressPayload>("launcher://progress", (e) => onProgress(e.payload))
  try {
    return await invoke<RelatorioDoPatch>("verificar_arquivos", { urlDoManifesto, reparar })
  } finally {
    unlisten()
  }
}

// ─── Controle do download ────────────────────────────────────────────────────

export type EstadoDoDownload = { pausado: boolean; cancelado: boolean; limite_kbps: number }

export async function pausarDownload(): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import("@tauri-apps/api/core")
  await invoke("pausar_download")
}

export async function retomarDownload(): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import("@tauri-apps/api/core")
  await invoke("retomar_download")
}

/** Cancela. O pedaço já baixado FICA no disco, salvo `apagarParcial`. */
export async function cancelarDownload(apagarParcial = false): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import("@tauri-apps/api/core")
  await invoke("cancelar_download", { apagarParcial })
}

/** Teto de velocidade em KB/s. 0 = sem limite. */
export async function definirLimiteDeBanda(kbps: number): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import("@tauri-apps/api/core")
  await invoke("definir_limite_de_banda", { kbps })
}

export async function estadoDoDownload(): Promise<EstadoDoDownload> {
  if (!isTauri()) return { pausado: false, cancelado: false, limite_kbps: 0 }
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return await invoke<EstadoDoDownload>("estado_do_download")
  } catch {
    return { pausado: false, cancelado: false, limite_kbps: 0 }
  }
}

/** Ouve mudanças de pausa/cancelamento vindas do Rust. */
export async function ouvirEstadoDoDownload(
  aoMudar: (e: EstadoDoDownload) => void,
): Promise<() => void> {
  if (!isTauri()) return () => {}
  const { listen } = await import("@tauri-apps/api/event")
  return listen<EstadoDoDownload>("launcher://download-estado", (e) => aoMudar(e.payload))
}

// ─── Disco e pasta de instalação ─────────────────────────────────────────────

export type EspacoNoDisco = { caminho: string; livre: number | null; livre_texto: string }

export async function espacoNoDisco(caminho?: string): Promise<EspacoNoDisco | null> {
  if (!isTauri()) return null
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return await invoke<EspacoNoDisco>("espaco_no_disco", { caminho: caminho ?? null })
  } catch {
    return null
  }
}

export async function pastaDeInstalacao(): Promise<string | null> {
  if (!isTauri()) return null
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return await invoke<string | null>("pasta_de_instalacao")
  } catch {
    return null
  }
}

/** Abre o seletor de pastas. Devolve null se o jogador desistiu. */
export async function escolherPastaDeInstalacao(): Promise<string | null> {
  if (!isTauri()) return null
  const { invoke } = await import("@tauri-apps/api/core")
  return invoke<string | null>("escolher_pasta_de_instalacao")
}

export async function limparPastaDeInstalacao(): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import("@tauri-apps/api/core")
  await invoke("limpar_pasta_de_instalacao")
}

// ─── O jogo em execução ──────────────────────────────────────────────────────

export type EstadoDoJogo = {
  rodando: boolean
  sessao_segundos: number
  total_segundos: number
  /** Época em segundos. 0 = nunca jogou. */
  ultima_vez: number
  sessoes: number
}

export async function estadoDoJogo(): Promise<EstadoDoJogo> {
  const vazio: EstadoDoJogo = {
    rodando: false, sessao_segundos: 0, total_segundos: 0, ultima_vez: 0, sessoes: 0,
  }
  if (!isTauri()) return vazio
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return await invoke<EstadoDoJogo>("estado_do_jogo")
  } catch {
    return vazio
  }
}

export async function ouvirEstadoDoJogo(aoMudar: (e: EstadoDoJogo) => void): Promise<() => void> {
  if (!isTauri()) return () => {}
  const { listen } = await import("@tauri-apps/api/event")
  return listen<EstadoDoJogo>("launcher://jogo", (e) => aoMudar(e.payload))
}

/** O jogo fechou com erro. É a hora certa de oferecer "verificar arquivos". */
export async function ouvirCrashDoJogo(aoCair: (codigo: number) => void): Promise<() => void> {
  if (!isTauri()) return () => {}
  const { listen } = await import("@tauri-apps/api/event")
  return listen<number>("launcher://jogo-caiu", (e) => aoCair(e.payload))
}

export async function pararJogo(): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import("@tauri-apps/api/core")
  await invoke("parar_jogo")
}

export type AcaoAoAbrir = "bandeja" | "minimizar" | "fechar" | "nada"

export async function acaoAoAbrir(): Promise<AcaoAoAbrir> {
  if (!isTauri()) return "bandeja"
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return await invoke<AcaoAoAbrir>("acao_ao_abrir")
  } catch {
    return "bandeja"
  }
}

export async function definirAcaoAoAbrir(acao: AcaoAoAbrir): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import("@tauri-apps/api/core")
  await invoke("definir_acao_ao_abrir", { acao })
}

// ─── Manutenção ──────────────────────────────────────────────────────────────

export async function desinstalarJogo(): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import("@tauri-apps/api/core")
  await invoke("desinstalar_jogo")
}

export async function criarAtalho(): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import("@tauri-apps/api/core")
  await invoke("criar_atalho")
}

export type Canal = "estavel" | "beta"

export async function canalAtual(): Promise<Canal> {
  if (!isTauri()) return "estavel"
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return await invoke<Canal>("canal")
  } catch {
    return "estavel"
  }
}

export async function definirCanal(canal: Canal): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import("@tauri-apps/api/core")
  await invoke("definir_canal", { canal })
}

export type VersaoDisponivel = {
  version: string
  url: string
  notes: string
  manifesto: string | null
}

/**
 * Versões às quais dá para voltar quando a mais nova sai com defeito.
 *
 * ⚠️ Este wrapper e o comando Rust existiam desde sempre e NUNCA devolveram
 * nada: o `latest.json` publicado não trazia o campo `anteriores` e nenhuma tela
 * chamava a função. Três pontas do mesmo recurso, soltas — o comando, o dado e a
 * interface. `scripts/listar-versoes-anteriores.mjs` fechou a de cima e a aba
 * Gerenciar fechou a de baixo.
 */
export async function versoesAnteriores(): Promise<VersaoDisponivel[]> {
  if (!isTauri()) return []
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return await invoke<VersaoDisponivel[]>("versoes_anteriores")
  } catch {
    return []
  }
}

// ─── Requisitos do sistema ───────────────────────────────────────────────────

export type Requisito = {
  id: string
  nome: string
  descricao: string
  /** Sem isto o jogo não abre — o launcher instala sozinho antes de baixar. */
  essencial: boolean
  instalado: boolean
  versao: string | null
  precisa_admin: boolean
  tamanho_mb: number
}

/** Lê a máquina (registro/arquivos). Não instala nada. */
export async function auditarRequisitos(): Promise<Requisito[]> {
  if (!isTauri()) return []
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return await invoke<Requisito[]>("auditar_requisitos")
  } catch {
    return []
  }
}

/** Instala um requisito. Os que pedem admin abrem o aviso do Windows. */
export async function instalarRequisito(id: string): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import("@tauri-apps/api/core")
  await invoke("instalar_requisito", { id })
}

/**
 * Instala os ESSENCIAIS que faltarem. Chamado antes de baixar o jogo.
 *
 * Devolve o que foi instalado agora. Nunca lança por falha de um requisito: é
 * melhor o jogo ir para o disco e faltar um runtime — que a aba Gerenciar
 * mostra — do que travar a instalação inteira.
 */
export async function garantirRequisitos(): Promise<string[]> {
  if (!isTauri()) return []
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return await invoke<string[]>("garantir_requisitos")
  } catch {
    return []
  }
}

export async function abrirPastaDeLogs(): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import("@tauri-apps/api/core")
  await invoke("abrir_pasta_de_logs")
}

/** Gera o arquivo de diagnóstico e devolve o caminho dele. */
export async function gerarDiagnostico(): Promise<string> {
  if (!isTauri()) return ""
  const { invoke } = await import("@tauri-apps/api/core")
  return invoke<string>("gerar_diagnostico")
}

// ─── Fallback de navegador (dev) ─────────────────────────────────────────────
async function simulate(onProgress: (p: ProgressPayload) => void): Promise<void> {
  const total = 438 * 1024 * 1024
  const speed = 12 * 1024 * 1024
  for (let pct = 0; pct <= 100; pct += 7) {
    const downloaded = Math.round((total * pct) / 100)
    onProgress({
      phase: "downloading",
      percent: Math.min(100, pct),
      downloaded,
      total,
      speed,
      eta: Math.max(0, Math.round((total - downloaded) / speed)),
    })
    await new Promise((r) => setTimeout(r, 180))
  }
  onProgress({ phase: "installing", percent: 100, downloaded: total, total, speed: 0, eta: 0 })
  await new Promise((r) => setTimeout(r, 1200))
  onProgress({ phase: "done", percent: 100, downloaded: total, total, speed: 0, eta: 0 })
}
