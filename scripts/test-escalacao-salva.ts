// A ESCALACAO SALVA TEM DE VALER.
//
// Relato de jogador: "atualizo os jogadores e salvo, mas quando inicio a partida
// os jogadores que tirei estao jogando".
//
// A causa era uma condicao de TUDO OU NADA no ao-vivo:
//
//     if (manual.length >= 11)  -> usa o XI salvo
//     else                      -> pickStartingXI(...)  // remonta por overall
//
// Bastava UM dos onze ficar indisponivel entre salvar e jogar (lesao na semana,
// convocacao para a selecao, suspensao) para a lista cair para dez, a condicao
// falhar, e as OUTRAS DEZ escolhas irem junto para o lixo. O remonte automatico
// ordena por OVERALL — e o reserva que o tecnico tinha acabado de tirar tem, quase
// sempre, overall maior que o titular improvisado que ele quis promover. Por isso
// o jogador via voltar exatamente quem havia removido.
import { completarEscalacao } from "../lib/formations"

let falhas = 0
const check = (ok: boolean, msg: string) => { if (!ok) { falhas++; console.log(`  FALHA: ${msg}`) } }

interface Atleta { nome: string; pos: string; overall: number }
const a = (nome: string, pos: string, overall: number): Atleta => ({ nome, pos, overall })
const pos = (p: Atleta) => p.pos
const ovr = (p: Atleta) => p.overall

console.log("== Escalacao salva ==")

// Elenco: onze titulares escolhidos pelo tecnico + reservas MAIS FORTES no banco.
// O banco forte e o que expunha o bug: o remonte por overall os promovia.
const escolhidos = [
  a("Goleiro", "GOL", 70),
  a("LatDir", "LD", 68), a("Zag1", "ZAG", 69), a("Zag2", "ZAG", 68), a("LatEsq", "LE", 67),
  a("Volante", "VOL", 70), a("Meia1", "MEI", 71), a("Meia2", "MEI", 70),
  a("PontaE", "PE", 69), a("Centro", "ATA", 72), a("PontaD", "PD", 68),
]
const reservasFortes = [
  a("BancoZag", "ZAG", 85), a("BancoMei", "MEI", 86), a("BancoAta", "ATA", 88),
  a("BancoGol", "GOL", 84), a("BancoLat", "LD", 83),
]

// ── O CASO DO RELATO ────────────────────────────────────────────────────────
// O tecnico salvou os 11. Na semana, o "Centro" se lesiona: sobram 10 escolhidos.
const disponiveis = [...escolhidos.filter(p => p.nome !== "Centro"), ...reservasFortes]
const mantidos = escolhidos.filter(p => p.nome !== "Centro")

const r = completarEscalacao(mantidos, disponiveis, "4-3-3", pos, ovr)
const nomes = new Set(r.starters.map(p => p.nome))

check(r.starters.length === 11, `deveriam sair 11 titulares, sairam ${r.starters.length}`)

// O CORACAO DO TESTE: os dez que sobreviveram continuam titulares.
for (const p of mantidos) {
  check(nomes.has(p.nome), `"${p.nome}" foi escolhido pelo tecnico e sumiu do XI`)
}

// E os reservas fortes NAO invadem o time inteiro — so um entra, no buraco.
const invasores = reservasFortes.filter(p => nomes.has(p.nome))
check(invasores.length === 1, `so 1 reserva deveria entrar (o buraco do ATA), entraram ${invasores.length}: ${invasores.map(p => p.nome).join(", ")}`)
check(invasores[0]?.nome === "BancoAta", `o buraco era de ATACANTE, entrou ${invasores[0]?.nome}`)

// ── Varios buracos de uma vez ───────────────────────────────────────────────
const semTres = escolhidos.filter(p => !["Centro", "Zag1", "Meia1"].includes(p.nome))
const r3 = completarEscalacao(semTres, [...semTres, ...reservasFortes], "4-3-3", pos, ovr)
const n3 = new Set(r3.starters.map(p => p.nome))
check(r3.starters.length === 11, `com tres buracos ainda tem de sair 11, sairam ${r3.starters.length}`)
for (const p of semTres) check(n3.has(p.nome), `"${p.nome}" (mantido) sumiu do XI com tres buracos`)
check(n3.has("BancoAta") && n3.has("BancoZag") && n3.has("BancoMei"),
  "os tres buracos deveriam ser preenchidos por ATA, ZAG e MEI do banco")

// ── Nenhum buraco: nada muda ────────────────────────────────────────────────
const rCheio = completarEscalacao(escolhidos, [...escolhidos, ...reservasFortes], "4-3-3", pos, ovr)
const nCheio = new Set(rCheio.starters.map(p => p.nome))
check(rCheio.starters.length === 11, "com os 11 escolhidos disponiveis, saem os 11")
for (const p of escolhidos) check(nCheio.has(p.nome), `"${p.nome}" saiu do XI mesmo estando disponivel`)
check(reservasFortes.every(p => !nCheio.has(p.nome)), "nenhum reserva pode entrar quando nao ha buraco")

// ── Um unico escolhido: ele fica, o resto completa ──────────────────────────
const um = [escolhidos[9]]  // so o centroavante
const rUm = completarEscalacao(um, [...escolhidos, ...reservasFortes], "4-3-3", pos, ovr)
check(rUm.starters.some(p => p.nome === "Centro"), "o unico escolhido tem de continuar titular")
check(rUm.starters.length === 11, `deveriam sair 11, sairam ${rUm.starters.length}`)

// ── O banco recebe quem sobrou, sem sumir ninguem ───────────────────────────
const total = disponiveis.length
check(r.starters.length + r.bench.length === total,
  `titulares + banco (${r.starters.length}+${r.bench.length}) tem de bater com o elenco disponivel (${total})`)
const todos = new Set([...r.starters, ...r.bench].map(p => p.nome))
check(todos.size === total, "ninguem pode ser duplicado nem perdido entre XI e banco")

console.log(falhas === 0 ? "\nOK — quem o tecnico tirou nao volta, e o buraco e preenchido pela posicao" : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
