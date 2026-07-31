"""Converte o Pitch Engine PRO (HTML solto) no motor do jogo.

    python scripts/converter-motor-3d.py

    docs/prototipos/simulacao-partida-3d.html  ->  lib/partida-3d/motor.js

Por que um SCRIPT e nao edicao a mao: sao 3.163 linhas. Um script torna a
conversao auditavel (da para ver exatamente o que mudou e por que), repetivel
(se chegar uma versao nova do HTML, e um comando) e reversivel. Editar a mao
tornaria impossivel saber, meses depois, o que e do autor e o que e nosso.

O PRINCIPIO: mexer o MINIMO no corpo do motor. Toda a fisica, IA, regras e
render ficam byte a byte iguais. So muda o que impede rodar dentro do React:

  1. THREE global  -> import de 'three' (o motor usa `THREE.x`; damos o namespace)
  2. sRGBEncoding  -> SRGBColorSpace   (removido no r152; sem isso a cor sai errada)
  3. loop e listeners -> cancelaveis, para desmontar sem vazar
  4. boot por botao -> chamada de funcao, porque quem manda agora e o React

Cada troca declara quantas ocorrencias espera. Se o HTML mudar e a conta nao
bater, o script ABORTA em vez de gerar um motor pela metade — falhar alto e
melhor do que um jogo que renderiza errado sem ninguem entender por que.
"""
import pathlib
import re
import sys

raiz = pathlib.Path(__file__).resolve().parent.parent
origem = raiz / "docs" / "prototipos" / "simulacao-partida-3d.html"

if not origem.exists():
    raise SystemExit(f"ABORTADO: nao achei o HTML de origem em {origem}")

# ── extracao ──────────────────────────────────────────────────────────────────
# O HTML tem dois <script>: a lib three.js embutida (603 KB, descartada — agora
# vem do npm) e o motor. O motor abre com um guard `if(!window.THREE){...} else {`
# e o corpo real e o miolo do else.
_html = origem.read_text(encoding="utf-8", errors="replace")
_i = _html.find('<script id="engine">')
if _i < 0:
    raise SystemExit('ABORTADO: <script id="engine"> nao encontrado no HTML')
_i = _html.find(">", _i) + 1
_eng = _html[_i:_html.find("</script>", _i)]

_ini = _eng.find("} else {")
if _ini < 0:
    raise SystemExit("ABORTADO: guard `} else {` nao encontrado")
src = _eng[_ini + len("} else {"):].rstrip()
if not src.endswith("}"):
    raise SystemExit("ABORTADO: o corpo do motor nao termina com `}`")
src = src[:-1].rstrip()

mudancas = []


def troca(padrao, novo, rotulo, regex=True, esperado=None):
    global src
    antes = src
    n = len(re.findall(padrao, src)) if regex else src.count(padrao)
    src = re.sub(padrao, novo, src) if regex else src.replace(padrao, novo)
    if esperado is not None and n != esperado:
        raise SystemExit(f"ABORTADO: '{rotulo}' esperava {esperado} ocorrencia(s), achou {n}")
    if antes != src:
        mudancas.append((rotulo, n))
    return n


# ── 1. COLOR SPACE ────────────────────────────────────────────────────────────
# r128 usava `texture.encoding = THREE.sRGBEncoding`. Do r152 em diante isso e
# `texture.colorSpace = THREE.SRGBColorSpace`. A propriedade antiga simplesmente
# nao existe mais: atribuir a ela nao lanca erro, so nao faz nada — e o jogo sai
# com as cores lavadas. E o tipo de bug que passa despercebido, entao trocamos.
troca(r"\.encoding\s*=\s*THREE\.sRGBEncoding", ".colorSpace=THREE.SRGBColorSpace",
      "textura: .encoding -> .colorSpace", esperado=8)
troca(r"renderer\.outputEncoding\s*=\s*THREE\.sRGBEncoding",
      "renderer.outputColorSpace=THREE.SRGBColorSpace",
      "renderer: outputEncoding -> outputColorSpace", esperado=1)

# ── 2. CICLO DE VIDA DO LOOP ──────────────────────────────────────────────────
# `requestAnimationFrame(frame)` sem guardar o id nao tem como ser cancelado.
# Numa SPA isso significa: sai da tela da partida, o loop continua rodando com a
# GPU ligada; entra de novo, agora sao dois loops. Guardamos o id e paramos.
troca(r"function frame\(now\)\{\s*requestAnimationFrame\(frame\);",
      "function frame(now){\n  if(_destruido) return;\n  _rafId=requestAnimationFrame(frame);",
      "loop: guarda o id do rAF e para quando destruido", esperado=1)

# ── 3. LISTENERS GLOBAIS ──────────────────────────────────────────────────────
# `addEventListener` solto gruda em window e sobrevive a desmontagem. Passamos
# por um registrador que lembra de cada um para remover no destruir().
troca(r"(?<![.\w])addEventListener\('resize'", "_on(window,'resize'",
      "listener resize -> registrado", esperado=1)
troca(r"(?<![.\w])addEventListener\('keydown'", "_on(window,'keydown'",
      "listener keydown -> registrado", esperado=1)
troca(r"(?<![.\w])addEventListener\('mouseup'", "_on(window,'mouseup'",
      "listener mouseup -> registrado", esperado=1)
troca(r"(?<![.\w])addEventListener\('mousemove'", "_on(window,'mousemove'",
      "listener mousemove -> registrado", esperado=1)
troca(r"el\.addEventListener\('mousedown'", "_on(el,'mousedown'",
      "listener mousedown -> registrado", esperado=1)
troca(r"el\.addEventListener\('wheel'", "_on(el,'wheel'",
      "listener wheel -> registrado", esperado=1)

# ── 4. BOOT ───────────────────────────────────────────────────────────────────
# O bloco original espera um botao "GO" no DOM e so entao monta a cena. Dentro do
# jogo quem decide a hora e o React, entao trocamos o IIFE do botao por uma
# funcao exportada. O `addEventListener('error')` de diagnostico tambem sai: numa
# SPA ele capturaria erros do app inteiro, nao so da simulacao.
i_boot = src.find("(function initBoot(){")
if i_boot < 0:
    raise SystemExit("ABORTADO: initBoot nao encontrado")
src = src[:i_boot].rstrip() + "\n"
mudancas.append(("boot por botao -> funcao iniciar() controlada pelo React", 1))

