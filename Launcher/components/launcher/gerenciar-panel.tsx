"use client"

/**
 * ABA GERENCIAR — o "Gerenciar → Propriedades" da Steam.
 *
 * Tudo aqui existia só no backend e não tinha porta de entrada: verificar
 * integridade, reparar, escolher disco, limitar banda, ver tempo de jogo, trocar
 * de canal, desinstalar e coletar diagnóstico. Sem esta tela, o launcher
 * continuava sendo um botão de "Jogar" com notícias em volta.
 */

import { useCallback, useEffect, useState } from "react"
import {
  FolderOpen, HardDrive, Gauge, Clock, ShieldCheck, Trash2, FileText,
  Link2, GitBranch, Loader2, CheckCircle2, AlertTriangle, PlayCircle,
  Puzzle, Download, ShieldAlert,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useT } from "@/lib/i18n"
import {
  espacoNoDisco, pastaDeInstalacao, escolherPastaDeInstalacao, criarAtalho,
  definirLimiteDeBanda, estadoDoDownload, verificarArquivos, desinstalarJogo,
  canalAtual, definirCanal, abrirPastaDeLogs, gerarDiagnostico, estadoDoJogo,
  acaoAoAbrir, definirAcaoAoAbrir, auditarRequisitos, instalarRequisito,
  type EstadoDoJogo, type Canal, type AcaoAoAbrir, type RelatorioDoPatch,
  type Requisito,
} from "@/lib/launcher-bridge"

/**
 * REQUISITOS DO SISTEMA — o "verificar dependências" da Steam.
 *
 * Sem WebView2 ou sem o runtime do Visual C++, o jogo instala com sucesso e
 * simplesmente não abre. Do lado do jogador isso parece jogo quebrado, e o
 * relato que chega é "instalei e não acontece nada". Aqui ele vê o que falta e
 * resolve num clique.
 */
