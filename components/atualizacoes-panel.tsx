"use client"

// TELA DE ATUALIZACOES (Personalizar > Atualizacoes).
//
// Tres canais, um botao de conferir e um de aplicar. A regra que organiza tudo:
// NADA sai para a rede antes do jogador autorizar. Quem chega aqui sem ter
// autorizado ve o convite (DialogoConsentimentoAtualizacoes) no primeiro clique.
//
// Elencos e times vem do MESMO manifesto de dados e sao aplicados na hora.
// "Jogo" so avisa: a build e instalada pelo Ultrafoot Launcher.

import { useCallback, useEffect, useState } from "react"
import {
  AlertCircle,
  Check,
  Download,
  Globe,
  Loader2,
  RefreshCw,
  Shield,
  Users,
  WifiOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { DialogoConsentimentoAtualizacoes } from "@/components/dialogo-consentimento-atualizacoes"
import {
  aplicarDados,
  TITULOS,
  verificarAtualizacoes,
  versaoDadosLocal,
  type EstadoCanal,
  type ItemAtualizacao,
  type Relatorio,
} from "@/lib/atualizacoes"
import {
  EVENTO_PREFERENCIAS,
  getAtualizacaoAutomatica,
  getCanais,
  getConsentimento,
  setAtualizacaoAutomatica,
  setCanal,
  setConsentimento,
  type Canais,
  type Canal,
  type Consentimento,
} from "@/lib/atualizacoes-preferencias"

const ICONES: Record<Canal, React.ComponentType<{ className?: string }>> = {
  elencos: Users,
  times: Shield,
  jogo: Download,
}

const SELO: Record<EstadoCanal, { texto: string; classe: string }> = {
  atualizado: { texto: "Em dia", classe: "bg-[var(--brand)]/15 text-[var(--brand)]" },
  disponivel: { texto: "Atualização disponível", classe: "bg-amber-400/15 text-amber-300" },
  desligado: { texto: "Desligado", classe: "bg-white/10 text-white/40" },
  "sem-consentimento": { texto: "Não conectado", classe: "bg-white/10 text-white/40" },
  indisponivel: { texto: "Indisponível", classe: "bg-red-500/15 text-red-300" },
}

export function AtualizacoesPanel() {
  // O estado das preferencias e lido SO depois de montar: o store e do cliente e
  // o export estatico renderiza esta tela no build. Comecar pelo padrao e
  // corrigir no efeito e o mesmo caminho usado pela moeda e pela tela cheia.
  const [consentimento, setConsentimentoLocal] = useState<Consentimento>("nao-perguntado")
  const [automatico, setAutomatico] = useState(true)
  const [canais, setCanais] = useState<Canais>({ elencos: true, times: true, jogo: true })
  const [versaoLocal, setVersaoLocal] = useState(0)

  const [relatorio, setRelatorio] = useState<Relatorio | null>(null)
  const [verificando, setVerificando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [pedindoConsentimento, setPedindoConsentimento] = useState(false)

  const lerPreferencias = useCallback(() => {
    setConsentimentoLocal(getConsentimento())
    setAutomatico(getAtualizacaoAutomatica())
    setCanais(getCanais())
    setVersaoLocal(versaoDadosLocal())
  }, [])

  useEffect(() => {
    lerPreferencias()
    window.addEventListener(EVENTO_PREFERENCIAS, lerPreferencias)
    return () => window.removeEventListener(EVENTO_PREFERENCIAS, lerPreferencias)
  }, [lerPreferencias])

  const verificar = useCallback(async () => {
    setVerificando(true)
    setMensagem(null)
    try {
      setRelatorio(await verificarAtualizacoes())
    } finally {
      setVerificando(false)
      setVersaoLocal(versaoDadosLocal())
    }
  }, [])

  // Quem ja autorizou e abriu esta tela quer ver o estado agora, nao depois de
  // clicar. Quem nao autorizou nao dispara nada.
  useEffect(() => {
    if (getConsentimento() === "aceito") void verificar()
  }, [verificar])

  /** Toda ação de rede passa por aqui: sem consentimento, mostra o convite. */
  const comConsentimento = (acao: () => void) => {
    if (getConsentimento() === "aceito") acao()
    else setPedindoConsentimento(true)
  }

  const aplicar = async (canal: Canal) => {
    setAplicando(true)
    setMensagem(null)
    try {
      const versao = aplicarDados(relatorio?.dados ?? null)
      // A confirmação vem DEPOIS da reconsulta: verificar() limpa a mensagem no
      // início, então escrever antes faria o aviso piscar e sumir.
      await verificar()
      setMensagem(
        versao > 0
          ? canal === "elencos"
            ? `Elencos atualizados (pacote v${versao}). Reabra a tela de elenco para ver as mudanças.`
            : `Times atualizados (pacote v${versao}). Escudos e uniformes já valem para os próximos jogos.`
          : "Nada novo para aplicar.",
      )
    } finally {
      setAplicando(false)
    }
  }

  const itens: ItemAtualizacao[] = relatorio?.itens ?? []
  const conectado = consentimento === "aceito"

  return (
    <div className="space-y-6">
      {/* Conexão ------------------------------------------------------------ */}
      <div className="rounded-xl border border-white/[0.04] bg-[#0c0c10] p-6 space-y-5">
        <h3 className="flex items-center gap-2 text-sm font-medium text-white">
          <Globe className="h-4 w-4 text-primary" />
          Conexão com o servidor
        </h3>

        <div className="flex items-start justify-between gap-4 rounded-lg bg-white/5 p-3">
          <div className="min-w-0">
            <div className="text-sm text-white">
              {conectado ? "Conectado ao servidor oficial" : "Desconectado"}
            </div>
            <div className="text-xs leading-5 text-white/40">
              {conectado
                ? "O jogo pode buscar atualizações de elencos, times e versões. Nada do seu save é enviado."
                : "Nenhuma conexão de atualização é feita enquanto você não autorizar."}
            </div>
          </div>
          {conectado ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setConsentimento("recusado")
                // Some com o relatorio junto: deixar na tela um "atualizacao
                // disponivel" com botao de aplicar depois de desconectar seria
                // oferecer o que nao vamos mais buscar.
                setRelatorio(null)
                setMensagem(null)
              }}
              className="shrink-0 border-white/10 bg-transparent text-xs text-white/70 hover:bg-white/5"
            >
              <WifiOff className="mr-2 h-3.5 w-3.5" />
              Desconectar
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setPedindoConsentimento(true)}
              className="shrink-0 bg-[var(--brand)] text-xs font-bold text-[var(--brand-ink)] hover:bg-[var(--brand-2)]"
            >
              Conectar
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg bg-white/5 p-3">
          <div>
            <div className="text-sm text-white">Procurar atualizações ao abrir o jogo</div>
            <div className="text-xs text-white/40">
              Busca em segundo plano, sem atrapalhar o carregamento.
            </div>
          </div>
          <Switch
            checked={conectado && automatico}
            disabled={!conectado}
            onCheckedChange={(v) => setAtualizacaoAutomatica(v)}
          />
        </div>
      </div>

      {/* Canais ------------------------------------------------------------- */}
      <div className="rounded-xl border border-white/[0.04] bg-[#0c0c10] p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-medium text-white">
            <RefreshCw className="h-4 w-4 text-primary" />
            O que atualizar
          </h3>
          <Button
            variant="outline"
            size="sm"
            disabled={verificando || aplicando}
            onClick={() => comConsentimento(() => void verificar())}
            className="border-white/10 bg-transparent text-xs text-white/70 hover:bg-white/5"
          >
            {verificando ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
            )}
            Procurar atualizações
          </Button>
        </div>

        <div className="space-y-3">
          {(["elencos", "times", "jogo"] as Canal[]).map((canal) => {
            const dados = itens.find((i) => i.canal === canal)
            return (
              <CartaoCanal
                key={canal}
                canal={canal}
                item={dados}
                ligado={canais[canal]}
                conectado={conectado}
                ocupado={verificando || aplicando}
                onLigar={(v) => {
                  setCanal(canal, v)
                  // Religar pede uma consulta nova: o relatorio anterior marcou
                  // este canal como "desligado" e continuaria dizendo isso.
                  if (v && getConsentimento() === "aceito") void verificar()
                }}
                onAtualizar={() => comConsentimento(() => void aplicar(canal))}
              />
            )
          })}
        </div>

        {mensagem && (
          <p className="flex items-center gap-2 text-xs text-[var(--brand)]">
            <Check className="h-3.5 w-3.5 shrink-0" />
            {mensagem}
          </p>
        )}

        <p className="text-xs text-white/30">
          Pacote de dados nesta máquina: {versaoLocal > 0 ? `v${versaoLocal}` : "só o que veio no build"}
          {relatorio ? ` · verificado às ${new Date(relatorio.verificadoEm).toLocaleTimeString()}` : ""}
        </p>
      </div>

      {/* Como funciona ------------------------------------------------------ */}
      <div className="rounded-xl border border-white/[0.04] bg-[#0c0c10] p-6">
        <h3 className="text-sm font-medium text-white">Como funciona</h3>
        <p className="mt-3 text-xs leading-relaxed text-white/50">
          Elencos e times chegam num pacote de poucos KB e valem na hora, sem reinstalar o jogo.
          <strong className="text-white/70"> As suas edições sempre vencem</strong>: o que você
          alterou no editor de clubes e de atletas nunca é sobrescrito por uma atualização nossa.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-white/35">
          A atualização do jogo em si é baixada e instalada pelo Ultrafoot Launcher — aqui apenas
          avisamos que ela existe.
        </p>
      </div>

      {pedindoConsentimento && (
        <DialogoConsentimentoAtualizacoes
          onDecidir={(aceitou) => {
            setPedindoConsentimento(false)
            if (aceitou) void verificar()
          }}
        />
      )}
    </div>
  )
}