# `frame` agora e disparado por iniciar(), nao na carga do arquivo.
CABECA = '''// PITCH ENGINE PRO — motor 3D da partida.
//
// GERADO por scripts/converter-motor-3d.py a partir de simulacao-partida-3d.html.
// NAO EDITE A MAO: rode o script de novo. Ele existe para que a conversao seja
// auditavel e repetivel — se chegar uma versao nova do HTML, e um comando.
//
// O QUE MUDOU em relacao ao HTML original (e so isto):
//
//   1. `THREE` global          -> import de 'three'
//   2. `sRGBEncoding`          -> `SRGBColorSpace` (removido no r152; sem a troca
//                                 o jogo renderiza com as cores lavadas)
//   3. loop e listeners        -> cancelaveis, senao sair da tela deixa a WebGL
//                                 viva e entrar de novo cria um segundo motor
//   4. boot pelo botao "GO"    -> `iniciar()`, porque quem decide a hora agora
//                                 e o React
//
// Fisica, IA, regras, arbitragem, replay e render continuam BYTE A BYTE iguais
// ao original. Se algo divergir do HTML, e bug da conversao, nao do motor.
//
// O HUD e desenhado pelo React (components/partida/campo-3d.tsx). O motor
// escreve nos elementos por id quando eles existem; quando nao existem, o helper
// `$` devolve um objeto inerte (`DEAD`) e a simulacao segue. Esse cuidado ja
// vinha do autor original — foi o que tornou esta migracao segura.

import * as THREE from "three"

/**
 * Cria uma instancia do motor. Os tipos publicos estao em motor.d.ts.
 * @param {import("./motor").OpcoesMotor} opcoes
 * @returns {import("./motor").Motor}
 */
export function criarMotor(opcoes) {
'''

RODAPE = '''
  // ── ciclo de vida ───────────────────────────────────────────────────────────

  async function iniciar(){
    if(_destruido) return
    // A montagem e fatiada em passos com rAF entre eles para a barra de
    // progresso realmente andar. Rodar tudo de uma vez travaria a aba por
    // segundos e a barra pularia de 0 a 100.
    await new Promise((resolve, reject) => {
      let i = 0
      ;(function proximo(){
        if(_destruido) return resolve()
        if(i >= steps.length) return resolve()
        const [rotulo, fn] = steps[i]
        opcoes.aoProgredir?.(Math.round(i / steps.length * 100), rotulo)
        _rafId = requestAnimationFrame(() => {
          if(_destruido) return resolve()
          try { fn() } catch(err){ return reject(err) }
          i++
          _timers.push(window.setTimeout(proximo, 14))
        })
      })()
    })
    if(_destruido) return
    opcoes.aoProgredir?.(100, "pronto")
    started = true
    last = performance.now()
    Audio2.whistle(false)
    _rafId = requestAnimationFrame(frame)
    opcoes.aoIniciar?.()
  }

  function destruir(){
    if(_destruido) return
    _destruido = true
    started = false

    if(_rafId != null) cancelAnimationFrame(_rafId)
    _timers.forEach(t => clearTimeout(t))
    _timers.length = 0

    // Listeners primeiro: sem isto, um resize depois da desmontagem chamaria
    // codigo que espera um renderer que ja nao existe.
    _listeners.forEach(([alvo, evento, fn]) => alvo.removeEventListener(evento, fn))
    _listeners.length = 0

    // A GPU nao libera sozinha. Sem dispose(), cada partida jogada deixa
    // texturas e geometrias para tras ate o navegador matar o contexto.
    try {
      scene?.traverse((o) => {
        o.geometry?.dispose?.()
        const m = o.material
        if(Array.isArray(m)) m.forEach((x) => descartarMaterial(x))
        else if(m) descartarMaterial(m)
      })
      renderer?.dispose?.()
      renderer?.forceContextLoss?.()
      const cv = renderer?.domElement
      if(cv?.parentNode) cv.parentNode.removeChild(cv)
    } catch { /* ja descartado */ }

    try { Audio2?.close?.() } catch { /* audio pode nem ter iniciado */ }
  }

  function descartarMaterial(m){
    for(const k in m){
      const v = m[k]
      if(v && typeof v === "object" && typeof v.dispose === "function" && v.isTexture) v.dispose()
    }
    m.dispose?.()
  }

  return {
    iniciar,
    destruir,
    get destruido(){ return _destruido },
  }
}
'''

PROLOGO = '''  // Estado do ciclo de vida. Fica no fecho da funcao, e nao no escopo do modulo,
  // para que duas instancias do motor nunca disputem as mesmas variaveis.
  let _destruido = false
  let _rafId = null
  const _timers = []
  const _listeners = []

  /** addEventListener que lembra do que registrou, para destruir() limpar. */
  function _on(alvo, evento, fn, opts){
    alvo.addEventListener(evento, fn, opts)
    _listeners.push([alvo, evento, fn])
  }

  // O motor original procurava o palco pelo id "stage". Agora ele vem por
  // parametro: o React e dono do DOM e pode montar a partida em qualquer lugar.
  const _palco = opcoes.palco

  // Formacao vinda do 2D, convertida em `formacaoDo2D`. Fica `null` quando a
  // tela nao passa nada, e o motor usa a `FORMATION` embutida — um 3D sem
  // formacao nao pode acontecer so porque o dado nao chegou.
  let _formacaoAtiva = null
  const QUALITY_INICIAL = opcoes.qualidade
    ?? (matchMedia?.("(pointer:coarse)").matches ? "mid" : "high")

'''

src = CABECA + PROLOGO + src + RODAPE

# ── PALCO ─────────────────────────────────────────────────────────────────────
# O motor resolve o elemento host com fallback para `document.body`. Isso e
# traicoeiro aqui: sem `#stage` no DOM o canvas ia parar no body — fora do
# componente React, cobrindo a tela inteira e imune ao unmount. Aconteceu de
# verdade na primeira versao deste script; o teste de navegador pegou, o
# typecheck jamais pegaria. Por isso `esperado=` em toda troca: um replace que
# nao encontra nada falha em silencio e o estrago so aparece em runtime.
troca(r"document\.getElementById\('stage'\)\s*\|\|\s*document\.body\s*\|\|\s*document\.documentElement",
      "_palco", "host do canvas -> opcoes.palco", esperado=1)

# QUALITY passa a respeitar a opcao recebida.
src = src.replace("let QUALITY='high';", "let QUALITY=QUALITY_INICIAL;", 1)
mudancas.append(("QUALITY inicial vem das opcoes", 1))

