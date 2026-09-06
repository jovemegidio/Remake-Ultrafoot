// OS QUATRO ESTADOS QUE TODA TELA TEM — carregando, vazio, erro e bloqueado.
//
// ⚠️ POR QUE ISTO EXISTE. Havia 42 spinners escritos a mao pelo jogo, cada um
// com o seu tamanho, a sua espessura de borda e a sua cor; e cada tela vazia
// dizia "Nenhum atleta", "Nenhuma proposta", "nada encontrado" com um layout
// diferente. Nao e feio por acaso: e o que acontece quando o estado de espera
// nunca foi tratado como parte da interface, so como o que aparece "enquanto
// nao chega".
//
// Aqui ficam as quatro formas, sobre os mesmos tokens do resto do sistema. Elas
// nao carregam regra nenhuma: quem decide QUANDO mostrar continua sendo a tela.
//
// ⚠️ O ESQUELETO TEM DE TER A GEOMETRIA DO CONTEUDO FINAL. Um retangulo generico
// no meio da tela nao prepara o olho para nada e ainda produz um salto quando o
// conteudo real entra. Por isso `EsqueletoDeLista` recebe a altura da linha e a
// quantidade — quem chama sabe o que vem depois.

import { cn } from "@/lib/utils"

// ── CARREGANDO ──────────────────────────────────────────────────────────────

/**
 * O anel de carregamento do jogo. Um so tamanho por contexto, sempre na cor da
 * marca (que o jogador escolhe nas Configuracoes).
 */
export function Carregador({
  tamanho = "md",
  className,
}: {
  tamanho?: "sm" | "md" | "lg"
  className?: string
}) {
  const px = { sm: "h-4 w-4 border", md: "h-8 w-8 border-2", lg: "h-12 w-12 border-2" }[tamanho]
  return (
    <div
      role="status"
      aria-label="Carregando"
      className={cn(
        "rounded-full border-[var(--brand)] border-t-transparent animate-spin",
        px,
        className,
      )}
    />
  )
}

/**
 * Espera que ocupa a tela inteira.
 *
 * ⚠️ `min-h-0 flex-1` e nao altura em `vh`: o jogo roda dentro de
 * `body { zoom: 0.8 }` e qualquer numero em `vh` encolhe 20% junto, deixando
 * faixa morta embaixo. A regra vale aqui como vale no resto do jogo.
 */
export function EstadoDeCarregamento({
  mensagem,
  className,
}: {
  mensagem?: string
  className?: string
}) {
  return (
    <div className={cn("uf-estado-cheio", className)}>
      <Carregador tamanho="lg" />
      {mensagem ? <span className="uf-meta">{mensagem}</span> : null}
    </div>
  )
}

/**
 * Esqueleto com a forma de uma LISTA — elenco, mercado, propostas, mensagens.
 * Recebe a altura da linha porque so quem chama sabe qual e.
 */
export function EsqueletoDeLista({
  linhas = 6,
  alturaDaLinha = 56,
  className,
}: {
  linhas?: number
  alturaDaLinha?: number
  className?: string
}) {
  return (
    <div className={cn("uf-esqueleto-lista", className)} aria-hidden="true">
      {Array.from({ length: linhas }, (_, i) => (
        <div
          key={i}
          className="uf-skeleton w-full"
          style={{
            height: alturaDaLinha,
            // Escalona a opacidade para baixo: a lista parece continuar alem da
            // dobra em vez de terminar num corte reto.
            opacity: 1 - i * (0.6 / Math.max(linhas, 1)),
          }}
        />
      ))}
    </div>
  )
}

// ── VAZIO, ERRO E BLOQUEADO ─────────────────────────────────────────────────

interface EstadoProps {
  titulo: string
  /** Uma frase. O que aconteceu, ou o que fazer a respeito. */
  descricao?: string
  /** Um icone do lucide-react, o mesmo conjunto do resto do jogo. */
  icone?: React.ComponentType<{ className?: string }>
  acao?: React.ReactNode
  className?: string
}

function Moldura({
  titulo,
  descricao,
  icone: Icone,
  acao,
  className,
  cor,
  papel,
}: EstadoProps & { cor: string; papel?: "alert" }) {
  return (
    <div className={cn("uf-estado", className)} role={papel}>
      {Icone ? (
        <div
          className="mb-1 flex h-11 w-11 items-center justify-center rounded-full"
          style={{ background: `color-mix(in oklab, ${cor} 14%, transparent)` }}
        >
          <Icone className="h-5 w-5" />
        </div>
      ) : null}
      <p className="uf-estado__titulo">{titulo}</p>
      {descricao ? <p className="uf-estado__texto">{descricao}</p> : null}
      {acao ? <div className="mt-2">{acao}</div> : null}
    </div>
  )
}

/** Nao ha nada aqui — e isso e normal. Sem alarme, sem vermelho. */
export function EstadoVazio(props: EstadoProps) {
  return <Moldura {...props} cor="var(--uf-text-muted)" />
}

/**
 * Alguma coisa falhou.
 *
 * ⚠️ `role="alert"` de proposito: leitor de tela anuncia sozinho. Um erro que so
 * existe visualmente e um erro que parte dos jogadores nao recebe.
 */
export function EstadoDeErro(props: EstadoProps) {
  return <Moldura {...props} cor="var(--uf-error)" papel="alert" />
}

/** Existe, mas ainda nao esta liberado — fase da carreira, registro, temporada. */
export function EstadoBloqueado(props: EstadoProps) {
  return <Moldura {...props} cor="var(--uf-yellow)" />
}