function BlocoDeRequisitos() {
  const [itens, setItens] = useState<Requisito[]>([])
  const [instalando, setInstalando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const auditar = useCallback(() => {
    void auditarRequisitos().then(setItens)
  }, [])
  useEffect(auditar, [auditar])

  const instalar = async (id: string) => {
    setErro(null)
    setInstalando(id)
    try {
      await instalarRequisito(id)
    } catch (e) {
      setErro(String(e))
    } finally {
      setInstalando(null)
      auditar()
    }
  }

  if (itens.length === 0) return null
  const faltando = itens.filter((i) => !i.instalado)

  return (
    <Bloco icone={Puzzle} titulo="Requisitos do sistema">
      {faltando.length === 0 ? (
        <p className="mb-3 flex items-center gap-1.5 text-xs text-primary">
          <CheckCircle2 className="h-3.5 w-3.5" /> Tudo que o jogo precisa está instalado.
        </p>
      ) : (
        <p className="mb-3 text-xs text-amber-300">
          {faltando.length} {faltando.length === 1 ? "componente falta" : "componentes faltam"} nesta máquina.
        </p>
      )}

      <div className="space-y-2">
        {itens.map((r) => (
          <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                {r.instalado ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                ) : r.essencial ? (
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-red-400" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                )}
                <span className="truncate">{r.nome}</span>
                {r.essencial && !r.instalado && (
                  <span className="shrink-0 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold text-red-300">
                    obrigatório
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {r.instalado ? (r.versao ?? "instalado") : r.descricao}
              </p>
            </div>
            {!r.instalado && (
              <button
                disabled={instalando !== null}
                onClick={() => instalar(r.id)}
                title={r.precisa_admin ? "O Windows vai pedir permissão de administrador." : undefined}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold transition-colors hover:bg-white/[0.05] disabled:opacity-40"
              >
                {instalando === r.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                Instalar{r.tamanho_mb > 0 ? ` (${r.tamanho_mb} MB)` : ""}
              </button>
            )}
          </div>
        ))}
      </div>
      {erro && <p className="mt-2 text-[11px] text-red-300">{erro}</p>}
    </Bloco>
  )
}

const LIMITES = [
  { kbps: 0, rotulo: "—" },
  { kbps: 512, rotulo: "0,5 MB/s" },
  { kbps: 1024, rotulo: "1 MB/s" },
  { kbps: 3072, rotulo: "3 MB/s" },
  { kbps: 5120, rotulo: "5 MB/s" },
  { kbps: 10240, rotulo: "10 MB/s" },
]

const OPCOES_AO_ABRIR: { valor: AcaoAoAbrir; chave: "conf.esconder" | "conf.minimizar" | "conf.fecharLauncher" | "conf.naoFazerNada" }[] = [
  { valor: "bandeja", chave: "conf.esconder" },
  { valor: "minimizar", chave: "conf.minimizar" },
  { valor: "fechar", chave: "conf.fecharLauncher" },
  { valor: "nada", chave: "conf.naoFazerNada" },
]

function Bloco({
  icone: Icone,
  titulo,
  children,
}: {
  icone: typeof HardDrive
  titulo: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-card/60 p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
        <Icone className="h-4 w-4 text-primary" />
        {titulo}
      </h3>
      {children}
    </section>
  )
}

export function GerenciarPanel({
  instalado,
  manifesto,
  online,
  aoMudarInstalacao,
}: {
  instalado: boolean
  /** URL do manifesto da versão publicada. Sem ele não há como verificar. */
  manifesto: string | null
  online: boolean
  /** Avisa a tela principal que o jogo foi removido (ou consertado). */
  aoMudarInstalacao: () => void
}) {
  const t = useT()

  const [pasta, setPasta] = useState<string | null>(null)
  const [espaco, setEspaco] = useState<string>("—")
  const [limite, setLimite] = useState(0)
  const [canal, setCanal] = useState<Canal>("estavel")
  const [aoAbrir, setAoAbrir] = useState<AcaoAoAbrir>("bandeja")
  const [jogo, setJogo] = useState<EstadoDoJogo | null>(null)

  const [verificando, setVerificando] = useState(false)
  const [andamento, setAndamento] = useState(0)
  const [relatorio, setRelatorio] = useState<RelatorioDoPatch | null>(null)
  const [removendo, setRemovendo] = useState(false)
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false)
  const [recado, setRecado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(() => {
    void pastaDeInstalacao().then(setPasta)
    void espacoNoDisco().then((e) => setEspaco(e?.livre_texto ?? "—"))
    void estadoDoDownload().then((e) => setLimite(e.limite_kbps))
    void canalAtual().then(setCanal)
    void acaoAoAbrir().then(setAoAbrir)
    void estadoDoJogo().then(setJogo)
  }, [])

  useEffect(recarregar, [recarregar])

  const escolherPasta = async () => {
    setErro(null)
    try {
      const nova = await escolherPastaDeInstalacao()
      if (nova) setPasta(nova)
      void espacoNoDisco(nova ?? undefined).then((e) => setEspaco(e?.livre_texto ?? "—"))
    } catch (e) {
      setErro(String(e))
    }
  }

  const verificar = async (reparar: boolean) => {
    if (!manifesto) return
    setErro(null)
    setRecado(null)
    setRelatorio(null)
    setVerificando(true)
    setAndamento(0)
    try {
      const r = await verificarArquivos(manifesto, reparar, (p) => setAndamento(p.percent))
      setRelatorio(r)
      if (reparar) aoMudarInstalacao()
    } catch (e) {
      setErro(String(e))
    } finally {
      setVerificando(false)
    }
  }

  const desinstalar = async () => {
    setErro(null)
    setRemovendo(true)
    try {
      await desinstalarJogo()
      setConfirmandoRemocao(false)
      aoMudarInstalacao()
      recarregar()
    } catch (e) {
      setErro(String(e))
    } finally {
      setRemovendo(false)
    }
  }

  const horas = Math.floor((jogo?.total_segundos ?? 0) / 3600)
  const minutos = Math.floor(((jogo?.total_segundos ?? 0) % 3600) / 60)
  const ultimaVez =
    jogo?.ultima_vez && jogo.ultima_vez > 0
      ? new Date(jogo.ultima_vez * 1000).toLocaleDateString()
      : t("gerenciar.nunca")

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {erro && (
        <div className="lg:col-span-2 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{erro}</span>
        </div>
      )}
      {recado && (
        <div className="lg:col-span-2 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{recado}</span>
        </div>
      )}

      {/* ── Requisitos do sistema ── */}
      <BlocoDeRequisitos />

      {/* ── Instalação ── */}
      <Bloco icone={HardDrive} titulo={t("gerenciar.pasta")}>
        <p className="mb-3 break-all font-mono text-xs text-muted-foreground">
          {pasta ?? "—"}
        </p>
        <p className="mb-3 text-xs text-muted-foreground">
          {t("gerenciar.espacoLivre", { espaco })}
        </p>
        <div className="flex flex-wrap gap-2">
          {/* Trocar de disco só antes de instalar: com o jogo no lugar, mudar a
              pasta significaria mover ~1 GB e reescrever o registro. */}
          {!instalado && (
            <button
              onClick={escolherPasta}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-white/[0.05]"
            >
              <FolderOpen className="h-3.5 w-3.5" /> {t("gerenciar.escolherPasta")}
            </button>
          )}
          {instalado && (
            <button
              onClick={() => {
                setRecado(null)
                void criarAtalho()
                  .then(() => setRecado(t("gerenciar.atalho")))
                  .catch((e) => setErro(String(e)))
              }}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-white/[0.05]"
            >
              <Link2 className="h-3.5 w-3.5" /> {t("gerenciar.atalho")}
            </button>
          )}
        </div>
      </Bloco>

      {/* ── Tempo de jogo ── */}
      <Bloco icone={Clock} titulo={t("gerenciar.tempoDeJogo")}>
        <p className="text-2xl font-bold text-foreground">
          {t("gerenciar.horas", { h: horas, m: minutos })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("gerenciar.ultimaVez")}: {ultimaVez}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("gerenciar.sessoes", { n: jogo?.sessoes ?? 0 })}
        </p>
        {jogo?.rodando && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
            <PlayCircle className="h-3.5 w-3.5" /> {t("acao.jogando")}
          </p>
        )}
      </Bloco>

      {/* ── Integridade ── */}
      <Bloco icone={ShieldCheck} titulo={t("acao.verificar")}>
        {!manifesto ? (
          <p className="text-xs text-muted-foreground">
            Esta versão foi publicada sem manifesto de arquivos — a verificação fica
            disponível a partir da próxima atualização.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={verificando || !online || !instalado}
                onClick={() => verificar(false)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-white/[0.05] disabled:opacity-40"
              >
                {verificando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                {t("acao.verificar")}
              </button>
              <button
                disabled={verificando || !online || !instalado}
                onClick={() => verificar(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-white/[0.05] disabled:opacity-40"
              >
                {t("acao.reparar")}
              </button>
            </div>
            {verificando && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${andamento}%` }} />
              </div>
            )}
            {relatorio && (
              <p className={cn("mt-3 text-xs", relatorio.ok ? "text-primary" : "text-amber-300")}>
                {relatorio.ok
                  ? t("gerenciar.arquivosOk")
                  : t("gerenciar.arquivosRuins", { n: relatorio.arquivos_baixados })}
              </p>
            )}
          </>
        )}
      </Bloco>

      {/* ── Rede ── */}
      <Bloco icone={Gauge} titulo={t("gerenciar.limite")}>
        <div className="flex flex-wrap gap-2">
          {LIMITES.map((op) => (
            <button
              key={op.kbps}
              onClick={() => {
                setLimite(op.kbps)
                void definirLimiteDeBanda(op.kbps)
              }}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                limite === op.kbps
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-white/[0.04]",
              )}
            >
              {op.kbps === 0 ? t("gerenciar.semLimite") : op.rotulo}
            </button>
          ))}
        </div>
      </Bloco>

      {/* ── Canal ── */}
      <Bloco icone={GitBranch} titulo={t("gerenciar.canal")}>
        <div className="flex gap-2">
          {(["estavel", "beta"] as Canal[]).map((c) => (
            <button
              key={c}
              onClick={() => {
                setCanal(c)
                void definirCanal(c)
              }}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                canal === c
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-white/[0.04]",
              )}
            >
              {c === "estavel" ? t("gerenciar.estavel") : t("gerenciar.beta")}
            </button>
          ))}
        </div>
        {canal === "beta" && (
          <p className="mt-2 text-xs text-amber-300/80">{t("gerenciar.betaAviso")}</p>
        )}

        <h4 className="mt-4 mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t("conf.aoAbrirOJogo")}
        </h4>
        <div className="flex flex-wrap gap-2">
          {OPCOES_AO_ABRIR.map((op) => (
            <button
              key={op.valor}
              onClick={() => {
                setAoAbrir(op.valor)
                void definirAcaoAoAbrir(op.valor)
              }}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                aoAbrir === op.valor
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-white/[0.04]",
              )}
            >
              {t(op.chave)}
            </button>
          ))}
        </div>
      </Bloco>

      {/* ── Suporte ── */}
      <Bloco icone={FileText} titulo="Suporte">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void abrirPastaDeLogs()}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-white/[0.05]"
          >
            <FileText className="h-3.5 w-3.5" /> {t("gerenciar.logs")}
          </button>
          <button
            onClick={() => {
              setRecado(null)
              void gerarDiagnostico()
                .then((caminho) => setRecado(t("gerenciar.diagnosticoPronto", { caminho })))
                .catch((e) => setErro(String(e)))
            }}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-white/[0.05]"
          >
            {t("gerenciar.diagnostico")}
          </button>
        </div>
      </Bloco>

      {/* ── Desinstalar ── */}
      {instalado && (
        <Bloco icone={Trash2} titulo={t("gerenciar.desinstalar")}>
          <p className="mb-3 text-xs text-muted-foreground">{t("gerenciar.desinstalarAviso")}</p>
          {confirmandoRemocao ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                disabled={removendo}
                onClick={desinstalar}
                className="flex items-center gap-1.5 rounded-lg bg-red-500/90 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
              >
                {removendo && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t("gerenciar.desinstalar")}
              </button>
              <button
                disabled={removendo}
                onClick={() => setConfirmandoRemocao(false)}
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("acao.cancelar")}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmandoRemocao(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> {t("gerenciar.desinstalar")}
            </button>
          )}
        </Bloco>
      )}
    </div>
  )
}