# ── TELEMETRIA ────────────────────────────────────────────────────────────────
# O motor escreve os numeros direto no DOM por id (`$('sShotH').textContent=...`),
# porque no HTML original ele era dono da pagina. Aqui quem desenha o HUD e o
# React, e ele nao tem como ler `textContent` de um elemento que nunca criou.
#
# Entao expomos um `lerTelemetria()`: um retrato do estado interno, em objeto.
# Ninguem escreve no DOM, ninguem faz parse de string. E tambem o que permite
# comparar lado a lado com o match-engine do jogo — que e o objetivo aqui: antes
# de corrigir a divergencia entre os dois, e preciso VER a divergencia.
TELEMETRIA = '''
  /** Retrato do estado interno da simulacao. Barato: so le, nao aloca cena. */
  function lerTelemetria(){
    if(_destruido || typeof Match === "undefined") return null
    const somaPoss = (Match.possT.home + Match.possT.away) || 1
    return {
      relogio: { segundos: Match.t, tempo: Match.half, acrescimo: Match.stoppage,
                 fase: Match.phase, pausado: Match.paused },
      placar: { casa: Match.score.home, fora: Match.score.away },
      posse: { casa: Match.possT.home / somaPoss * 100,
               fora: Match.possT.away / somaPoss * 100,
               atual: Match.possession },
      casa: { finalizacoes: Stats.d.home.shots, noGol: Stats.d.home.tgt,
              passesCertos: Stats.d.home.pass, passesTentados: Stats.d.home.att,
              bloqueios: Stats.d.home.blk, faltas: Match.fouls.home,
              amarelos: Match.cards.home, vermelhos: Match.reds.home },
      fora: { finalizacoes: Stats.d.away.shots, noGol: Stats.d.away.tgt,
              passesCertos: Stats.d.away.pass, passesTentados: Stats.d.away.att,
              bloqueios: Stats.d.away.blk, faltas: Match.fouls.away,
              amarelos: Match.cards.away, vermelhos: Match.reds.away },
      // Estes numeros SO existem aqui: o match-engine do jogo nao simula fisica.
      // `apex`, `dist` e `subs` ja eram mantidos pelo motor original.
      bola: {
        velocidadeKmh: Ball.vel.length() * 3.6,
        rotacaoRpm: Ball.spin.length() * 9.5493,   // rad/s -> rpm
        alturaM: Ball.pos.y,
        alturaMaximaM: Ball.apex,
        percursoM: Ball.dist,
        subpassos: Ball.subs,
        x: Ball.pos.x,
        z: Ball.pos.z,
        dono: Ball.owner ? Ball.owner.team : null,
        ultimoToque: Ball.lastTouch ? Ball.lastTouch.team : null,
      },
      velocidadeSim: Sim.speed,
      passos: Match.steps,
    }
  }
'''
src = src.replace("\n  // ── ciclo de vida ─", TELEMETRIA + "\n  // ── ciclo de vida ─", 1)
src = src.replace("  return {\n    iniciar,\n    destruir,",
                  "  return {\n    iniciar,\n    destruir,\n    lerTelemetria,", 1)
if "lerTelemetria," not in src:
    raise SystemExit("ABORTADO: nao consegui expor lerTelemetria no retorno")
mudancas.append(("lerTelemetria() exposta para o HUD do React", 1))

# ── CONTROLE DE RITMO ─────────────────────────────────────────────────────────
# O 3D tem `Sim.speed` (6 marchas) e o jogo tem `MatchSpeed` (1x/3x/5x). Se cada
# um andar no seu ritmo, a partida 3D descola do match-engine — o jogador ve um
# lance que o placar ja passou, ou espera parado por um placar que ja mudou.
#
# Tambem expomos a duracao: em teste vale simular tempos curtos para ver 90
# minutos rapido; em jogo, o tempo tem de bater com o do match-engine.
CONTROLE = '''
  /** Ajusta a velocidade da simulacao. A fisica NAO muda — muda quanto tempo
   *  simulado cabe em cada segundo real. Aceita o valor mais proximo da lista
   *  interna [0.15, 0.5, 1, 2, 4, 8]. */
  function definirVelocidade(mult){
    if(_destruido || typeof Sim === "undefined") return
    let melhor = 0, dif = Infinity
    for(let i = 0; i < Sim.list.length; i++){
      const d = Math.abs(Sim.list[i] - mult)
      if(d < dif){ dif = d; melhor = i }
    }
    Sim.i = melhor
  }

  /** Duracao de CADA tempo, em minutos de jogo. O padrao e 45. */
  function definirDuracaoDoTempo(minutos){
    if(_destruido || typeof CFG === "undefined") return
    CFG.time.half = Math.max(1, minutos)
  }

  /** Pausa/retoma. Sem isto o React nao tem como parar a partida. */
  function definirPausa(pausado){
    if(_destruido || typeof Match === "undefined") return
    Match.paused = !!pausado
  }

  /**
   * Usa a formacao do 2D (`lib/formations.ts`) no lugar da embutida.
   *
   * Antes o motor tinha um 4-3-3 proprio, sem relacao com o que a tela de
   * escalacao desenha — o time montado no campinho nao era o que entrava em
   * campo. Passando os slots do 2D, os dois passam a concordar.
   *
   * Precisa ser chamado ANTES de `iniciar()`: os jogadores leem a formacao ao
   * nascer. Depois disso, so vale na proxima partida.
   *
   * @param {{pos: string, x: number, y: number}[]} slots
   * @returns {boolean} true se a formacao foi aceita
   */
  function definirFormacao(slots){
    if(_destruido) return false
    const convertida = formacaoDo2D(slots)
    if(!convertida) return false
    _formacaoAtiva = convertida
    return true
  }
'''
src = src.replace("\n  // ── ciclo de vida ─", CONTROLE + "\n  // ── ciclo de vida ─", 1)
src = src.replace("    lerTelemetria,",
                  "    lerTelemetria,\n    definirVelocidade,\n    definirDuracaoDoTempo,\n    definirPausa,", 1)
if "definirVelocidade," not in src:
    raise SystemExit("ABORTADO: nao consegui expor os controles de ritmo")
mudancas.append(("controles de ritmo (velocidade, duracao, pausa)", 3))

