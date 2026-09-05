"use client"

// A TROCA DE MÃOS — a tela que aparece quando uma pessoa levanta e outra senta.
//
// ⚠️ ISTO NÃO É ENFEITE: É A INVARIANTE 3 ACONTECENDO DE VERDADE.
//
// "Nenhum técnico vê o elenco do outro" era garantido no MODELO — cada um tem
// seu bolso de estado (ver `lib/chaveamento-de-tecnico.ts`). Mas na prática a
// troca era instantânea: o jogo saía da tela do técnico que fechou e entrava na
// do próximo, com o elenco, o caixa e as negociações dele já desenhados. Quem
// estava de pé atrás da cadeira via tudo. A garantia existia no save e não na
// sala, que é onde o hot-seat acontece.
//
// Esta tela é OPACA e BLOQUEIA: nada do jogo aparece atrás dela, e ela só sai
// quando a pessoa certa confirma que é ela. É a fronteira de privacidade real.
//
// Também é o único lugar que responde "e agora, de quem é a vez?" sem obrigar
// ninguém a caçar a informação num menu.

import { useEffect, useState } from "react"
import { ArrowRight, Check, Lock } from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import { getTeamByShort, getTeamByFileKey } from "@/lib/teams-data"
import type { TecnicoDoSave } from "@/lib/tecnicos-do-save"

export interface PassagemDeVezProps {
  /** Quem assume o computador agora. */
  para: TecnicoDoSave
  /** Quem acabou de fechar as decisões. `null` quando a rodada acabou de rodar. */
  de: TecnicoDoSave | null
  rodada: number
  /** Quantos já fecharam / total, para a mesa saber onde está. */
  fecharam: number
  total: number
  /** A rodada rodou e uma nova começou. */
  novaRodada?: boolean
  onConfirmar: () => void
}

export function PassagemDeVez({
  para, de, rodada, fecharam, total, novaRodada = false, onConfirmar,
}: PassagemDeVezProps) {
  const time = para.clubeFileKey
    ? getTeamByFileKey(para.clubeFileKey) ?? getTeamByShort(para.clubeCurto ?? "")
    : getTeamByShort(para.clubeCurto ?? "")

  // ⚠️ ATRASO PROPOSITAL. Sem ele, quem estava com o dedo no "Avançar" confirma
  // a própria passagem por inércia — o clique do avanço cai neste botão — e a
  // tela de privacidade não protege nada. Um segundo é curto para quem trocou
  // de cadeira e longo o bastante para o clique repetido não passar.
  const [liberado, setLiberado] = useState(false)
  useEffect(() => {
    setLiberado(false)
    const t = setTimeout(() => setLiberado(true), 1000)
    return () => clearTimeout(t)
  }, [para.id, rodada])

  // Enter confirma, mas só depois de liberar — mesma razão do atraso.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Enter" && liberado) { e.preventDefault(); onConfirmar() }
    }
    window.addEventListener("keydown", aoTeclar)
    return () => window.removeEventListener("keydown", aoTeclar)
  }, [liberado, onConfirmar])

  // ⚠️ A COR DO CLUBE NÃO PODE PINTAR O BOTÃO. Testado com o Botafogo: preto e
  // branco viraram um botão cinza de texto escuro sobre fundo escuro — e o mesmo
  // vale para qualquer clube de paleta escura, que são muitos. A ação usa a cor
  // do TEMA (`var(--brand)`, nunca chumbada — ver o tema do jogo) e o clube fica
  // só no halo de fundo, onde tom nenhum atrapalha a leitura.
  const cor1 = time?.cor1 || "#2b3442"
  const cor2 = time?.cor2 || "#1b2130"

  return (
    // z-[200] fica ACIMA do cabeçalho (z-30) e dos modais (z-100): se o jogo
    // aparecer por baixo em qualquer canto, a tela deixou de cumprir a função.
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#05070b] px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="passagem-titulo"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-[background] duration-700"
        style={{
          background:
            `radial-gradient(60% 50% at 50% 22%, ${cor1}26 0%, transparent 70%),`
            + ` radial-gradient(50% 40% at 50% 88%, ${cor2}1a 0%, transparent 70%)`,
        }}
      />

      <div className="relative flex w-full max-w-md flex-col items-center text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[.2em] text-white/50">
          <Lock className="h-3 w-3" />
          {novaRodada ? `Rodada ${rodada} · começou` : `Rodada ${rodada}`}
        </span>

        {de && (
          <p className="mt-6 text-sm text-white/45">
            <strong className="font-semibold text-white/70">{de.nome}</strong> fechou as decisões.
            {" "}Elas ficaram guardadas.
          </p>
        )}
        {novaRodada && !de && (
          <p className="mt-6 text-sm text-white/45">
            Todos fecharam e a rodada foi disputada.
          </p>
        )}

        <p id="passagem-titulo" className="mt-7 text-[11px] font-black uppercase tracking-[.3em] text-white/35">
          Passe o computador para
        </p>
        <h1 className="uf-heading mt-2 text-4xl font-black leading-tight text-white">{para.nome}</h1>

        <div className="mt-7 flex flex-col items-center gap-3">
          <TeamCrest team={time ?? undefined} teamShort={para.clubeCurto ?? undefined} fileKey={para.clubeFileKey} size="2xl" />
          <div>
            <p className="text-lg font-bold text-white">{para.clubeNome ?? time?.nome ?? para.clubeCurto}</p>
            {(para.paisNome || para.ligaLabel) && (
              <p className="mt-0.5 text-xs text-white/40">
                {[para.paisNome, para.ligaLabel].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>

        {/* ⚠️ NENHUM DADO DE CLUBE AQUI. Elenco, caixa, tabela e próximo jogo
            ficam de fora de propósito: esta tela é vista por quem está SAINDO,
            e mostrar o clube de quem entra devolveria pela janela a informação
            que a porta acabou de fechar. Escudo e nome bastam para saber de quem
            é a vez. */}

        <div className="mt-8 w-full">
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-500"
              style={{ width: `${Math.round((fecharam / Math.max(1, total)) * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-white/40">
            {fecharam} de {total} técnicos fecharam esta rodada
          </p>
        </div>

        <button
          onClick={onConfirmar}
          disabled={!liberado}
          autoFocus
          className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] text-sm font-black uppercase tracking-[.12em] text-[var(--brand-ink)] transition-all active:scale-[0.98] disabled:opacity-40"
        >
          {liberado ? <Check className="h-4 w-4" /> : null}
          Sou {para.nome}, continuar
          {liberado ? <ArrowRight className="h-4 w-4" /> : null}
        </button>
        <p className="mt-3 text-[11px] text-white/25">
          {liberado ? "Enter também continua" : "aguarde um instante…"}
        </p>
      </div>
    </div>
  )
}
