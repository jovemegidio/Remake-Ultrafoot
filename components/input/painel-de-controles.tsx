"use client"

// CONFIGURAÇÕES ▸ CONTROLES.
//
// Componente proprio, e nao mais 200 linhas dentro de app/configuracoes/page.tsx
// (que ja tem 1.492): aqui ele consegue assinar o estado do input direto, sem a
// pagina inteira rerenderizar a cada deteccao de controle.
//
// ── A parte que mais importa nesta tela ────────────────────────────────────
// O bloco "Botao central". E ali que o jogador descobre POR QUE o botao Xbox
// nao ligou o Modo Controle na maquina dele — e a resposta e diferente em cada
// maquina (Steam com o Guide, XInput antigo, controle Sony sem driver). Sem
// isso, o suporte vira troca de mensagens as cegas; com isso, a propria tela
// diz o motivo e ensina a alternativa.

import { Gamepad2, Monitor, MousePointer2, RotateCcw, Smartphone, Tv } from "lucide-react"

import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  gravarPreferencias,
  restaurarPadroes,
  type PreferenciaDeEntrada,
  type PreferenciaDeExibicao,
} from "@/lib/input/preferences"
import { useModoDeExibicao, usePreferenciasDeInput, useRetratoDoInput } from "@/hooks/use-input"
import { GlifoDoBotao } from "./glifo"

const CAIXA = "rounded-xl bg-[#0c0c10] border border-white/[0.04] p-5 space-y-4"
const TITULO = "text-sm font-semibold text-white flex items-center gap-2"
const AJUDA = "text-xs text-white/40 -mt-2"

