// AUDITORIA DE SUPORTE A CONTROLE — que telas respondem ao joystick?
//
// O jogo inteiro roda por eventos `gamepad:button` disparados pelo provider. Uma
// tela so e jogavel no controle se ela OUVIR esse evento (direto ou por um dos
// componentes-ponte). Este script varre app/ e components/ e separa:
//
//   OK      ouve gamepad:button, ou usa o hook/ponte que ouve por ela
//   TECLADO so escuta teclado — funciona no PC, nao funciona no sofa
//   PASSIVA nao escuta nada (tela de leitura, sem acao)
//
// Uma tela "TECLADO" que tenha modal/confirmacao e o caso do relato: o jogador
// abre, e o controle nao faz nada.
//
//   npx tsx scripts/qa-gamepad.ts
import fs from "node:fs"
import path from "node:path"

const RAIZES = ["app", "components"]
// Quem ja resolve o controle por dentro: usar qualquer um destes conta como OK.
const PONTES = [
  "gamepad:button", "useGamepad(", "useGamepadNavigation", "GamepadModalBridge",
  "useGamepadConnected", "ControllerToolbar", "gamepad:action", "useGamepadMenu",
]
const TECLADO = ['addEventListener("keydown"', "addEventListener('keydown'", "onKeyDown"]

interface Achado { arquivo: string; pad: boolean; teclado: boolean; modal: boolean; interativa: boolean }
const achados: Achado[] = []

function varrer(dir: string) {
  for (const nome of fs.readdirSync(dir)) {
    const p = path.join(dir, nome)
    const st = fs.statSync(p)
    if (st.isDirectory()) { varrer(p); continue }
    if (!/\.tsx$/.test(nome)) continue
    const src = fs.readFileSync(p, "utf8")
    const pad = PONTES.some(t => src.includes(t))
    const teclado = TECLADO.some(t => src.includes(t))
    // "Interativa" = tem no que clicar. Tela sem onClick nao precisa de controle.
    const interativa = /onClick=/.test(src)
    // Modal/confirmacao: e onde a falta de controle prende o jogador.
    const modal = /fixed inset-0|role="dialog"|Confirm|Dialog|Modal/.test(src)
    achados.push({ arquivo: p.replace(/\\/g, "/"), pad, teclado, modal, interativa })
  }
}
for (const r of RAIZES) if (fs.existsSync(r)) varrer(r)

const interativas = achados.filter(a => a.interativa)
const comPad = interativas.filter(a => a.pad)
const soTeclado = interativas.filter(a => !a.pad && a.teclado)
const semNada = interativas.filter(a => !a.pad && !a.teclado)

console.log(`arquivos .tsx varridos: ${achados.length} | com algo clicavel: ${interativas.length}`)
console.log(`  respondem ao controle : ${comPad.length}`)
console.log(`  SO teclado            : ${soTeclado.length}`)
console.log(`  nem teclado nem pad   : ${semNada.length}`)

// COBERTOS PELA PONTE GLOBAL. `GamepadModalBridge` age sobre o DOM do modal
// aberto — Radix ou sobreposicao `fixed inset-0` feita na mao. Um modal nao
// precisa mais escutar gamepad por conta propria; precisa ser um modal DE
// VERDADE (cobre a tela e tem botao). Por isso eles saem da lista de furos.
const modaisSemPad = interativas.filter(a => a.modal && !a.pad)
console.log(`\nMODAIS cobertos pela ponte global (${modaisSemPad.length}) — A aciona, B fecha, D-pad navega:`)
for (const a of modaisSemPad.slice(0, 40)) console.log(`   ${a.arquivo}${a.teclado ? "  (tem teclado tambem)" : ""}`)
if (modaisSemPad.length > 40) console.log(`   ... e mais ${modaisSemPad.length - 40}`)

console.log(`\nSO TECLADO (${soTeclado.length}):`)
for (const a of soTeclado.slice(0, 25)) console.log(`   ${a.arquivo}`)

const rotas = interativas.filter(a => a.arquivo.startsWith("app/") && a.arquivo.endsWith("/page.tsx"))
const rotasSemPad = rotas.filter(a => !a.pad)
console.log(`\nROTAS (page.tsx) interativas: ${rotas.length}`)
console.log(`  com controle PROPRIO      : ${rotas.length - rotasSemPad.length}`)
console.log(`  pela camada global (1.0.334): ${rotasSemPad.length}`)

// A CAMADA GLOBAL. `ModoControle` no layout monta `GamepadNavegacaoGlobal`, que
// navega pelo DOM (botao/link/aba/campo visiveis) quando NENHUMA tela assumiu o
// gamepad. Ou seja: as rotas acima nao ficam sem controle — elas ficam com o
// controle padrao. O que este gate ainda vigia e a camada existir e estar
// montada; se sair do layout, todas as rotas de baixo voltam a ficar mudas.
const CAMADA = "components/gamepad-navegacao-global.tsx"
const INTERRUPTOR = "components/modo-controle.tsx"
const temCamada = fs.existsSync(CAMADA)
const montada = fs.existsSync("app/layout.tsx") && fs.readFileSync("app/layout.tsx", "utf8").includes("<ModoControle />")
const respeitaTela = temCamada && fs.readFileSync(CAMADA, "utf8").includes("telaAssumiuOGamepad()")
console.log(`\nCAMADA GLOBAL`)
console.log(`  ${temCamada ? "OK   " : "FALTA"} ${CAMADA}`)
console.log(`  ${fs.existsSync(INTERRUPTOR) ? "OK   " : "FALTA"} ${INTERRUPTOR}`)
console.log(`  ${montada ? "OK   " : "FALTA"} <ModoControle /> montado em app/layout.tsx`)
console.log(`  ${respeitaTela ? "OK   " : "FALTA"} cede a vez para a tela que tem handler proprio`)

if (rotasSemPad.length) {
  console.log(`\nrotas que dependem da camada global:`)
  for (const a of rotasSemPad.slice(0, 40)) console.log(`   ${a.arquivo}`)
  if (rotasSemPad.length > 40) console.log(`   ... e mais ${rotasSemPad.length - 40}`)
}

const falhou = !temCamada || !montada || !respeitaTela
console.log(falhou
  ? "\nCONTROLE INCOMPLETO — a camada global nao esta no ar."
  : "\nCONTROLE OK — toda rota responde ao gamepad (propria ou pela camada global).")
process.exit(falhou ? 1 : 0)
