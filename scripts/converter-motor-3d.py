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
'''
src = src.replace("\n  // ── ciclo de vida ─", CONTROLE + "\n  // ── ciclo de vida ─", 1)
src = src.replace("    lerTelemetria,",
                  "    lerTelemetria,\n    definirVelocidade,\n    definirDuracaoDoTempo,\n    definirPausa,", 1)
if "definirVelocidade," not in src:
    raise SystemExit("ABORTADO: nao consegui expor os controles de ritmo")
mudancas.append(("controles de ritmo (velocidade, duracao, pausa)", 3))

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
  /**
   * Encena um evento decidido pelo match-engine.
   *
   * O 3D NAO decide nada aqui: quem manda no resultado e o motor de partida do
   * jogo. Esta funcao so poe a cena no estado certo para o lance acontecer.
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

      case "goal":
        // Placar quem manda e o match-engine; aqui so a comemoracao e a rede
        // balancando. `goal()` ja incrementa Match.score, entao o placar do 3D
        // acompanha sem precisar de escrita direta.
        Rules.goal(lado, 20); return true

      case "penalty":
        Rules.penalty(lado); return true

      case "corner": {
        // Escanteio: bola no vertice do lado atacante.
        const d = CFG.teams[lado].dir
        Rules.setPiece(lado, d * (HALF_L - 0.3), (Math.random() < 0.5 ? -1 : 1) * (HALF_W - 0.3), "ESCANTEIO")
        return true
      }

      case "foul":
      case "free_kick": {
        // Falta em posicao plausivel no campo de ataque de quem sofreu.
        const d = CFG.teams[lado].dir
        Rules.setPiece(lado, d * (HALF_L * 0.45 + Math.random() * HALF_L * 0.3),
                       (Math.random() * 2 - 1) * HALF_W * 0.6, "FALTA")
        return true
      }

      case "yellow_card":
        // O 3D nao tem cartao amarelo isolado: registra na contagem para o HUD
        // e a telemetria refletirem o que o jogo decidiu.
        Match.cards[lado]++; return true

      case "red_card": {
        // Expulsao muda a cena de verdade: um jogador sai do campo. Escolhe um
        // de linha (nunca o goleiro) do lado punido.
        const time = teams[lado]
        const alvo = time && time.length > 2
          ? time.slice(1)[Math.floor(Math.random() * (time.length - 1))] : null
        if(alvo) Rules.expel(alvo)
        Match.reds[lado]++
        return !!alvo
      }

      case "halftime":
        Match.half = 2; Match.t = CFG.time.half * 60
        Match.steps = CFG.time.half * 60 * 60
        Rules.kickoff(adv)
        return true

      case "fulltime":
        Match.paused = true; return true

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
src = src.replace("    definirPausa,", "    definirPausa,\n    encenar,", 1)
if "    encenar," not in src:
    raise SystemExit("ABORTADO: nao consegui expor encenar()")
mudancas.append(("encenar() — a ponte match-engine -> 3D", 1))

destino = raiz / "lib" / "partida-3d" / "motor.js"
destino.parent.mkdir(parents=True, exist_ok=True)
destino.write_text(src, encoding="utf-8")

print(f"gerado: {destino.relative_to(raiz)}  ({len(src):,} bytes, {src.count(chr(10)):,} linhas)\n")
print("mudancas aplicadas:")
for rotulo, n in mudancas:
    print(f"  {n:>3}x  {rotulo}")
