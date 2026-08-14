"use client"

// CAMPO TATICO + ESTADIO + BILHETERIA — o que faltava na prancheta.
//
// Antes de decidir, o tecnico via uma LISTA de nomes e tres caixinhas de
// contagem. Faltava o que qualquer jogo de gestao mostra nesse momento: onde os
// onze estao no campo, onde a partida acontece e quanto ela rende na porteira.
//
// Tudo derivado do que ja existe — nenhum dado novo no save:
//   • formacao   -> `useGameEngine().formation` ("4-3-3")
//   • estadio    -> `getTeamStadiumBackground` (acervo public/stadiums)
//   • bilheteria -> capacidade x ocupacao estimada x preco medio

import Image from "next/image"
import { Building2, Users, Ticket, Banknote } from "lucide-react"
import { getTeamStadiumBackground } from "@/lib/pre-match-bg"
import type { Team } from "@/lib/teams-data"
import { formatCurrency, formatNumber } from "@/lib/currency"
import { cn } from "@/lib/utils"

interface Atleta {
  id: number
  name: string
  position: string
  overall: number
}

/**
 * Distribui os titulares nas linhas da formacao.
 *
 * A formacao vem como texto ("4-3-3", "4-2-3-1"), entao o desenho acompanha
 * QUALQUER formacao que o motor aceite — inclusive as de quatro linhas — sem
 * uma tabela de coordenadas por formacao para manter em sincronia.
 */
export function linhasDaFormacao(formacao: string, titulares: Atleta[]): Atleta[][] {
  const numeros = (formacao || "4-3-3").split("-").map(n => Number(n.trim())).filter(n => n > 0)
  const goleiro = titulares.find(p => p.position === "GOL")
  const linha = titulares.filter(p => p !== goleiro)

  const saida: Atleta[][] = [goleiro ? [goleiro] : []]
  let i = 0
  for (const qtd of numeros) {
    saida.push(linha.slice(i, i + qtd))
    i += qtd
  }
  // Sobrou gente (formacao com menos vagas que titulares)? Vai para a ultima
  // linha em vez de sumir da tela — melhor mostrar demais do que esconder.
  if (i < linha.length) saida[saida.length - 1] = [...saida[saida.length - 1], ...linha.slice(i)]
  return saida
}

/**
 * Publico e receita esperados.
 *
 * ⚠️ Nao reaproveitei `bilheteriaEstimada` de `lib/amistosos-negociacao`: aquela
 * e calibrada para AMISTOSO, onde quem enche o estadio e o visitante e a
 * ocupacao parte de 10%. Em jogo oficial a torcida da casa e quem sustenta o
 * publico, e um classico contra adversario grande lota. Usar a formula do
 * amistoso aqui subestimaria a receita de todo jogo de campeonato.
 */
export function bilheteriaDoJogo(mandante: Team, visitante: Team): {
  publico: number
  ingresso: number
  receita: number
  ocupacao: number
} {
  const capacidade = Math.max(0, mandante.estadio_cap ?? 0)
  if (capacidade === 0) return { publico: 0, ingresso: 0, receita: 0, ocupacao: 0 }

  // A torcida da casa sustenta a base; satura pela capacidade.
  const daTorcida = Math.max(0.25, Math.min(1, (mandante.torcida ?? 0) / Math.max(1, capacidade * 25)))
  // Adversario grande puxa publico — e o que faz um classico lotar.
  const atracao = Math.max(0, Math.min(1, ((visitante.prestigio ?? 50) - 30) / 60))
  const ocupacao = Math.max(0.20, Math.min(0.99, 0.30 + 0.45 * daTorcida + 0.30 * atracao))
  const publico = Math.round(capacidade * ocupacao)
  // Ingresso medio acompanha o porte dos dois clubes.
  const ingresso = Math.round(
    35 + Math.max(0, (mandante.prestigio ?? 50) - 45) * 1.6 + Math.max(0, (visitante.prestigio ?? 50) - 45) * 1.1,
  )
  return { publico, ingresso, receita: publico * ingresso, ocupacao }
}

