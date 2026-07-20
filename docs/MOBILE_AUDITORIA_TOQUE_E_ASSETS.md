# Auditoria Mobile — Toque e Assets

Levantamento feito em 2026-07-20 sobre o repo PC (v1.0.101, branch `sync-estrutura-atual`).
Base: 170 arquivos `.tsx/.ts` em `app/`, `components/`, `hooks/`.

> Nada neste documento foi aplicado ao código. É o mapa do que precisa mudar.

---

## 1. Toque — o que quebra no dedo

### 1.1 Bloqueadores funcionais (não degradam: simplesmente não funcionam)

**Drag & drop** — HTML5 drag events não disparam em touch. Sem `pointer events`
ou lib de DnD com suporte a toque, estas telas ficam inutilizáveis:

| Arquivo | Ocorrências | O que quebra |
|---|---|---|
| `app/partida/escalacao/page.tsx` | 10 | Montar escalação (núcleo do jogo) |
| `app/elenco/gerenciamento/page.tsx` | 10 | Mover jogadores entre grupos |
| `components/native-app-provider.tsx` | 2 | Import de arquivos por drop |
| `components/match/kit-image.tsx` | 1 | — |

Correção: migrar para Pointer Events (`onPointerDown/Move/Up` + `setPointerCapture`),
que cobrem mouse e toque na mesma API. Alternativa: `@dnd-kit/core` (tem sensor de toque).
Escalação e gerenciamento devem também ganhar um caminho **sem arrastar** (tap-para-selecionar,
tap-para-posicionar) — é o padrão dos managers mobile e resolve acessibilidade junto.

### 1.2 Conteúdo escondido atrás de hover

Não existe hover no toque. Tudo abaixo fica inalcançável ou pisca no primeiro tap:

| Padrão | Ocorrências |
|---|---|
| `group-hover:` | 35 |
| `opacity-0` (revelado no hover) | 27 |
| `hover:opacity` | 23 |
| `title="..."` (tooltip nativo) | 17 |
| `<Tooltip>` / `TooltipTrigger` | 14 |
| `onMouseEnter` / `onMouseLeave` | 21 |

Total de classes `hover:` no projeto: **488**. A maioria é decorativa (mudança de cor)
e pode ficar — o navegador aplica no tap. O problema são as 62 ocorrências
(`group-hover:` + `opacity-0` + `hover:opacity`) que **revelam conteúdo**.

Prioridade por arquivo:

```
 49  app/mercado/page.tsx
 38  app/elenco/gerenciamento/page.tsx
 35  app/partida/escalacao/page.tsx
 24  app/editar/page.tsx
 20  components/music-player.tsx      <- ver nota sobre música
 17  app/configuracoes/page.tsx
 17  app/taticas/page.tsx
 16  app/selecao/page.tsx
 16  components/tactical-editor.tsx
```

Correção: ações reveladas no hover viram botões sempre visíveis ou entram num
menu de contexto acionado por tap-longo. Tooltips informativos viram `Popover` no tap.

### 1.3 Alvos de toque

Apple HIG e Material exigem **44×44 pt / 48×48 dp** mínimos. Estado atual:

| Padrão | Ocorrências |
|---|---|
| `h-6` / `h-7` / `h-8` (24–32px) | 233 |
| `size="sm"` / `size="icon"` | 98 |
| `text-xs` | 827 |

Correção: não é reescrever 233 lugares à mão. Definir variantes mobile no
`components/ui/button.tsx` e afins (`min-h-11` = 44px) e trocar por token,
não por arquivo.

### 1.4 Layout

| Padrão | Ocorrências | Risco em 360–430px |
|---|---|---|
| `grid-cols-[4-9]` | 51 | Colunas de ~40px, ilegível |
| `w-[400px+]` fixo | 18 | Overflow horizontal |
| `w-64/72/80/96` | 12 | Sidebars maiores que a tela |
| `min-w-[NNNpx]` | 11 | Impede o container de encolher |

Já existem **441** breakpoints `sm:`/`md:` — a base responsiva existe, mas foi
pensada desktop-first (reduzindo a partir de 1280px). Mobile-first exige revisar
o default de cada um desses.

### 1.5 Navegação por gamepad

25 usos de `useGamepad`/`gamepad-controls` e 28 `onKeyDown`. No mobile isso é
código morto que ainda custa bundle e listeners. Não remover — condicionar por
plataforma, já que o mesmo código serve os dois alvos.

