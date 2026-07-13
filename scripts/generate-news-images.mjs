// Gera as capas das noticias com a API de imagens da OpenAI — EM TEMPO DE BUILD.
//
// Por que build-time e nao runtime: o jogo e um .exe distribuido. Se a chave fosse lida
// em runtime, ela iria DENTRO do binario de cada jogador — qualquer um extrai e gasta a
// conta. Aqui a chave e usada so nesta maquina; os jogadores recebem os PNGs prontos.
// Resultado: offline, sem custo por partida, sem vazar credencial.
//
// A chave fica em .env.local (fora do git). Uso:
//   node scripts/generate-news-images.mjs

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const OUT = "public/noticias"
const MODEL = "gpt-image-1"
const SIZE = "1536x1024" // paisagem, casa com o card de noticia

function loadKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY
  if (!existsSync(".env.local")) return null
  const line = readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("OPENAI_API_KEY="))
  return line ? line.slice("OPENAI_API_KEY=".length).trim() : null
}

// Uma capa por CATEGORIA de noticia (as mesmas de lib/news-image.ts).
// Sem rosto de pessoa real e sem escudo de clube real: evita gerar algo que pareca
// uma foto jornalistica verdadeira de alguem.
const PROMPTS = {
  transfer: [
    "Cinematic wide shot of an empty football stadium tunnel at dusk, moody teal and amber lighting, dramatic shadows, no people, no logos, no text, editorial sports photography style",
    "A football boot and a duffel bag on the grass of an empty pitch at night under floodlights, shallow depth of field, no people, no logos, no text",
  ],
  injury: [
    "Close-up of an empty football pitch with a medical stretcher at the sideline, overcast grey light, somber mood, no people, no logos, no text",
    "Physiotherapy table and ice pack beside an empty football pitch, cold blue light, no people, no logos, no text",
  ],
  match: [
    "Dramatic wide shot of a packed football stadium at night under floodlights, green pitch glowing, atmospheric haze, no readable logos, no text",
    "Football on the penalty spot of a floodlit pitch, stadium blurred behind, cinematic, no people, no logos, no text",
  ],
  highlight: [
    "Golden hour light flooding an empty football stadium, confetti in the air, celebratory atmosphere, no people, no logos, no text",
    "Silhouette of a stadium roof against a dramatic sunset sky, lens flare, cinematic sports editorial, no text",
  ],
  ranking: [
    "Abstract editorial sports graphic: a football pitch seen from directly above, geometric, teal and dark navy palette, no text, no logos",
    "Empty football stadium seen from the top tier, symmetric composition, moody lighting, no people, no text",
  ],
  announcement: [
    "Empty press conference room of a football club, microphones on a table, dark backdrop, cinematic lighting, no people, no logos, no text",
    "Football club training ground at sunrise, empty, mist over the grass, no people, no logos, no text",
  ],
}

const key = loadKey()
if (!key) {
  console.error("OPENAI_API_KEY ausente (.env.local). Abortando.")
  process.exit(1)
}

mkdirSync(OUT, { recursive: true })

let created = 0
let skipped = 0
const failed = []

for (const [category, prompts] of Object.entries(PROMPTS)) {
  for (let i = 0; i < prompts.length; i++) {
    const file = join(OUT, `${category}-${i + 1}.png`)

    // Nao regera o que ja existe: a API e paga, e rodar o script de novo nao deve custar.
    if (existsSync(file)) {
      skipped++
      console.log(`--  ${category}-${i + 1}  (ja existe)`)
      continue
    }

    try {
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: MODEL,
          prompt: prompts[i],
          size: SIZE,
          n: 1,
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        failed.push(`${category}-${i + 1}: HTTP ${res.status} ${body.slice(0, 200)}`)
        continue
      }

      const json = await res.json()
      const b64 = json?.data?.[0]?.b64_json
      if (!b64) {
        failed.push(`${category}-${i + 1}: resposta sem b64_json`)
        continue
      }

      writeFileSync(file, Buffer.from(b64, "base64"))
      created++
      console.log(`OK  ${category}-${i + 1}`)
    } catch (err) {
      failed.push(`${category}-${i + 1}: ${err.message}`)
    }
  }
}

console.log(`\n${created} geradas, ${skipped} ja existiam, ${failed.length} falharam`)
if (failed.length) {
  console.log("\nFALHAS:")
  for (const f of failed) console.log(`  - ${f}`)
  process.exitCode = 1
}