function CartaoCanal({
  canal,
  item,
  ligado,
  conectado,
  ocupado,
  onLigar,
  onAtualizar,
}: {
  canal: Canal
  item?: ItemAtualizacao
  ligado: boolean
  conectado: boolean
  ocupado: boolean
  onLigar: (v: boolean) => void
  onAtualizar: () => void
}) {
  const Icone = ICONES[canal]
  const estado: EstadoCanal = !ligado
    ? "desligado"
    : item?.estado ?? (conectado ? "indisponivel" : "sem-consentimento")
  const selo = SELO[estado]
  const titulo = item?.titulo ?? TITULOS[canal].titulo
  const descricao = item?.descricao ?? TITULOS[canal].descricao
  // "Jogo" nunca instala nada por aqui: quem faz isso e o launcher.
  const podeAplicar = estado === "disponivel" && canal !== "jogo"

  return (
    <div className="rounded-lg bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
            <Icone className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-white">{titulo}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", selo.classe)}>
                {selo.texto}
              </span>
            </div>
            <div className="mt-0.5 text-xs leading-5 text-white/40">{descricao}</div>
          </div>
        </div>
        <Switch checked={ligado} onCheckedChange={onLigar} className="mt-1 shrink-0" />
      </div>

      {ligado && item?.detalhe && (
        <p className="mt-3 pl-12 text-xs text-white/55">{item.detalhe}</p>
      )}

      {ligado && item?.notas && estado === "disponivel" && (
        <p className="mt-1 max-h-20 overflow-y-auto whitespace-pre-line pl-12 text-xs text-white/35">
          {item.notas}
        </p>
      )}

      {podeAplicar && (
        <div className="mt-3 pl-12">
          <Button
            size="sm"
            disabled={ocupado}
            onClick={onAtualizar}
            className="bg-[var(--brand)] text-xs font-bold text-[var(--brand-ink)] hover:bg-[var(--brand-2)]"
          >
            {ocupado ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-2 h-3.5 w-3.5" />
            )}
            Baixar e aplicar
          </Button>
        </div>
      )}

      {canal === "jogo" && estado === "disponivel" && (
        <div className="mt-3 ml-12 flex gap-2 rounded-lg border border-[var(--brand)]/20 bg-[var(--brand)]/5 p-3 text-xs leading-5 text-white/75">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--brand)]" />
          <span>
            Feche o Ultrafoot 26 e abra o <strong className="text-white">Ultrafoot Launcher</strong>:
            ele baixa e instala a nova versão automaticamente.
          </span>
        </div>
      )}
    </div>
  )
}