export function PainelDeControles() {
  const prefs = usePreferenciasDeInput()
  const { primario, dispositivos, centro, inputMode } = useRetratoDoInput()
  const exibicao = useModoDeExibicao()

  return (
    <div className="space-y-4">
      {/* ── Modo de entrada ─────────────────────────────────────────────── */}
      <div className={CAIXA}>
        <h3 className={TITULO}>
          <Gamepad2 className="h-4 w-4 text-primary" />
          Modo de entrada
        </h3>
        <p className={AJUDA}>
          Em &quot;Automático&quot;, o jogo troca sozinho: usar o controle ativa o Modo Controle,
          mover o mouse volta ao Modo Desktop. No momento: <strong className="text-white/70">
            {inputMode === "gamepad" ? "Controle" : "Mouse e teclado"}
          </strong>.
        </p>
        <Escolha
          valor={prefs.entrada}
          aoEscolher={(v: PreferenciaDeEntrada) => gravarPreferencias({ entrada: v })}
          opcoes={[
            { id: "auto", rotulo: "Automático", icone: Gamepad2 },
            { id: "mouse", rotulo: "Mouse e teclado", icone: MousePointer2 },
            { id: "gamepad", rotulo: "Controle", icone: Gamepad2 },
          ]}
        />
      </div>

      {/* ── Interface ───────────────────────────────────────────────────── */}
      <div className={CAIXA}>
        <h3 className={TITULO}>
          <Tv className="h-4 w-4 text-primary" />
          Interface
        </h3>
        <p className={AJUDA}>
          Independente do modo de entrada — dá para jogar de mouse com a interface de TV.
          No momento: <strong className="text-white/70">{ROTULO_DE_EXIBICAO[exibicao]}</strong>.
        </p>
        <Escolha
          valor={prefs.exibicao}
          aoEscolher={(v: PreferenciaDeExibicao) => gravarPreferencias({ exibicao: v })}
          opcoes={[
            { id: "auto", rotulo: "Automática", icone: Monitor },
            { id: "desktop", rotulo: "Desktop", icone: Monitor },
            { id: "tv", rotulo: "TV", icone: Tv },
            { id: "handheld", rotulo: "Portátil", icone: Smartphone },
          ]}
        />
        <Regulador
          rotulo="Ajuste fino de escala"
          valor={prefs.ajusteDeEscala}
          min={0.75}
          max={1.6}
          passo={0.05}
          formato={v => `${Math.round(v * 100)}%`}
          aoMudar={v => gravarPreferencias({ ajusteDeEscala: v })}
        />
      </div>

      {/* ── Controle ativo ──────────────────────────────────────────────── */}
      <div className={CAIXA}>
        <h3 className={TITULO}>
          <Gamepad2 className="h-4 w-4 text-primary" />
          Controle ativo
        </h3>
        {primario ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <Info k="Modelo" v={primario.label} />
            <Info k="Conexão" v={ROTULO_DE_CONEXAO[primario.connection]} />
            <Info k="Perfil" v={primario.profile.rotulo} />
            <Info
              k="Identificação"
              v={
                primario.vendorId != null && primario.productId != null
                  ? `${primario.vendorId.toString(16).padStart(4, "0")}:${primario.productId.toString(16).padStart(4, "0")}`
                  : // Controle Xbox entra por XInput e o navegador NAO informa
                    // VID/PID — vale para qualquer geracao. Dizer "—" e honesto;
                    // inventar um modelo exato seria adivinhacao.
                    "não informada (XInput)"
              }
            />
            {primario.battery != null && (
              <Info k="Bateria" v={`${Math.round(primario.battery * 100)}%`} />
            )}
            {dispositivos.length > 1 && (
              <Info k="Conectados" v={`${dispositivos.length} controles`} />
            )}
          </dl>
        ) : (
          <p className="text-xs text-white/40">
            Nenhum controle detectado. Conecte por USB ou Bluetooth — não é preciso reiniciar o jogo.
          </p>
        )}
      </div>

      {/* ── Botão central ───────────────────────────────────────────────── */}
      <div className={CAIXA}>
        <h3 className={TITULO}>
          <Gamepad2 className="h-4 w-4 text-primary" />
          Ativação pelo botão central
        </h3>
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs text-white/40">
            O botão Xbox / PS liga o Modo Controle. Ele nunca desliga — para voltar ao mouse,
            basta mover o mouse.
          </p>
          <Switch
            checked={prefs.botaoCentralAtiva}
            onCheckedChange={v => gravarPreferencias({ botaoCentralAtiva: v })}
          />
        </div>

        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-xs",
            centro.capability === "AVAILABLE"
              ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-300/90"
              : centro.capability === "UNKNOWN"
                ? "border-white/10 bg-white/5 text-white/50"
                : "border-amber-500/25 bg-amber-500/5 text-amber-300/90",
          )}
        >
          <div className="font-semibold">{ROTULO_DE_CAPABILITY[centro.capability]}</div>
          <div className="mt-0.5 opacity-80">{centro.reason}</div>
          <div className="mt-1 opacity-50">Origem: {centro.backend}</div>
        </div>

        {/* A combinacao aparece SEMPRE, mesmo com o botao central disponivel:
            ela e o caminho de quem joga pela Steam, e descobrir isso so quando o
            botao falha seria descobrir tarde demais. */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <div>
            <div className="text-xs font-medium text-white/80">Combinação alternativa</div>
            <div className="text-[11px] text-white/40">
              Segure por {prefs.combo.seguraMs} ms quando o botão central não estiver disponível.
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 text-white/80">
            <GlifoDoBotao botao={prefs.combo.a} tamanho="sm" />
            <span className="text-white/30">+</span>
            <GlifoDoBotao botao={prefs.combo.b} tamanho="sm" />
          </span>
        </div>
        <Regulador
          rotulo="Tempo para segurar"
          valor={prefs.combo.seguraMs}
          min={250}
          max={1500}
          passo={50}
          formato={v => `${v} ms`}
          aoMudar={v => gravarPreferencias({ combo: { ...prefs.combo, seguraMs: v } })}
        />
      </div>

      {/* ── Sensibilidade ───────────────────────────────────────────────── */}
      <div className={CAIXA}>
        <h3 className={TITULO}>
          <Gamepad2 className="h-4 w-4 text-primary" />
          Sensibilidade
        </h3>
        <p className={AJUDA}>
          Aumente a zona morta se o cursor ou a seleção andarem sozinhos — é sinal de analógico
          gasto, e não defeito do jogo.
        </p>
        <Regulador
          rotulo="Zona morta"
          valor={prefs.deadzone}
          min={0.02}
          max={0.6}
          passo={0.01}
          formato={v => v.toFixed(2)}
          aoMudar={v => gravarPreferencias({ deadzone: v })}
        />
        <Regulador
          rotulo="Força para assumir o Modo Controle"
          valor={prefs.intencao}
          min={0.2}
          max={0.95}
          passo={0.05}
          formato={v => v.toFixed(2)}
          aoMudar={v => gravarPreferencias({ intencao: v })}
        />
        <Regulador
          rotulo="Atraso antes de repetir"
          valor={prefs.atrasoInicialMs}
          min={80}
          max={1000}
          passo={10}
          formato={v => `${v} ms`}
          aoMudar={v => gravarPreferencias({ atrasoInicialMs: v })}
        />
        <Regulador
          rotulo="Velocidade da repetição"
          valor={prefs.intervaloRepeticaoMs}
          min={30}
          max={400}
          passo={5}
          formato={v => `${v} ms`}
          aoMudar={v => gravarPreferencias({ intervaloRepeticaoMs: v })}
        />
      </div>

      <button
        type="button"
        onClick={() => restaurarPadroes()}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 py-2.5 text-sm text-white/70 transition-colors hover:border-white/20 hover:text-white"
      >
        <RotateCcw className="h-4 w-4" />
        Restaurar padrões de controle
      </button>
    </div>
  )
}

