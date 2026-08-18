// PRÉ-COMPUTA O POOL DE CLUBES — a peneira roda na compilação, não no jogo.
//
// ⚠️ POR QUE ISTO EXISTE. Medido em 18/08/2026: carregar `lib/teams-data` custava
// 543 ms, e a maior parte era filtrar os 3.064 clubes do banco importado —
// `repairMojibake`, normalização de país, quatro peneiras de duplicidade e a
// montagem de cada `Team`. O resultado é sempre o mesmo, porque a entrada é um
// seed que não muda em tempo de execução.
//
// E o custo se pagava INTEIRO a cada tela. No jogo toda navegação é recarga
// completa: o módulo é reconstruído ao abrir o pré-jogo, ao entrar na partida, ao
// voltar ao escritório. Era isso o "demora no carregamento" da partida.
//
// ⚠️ O TRUQUE DA GALINHA E DO OVO. Este script precisa do resultado da peneira
// para gravá-lo — mas o módulo, se achar o arquivo gravado, usa o arquivo e não
// roda a peneira. `UF_POOL_SEM_CACHE=1` desliga a leitura do cache: é assim que
// ele consegue gerar o que ele mesmo vai substituir.
//
// Uso: node scripts/precomputar-pool.mjs

import { writeFileSync, statSync, existsSync } from "node:fs"
import { execFileSync } from "node:child_process"

const DESTINO = "data/seeds/pool-filtrado.json"

// Roda num processo separado com o cache DESLIGADO, e recebe o JSON pela saída.
// Importar aqui não serviria: este processo já teria o módulo em memória com o
// cache antigo aplicado.
const codigo = `
import { allPoolTeams } from "@/lib/teams-data"
process.stdout.write(JSON.stringify({ teams: allPoolTeams }))
`
const temporario = "scripts/.pool-tmp.ts"
writeFileSync(temporario, codigo)

let json
try {
  json = execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", temporario],
    { env: { ...process.env, UF_POOL_SEM_CACHE: "1" }, maxBuffer: 256 * 1024 * 1024, encoding: "utf-8" },
  )
} finally {
  try { execFileSync(process.platform === "win32" ? "cmd" : "rm",
    process.platform === "win32" ? ["/c", "del", temporario.replace(/\//g, "\\")] : ["-f", temporario],
    { stdio: "ignore" }) } catch { /* o temporário some no próximo run */ }
}

const dados = JSON.parse(json)
if (!Array.isArray(dados.teams) || dados.teams.length === 0) {
  console.error("FALHA: a peneira devolveu pool vazio. Nada foi gravado —")
  console.error("gravar vazio faria o jogo perder 2.300 clubes em silêncio.")
  process.exit(1)
}

const antes = existsSync(DESTINO) ? statSync(DESTINO).size : 0
writeFileSync(DESTINO, JSON.stringify(dados))
const depois = statSync(DESTINO).size

console.log(`pool pre-computado: ${dados.teams.length} clubes`)
console.log(`  ${DESTINO}: ${(antes / 1024).toFixed(0)} KB -> ${(depois / 1048576).toFixed(2)} MB`)
