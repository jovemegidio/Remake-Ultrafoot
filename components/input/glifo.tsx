"use client"

// O GLIFO NA TELA — desenhado, nunca carregado.
//
// Ver lib/controller/glyphs.ts para o porque de nao haver arquivo de imagem.
// Aqui so mora o desenho: SVG inline, `currentColor`, tamanho em `em` para
// acompanhar o preset de exibicao (TV, handheld) sem nenhuma media query.
//
// ⚠️ Este componente e desenhado MUITO: a barra de dicas tem seis, a tela de
// configuracoes tem dezenas. Por isso ele nao assina nada e nao tem estado —
// recebe a familia por prop ou do hook uma unica vez no topo. Um `useState`
// aqui viraria dezenas de assinaturas do mesmo dado.

import { memo } from "react"

import { cn } from "@/lib/utils"
import type { GameAction } from "@/lib/input/actions"
import type { InputContext } from "@/lib/input/contexts"
import {
  glifoDaAcao,
  glifoDoBotao,
  type FamiliaDeGlifo,
  type Glifo as DadosDoGlifo,
} from "@/lib/controller/glyphs"
import type { PhysicalButton } from "@/lib/controller/profiles"
import { useFamiliaDeGlifo, usePreferenciasDeInput } from "@/hooks/use-input"

type Tamanho = "sm" | "md" | "lg"

const ALTURA: Record<Tamanho, string> = {
  // `em` e nao `px`: dentro da barra de dicas o glifo cresce junto com a fonte
  // do preset de TV. Com px, a TV teria texto grande e glifo miudo ao lado.
  sm: "1.15em",
  md: "1.45em",
  lg: "1.9em",
}

/** Corpo do glifo: circulo para botao de losango, pilula para ombro/gatilho. */
function Corpo({ dados, tamanho, className }: { dados: DadosDoGlifo; tamanho: Tamanho; className?: string }) {
  const pilula = dados.contorno === "pilula"
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex items-center justify-center shrink-0 align-middle",
        "border font-semibold leading-none tabular-nums select-none",
        pilula ? "rounded-md px-[0.4em]" : "rounded-full",
        className,
      )}
      style={{
        height: ALTURA[tamanho],
        minWidth: ALTURA[tamanho],
        fontSize: tamanho === "sm" ? "0.62em" : tamanho === "md" ? "0.72em" : "0.8em",
        // A cor da marca vira BORDA e TEXTO, nunca preenchimento sólido: sobre o
        // fundo escuro do jogo, um círculo cheio de verde Xbox come o contraste
        // da letra que está dentro dele.
        color: dados.cor ?? "currentColor",
        borderColor: dados.cor ? `color-mix(in srgb, ${dados.cor} 70%, transparent)` : "currentColor",
        backgroundColor: dados.cor ? `color-mix(in srgb, ${dados.cor} 14%, transparent)` : "transparent",
      }}
    >
      <Simbolo dados={dados} />
    </span>
  )
}

function Simbolo({ dados }: { dados: DadosDoGlifo }) {
  const traco = { stroke: "currentColor", strokeWidth: 2.4, fill: "none", strokeLinecap: "round" as const }
  switch (dados.forma) {
    case "cruz":
      return (
        <svg viewBox="0 0 20 20" className="h-[0.85em] w-[0.85em]">
          <path d="M5 5 L15 15 M15 5 L5 15" {...traco} />
        </svg>
      )
    case "circulo":
      return (
        <svg viewBox="0 0 20 20" className="h-[0.85em] w-[0.85em]">
          <circle cx="10" cy="10" r="5.6" {...traco} />
        </svg>
      )
    case "quadrado":
      return (
        <svg viewBox="0 0 20 20" className="h-[0.85em] w-[0.85em]">
          <rect x="5" y="5" width="10" height="10" rx="1.2" {...traco} />
        </svg>
      )
    case "triangulo":
      return (
        <svg viewBox="0 0 20 20" className="h-[0.85em] w-[0.85em]">
          <path d="M10 4.6 L15.4 15 L4.6 15 Z" {...traco} strokeLinejoin="round" />
        </svg>
      )
    case "dpad_cima":
    case "dpad_baixo":
    case "dpad_esquerda":
    case "dpad_direita": {
      const giro = {
        dpad_cima: 0,
        dpad_direita: 90,
        dpad_baixo: 180,
        dpad_esquerda: 270,
      }[dados.forma]
      return (
        <svg viewBox="0 0 20 20" className="h-[0.9em] w-[0.9em]" style={{ transform: `rotate(${giro}deg)` }}>
          <path d="M10 5 L14.5 12.5 L5.5 12.5 Z" fill="currentColor" />
        </svg>
      )
    }
    case "menu":
      return (
        <svg viewBox="0 0 20 20" className="h-[0.85em] w-[0.85em]">
          <path d="M4 6.5h12M4 10h12M4 13.5h12" {...traco} strokeWidth={2} />
        </svg>
      )
    case "view":
      return (
        <svg viewBox="0 0 20 20" className="h-[0.85em] w-[0.85em]">
          <rect x="3" y="5" width="9" height="7" rx="1.4" {...traco} strokeWidth={1.8} />
          <rect x="8" y="8" width="9" height="7" rx="1.4" {...traco} strokeWidth={1.8} />
        </svg>
      )
    case "stick":
      return (
        <svg viewBox="0 0 20 20" className="h-[0.9em] w-[0.9em]">
          <circle cx="10" cy="10" r="6.2" {...traco} strokeWidth={1.8} />
          <circle cx="10" cy="10" r="2" fill="currentColor" />
        </svg>
      )
    default:
      return <span>{dados.rotulo}</span>
  }
}

export interface PropsDoGlifo {
  tamanho?: Tamanho
  className?: string
  /** Sobrepoe a familia detectada. So a tela de configuracoes precisa disso. */
  familia?: FamiliaDeGlifo
}

/** Glifo de uma ACAO — o caminho normal. A tela nunca pergunta "que botao é". */
export const GlifoDaAcao = memo(function GlifoDaAcao({
  acao,
  contexto = "GLOBAL",
  tamanho = "md",
  className,
  familia,
}: PropsDoGlifo & { acao: GameAction; contexto?: InputContext }) {
  const detectada = useFamiliaDeGlifo()
  const prefs = usePreferenciasDeInput()
  const dados = glifoDaAcao(acao, familia ?? detectada, contexto, prefs.amarracoes)
  if (!dados) return null
  return (
    <>
      <Corpo dados={dados} tamanho={tamanho} className={className} />
      <span className="sr-only">{dados.descricao}</span>
    </>
  )
})

/** Glifo de um botao FISICO. Para a tela de depuração e o remapeamento. */
export const GlifoDoBotao = memo(function GlifoDoBotaoComp({
  botao,
  tamanho = "md",
  className,
  familia,
}: PropsDoGlifo & { botao: PhysicalButton }) {
  const detectada = useFamiliaDeGlifo()
  const dados = glifoDoBotao(botao, familia ?? detectada)
  if (!dados) return null
  return (
    <>
      <Corpo dados={dados} tamanho={tamanho} className={className} />
      <span className="sr-only">{dados.descricao}</span>
    </>
  )
})
