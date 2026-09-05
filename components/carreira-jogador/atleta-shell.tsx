"use client"

// A MOLDURA DAS TELAS DO ATLETA — uma casca só para as quatro telas do modo.
//
// ⚠️ POR QUE ELA EXISTE (pedido do usuário, com print).
//
// O modo de atleta era UMA página com quatro abas, e o menu do cabeçalho
// apontava para `/carreira/jogador?aba=tabela`. Isso não funcionava, e não por
// pouco: `hardNavigate` despacha `router.push` (navegação client-side, ver
// lib/hard-navigation), então sair de `/carreira/jogador` para
// `/carreira/jogador?aba=tabela` NÃO remonta o componente — e a aba nascia de
// um `useState(() => abaDaUrl())`, que só lê a URL na montagem. Resultado: o
// jogador clicava em "Calendário e tabela", o menu fechava e a tela continuava
// exatamente onde estava. Foi o relato "nenhuma dessas opções funciona".
//
// A correção não é ler a query com mais esforço: é fazer o que o menu promete —
// cada item do menu é uma TELA, com rota própria. É também o que o usuário
// pediu em seguida ("crie as telas do modo carreira jogador"), e o que o modo
// de técnico sempre fez.
//
// ⚠️ E NADA AQUI ROLA. A segunda queixa do print era o scroll do escritório: a
// tela crescia para baixo e o fim do cartão passava por baixo da barra de
// controle. Esta casca é `h-screen` + `overflow-hidden`, e o conteúdo recebe uma
// área `min-h-0 flex-1` — quem rola, quando precisa, é o PAINEL, nunca a
// página. Ver as telas em app/carreira/jogador.
//
// ⚠️ `h-screen`, NUNCA `h-dvh` — e a diferença foi medida em navegador. O jogo
// roda dentro de `body { zoom: 0.8 }`, e `dvh`/`vh` medem a janela SEM a escala:
// `h-dvh` vira 80% da tela de verdade e deixa uma FAIXA MORTA de ~150 px no
// rodapé, que é exatamente o retângulo vazio que o usuário marcou de vermelho no
// print. O `h-screen` do jogo é uma classe corrigida (`100vh / --game-view-scale`,
// ver app/globals.css). Para qualquer outra altura: flex (`min-h-0 flex-1`).

import type { ReactNode } from "react"
import { BarChart3, CalendarDays, HeartHandshake, ShoppingBag, TrendingUp, User } from "lucide-react"

import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { hardNavigate } from "@/lib/hard-navigation"
import { cn } from "@/lib/utils"
import { useTranslation, type Translations } from "@/lib/i18n"
import type { EstadoCarreiraDeJogador } from "@/lib/carreira-de-jogador"

export type TelaDoAtleta = "escritorio" | "calendario" | "evolucao" | "loja" | "vida" | "trajetoria"

/** As quatro telas, na MESMA ordem do menu do cabeçalho (NAV_MENU_PLAYER_ITEMS). */
/**
 * ⚠️ O RÓTULO É UMA CHAVE, NÃO UM TEXTO (1.0.374). Esta lista é uma constante de
 * módulo — fora do componente, sem acesso a hook — e por isso os cinco nomes do
 * menu ficaram chumbados em português desde que o modo nasceu. Guardar a chave
 * e resolvê-la no render custa uma linha e tira as cinco da catraca.
 */
const TELAS: { id: TelaDoAtleta; rotulo: keyof Translations["carreiraDeJogador"]; href: string; icone: typeof User }[] = [
  { id: "escritorio", rotulo: "menu_escritorio", href: "/carreira/jogador", icone: User },
  { id: "calendario", rotulo: "menu_calendario", href: "/carreira/jogador/calendario", icone: CalendarDays },
  { id: "evolucao", rotulo: "menu_evolucao", href: "/carreira/jogador/evolucao", icone: TrendingUp },
  // ⚠️ A VIDA VEM ANTES DA TRAJETÓRIA, na ordem da pergunta que o jogador faz:
  // como estou (escritório), o que vem (calendário), como melhoro (evolução),
  // como está a vida fora (vida) e só então o que já fiz (trajetória). É a
  // mesma ordem que LB/RB percorrem no controle (`TELAS_DO_ATLETA`), e as duas
  // discordando seria o tipo de detalhe que faz o controle parecer quebrado.
  // ⚠️ A LOJA ENTRA ENTRE EVOLUÇÃO E VIDA (1.0.377), e a ordem segue a mesma
  // regra das outras: como melhoro (evolução), com o que melhoro (loja), como
  // está a vida fora (vida). Pô-la no fim, depois da trajetória, a esconderia
  // atrás da tela que só se abre quando a carreira acaba.
  { id: "loja", rotulo: "menu_loja", href: "/carreira/jogador/loja", icone: ShoppingBag },
  { id: "vida", rotulo: "vida_fora_de_campo", href: "/carreira/jogador/vida", icone: HeartHandshake },
  { id: "trajetoria", rotulo: "menu_trajetoria", href: "/carreira/jogador/trajetoria", icone: BarChart3 },
]

/** A rota da tela do atleta que corresponde à antiga aba `?aba=`. */
export function rotaDaAbaAntiga(aba: string | null): string | null {
  if (aba === "tabela") return "/carreira/jogador/calendario"
  if (aba === "evolucao") return "/carreira/jogador/evolucao"
  if (aba === "historico") return "/carreira/jogador/trajetoria"
  return null
}

