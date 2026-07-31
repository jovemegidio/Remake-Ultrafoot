"use client"

// BANCADA DE TESTE DO MOTOR 3D — rota de desenvolvimento.
//
// Roda o motor 3D e o match-engine LADO A LADO sobre a mesma partida, para ver
// onde os dois divergem. Não é tela de jogo: é instrumento de medição.
//
// Por que existe: os dois simuladores têm filosofias opostas. O match-engine
// decide o resultado (passo de 1 minuto, gols por xG); o motor 3D descobre o
// resultado (passo de 1/60s, física, 22 IAs). Eles nunca vão bater sozinhos —
// e sem ver os números lado a lado, "ajustar a telemetria" seria chute.
//
// A decisão de arquitetura já tomada: **o match-engine manda no resultado**. O
// 3D é a câmera, não o árbitro. Esta rota serve para medir o quanto a câmera
// está contando uma história diferente do placar.

import { useCallback, useEffect, useRef, useState } from "react"
import { Campo3D } from "@/components/partida/campo-3d"
import { PainelComparacao } from "@/components/partida/painel-comparacao"
import type { Motor } from "@/lib/partida-3d/motor"
import {
  createInitialState,
  startMatch,
  tickMinute,
  SPEED_TICKS_PER_SEC,
  type MatchConfig,
  type MatchSpeed,
  type MatchState,
} from "@/lib/match-engine"
import { serieATeams } from "@/lib/teams-data"

/**
 * Velocidades do JOGO (1x/3x/5x são as expostas ao jogador) mapeadas para o
 * multiplicador do motor 3D.
 *
 * Isto é o ponto que mantém os dois alinhados. O 3D tem 6 marchas internas e o
 * jogo tem 5 nomes; sem uma tabela explícita, cada lado anda no seu ritmo e a
 * partida 3D descola do placar — o jogador vê um lance que o motor já passou.
 *
 * O `mult3d` não é igual ao `ticks/s` de propósito: o match-engine simula 1
 * MINUTO por tick, o 3D simula tempo contínuo. O que precisa bater é o tempo de
 * jogo por segundo real, não o número de passos.
 */
const VELOCIDADES: { rotulo: string; jogo: MatchSpeed; mult3d: number }[] = [
  { rotulo: "1x", jogo: "normal", mult3d: 1 },
  { rotulo: "3x", jogo: "fast", mult3d: 4 },
  { rotulo: "5x", jogo: "ultra", mult3d: 8 },
]

/** Durações curtas para estressar: ver 90 minutos sem esperar 90 minutos. */
const DURACOES = [2, 5, 10, 45]