---

## 2. Assets — orçamento de loja

### 2.1 Limites reais

- **Google Play**: base AAB (download) ≤ **200 MB**. Conteúdo extra via
  Play Asset Delivery (install-time / fast-follow / on-demand), até ~4 GB no total.
- **App Store**: acima de ~200 MB o download só ocorre em Wi-Fi por padrão.
  On-Demand Resources para o resto.

### 2.2 Situação após a remoção da música

`public/` saiu de **1303 MB → 348 MB** (954 MB de trilhas removidos).
Ainda é ~1,7× o limite de base.

### 2.3 Ganhos medidos (não estimados)

Amostras reais convertidas com `ffmpeg -c:v libwebp -quality 82 -compression_level 6`:

| Pasta | Atual | Redução medida | Projeção | Veredito |
|---|---|---|---|---|
| `images/` (38 PNGs, 1695 KB médios) | 63,2 MB | **94,8%** | 3,3 MB | Ganho maior do projeto |
| `stadiums/` (1783 PNGs) | 101,5 MB | **45,8%** | 55,1 MB | Converter |
| `escudos/` (3494) | 19,9 MB | **82,3%** | 3,5 MB | Converter |
| `camisas/` (2633) | 12,4 MB | **67,1%** | 4,1 MB | Converter |
| `escudos-mini/` (2584) | 2,7 MB | 45,3% | 1,5 MB | Converter |
| `audio/` (66 WAV) | 35,0 MB | ~90% (→Opus) | ~4 MB | Converter |
| `jogadores/` (2297 JPG, 14 KB médios) | 31,8 MB | **3,4%** | 30,7 MB | **Já otimizado — não mexer** |
| `kits-imported/` (3752) | 39,1 MB | — | — | **Já é WebP — não mexer** |

Os 38 PNGs de `images/` a 1,7 MB cada são arte de fundo salva sem compressão.
Sozinhos valem 60 MB de economia — é o primeiro alvo, e o de menor risco
(38 arquivos, não 3 mil).

### 2.4 Projeção

```
público atual .................. 348 MB
  images      63,2 -> 3,3       -59,9
  stadiums   101,5 -> 55,1      -46,4
  escudos     19,9 -> 3,5       -16,4
  camisas 1+2+3                 -14,7
  audio (wav->opus)             -31,0
  escudos-mini                   -1,2
                                -------
resultado ...................... ~178 MB
```

178 MB cabe no limite, mas sem folga para o binário Rust, o runtime e o JS.
**Portanto a divisão é obrigatória**, não opcional:

- **Base AAB (~80 MB)**: UI, escudos, escudos-mini, camisas, ligas, flags, trofeus, brand, data
- **On-demand**: `stadiums/` (55 MB), `jogadores/` (31 MB), `images/` de alta resolução, cutscenes

### 2.5 Armadilha na conversão

Trocar `.png` por `.webp` **quebra toda referência no código** (`/stadiums/x.png`).
Duas saídas:

1. Manter a extensão original e só recomprimir (WebP dentro de arquivo `.png` —
   navegadores leem pelo magic number, mas é frágil e confunde ferramentas).
2. **Recomendado**: converter de verdade e ajustar os resolvers centrais
   (`lib/game-asset.ts`, `lib/escudos-map.ts`, `lib/player-photos.ts`,
   `public/stadiums/*.json`) para emitir `.webp`. As referências passam por
   poucos pontos centrais — não estão espalhadas.

Antes de converter em massa: confirmar que o `game-asset://` handler do Tauri
serve `image/webp` com o MIME correto.

---

## 3. Ordem sugerida

1. `images/` → WebP (60 MB, 38 arquivos, risco baixo) — valida o pipeline
2. `audio/` WAV → Opus (31 MB, 66 arquivos)
3. Pointer Events em escalação e gerenciamento (desbloqueia o jogo no toque)
4. Variantes de toque nos componentes `ui/` (resolve os 233 alvos pequenos por token)
5. As 62 revelações por hover
6. `stadiums/` + `jogadores/` para Play Asset Delivery
7. Revisão mobile-first dos 51 `grid-cols-[4-9]`

Passos 1, 2 e 6 são independentes do toolchain Android e podem começar já.
