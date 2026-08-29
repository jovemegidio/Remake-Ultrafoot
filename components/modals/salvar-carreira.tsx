"use client"

// O DIALOGO DE SALVAR, COM NOME (1.0.380).
//
// ⚠️ O QUE MUDOU. O disquete do cabecalho gravava em silencio: o jogador clicava,
// via um "check" verde por dois segundos e nao ficava sabendo NEM o que tinha
// sido gravado NEM sob que nome. Quem tem varias carreiras — e a tela de
// carregar mostra doze — nao tinha como distinguir uma da outra na hora de
// voltar.
//
// ⚠️ O CAMPO `saveName` JA EXISTIA no save desde sempre, com o padrao "Carreira
// principal", e a tela de carregar ja o exibia. So NAO havia por onde escreve-lo
// fora da tela `/salvar`. E o padrao recorrente deste projeto: o sistema esta
// pronto e a interface nao alcanca.
//
// O QUE ISTO FAZ MELHOR QUE PEDIR O NOME E PRONTO:
//
//   1. MOSTRA O QUE ESTA SENDO GRAVADO — escudo, clube, tecnico, temporada e
//      data. Nomear um save as cegas e como etiquetar caixa fechada.
//   2. SUGERE UM NOME DO CONTEXTO. O jogo sabe a temporada, o mes e o clube;
//      obrigar a digitar "Inter de Limeira - Janeiro 2026" quando ele pode
//      oferecer isso e trabalho que a maquina deveria fazer.
//   3. LEMBRA O NOME ATUAL e o deixa selecionado: quem so quer sobrescrever
//      aperta Enter e acabou — dois toques, nao seis.
//
// ⚠️ NAO HA "SALVAR COMO COPIA" AQUI, E E DE PROPOSITO. Cada carreira tem o
// proprio universo de ~43 MB em disco, e `limparUniversosDeOutrasCarreiras`
// mantem apenas o da carreira ATIVA. Uma copia ou herdaria um universo que sera
// apagado na proxima troca — mudando o mundo da carreira original quando ela
// fosse reaberta —, ou exigiria duplicar 43 MB, que e exatamente o inchaco que
// `qa:universo` existe para impedir. Ramificar save exige antes resolver a
// posse do universo; ate la, prometer a copia seria vender o que quebra.

import { useEffect, useRef, useState } from "react"
import { Loader2, Save, X } from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// ⚠️ NADA DE LISTA DE MESES CHUMBADA AQUI. A primeira versao deste arquivo
// trazia os doze nomes em portugues — e a catraca de traducao reprovou o build
// na hora (5497 -> 5515). Ela estava certa: nome de mes e texto que o jogador
// LE, e este jogo se propoe a falar 126 idiomas. `Intl` resolve sem chave e sem
// lista, seguindo o idioma do sistema.
const mesLongo = (d: Date) => d.toLocaleDateString(undefined, { month: "long" })
const mesCurto = (d: Date) => d.toLocaleDateString(undefined, { month: "short" })

export interface DadosDoSalvamento {
  nomeAtual: string
  clube: string
  clubeCurto: string
  clubeFileKey?: string
  tecnico: string
  temporada: number
  data: Date
  semana: number
}

interface Props {
  dados: DadosDoSalvamento
  salvando: boolean
  erro?: string
  onSalvar: (nome: string) => void
  onFechar: () => void
}

export function DialogoDeSalvar({ dados, salvando, erro, onSalvar, onFechar }: Props) {
  const t = useTranslation()
  const [nome, setNome] = useState(dados.nomeAtual)
  const campo = useRef<HTMLInputElement>(null)

  // Abre com o nome atual JA SELECIONADO: sobrescrever e o caso comum, e quem
  // quiser trocar digita por cima sem apagar nada antes.
  useEffect(() => {
    campo.current?.focus()
    campo.current?.select()
  }, [])

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar() }
    window.addEventListener("keydown", aoTeclar)
    return () => window.removeEventListener("keydown", aoTeclar)
  }, [onFechar])

  const mes = mesLongo(dados.data)
  const sugestoes = [
    `${dados.clube} — ${mes} de ${dados.temporada}`,
    `${dados.clube} — temporada ${dados.temporada}`,
    `${dados.clube} — semana ${dados.semana}`,
  ].filter((s, i, a) => a.indexOf(s) === i && s !== nome)

  const confirmar = () => {
    const limpo = nome.trim()
    if (!limpo || salvando) return
    onSalvar(limpo)
  }

  return (
    <div
      className="fixed inset-0 z-[9999] grid place-items-center bg-[#020407]/70 p-5"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[420px] overflow-hidden rounded-xl border border-white/10 bg-[#0b0d12] shadow-2xl"
      >
        <header className="flex items-center gap-2.5 border-b border-white/[0.07] px-4 py-3">
          <Save className="h-4 w-4 text-[var(--brand)]" />
          <h2 className="flex-1 text-sm font-bold text-white">{t.header.salvar_carreira}</h2>
          <button
            onClick={onFechar}
            aria-label={t.header.fechar}
            className="rounded-md p-1 text-white/40 transition-colors hover:bg-white/5 hover:text-white/80"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* O QUE ESTA SENDO GRAVADO. Sem isto o jogador nomeia caixa fechada. */}
        <div className="flex items-center gap-3 border-b border-white/[0.07] bg-white/[0.02] px-4 py-3">
          <TeamCrest teamShort={dados.clubeCurto} fileKey={dados.clubeFileKey} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-white">{dados.clube}</p>
            <p className="truncate text-[11px] text-white/45">
              {dados.tecnico} · {t.header.temporada_curta} {dados.temporada} · {dados.data.getDate()} {mesCurto(dados.data)}
            </p>
          </div>
        </div>

        <div className="px-4 py-4">
          <label htmlFor="nome-do-save" className="mb-1.5 block text-[11px] font-semibold text-white/50">
            {t.header.nome_do_save}
          </label>
          <input
            id="nome-do-save"
            ref={campo}
            value={nome}
            onChange={e => setNome(e.target.value.slice(0, 60))}
            onKeyDown={e => { if (e.key === "Enter") confirmar() }}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[var(--brand)]/60"
          />

          {sugestoes.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {sugestoes.map(s => (
                <button
                  key={s}
                  onClick={() => setNome(s)}
                  className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-white/50 transition-colors hover:border-[var(--brand)]/40 hover:text-white/85"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {erro && <p className="mt-3 text-[11px] text-red-300">{erro}</p>}
        </div>

        <footer className="flex gap-2 border-t border-white/[0.07] px-4 py-3">
          <button
            onClick={onFechar}
            className="flex-1 rounded-lg border border-white/10 py-2 text-xs font-semibold text-white/70 transition-colors hover:bg-white/5"
          >
            {t.header.cancelar}
          </button>
          <button
            onClick={confirmar}
            disabled={salvando || !nome.trim()}
            className={cn(
              "flex flex-[1.4] items-center justify-center gap-2 rounded-lg py-2 text-xs font-black transition-opacity",
              "bg-[var(--brand)] text-[#04120e] disabled:opacity-40",
            )}
          >
            {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t.header.salvar}
          </button>
        </footer>
      </div>
    </div>
  )
}
