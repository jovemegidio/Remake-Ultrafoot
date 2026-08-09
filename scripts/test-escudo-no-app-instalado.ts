/**
 * ESCUDO E UNIFORME TÊM DE RESOLVER NO APP INSTALADO.
 *
 * ⚠️ O DEFEITO QUE ISTO TRAVA (relato: "escudos e uniformes foram perdidos" —
 * escudo genérico e imagem quebrada no jogo instalado, desde a 1.0.266).
 *
 * `getEscudoUrl`/`getCamisaUrl` decidem a URL por ambiente:
 *
 *     isTauri()  ->  game-asset://localhost/escudos/x.webp   (empacotado)
 *     senão      ->  https://.../teams/escudos/x.png         (repositório remoto)
 *
 * O jogo é EXPORT ESTÁTICO: o HTML é pré-renderizado no build, onde `window` não
 * existe e `isTauri()` é FALSO. O `src` que vai gravado no HTML é, portanto, a
 * URL REMOTA — e o React não corrige atributo divergente na hidratação, então ela
 * permanece dentro do aplicativo. O escudo passou a depender de internet e de um
 * repositório de terceiros.
 *
 * O que este teste garante:
 *   1. o caminho EMPACOTADO existe de verdade em `public/` para os clubes reais;
 *   2. ele começa com `/` (é caminho local, não URL remota), que é o que o
 *      `gameAssetUrl` precisa para virar `game-asset://`;
 *   3. a extensão bate com o arquivo em disco (a conversão para WebP já quebrou
 *      isto uma vez).
 *
 * Não exercita React: valida a CAMADA DE DADOS que os componentes usam como
 * segunda tentativa (`getLocalEscudoPath` / `getLocalCamisaPath`).
 */
export {}

import fs from "node:fs"
import path from "node:path"
import { getLocalEscudoPath } from "../lib/escudos-map"
import { getLocalCamisaPath, serieATeams } from "../lib/teams-data"

let falhas = 0
const ok = (nome: string, condicao: boolean, detalhe = "") => {
  console.log(`${condicao ? "OK  " : "FALHA"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`)
  if (!condicao) falhas++
}

const existe = (rel: string) => fs.existsSync(path.join("public", rel.replace(/^\//, "")))

// ── ESCUDOS ─────────────────────────────────────────────────────────────────
const clubes = serieATeams.slice(0, 20)
ok("ha clubes para testar", clubes.length > 0, `${clubes.length} clubes`)

const semBarra = clubes.filter(t => !getLocalEscudoPath(t.file_key).startsWith("/"))
ok("todo caminho empacotado de escudo e LOCAL (comeca com /)", semBarra.length === 0,
  semBarra.slice(0, 3).map(t => `${t.curto}=${getLocalEscudoPath(t.file_key)}`).join(", "))

const escudosFaltando = clubes.filter(t => !existe(getLocalEscudoPath(t.file_key)))
ok("o arquivo do escudo empacotado existe em public/", escudosFaltando.length === 0,
  escudosFaltando.slice(0, 4).map(t => `${t.curto} -> ${getLocalEscudoPath(t.file_key)}`).join(", "))

// A URL remota NUNCA pode ser usada como caminho de arquivo: e o sintoma do bug.
const remota = getLocalEscudoPath(clubes[0].file_key)
ok("o caminho empacotado nao e uma URL http", !/^https?:/i.test(remota), remota)

// ── UNIFORMES ───────────────────────────────────────────────────────────────
const variantes = ["home", "away", "third"] as const
let kitsOk = 0, kitsFaltando = 0
const exemplosKit: string[] = []
for (const t of clubes) {
  for (const v of variantes) {
    const p = getLocalCamisaPath(t.file_key, v)
    if (!p.startsWith("/")) { kitsFaltando++; if (exemplosKit.length < 3) exemplosKit.push(`${t.curto}/${v}=${p}`); continue }
    if (existe(p)) kitsOk++
    else { kitsFaltando++; if (exemplosKit.length < 3) exemplosKit.push(`${t.curto}/${v} -> ${p}`) }
  }
}
// Nem todo clube tem as tres artes (o proprio KitImage desenha quando falta), mas
// a MAIORIA tem que resolver — se cair para perto de zero, o caminho quebrou.
ok("a maioria dos uniformes empacotados existe em public/", kitsOk > kitsFaltando,
  `existem ${kitsOk}, faltam ${kitsFaltando}${exemplosKit.length ? ` (ex.: ${exemplosKit.join(", ")})` : ""}`)

console.log(`\nRESULTADO: ${falhas === 0 ? "TUDO OK" : `${falhas} FALHA(S)`}`)
process.exit(falhas === 0 ? 0 : 1)