const ROTULO_DE_EXIBICAO: Record<string, string> = {
  desktop: "Desktop",
  tv: "TV",
  handheld: "Portátil",
}

const ROTULO_DE_CONEXAO: Record<string, string> = {
  usb: "USB",
  bluetooth: "Bluetooth",
  wireless: "Sem fio",
  unknown: "Não identificada",
}

const ROTULO_DE_CAPABILITY: Record<string, string> = {
  AVAILABLE: "Disponível para o jogo",
  RESERVED_BY_SYSTEM: "Reservado pelo sistema",
  UNAVAILABLE: "Indisponível nesta máquina",
  UNKNOWN: "Ainda não verificado",
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-white/40">{k}</dt>
      <dd className="truncate text-right text-white/80">{v}</dd>
    </>
  )
}

function Escolha<T extends string>({
  valor,
  opcoes,
  aoEscolher,
}: {
  valor: T
  opcoes: readonly { id: T; rotulo: string; icone: React.ComponentType<{ className?: string }> }[]
  aoEscolher: (v: T) => void
}) {
  return (
    <div className={cn("grid gap-2", opcoes.length > 3 ? "grid-cols-4" : "grid-cols-3")}>
      {opcoes.map(({ id, rotulo, icone: Icone }) => (
        <button
          key={id}
          type="button"
          onClick={() => aoEscolher(id)}
          aria-pressed={valor === id}
          className={cn(
            "flex flex-col items-center gap-1 rounded-lg border p-3 transition-all",
            valor === id
              ? "border-primary bg-primary/10"
              : "border-white/10 bg-white/5 hover:border-white/20",
          )}
        >
          <Icone className={cn("h-5 w-5", valor === id ? "text-primary" : "text-white/50")} />
          <span className="text-center text-xs text-white">{rotulo}</span>
        </button>
      ))}
    </div>
  )
}

function Regulador({
  rotulo,
  valor,
  min,
  max,
  passo,
  formato,
  aoMudar,
}: {
  rotulo: string
  valor: number
  min: number
  max: number
  passo: number
  formato: (v: number) => string
  aoMudar: (v: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/60">{rotulo}</span>
        <span className="font-semibold tabular-nums text-primary">{formato(valor)}</span>
      </div>
      <Slider
        value={[valor]}
        min={min}
        max={max}
        step={passo}
        // `onValueChange` e nao `onValueCommit`: a gravacao ja e barata
        // (localStorage + um aviso) e o jogador precisa SENTIR a zona morta
        // mudando enquanto arrasta. Esperar soltar transformaria o ajuste num
        // vai-e-vem de tentativa e erro.
        onValueChange={([v]) => aoMudar(v)}
      />
    </div>
  )
}
