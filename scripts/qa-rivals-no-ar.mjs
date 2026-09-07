// FUMAÇA DO COMPETITIVO NO AR — contra a VPS de verdade, pelo domínio público.
//
// O `qa-rivals-servidor.mjs` sobe um relay local e prova a lógica. Este aqui
// prova outra coisa, que nenhum teste local alcança: que o que está RODANDO na
// VPS é a versão nova, que o nginx encaminha os endpoints e que a conta de
// rating chega ao disco de lá.
//
// ⚠️ ELE SUJA O RANKING DE PROPÓSITO e limpa depois. Os ids começam com
// `qa_smoke_` justamente para dar para apagar sem tocar em jogador de verdade —
// ver o passo final. Rodar isto com gente jogando entraria na fila delas.
//
// Uso: node scripts/qa-rivals-no-ar.mjs

const SITE = process.env.RELAY_URL || "https://ultrafoot.zyntraerp.com.br/relay"
let falhas = 0
const erro = m => { console.log("FALHA: " + m); falhas++ }
const ok = m => console.log("ok   " + m)

async function chamar(caminho, corpo, metodo = "POST") {
  const r = await fetch(`${SITE}${caminho}`, {
    method: metodo,
    headers: { "content-type": "application/json" },
    body: metodo === "GET" ? undefined : JSON.stringify(corpo),
  })
  return { status: r.status, corpo: await r.json().catch(() => ({})) }
}

const saude = await chamar("/health", null, "GET")
if (!saude.corpo?.ok) erro("o relay nao respondeu ao /health")
else ok(`relay no ar (${saude.corpo.service}, protocolo ${saude.corpo.gameVersion})`)

const base = { gameVersion: "1.0.191", modo: "rivals" }
const a = { ...base, managerId: "qa_smoke_a", managerName: "QA Fumaca A", forcaDoClube: 75 }
const b = { ...base, managerId: "qa_smoke_b", managerName: "QA Fumaca B", forcaDoClube: 74 }

const primeiro = await chamar("/v1/competitivo/fila", a)
if (primeiro.corpo.estado !== "na_fila") erro(`o endpoint da fila nao respondeu como esperado: ${JSON.stringify(primeiro.corpo).slice(0, 120)}`)
else ok(`fila respondendo pelo dominio publico (rating ${primeiro.corpo.rating})`)

const segundo = await chamar("/v1/competitivo/fila", b)
if (segundo.corpo.estado !== "pareado") erro("o pareamento nao aconteceu no servidor real")
else ok(`pareado na VPS — sala ${segundo.corpo.roomCode}`)

const matchId = segundo.corpo.matchId
if (matchId) {
  const intruso = await chamar("/v1/competitivo/resultado", { matchId, managerId: "qa_smoke_intruso", golsCasa: 5, golsFora: 0 })
  if (intruso.corpo.ok) erro("ANTI-CHEAT FALHOU NO AR: terceiro conseguiu enviar resultado")
  else ok(`anti-cheat ativo no ar (${intruso.corpo.erro})`)

  await chamar("/v1/competitivo/resultado", { matchId, managerId: "qa_smoke_a", golsCasa: 2, golsFora: 0 })
  const fecha = await chamar("/v1/competitivo/resultado", { matchId, managerId: "qa_smoke_b", golsCasa: 2, golsFora: 0 })
  if (fecha.corpo.estado !== "confirmada") erro(`resultado nao confirmou no ar: ${fecha.corpo.estado}`)
  else ok(`resultado confirmado e rating aplicado (${fecha.corpo.casa?.rating} / ${fecha.corpo.fora?.rating})`)
}

const ranking = await chamar("/v1/competitivo/ranking", null, "GET")
const doTeste = (ranking.corpo.ranking ?? []).filter(l => String(l.nome).startsWith("QA Fumaca"))
if (doTeste.length !== 2) erro(`o ranking da VPS nao registrou os dois do teste (achou ${doTeste.length})`)
else ok(`ranking persistido na VPS: ${doTeste.map(l => `${l.nome} ${l.rating}`).join(" | ")}`)

console.log(falhas === 0 ? "\nTUDO OK — lembre de limpar os ids qa_smoke_ do rivals.json" : `\n${falhas} falha(s)`)
process.exit(falhas === 0 ? 0 : 1)
