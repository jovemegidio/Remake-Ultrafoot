/**
 * MODO CONTROLE — o que este teste protege.
 *
 * O sistema de controle tem uma característica ruim para quem mantém: quase
 * tudo nele só falha COM hardware na mão, e falha em silêncio. Um botão que
 * passa a significar outra coisa, uma deadzone que engole o movimento, uma
 * direção que dispara duas vezes — nada disso lança erro. O jogo só fica
 * "estranho no controle", e é impossível reproduzir lendo o código.
 *
 * Então este arquivo trava exatamente a parte que É testável sem hardware: a
 * lógica pura entre o aperto e a ação. O que sobra (o botão Xbox chegar ou não,
 * o DualSense por Bluetooth) está documentado como limitação real no relatório,
 * porque teste que finge cobrir hardware é pior do que teste nenhum.
 *
 * Os quatro riscos travados aqui:
 *
 *   1. ÍNDICE DE BOTÃO. `buttons[0]` é ✕ num DualSense com driver e □ num
 *      DualShock 4 por Bluetooth sem driver. Já custou o bug "meu controle de
 *      PlayStation faz a ação errada".
 *   2. DICA QUE MENTE. A barra ensina um botão e o jogo obedece a outro —
 *      `botaoDaAcao` e `resolverAcao` têm de ser inversas exatas.
 *   3. DRIFT. Analógico gasto ligando o Modo Controle sozinho.
 *   4. REPETIÇÃO. Um toque no D-pad andando duas casas.
 */
import { botaoDaAcao, resolverAcao, PADRAO, POR_CONTEXTO } from "../lib/input/bindings"
import { deadzoneRadial, direcaoDoEixo, DetectorDeIntencao } from "../lib/input/intent"
import { ControladorDeRepeticao } from "../lib/input/repeat"
import { vizinhoNaDirecao, ordemDeLeitura } from "../lib/focus/graph"
import { identificadoresDoId } from "../lib/controller/devices"
import { PERFIS, direcoesDoHat, TODOS_OS_BOTOES } from "../lib/controller/profiles"
import type { PhysicalButton } from "../lib/controller/profiles"
import type { InputContext } from "../lib/input/contexts"

