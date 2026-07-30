// Converte os fundos da tela principal (Tela/*.png) para WebP em public/images/menu/.
//
// Motivo: os seis PNG somam ~13 MB. No menu eles entram TODOS na mesma tela (o
// crossfade precisa dos vizinhos ja carregados), entao PNG cru custaria 13 MB de
// download e de memoria de textura so para o menu — o mesmo problema que ja tinha
// levado os fundos do jogo de PNG para WebP.
//
// Uso: node scripts/converter-fundos-menu.mjs
import { mkdir, readdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import sharp from "sharp"

const ORIGEM = "Tela"
const DESTINO = join("public", "images", "menu")

// Ordem explicita: os arquivos vem com numeral romano ("Tela I", "Tela II"...) e
// a ordenacao alfabetica os embaralharia (II < III < I nao vale para strings:
// "Tela I" < "Tela II" < "Tela III" funciona, mas "Tela IV" < "Tela V" < "Tela VI"
// so por sorte). Melhor cravar a sequencia do que depender de sorte.
const ROMANOS = ["I", "II", "III", "IV", "V", "VI"]

const arquivos = await readdir(ORIGEM)
await mkdir(DESTINO, { recursive: true })

const gerados = []
for (let i = 0; i < ROMANOS.length; i++) {
  const nome = arquivos.find(f => f.toLowerCase() === `tela ${ROMANOS[i]}.png`.toLowerCase())
  if (!nome) { console.log(`  faltou: Tela ${ROMANOS[i]}.png`); continue }
  const saida = join(DESTINO, `menu-${i + 1}.webp`)
  const info = await sharp(join(ORIGEM, nome))
    // 1920 de largura basta: o fundo e coberto (object-cover) e ninguem joga o
    // menu em 4K nativo com a arte encostando no pixel.
    .resize({ width: 1920, withoutEnlargement: true })
    .webp({ quality: 82, effort: 5 })
    .toFile(saida)
  gerados.push({ nome, saida, kb: Math.round(info.size / 1024) })
  console.log(`  ${nome} -> ${saida}  (${Math.round(info.size / 1024)} KB)`)
}

const total = gerados.reduce((s, g) => s + g.kb, 0)
console.log(`\n${gerados.length} fundos, ${total} KB no total.`)

// Manifesto para a tela nao precisar adivinhar quantos fundos existem.
await writeFile(
  join(DESTINO, "manifest.json"),
  JSON.stringify({ fundos: gerados.map((_, i) => `/images/menu/menu-${i + 1}.webp`) }, null, 2),
)
console.log(`manifesto escrito em ${join(DESTINO, "manifest.json")}`)
