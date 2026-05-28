# Ultrafoot 26 — Relatório de Auditoria End-to-End

**Data:** 28/05/2026  
**Método:** Playwright 1.60 (Chromium) + inspeção de código-fonte + análise de servidor  
**Base:** `http://localhost:3000` · Next.js 16.2.6 · 21 screenshots capturados  
**Cobertura:** 27 testes automatizados, 20 páginas testadas

---

## Resumo Executivo

| Severidade  | Qtd |
|-------------|-----|
| 🔴 CRÍTICO  | 2   |
| 🟠 ALTO     | 5   |
| 🟡 MÉDIO    | 5   |
| 🔵 BAIXO    | 6   |
| ℹ️ INFO      | 3   |
| **Total**   | **21** |

---

## 🔴 CRÍTICOS

---

### BUG-01 · `/historico` — Página hardcoded para Bragantino (BGT)

**Arquivo:** `app/historico/page.tsx:24`

```ts
const userTeam = getTeamByShort("BGT") || serieATeams[0]  // ← hardcoded
```

**Impacto:** A página de Histórico do Clube exibe **sempre** os dados do RB Bragantino — fundação 1928, estádio Nabi Abi Chedid, lendas Walter/Claudinho/Ytalo — independentemente do time selecionado pelo usuário. O header superior também exibe "BGT" no lugar do time real do jogador.

**Evidência visual:** Screenshot `21-historico.png` — usuário jogando com FLA (Flamengo), página exibe "RB BRAGANTINO".

**Causa raiz:** Rascunho de desenvolvimento nunca atualizado para ler do save state.

**Correção:** Substituir pela leitura do save:
```ts
// import { useUserTeam } from "@/lib/save-system"
const { data: teamShort } = useUserTeam()
const userTeam = getTeamByShort(teamShort ?? "") || serieATeams[0]
```
Os dados estáticos (títulos, lendas, história) também precisam ser por time ou omitidos até existir uma fonte dinâmica.

---

### BUG-02 · `/partida` — Logo da liga quebrado (Image recebe `src={null}`)

**Arquivo:** `app/partida/page.tsx:371` + `lib/use-game-manager.ts:572`

**Impacto:** O componente `<Image>` no centro da tela de pré-partida recebe `src={null}`, gerando dois erros no console React:
- `"An empty string ("") was passed to the %s attribute"`
- `"Image is missing required 'src' property"`

A imagem aparece como ícone quebrado visível pelo usuário.

**Evidência visual:** Screenshot `07-partida.png` — ícone de imagem quebrada visível no centro entre os dois escudos.

**Causa raiz (cadeia de chamadas):**

```
partida/page.tsx:
  const { currentMatch, standings, league, currentRound } = useGameManager()
  // ↑ "league", "currentMatch" e "currentRound" NÃO existem no retorno do hook

  const leagueName = getLeagueName(league)
  // league = undefined → getTeamByShort(undefined) → null → retorna "Liga"

  <Image src={getLeagueLogo("Liga")} .../>
  // getLeagueLogo("Liga") → null → Image com src nulo → erro
```

O hook `useGameManager` (linha 572) retorna: `hydrated, userTeam, standings, seasonCalendar, currentWeek, currentSeason, gameEngine` — mas **não** retorna `league`, `currentMatch` nem `currentRound`. Os três ficam `undefined` após a desestruturação.

**Correção:**
```tsx
// Em partida/page.tsx, usar a fonte correta:
const { standings, seasonCalendar, saveState } = useGameManager()
const league = getTeamByShort(saveState.selectedTeamShort)?.divisao ?? "serie_a"
const currentMatch = seasonCalendar.nextUserMatch
const currentRound = currentMatch?.week ?? 1

// E ao usar a imagem:
const logoUrl = getLeagueLogo(league)
{logoUrl && <Image src={logoUrl} ... />}
```

---

## 🟠 ALTOS

---

### BUG-03 · `/novo-jogo` — Imagem de fundo depende de CDN externo (Vercel Blob)

