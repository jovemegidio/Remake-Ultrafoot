"use client"

// PAINEL DE DIAGNÓSTICO — motor 3D × match-engine, lado a lado.
//
// POR QUE ISTO EXISTE. O jogo tem dois simuladores com filosofias opostas:
//
//   match-engine.ts  decide  o resultado — passo de 1 MINUTO, gols sorteados por
//                            xG, momentum e modificadores. É ele que alimenta a
//                            carreira, e continua sendo a fonte da verdade.
//   motor 3D         descobre o resultado — passo de 1/60s, física contínua,
//                            22 IAs. Gol é a bola cruzando a linha.
//
// Rodando juntos, eles divergem: o 3D pode mostrar 8 finalizações enquanto o
// jogo registrou 3. Este painel serve para **medir a divergência antes de tentar
// corrigi-la** — sem número na tela, "ajustar a telemetria" vira chute.
//
// É ferramenta de desenvolvimento. Não deve aparecer para o jogador.

import { useEffect, useRef, useState } from "react"
import type { Motor, Telemetria } from "@/lib/partida-3d/motor"
import type { MatchState } from "@/lib/match-engine"

interface Props {
  /** Instância viva do motor 3D. */
  motor: Motor | null
  /** Estado atual do match-engine — a fonte da verdade do jogo. */
  estadoJogo: MatchState | null
  /** Quantas vezes por segundo reler. 4 é suficiente para o olho. */
  hz?: number
}

export function PainelComparacao({ motor, estadoJogo, hz = 4 }: Props) {
  const [tel, setTel] = useState<Telemetria | null>(null)
  const motorRef = useRef(motor)
  motorRef.current = motor

  useEffect(() => {
    // Intervalo, e não requestAnimationFrame: o painel é diagnóstico, não
    // precisa de 60 Hz. Reler a 4 Hz mantém o custo perto de zero e ainda
    // deixa os números legíveis — a 60 Hz eles piscam demais para se ler.
    const id = window.setInterval(() => {
      setTel(motorRef.current?.lerTelemetria() ?? null)
    }, 1000 / hz)
    return () => window.clearInterval(id)
  }, [hz])

  if (!tel) {
    return (
      <div style={caixa}>
        <div style={titulo}>comparação</div>
        <div style={{ ...vazio }}>motor 3D não iniciado</div>
      </div>
    )
  }

  const j = estadoJogo
  const relogio3d = `${String(Math.floor(tel.relogio.segundos / 60)).padStart(2, "0")}:${String(
    Math.floor(tel.relogio.segundos % 60),
  ).padStart(2, "0")}`

  return (
    <div style={caixa}>
      <div style={titulo}>
        motor 3D <span style={{ color: "#4a5766" }}>×</span> jogo
      </div>

      <div style={cabecalho}>
        <span />
        <span style={{ color: "#ffb020" }}>3D</span>
        <span style={{ color: "#8fd6ff" }}>jogo</span>
        <span style={{ color: "#4a5766" }}>Δ</span>
      </div>

      <Linha rotulo="relógio" a={relogio3d} b={j ? `${j.minute}'` : "—"} />
      <Linha
        rotulo="placar"
        a={`${tel.placar.casa}–${tel.placar.fora}`}
        b={j ? `${j.home.goals}–${j.away.goals}` : "—"}
        alerta={
          !!j && (tel.placar.casa !== j.home.goals || tel.placar.fora !== j.away.goals)
        }
      />

      <div style={secao}>casa</div>
      <Numero rotulo="posse %" a={tel.posse.casa} b={j?.home.possession} casas={1} />
      <Numero rotulo="finalizações" a={tel.casa.finalizacoes} b={j?.home.shots} />
      <Numero rotulo="no gol" a={tel.casa.noGol} b={j?.home.shotsOnTarget} />
      <Numero rotulo="passes certos" a={tel.casa.passesCertos} b={j?.home.passes} />
      <Numero rotulo="faltas" a={tel.casa.faltas} b={j?.home.fouls} />
      <Numero rotulo="amarelos" a={tel.casa.amarelos} b={j?.home.yellows} />

      <div style={secao}>fora</div>
      <Numero rotulo="posse %" a={tel.posse.fora} b={j?.away.possession} casas={1} />
      <Numero rotulo="finalizações" a={tel.fora.finalizacoes} b={j?.away.shots} />
      <Numero rotulo="no gol" a={tel.fora.noGol} b={j?.away.shotsOnTarget} />
      <Numero rotulo="passes certos" a={tel.fora.passesCertos} b={j?.away.passes} />
      <Numero rotulo="faltas" a={tel.fora.faltas} b={j?.away.fouls} />
      <Numero rotulo="amarelos" a={tel.fora.amarelos} b={j?.away.yellows} />

      {/* Estes números não têm equivalente do outro lado: o match-engine não
          simula física. Marcados como "só 3D" para ninguém procurar o par. */}
      <div style={secao}>bola — só 3D</div>
      <Solo rotulo="velocidade" valor={`${tel.bola.velocidadeKmh.toFixed(1)} km/h`} />
      <Solo rotulo="rotação" valor={`${tel.bola.rotacaoRpm.toFixed(0)} rpm`} />
      <Solo rotulo="altura máx" valor={`${tel.bola.alturaMaximaM.toFixed(2)} m`} />
      <Solo rotulo="percurso" valor={`${tel.bola.percursoM.toFixed(1)} m`} />
      <Solo rotulo="subpassos" valor={`${tel.bola.subpassos}/quadro`} />
      <Solo rotulo="passos totais" valor={String(tel.passos)} />

      {!j && (
        <div style={{ ...vazio, marginTop: 8 }}>
          sem match-engine ligado — só a coluna 3D tem dados
        </div>
      )}
    </div>
  )
}

