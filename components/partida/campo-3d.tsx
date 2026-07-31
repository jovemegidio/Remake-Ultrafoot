"use client"

// O CAMPO 3D DENTRO DO JOGO.
//
// Este componente existe por um motivo específico: o motor (`lib/partida-3d/`)
// foi escrito para ser uma página inteira, aberta uma vez e nunca fechada. O
// jogo é uma SPA — a tela da partida entra e sai. Sem alguém cuidando do ciclo
// de vida, sair da partida deixa o loop rodando com a GPU ligada e o áudio
// tocando; entrar de novo cria um segundo motor por cima do primeiro. Em duas ou
// três partidas o jogo engasga e o navegador derruba o contexto WebGL.
//
// Então a regra deste arquivo é uma só: **para cada `criarMotor()` existe um
// `destruir()`**, inclusive quando o componente desmonta no meio do carregamento.

import { useEffect, useRef, useState } from "react"
import type { Motor, QualidadeMotor } from "@/lib/partida-3d/motor"

interface Props {
  /**
   * Qualidade inicial. Omitido, o motor decide pelo tipo de ponteiro
   * (toque = média).
   */
  qualidade?: QualidadeMotor
  /** Chamado quando a simulação está rodando de fato. */
  aoIniciar?: () => void
  /**
   * Entrega a instância do motor a quem precisa ler telemetria (o HUD, o painel
   * de comparação). Recebe `null` na desmontagem — quem guardar a referência
   * precisa soltá-la, senão o motor destruído continua alcançável.
   */
  aoMudarMotor?: (motor: Motor | null) => void
  className?: string
}

type Estado =
  | { fase: "carregando"; pct: number; etapa: string }
  | { fase: "rodando" }
  | { fase: "falhou"; mensagem: string }

export function Campo3D({ qualidade, aoIniciar, aoMudarMotor, className }: Props) {
  const palcoRef = useRef<HTMLDivElement>(null)
  const motorRef = useRef<Motor | null>(null)
  const [estado, setEstado] = useState<Estado>({
    fase: "carregando",
    pct: 0,
    etapa: "preparando",
  })

  // `aoIniciar` numa ref para não entrar nas dependências do efeito: se o pai
  // recriar a função a cada render — o normal — o motor seria destruído e
  // remontado a cada quadro do pai.
  const aoIniciarRef = useRef(aoIniciar)
  aoIniciarRef.current = aoIniciar
  const aoMudarMotorRef = useRef(aoMudarMotor)
  aoMudarMotorRef.current = aoMudarMotor

  useEffect(() => {
    const palco = palcoRef.current
    if (!palco) return

    let vivo = true
    let motor: Motor | null = null

    // O motor carrega o Three.js inteiro. Import dinâmico para que ele não entre
    // no bundle de quem nunca abre uma partida — que é a maioria das telas.
    void import("@/lib/partida-3d/motor")
      .then(({ criarMotor }) => {
        // O componente pode ter desmontado enquanto o import viajava. Criar o
        // motor agora seria criar algo que ninguém vai destruir.
        if (!vivo) return

        motor = criarMotor({
          palco,
          qualidade,
          aoProgredir: (pct, etapa) => {
            if (vivo) setEstado({ fase: "carregando", pct, etapa })
          },
          aoIniciar: () => {
            if (!vivo) return
            setEstado({ fase: "rodando" })
            aoIniciarRef.current?.()
          },
          aoFalhar: (erro) => {
            if (vivo) setEstado({ fase: "falhou", mensagem: erro.message })
          },
        })
        motorRef.current = motor
        aoMudarMotorRef.current?.(motor)

        return motor.iniciar()
      })
      .catch((erro: unknown) => {
        if (!vivo) return
        // Falhar em silêncio aqui deixaria o jogador olhando para um retângulo
        // preto sem saber se o jogo travou ou se a máquina dele não dá conta.
        setEstado({
          fase: "falhou",
          mensagem: erro instanceof Error ? erro.message : "erro desconhecido",
        })
      })

    return () => {
      vivo = false
      motor?.destruir()
      motorRef.current = null
      // Avisa ANTES de quem guardou a referência tentar ler telemetria de um
      // motor já destruído. `lerTelemetria()` devolveria null de qualquer forma,
      // mas segurar a instância morta impediria o GC de liberar a cena.
      aoMudarMotorRef.current?.(null)
    }
  }, [qualidade])

  return (
    <div className={className} style={{ position: "relative", inset: 0, background: "#03050a" }}>
      <div ref={palcoRef} style={{ position: "absolute", inset: 0 }} />

      {estado.fase === "carregando" && (
        <div style={sobreposicao}>
          <div style={{ fontSize: 11, letterSpacing: ".22em", textTransform: "uppercase", color: "#7f8d9e" }}>
            {estado.etapa}
          </div>
          <div style={{ width: 260, height: 3, background: "rgba(255,255,255,.12)", marginTop: 12 }}>
            <div
              style={{
                width: `${estado.pct}%`,
                height: "100%",
                background: "#ffb020",
                transition: "width .3s ease",
              }}
            />
          </div>
        </div>
      )}

      {estado.fase === "falhou" && (
        <div style={sobreposicao}>
          <div style={{ fontSize: 13, color: "#f3f6f8", marginBottom: 8 }}>
            Não foi possível carregar a partida em 3D
          </div>
          <div style={{ fontSize: 11, color: "#7f8d9e", maxWidth: 380, textAlign: "center", lineHeight: 1.5 }}>
            {estado.mensagem}
            <br />
            Seu computador pode estar sem aceleração 3D (WebGL). O restante do jogo funciona normalmente.
          </div>
        </div>
      )}
    </div>
  )
}

const sobreposicao: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "#03050a",
  fontFamily: "'Archivo Narrow','Roboto Condensed',Arial,sans-serif",
}