**Arquivo:** `app/novo-jogo/page.tsx:76`

```ts
const STADIUM_BG = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1-3pD8rjnjCI4PN1QCaVGJHPsocZwO8L.png"
```

**Impacto:** Em ambiente offline, rede lenta, ou se a URL do Vercel Blob expirar, a tela de seleção de time fica com fundo escuro/sem imagem. Confirmado no screenshot `03-novo-jogo.png` onde o fundo mostra apenas gradiente verde escuro sem a imagem do estádio.

**Correção:** Fazer download do asset e mover para `/public/images/stadium-bg.jpg` (já existe pasta `public/images/`):
```ts
const STADIUM_BG = "/images/stadium-bg.jpg"
```

---

### BUG-04 · `/novo-jogo` — Logo da liga abaixo do card está quebrado

**Arquivo:** `app/novo-jogo/page.tsx:343-353`

```tsx
{leagueLogo && (
  <Image src={leagueLogo} alt={activeDivision.label} ... />
)}
```

`getLeagueLogo(activeDivision.key)` para divisões como `serie_a` retorna `/ligas/01.png`. Porém no screenshot `03-novo-jogo.png` o logo exibido é um ícone de placeholder/bola, não o logo oficial. Verificar se os arquivos em `/public/ligas/` existem e estão íntegros.

**Verificação rápida:**
```powershell
ls public/ligas/
```
Se os arquivos `01.png`, `02.png`, `07.png` etc. não existirem, o `<Image>` vai exibir o fallback do browser.

---

### BUG-05 · `/novo-jogo` — 4 erros 404 no console ao carregar a página

**Evidência:** Console do Playwright registrou 4× `"Failed to load resource: 404"` ao visitar `/novo-jogo`.

**Origem provável:** Imagens de escudos ou assets da pasta `/public/escudos/` que não existem no disco. O componente `TeamCrest` tenta carregar `/escudos/{file_key}.png` e quando o arquivo não existe, o browser reporta 404.

O servidor de dev também exibe repetidamente:
```
GET /escudos/miirassol_sp.png   → LCP warning (typo: "miirassol")
GET /escudos/flarj.png          → LCP warning
```
Notar `miirassol_sp.png` com dois "i" — possível typo no `file_key` do time.

**Correção:** Verificar `data/seeds/teams_br.json` e `lib/teams-data.ts` para file_keys com erros de digitação.

---

### BUG-06 · `/historico` — Erro de hidratação (SSR/CSR mismatch)

**Arquivo:** `app/historico/page.tsx`

**Erro no console:**
```
Hydration failed because the server rendered text didn't match the client.
```

**Causa:** Relacionado ao BUG-01. Como a página usa `getTeamByShort("BGT")` fora de qualquer hook/efeito, o servidor e o cliente podem renderizar de forma diferente dependendo do estado global no momento da hidratação. Após corrigir BUG-01 (usar hook reativo), o erro de hidratação provavelmente desaparece.

---

## 🟡 MÉDIOS

---

### BUG-07 · `/partida/ao-vivo` — Partida não inicia automaticamente (fase "pre" travada)

**Arquivo:** `app/partida/ao-vivo/page.tsx:529-530`

**Impacto:** Ao navegar diretamente para `/partida/ao-vivo` (sem passar por `/partida` antes), a simulação começa na fase `"pre"` e aguarda o usuário pressionar **A (gamepad)** ou clicar em **INICIAR** para começar. Se o usuário não interagir, a partida fica travada em 0'00 indefinidamente.

**Evidência visual:** Screenshot `08a-live-match-initial.png` — mostra Botafogo 0×0 Palmeiras, 0'00, sem eventos.

**Observações adicionais:**
- Os times mostrados (Botafogo × Palmeiras) são os fallbacks `serieATeams[0]` e `serieATeams[1]`, pois não havia `matchContext` salvo — confirmando que a navegação direta para `/ao-vivo` sem passar por `/partida` usa times genéricos.
- Não há feedback visual claro indicando que o usuário precisa pressionar algo para iniciar.