export function CampoEBilheteria({
  formacao,
  titulares,
  mandante,
  visitante,
  souMandante,
  nomeEstadio,
}: {
  formacao: string
  titulares: Atleta[]
  mandante: Team
  visitante: Team
  souMandante: boolean
  nomeEstadio?: string
}) {
  const linhas = linhasDaFormacao(formacao, titulares)
  // Casa pelo NOME do clube e pelo NOME do estádio — o acervo tem entradas pelos
  // dois, e passar o estádio primeiro resolve clubes que dividem arena.
  const estadio = getTeamStadiumBackground(mandante.nome, nomeEstadio || mandante.estadio_nome)
  const { publico, ingresso, receita, ocupacao } = bilheteriaDoJogo(mandante, visitante)

  return (
    <div className="space-y-3">
      {/* ── CAMPO ────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#0a2a14]">
        {/* Faixas do gramado + linhas do campo, em CSS: nenhuma imagem para baixar. */}
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{ backgroundImage: "repeating-linear-gradient(180deg,#12331c 0 26px,#0e2a17 26px 52px)" }}
        />
        {/* ⚠️ MARCACOES DE CAMPO VERTICAL — o mesmo eixo dos jogadores.
            Eu tinha desenhado a linha de meio de campo em pe (`w-px` cortando de
            cima a baixo), que e o traçado de um campo HORIZONTAL, enquanto as
            linhas de atletas sao empilhadas de baixo para cima — campo VERTICAL.
            O gramado dizia uma coisa e a escalacao outra. Agora a linha de meio e
            deitada, e as duas areas ficam atras de cada gol. */}
        <div className="absolute inset-3 rounded-md border border-white/15" />
        <div className="absolute left-3 right-3 top-1/2 h-px -translate-y-1/2 bg-white/12" />
        <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/12" />
        {/* Grande area de cada lado (o gol do time fica embaixo). */}
        <div className="absolute bottom-3 left-1/2 h-9 w-1/2 -translate-x-1/2 rounded-b-md border border-b-0 border-white/12" />
        <div className="absolute top-3 left-1/2 h-9 w-1/2 -translate-x-1/2 rounded-t-md border border-t-0 border-white/12" />

        {/* `pt-9` abre espaço para o selo da formação — antes ele caía por cima
            da linha de ataque. `gap-3` separa as linhas: com `gap-1` o nome de
            uma linha encostava no número da seguinte. */}
        <div className="relative flex min-h-[260px] flex-col-reverse justify-between gap-3 p-4 pt-9">
          {linhas.map((linhaAtletas, i) => (
            <div key={i} className="flex items-start justify-evenly gap-0.5">
              {linhaAtletas.map(p => (
                <div
                  key={p.id}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1"
                  title={`${p.name} — ${p.position} · ${p.overall}`}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-black tabular-nums",
                      "shadow-[0_2px_8px_rgba(0,0,0,0.55)] ring-1 ring-black/25",
                      p.overall >= 80 ? "bg-[var(--brand)] text-[#050508]"
                        : p.overall >= 70 ? "bg-white text-[#050508]"
                        : "bg-white/70 text-[#050508]",
                    )}
                  >
                    {p.overall}
                  </span>
                  {/* Sombra no texto porque o gramado é claro em partes: sem ela
                      o nome sumia sobre a faixa mais clara da grama. */}
                  <span className="max-w-full truncate text-center text-[10px] font-semibold leading-none text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
                    {p.name.split(" ").at(-1)}
                  </span>
                  <span className="text-[8px] font-bold uppercase leading-none tracking-wide text-white/55 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
                    {p.position}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <span className="absolute right-3 top-3 rounded-md bg-black/65 px-2 py-1 text-[10px] font-black tracking-widest text-white/85 ring-1 ring-white/10">
          {formacao || "—"}
        </span>
      </div>

      {/* ── ESTADIO + BILHETERIA ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-xl border border-white/[0.06]">
        {estadio && (
          <Image
            src={estadio}
            alt={nomeEstadio ?? mandante.estadio_nome ?? "Estádio"}
            fill
            unoptimized
            className="object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c10] via-[#0c0c10]/85 to-[#0c0c10]/45" />

        <div className="relative p-3.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white">
            <Building2 className="h-3.5 w-3.5 text-white/50" />
            {nomeEstadio || mandante.estadio_nome || "Estádio"}
            <span className="ml-auto text-[10px] font-medium text-white/45">
              {souMandante ? "Você joga em casa" : `Mando de ${mandante.nome}`}
            </span>
          </p>

          <div className="mt-2.5 grid grid-cols-3 gap-2">
            <Metrica icone={<Users className="h-3 w-3" />} rotulo="Público" valor={formatNumber(publico)}
              nota={`${Math.round(ocupacao * 100)}% da capacidade`} />
            <Metrica icone={<Ticket className="h-3 w-3" />} rotulo="Ingresso médio" valor={formatCurrency(ingresso)} />
            <Metrica
              icone={<Banknote className="h-3 w-3" />}
              rotulo="Bilheteria"
              valor={formatCurrency(receita)}
              // Sem mando não há renda de porteira — quem recebe fica com ela.
              nota={souMandante ? "entra no seu caixa" : "vai para o mandante"}
              apagado={!souMandante}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function Metrica({ icone, rotulo, valor, nota, apagado }: {
  icone: React.ReactNode; rotulo: string; valor: string; nota?: string; apagado?: boolean
}) {
  return (
    <div className={cn("rounded-lg bg-black/45 p-2", apagado && "opacity-45")}>
      <p className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-white/40">{icone}{rotulo}</p>
      <p className="mt-0.5 text-sm font-black tabular-nums text-white">{valor}</p>
      {nota && <p className="text-[9px] leading-tight text-white/35">{nota}</p>}
    </div>
  )
}
