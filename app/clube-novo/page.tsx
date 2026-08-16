"use client"

/**
 * CRIAR O SEU PRÓPRIO CLUBE.
 *
 * Benefício de quem registrou o jogo (ver lib/beneficios). O portão é
 * `<RecursoDeRegistrado>`, e ele fica DEPOIS de todos os hooks — um `return`
 * antes da lista muda a contagem de hooks entre renders e derruba a tela com o
 * erro #310 do React, que já quebrou o escritório uma vez.
 *
 * O que esta tela NÃO oferece, de propósito: prestígio, torcida e caixa. Eles
 * saem da divisão escolhida (ver `prestigioDeClubeNovo`). Abrir esses campos
 * seria um seletor de dificuldade fantasiado de identidade — e quem quer um
 * clube rico já tem o editor de equipes.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { RecursoDeRegistrado } from "@/components/registro-necessario"
import { compressImageDataUrl } from "@/lib/image-utils"
import {
  PAISES_PARA_CLUBE_PROPRIO,
  chaveDoClubeProprio,
  excluirClubePersonalizado,
  listarClubesPersonalizados,
  prestigioDeClubeNovo,
  salvarClubePersonalizado,
  validarClubeProprio,
  type ClubePersonalizado,
} from "@/lib/clubes-personalizados"
import { sincronizarClubesProprios, divisoesParaClubeProprio, saldoDeClubeNovo } from "@/lib/clubes-proprios-runtime"
import { allPoolTeams, allTeams } from "@/lib/teams-data"
import { siglaExibivel } from "@/lib/club-identity"

type Variante = "home" | "away" | "third"
const VARIANTES: { id: Variante; rotulo: string }[] = [
  { id: "home", rotulo: "Uniforme 1" },
  { id: "away", rotulo: "Uniforme 2" },
  { id: "third", rotulo: "Uniforme 3" },
]

export default function ClubeNovoPage() {
  const router = useRouter()

  const [nome, setNome] = useState("")
  const [curto, setCurto] = useState("")
  const [cidade, setCidade] = useState("")
  const [pais, setPais] = useState("Brasil")
  const [estado, setEstado] = useState("")
  const [cor1, setCor1] = useState("#00d4ff")
  const [cor2, setCor2] = useState("#0b1220")
  const [divisao, setDivisao] = useState("divisao_acesso_br")
  const [estadioNome, setEstadioNome] = useState("")
  const [estadioCap, setEstadioCap] = useState(8000)
  const [logoUrl, setLogoUrl] = useState<string | undefined>()
  const [kits, setKits] = useState<Partial<Record<Variante, string>>>({})
  const [meus, setMeus] = useState<ClubePersonalizado[]>([])
  const [salvando, setSalvando] = useState(false)
  const [recado, setRecado] = useState<string | null>(null)

  const inputEscudo = useRef<HTMLInputElement | null>(null)
  const inputKit = useRef<HTMLInputElement | null>(null)
  const varianteAlvo = useRef<Variante>("home")

  // O registro hidrata assíncrono; sem ouvir o aviso, quem chega direto nesta
  // rota vê a lista de clubes vazia mesmo tendo criado alguns.
  useEffect(() => {
    const recarregar = () => setMeus(listarClubesPersonalizados())
    recarregar()
    window.addEventListener("ultrafoot:store:ready", recarregar)
    return () => window.removeEventListener("ultrafoot:store:ready", recarregar)
  }, [])

  /**
   * Todos os códigos curtos já ocupados — catálogo, pool e os clubes que o
   * próprio jogador criou. É o que impede duas equipes de colidirem na tabela.
   */
  const curtosEmUso = useMemo(() => {
    const usados = new Set<string>()
    for (const t of allTeams) usados.add(t.curto.toUpperCase())
    for (const t of allPoolTeams) usados.add(t.curto.toUpperCase())
    for (const c of meus) usados.add(c.curto.toUpperCase())
    return usados
  }, [meus])

  const paisEscolhido = useMemo(
    () => PAISES_PARA_CLUBE_PROPRIO.find(p => p.pais === pais) ?? PAISES_PARA_CLUBE_PROPRIO[0],
    [pais],
  )
  /** As divisões saem da PIRÂMIDE do país, nunca de uma lista escrita à mão. */
  const divisoes = useMemo(() => divisoesParaClubeProprio(pais), [pais])
  const caixaInicial = useMemo(() => saldoDeClubeNovo(), [meus])

  // Trocar de país invalida a divisão e a UF escolhidas: `serie_d` não existe na
  // Alemanha, e "ES" não é região russa. Sem isto o clube seria salvo numa
  // divisão de outro país e sumiria de todas as telas.
  useEffect(() => {
    if (!divisoes.some(d => d.id === divisao)) setDivisao(divisoes[0]?.id ?? "")
    if (paisEscolhido.ufs && !paisEscolhido.ufs.includes(estado)) setEstado("")
    if (!paisEscolhido.ufs) setEstado("")
  }, [pais, divisoes, paisEscolhido, divisao, estado])

  const problemas = useMemo(
    () => validarClubeProprio({ nome, curto, estado, estadioCap, pais }, curtosEmUso),
    [nome, curto, estado, estadioCap, pais, curtosEmUso],
  )
  const podeSalvar = nome.trim().length > 0 && curto.trim().length > 0 && problemas.length === 0

  const lerArquivo = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error("não foi possível ler o arquivo"))
      reader.readAsDataURL(file)
    })

  const aoEscolherEscudo = async (file: File | undefined) => {
    if (!file) return
    // 256 px é o mesmo teto que o editor de equipes usa para escudo. Guardar a
    // imagem original custaria alguns MB por clube no armazenamento.
    setLogoUrl(await compressImageDataUrl(await lerArquivo(file), 256))
  }

  const aoEscolherKit = async (file: File | undefined) => {
    if (!file) return
    const dataUrl = await compressImageDataUrl(await lerArquivo(file), 400)
    setKits(prev => ({ ...prev, [varianteAlvo.current]: dataUrl }))
  }

  const limpar = () => {
    setNome(""); setCurto(""); setCidade(""); setEstado("")
    setCor1("#00d4ff"); setCor2("#0b1220")
    setEstadioNome(""); setEstadioCap(8000)
    setLogoUrl(undefined); setKits({})
  }

  const salvar = async () => {
    if (!podeSalvar || salvando) return
    setSalvando(true)
    setRecado(null)
    try {
      const fileKey = chaveDoClubeProprio(nome, meus.map(c => c.fileKey))
      await salvarClubePersonalizado({
        fileKey,
        nome: nome.trim(),
        curto: curto.trim().toUpperCase(),
        cidade: cidade.trim(),
        pais,
        estado,
        cor1, cor2, divisao,
        estadioNome: estadioNome.trim() || `Estádio do ${nome.trim()}`,
        estadioCap,
        logoUrl,
        kits: {
          home: { primary: cor1, secondary: cor2, pattern: "solid", imageUrl: kits.home },
          away: { primary: cor2, secondary: cor1, pattern: "solid", imageUrl: kits.away },
          third: kits.third
            ? { primary: cor2, secondary: cor1, pattern: "solid", imageUrl: kits.third }
            : { primary: cor2, secondary: cor1, pattern: "solid", disabled: true },
        },
        criadoEm: new Date().toISOString(),
      })
      // Publica no teams-data AGORA: quem sai daqui direto para a nova carreira
      // precisa encontrar o clube na lista da divisão.
      sincronizarClubesProprios()
      window.dispatchEvent(new Event("ultrafoot:clubes-proprios:mudou"))
      setMeus(listarClubesPersonalizados())
      setRecado(`${nome.trim()} criado. Ele já aparece na ${divisoes.find(d => d.id === divisao)?.rotulo}.`)
      limpar()
    } catch (erro) {
      setRecado(erro instanceof Error ? erro.message : "não foi possível salvar o clube")
    } finally {
      setSalvando(false)
    }
  }

  const excluir = (fileKey: string) => {
    excluirClubePersonalizado(fileKey)
    sincronizarClubesProprios()
    window.dispatchEvent(new Event("ultrafoot:clubes-proprios:mudou"))
    setMeus(listarClubesPersonalizados())
  }

  return (
    // ⚠️ `h-dvh overflow-y-auto`, e não `min-h-dvh` (1.0.324).
    // O jogo tem `overflow: hidden` no `html` E no `body` (app/globals.css, na
    // camada base) para se comportar como aplicativo em tela cheia. A
    // consequência é que uma página mais alta que a janela não ganha barra de
    // rolagem: ela é simplesmente CORTADA. Esta tela tem identidade, cores,
    // escudo, uniformes, estádio e divisão — passava da altura da janela, e
    // metade do formulário ficava inalcançável (relato do usuário).
    // `min-h` não resolve: ele deixa o elemento CRESCER, e é justamente o
    // crescimento que o corte engole. É preciso ALTURA FIXA (a da janela) com
    // rolagem própria.
    <main className="h-dvh overflow-y-auto bg-background p-4 sm:p-6">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-6">
          <button
            onClick={() => router.back()}
            className="mb-3 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Voltar
          </button>
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">Seu próprio clube</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Nome, cores, escudo, uniformes e estádio. O clube entra na divisão escolhida
            e disputa acesso como qualquer outro.
          </p>
        </header>

        <RecursoDeRegistrado id="clube-proprio">
          <div className="space-y-6">
            {/* ── Identidade ─────────────────────────────────────────────── */}
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-3 font-heading text-lg font-semibold">Identidade</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Nome do clube</span>
                  <input
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    placeholder="Cariacica Futebol Clube"
                    maxLength={28}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Código curto (tabela e placar)</span>
                  <input
                    value={curto}
                    onChange={e => setCurto(e.target.value.toUpperCase())}
                    placeholder="CAR"
                    maxLength={8}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 uppercase"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Cidade</span>
                  <input
                    value={cidade}
                    onChange={e => setCidade(e.target.value)}
                    placeholder="Cariacica"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">
                    País — decide as divisões disponíveis e de onde vêm os rivais
                  </span>
                  <select
                    value={pais}
                    onChange={e => setPais(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  >
                    {PAISES_PARA_CLUBE_PROPRIO.map(p => (
                      <option key={p.pais} value={p.pais}>{p.rotulo}</option>
                    ))}
                  </select>
                </label>
                {/* A UF só aparece onde ela existe como dado. Fora do Brasil o
                    jogo não tem região para clube nenhum, e um campo pedindo
                    "estado da Alemanha" inventaria informação. */}
                {paisEscolhido.ufs && (
                  <label className="text-sm">
                    <span className="mb-1 block text-muted-foreground">
                      Estado — define a região e o campeonato estadual
                    </span>
                    <select
                      value={estado}
                      onChange={e => setEstado(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <option value="">Escolha…</option>
                      {paisEscolhido.ufs.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </label>
                )}
              </div>
            </section>

            {/* ── Cores e escudo ─────────────────────────────────────────── */}
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-3 font-heading text-lg font-semibold">Cores e escudo</h2>
              <div className="flex flex-wrap items-end gap-4">
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Cor principal</span>
                  <input type="color" value={cor1} onChange={e => setCor1(e.target.value)}
                    className="h-10 w-20 rounded border border-border bg-background" />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Cor secundária</span>
                  <input type="color" value={cor2} onChange={e => setCor2(e.target.value)}
                    className="h-10 w-20 rounded border border-border bg-background" />
                </label>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-border"
                    style={{ background: `linear-gradient(135deg, ${cor1}, ${cor2})` }}
                  >
                    {logoUrl
                      ? <img src={logoUrl} alt="Escudo do clube" className="h-full w-full object-contain" />
                      : <span className="text-xs text-white/70">sem escudo</span>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => inputEscudo.current?.click()}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
                    >
                      Enviar escudo
                    </button>
                    {logoUrl && (
                      <button onClick={() => setLogoUrl(undefined)}
                        className="text-xs text-muted-foreground hover:text-foreground">
                        remover
                      </button>
                    )}
                  </div>
                  <input ref={inputEscudo} type="file" accept="image/*" className="hidden"
                    onChange={e => { void aoEscolherEscudo(e.target.files?.[0]); e.target.value = "" }} />
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Sem escudo enviado o clube usa as cores acima. A imagem é reduzida para 256 px —
                guardar o original encheria o armazenamento do jogo.
              </p>
            </section>

            {/* ── Uniformes ──────────────────────────────────────────────── */}
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-3 font-heading text-lg font-semibold">Uniformes</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {VARIANTES.map(v => (
                  <div key={v.id} className="rounded-lg border border-border p-3">
                    <div className="mb-2 text-sm font-medium">{v.rotulo}</div>
                    <div
                      className="mb-2 flex h-24 items-center justify-center overflow-hidden rounded"
                      style={{
                        background: v.id === "home"
                          ? `linear-gradient(135deg, ${cor1}, ${cor2})`
                          : `linear-gradient(135deg, ${cor2}, ${cor1})`,
                      }}
                    >
                      {kits[v.id]
                          ? <img src={kits[v.id]} alt={v.rotulo} className="h-full w-full object-contain" />
                        : <span className="text-xs text-white/70">cores do clube</span>}
                    </div>
                    <button
                      onClick={() => { varianteAlvo.current = v.id; inputKit.current?.click() }}
                      className="w-full rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                    >
                      {kits[v.id] ? "Trocar imagem" : "Enviar imagem"}
                    </button>
                    {kits[v.id] && (
                      <button
                        onClick={() => setKits(prev => ({ ...prev, [v.id]: undefined }))}
                        className="mt-1 w-full text-xs text-muted-foreground hover:text-foreground"
                      >
                        remover
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <input ref={inputKit} type="file" accept="image/*" className="hidden"
                onChange={e => { void aoEscolherKit(e.target.files?.[0]); e.target.value = "" }} />
              <p className="mt-3 text-xs text-muted-foreground">
                O terceiro uniforme é opcional — sem imagem, o clube simplesmente não tem essa variante.
              </p>
            </section>

            {/* ── Divisão e estádio ──────────────────────────────────────── */}
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-3 font-heading text-lg font-semibold">Onde o clube começa</h2>
              <div className="space-y-2">
                {divisoes.map(d => (
                  <label
                    key={d.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                      divisao === d.id ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <input type="radio" name="divisao" checked={divisao === d.id}
                      onChange={() => setDivisao(d.id)} className="mt-1" />
                    <div>
                      <div className="text-sm font-medium">{d.rotulo}</div>
                      <div className="text-xs text-muted-foreground">{d.nota}</div>
                    </div>
                    <span className="ml-auto shrink-0 self-center text-xs text-muted-foreground">
                      o mais fraco da divisão
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Nome do estádio</span>
                  <input
                    value={estadioNome}
                    onChange={e => setEstadioNome(e.target.value)}
                    placeholder="Estádio Municipal"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Capacidade</span>
                  <input
                    type="number" min={500} max={100000} step={500}
                    value={estadioCap}
                    onChange={e => setEstadioCap(Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  />
                </label>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                O clube nasce como <strong>o mais fraco da divisão</strong> — é o que
                &ldquo;começar do zero&rdquo; quer dizer, e não é escolha. Elenco e base vêm
                genéricos, para você montar o time do seu jeito.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                O <strong>caixa</strong>, porém, é de clube de segunda divisão:{" "}
                {caixaInicial.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}.
                Fraco em campo, estável no cofre — sem dinheiro, a base da pirâmide
                seria um beco, não um desafio.
              </p>
            </section>

            {problemas.length > 0 && (nome || curto) && (
              <ul className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {problemas.map(p => <li key={p}>• {p}</li>)}
              </ul>
            )}
            {recado && (
              <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm">{recado}</p>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void salvar()}
                disabled={!podeSalvar || salvando}
                className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-40"
              >
                {salvando ? "Salvando…" : "Criar clube"}
              </button>
              <button
                onClick={() => router.push("/novo-jogo")}
                className="rounded-lg border border-border px-4 py-2 hover:bg-muted"
              >
                Ir para nova carreira
              </button>
            </div>

            {/* ── Clubes já criados ──────────────────────────────────────── */}
            {meus.length > 0 && (
              <section className="rounded-xl border border-border bg-card p-4">
                <h2 className="mb-3 font-heading text-lg font-semibold">
                  Seus clubes ({meus.length})
                </h2>
                <ul className="space-y-2">
                  {meus.map(c => (
                    <li key={c.fileKey} className="flex items-center gap-3 rounded-lg border border-border p-3">
                      <span
                        className="h-8 w-8 shrink-0 rounded"
                        style={{ background: `linear-gradient(135deg, ${c.cor1}, ${c.cor2})` }}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{c.nome} <span className="text-muted-foreground">({siglaExibivel(c.curto, c.nome)})</span></div>
                        <div className="text-xs text-muted-foreground">
                          {[c.cidade, c.estado].filter(Boolean).join("/")} ·{" "}
                          {c.divisao}
                        </div>
                      </div>
                      <button
                        onClick={() => excluir(c.fileKey)}
                        className="ml-auto shrink-0 text-xs text-muted-foreground hover:text-destructive"
                      >
                        excluir
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">
                  Excluir o clube aqui não apaga carreiras já começadas com ele — elas guardam
                  a própria cópia dos dados.
                </p>
              </section>
            )}
          </div>
        </RecursoDeRegistrado>
      </div>
    </main>
  )
}