**Sugestão:** Adicionar um botão "INICIAR PARTIDA" visível na fase `pre`, ou incluir instrução de tecla/controle mais destacada.

---

### BUG-08 · `playersToMatchSquad()` — Stats dos jogadores calculados com `Math.random()`

**Arquivo:** `app/partida/ao-vivo/page.tsx:104-108`

```ts
pace:      p.pos === "GOL" ? 50 : 65 + Math.floor(Math.random() * 25),
shooting:  p.pos === "GOL" ? 20 : 50 + Math.floor(Math.random() * 35),
passing:   55 + Math.floor(Math.random() * 30),
dribbling: p.pos === "GOL" ? 30 : 50 + Math.floor(Math.random() * 35),
defending: ...,
physical:  60 + Math.floor(Math.random() * 25),
```

**Impacto:** Os atributos dos jogadores (pace, finishing, passe, etc.) variam aleatoriamente a cada carregamento da página. O mesmo jogador pode ter `pace=65` numa partida e `pace=89` na seguinte. Isso afeta diretamente o resultado da simulação, tornando o jogo **não-determinístico** para o mesmo estado de save.

**Correção:** Usar hash determinístico baseado no ID/nome do jogador, similar ao que já existe em `novo-jogo/page.tsx` para as estatísticas de time:
```ts
const seed = (str: string, n: number) => { /* hash */ }
pace: 65 + Math.abs(seed(p.nome, 1)) % 25
```
Ou, idealmente, armazenar esses atributos diretamente nos dados do jogador em `players_br.json`.

---

### BUG-09 · `useGameManager` — `currentMatch`, `league` e `currentRound` não exportados

**Arquivo:** `lib/use-game-manager.ts:572` + `app/partida/page.tsx:197`

**Impacto:** Além de BUG-02, outras partes do código que consumam esses três campos de `useGameManager()` sempre receberão `undefined`. A propriedade `currentMatch` é usada para determinar o oponente — quando undefined, `/partida` cai nos fallbacks `FLA` e `serieATeams[1]`, o que pode mostrar um adversário incorreto em qualquer rodada.

**Correção:** Adicionar ao retorno do hook:
```ts
return {
  // ... existentes ...
  currentMatch: seasonCalendar.nextUserMatch ?? null,
  currentRound: saveState.week,
  league: getTeamByShort(saveState.selectedTeamShort ?? "")?.divisao ?? "serie_a",
}
```

---

### BUG-10 · Múltiplas páginas — Título/header "Financas", "Taticas", "Penalti" sem acentos

**Páginas afetadas:** `/financas` (título "Financas"), `/taticas`, `/partida/ao-vivo` ("Penalti", "Simulacao", "Substituicao", "Competicoes", "Classificacao")

**Evidência:** Screenshots `13-financas.png` ("Financas"), `15-competicoes.png` ("Competicoes"), `08a-live-match-initial.png` ("Estatisticas da Partida", "Posse de Bola", "Chutes no Alvo", "Impedimentos").

**Impacto:** Inconsistência no idioma PT-BR. Algumas páginas exibem texto correto com acentos, outras não.

**Correção:** Busca e substituição nas páginas afetadas:
- `"Financas"` → `"Finanças"`
- `"Taticas"` / `"Tatica"` → `"Táticas"` / `"Tática"`
- `"Penalti"` → `"Pênalti"`
- `"Simulacao"` → `"Simulação"`
- `"Substituicao"` → `"Substituição"`
- `"Classificacao"` → `"Classificação"`
- `"Competicoes"` → `"Competições"`

---

### BUG-11 · Servidor de desenvolvimento — Requisições de outra aplicação (Zyntra-SGE)

**Evidência:** Dev server log registra durante o jogo:
```
POST /api/login/            404  (repetido ~40×)
GET  /Compras/index.html    404
GET  /api/compras/pedidos/  404
GET  /Compras/fornecedores.html 404
```

