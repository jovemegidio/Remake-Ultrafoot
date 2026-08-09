/**
 * ATLETA VENDIDO NAO PODE VOLTAR — varredura, nao caso isolado.
 *
 * Este bug foi relatado DUAS vezes. Na 1.0.277 eu corrigi
 * `lib/use-user-roster.ts` e declarei resolvido; o jogador voltou a relatar na
 * 1.0.279 porque o hook so atende /elenco/gerenciamento e /partida/escalacao.
 * A pagina /elenco e a de escalacoes montavam o time com
 * `getPlayersForTeam(userTeam)`, que le o CADASTRO DO CLUBE e nao sabe nada de
 * venda, emprestimo ou leilao.
 *
 * Por isso este teste nao verifica uma tela: ele VARRE o codigo. Consertar um
 * caminho por vez foi exatamente o que deixou o bug vivo.
 *
 * Uma tela pode ler o cadastro quando o alvo NAO e o time do usuario
 * (adversario, catalogo do editor, estatisticas dos outros clubes) — por isso a
 * lista de excecoes abaixo e explicita e justificada, uma a uma.
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

let passou = 0
let falhou = 0
function ok(nome: string, cond: boolean, detalhe = "") {
  if (cond) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome}\n       ${detalhe}`) }
}

const RAIZ = path.resolve(import.meta.dirname, "..")

/**
 * Telas que PODEM ler o cadastro do clube, com o motivo. Qualquer arquivo fora
 * desta lista que leia o elenco do cadastro reprova — e a revisao e obrigatoria
 * antes de acrescentar linha aqui.
 */
const PERMITIDOS: Record<string, string> = {
  "app/adversarios/page.tsx": "elenco do ADVERSARIO — o motor so guarda o time do usuario",
  "app/competicoes/page.tsx": "squadDe() dos OUTROS clubes; o usuario entra por userRows",
  "app/estatisticas/page.tsx": "squadDe() dos OUTROS clubes; o usuario entra por userRows",
  "app/editar/page.tsx": "editor trabalha sobre o CATALOGO por definicao (raw:true)",
  "app/partida/ao-vivo/page.tsx": "buildSideFromData monta o ADVERSARIO; o usuario vem de enginePlayers",
  "components/tactical-editor.tsx": "componente sem nenhum importador (codigo morto)",
}

function varrer(dir: string, saida: string[] = []): string[] {
  for (const nome of readdirSync(path.join(RAIZ, dir))) {
    const rel = `${dir}/${nome}`
    const abs = path.join(RAIZ, rel)
    if (statSync(abs).isDirectory()) varrer(rel, saida)
    else if (/\.(ts|tsx)$/.test(nome)) saida.push(rel)
  }
  return saida
}

const arquivos = [...varrer("app"), ...varrer("components")]
console.log(`\nATLETA VENDIDO NAO VOLTA  (${arquivos.length} arquivos varridos)\n`)

/** Codigo sem comentarios — `getPlayersForTeam` citado em comentario nao conta. */
function semComentarios(src: string): string {
  return src.split("\n")
    .filter(l => !l.trim().startsWith("*") && !l.trim().startsWith("//") && !l.trim().startsWith("/*"))
    .join("\n")
}

/**
 * Uma tela esta CORRETA quando o cadastro so aparece atras de `carreiraViva`:
 * o motor manda na carreira, e o cadastro segue valendo para pre-visualizacao
 * de time (menu inicial), onde nao ha elenco no motor para consultar.
 */
function leOMotorPrimeiro(src: string): boolean {
  const codigo = semComentarios(src)
  return /useGameEngine\(\s*\(?\s*\w+\s*\)?\s*=>\s*\w+\.squadPlayers\s*\)/.test(codigo)
    && /carreiraViva/.test(codigo)
}

// 1. Ninguem pode montar o elenco do usuario SO a partir do cadastro.
{
  const infratores: string[] = []
  for (const rel of arquivos) {
    const src = readFileSync(path.join(RAIZ, rel), "utf-8")
    if (!/\bgetPlayersForTeam\s*\(/.test(semComentarios(src))) continue
    if (PERMITIDOS[rel.replace(/\\/g, "/")]) continue
    if (leOMotorPrimeiro(src)) continue   // usa o cadastro so como fallback
    infratores.push(rel)
  }
  ok("nenhuma tela monta o elenco do usuario so pelo cadastro",
    infratores.length === 0,
    infratores.length ? `revise: ${infratores.join(", ")}` : "")
}

// 2. As duas telas do relato leem o MOTOR primeiro.
{
  for (const rel of ["app/elenco/page.tsx", "app/elenco/escalacoes/page.tsx"]) {
    ok(`${rel} le o motor antes do cadastro`,
      leOMotorPrimeiro(readFileSync(path.join(RAIZ, rel), "utf-8")))
  }
}

// 3. O hook compartilhado (correcao da 1.0.277) continua de pe.
{
  const src = readFileSync(path.join(RAIZ, "lib/use-user-roster.ts"), "utf-8")
  ok("use-user-roster mantem a trava de carreira viva",
    /engineSquad\.length\s*>=\s*11\s*\|\|\s*carreiraViva/.test(src))
}

// 4. A lista de excecoes nao pode crescer sozinha: cada entrada existe mesmo.
{
  const fantasmas = Object.keys(PERMITIDOS).filter(rel => {
    try { statSync(path.join(RAIZ, rel)); return false } catch { return true }
  })
  ok("toda excecao aponta para um arquivo existente", fantasmas.length === 0, fantasmas.join(", "))
}

console.log(`\n${passou} ok, ${falhou} falha(s)\n`)
process.exit(falhou === 0 ? 0 : 1)