export default function BancadaPartida3D() {
  const [motor, setMotor] = useState<Motor | null>(null)
  const [estado, setEstado] = useState<MatchState | null>(null)
  const [rodando, setRodando] = useState(false)
  const [velocidade, setVelocidade] = useState(VELOCIDADES[1])
  const [duracao, setDuracao] = useState(5)
  const [erro, setErro] = useState<string | null>(null)

  // O config do match-engine. Dois times reais da Série A, forças equilibradas
  // para a divergência não vir de um lado ser muito mais forte.
  const configRef = useRef<MatchConfig>({
    homeTeam: serieATeams[0],
    awayTeam: serieATeams[1],
    homeRating: 75,
    awayRating: 74,
    durationMinutes: 5,
  })
  configRef.current.durationMinutes = duracao

  const estadoRef = useRef<MatchState | null>(null)
  estadoRef.current = estado

  // ── o relógio do match-engine ───────────────────────────────────────────────
  //
  // O intervalo só depende de `rodando` e da velocidade. `estado` NÃO entra nas
  // dependências de propósito: ele muda a cada tick, e recriar o intervalo a
  // cada minuto simulado faria o relógio andar torto. Quem lê o estado atual é o
  // updater do setState, que sempre recebe o valor mais recente.
  useEffect(() => {
    if (!rodando) return
    const ticks = SPEED_TICKS_PER_SEC[velocidade.jogo]
    const id = window.setInterval(() => {
      setEstado((atual) => {
        if (!atual || atual.phase === "fulltime") return atual
        try {
          return tickMinute(atual, configRef.current)
        } catch (e) {
          setErro(e instanceof Error ? e.message : "erro no match-engine")
          return atual
        }
      })
    }, 1000 / ticks)
    return () => window.clearInterval(id)
  }, [rodando, velocidade])

  // ── a ponte: o jogo decide, o 3D encena ─────────────────────────────────────
  //
  // MEDIDO nesta máquina (RTX 3060, 60fps): o 3D produz no máximo 7,6 s de jogo
  // por segundo real; o 2D no ritmo mais lento produz 120. Tentar igualar os
  // ritmos é impossível — o 2D avança 1 minuto por tick, o 3D avança 1/60 de
  // segundo por passo. Por isso o 3D não corre atrás do relógio: ele encena os
  // eventos que o match-engine já decidiu.
  const jaEncenados = useRef(new Set<string>())
  const [encenados, setEncenados] = useState<string[]>([])
  useEffect(() => {
    if (!motor || !estado) return
    const novos: string[] = []
    for (const ev of estado.events) {
      if (jaEncenados.current.has(ev.id)) continue
      jaEncenados.current.add(ev.id)
      const encenou = motor.encenar({ tipo: ev.type, lado: ev.side, minuto: ev.minute })
      novos.push(`${ev.minute}' ${ev.type} ${ev.side === "home" ? "casa" : "fora"}${encenou ? "" : "  (sem cena)"}`)
    }
    if (novos.length) setEncenados((a) => [...novos.reverse(), ...a].slice(0, 14))
  }, [motor, estado])

  // ── mantém o 3D no mesmo ritmo ──────────────────────────────────────────────
  useEffect(() => {
    motor?.definirVelocidade(velocidade.mult3d)
  }, [motor, velocidade])

  useEffect(() => {
    motor?.definirDuracaoDoTempo(duracao)
  }, [motor, duracao])

  const comecar = useCallback(() => {
    setErro(null)
    // Zera o registro: sem isto, a segunda partida não encenaria nada — os ids
    // de evento recomeçam e o Set ainda os teria como "já vistos".
    jaEncenados.current.clear()
    setEstado(startMatch(createInitialState()))
    setRodando(true)
    motor?.definirPausa(false)
  }, [motor])

  const pausar = useCallback(() => {
    setRodando((r) => {
      motor?.definirPausa(r)
      return !r
    })
  }, [motor])

  const terminou = estado?.phase === "fulltime"

  return (
    <div style={pagina}>
      <div style={topo}>
        <div>
          <div style={tituloPagina}>bancada · motor 3D × match-engine</div>
          <div style={subtitulo}>
            rota de desenvolvimento — não é tela de jogo
          </div>
        </div>

        <div style={controles}>
          <Grupo rotulo="velocidade">
            {VELOCIDADES.map((v) => (
              <Botao
                key={v.rotulo}
                ativo={v.rotulo === velocidade.rotulo}
                onClick={() => setVelocidade(v)}
              >
                {v.rotulo}
              </Botao>
            ))}
          </Grupo>

          <Grupo rotulo="minutos por tempo">
            {DURACOES.map((d) => (
              <Botao key={d} ativo={d === duracao} onClick={() => setDuracao(d)} disabled={rodando}>
                {d}
              </Botao>
            ))}
          </Grupo>

          <Grupo rotulo="partida">
            <Botao onClick={comecar}>{estado ? "reiniciar" : "começar"}</Botao>
            <Botao onClick={pausar} disabled={!estado}>
              {rodando ? "pausar" : "seguir"}
            </Botao>
          </Grupo>
        </div>
      </div>

      {erro && <div style={faixaErro}>{erro}</div>}
      {terminou && <div style={faixaFim}>fim de jogo no match-engine</div>}

      <div style={corpo}>
        <div style={areaCampo}>
          <Campo3D qualidade="mid" aoMudarMotor={setMotor} />
        </div>
        <div style={areaPainel}>
          <PainelComparacao motor={motor} estadoJogo={estado} />

          {encenados.length > 0 && (
            <div style={{ ...caixaEventos }}>
              <div style={tituloEventos}>o jogo decidiu · o 3D encenou</div>
              {encenados.map((e, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 10,
                    padding: "2px 0",
                    color: e.includes("(sem cena)") ? "#4a5766" : "#8fd6ff",
                  }}
                >
                  {e}
                </div>
              ))}
            </div>
          )}

          {!estado && (
            <div style={dica}>
              O 3D já está simulando sozinho. Clique <b>começar</b> para ligar o
              match-engine e ver as duas colunas.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Grupo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={rotuloGrupo}>{rotulo}</div>
      <div style={{ display: "flex", gap: 4 }}>{children}</div>
    </div>
  )
}