function Linha({ rotulo, a, b, alerta }: { rotulo: string; a: string; b: string; alerta?: boolean }) {
  return (
    <div style={{ ...linha, color: alerta ? "#ff6a12" : undefined }}>
      <span style={rot}>{rotulo}</span>
      <span style={col}>{a}</span>
      <span style={col}>{b}</span>
      <span style={{ ...col, color: "#4a5766" }}>{alerta ? "≠" : ""}</span>
    </div>
  )
}

function Numero({
  rotulo,
  a,
  b,
  casas = 0,
}: {
  rotulo: string
  a: number
  b: number | undefined
  casas?: number
}) {
  const temPar = b !== undefined
  const delta = temPar ? a - b : 0
  // Só destaca divergência que importa: posse oscila naturalmente, então
  // tolerância maior onde o número é percentual.
  const tolerancia = casas > 0 ? 5 : 0
  const diverge = temPar && Math.abs(delta) > tolerancia

  return (
    <div style={linha}>
      <span style={rot}>{rotulo}</span>
      <span style={{ ...col, color: "#ffb020" }}>{a.toFixed(casas)}</span>
      <span style={{ ...col, color: "#8fd6ff" }}>{temPar ? b.toFixed(casas) : "—"}</span>
      <span style={{ ...col, color: diverge ? "#ff6a12" : "#4a5766" }}>
        {temPar ? (delta > 0 ? "+" : "") + delta.toFixed(casas) : ""}
      </span>
    </div>
  )
}

function Solo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div style={linha}>
      <span style={rot}>{rotulo}</span>
      <span style={{ ...col, gridColumn: "2 / span 3", textAlign: "left", color: "#ffb020" }}>
        {valor}
      </span>
    </div>
  )
}

const caixa: React.CSSProperties = {
  background: "rgba(9,13,18,.92)",
  border: "1px solid rgba(255,255,255,.08)",
  padding: "10px 12px 12px",
  minWidth: 300,
  fontFamily: "'JetBrains Mono','SF Mono',Consolas,monospace",
  fontSize: 11,
  color: "#f3f6f8",
}
const titulo: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: ".24em",
  textTransform: "uppercase",
  color: "#7f8d9e",
  marginBottom: 8,
}
const cabecalho: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 56px 56px 44px",
  fontSize: 9,
  letterSpacing: ".14em",
  textTransform: "uppercase",
  paddingBottom: 4,
  borderBottom: "1px solid rgba(255,255,255,.08)",
  textAlign: "right",
}
const linha: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 56px 56px 44px",
  padding: "3px 0",
  fontVariantNumeric: "tabular-nums",
  textAlign: "right",
}
const rot: React.CSSProperties = { textAlign: "left", color: "#7f8d9e", fontSize: 10 }
const col: React.CSSProperties = { textAlign: "right" }
const secao: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: ".2em",
  textTransform: "uppercase",
  color: "#4a5766",
  marginTop: 8,
  marginBottom: 2,
}
const vazio: React.CSSProperties = { color: "#4a5766", fontSize: 10, padding: "6px 0" }