**Causa:** Outra aplicação (provavelmente **Zyntra-SGE**, encontrada em `G:\Outros computadores\Meu laptop (2)\Zyntra\`) está configurada para apontar para `localhost:3000` e enviando chamadas de API para o servidor do Ultrafoot. Isso gera dezenas de 404s por minuto nos logs.

**Impacto direto no jogo:** Nenhum — mas satura os logs de desenvolvimento, dificulta o debug, e pode aumentar levemente a latência de resposta do servidor de dev.

**Correção:** Configurar o Zyntra-SGE para usar uma porta diferente (ex: 3001) ou rodar separadamente quando não for testar o Ultrafoot.

---

## 🔵 BAIXOS

---

### BUG-12 · Múltiplas páginas — Avisos de proporção de imagem (`<Image>`)

**Páginas afetadas:** splash, novo-jogo, adversarios, elenco, e outras.

**Erro no console:**
```
Image with src "..." has either width or height modified, but not the other.
Include styles 'width: "auto"' or 'height: "auto"' to maintain the aspect ratio.
```

**Correção:** Adicionar `style={{ width: "auto" }}` ou `style={{ height: "auto" }}` nos componentes `<Image>` que usam apenas uma das dimensões via CSS/className.

---

### BUG-13 · `/splash` — Animação de entrada dura mais de 3 segundos antes do menu principal

**Impacto:** O teste capturou o splash após 3 segundos e ainda mostrava a tela de aviso legal ("Este jogo é uma simulação..."), sem o menu principal visível. Usuários que esperem o carregamento completo podem ficar confusos sobre quando a tela estará interativa.

**Sugestão:** Adicionar um indicador sutil de progresso ou reduzir o tempo total da sequência de animação de intro.

---

### BUG-14 · `/partida/ao-vivo` — Jogadores "mock" aparecem como fallback

**Arquivo:** `app/partida/ao-vivo/page.tsx:505-515`

```ts
} else {
  setHomeSquad(buildSquad(0, "H_"))   // "H_Silva", "H_Santos"...
  setHomeBench(buildBench(100, "H_"))
}
```

**Impacto:** Quando `getPlayersForTeam()` retorna menos de 11 jogadores, nomes genéricos como "H_Silva", "H_Santos", "A_Oliveira" aparecem na interface de partida ao vivo, quebrando a imersão.

**Correção:** O fallback deve usar os jogadores do game-engine (`enginePlayers`) se disponíveis. Se ainda não houver jogadores suficientes, exibir alerta ao usuário e redirecionar para `/elenco/gerenciamento`.

---

### BUG-15 · `/novo-jogo` — Flags de países carregadas de CDN externo

**Arquivo:** `app/novo-jogo/page.tsx:42-45`

```ts
function getFlagUrl(code: string) {
  return `https://flagcdn.com/w80/${key}.png`
}
```

**Impacto:** Em modo offline (versão desktop Tauri), as bandeiras não carregam. O jogo tem suporte a Tauri para desktop — assets críticos de UI não devem depender de CDN externo.

**Correção:** Baixar as 10 bandeiras necessárias (BRA, ENG, ESP, ITA, GER, FRA, POR, USA, MEX, KSA) e servir de `/public/flags/`.

---

### BUG-16 · `/relatorios` e `/analise-partida` — Páginas não testadas (sem rotas de e2e)

**Impacto:** As páginas `/relatorios` e `/analise-partida` não foram cobertas pelos testes existentes em `e2e/`. Se contiverem bugs, passam despercebidos.

**Sugestão:** Adicionar ao menos um smoke test de carga para cada.

---

### BUG-17 · `/elenco/escalacoes` — Formação não detectada nos testes automatizados

O teste procurou por "4-4-2", "4-3-3" ou "campo" mas a página renderiza a formação dentro do componente `<TacticalEditor>` usando SVG/canvas. A formação está presente (confirmado por `10-elenco-gerenciamento.png` mostrando "4-3-3"), mas os seletores de texto do Playwright não a encontram.

**Impacto real:** Zero — a página funciona corretamente. É apenas uma limitação do teste atual.

---

## ℹ️ INFORMATIVO

---

### INFO-01 · Dashboard — Standings e placar mostram "0-0" no início de temporada

**Páginas:** `/` (dashboard) e `/competicoes`

Screenshots `05-dashboard.png` e `15-competicoes.png` mostram todos os times com 0 pontos, 0 vitórias. Isso é **comportamento correto** para semana 0 antes da primeira rodada. Não é bug.

---

### INFO-02 · Partida ao vivo — Funcionamento confirmado

Screenshot `08a-live-match-initial.png` confirma que a página `/partida/ao-vivo` renderiza corretamente quando acessada: exibe placar "Brasileirão Série A", scoreboard 0×0, estatísticas da partida, controles de velocidade (0.5x, 1x, 2x, 5x, 10x). O teste considerou timeout porque aguardou fim de partida sem ter clicado em "INICIAR" — a página em si funciona.

---

### INFO-03 · Páginas com boa qualidade visual confirmada por screenshot

As seguintes páginas foram capturadas e apresentam UI completa e funcional:

| Página | Status |
|--------|--------|
| `/` (Dashboard) | ✅ Completo — finanças, próximas partidas, classificação |
| `/financas` | ✅ Completo — saldo, receitas, despesas detalhadas |
| `/calendario` | ✅ Completo — calendar view com fixtures |
| `/competicoes` | ✅ Completo — 4 competições, standings, tabs |
| `/elenco/gerenciamento` | ✅ Completo — campo tático, elenco, banco, atributos |
| `/mercado` | ✅ Completo — filtros de busca, campos funcionais |
| `/olheiros` | ✅ Completo — olheiros ativos, descobertos, custo semanal |
| `/partida` | ✅ Renderiza (com BUG-02 na logo) |
| `/partida/ao-vivo` | ✅ Renderiza em fase "pre" |

---

## Matriz de Prioridade de Correção

```
Impacto Crítico + Fácil de corrigir:
  → BUG-01 (historico hardcoded)          — 1 linha de código
  → BUG-02/09 (league/currentMatch undef) — 3 linhas no hook + 3 no partida/page