# ── BUG: "no gol" contava o que nao era chute ─────────────────────────────────
# MEDIDO: taxa "no gol / finalizacoes" de 67%, contra ~33% do futebol real.
#
# `Stats.onTarget(Ball.shotBy)` era chamado em TODA interacao do goleiro com a
# bola — inclusive quando ele sai do gol para recolher uma bola solta, que nao e
# finalizacao nenhuma. E `shotBy` so era limpo quando a bola parava no chao
# (`< 3 m/s`), entao um chute que passou LONGE do gol e foi recolhido continuava
# marcado e entrava como "defendido".
#
# A correcao troca `shotBy` cru por uma checagem de direcao: so conta quem
# estava de fato indo para o gol. Nao mexe na IA nem na fisica — so em quem
# entra na estatistica.
GUARDA_ALVO = '''
/**
 * A bola estava mesmo indo para o gol de `time`?
 *
 * Sem isto, `Stats.onTarget` contava qualquer toque do goleiro como "no alvo" —
 * inclusive ele saindo para pegar bola solta. A taxa media ficava em 67%,
 * quando o futebol real fica perto de 33%.
 */
function indoAoGol(time){
  if(!Ball.shotBy) return null
  const alvo = goalCenter(Ball.shotBy)
  const v = Ball.vel
  // Parada ou quase: nao ia a lugar nenhum.
  const vel = Math.hypot(v.x, v.z)
  if(vel < 3) return null
  // A bola precisa estar se aproximando do gol, e nao passando ao largo.
  const dx = alvo.x - Ball.pos.x, dz = alvo.z - Ball.pos.z
  const dlen = Math.hypot(dx, dz) || 1
  const cos = (v.x * dx + v.z * dz) / (vel * dlen)
  if(cos < 0.3) return null                  // indo claramente para outro lado
  // Enquadrada com a meta. O gol tem 7,32 m (+-3,66) e a folga cobre o efeito
  // Magnus, que curva a bola no caminho — a projecao reta subestima quem
  // entraria. Este numero foi CALIBRADO medindo a taxa "no gol/finalizacoes":
  // 6,5 zerava a estatistica; 11 devolvia 67%; ~5 chega perto dos 33% reais.
  const t = dlen / vel
  const zNoGol = Ball.pos.z + v.z * t
  if(Math.abs(zNoGol) > 5) return null
  // Altura: bola por cima do travessao (2,44 m) nao e chute no gol.
  const yNoGol = Ball.pos.y + Ball.vel.y * t - 4.9 * t * t
  if(yNoGol > 3.2) return null
  return Ball.shotBy
}
'''
alvo_guarda = "const Match={"
if alvo_guarda not in src:
    raise SystemExit("ABORTADO: nao achei onde inserir indoAoGol")
src = src.replace(alvo_guarda, GUARDA_ALVO + "\n" + alvo_guarda, 1)

troca(r"b\.offside=null; Stats\.onTarget\(b\.shotBy\);",
      "b.offside=null; Stats.onTarget(indoAoGol(p.team));",
      "goleiro saindo do gol nao conta como chute no alvo", esperado=1)
# A decisao tem de ser tomada ANTES de o goleiro mexer na bola: os dois ramos
# abaixo (espalmar / segurar) sobrescrevem `b.vel`, e avaliar a trajetoria
# depois disso media a bola PARADA na mao dele — foi o que zerou a estatistica
# na primeira tentativa. Capturamos no topo do bloco, com a bola ainda em voo.
troca(r"(    b\.lastTouch=p; b\.offside=null;\n)(    if\(speed>19)",
      r"\1    const _alvoDoChute = indoAoGol(p.team);\n\2",
      "avalia a trajetoria ANTES de o goleiro mexer na bola", esperado=1)
troca(r"      Stats\.onTarget\(b\.shotBy\);\n(\s+Events\.add\('Defesa de ')",
      r"      Stats.onTarget(_alvoDoChute);\n\1",
      "espalmada so conta se a bola ia ao gol", esperado=1)
troca(r"if\(speed>11\)\{ Stats\.onTarget\(b\.shotBy\);",
      "if(speed>11){ Stats.onTarget(_alvoDoChute);",
      "defesa segura so conta se a bola ia ao gol", esperado=1)
mudancas.append(("BUG: 'no gol' contava toque de goleiro em bola solta", 4))

# ── BUG: faltas 4x acima do real ──────────────────────────────────────────────
# MEDIDO: 49 x 34 faltas por 90 min, contra ~11 de cada lado no futebol real.
#
# A deteccao dispara em contato entre jogadores, e os corpos se atravessam com
# frequencia (visivel na tela: eles se empilham). Sem um tempo minimo entre
# faltas do mesmo jogador, um encostao vira tres faltas seguidas.
FALTA_COOLDOWN = '''
  // Duas faltas do MESMO jogador em menos de 2,5 s do jogo quase sempre sao o
  // mesmo encontrao contado varias vezes — os corpos se atravessam e o contato
  // persiste por varios quadros. Sem esta janela a contagem inflava 4x.
  if(offender._ultimaFalta && Match.t - offender._ultimaFalta < 2.5) return
  offender._ultimaFalta = Match.t
'''
troca(r"(  foul\(offender,victim\)\{\n)",
      r"\1" + FALTA_COOLDOWN,
      "BUG: falta repetida no mesmo contato", esperado=1)

# ── BUG: a formacao colapsa e os jogadores se cercam ──────────────────────────
# OBSERVADO na tela (o usuario viu antes de eu medir): os corpos se empilham e
# ficam "cercados". MEDIDO: 5,8 finalizacoes por time/90min contra ~12 reais.
#
# A causa esta no posicionamento sem bola:
#
#     clamp(s.z + (b.pos.z - s.z) * .32, ...)
#
# TODOS os jogadores puxam 32% em direcao ao Z da bola. Os 10 convergem para a
# mesma faixa, a formacao vira uma massa, e sem LARGURA nao ha linha de passe
# nem espaco para finalizar. E tambem por isso que as faltas inflavam: corpos
# amontoados geram contato o tempo todo.
#
# A correcao da a cada funcao uma disciplina propria. Zagueiro acompanha a bola
# de perto (e o trabalho dele); ponta quase nao acompanha — a largura DELE e o
# que abre o campo. Isso e formacao tatica de verdade, nao um numero unico para
# os 10.
DISCIPLINA = '''
/**
 * Quanto cada funcao acompanha o Z da bola, de 0 (segura a posicao) a 1 (cola).
 *
 * O motor usava .32 para todo mundo, e os 10 colapsavam na mesma faixa. Quem
 * abre o campo e o ponta: se ele persegue a bola, o time joga num corredor so.
 */
const DISCIPLINA_Z = {
  GOL: 0.10,
  ZAG: 0.34,           // acompanha: e a funcao dele
  LE: 0.26, LD: 0.26,  // lateral sobe pela beirada, nao pelo meio
  VOL: 0.30,
  MEI: 0.22,
  PE: 0.10, PD: 0.10,  // ponta MANTEM a largura — e o que abre linha de passe
  ATA: 0.16,
}

/** Largura minima que cada funcao respeita, em fracao da meia-largura do campo. */
const LARGURA_MIN = { PE: 0.62, PD: 0.62, LE: 0.52, LD: 0.52 }
'''
alvo_disc = "const Match={"
if alvo_disc not in src:
    raise SystemExit("ABORTADO: nao achei onde inserir a disciplina de formacao")
