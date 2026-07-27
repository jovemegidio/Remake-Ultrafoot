// Importa os uniformes das SELEcoES do sortitoutsi (pastas Nations UEFA e
// CONCACAF — as unicas que o pack traz). Arquivo <pais><1|2|3>.png (digito
// colado) -> public/kits-nations/<id>_<home|away|third>.webp, keyed pelo id da
// selecao no jogo. Roda em C:\Ultrafoot (sharp).
//
// So UEFA e CONCACAF: CONMEBOL/AFC/CAF/OFC nao vem no pack — essas seguem com o
// escudo (que o usuario importa) e o fallback de cores.

import fs from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const SRC = process.argv[2] ?? "C:/Ultrafoot-kits-src"
const OUT = path.join(process.cwd(), "public/kits-nations")
await fs.mkdir(OUT, { recursive: true })

// id da selecao (lib/national-teams) -> { pasta, base } no sortitoutsi.
const MAPA = {
  // UEFA
  inglaterra: ["Nations_-_UEFA", "england"], espanha: ["Nations_-_UEFA", "spain"],
  italia: ["Nations_-_UEFA", "italy"], franca: ["Nations_-_UEFA", "france"],
  alemanha: ["Nations_-_UEFA", "germany"], portugal: ["Nations_-_UEFA", "portugal"],
  holanda: ["Nations_-_UEFA", "netherlands"], belgica: ["Nations_-_UEFA", "belgium"],
  turquia: ["Nations_-_UEFA", "turkey"], russia: ["Nations_-_UEFA", "russia"],
  escocia: ["Nations_-_UEFA", "scotland"], austria: ["Nations_-_UEFA", "austria"],
  bosnia: ["Nations_-_UEFA", "bosnia"], croacia: ["Nations_-_UEFA", "croatia"],
  tchequia: ["Nations_-_UEFA", "czech"], noruega: ["Nations_-_UEFA", "norway"],
  suecia: ["Nations_-_UEFA", "sweden"], suica: ["Nations_-_UEFA", "switzerland"],
  // CONCACAF
  mexico: ["Nations_-_CONCACAF", "mexico"], estados_unidos: ["Nations_-_CONCACAF", "usa"],
  canada: ["Nations_-_CONCACAF", "canada"], curacao: ["Nations_-_CONCACAF", "curacao"],
  haiti: ["Nations_-_CONCACAF", "haiti"], panama: ["Nations_-_CONCACAF", "panama"],
}

const VAR = { 1: "home", 2: "away", 3: "third" }

async function achar(dir, base, idx) {
  // Os arquivos ficam em subpasta "<Pais> - <Liga>"; varre recursivo.
  const alvo = `${base}${idx}.png`
  async function busca(d) {
    for (const nome of await fs.readdir(d)) {
      const p = path.join(d, nome)
      const st = await fs.stat(p)
      if (st.isDirectory()) { const r = await busca(p); if (r) return r }
      else if (nome.toLowerCase() === alvo) return p
    }
    return null
  }
  return busca(dir)
}

let clubs = 0, files = 0
const semArte = []
for (const [id, [pasta, base]] of Object.entries(MAPA)) {
  let algum = false
  for (const idx of [1, 2, 3]) {
    const input = await achar(path.join(SRC, pasta), base, idx)
    if (!input) continue
    // PNG (mesmo formato dos escudos), para o usuario soltar os demais direto.
    await sharp(input).resize(256, 256, { fit: "inside", withoutEnlargement: true })
      .png().toFile(path.join(OUT, `${id}_${VAR[idx]}.png`))
    files++; algum = true
  }
  if (algum) clubs++; else semArte.push(id)
}
console.log(JSON.stringify({ selecoesComKit: clubs, arquivos: files, semArte }, null, 2))
