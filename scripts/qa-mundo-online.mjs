// QA DO MUNDO ONLINE — Carreira Online e Eventos da semana, contra o relay de verdade.
//
// Mesmo espírito de `qa-rivals-servidor.mjs`: o servidor sobe num diretório
// temporário e é jogado contra, em vez de testar as funções por dentro. O que
// este arquivo prova:
//
//   1. dois técnicos NÃO pegam o mesmo clube (a vaga é compartilhada);
//   1b. mas DUAS PESSOAS cabem no mesmo clube, em papéis diferentes — e cada
//       papel faz o que os outros não fazem (cooperativa e diretoria online);
//   2. a rodada só abre com dois inscritos, e vem com SEMENTE e as duas forças;
//   3. o placar de um lado entra na tabela e o do outro CONFERE;
//   4. placar divergente é recusado e não repontua;
//   5. o mercado é compartilhado: quem compra primeiro leva, o segundo recebe
//      `ja_vendido`, e o dinheiro muda de dono;
//   6. o reforço comprado AUMENTA a força do clube na rodada seguinte;
//   7. o evento da semana guarda a MELHOR tentativa, e recusa pontuação
//      impossível;
//   8. tudo sobrevive ao reinício do servidor (está em disco).
//
// Uso: node scripts/qa-mundo-online.mjs

import { spawn } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const PORTA = 8897
const DATA = mkdtempSync(path.join(tmpdir(), "uf-mundo-"))
let falhas = 0
const erro = m => { console.log("FALHA: " + m); falhas++ }
const ok = m => console.log("ok   " + m)
const esperar = ms => new Promise(r => setTimeout(r, ms))

