// O PORTAO DA TEMPORADA DA CARREIRA ONLINE (1.0.379).
//
// ⚠️ POR QUE ELE EXISTE. Ate a 1.0.378 o mundo online NAO TINHA FIM: o rodizio
// girava para sempre, sem temporada, sem campeao, e a tabela nunca zerava. Quem
// entrasse depois de um mes pegava uma classificacao de centenas de pontos que
// nunca ia se fechar — "liga de pontos corridos" sem termino nao e liga, e um
// placar acumulado.
//
// ⚠️ E O RODIZIO REPETIA CONFRONTO. Isto so apareceu quando a temporada ganhou
// linha de chegada. O emparelhamento pegava VIZINHOS da lista girada — (0,1),
// (2,3), (4,5) — que nao e o metodo do circulo. Medido: com 6 clubes, 15
// partidas jogadas e apenas 10 confrontos DISTINTOS; cinco duplas se
// enfrentavam duas vezes e outras cinco nunca se cruzavam. Com numero IMPAR era
// pior: 10 partidas para 6 confrontos, porque faltava o lugar vazio na roda.
//
// Sem temporada ninguem reclamaria — "nao joguei contra o Fulano" so vira
// queixa quando existe uma tabela que fecha. Era um defeito escondido atras da
// ausencia de outro.
//
// O que este portao cobra, para 4, 5, 6 e 8 clubes:
//   1. o turno tem o tamanho certo (n-1 rodadas se par, n se impar);
//   2. TODOS os pares se enfrentam, e nenhum se enfrenta duas vezes;
//   3. a temporada vira sozinha, coroando quem esta em primeiro;
//   4. a tabela zera na virada e o historico guarda o podio;
//   5. o caixa e os reforcos SOBREVIVEM — o que termina e a competicao, nao a
//      carreira de quem construiu elenco.
//
// Uso: node scripts/qa-temporada-online.mjs

import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"

const { CarreiraOnline } = await import(
  pathToFileURL(path.resolve("services/multiplayer-relay-vps/carreira-online.mjs")).href
)

let falhas = 0
const ok = (m) => console.log(`ok   ${m}`)
const erro = (m) => { console.log(`FALHA ${m}`); falhas++ }
const temporarios = []

function mundoCom(n) {
  const dir = mkdtempSync(path.join(tmpdir(), "uf-temporada-"))
  temporarios.push(dir)
  const mundo = new CarreiraOnline(dir)
  for (let i = 0; i < n; i++) {
    const r = mundo.entrar({
      id: `t${i}`, nome: `Tecnico ${i}`,
      clube: { fileKey: `clube_${i}`, nome: `Clube ${i}` },
      forca: 60 + i, papel: "tecnico",
    })
    if (r.erro) throw new Error(`entrar falhou: ${r.erro}`)
  }
  return mundo
}

/** Uma rodada inteira com os DOIS tecnicos confirmando o mesmo placar. */
function jogarRodada(mundo, aoVirar) {
  const r = mundo.avancarRodada("t0")
  if (r.erro) return r
  // A tabela precisa ser medida NO INSTANTE da virada: a rodada nova ja soma
  // pontos logo abaixo, e medir depois faria a checagem cair na temporada
  // seguinte e passar por engano.
  if (r.campeaoAnterior && aoVirar) aoVirar()
  for (const p of r.partidas) {
    const casa = [...mundo.membros.values()].find(x => x.fileKey === p.casa && x.papel === "tecnico")
    const fora = [...mundo.membros.values()].find(x => x.fileKey === p.fora && x.papel === "tecnico")
    mundo.registrarResultado(p.matchId, casa.id, 1, 0)
    mundo.registrarResultado(p.matchId, fora.id, 1, 0)
  }
  return r
}

