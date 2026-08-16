/**
 * PROVA DA NAVEGACAO POR CONTROLE (1.0.334)
 *
 * 47 das 64 telas nao respondiam ao gamepad. A saida nao foi editar 47 arquivos:
 * foi uma camada global que navega pelo DOM quando a tela nao tem handler
 * proprio (components/gamepad-navegacao-global.tsx). O risco dessa abordagem e
 * um so — a escolha do vizinho. Se ela erra, o foco pula para o outro canto da
 * tela e o jogador desiste do controle.
 *
 * Este teste prova a escolha com as formas de tela que o jogo tem de verdade:
 * menu em coluna, grade de cartas, barra de abas e formulario de duas colunas.
 *
 *   npx tsx scripts/test-gamepad-navegacao.ts
 */
import { escolherVizinho, type Caixa } from "../components/gamepad-navegacao-global"

let falhas = 0
const checar = (nome: string, ok: boolean, detalhe = "") => {
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}${detalhe ? " — " + detalhe : ""}`)
  if (!ok) falhas++
}
const caixa = (left: number, top: number, width = 120, height = 40): Caixa => ({ left, top, width, height })

/** MENU EM COLUNA — descer vai para o item de baixo, subir para o de cima. */
function menuEmColuna() {
  const itens = [caixa(40, 100), caixa(40, 160), caixa(40, 220)]
  checar("menu: desce um item", escolherVizinho(itens[0], itens.slice(1), "down") === 0)
  checar("menu: sobe um item", escolherVizinho(itens[2], [itens[0], itens[1]], "up") === 1)
  checar("menu: no fim nao ha para onde descer", escolherVizinho(itens[2], [itens[0], itens[1]], "down") === -1)
}

/**
 * GRADE DE CARTAS (elenco) — 3 colunas x 2 linhas. Descer TEM de manter a
 * coluna; e aqui que a heuristica errada joga o foco no canto oposto.
 */
function gradeDeCartas() {
  const grade = [
    caixa(0, 0, 100, 140), caixa(120, 0, 100, 140), caixa(240, 0, 100, 140),
    caixa(0, 160, 100, 140), caixa(120, 160, 100, 140), caixa(240, 160, 100, 140),
  ]
  const semAtual = (i: number) => grade.filter((_, j) => j !== i)
  const abaixo = semAtual(1)
  const escolhido = escolherVizinho(grade[1], abaixo, "down")
  checar("grade: desce na MESMA coluna", abaixo[escolhido] === grade[4], `caiu em left=${abaixo[escolhido]?.left}`)
  const aoLado = semAtual(0)
  const dir = escolherVizinho(grade[0], aoLado, "right")
  checar("grade: direita anda na MESMA linha", aoLado[dir] === grade[1], `caiu em top=${aoLado[dir]?.top}`)
}

/** BARRA DE ABAS — andar para o lado nao pode cair no conteudo de baixo. */
function barraDeAbas() {
  const abas = [caixa(0, 0, 90, 32), caixa(100, 0, 90, 32), caixa(200, 0, 90, 32)]
  const candidatos = [abas[1], abas[2], caixa(0, 80, 400, 300)]
  const i = escolherVizinho(abas[0], candidatos, "right")
  checar("abas: direita fica na barra", candidatos[i] === abas[1])
}

/**
 * FORMULARIO DE DUAS COLUNAS — descer segue a coluna, mesmo com o campo da
 * outra coluna estando mais perto na diagonal.
 */
function formularioDuasColunas() {
  const esq = [caixa(0, 0, 200, 40), caixa(0, 70, 200, 40)]
  const dir = [caixa(220, 30, 200, 40), caixa(220, 100, 200, 40)]
  const candidatos = [dir[0], esq[1], dir[1]]
  const i = escolherVizinho(esq[0], candidatos, "down")
  checar("formulario: desce na propria coluna", candidatos[i] === esq[1], `caiu em left=${candidatos[i]?.left}`)
}

/** LISTA LONGA — todos os itens visiveis descem de um em um, sem pular. */
function listaLonga() {
  const lista = Array.from({ length: 12 }, (_, i) => caixa(0, i * 48, 600, 40))
  let atual = 0
  let passos = 0
  for (let n = 0; n < 20; n++) {
    const outros = lista.filter((_, j) => j !== atual)
    const i = escolherVizinho(lista[atual], outros, "down")
    if (i < 0) break
    const proximo = lista.indexOf(outros[i])
    if (proximo !== atual + 1) {
      checar(`lista: passo ${n} pulou item`, false, `${atual} -> ${proximo}`)
      break
    }
    atual = proximo
    passos++
  }
  checar("lista: percorre os 11 itens um a um", passos === 11, `${passos} passos`)
}

menuEmColuna()
gradeDeCartas()
barraDeAbas()
formularioDuasColunas()
listaLonga()

// Sem candidato na direcao -> -1 (a camada rola a tela e tenta de novo).
checar("sem vizinho devolve -1", escolherVizinho(caixa(0, 0), [caixa(0, -100)], "down") === -1)
checar("lista vazia devolve -1", escolherVizinho(caixa(0, 0), [], "left") === -1)

console.log(falhas === 0 ? "\nNAVEGACAO OK" : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