async function chamar(caminho, corpo, metodo = "POST") {
  const r = await fetch(`http://127.0.0.1:${PORTA}${caminho}`, {
    method: metodo,
    headers: { "content-type": "application/json" },
    body: metodo === "GET" ? undefined : JSON.stringify(corpo ?? {}),
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

// ── 1. As vagas são compartilhadas ──────────────────────────────────────────
const flamengo = { fileKey: "flamengo", nome: "Flamengo" }
const palmeiras = { fileKey: "palmeiras", nome: "Palmeiras" }

const a = await chamar("/v1/carreira/entrar", { managerId: "m_a", managerName: "Isaac", clube: flamengo, forca: 80 })
if (!a.corpo.ok) erro(`o primeiro devia entrar, veio ${JSON.stringify(a.corpo)}`)
else ok(`primeiro técnico dentro com ${a.corpo.clube.nome}`)

// ⚠️ O ERRO CERTO AQUI É `papel_ocupado`, e nao `clube_ocupado`. Desde que o
// clube passou a caber quatro pessoas, "esse clube ja e de outra pessoa" deixou
// de ser verdade: o que esta tomado e a CADEIRA DE TECNICO. Quem chega depois
// escolhe outro clube ou entra neste noutro papel — e e essa a porta da
// carreira cooperativa.
const roubo = await chamar("/v1/carreira/entrar", { managerId: "m_b", managerName: "Lucas", clube: flamengo, forca: 80 })
if (roubo.corpo.erro !== "papel_ocupado") erro(`a cadeira de tecnico ja era do primeiro; veio ${JSON.stringify(roubo.corpo)}`)
else ok("cadeira de técnico já tomada é recusada (a vaga é compartilhada)")

const b = await chamar("/v1/carreira/entrar", { managerId: "m_b", managerName: "Lucas", clube: palmeiras, forca: 78 })
if (!b.corpo.ok) erro(`o segundo devia entrar com outro clube, veio ${JSON.stringify(b.corpo)}`)
else ok("segundo técnico dentro com outro clube")

// ── 2. A rodada, com semente ────────────────────────────────────────────────
const rodada = await chamar("/v1/carreira/rodada", { managerId: "m_a" })
if (!rodada.corpo.ok || rodada.corpo.partidas?.length !== 1) erro(`a rodada devia criar 1 confronto, veio ${JSON.stringify(rodada.corpo)}`)
else ok(`rodada ${rodada.corpo.rodada} aberta com 1 confronto`)

const partida = rodada.corpo.partidas[0]
if (!Number.isInteger(partida.semente) || partida.semente <= 0) erro("o confronto veio SEM semente — os dois lados jogariam partidas diferentes")
else ok(`semente ${partida.semente} e forças ${partida.forcaCasa}×${partida.forcaFora} vindas do servidor`)

const cedo = await chamar("/v1/carreira/rodada", { managerId: "m_a" })
if (cedo.corpo.erro !== "rodada_em_andamento") erro(`não podia abrir a próxima com a atual em jogo; veio ${JSON.stringify(cedo.corpo)}`)
else ok("não dá para pular rodada com partida pendente")

// ── 3 e 4. Placar, conferência e divergência ────────────────────────────────
const tecnicoDaCasa = partida.casa === "flamengo" ? "m_a" : "m_b"
const tecnicoDeFora = partida.casa === "flamengo" ? "m_b" : "m_a"
const envio = await chamar("/v1/carreira/resultado", { matchId: partida.matchId, managerId: tecnicoDaCasa, golsCasa: 2, golsFora: 1 })
if (envio.corpo.estado !== "registrada") erro(`o primeiro envio devia registrar, veio ${JSON.stringify(envio.corpo)}`)
else ok("placar do mandante registrado")

const confere = await chamar("/v1/carreira/resultado", { matchId: partida.matchId, managerId: tecnicoDeFora, golsCasa: 2, golsFora: 1 })
if (confere.corpo.estado !== "confirmada") erro(`o segundo envio igual devia confirmar, veio ${JSON.stringify(confere.corpo)}`)
else ok("o outro lado enviou o MESMO placar e confirmou")

const divergente = await chamar("/v1/carreira/resultado", { matchId: partida.matchId, managerId: tecnicoDeFora, golsCasa: 9, golsFora: 0 })
if (divergente.corpo.estado !== "divergente") erro(`placar diferente devia divergir, veio ${JSON.stringify(divergente.corpo)}`)
else ok("placar divergente recusado (a tabela não muda)")

const estadoA = (await chamar(`/v1/carreira/estado?managerId=m_a`, null, "GET")).corpo
const lider = estadoA.tabela[0]
if (lider.pontos !== 3 || estadoA.tabela[1].pontos !== 0) erro(`a tabela devia ter 3×0, veio ${JSON.stringify(estadoA.tabela.map(l => l.pontos))}`)
else ok(`tabela do mundo: ${lider.clube} com 3 pontos`)

// ── 5 e 6. O mercado é compartilhado ────────────────────────────────────────
const atleta = { id: "atl_1", nome: "Craque", posicao: "ATA", overall: 86 }
const anuncio = await chamar("/v1/carreira/anunciar", { managerId: "m_a", atleta, preco: 10 })
if (!anuncio.corpo.ok) erro(`o anúncio devia entrar, veio ${JSON.stringify(anuncio.corpo)}`)
else ok("atleta anunciado no mercado do mundo")

const compra = await chamar("/v1/carreira/comprar", { managerId: "m_b", anuncioId: anuncio.corpo.anuncio.anuncioId })
if (!compra.corpo.ok) erro(`a compra devia passar, veio ${JSON.stringify(compra.corpo)}`)
else ok("comprado por outro técnico")

const tarde = await chamar("/v1/carreira/comprar", { managerId: "m_a", anuncioId: anuncio.corpo.anuncio.anuncioId })
if (tarde.corpo.erro !== "ja_vendido") erro(`quem chega depois devia ver "ja_vendido", veio ${JSON.stringify(tarde.corpo)}`)
else ok("o segundo comprador recebe ja_vendido (nada de duas cópias)")

const depoisDaCompra = (await chamar(`/v1/carreira/estado?managerId=m_b`, null, "GET")).corpo
const comprador = depoisDaCompra.tabela.find(l => l.fileKey === "palmeiras")
const vendedor = depoisDaCompra.tabela.find(l => l.fileKey === "flamengo")
// 50 iniciais + bilheteria da rodada (3 ao mandante, 2 ao visitante), menos/mais
// os 10 do negócio.
ok(`caixas depois do negócio: comprador ${comprador.caixa}, vendedor ${vendedor.caixa}`)
if (comprador.caixa >= vendedor.caixa) erro(`o dinheiro devia ter mudado de dono: ${comprador.caixa} × ${vendedor.caixa}`)
else ok(`dinheiro trocou de dono (${comprador.caixa} × ${vendedor.caixa})`)

const forcaAntes = partida.forcaFora
const rodada2 = await chamar("/v1/carreira/rodada", { managerId: "m_a" })
const partida2 = rodada2.corpo.partidas?.[0]
const forcaDepois = partida2.casa === "palmeiras" ? partida2.forcaCasa : partida2.forcaFora
if (forcaDepois <= forcaAntes) erro(`o reforço 86 devia somar força: ${forcaAntes} → ${forcaDepois}`)
else ok(`o reforço do mercado entrou em campo (${forcaAntes} → ${forcaDepois})`)

// ── 6b. O clube compartilhado: cooperativa e diretoria online ───────────────
const semTecnico = await chamar("/v1/carreira/entrar", { managerId: "m_x", managerName: "Novato", clube: { fileKey: "santos", nome: "Santos" }, forca: 70, papel: "diretor" })
if (semTecnico.corpo.erro !== "clube_sem_tecnico") erro(`clube novo começa pelo técnico; veio ${JSON.stringify(semTecnico.corpo)}`)
else ok("clube novo só nasce com um técnico")

const diretor = await chamar("/v1/carreira/entrar", { managerId: "m_dir", managerName: "Diretora", clube: flamengo, forca: 80, papel: "diretor" })
if (!diretor.corpo.ok) erro(`o diretor devia entrar no MESMO clube, veio ${JSON.stringify(diretor.corpo)}`)
else ok("segunda pessoa dentro do mesmo clube, como diretor (carreira cooperativa)")

const repetido = await chamar("/v1/carreira/entrar", { managerId: "m_dir2", managerName: "Outro", clube: flamengo, forca: 80, papel: "diretor" })
if (repetido.corpo.erro !== "papel_ocupado") erro(`papel já ocupado devia recusar, veio ${JSON.stringify(repetido.corpo)}`)
else ok("papel já ocupado é recusado")

await chamar("/v1/carreira/entrar", { managerId: "m_pre", managerName: "Presidente", clube: flamengo, forca: 80, papel: "presidente" })
await chamar("/v1/carreira/entrar", { managerId: "m_olh", managerName: "Olheiro", clube: flamengo, forca: 80, papel: "olheiro" })
const quatro = (await chamar(`/v1/carreira/estado?managerId=m_a`, null, "GET")).corpo
if (Object.keys(quatro.papeisDoMeuClube).length !== 4) erro(`o clube devia ter os 4 papéis, veio ${JSON.stringify(quatro.papeisDoMeuClube)}`)
else ok("quatro pessoas no mesmo clube (diretoria online)")
if (quatro.tabela.length !== 2) erro(`quatro pessoas em dois clubes = DUAS linhas na tabela, veio ${quatro.tabela.length}`)
else ok("a tabela é dos CLUBES, não das pessoas")

// Cada papel faz o que os outros não fazem.
const diretorJogando = await chamar("/v1/carreira/resultado", { matchId: partida2.matchId, managerId: "m_dir", golsCasa: 1, golsFora: 0 })
if (diretorJogando.corpo.erro !== "so_o_tecnico_joga") erro(`só o técnico joga; veio ${JSON.stringify(diretorJogando.corpo)}`)
else ok("o diretor não joga a partida")

const tecnicoAbrindo = await chamar("/v1/carreira/rodada", { managerId: "m_a" })
if (tecnicoAbrindo.corpo.erro !== "so_o_presidente_abre") erro(`com presidente no clube, é ele quem abre; veio ${JSON.stringify(tecnicoAbrindo.corpo)}`)
else ok("com presidente no clube, o técnico não abre a rodada")

const tetoDefinido = await chamar("/v1/carreira/teto", { managerId: "m_pre", teto: 5 })
if (tetoDefinido.corpo.tetoDeCompra !== 5) erro(`o presidente devia definir o teto, veio ${JSON.stringify(tetoDefinido.corpo)}`)
else ok("o presidente definiu o teto de compra (5 mi)")

const tetoPeloTecnico = await chamar("/v1/carreira/teto", { managerId: "m_a", teto: 500 })
if (tetoPeloTecnico.corpo.erro !== "so_o_presidente_define") erro(`só o presidente define o teto; veio ${JSON.stringify(tetoPeloTecnico.corpo)}`)
else ok("o técnico não mexe no teto")

const caro = await chamar("/v1/carreira/anunciar", { managerId: "m_b", atleta: { id: "atl_2", nome: "Caro", posicao: "MEI", overall: 80 }, preco: 40 })
const compraCara = await chamar("/v1/carreira/comprar", { managerId: "m_dir", anuncioId: caro.corpo.anuncio.anuncioId })
if (compraCara.corpo.erro !== "acima_do_teto") erro(`compra acima do teto devia ser recusada, veio ${JSON.stringify(compraCara.corpo)}`)
else ok("compra acima do teto do presidente é recusada PELO SERVIDOR")

const espiada = (await chamar(`/v1/carreira/espiar?managerId=m_olh`, null, "GET")).corpo
if (!espiada.ok || !espiada.relatorio?.clube) erro(`o olheiro devia ver o adversário, veio ${JSON.stringify(espiada)}`)
else ok(`o olheiro vê o próximo adversário (${espiada.relatorio.clube}, força ${espiada.relatorio.forca})`)

const semOlheiro = (await chamar(`/v1/carreira/espiar?managerId=m_b`, null, "GET")).corpo
if (semOlheiro.erro !== "sem_olheiro") erro(`clube sem olheiro não espia; veio ${JSON.stringify(semOlheiro)}`)
else ok("clube sem olheiro não espia")

// ── 7. Eventos da semana ────────────────────────────────────────────────────
await chamar("/v1/eventos/resultado", { managerId: "m_a", managerName: "Isaac", pontos: 4, saldo: 2, golsPro: 5 })
await chamar("/v1/eventos/resultado", { managerId: "m_a", managerName: "Isaac", pontos: 1, saldo: -3, golsPro: 1 })
const evento = (await chamar("/v1/eventos/classificacao", null, "GET")).corpo
const linha = evento.linhas?.[0]
if (!linha || linha.pontos !== 4) erro(`devia valer a MELHOR tentativa (4), veio ${JSON.stringify(evento.linhas)}`)
else ok(`evento guarda a melhor tentativa (${linha.pontos} pontos em ${linha.tentativas} tentativas)`)

await chamar("/v1/eventos/resultado", { managerId: "m_c", managerName: "Trapaceiro", pontos: 9999, saldo: 9999, golsPro: 9999 })
const teto = (await chamar("/v1/eventos/classificacao", null, "GET")).corpo
const impossivel = teto.linhas.find(l => l.id === "m_c")
if (!impossivel || impossivel.pontos !== 9 || impossivel.saldo !== 30) {
  erro(`pontuação impossível devia ser travada no teto do modo, veio ${JSON.stringify(impossivel)}`)
} else ok("pontuação impossível travada no teto do modo (9 pontos, saldo 30)")

// ── 8. Sobrevive ao reinício ────────────────────────────────────────────────
relay.kill()
await esperar(600)
relay = subirRelay()
for (let i = 0; i < 40; i++) {
  try { const r = await chamar("/health", null, "GET"); if (r.corpo?.ok) break } catch { await esperar(250) }
}
const depois = (await chamar(`/v1/carreira/estado?managerId=m_a`, null, "GET")).corpo
if (depois.ocupadas !== 2 || depois.tabela[0].pontos !== 3) erro(`o mundo devia estar em disco, veio ${JSON.stringify(depois.tabela)}`)
else ok("o mundo (vagas, tabela e caixa) sobreviveu ao reinício")

relay.kill()
try { rmSync(DATA, { recursive: true, force: true }) } catch { /* o Windows às vezes segura o arquivo */ }
console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