for (const n of [4, 5, 6, 8]) {
  const mundo = mundoCom(n)
  const esperado = n % 2 === 0 ? n - 1 : n
  const confrontos = new Set()
  let virou = false

  for (let i = 0; i < esperado * 2 + 4; i++) {
    let somaNaVirada = null
    const r = jogarRodada(mundo, () => {
      somaNaVirada = [...mundo.clubes.values()].reduce((s, c) => s + c.pontos + c.j + c.gp + c.gc, 0)
    })
    if (r.erro) { erro(`n=${n}: rodada recusada (${r.erro})`); break }
    if (r.campeaoAnterior) {
      virou = true
      if (somaNaVirada !== 0) erro(`n=${n}: a tabela nao zerou na virada (soma ${somaNaVirada})`)
      else ok(`n=${n}: tabela zerada, campeao ${r.campeaoAnterior.nome}`)
      break
    }
    for (const p of r.partidas) confrontos.add([p.casa, p.fora].sort().join("|"))
  }

  if (mundo.rodadasDaTemporada !== esperado) {
    erro(`n=${n}: turno de ${mundo.rodadasDaTemporada} rodada(s), esperava ${esperado}`)
  } else {
    ok(`n=${n}: turno de ${esperado} rodada(s)`)
  }

  if (!virou) erro(`n=${n}: a temporada nao virou sozinha`)

  const paresPossiveis = (n * (n - 1)) / 2
  if (confrontos.size !== paresPossiveis) {
    erro(`n=${n}: ${confrontos.size} confrontos distintos de ${paresPossiveis} — turno incompleto ou com repeticao`)
  } else {
    ok(`n=${n}: os ${paresPossiveis} confrontos aconteceram, nenhum repetido`)
  }

  if (mundo.temporada !== 2) erro(`n=${n}: temporada e ${mundo.temporada}, esperava 2`)
  if (mundo.historico.length !== 1) erro(`n=${n}: historico com ${mundo.historico.length} entrada(s)`)
  else if (mundo.historico[0].podio.length !== 3) erro(`n=${n}: podio com ${mundo.historico[0].podio.length} clubes`)
  else ok(`n=${n}: historico guardou a temporada com podio`)

  if ([...mundo.clubes.values()].some(c => !c.caixa)) {
    erro(`n=${n}: o caixa de um clube zerou na virada — a carreira nao pode recomecar do zero`)
  } else {
    ok(`n=${n}: caixa e reforcos sobrevivem a virada`)
  }
}

// ⚠️ MUNDO PEQUENO NAO PODE VIRAR TEMPORADA. Com dois clubes o turno teria UMA
// rodada: campeao a cada partida e tabela zerando sem parar. Foi assim que a
// 1.0.379 reprovou no `qa-mundo-online`, que confere a tabela logo depois de
// pontuar e a encontrou zerada. Esta assercao guarda a licao.
{
  const mundo = mundoCom(2)
  for (let i = 0; i < 4; i++) {
    const r = jogarRodada(mundo)
    if (r.erro) { erro(`n=2: rodada recusada (${r.erro})`); break }
    if (r.campeaoAnterior) { erro("n=2: um mundo de dois clubes encerrou temporada"); break }
  }
  if (mundo.rodadasDaTemporada !== 0) {
    erro(`n=2: mundo pequeno definiu turno de ${mundo.rodadasDaTemporada} rodada(s)`)
  } else {
    ok("n=2: mundo pequeno demais roda sem temporada, e a tabela nao zera")
  }
  const pontuou = [...mundo.clubes.values()].some(c => c.pontos > 0)
  if (!pontuou) erro("n=2: ninguem pontuou — a tabela foi zerada indevidamente")
  else ok("n=2: a tabela do mundo pequeno preserva os pontos")
}

for (const dir of temporarios) { try { rmSync(dir, { recursive: true, force: true }) } catch { /* limpeza best-effort */ } }

console.log(falhas === 0
  ? "\nTEMPORADA ONLINE OK — o mundo fecha, coroa e recomeca, e o turno e completo."
  : `\n${falhas} problema(s) na temporada da carreira online.`)
process.exit(falhas === 0 ? 0 : 1)
