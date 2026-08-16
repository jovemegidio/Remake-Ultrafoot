// QA DO COMPETITIVO ONLINE — sobe o relay de VERDADE e joga contra ele.
//
// Não é teste de unidade da matemática do Elo: é o servidor rodando num
// diretório temporário, com dois técnicos entrando na fila, sendo pareados,
// mandando resultado e tentando trapacear. O que este arquivo prova:
//
//   1. dois técnicos compatíveis se encontram e o SERVIDOR cria a sala;
//   2. rating só muda quando os DOIS placares batem;
//   3. divergência não pontua ninguém e fica registrada;
//   4. quem não é da partida não consegue mandar resultado;
//   5. reenviar o próprio placar depois de ver o do outro é recusado;
//   6. placar impossível é recusado e vira suspeita;
//   7. o rating sobrevive ao reinício do servidor (está em disco).
//
// Uso: node scripts/qa-rivals-servidor.mjs

import { spawn } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const PORTA = 8899
const DATA = mkdtempSync(path.join(tmpdir(), "uf-rivals-"))
let falhas = 0
const erro = m => { console.log("FALHA: " + m); falhas++ }
const ok = m => console.log("ok   " + m)

const esperar = ms => new Promise(r => setTimeout(r, ms))

async function chamar(caminho, corpo, metodo = "POST") {
  const r = await fetch(`http://127.0.0.1:${PORTA}${caminho}`, {
    method: metodo,
    headers: { "content-type": "application/json" },
    body: metodo === "GET" ? undefined : JSON.stringify(corpo),
  })
  return { status: r.status, corpo: await r.json() }
}

function subirRelay() {
  const filho = spawn(process.execPath, ["services/multiplayer-relay-vps/server.mjs"], {
    env: { ...process.env, PORT: String(PORTA), DATA_DIR: DATA, GAME_VERSION: "1.0.191" },
    stdio: ["ignore", "pipe", "pipe"],
  })
  filho.stderr.on("data", d => { const t = String(d); if (t.includes("Error")) console.log("relay: " + t.trim()) })
  return filho
}

let relay = subirRelay()
for (let i = 0; i < 40; i++) {
  try { const r = await chamar("/health", null, "GET"); if (r.corpo?.ok) break } catch { await esperar(250) }
}

const base = { gameVersion: "1.0.191", modo: "rivals" }
const isaac = { ...base, managerId: "mgr_isaac", managerName: "Isaac", forcaDoClube: 78 }
const lucas = { ...base, managerId: "mgr_lucas", managerName: "Lucas", forcaDoClube: 76 }

// ── 1. Fila e pareamento ────────────────────────────────────────────────────
const primeiro = await chamar("/v1/competitivo/fila", isaac)
if (primeiro.corpo.estado !== "na_fila") erro(`o primeiro devia ficar na fila, veio ${primeiro.corpo.estado}`)
else ok(`primeiro na fila (rating ${primeiro.corpo.rating}, ${primeiro.corpo.divisao?.nome})`)

const segundo = await chamar("/v1/competitivo/fila", lucas)
if (segundo.corpo.estado !== "pareado") erro(`o segundo devia parear, veio ${segundo.corpo.estado}`)
else ok(`pareado com ${segundo.corpo.adversario?.nome} — sala ${segundo.corpo.roomCode} criada PELO SERVIDOR`)
const matchId = segundo.corpo.matchId

// ── 2. Anti-cheat: quem não é da partida não pontua ─────────────────────────
const intruso = await chamar("/v1/competitivo/resultado", { matchId, managerId: "mgr_intruso", golsCasa: 9, golsFora: 0 })
if (intruso.corpo.ok) erro("um terceiro conseguiu mandar resultado")
else ok(`terceiro recusado (${intruso.corpo.erro})`)