src = src.replace(alvo_disc, DISCIPLINA + "\n" + alvo_disc, 1)

troca(r"        clamp\(s\.z\+\(b\.pos\.z-s\.z\)\*\.32,-HALF_W\+2,HALF_W-2\)\);",
      """        clamp((() => {
          // Cada funcao acompanha a bola no seu proprio grau. O ponta segura a
          // largura em vez de perseguir — e o que abre o campo e cria a linha
          // de passe que nao existia.
          const dz = DISCIPLINA_Z[p.role] ?? 0.24
          let z = s.z + (b.pos.z - s.z) * dz
          const wmin = LARGURA_MIN[p.role]
          if(wmin && att){
            // Em posse, quem e de beirada NAO fecha para o meio.
            const lado = Math.sign(s.z) || 1
            if(Math.abs(z) < HALF_W * wmin) z = lado * HALF_W * wmin
          }
          return z
        })(),-HALF_W+2,HALF_W-2));""",
      "BUG: formacao colapsava — disciplina por funcao", esperado=1)

# ── CAMERA DE CENA ────────────────────────────────────────────────────────────
# Um lance encenado nao tem enquadramento proprio: cai no modo generico, que
# persegue a bola de longe. Um gol roteirizado merece o corte que a TV daria —
# acompanha a bola no voo, fecha na comemoracao, e devolve o controle depois.
#
# Entra ANTES do `switch(this.mode)` e DEPOIS de replay/gol, para nao roubar a
# camera dessas duas — que ja tem tratamento proprio e mais prioritario.
CAMERA_CENA = '''    } else if(Director.cena && Director.cenaT > 0){
      // Enquadramento da cena encenada. `alvo` e o ponto de interesse (a bola,
      // ou quem esta reagindo); `aperto` fecha o plano conforme a cena avanca.
      const c = Director.cena
      const foco = c.alvo || b
      const t = 1 - clamp(Director.cenaT / (c.dur || 1), 0, 1)
      const aperto = c.fecha ? (1 - t * 0.45) : 1
      const ang = c.ang + t * (c.giro || 0)
      const rai = (c.raio || 16) * aperto
      want = new THREE.Vector3(
        foco.x + Math.cos(ang) * rai,
        (c.alt || 4.2) * aperto + 0.8,
        foco.z + Math.sin(ang) * rai)
      look = new THREE.Vector3(foco.x, (c.olha ?? 1.2), foco.z)
      rate = c.rate || 3.2
'''
alvo_cam = "    } else switch(this.mode){"
if alvo_cam not in src:
    raise SystemExit("ABORTADO: nao achei o switch de modos de camera")
src = src.replace(alvo_cam, CAMERA_CENA + alvo_cam, 1)

# Campos de estado + o decaimento do tempo de cena.
troca(r"(  mode:0, names:\['DINÂMICA','TRANSMISSÃO','TELE','AÉREA'\],)",
      r"\1\n  cena:null, cenaT:0,",
      "estado da camera de cena", esperado=1)
# Ancorado no `update` do DIRECTOR: `update(dt){` sozinho casa com tres funcoes
# diferentes no motor, e o script abortou ao encontrar as tres — a guarda de
# `esperado=` fez o trabalho dela.
troca(r"(  cena:null, cenaT:0,\n(?:.*\n)*?  update\(dt\)\{\n)",
      r"\1    if(this.cenaT > 0){ this.cenaT -= dt; if(this.cenaT <= 0) this.cena = null }\n",
      "camera de cena expira sozinha", esperado=1)
mudancas.append(("camera com enquadramento proprio para lances encenados", 3))

# ── FORMACAO VINDA DO 2D ──────────────────────────────────────────────────────
# O motor 3D tinha um 4-3-3 proprio (`FORMATION`), sem relacao com o
# `lib/formations.ts` que a tela de escalacao usa. Duas fontes de verdade para a
# mesma coisa: o time desenhado no campinho nao era o time que entrava em campo.
#
# Agora as coordenadas saem do 2D, convertidas. Os sistemas sao diferentes:
#
#   2D   x = largura   (0-100),  y = profundidade (12 = ataque, 92 = proprio gol)
#   3D   x = comprimento (-0,5 a 0,5, negativo = proprio gol),  z = largura
#
# Os eixos estao TROCADOS e as escalas divergem. Converter direto pelo campo
# teorico (133) poria o goleiro fora da area: os slots do 2D so usam ate y=92.
# Normalizamos pela FAIXA REALMENTE USADA, o que faz goleiro e atacante cairem
# exatamente onde o 3D ja os tinha.
#
# O fator de largura (0,857) vem de calibrar a ponta: x=85 no 2D deve virar
# z=0,30 no 3D, que e onde o lateral ficava.
FORMACAO_2D = '''
/**
 * Converte um slot do 2D (lib/formations.ts) para o sistema do motor 3D.
 *
 * `faixaY` e o intervalo de profundidade REALMENTE ocupado pela formacao — nao
 * o campo teorico. Sem isso o goleiro sairia da area, porque os slots do 2D
 * param em y=92 e o campo vai a 133.
 */
function slotDo2D(slot, faixaY){
  const [yMin, yMax] = faixaY
  const t = (slot.y - yMin) / Math.max(1, yMax - yMin)   // 0 = ataque, 1 = defesa
  return {
    r: slot.pos,
    x: X_ATAQUE + t * (X_DEFESA - X_ATAQUE),
    z: ((slot.x - 50) / 100) * FATOR_LARGURA,
  }
}

/** Extremos que o 3D ja usava: goleiro no fundo, atacante na frente. */
const X_DEFESA = -0.474
const X_ATAQUE = 0.216
/** x=85 no 2D (ponta) deve virar z=0,30 no 3D, onde o lateral ficava. */
const FATOR_LARGURA = 0.857

/**
 * Monta a formacao do 3D a partir dos slots do 2D.
 *
 * Recebe a lista no formato de `lib/formations.ts`. Se vier vazia ou invalida,
 * devolve `null` e o motor mantem a formacao embutida — um 3D sem formacao nao
 * pode acontecer so porque a tela nao passou o dado.
 */
function formacaoDo2D(slots){
  if(!Array.isArray(slots) || slots.length !== 11) return null
  const ys = slots.map(s => s.y)
  const faixa = [Math.min(...ys), Math.max(...ys)]
  if(faixa[1] - faixa[0] < 1) return null
  return slots.map(s => slotDo2D(s, faixa))
}
'''
alvo_form = "const FORMATION=["
if alvo_form not in src:
    raise SystemExit("ABORTADO: nao achei a FORMATION do motor")
