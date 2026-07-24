// O modo economico precisa REALMENTE desligar o que pesa.
//
// Tres defeitos que este teste tranca:
//  1. Escolher "Economico" na tela de configuracoes ligava so metade do modo:
//     o CSS pesado (sombra/video/camadas do escritorio) fica atras de OUTRO
//     atributo (`data-performance-mode`) que so a deteccao automatica ligava.
//  2. O CSS economico so cobria backdrop-blur ate o -xl, deixando passar
//     -2xl/-3xl e os valores arbitrarios, que sao os mais caros.
//  3. O framer-motion anima em JS e ignora o CSS do perfil — precisa do
//     MotionConfig para parar de trabalhar por quadro.

import { readFileSync } from "node:fs"
import { join } from "node:path"

const raiz = process.cwd()
const ler = (p: string) => readFileSync(join(raiz, p), "utf8")

let falhas = 0
const check = (ok: boolean, msg: string) => {
  if (!ok) { falhas++; console.log(`  FALHA: ${msg}`) }
}

console.log("== Perfil de desempenho ==")

// 1) O economico liga os DOIS interruptores.
const perfil = ler("components/performance-profile.tsx")
check(
  /toggleAttribute\("data-performance-mode",\s*profile === "economy"\)/.test(perfil),
  "applyPerformanceProfile deve ligar data-performance-mode no economico",
)
check(/dataset\.performance = profile/.test(perfil), "deve setar data-performance")

// 2) A escolha do jogador vence a deteccao automatica.
check(/PERFORMANCE_CHOICE_KEY/.test(perfil), "deve marcar quando a escolha veio do jogador")
check(
  /escolhaDoJogador\s*\|\|\s*profile === "economy"/.test(perfil),
  "o vigia nao pode rodar sobre escolha manual nem sobre quem ja esta no economico",
)

// 3) Existe medicao real de fluidez, nao so ficha tecnica.
check(/requestAnimationFrame/.test(perfil), "deve medir tempo de quadro real")
check(/mediana/.test(perfil), "deve usar mediana (um engasgo isolado nao condena a maquina)")

// 4) O CSS economico cobre TODO backdrop-blur, nao so ate o -xl.
const css = ler("app/globals.css")
const blocoEconomico = css.slice(css.indexOf('html[data-performance="economy"]'))
check(
  /\[class\*="backdrop-blur"\]/.test(blocoEconomico),
  "economico deve zerar backdrop-blur por seletor de atributo (pega -2xl, -3xl e arbitrarios)",
)
check(/box-shadow:\s*none/.test(blocoEconomico), "economico deve zerar sombra pesada")
check(/filter:\s*none/.test(blocoEconomico), "economico deve zerar blur/drop-shadow em filter")

// 5) O framer-motion obedece ao perfil.
const motion = ler("components/motion-profile.tsx")
check(/MotionConfig/.test(motion), "deve usar MotionConfig do framer-motion")
check(
  /reducedMotion=\{[^}]*"always"/.test(motion),
  'economico deve passar reducedMotion="always" (framer-motion ignora o CSS)',
)
const layout = ler("app/layout.tsx")
check(/MotionProfileProvider/.test(layout), "o provider precisa estar montado no layout")

// 6) O provider tem que envolver as TELAS, nao ficar solto num canto.
check(
  /<MotionProfileProvider>\{children\}<\/MotionProfileProvider>/.test(layout.replace(/\s+/g, " ").replace(/\{\/\*.*?\*\/\}/g, "")),
  "MotionProfileProvider precisa envolver {children}",
)

console.log(falhas === 0 ? "\nOK — modo economico desliga CSS pesado E animacao em JS" : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
