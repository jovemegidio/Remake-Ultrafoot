// Importa os ESCUDOS das selecoes da pasta sortitoutsi/logos/Selecoes (arquivos
// por nome de pais em portugues) para public/escudos/nations/<id>.png, keyed
// pelo id da selecao no jogo. Casa por nome normalizado + aliases.
//
// Uso: npx tsx scripts/import-nation-crests.ts [--write]
import { readdirSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import sharp from "sharp"
import { NATIONAL_TEAMS } from "../lib/national-teams"

const SRC = "G:/Outros computadores/Meu laptop/Trabalho/Ultrafoot - PC/sortitoutsi/logos/Seleções"
const OUT = join(process.cwd(), "public/escudos/nations")
const WRITE = process.argv.includes("--write")

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/\.png$/i, "").replace(/[^a-z0-9]+/g, " ").trim()

// Nome do arquivo (pt) esperado por id, quando difere do name do jogo.
const ALIAS: Record<string, string> = {
  ira: "ira", // "Irã.png"
  qatar: "catar",
  congo_dr: "republica democratica do congo",
  coreia_do_sul: "coreia do sul",
  bosnia: "bosnia e herzegovina",
  tchequia: "republica tcheca",
  holanda: "paises baixos",
  egito: "egito efa", // arquivo "Egito - EFA.png" (o atual; ha tambem o "antigo")
  // Curacao: a pasta so tem o badge (defunto) das Antilhas Holandesas — impreciso.
  // Fica no fallback de cores ate um escudo proprio.
  estados_unidos: "estados unidos",
  arabia_saudita: "arabia saudita",
  africa_do_sul: "africa do sul",
  costa_do_marfim: "costa do marfim",
  cabo_verde: "cabo verde",
  nova_zelandia: "nova zelandia",
}

if (!existsSync(SRC)) { console.error("pasta nao encontrada: " + SRC); process.exit(1) }
const arquivos = readdirSync(SRC).filter(f => /\.png$/i.test(f))
const porNome = new Map<string, string>()
for (const f of arquivos) porNome.set(norm(f), f)
// Segundo indice: tenta tambem so o primeiro token (Congo, etc.) sem sobrescrever.
const alt = new Map<string, string>()
for (const f of arquivos) { const k = norm(f); if (!alt.has(k)) alt.set(k, f) }

async function main() {
  if (WRITE) mkdirSync(OUT, { recursive: true })
  let ok = 0
  const miss: string[] = []
  for (const nt of NATIONAL_TEAMS) {
    const chave = ALIAS[nt.id] ?? norm(nt.name)
    const arq = porNome.get(chave) ?? porNome.get(norm(nt.name))
    if (!arq) { miss.push(`${nt.id} (${nt.name})`); continue }
    ok++
    if (WRITE) {
      await sharp(join(SRC, arq)).resize(256, 256, { fit: "inside", withoutEnlargement: true })
        .png().toFile(join(OUT, `${nt.id}.png`))
    }
  }
  console.log(`casados: ${ok}/${NATIONAL_TEAMS.length}`)
  if (miss.length) console.log("SEM MATCH:\n  " + miss.join("\n  "))
  if (WRITE) console.log(`\nescudos gravados em public/escudos/nations`)
}
main()