function Botao({
  children,
  ativo,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  ativo?: boolean
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: ativo ? "#ffb020" : "rgba(255,255,255,.06)",
        color: ativo ? "#0c1015" : "#f3f6f8",
        border: "1px solid rgba(255,255,255,.1)",
        padding: "4px 10px",
        fontSize: 11,
        fontFamily: "inherit",
        fontWeight: ativo ? 700 : 400,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  )
}

const pagina: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  background: "#03050a",
  color: "#f3f6f8",
  fontFamily: "'JetBrains Mono','SF Mono',Consolas,monospace",
}
const topo: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 24,
  padding: "10px 14px",
  borderBottom: "1px solid rgba(255,255,255,.08)",
  flexWrap: "wrap",
}
const tituloPagina: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: ".18em",
  textTransform: "uppercase",
}
const subtitulo: React.CSSProperties = { fontSize: 10, color: "#4a5766", marginTop: 2 }
const controles: React.CSSProperties = { display: "flex", gap: 16, flexWrap: "wrap" }
const rotuloGrupo: React.CSSProperties = {
  fontSize: 8,
  letterSpacing: ".2em",
  textTransform: "uppercase",
  color: "#4a5766",
  marginBottom: 3,
}
const corpo: React.CSSProperties = { flex: 1, display: "flex", minHeight: 0 }
const areaCampo: React.CSSProperties = { flex: 1, position: "relative", minWidth: 0 }
const areaPainel: React.CSSProperties = {
  width: 340,
  padding: 10,
  overflowY: "auto",
  borderLeft: "1px solid rgba(255,255,255,.08)",
}
const caixaEventos: React.CSSProperties = {
  marginTop: 10,
  background: "rgba(9,13,18,.92)",
  border: "1px solid rgba(255,255,255,.08)",
  padding: "8px 10px 10px",
}
const tituloEventos: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: ".2em",
  textTransform: "uppercase",
  color: "#7f8d9e",
  marginBottom: 6,
}
const dica: React.CSSProperties = {
  marginTop: 10,
  fontSize: 10,
  lineHeight: 1.6,
  color: "#7f8d9e",
  background: "rgba(255,176,32,.07)",
  border: "1px solid rgba(255,176,32,.2)",
  padding: "8px 10px",
}
const faixaErro: React.CSSProperties = {
  background: "rgba(255,106,18,.15)",
  borderBottom: "1px solid #ff6a12",
  color: "#ff6a12",
  fontSize: 11,
  padding: "6px 14px",
}
const faixaFim: React.CSSProperties = {
  background: "rgba(143,214,255,.1)",
  borderBottom: "1px solid #8fd6ff",
  color: "#8fd6ff",
  fontSize: 11,
  padding: "6px 14px",
}
