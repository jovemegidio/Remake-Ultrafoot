"use client"

// MERCADO DE JUNIORES — agora dentro do Mercado, no formato de Buscar Atletas.
//
// Antes vivia no pé da tela da Categoria de Base, como uma lista simples: para
// comparar dois garotos era preciso rolar a página inteira, e os filtros ficavam
// longe do resultado. Aqui ele ganha o mesmo par lista+ficha da aba Buscar, que é
// onde o técnico já está acostumado a avaliar atleta.
//
// A COMPRA continua sendo a mesma operação da base (caixa do motor, vaga na
// academia, registro em `youthMarketPurchasedIds`): quem compra entra direto na
// categoria de base, não no elenco profissional.

import { useCallback, useMemo, useState } from "react"
import { Search, ShoppingCart, Sprout, Users, Briefcase } from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
// Este painel só lê `nome`/`fileKey`, então o ÍNDICE (0,88 MB) basta. Antes ele
// puxava o seed completo de 8,91 MB só por isso. Ver `lib/pool-elencos.ts`.
import importedBF from "@/data/seeds/imported-bf2026-index.json"
import { estimarPotencial, faixaDeCpe, rotuloDaAvaliacao } from "@/lib/cpe"

// ─── ESCUDO DO CLUBE FORMADOR QUANDO ELE NAO E CURADO ────────────────────────
//
// ⚠️ Relato: "diversos clubes estao com seus escudos desenhados em vez do escudo
// real". `getTeamByName` so varre a lista CURADA (allTeams); as promessas vem de
// clubes do POOL, que sao ~2.994 e nao estao la. Sem achar, o TeamCrest caia no
// desenho de iniciais.
//
// O pool tem `fileKey` em todos os clubes, e o TeamCrest resolve escudo por
// fileKey — inclusive o importado no editor. Basta traduzir nome -> fileKey.
const POOL_POR_NOME: Map<string, string> = (() => {
  const mapa = new Map<string, string>()
  const norm = (s: string) =>
    (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")
  for (const t of ((importedBF as { teams?: { nome?: string; fileKey?: string }[] }).teams) ?? []) {
    const k = norm(t.nome ?? "")
    if (k && t.fileKey && !mapa.has(k)) mapa.set(k, t.fileKey)
  }
  return mapa
})()

function fileKeyDoPool(nome?: string | null): string | undefined {
  if (!nome) return undefined
  return POOL_POR_NOME.get(nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""))
}
import { getTeamByName } from "@/lib/teams-data"
import { formatCurrency } from "@/lib/currency"
import { cn } from "@/lib/utils"
import type { SquadPlayer } from "@/lib/save-system"
import {
  agenteDoJovem, comissaoEmReais, ROTULO_PERFIL, DESCRICAO_PERFIL,
} from "@/lib/agente-do-jovem"

const POSICOES = ["todas", "GOL", "ZAG", "LD", "LE", "VOL", "MEI", "PD", "PE", "ATA"] as const

interface Props {
  /** Promessas disponíveis (já sem as compradas). */
  prospectos: SquadPlayer[]
  /**
   * O quanto o clube enxerga de talento (0-100). Entra o CPE no lugar do
   * potencial real — ver lib/cpe.ts. Sem departamento montado, o número que a
   * tela mostra pode estar bem longe do que o garoto vai virar.
   */
  qualidadeDeAvaliacao?: number
  /** Vagas livres na categoria de base. */
  vagas: number
  capacidade: number
  naBase: number
  saldo: number
  onComprar: (jovem: SquadPlayer) => void
}

