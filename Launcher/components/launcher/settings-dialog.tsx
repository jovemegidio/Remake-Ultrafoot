"use client"

import { useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import {
  X, Power, MinusSquare, Palette, Type, Accessibility, UserCircle, Monitor, RotateCcw,
  Upload, Trash2, Languages, Search, Check,
} from "lucide-react"
import { useIdioma, useT, IDIOMAS } from "@/lib/i18n"
import {
  TEMAS, FONTES, AVATARES, PADRAO, iniciais, fotoParaAvatar,
  type Preferencias,
} from "@/lib/preferencias"

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-secondary border border-border",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
          checked ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  )
}

function Linha({ icone: Icone, titulo, descricao, children }: {
  icone: typeof Power; titulo: string; descricao: string; children: React.ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4">
      <span className="flex items-start gap-3">
        <Icone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <span>
          <span className="block text-sm font-medium text-foreground">{titulo}</span>
          <span className="block text-xs text-muted-foreground">{descricao}</span>
        </span>
      </span>
      {children}
    </label>
  )
}

type Aba = "geral" | "idioma" | "aparencia" | "acessibilidade" | "perfil"

// Os textos precisam bater EXATAMENTE com `grupo` em lib/fontes.ts — com acento
// e tudo. Sem isso o filtro não casa e o grupo some da lista sem erro nenhum.
const GRUPOS_DE_FONTE = ["Interface", "Esportiva", "Serifada", "Monoespaçada", "Acessível"] as const

const ABAS: { id: Aba; chave: "conf.geral" | "conf.idioma" | "conf.aparencia" | "conf.acessibilidade" | "conf.perfil"; icone: typeof Power }[] = [
  { id: "geral", chave: "conf.geral", icone: Monitor },
  { id: "idioma", chave: "conf.idioma", icone: Languages },
  { id: "aparencia", chave: "conf.aparencia", icone: Palette },
  { id: "acessibilidade", chave: "conf.acessibilidade", icone: Accessibility },
  { id: "perfil", chave: "conf.perfil", icone: UserCircle },
]

/**
 * SELETOR DE IDIOMA.
 *
 * A busca não é enfeite: com mais de 120 idiomas, rolar a lista até achar o seu
 * é pior do que digitar. Ela casa com o nome NATIVO e com o nome em português —
 * quem procura "japonês" e quem procura "日本語" acham o mesmo item.
 *
 * A porcentagem ao lado diz quanto daquele idioma já está traduzido. Mostrar
 * isso é mais honesto do que deixar o jogador descobrir sozinho que metade da
 * tela ficou em inglês — e é o que faz um idioma parcial ser aceitável.
 */
function AbaDeIdioma() {
  const { idioma, trocarIdioma, cobertura } = useIdioma()
  const [busca, setBusca] = useState("")

  const lista = useMemo(() => {
    const alvo = busca.trim().toLowerCase()
    if (!alvo) return IDIOMAS
    return IDIOMAS.filter(
      (i) =>
        i.nativo.toLowerCase().includes(alvo) ||
        i.pt.toLowerCase().includes(alvo) ||
        i.codigo.toLowerCase().includes(alvo),
    )
  }, [busca])

  return (
    <div className="flex h-full min-h-0 flex-col p-5">
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar idioma…"
          className="w-full rounded-lg border border-border bg-black/20 py-2 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
        />
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        {IDIOMAS.length} idiomas · o atual está {Math.round(cobertura * 100)}% traduzido.
        O que faltar aparece em inglês.
      </p>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {lista.map((i) => (
          <button
            key={i.codigo}
            onClick={() => trocarIdioma(i.codigo)}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
              idioma === i.codigo
                ? "border-primary/50 bg-primary/10"
                : "border-transparent hover:bg-white/[0.04]",
            )}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm text-foreground" dir={i.rtl ? "rtl" : "ltr"}>
                {i.nativo}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">{i.pt}</span>
            </span>
            {idioma === i.codigo && <Check className="h-4 w-4 shrink-0 text-primary" />}
          </button>
        ))}
        {lista.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum idioma com esse nome.</p>
        )}
      </div>
    </div>
  )
}

