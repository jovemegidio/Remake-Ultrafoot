#!/usr/bin/env node
// DOUTOR DO AMBIENTE — o que conferir ANTES de acreditar num "passou".
//
//   node scripts/doutor-do-ambiente.mjs
//
// ⚠️ POR QUE ESTE ARQUIVO EXISTE, e por que ele é o primeiro passo do guia.
//
// Este projeto tem uma armadilha que não dá erro: quando a árvore está numa
// pasta sincronizada (OneDrive, Google Drive, unidade de rede), os arquivos de
// `node_modules` viram MARCADORES DE 0 BYTE. `node` executa um arquivo vazio,
// não reclama de nada e devolve 0.
//
// O efeito prático é o pior possível:
//
//     npx tsc --noEmit      ->  nenhuma saída, código 0
//
// que é EXATAMENTE o que um type-check limpo parece. Numa árvore assim já se
// aprovou mudança quebrada mais de uma vez, porque a única evidência disponível
// ("não reclamou") é indistinguível de sucesso.
//
// A conferência que vale, então, não é "o comando passou": é PEDIR AO
// VERIFICADOR QUE ENCONTRE UM ERRO QUE SABEMOS EXISTIR. Se ele não achar, ele
// não está olhando. É o que a checagem `tsc-de-verdade` faz aqui embaixo, e é o
// mesmo raciocínio que qualquer pessoa deveria aplicar antes de confiar num
// teste verde neste repositório.