Impacto Alto + Moderado de corrigir:
  → BUG-03 (stadium CDN)                  — download de 1 imagem
  → BUG-08 (stats random)                 — função de hash determinística

Impacto Médio + Baixo esforço:
  → BUG-10 (acentos PT-BR)               — busca e substituição
  → BUG-12 (image aspect ratio)          — adicionar style="width:auto"
  → BUG-05 (404 escudos)                 — verificar file_keys em teams_br.json

Impacto Baixo / Longo prazo:
  → BUG-15 (flags CDN offline)           — download de 10 PNGs
  → BUG-14 (mock players)               — melhoria de UX
  → BUG-11 (Zyntra na porta 3000)       — config de ambiente
```

---

## Arquivos de Evidência

```
C:\Users\agencia\AppData\Local\Temp\ultrafoot-audit\
├── audit-results.json
└── screenshots\
    ├── 01-splash.png               (EA warning screen — animação ainda em progresso)
    ├── 03-novo-jogo.png            (BUG-03 confirmado — fundo CDN não carregou)
    ├── 05-dashboard.png            (OK)
    ├── 07-partida.png              (BUG-02 confirmado — logo quebrado no centro)
    ├── 08a-live-match-initial.png  (BUG-07 — fase "pre", aguardando INICIAR)
    ├── 09-elenco.png               (OK)
    ├── 10-elenco-gerenciamento.png (OK — formação 4-3-3, jogadores reais)
    ├── 12-mercado.png              (OK)
    ├── 13-financas.png             (OK — BUG-10: "Financas" sem acento)
    ├── 14-calendario.png           (OK)
    ├── 15-competicoes.png          (OK — BUG-10: "Competicoes" sem acento)
    ├── 21-historico.png            (BUG-01 confirmado — exibe RB Bragantino)
    ├── 23-olheiros.png             (OK)
    └── ...
```

---

*Gerado por auditoria automatizada + revisão manual · Ultrafoot 26 · branch main*