export function SettingsDialog({
  autostart,
  closeToTray,
  prefs,
  nomeDaConta,
  onAutostart,
  onCloseToTray,
  onPrefs,
  onClose,
}: {
  autostart: boolean
  closeToTray: boolean
  prefs: Preferencias
  nomeDaConta: string
  onAutostart: (v: boolean) => void
  onCloseToTray: (v: boolean) => void
  onPrefs: (p: Preferencias) => void
  onClose: () => void
}) {
  const t = useT()
  const [aba, setAba] = useState<Aba>("geral")
  const arquivoRef = useRef<HTMLInputElement>(null)
  const [erroFoto, setErroFoto] = useState("")
  // Toda mudança é aplicada NA HORA, sem botão "salvar": o jogador precisa ver o
  // tema no lugar para decidir se gostou. Um preview que não é o resultado final
  // é o jeito mais fácil de escolher errado.
  const mudar = (p: Partial<Preferencias>) => onPrefs({ ...prefs, ...p })

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-5 backdrop-blur"
      onClick={onClose}
    >
      <section
        className="flex max-h-[86vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <nav className="flex w-40 shrink-0 flex-col gap-0.5 border-r border-border bg-black/20 p-2">
          <p className="px-3 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {t("conf.titulo")}
          </p>
          {ABAS.map(item => (
            <button
              key={item.id}
              onClick={() => setAba(item.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                aba === item.id
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
              )}
            >
              <item.icone className="h-4 w-4 shrink-0" />
              {t(item.chave)}
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-lg font-bold text-foreground">
              {t(ABAS.find(a => a.id === aba)?.chave ?? "conf.geral")}
            </h2>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {aba === "geral" && (
              <div className="flex flex-col divide-y divide-border">
                <Linha
                  icone={Power}
                  titulo={t("conf.iniciarComWindows")}
                  descricao="O launcher abre sozinho quando você liga o computador."
                >
                  <Toggle checked={autostart} onChange={onAutostart} />
                </Linha>
                <Linha
                  icone={MinusSquare}
                  titulo={t("conf.bandeja")}
                  descricao="Ao clicar no X, o launcher continua rodando no ícone ao lado do relógio."
                >
                  <Toggle checked={closeToTray} onChange={onCloseToTray} />
                </Linha>
              </div>
            )}

            {aba === "idioma" && <AbaDeIdioma />}

            {aba === "aparencia" && (
              <div className="space-y-6 p-5">
                <div>
                  <h3 className="mb-1 text-sm font-semibold text-foreground">Tema</h3>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Muda as cores do launcher inteiro. O jogo mantém o visual dele.
                  </p>
                  <div className="grid max-h-64 grid-cols-3 gap-2.5 overflow-y-auto pr-1">
                    {TEMAS.map(t => (
                      <button
                        key={t.id}
                        onClick={() => mudar({ tema: t.id })}
                        className={cn(
                          "overflow-hidden rounded-xl border-2 text-left transition-all",
                          prefs.tema === t.id
                            ? "border-primary"
                            : "border-transparent hover:border-white/15",
                        )}
                      >
                        {/* A amostra mostra o FUNDO real do tema, nao um retangulo
                            de cor: e o fundo que diferencia um tema do outro. */}
                        <span className="flex h-14 items-center gap-1.5 px-3" style={{ background: t.fundoCss }}>
                          <span className="h-6 w-6 rounded-full" style={{ background: t.primaria }} />
                          <span className="h-2 flex-1 rounded-full" style={{ background: t.borda }} />
                        </span>
                        <span className="block px-3 py-2 text-xs font-semibold text-foreground">{t.nome}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Type className="h-4 w-4 text-primary" /> Fonte
                  </h3>
                  {/* Agrupadas por uso: com 21 opcoes numa lista corrida, escolher vira
                      rolagem cega. O nome de cada fonte e desenhado NELA mesma — e o
                      unico jeito de decidir sem experimentar uma por uma. */}
                  <div className="mt-2 max-h-72 space-y-3 overflow-y-auto pr-1">
                    {GRUPOS_DE_FONTE.map(grupo => {
                      const doGrupo = FONTES.filter(f => f.grupo === grupo)
                      if (!doGrupo.length) return null
                      return (
                        <div key={grupo}>
                          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                            {grupo}
                          </p>
                          <div className="space-y-1.5">
                            {doGrupo.map(f => (
                              <button
                                key={f.id}
                                onClick={() => mudar({ fonte: f.id })}
                                className={cn(
                                  "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                                  prefs.fonte === f.id
                                    ? "border-primary/50 bg-primary/10"
                                    : "border-border hover:bg-white/[0.04]",
                                )}
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-sm text-foreground" style={{ fontFamily: f.pilha }}>
                                    {f.nome}
                                  </span>
                                  {f.nota && <span className="block text-[11px] text-muted-foreground">{f.nota}</span>}
                                </span>
                                <span className="shrink-0 text-xs text-muted-foreground" style={{ fontFamily: f.pilha }}>
                                  Ultrafoot 26
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {aba === "acessibilidade" && (
              <div className="space-y-5 p-5">
                <div>
                  <h3 className="mb-1 text-sm font-semibold text-foreground">Tamanho do texto</h3>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Vale para o launcher todo. Limitado a 140% porque acima disso os botões
                    começam a se cortar — o que atrapalha mais do que ajuda.
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="range" min={80} max={140} step={5}
                      value={prefs.tamanhoTexto}
                      onChange={e => mudar({ tamanhoTexto: Number(e.target.value) })}
                      className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-secondary accent-[var(--primary)]"
                    />
                    <span className="w-14 text-right font-mono text-sm text-foreground">
                      {prefs.tamanhoTexto}%
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-border rounded-xl border border-border">
                  <Linha
                    icone={Accessibility}
                    titulo="Alto contraste"
                    descricao="Bordas visíveis e textos secundários mais claros."
                  >
                    <Toggle checked={prefs.altoContraste} onChange={v => mudar({ altoContraste: v })} />
                  </Linha>
                  <Linha
                    icone={RotateCcw}
                    titulo="Reduzir animações"
                    descricao="Corta transições e efeitos. Ajuda em enjoo visual e em máquinas fracas."
                  >
                    <Toggle checked={prefs.reduzirAnimacoes} onChange={v => mudar({ reduzirAnimacoes: v })} />
                  </Linha>
                </div>

                <button
                  onClick={() => onPrefs({ ...PADRAO, tema: prefs.tema })}
                  className="w-full rounded-lg border border-border py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
                >
                  Restaurar acessibilidade e fonte para o padrão
                </button>
              </div>
            )}

            {aba === "perfil" && (
              <div className="space-y-5 p-5">
                <div className="flex items-center gap-4 rounded-xl border border-border p-4">
                  {prefs.fotoAvatar ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={prefs.fotoAvatar} alt="Seu avatar"
                      className="h-14 w-14 shrink-0 rounded-full object-cover"
                      style={{ boxShadow: `0 0 0 2px ${prefs.corAvatar}` }}
                    />
                  ) : (
                    <span
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-bold"
                      style={{ background: `${prefs.corAvatar}22`, color: prefs.corAvatar }}
                    >
                      {prefs.avatar || iniciais(nomeDaConta)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {nomeDaConta || "Sem conta conectada"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {nomeDaConta
                        ? "É assim que você aparece no launcher e no FC Hub."
                        : "Entre na sua conta para o avatar aparecer com o seu nome."}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Sua foto</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={arquivoRef} type="file" accept="image/*" className="hidden"
                      onChange={async e => {
                        const f = e.target.files?.[0]
                        e.target.value = ""
                        if (!f) return
                        setErroFoto("")
                        try {
                          mudar({ fotoAvatar: await fotoParaAvatar(f) })
                        } catch (err) {
                          setErroFoto(err instanceof Error ? err.message : "nao deu para usar esta imagem")
                        }
                      }}
                    />
                    <button
                      onClick={() => arquivoRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-white/[0.05]"
                    >
                      <Upload className="h-3.5 w-3.5" /> Escolher foto
                    </button>
                    {prefs.fotoAvatar && (
                      <button
                        onClick={() => mudar({ fotoAvatar: "" })}
                        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remover
                      </button>
                    )}
                  </div>
                  {erroFoto && <p className="mt-1.5 text-[11px] text-red-400">{erroFoto}</p>}
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    A foto e recortada no centro e reduzida para 160px. Ela fica na sua maquina —
                    nao vai para o servidor.
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">
                    Ou um simbolo
                    {prefs.fotoAvatar && (
                      <span className="ml-1 font-normal text-muted-foreground">(a foto esta em uso)</span>
                    )}
                  </h3>
                  <div className="grid grid-cols-7 gap-2">
                    {AVATARES.map(a => (
                      <button
                        key={a || "iniciais"}
                        onClick={() => mudar({ avatar: a })}
                        title={a ? undefined : "Usar as iniciais do seu nome"}
                        className={cn(
                          "flex h-11 items-center justify-center rounded-lg border text-lg transition-colors",
                          prefs.avatar === a
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-white/[0.04]",
                        )}
                      >
                        {a || <span className="text-[11px] font-bold text-muted-foreground">AB</span>}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Cor</h3>
                  <div className="flex flex-wrap gap-2">
                    {["#48eed6", "#4ade80", "#7aa2ff", "#ff8a4c", "#f472b6", "#facc15", "#a78bfa", "#f87171"].map(c => (
                      <button
                        key={c}
                        onClick={() => mudar({ corAvatar: c })}
                        aria-label={`Cor ${c}`}
                        className={cn(
                          "h-9 w-9 rounded-full border-2 transition-transform",
                          prefs.corAvatar === c ? "border-foreground scale-110" : "border-transparent",
                        )}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end border-t border-border px-5 py-3">
            <button
              onClick={onClose}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              {t("acao.concluido")}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