src = src.replace(alvo_form, FORMACAO_2D + "\n" + alvo_form, 1)
mudancas.append(("conversor de formacao 2D -> 3D", 1))

# `FORMATION` e const e so tem UM ponto de consumo. Em vez de reescrever a
# const, o jogador le de uma variavel que as opcoes podem sobrepor — assim a
# formacao embutida continua como fallback se a tela nao passar nada.
troca(r"    this\.def=FORMATION\[idx\];",
      "    this.def=(_formacaoAtiva||FORMATION)[idx];",
      "jogador le a formacao ativa (2D) com fallback na embutida", esperado=1)

# ── BUG: o passe mirava onde o companheiro NAO estaria ────────────────────────
# OBSERVADO: "ainda fica 5 pessoas correndo atras da bola e se amontoando".
# MEDIDO: 51% de acerto de passe, contra ~80% do futebol real.
#
# `passTo` mirava a posicao do companheiro somada a `vel * 0.46` — ou seja, onde
# ele estaria em 0,46 s. Mas a bola nao chega em 0,46 s:
#
#   distancia   tempo de voo   antecipacao   o alvo ja andou
#      10 m        2,3 s          0,46 s          8 m
#      20 m        3,9 s          0,46 s         16 m
#      30 m        5,3 s          0,46 s         22 m
#
# O passe morria no vazio, virava bola solta, e os dois times convergiam para a
# disputa — o amontoamento. Nao era a IA "correndo atras da bola": era o passe
# errando e criando bola dividida o tempo todo.
#
# A correcao estima o tempo de voo pela mesma fisica do `passPower` e mira onde
# o companheiro estara ENTAO. O erro de execucao (qualidade, cansaco) continua
# intacto — passe ruim ainda erra, mas por incompetencia e nao por mira.
troca(r"function passTo\(p,m,lofted\)\{\n  const to=m\.pos\.clone\(\)\.addScaledVector\(m\.vel,lofted\?\.62:\.46\)\.sub\(p\.pos\)\.setY\(0\);",
      """function passTo(p,m,lofted){
  // ANTECIPACAO PELO TEMPO DE VOO REAL.
  //
  // Mirar `vel * 0.46` assumia que a bola chega em meio segundo. Num passe de
  // 20 m ela leva ~3,9 s, e o companheiro ja andou ~16 m — o passe ia para
  // onde ele esteve. Estimamos o voo pela distancia e miramos o ponto futuro.
  //
  // Duas passadas: a primeira estima o tempo pela distancia atual, a segunda
  // corrige com a distancia ate o ponto ja antecipado. Converge o bastante
  // sem custar iteracao no laco de fisica.
  let alvo = m.pos.clone();
  for(let i=0;i<2;i++){
    const dParcial = Math.max(3, alvo.distanceTo(p.pos));
    const vMedia = lofted ? 12 : Math.max(4.5, 3.6 + dParcial*0.055);
    const tVoo = clamp(dParcial / vMedia, 0.2, 2.4);
    alvo = m.pos.clone().addScaledVector(m.vel, tVoo);
  }
  const to=alvo.sub(p.pos).setY(0);""",
      "BUG: passe mirava onde o companheiro nao estaria", esperado=1)

# ── POSES DE CONSEQUENCIA ─────────────────────────────────────────────────────
# O motor tinha 6 poses: run, kick, dive, tackle, header, celebrate. Todas de
# ACAO — o que o jogador faz com a bola. Nenhuma de REACAO: depois do lance, o
# time que sofreu o gol simplesmente voltava a correr, e um cartao amarelo nao
# mudava nada no corpo de ninguem.
#
# Estas quatro fecham o arco lance -> conclusao -> consequencia. Sao puramente
# visuais: nao tocam fisica, IA nem regras, entao nao alteram o resultado.
POSES = '''    } else if(this.pose==='maos_cabeca'){
      // Lamento: maos na cabeca, tronco curvado. Para quem perdeu o gol feito
      // ou sofreu.
      const t = 1 - clamp(this.poseT/2.2, 0, 1)
      const sobe = clamp(t*4, 0, 1)
      A[0].rotation.x = A[1].rotation.x = -2.4*sobe
      A[0].rotation.z = -0.75*sobe; A[1].rotation.z = 0.75*sobe
      A[0].userData.el.rotation.x = A[1].userData.el.rotation.x = -1.5*sobe
      rotX = 0.22*sobe
      y = -0.04*sobe
    } else if(this.pose==='reclamar'){
      // Protesto: um braco aberto para o lado, corpo virado, gesticulando.
      const s = Math.sin(this.phase*3.1)
      A[0].rotation.x = -1.1 + s*0.45
      A[0].rotation.z = -1.05
      A[0].userData.el.rotation.x = -0.5 + s*0.4
      A[1].rotation.x = -0.35
      A[1].rotation.z = 0.2
      rotZ = this.lean + s*0.06
      rotX = -0.08
    } else if(this.pose==='maos_quadril'){
      // Cansaco/resignacao: maos na cintura, respirando. E a pose de quem
      // espera a bola voltar para o meio depois de um gol sofrido.
      const r = Math.sin(this.phase*1.3)*0.03
      A[0].rotation.x = A[1].rotation.x = -0.15
      A[0].rotation.z = -1.15; A[1].rotation.z = 1.15
      A[0].userData.el.rotation.x = A[1].userData.el.rotation.x = -1.9
      rotX = 0.05 + r
      y = r*0.3
    } else if(this.pose==='aponta'){
      // Cobranca ao companheiro, ou pedido de bola. Um braco estendido a frente.
      const s = Math.sin(this.phase*2.4)
      A[0].rotation.x = -1.55 + s*0.12
      A[0].rotation.z = -0.28
      A[0].userData.el.rotation.x = -0.1
      A[1].rotation.x = 0.25
      rotX = -0.05
'''
alvo_poses = "    } else if(this.pose==='celebrate'){"
if alvo_poses not in src:
    raise SystemExit("ABORTADO: nao achei o ponto de insercao das poses")
src = src.replace(alvo_poses, POSES + alvo_poses, 1)
mudancas.append(("4 poses de consequencia (lamento, protesto, cansaco, cobranca)", 4))