import { existsSync, readFileSync, statSync, mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { execFileSync, spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const raiz = resolve(process.cwd())
let problemas = 0
let avisos = 0

const ok = (t, extra = "") => console.log(`  ok   ${t}${extra ? ` — ${extra}` : ""}`)
const falha = (t, comoResolver) => { problemas++; console.log(` FALHA ${t}\n         ↳ ${comoResolver}`) }
const aviso = (t, comoResolver) => { avisos++; console.log(` aviso ${t}\n         ↳ ${comoResolver}`) }

console.log("\n── Ferramentas ────────────────────────────────────────────────\n")

const maiorNode = Number(process.versions.node.split(".")[0])
if (maiorNode >= 20) ok("Node", process.version)
else falha(`Node ${process.version} é antigo`, "instale o Node 20 ou mais novo (nvm install 20).")

console.log("\n── node_modules ───────────────────────────────────────────────\n")

if (!existsSync(join(raiz, "node_modules"))) {
  falha("node_modules não existe", "rode `pnpm install` (ou `npm install`) na raiz do projeto.")
} else {
  // ⚠️ A CHECAGEM CENTRAL. Arquivo de 0 byte = marcador de nuvem, não código.
  const precisam = [
    ["typescript/lib/tsc.js", "typescript"],
    ["next/dist/bin/next", "next"],
    ["react/index.js", "react"],
  ]
  let ocos = 0
  for (const [caminho, pacote] of precisam) {
    const alvo = join(raiz, "node_modules", caminho)
    if (!existsSync(alvo)) { ocos++; falha(`${pacote} não está instalado`, `falta ${caminho}. Rode \`pnpm install\`.`); continue }
    const tamanho = statSync(alvo).size
    if (tamanho === 0) {
      ocos++
      falha(
        `${pacote} está OCO (${caminho} tem 0 byte)`,
        "a árvore está numa pasta sincronizada e os arquivos viraram marcadores.\n"
        + "           Copie o projeto para um disco LOCAL (ex.: C:\\ultrafoot) e rode `pnpm install` lá.\n"
        + "           Nesta árvore, todo type-check e todo build vão 'passar' sem checar nada.",
      )
    } else {
      // Em bytes quando é pequeno: "0 KB" ao lado de um "ok" imita justamente
      // o arquivo oco que esta checagem existe para denunciar.
      ok(pacote, `${caminho} (${tamanho < 1024 ? `${tamanho} B` : `${(tamanho / 1024).toFixed(0)} KB`})`)
    }
  }

  // A PROVA. Um verificador que não acha um erro plantado não é um verificador.
  if (ocos === 0) {
    console.log("\n── O type-check está mesmo checando? ──────────────────────────\n")
    const tsc = join(raiz, "node_modules", "typescript", "bin", "tsc")
    const pasta = mkdtempSync(join(tmpdir(), "uf-doutor-"))
    const arquivo = join(pasta, "erro-de-proposito.ts")
    writeFileSync(arquivo, 'export const x: number = "isto nao e numero"\n')
    let saida = ""
    try {
      execFileSync(process.execPath, [tsc, "--noEmit", "--strict", arquivo], { encoding: "utf8", stdio: "pipe" })
    } catch (e) {
      saida = `${e.stdout ?? ""}${e.stderr ?? ""}`
    }
    rmSync(pasta, { recursive: true, force: true })
    if (saida.includes("TS2322")) {
      ok("o tsc acusou o erro plantado", "type-check confiável")
    } else {
      falha(
        "o tsc NÃO acusou um erro plantado",
        "ele está rodando, mas não está checando. Trate todo 'passou' desta árvore como SEM VALOR\n"
        + "           até isto aqui ficar verde. Quase sempre é a mesma causa: pasta sincronizada.",
      )
    }
  }
}

console.log("\n── Onde a árvore está ─────────────────────────────────────────\n")

// Unidade de rede/nuvem: a causa raiz das duas falhas acima.
const suspeitas = [/^[a-z]:\\?$/i.test(raiz) ? null : null, "onedrive", "google drive", "dropbox", "outros computadores"]
  .filter(Boolean)
const minusculo = raiz.toLowerCase()
const naNuvem = suspeitas.some(s => minusculo.includes(s))
if (naNuvem) {
  aviso(
    "a árvore está numa pasta sincronizada",
    `${raiz}\n           Serve para LER e para editar, mas não para instalar dependências nem gerar build.\n`
    + "           Trabalhe numa cópia em disco local; é de onde saem os builds oficiais.",
  )
} else {
  ok("disco local", raiz)
}

// `desktop.ini` dentro do .git faz TODO comando git cuspir "broken ref".
if (existsSync(join(raiz, ".git"))) {
  // ⚠️ `git` avisa de ref quebrada no STDERR e mesmo assim sai com 0 — por isso
  // aqui é `spawnSync` (que entrega o stderr do caminho de sucesso) e não
  // `execFileSync`, que só o expõe quando o comando falha.
  const r = spawnSync("git", ["for-each-ref"], { cwd: raiz, encoding: "utf8" })
  const refsSujas = `${r.stderr ?? ""}`.includes("broken ref")
  if (refsSujas) {
    aviso(
      "há `desktop.ini` dentro de .git/refs",
      "todo comando git imprime dezenas de 'ignoring broken ref'. Limpe com:\n"
      + "           find .git/refs -name desktop.ini -delete",
    )
  } else {
    ok("refs do git limpas")
  }
}

console.log("\n── Assets e versões ───────────────────────────────────────────\n")

if (existsSync(join(raiz, "public"))) ok("public/ presente")
else aviso("public/ não existe", "os escudos, camisas e fundos não são versionados; veja a seção de assets no CONTRIBUTING.md.")

// As QUATRO versões do launcher precisam bater. Desalinhamento entre elas já
// deixou o canal de atualização em laço infinito (o binário se achava mais
// velho que o manifesto, atualizava, e reabria na mesma versão).
const versaoDe = (caminho, ler) => {
  const alvo = join(raiz, caminho)
  if (!existsSync(alvo)) return null
  try { return ler(readFileSync(alvo, "utf8")) } catch { return null }
}
const quatro = {
  "Launcher/package.json": versaoDe("Launcher/package.json", t => JSON.parse(t).version),
  "Launcher/src-tauri/tauri.conf.json": versaoDe("Launcher/src-tauri/tauri.conf.json", t => JSON.parse(t).version),
  "Launcher/src-tauri/Cargo.toml": versaoDe("Launcher/src-tauri/Cargo.toml", t => t.match(/^version\s*=\s*"([^"]+)"/m)?.[1]),
  "services/cloud-save-server/launcher.json": versaoDe("services/cloud-save-server/launcher.json", t => JSON.parse(t).version),
}
const presentes = Object.entries(quatro).filter(([, v]) => v)
if (presentes.length === 0) {
  ok("launcher não está nesta árvore", "nada a conferir")
} else {
  const distintas = new Set(presentes.map(([, v]) => v))
  if (distintas.size === 1) {
    ok("as 4 versões do launcher batem", [...distintas][0])
  } else {
    falha(
      "as versões do launcher NÃO batem",
      presentes.map(([k, v]) => `${v}  ${k}`).join("\n           ")
      + "\n           As quatro têm de ser iguais — o Cargo.toml é o que o binário usa para se identificar.",
    )
  }
}

console.log(
  problemas === 0
    ? `\n✓ ambiente pronto${avisos ? ` (${avisos} aviso(s))` : ""}\n`
    : `\n✗ ${problemas} problema(s) — resolva antes de confiar em qualquer 'passou'\n`,
)
process.exit(problemas === 0 ? 0 : 1)