let passou = 0
let falhou = 0
function ok(nome: string, cond: boolean, detalhe = "") {
  if (cond) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome} ${detalhe}`) }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 1. Índice de botão por perfil ──────────────────────────────")

// O caso que originou o bug: no DirectInput cru da Sony, o índice 0 é o botão
// da ESQUERDA (□), não o de baixo (✕).
ok(
  "standard: índice 0 é o botão de baixo",
  PERFIS.standard.botoes.FACE_DOWN === 0,
)
ok(
  "sony sem driver: índice 0 é o botão da ESQUERDA, não o de baixo",
  PERFIS.directinput_sony.botoes.FACE_LEFT === 0 && PERFIS.directinput_sony.botoes.FACE_DOWN === 1,
)
ok(
  "sony sem driver: D-pad não é botão (vem do hat switch)",
  PERFIS.directinput_sony.botoes.DPAD_UP === -1 && PERFIS.directinput_sony.hat === 9,
)
ok(
  "sony sem driver: analógico direito no eixo 5, não no 3 (lá está o gatilho)",
  PERFIS.directinput_sony.eixos.ry === 5,
)
ok(
  "xbox: botão central NÃO chega pelo webview (só pelo backend nativo)",
  PERFIS.xbox_one.centroNoWebview === false && PERFIS.xbox_series.centroNoWebview === false,
)
ok(
  "sony com driver: botão central chega pelo webview",
  PERFIS.dualsense.centroNoWebview === true,
)

// Hat switch: as oito posições precisam virar as quatro direções certas.
ok("hat: repouso não aciona nada", Object.keys(direcoesDoHat(1.28)).length === 0)
ok("hat: -1 é cima", direcoesDoHat(-1).DPAD_UP === true)
ok("hat: -0.5 é direita", direcoesDoHat(-0.5).DPAD_RIGHT === true)
ok("hat: 0 é baixo", direcoesDoHat(0).DPAD_DOWN === true)
ok("hat: 0.5 é esquerda", direcoesDoHat(0.5).DPAD_LEFT === true)

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 2. Amarração e dica batem ──────────────────────────────────")

const CONTEXTOS: InputContext[] = [
  "GLOBAL", "MENU", "DASHBOARD", "INBOX", "SQUAD", "PLAYER_PROFILE",
  "TACTICS", "TRANSFER", "SCOUTING", "MATCH", "MODAL", "QUICK_MENU",
]

// A garantia central: para todo botão e todo contexto, se o botão resolve para
// uma ação, o caminho inverso tem de devolver um botão que resolve para a MESMA
// ação. Sem isso a barra de dicas ensina errado — e ninguém percebe olhando o
// código, porque as duas tabelas parecem certas separadamente.
let inversaQuebrada = 0
for (const contexto of CONTEXTOS) {
  for (const botao of TODOS_OS_BOTOES) {
    const acao = resolverAcao(botao, contexto)
    if (!acao) continue
    const deVolta = botaoDaAcao(acao, contexto)
    if (!deVolta || resolverAcao(deVolta, contexto) !== acao) {
      inversaQuebrada++
      console.log(`       ${contexto}/${botao} → ${acao} → ${deVolta}`)
    }
  }
}
ok("resolverAcao e botaoDaAcao são inversas em todo contexto", inversaQuebrada === 0)

ok(
  "menu: botão de baixo confirma, botão da direita volta",
  resolverAcao("FACE_DOWN", "MENU") === "UI_CONFIRM" &&
  resolverAcao("FACE_RIGHT", "MENU") === "UI_BACK",
)

// A partida precisa de conjunto PRÓPRIO: confirmar/voltar no meio de um lance
// seria acionar menu invisível.
ok(
  "partida: o losango vira ação de jogo, não confirmar/voltar",
  resolverAcao("FACE_DOWN", "MATCH") === "MATCH_SPEED_UP" &&
  resolverAcao("FACE_RIGHT", "MATCH") === "MATCH_SPEED_DOWN",
)
ok(
  "partida: Menu/Options pausa (não abre menu de tela)",
  resolverAcao("START", "MATCH") === "MATCH_PAUSE",
)

// Modal: ombros não podem vazar para a tela de trás trocando aba escondida.
ok(
  "modal: ombros navegam dentro do modal, não trocam aba atrás dele",
  resolverAcao("SHOULDER_L", "MODAL") === "UI_UP" &&
  resolverAcao("SHOULDER_R", "MODAL") === "UI_DOWN",
)

ok(
  "botão central é ativação do Modo Controle em todo contexto",
  CONTEXTOS.every(c => resolverAcao("CENTER", c) === "TOGGLE_INPUT_MODE"),
)

// Preferência do jogador vence a do jogo — base do remapeamento.
ok(
  "amarração do jogador vence a do jogo",
  resolverAcao("FACE_DOWN", "MENU", { PADRAO: { FACE_DOWN: "OPEN_DETAILS" } }) === "OPEN_DETAILS",
)
ok(
  "amarração do jogador por contexto vence a dele mesmo no padrão",
  resolverAcao("FACE_DOWN", "SQUAD", {
    PADRAO: { FACE_DOWN: "OPEN_DETAILS" },
    SQUAD: { FACE_DOWN: "SEARCH" },
  }) === "SEARCH",
)

// Nenhum contexto pode redefinir o botão central: seria criar uma tela em que o
// jogador não consegue mais ligar o Modo Controle.
ok(
  "nenhum contexto sequestra o botão central",
  Object.values(POR_CONTEXTO).every(t => t?.CENTER === undefined),
)
ok("o padrão define confirmar e voltar", PADRAO.FACE_DOWN === "UI_CONFIRM" && PADRAO.FACE_RIGHT === "UI_BACK")

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 3. Drift e intenção ────────────────────────────────────────")

// Valores medidos em analógicos gastos: repouso entre 0.03 e 0.12.
for (const drift of [0.02, 0.05, 0.08, 0.12]) {
  const r = deadzoneRadial(drift, 0, 0.18)
  ok(`drift ${drift} é engolido pela zona morta`, r.x === 0 && r.y === 0)
}

// Zona morta RADIAL, não quadrada: na diagonal o quadrado exigiria 1,41x mais
// curso e a navegação diagonal falharia enquanto a reta funciona.
{
  const diagonal = deadzoneRadial(0.13, 0.13, 0.18) // magnitude ≈ 0.184
  ok("diagonal logo acima do raio passa (zona morta é círculo, não quadrado)",
    diagonal.x !== 0 || diagonal.y !== 0)
  const porEixo = Math.abs(0.13) < 0.18 // o que a versão ingênua faria
  ok("...e a versão por eixo teria engolido esse mesmo movimento", porEixo === true)
}

// Reescalonamento: o primeiro milímetro útil não pode nascer valendo 0.18.
{
  const logoAcima = deadzoneRadial(0.19, 0, 0.18)
  ok("saída da zona morta começa perto de zero, não com salto",
    logoAcima.x > 0 && logoAcima.x < 0.05)
  const cheio = deadzoneRadial(1, 0, 0.18)
  ok("curso cheio continua chegando a 1", Math.abs(cheio.x - 1) < 0.001)
}

{
  const d = new DetectorDeIntencao()
  ok("drift NÃO assume o Modo Controle", d.eixoDoControle(0.12, 0.08) === false)
  ok("meio curso ainda NÃO assume o Modo Controle", d.eixoDoControle(0.4, 0) === false)
  ok("movimento franco assume o Modo Controle", d.eixoDoControle(0.9, 0) === true)

  // Mouse: tremor de mesa não pode derrubar o Modo Controle.
  let derrubou = false
  for (let i = 0; i < 10; i++) derrubou = derrubou || d.mouseMoveu(1, 0, 1000 + i * 10)
  ok("tremor de 1 px não volta para o mouse", derrubou === false)
  ok("movimento franco volta para o mouse", d.mouseMoveu(30, 0, 1100) === true)

  // Fora da janela, o acumulado zera — senão 1 px por minuto somaria 24 px ao
  // longo da sessão e derrubaria o modo do nada.
  const d2 = new DetectorDeIntencao()
  let derrubouLento = false
  for (let i = 0; i < 40; i++) derrubouLento = derrubouLento || d2.mouseMoveu(2, 0, i * 1000)
  ok("2 px por segundo nunca acumula até trocar de modo", derrubouLento === false)
}

// Direção: a diagonal não pode disparar dois eixos no mesmo quadro.
ok("diagonal resolve para UM eixo só", direcaoDoEixo(0.7, 0.71) === "down")
ok("eixo abaixo do limiar não vira direção", direcaoDoEixo(0.3, 0.2) === null)

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 4. Repetição ───────────────────────────────────────────────")

{
  const r = new ControladorDeRepeticao({ atrasoInicialMs: 250, intervaloMs: 70 })
  ok("aperto dispara na hora", r.consultar("down", true, 0) === "inicial")
  ok("100 ms depois ainda não repete", r.consultar("down", true, 100) === null)
  ok("240 ms depois ainda não repete (o toque normal dura ~250 ms)",
    r.consultar("down", true, 240) === null)
  ok("260 ms depois repete", r.consultar("down", true, 260) === "repeticao")
  ok("logo em seguida não repete de novo", r.consultar("down", true, 300) === null)
  ok("70 ms depois repete", r.consultar("down", true, 331) === "repeticao")
  ok("soltar zera", r.consultar("down", false, 400) === null)
  ok("apertar de novo dispara na hora", r.consultar("down", true, 410) === "inicial")

  // O caso concreto: um toque de 250 ms tem de valer UM passo, não dois.
  const r2 = new ControladorDeRepeticao()
  let passos = 0
  for (let t = 0; t <= 250; t += 16) if (r2.consultar("d", true, t)) passos++
  ok("um toque de 250 ms anda exatamente uma casa", passos === 1, `(andou ${passos})`)
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 5. Navegação espacial ──────────────────────────────────────")

// A tabela de elenco: célula larga de nome, células estreitas ao lado. Descer
// tem de manter a COLUNA, não pular para a vizinha por estar mais perto.
{
  const r = (left: number, top: number, w: number, h: number) =>
    ({ left, top, right: left + w, bottom: top + h })

  const nome1 = { item: "nome-1", rect: r(0, 40, 300, 40) }
  const idade2 = { item: "idade-2", rect: r(300, 80, 60, 40) }
  const nome2 = { item: "nome-2", rect: r(0, 80, 300, 40) }

  ok(
    "descer na coluna 'Nome' vai para o Nome de baixo, não para a coluna vizinha",
    vizinhoNaDirecao(nome1.rect, [idade2, nome2], "down") === "nome-2",
  )

  // Card alto ao lado de baixos: descer pelos baixos não pode pegar o alto.
  const baixo1 = { item: "baixo-1", rect: r(0, 0, 100, 50) }
  const alto = { item: "alto", rect: r(120, 0, 100, 300) }
  const baixo2 = { item: "baixo-2", rect: r(0, 60, 100, 50) }
  ok(
    "card alto ao lado não rouba o movimento para baixo",
    vizinhoNaDirecao(baixo1.rect, [alto, baixo2], "down") === "baixo-2",
  )

  ok("sem candidato adiante, devolve nulo", vizinhoNaDirecao(baixo2.rect, [baixo1], "down") === null)

  // Ordem de leitura: dois botões com 1 px de diferença são a MESMA linha.
  const a = { item: "a", rect: r(0, 100, 80, 30) }
  const b = { item: "b", rect: r(90, 101, 80, 30) }
  const c = { item: "c", rect: r(0, 200, 80, 30) }
  ok("ordem de leitura não serpenteia por 1 px de diferença",
    ordemDeLeitura([c, b, a]).join(",") === "a,b,c")
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 6. Identificação por VendorId/ProductId ────────────────────")

// Os dois formatos que o Chromium usa em campo.
{
  const win = identificadoresDoId("Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)")
  ok("formato Windows/Linux", win.vendorId === 0x054c && win.productId === 0x0ce6)

  const mac = identificadoresDoId("054c-09cc-Wireless Controller")
  ok("formato macOS/Chromium antigo", mac.vendorId === 0x054c && mac.productId === 0x09cc)

  // Xbox por XInput não traz identificação nenhuma — e isso é o esperado, não
  // um defeito. O teste existe para que ninguém "conserte" inventando um valor.
  const xbox = identificadoresDoId("Xbox 360 Controller (XInput STANDARD GAMEPAD)")
  ok("XInput não informa identificação (limitação real, não bug)",
    xbox.vendorId === null && xbox.productId === null)
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 7. Cobertura do vocabulário ────────────────────────────────")

// Perfil que esquece um botão faz esse botão sumir em silêncio naquele controle.
for (const [id, perfil] of Object.entries(PERFIS)) {
  const faltando = TODOS_OS_BOTOES.filter(b => perfil.botoes[b as PhysicalButton] === undefined)
  ok(`perfil "${id}" declara todos os botões`, faltando.length === 0, faltando.join(","))
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${falhou === 0 ? "PASSOU" : "FALHOU"} — ${passou} ok, ${falhou} falha(s)\n`)
process.exit(falhou === 0 ? 0 : 1)