// ── 3. Anti-cheat: placar impossível ────────────────────────────────────────
const absurdo = await chamar("/v1/competitivo/resultado", { matchId, managerId: "mgr_isaac", golsCasa: 999, golsFora: -3 })
if (absurdo.corpo.ok) erro("placar impossivel foi aceito")
else ok(`placar impossivel recusado (${absurdo.corpo.erro})`)

// ── 4. Um lado envia: ainda não vale ────────────────────────────────────────
const umLado = await chamar("/v1/competitivo/resultado", { matchId, managerId: "mgr_isaac", golsCasa: 2, golsFora: 1 })
if (umLado.corpo.estado !== "aguardando_confirmacao") erro(`um lado so devia aguardar, veio ${umLado.corpo.estado}`)
else ok("um lado enviou — aguardando confirmacao")

// ── 5. Anti-cheat: reenviar depois de ver o do outro ────────────────────────
const reenvio = await chamar("/v1/competitivo/resultado", { matchId, managerId: "mgr_isaac", golsCasa: 5, golsFora: 0 })
if (reenvio.corpo.ok) erro("deu para reenviar o proprio placar")
else ok(`reenvio recusado (${reenvio.corpo.erro})`)

// ── 6. Os dois batem: rating muda ───────────────────────────────────────────
const fechou = await chamar("/v1/competitivo/resultado", { matchId, managerId: "mgr_lucas", golsCasa: 2, golsFora: 1 })
if (fechou.corpo.estado !== "confirmada") erro(`os dois bateram e nao confirmou (${fechou.corpo.estado})`)
else ok(`confirmada — vencedor ${fechou.corpo.casa.delta > 0 ? "mandante" : "visitante"} (${fechou.corpo.casa.rating} / ${fechou.corpo.fora.rating})`)
if (fechou.corpo.casa && fechou.corpo.casa.delta <= 0) erro("quem venceu nao ganhou rating")
if (fechou.corpo.fora && fechou.corpo.fora.delta >= 0) erro("quem perdeu nao perdeu rating")

// ── 7. Divergência não pontua ninguém ───────────────────────────────────────
await chamar("/v1/competitivo/fila", isaac)
const segundaPartida = await chamar("/v1/competitivo/fila", lucas)
const m2 = segundaPartida.corpo.matchId
const antes = (await chamar("/v1/competitivo/ranking", null, "GET")).corpo.ranking
await chamar("/v1/competitivo/resultado", { matchId: m2, managerId: "mgr_isaac", golsCasa: 3, golsFora: 0 })
const divergente = await chamar("/v1/competitivo/resultado", { matchId: m2, managerId: "mgr_lucas", golsCasa: 0, golsFora: 3 })
if (divergente.corpo.estado !== "divergente") erro(`placares diferentes deviam divergir, veio ${divergente.corpo.estado}`)
else ok("divergencia detectada")
const depois = (await chamar("/v1/competitivo/ranking", null, "GET")).corpo.ranking
if (JSON.stringify(antes.map(x => x.rating)) !== JSON.stringify(depois.map(x => x.rating))) {
  erro("a divergencia mexeu no rating de alguem")
} else ok("divergencia nao pontuou ninguem")

// ── 8. O rating sobrevive ao reinicio ───────────────────────────────────────
const ratingAntes = depois[0]?.rating
relay.kill()
await esperar(600)
relay = subirRelay()
for (let i = 0; i < 40; i++) {
  try { const r = await chamar("/health", null, "GET"); if (r.corpo?.ok) break } catch { await esperar(250) }
}
const depoisDoReinicio = (await chamar("/v1/competitivo/ranking", null, "GET")).corpo.ranking
if (depoisDoReinicio[0]?.rating !== ratingAntes) erro("o rating nao sobreviveu ao reinicio do servidor")
else ok(`rating persistido (${ratingAntes} depois do reinicio)`)

relay.kill()
rmSync(DATA, { recursive: true, force: true })
console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} falha(s)`)
process.exit(falhas === 0 ? 0 : 1)