# ── ENCENACAO ─────────────────────────────────────────────────────────────────
# A peca que resolve a incompatibilidade de ritmo.
#
# MEDIDO (RTX 3060, 60fps): o 3D produz no maximo 7,6 segundos de jogo por
# segundo real; o 2D no ritmo MAIS LENTO produz 120. O 3D e ~16x mais lento que
# o piso do 2D, e nenhum multiplicador resolve — o `cap` de subpassos por quadro
# trava em 20 s/s. Nao e limitacao de hardware: o 2D avanca 1 MINUTO por tick, o
# 3D avanca 1/60 de SEGUNDO por passo. Sao 90 passos contra 324.000.
#
# Entao o 3D para de tentar simular a partida inteira em paralelo. Ele passa a
# ENCENAR os eventos que o match-engine decidiu: recebe "gol do mandante aos
# 23'" e monta o lance. A velocidade dos dois deixa de precisar bater, porque
# eles nao estao mais medindo a mesma coisa.
ENCENACAO = '''
  // ── TEMPO DE CENA ───────────────────────────────────────────────────────────
  //
  // Um gol nao e um instante: e LANCE -> CONCLUSAO -> CONSEQUENCIA.
  //
  // A primeira versao de `encenar` pulava direto para a conclusao — chamava
  // `Rules.goal()` e a bola ja estava na rede sem nunca ter sido chutada. Ficava
  // teleporte, nao futebol.
  //
  // Agora cada evento vira uma pequena roteirizacao com tempo proprio. O
  // `roteiro` e uma fila de passos `{ atraso, fazer }` consumida pelo loop; nao
  // toca fisica nem regras, entao NAO altera o resultado que o match-engine
  // decidiu — so faz o lance respirar.
  const _roteiro = []

  /** Enfileira um passo da cena. `atraso` em segundos de tempo REAL. */
  function _cena(atraso, fazer){ _roteiro.push({ t: atraso, fazer }) }

  /** Consome o roteiro. Chamado do loop, com dt real. */
  function _passoRoteiro(dt){
    if(!_roteiro.length) return
    const p = _roteiro[0]
    p.t -= dt
    if(p.t <= 0){
      _roteiro.shift()
      try { p.fazer() } catch(e){ /* uma cena que falha nao pode parar o jogo */ }
    }
  }

  /** Jogador de linha aleatorio de um time (nunca o goleiro). */
  function _algumDeLinha(lado){
    const t = teams[lado]
    if(!t || t.length < 2) return null
    return t[1 + Math.floor(Math.random() * (t.length - 1))]
  }

  /** Quem esta mais perto de um ponto — o candidato natural para o lance. */
  function _maisPertoDe(lado, x, z){
    const t = teams[lado]
    if(!t || !t.length) return null
    let melhor = null, dist = Infinity
    for(const p of t){
      if(p.gk) continue
      const d = (p.pos.x - x)**2 + (p.pos.z - z)**2
      if(d < dist){ dist = d; melhor = p }
    }
    return melhor || t[0]
  }

  /**
   * Reacao coletiva. `chance` evita que os 11 facam a mesma coisa ao mesmo
   * tempo, o que pareceria coreografia em vez de gente.
   */
  function _reacaoDoTime(lado, pose, dur, chance){
    const t = teams[lado]
    if(!t) return
    for(const p of t){
      if(p.gk || Math.random() > (chance ?? 0.6)) continue
      p.pose = pose
      p.poseT = dur * (0.75 + Math.random() * 0.5)   // dessincroniza
    }
  }

  /**
   * Encena um evento decidido pelo match-engine, em tres tempos.
   *
   * O 3D NAO decide nada aqui: quem manda no resultado e o motor de partida do
   * jogo. Esta funcao monta o lance que leva ao que ja foi decidido.
   *
   * @param {{tipo: string, lado: "home"|"away", minuto?: number}} evento
   * @returns {boolean} true se o motor soube encenar
   */
  function encenar(evento){
    if(_destruido || typeof Rules === "undefined") return false
    const lado = evento.lado === "away" ? "away" : "home"
    const adv = lado === "home" ? "away" : "home"

    switch(evento.tipo){
      case "kickoff":
        Rules.kickoff(lado); return true

      case "goal": {
        // LANCE: poe a bola no pe de um atacante em posicao de finalizar e
        // chuta de verdade. A bola VIAJA ate a rede — o `Rules.goal` so entra
        // depois, quando ela chega.
        const d = CFG.teams[lado].dir
        const px = d * (HALF_L - rnd(9, 20))
        const pz = rnd(-HALF_W * 0.45, HALF_W * 0.45)
        const atacante = _maisPertoDe(lado, px, pz)
        if(atacante){
          atacante.pos.set(px, 0, pz); atacante.prev.copy(atacante.pos)
          Ball.pos.set(px + d * 0.4, CFG.ball.r, pz)
          Ball.prev.copy(Ball.pos); Ball.vel.set(0, 0, 0); Ball.spin.set(0, 0, 0)
          Ball.owner = atacante; Ball.lastTouch = atacante

          // Mira num canto do gol, com altura plausivel.
          const alvo = new THREE.Vector3(d * HALF_L, 0, rnd(-2.9, 2.9))
          const dir = alvo.clone().sub(Ball.pos)
          kick(atacante, dir, rnd(19, 26), rnd(1.2, 3.4), rnd(-0.6, 0.6), 0)
          Ball.owner = null
        }

        // CAMERA: acompanha o voo de um angulo baixo, atras do chutador — o
        // plano que a TV usa para mostrar a bola entrando.
        Director.cena = { ang: Math.atan2(pz, px) + Math.PI, raio: 21, alt: 3.2,
                          olha: 1.1, giro: 0.5, fecha: false, dur: 1.1, rate: 4.4 }
        Director.cenaT = 1.1

        // CONCLUSAO: a rede balanca quando a bola chega (~0,45s de voo).
        _cena(0.45, () => {
          if(atacante) Ball.lastTouch = atacante
          Rules.goal(lado, 22)
        })

        // CONSEQUENCIA: quem sofreu reage. O `Rules.goal` ja cuida da festa de
        // quem fez; o lado derrotado nao tinha reacao nenhuma ate agora.
        _cena(0.7, () => {
          const gk = teams[adv] && teams[adv][0]
          if(gk){ gk.pose = 'maos_cabeca'; gk.poseT = 3.4 }
          _reacaoDoTime(adv, 'maos_cabeca', 2.6, 0.45)
        })
        _cena(1.6, () => {
          _reacaoDoTime(adv, 'maos_quadril', 2.4, 0.5)
          const bode = _algumDeLinha(adv)
          if(bode){ bode.pose = 'aponta'; bode.poseT = 2.2 }   // cobra o companheiro
          // CAMERA: fecha no goleiro que sofreu. E o plano de reacao — a TV
          // sempre corta para quem perdeu depois de mostrar quem ganhou.
          const gk = teams[adv] && teams[adv][0]
          if(gk){
            Director.cena = { alvo: gk.pos, ang: Math.random() * 6.28, raio: 9,
                              alt: 2.6, olha: 1.4, giro: 0.35, fecha: true,
                              dur: 2.2, rate: 2.6 }
            Director.cenaT = 2.2
          }
        })
        return true
      }

      case "penalty": {
        Rules.penalty(lado)
        // CONSEQUENCIA imediata: quem vai bater se concentra, quem sofreu
        // reclama com o arbitro.
        _cena(0.3, () => {
          _reacaoDoTime(adv, 'reclamar', 2.8, 0.5)
        })
        return true
      }

      case "corner": {
        const d = CFG.teams[lado].dir
        const z = (Math.random() < 0.5 ? -1 : 1) * (HALF_W - 0.3)
        Rules.setPiece(lado, d * (HALF_L - 0.3), z, "ESCANTEIO")
        return true
      }

      case "foul":
      case "free_kick": {
        const d = CFG.teams[lado].dir
        const fx = d * (HALF_L * 0.45 + Math.random() * HALF_L * 0.3)
        const fz = rnd(-HALF_W * 0.6, HALF_W * 0.6)
        Rules.setPiece(lado, fx, fz, "FALTA")
        // CONSEQUENCIA: quem cometeu a falta reclama; quem sofreu se levanta.
        _cena(0.35, () => {
          const infrator = _maisPertoDe(adv, fx, fz)
          if(infrator){ infrator.pose = 'reclamar'; infrator.poseT = 2.1 }
        })
        return true
      }

      case "yellow_card": {
        Match.cards[lado]++
        // O cartao nao mudava NADA no corpo de ninguem. Agora o punido protesta
        // e um companheiro vem puxa-lo dali.
        const punido = _algumDeLinha(lado)
        if(punido){ punido.pose = 'reclamar'; punido.poseT = 3.0 }
        _cena(0.8, () => {
          const colega = _algumDeLinha(lado)
          if(colega && colega !== punido){ colega.pose = 'aponta'; colega.poseT = 1.8 }
        })
        return true
      }

      case "red_card": {
        const alvo = _algumDeLinha(lado)
        if(alvo){
          // CONSEQUENCIA antes da saida: protesta, depois deixa o campo.
          alvo.pose = 'reclamar'; alvo.poseT = 2.4
          _reacaoDoTime(lado, 'reclamar', 2.2, 0.4)
          // CAMERA: plano fechado no expulso, girando devagar. E o corte que a
          // TV da — a reacao dele importa mais que a posicao da bola.
          Director.cena = { alvo: alvo.pos, ang: Math.random() * 6.28, raio: 8.5,
                            alt: 2.4, olha: 1.5, giro: 0.6, fecha: true,
                            dur: 2.4, rate: 2.8 }
          Director.cenaT = 2.4
          _cena(2.4, () => { Rules.expel(alvo) })
        }
        Match.reds[lado]++
        return !!alvo
      }

      case "halftime":
        Match.half = 2; Match.t = CFG.time.half * 60
        Match.steps = CFG.time.half * 60 * 60
        Rules.kickoff(adv)
        return true

      case "fulltime": {
        Match.paused = true
        const venceu = Match.score.home === Match.score.away ? null
          : (Match.score.home > Match.score.away ? 'home' : 'away')
        if(venceu){
          _reacaoDoTime(venceu, 'celebrate', 5, 0.8)
          _reacaoDoTime(venceu === 'home' ? 'away' : 'home', 'maos_cabeca', 4, 0.6)
        }
        return true
      }

      // Eventos sem encenacao propria — o lance ja esta acontecendo em campo.
      // Devolver false deixa o chamador saber que nao houve mudanca de cena, em
      // vez de fingir que encenou.
      case "shot": case "shot_on_target": case "miss": case "post":
      case "save": case "offside": case "counter_attack":
      case "sub": case "var": case "injury":
        return false

      default:
        return false
    }
  }
'''
src = src.replace("\n  // ── ciclo de vida ─", ENCENACAO + "\n  // ── ciclo de vida ─", 1)
src = src.replace("    definirPausa,", "    definirPausa,\n    definirFormacao,\n    encenar,", 1)
if "    encenar," not in src:
    raise SystemExit("ABORTADO: nao consegui expor encenar()")