export function MercadoJunioresPanel({ prospectos, vagas, capacidade, naBase, saldo, onComprar, qualidadeDeAvaliacao = 20 }: Props) {
  const [busca, setBusca] = useState("")
  const [pos, setPos] = useState<string>("todas")
  const [idadeMax, setIdadeMax] = useState(21)
  const [overallMin, setOverallMin] = useState(0)
  const [potencialMin, setPotencialMin] = useState(0)
  const [precoMax, setPrecoMax] = useState(0)
  const [selecionado, setSelecionado] = useState<SquadPlayer | null>(null)
  const cpeDe = useCallback(
    (id: string | number, potencial: number) => estimarPotencial(id, potencial, qualidadeDeAvaliacao),
    [qualidadeDeAvaliacao],
  )

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return prospectos.filter(p => {
      if (pos !== "todas" && p.position !== pos) return false
      if ((p.age ?? 0) > idadeMax) return false
      if ((p.overall ?? 0) < overallMin) return false
      // Pelo CPE, não pelo potencial real: filtrar pelo dado verdadeiro daria um
      // raio-x do mercado — "potencial mínimo 90" listaria os craques escondidos.
      if (potencialMin > 0 && cpeDe(p.id, p.potential ?? 0).valor < potencialMin) return false
      if (precoMax > 0 && (p.value ?? 0) > precoMax) return false
      if (termo && !p.name.toLowerCase().includes(termo) && !(p.fromTeam ?? "").toLowerCase().includes(termo)) return false
      return true
    })
  }, [prospectos, pos, idadeMax, overallMin, potencialMin, precoMax, busca, cpeDe])

  // A ficha aberta segue a lista: se o filtro tirou o escolhido, mostra o primeiro.
  const alvo = useMemo(() => {
    if (selecionado && filtrados.some(p => p.id === selecionado.id)) return selecionado
    return filtrados[0] ?? null
  }, [selecionado, filtrados])

  // Agente do atleta em foco. Determinístico pelo id: reabrir a tela não sorteia
  // um empresário mais camarada.
  const agente = useMemo(
    () => (alvo ? agenteDoJovem(alvo.id, alvo.potential ?? 70) : null),
    [alvo],
  )
  // Clube formador resolvido pelo NOME (e o que o prospecto guarda).
  const clubeFormador = useMemo(
    () => (alvo?.fromTeam ? getTeamByName(alvo.fromTeam) : undefined),
    [alvo?.fromTeam],
  )
  const comissao = alvo && agente ? comissaoEmReais(alvo.value ?? 0, agente) : 0
  // O caixa precisa cobrir o pedido do clube MAIS a comissão.
  const custoTotal = (alvo?.value ?? 0) + comissao
  const podeComprar = alvo != null && vagas > 0 && saldo >= custoTotal

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Filtros — mesma barra da aba Buscar */}
      <div className="mb-4 shrink-0 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome do atleta ou clube formador..."
              className="w-full rounded-lg border border-white/10 bg-black/40 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-[var(--brand)]/50"
            />
          </div>
          <select
            value={pos}
            onChange={(e) => setPos(e.target.value)}
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--brand)]/50"
          >
            {POSICOES.map(p => (
              <option key={p} value={p}>{p === "todas" ? "Todas as posições" : p}</option>
            ))}
          </select>
          <NumeroFiltro rotulo="Idade até" valor={idadeMax} onChange={setIdadeMax} />
          <NumeroFiltro rotulo="Overall mín" valor={overallMin} onChange={setOverallMin} />
          <NumeroFiltro rotulo="Potencial mín" valor={potencialMin} onChange={setPotencialMin} />
          <NumeroFiltro rotulo="Preço até (mi)" valor={precoMax / 1_000_000} onChange={(v) => setPrecoMax(v * 1_000_000)} />
          <button
            type="button"
            onClick={() => { setBusca(""); setPos("todas"); setIdadeMax(21); setOverallMin(0); setPotencialMin(0); setPrecoMax(0) }}
            className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/55 hover:border-white/25 hover:text-white"
          >
            Limpar filtros
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-white/45">
          <span>{filtrados.length} de {prospectos.length} promessas</span>
          <span className="flex items-center gap-1.5">
            <Sprout className="h-3.5 w-3.5" />
            base: {naBase}/{capacidade}
            <span className={cn("font-semibold", vagas > 0 ? "text-[var(--brand)]" : "text-red-400")}>
              {vagas} vaga{vagas === 1 ? "" : "s"}
            </span>
          </span>
          <span>caixa: {formatCurrency(saldo)}</span>
        </div>
      </div>

      {/* Lista + ficha, como em Buscar Atletas */}
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-4">
        <div className="col-span-12 min-h-0 overflow-y-auto rounded-xl border border-white/[0.06] bg-white/[0.02] scrollbar-thin lg:col-span-7">
          {filtrados.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <Users className="mb-3 h-10 w-10 text-white/20" />
              <p className="text-white/55">Nenhuma promessa com esses filtros.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {filtrados.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelecionado(p)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                    alvo?.id === p.id ? "bg-[var(--brand)]/10" : "hover:bg-white/[0.04]",
                  )}
                >
                  <span className="w-9 shrink-0 text-center text-lg font-bold text-white">{p.overall}</span>
                  <span className="w-11 shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-center text-[10px] font-semibold text-white/70">
                    {p.position}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">{p.name}</span>
                    <span className="block truncate text-[11px] text-white/40">
                      {p.age} anos · {p.fromTeam ?? "Clube formador"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-xs font-semibold text-[var(--brand)]">CPE {faixaDeCpe(cpeDe(p.id, p.potential ?? 0))}</span>
                    <span className="block text-[11px] text-white/50">{formatCurrency(p.value ?? 0)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ficha do atleta */}
        <div className="col-span-12 min-h-0 overflow-y-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 scrollbar-thin lg:col-span-5">
          {alvo == null ? (
            <p className="text-sm text-white/40">Escolha uma promessa na lista.</p>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-xl font-bold text-white">
                  {alvo.overall}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-bold text-white">{alvo.name}</p>
                  <p className="text-sm text-white/50">
                    {alvo.position} · {alvo.age} anos · CPE <span className="text-[var(--brand)]">{faixaDeCpe(cpeDe(alvo.id, alvo.potential ?? 0))}</span>
                  </p>
                </div>
                {/* ESCUDO DO CLUBE FORMADOR. `fromTeam` e o NOME ("Palmeiras"), e o
                    TeamCrest espera a SIGLA — passando o nome ele nao acha nada e
                    desenha o placeholder de iniciais ("Pal"), que foi o relato.
                    Resolvemos o Team pelo nome e passamos o objeto, que e o
                    caminho que carrega file_key e escudo importado. */}
                {clubeFormador
                  ? <TeamCrest team={clubeFormador} size="md" />
                  : fileKeyDoPool(alvo.fromTeam)
                    ? <TeamCrest fileKey={fileKeyDoPool(alvo.fromTeam)!} size="md" />
                    : alvo.fromTeam ? <TeamCrest teamShort={alvo.fromTeam} size="md" /> : null}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <Atributo rotulo="VEL" valor={alvo.pace} />
                <Atributo rotulo="FIN" valor={alvo.shooting} />
                <Atributo rotulo="PAS" valor={alvo.passing} />
                <Atributo rotulo="DRI" valor={alvo.dribbling} />
                <Atributo rotulo="DEF" valor={alvo.defending} />
                <Atributo rotulo="FÍS" valor={alvo.physical} />
              </div>

              <div className="mt-4 space-y-1.5 rounded-lg border border-white/[0.06] bg-black/20 p-3 text-sm">
                <Linha rotulo="Clube formador" valor={alvo.fromTeam ?? "—"} />
                <Linha rotulo="Pedido do clube" valor={formatCurrency(alvo.value ?? 0)} destaque />
                <Linha rotulo="Margem de evolução" valor={`+${Math.max(0, cpeDe(alvo.id, alvo.potential ?? 0).valor - (alvo.overall ?? 0))}`} />
                <Linha rotulo="Confiança do relatório" valor={rotuloDaAvaliacao(qualidadeDeAvaliacao)} />
              </div>

              {/* AGENTE — a compra deixou de ser um botão. A comissão entra POR
                  FORA do pedido do clube, como no futebol de verdade, e é isso
                  que faz a conta doer mais do que o valor anunciado. */}
              {agente && (
                <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-white/40">
                      <Briefcase className="h-3.5 w-3.5" /> Empresário
                    </span>
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold",
                      agente.perfil === "tubarao" ? "bg-red-500/15 text-red-300"
                        : agente.perfil === "duro" ? "bg-amber-500/15 text-amber-300"
                          : "bg-[var(--brand)]/15 text-[var(--brand)]")}>
                      {ROTULO_PERFIL[agente.perfil]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-white/85">{agente.nome}</p>
                  <p className="text-[11px] text-white/40">{DESCRICAO_PERFIL[agente.perfil]}</p>
                  <div className="mt-2 space-y-1 border-t border-white/[0.06] pt-2 text-sm">
                    <Linha rotulo={`Comissão (${(agente.comissao * 100).toFixed(0)}%)`} valor={formatCurrency(comissao)} />
                    <Linha rotulo="Custo total" valor={formatCurrency((alvo.value ?? 0) + comissao)} destaque />
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={!podeComprar}
                onClick={() => onComprar(alvo)}
                className={cn(
                  "mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all",
                  podeComprar
                    ? "bg-[var(--brand)] text-[var(--brand-ink)] hover:brightness-110"
                    : "cursor-not-allowed bg-white/[0.06] text-white/30",
                )}
              >
                <ShoppingCart className="h-4 w-4" />
                {vagas <= 0
                  ? "Categoria de base lotada"
                  : saldo < custoTotal
                    ? `Saldo insuficiente (faltam ${formatCurrency(custoTotal - saldo)})`
                    : `Negociar — ${formatCurrency(custoTotal)} no total`}
              </button>
              <p className="mt-2 text-[11px] text-white/35">
                O empresário pode pedir mais. O atleta entra na base, não no elenco profissional.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function NumeroFiltro({ rotulo, valor, onChange }: { rotulo: string; valor: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2.5">
      <span className="whitespace-nowrap text-xs text-white/40">{rotulo}</span>
      <input
        type="number"
        min={0}
        value={valor}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
        className="w-14 bg-transparent text-sm text-white outline-none"
      />
    </label>
  )
}

function Atributo({ rotulo, valor }: { rotulo: string; valor?: number }) {
  return (
    <div className="rounded-lg bg-white/[0.04] px-2 py-1.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-white/40">{rotulo}</p>
      <p className="text-sm font-semibold text-white">{valor ?? "—"}</p>
    </div>
  )
}

function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/45">{rotulo}</span>
      <span className={cn("truncate font-medium", destaque ? "text-[var(--brand)]" : "text-white/80")}>{valor}</span>
    </div>
  )
}