export function AtletaShell({
  carreira,
  ativa,
  acoes,
  children,
}: {
  carreira: EstadoCarreiraDeJogador
  ativa: TelaDoAtleta
  /** Botões do canto direito (viver/simular/encerrar) — só o escritório usa. */
  acoes?: ReactNode
  children: ReactNode
}) {
  const t = useTranslation()
  const { atleta } = carreira
  const semClube = Boolean(carreira.semClube)

  return (
    <main className="relative flex h-screen flex-col overflow-hidden text-white">
      {/* O fundo que o usuário mandou (02.png → WebP, 1,39 MB → 65 KB). Fixo e
          coberto por um véu em gradiente: texto branco sobre foto de estádio não
          se lê, mas um véu chapado de 88% apaga a foto inteira — o gradiente
          deixa o gramado aparecer no meio da tela, que é onde não há texto.

          ⚠️ `z-0`, NUNCA `-z-10`, e isto foi medido no navegador: o `html` deste
          jogo tem fundo próprio (`bg-background`), então o fundo do `body` NÃO
          é promovido para a tela — ele pinta como caixa normal, em z=0, e cobre
          qualquer elemento em z NEGATIVO. Era por isso que o fundo colocado
          nesta tela na 1.0.352 nunca apareceu: o print do usuário continuava
          preto porque a imagem estava ATRÁS do fundo do body. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/images/pre-jogo/in-game-02.webp)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-[#06090d]/94 via-[#06090d]/72 to-[#06090d]/95"
      />

      {/* ⚠️ O CABEÇALHO PRECISA DE UM Z MAIOR QUE O DO CONTEÚDO. Envolvê-lo num
          `z-10` igual ao da área de baixo criou um contexto de empilhamento em
          volta dele: o `z-30` interno do menu (tecla W) passou a valer só DENTRO
          dessa caixa, e a lista abria ATRÁS dos painéis — o teste de tela pegou
          isso como "clique interceptado" pelo texto do escritório. */}
      <div className="relative z-30"><GameHeader /></div>

      <div className="relative z-10 mx-auto flex w-full min-h-0 max-w-[1500px] flex-1 flex-col px-5 pb-12 pt-4">

        {/* ── Identidade: quem, onde e em que pé está ── */}
        <header className="mb-3 flex shrink-0 flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <TeamCrest fileKey={carreira.clubeFileKey} size="lg" />
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.25em] text-[var(--brand)]">
                {atleta.posicao} · {atleta.idade} anos · {atleta.nacionalidade}
              </p>
              <h1 className="uf-heading mt-0.5 text-2xl font-black leading-tight">{atleta.nome}</h1>
              <p className="text-[13px] text-white/50">
                {semClube
                  ? `Sem clube · última casa: ${carreira.clubeNome} · Temporada ${carreira.temporada}`
                  : `${carreira.clubeNome} · ${carreira.ligaNome} · Temporada ${carreira.temporada}`}
              </p>
            </div>
          </div>
          {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
        </header>

        {/* ── As quatro telas do modo. Rota de verdade em cada uma: o item do
             menu e esta aba levam ao MESMO lugar. ── */}
        <nav className="mb-3 flex shrink-0 flex-wrap gap-2">
          {TELAS.map(({ id, rotulo, href, icone: Icone }) => (
            <button
              key={id}
              onClick={() => { if (id !== ativa) hardNavigate(href) }}
              aria-current={id === ativa ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors",
                id === ativa
                  ? "border-[var(--brand)]/50 bg-[var(--brand)]/10 text-white"
                  : "border-white/10 bg-black/30 text-white/55 hover:text-white",
              )}
            >
              <Icone className={cn("h-3.5 w-3.5", id === ativa ? "text-[var(--brand)]" : "text-white/40")} />
              {t.carreiraDeJogador[rotulo]}
            </button>
          ))}
        </nav>

        {/* A área de conteúdo. `min-h-0` é o que faz o filho poder rolar por
            dentro em vez de esticar a página — sem ele o `overflow-auto` de
            baixo nunca ativa e a tela volta a crescer. */}
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </main>
  )
}

/** Painel padrão das telas do atleta: título fixo, corpo que rola por dentro. */
export function PainelDoAtleta({
  titulo,
  icone,
  acessorio,
  className,
  contentClassName,
  children,
}: {
  titulo: ReactNode
  icone?: ReactNode
  acessorio?: ReactNode
  className?: string
  contentClassName?: string
  children: ReactNode
}) {
  return (
    /* ⚠️ O PAINEL PRECISA SER OPACO O BASTANTE. Ele era `bg-white/[.03]`, feito
       para um fundo preto chapado; sobre a foto do fundo, o texto passava a
       disputar com o gramado atrás. `bg-black/55` + desfoque mantém a foto
       visível em volta e o dado legível dentro. */
    <section className={cn("flex min-h-0 flex-col rounded-2xl border border-white/10 bg-black/55 backdrop-blur-sm", className)}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[.06] px-5 py-3">
        <h2 className="flex items-center gap-2 text-lg font-black">{icone}{titulo}</h2>
        {acessorio}
      </div>
      <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4", contentClassName)}>{children}</div>
    </section>
  )
}