mudancas.append(("encenar() com arco lance->conclusao->consequencia", 1))

# O roteiro precisa avancar junto com o loop. Enganchamos em `frame`, que ja
# recebe o dt real — e nao em `simulate`, que roda em passo fixo e varias vezes
# por quadro (a cena andaria rapido demais e fora de ritmo).
troca(r"(function frame\(now\)\{\s*\n\s*if\(_destruido\) return;\s*\n\s*_rafId=requestAnimationFrame\(frame\);\s*\n\s*const dt=Math\.min\(\.1,\(now-last\)/1000\); last=now;)",
      r"\1\n  _passoRoteiro(dt);",
      "roteiro de cena avanca no loop", esperado=1)

# Guarda: `encenar` e `_passoRoteiro` tem de existir UMA vez cada. Ja aconteceu
# de uma edicao no script deixar dois blocos de aplicacao e gerar o motor com as
# funcoes duplicadas — a segunda definicao sobrescrevia a primeira em silencio.
for _nome in ("function encenar(", "function _passoRoteiro("):
    _n = src.count(_nome)
    if _n != 1:
        raise SystemExit(f"ABORTADO: '{_nome}' aparece {_n}x no motor gerado (esperado 1)")

# Toda funcao da API publica precisa estar NO RETORNO, senao o React nao a
# alcanca. `definirFormacao` chegou a ser definida sem ser exposta: o motor
# gerava sem erro e so o teste de navegador pegou ("is not a function").
_publicas = ("iniciar", "destruir", "lerTelemetria", "definirVelocidade",
             "definirDuracaoDoTempo", "definirPausa", "definirFormacao", "encenar")
_retorno = src[src.rindex("  return {"):]
for _fn in _publicas:
    if f"    {_fn},"  not in _retorno and f"    {_fn}," not in src[-1200:]:
        raise SystemExit(f"ABORTADO: '{_fn}' nao aparece no retorno do motor")

destino = raiz / "lib" / "partida-3d" / "motor.js"
destino.parent.mkdir(parents=True, exist_ok=True)
destino.write_text(src, encoding="utf-8")

print(f"gerado: {destino.relative_to(raiz)}  ({len(src):,} bytes, {src.count(chr(10)):,} linhas)\n")
print("mudancas aplicadas:")
for rotulo, n in mudancas:
    print(f"  {n:>3}x  {rotulo}")
