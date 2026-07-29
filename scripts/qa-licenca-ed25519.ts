// ETAPA 4 — TESTES DO ESQUEMA Ed25519.
//
//   npx tsx scripts/qa-licenca-ed25519.ts
//
// Cobre a lista do §7 do plano. O ponto destes testes não é "o código roda": é
// provar as propriedades de que a receita depende — que forjar não funciona, que
// copiar o certificado para outra máquina não registra, e que quem ativou
// continua registrado SEM internet.
//
// COMPLEMENTA, não substitui, os testes em `src-tauri/src/licenca.rs` (que
// verificam o Rust compilado) e `services/auth-server/` (que verificam as
// rotas). Aqui a pergunta é a interoperabilidade: o que o servidor Python assina
// é exatamente o que o jogo aceita?

import { execFileSync } from "node:child_process"
import { readFileSync, mkdtempSync, existsSync } from "node:fs"
import { createPublicKey, verify as verificarAssinatura } from "node:crypto"
import { tmpdir } from "node:os"
import path from "node:path"

const RAIZ = path.resolve(import.meta.dirname, "..")
const AUTH = path.join(RAIZ, "services", "auth-server")

let falhas = 0
const checar = (ok: boolean, msg: string) => {
  if (!ok) { falhas++; console.log("  FALHOU:", msg) } else console.log("  ok:", msg)
}

/** A chave pública LIDA DO FONTE Rust — não colada aqui a mão.
 *
 * Ler do arquivo é de propósito: se alguém trocar a chave no `licenca.rs` sem
 * atualizar o servidor, este teste quebra. Uma constante duplicada aqui
 * esconderia exatamente esse erro. */
function publicaDoRust(): string {
  const fonte = readFileSync(path.join(RAIZ, "src-tauri", "src", "licenca.rs"), "utf8")
  const m = fonte.match(/\("v1",\s*"([^"]+)"\)/)
  if (!m) throw new Error("chave pública v1 não encontrada em src-tauri/src/licenca.rs")
  return m[1]
}

/** Assina um certificado chamando o MESMO módulo que o servidor usa. */
function emitirPeloServidor(codigo: string, device: string, chavePrivada: string): string {
  const py = `
import os, sys, json
os.environ["ULTRAFOOT_LICENSE_PRIVATE_KEY"] = ${JSON.stringify(chavePrivada)}
os.environ["ULTRAFOOT_LICENSE_KID"] = "v1"
sys.path.insert(0, ${JSON.stringify(AUTH)})
import licenca
print(licenca._assinar({
    "codigo": ${JSON.stringify(codigo)},
    "device": ${JSON.stringify(device)},
    "kid": "v1",
    "emitido_em": 1785000000,
    "serie": 42,
}))
`
  return execFileSync("python", ["-c", py], { encoding: "utf8" }).trim()
}

/** Reproduz a verificação do Rust (`licenca.rs`) para rodar fora do Tauri. */
function verificarComoOJogo(bruto: string, deviceAtual: string | null, publica: string) {
  const i = bruto.indexOf(".")
  if (i < 0) return { valido: false, motivo: "formato" }

  let payload: Buffer, assinatura: Buffer
  try {
    payload = Buffer.from(bruto.slice(0, i), "base64")
    assinatura = Buffer.from(bruto.slice(i + 1), "base64")
  } catch { return { valido: false, motivo: "formato" } }
  if (assinatura.length !== 64) return { valido: false, motivo: "formato" }

  let cert: { codigo: string; device: string; kid: string; serie: number }
  try { cert = JSON.parse(payload.toString()) } catch { return { valido: false, motivo: "formato" } }
  if (cert.kid !== "v1") return { valido: false, motivo: "kid-desconhecido" }

  const chave = createPublicKey({ key: Buffer.from(publica, "base64"), format: "der", type: "spki" })
  if (!verificarAssinatura(null, payload, chave, assinatura)) {
    return { valido: false, motivo: "assinatura" }
  }
  // A assinatura é conferida ANTES do device de propósito: só depois de provado
  // autêntico faz sentido aplicar a regra que o servidor gravou dentro dele.
  if (deviceAtual && cert.device !== deviceAtual) return { valido: false, motivo: "device" }
  return { valido: true, certificado: cert }
}

const rodar = async () => {
  const chavePrivada = path.join(
    process.env.HOME ?? process.env.USERPROFILE ?? "",
    ".ultrafoot-keys", "ultrafoot-licenca-v1.private.pem",
  )

  const publica = publicaDoRust()
  console.log("chave pública lida de src-tauri/src/licenca.rs\n")

  // ── A propriedade central: o par bate ──────────────────────────────────────
  const derivada = execFileSync("python", ["-c", `
import base64
from cryptography.hazmat.primitives import serialization
p = serialization.load_pem_private_key(open(${JSON.stringify(chavePrivada)}, "rb").read(), password=None)
print(base64.b64encode(p.public_key().public_bytes(
    serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)).decode())
`], { encoding: "utf8" }).trim()
  checar(derivada === publica, "a pública do jogo corresponde à privada do servidor")

  // ── §7: certificado legítimo é aceito ──────────────────────────────────────
  const DEVICE = "MAQUINA-DO-COMPRADOR"
  const cert = emitirPeloServidor("UF26-ABCDE-FGHIJ-KLMNO", DEVICE, chavePrivada)

  const bom = verificarComoOJogo(cert, DEVICE, publica)
  checar(bom.valido, "certificado emitido pelo servidor é aceito pelo jogo")
  checar(bom.certificado?.serie === 42, "os dados voltam íntegros (série 42)")

  // ── §7: forja rejeitada ────────────────────────────────────────────────────
  const [payloadB64, assinaturaB64] = cert.split(".")
  const inventada = Buffer.alloc(64, 7).toString("base64")
  checar(verificarComoOJogo(`${payloadB64}.${inventada}`, DEVICE, publica).motivo === "assinatura",
    "assinatura inventada (sem a privada) é rejeitada")

  const mexido = Buffer.from(
    Buffer.from(payloadB64, "base64").toString().replace('"serie":42', '"serie":9999'),
  ).toString("base64")
  checar(verificarComoOJogo(`${mexido}.${assinaturaB64}`, DEVICE, publica).motivo === "assinatura",
    "adulterar UM campo do payload invalida a assinatura")

  // Trocar o device no payload também tem de cair — senão bastaria editar o
  // arquivo para usar a licença alheia.
  const outroDevice = Buffer.from(
    Buffer.from(payloadB64, "base64").toString().replace(DEVICE, "PC-PIRATA-XXXXXXXX"),
  ).toString("base64")
  checar(verificarComoOJogo(`${outroDevice}.${assinaturaB64}`, "PC-PIRATA-XXXXXXXX", publica).motivo === "assinatura",
    "reescrever o device no certificado invalida a assinatura")

  // ── §7: replay entre máquinas ──────────────────────────────────────────────
  checar(verificarComoOJogo(cert, "OUTRO-PC", publica).motivo === "device",
    "certificado copiado para OUTRA máquina é rejeitado")

  // ── §7: offline depois de ativar ───────────────────────────────────────────
  //
  // O teste que faltava. A verificação acima não fez UMA chamada de rede — é
  // exatamente essa a promessa: ativou uma vez, joga para sempre sem internet.
  const semRede = verificarComoOJogo(cert, DEVICE, publica)
  checar(semRede.valido, "depois de ativado, o jogo valida SEM rede")

  // ── §7: revogação vale na próxima ativação ─────────────────────────────────
  const tmp = mkdtempSync(path.join(tmpdir(), "uf-qa-"))
  const db = path.join(tmp, "auth.db")
  const saidaRevog = execFileSync("python", ["-c", `
import os, sqlite3, sys
sys.path.insert(0, ${JSON.stringify(AUTH)})
os.environ["ULTRAFOOT_LICENSE_PRIVATE_KEY"] = ${JSON.stringify(chavePrivada)}
import licenca
con = sqlite3.connect(${JSON.stringify(db)}); con.row_factory = sqlite3.Row
con.executescript(open(os.path.join(${JSON.stringify(AUTH)}, "schema.sql"), encoding="utf-8").read())
con.execute("INSERT INTO contas (email,nome,criada_em) VALUES ('a@a','A',0)")
cod = licenca.emitir(con, 1)
c1, e1 = licenca.ativar(con, cod, "PC-1")
licenca.revogar(con, cod, "chave vazada")
c2, e2 = licenca.ativar(con, cod, "PC-2")
print("ATIVOU_ANTES=" + str(bool(c1)))
print("ATIVOU_DEPOIS=" + str(bool(c2)))
print("ERRO=" + e2)
`], { encoding: "utf8" })
  checar(saidaRevog.includes("ATIVOU_ANTES=True"), "chave válida ativa normalmente")
  checar(saidaRevog.includes("ATIVOU_DEPOIS=False"), "chave revogada NÃO ativa em máquina nova")

  // ── §7: idempotência ───────────────────────────────────────────────────────
  const saidaIdem = execFileSync("python", ["-c", `
import os, sqlite3, sys
sys.path.insert(0, ${JSON.stringify(AUTH)})
os.environ["ULTRAFOOT_LICENSE_PRIVATE_KEY"] = ${JSON.stringify(chavePrivada)}
import licenca
con = sqlite3.connect(":memory:"); con.row_factory = sqlite3.Row
con.executescript(open(os.path.join(${JSON.stringify(AUTH)}, "schema.sql"), encoding="utf-8").read())
con.execute("INSERT INTO contas (email,nome,criada_em) VALUES ('a@a','A',0)")
cod = licenca.emitir(con, 1)
c1, _ = licenca.ativar(con, cod, "MESMO-PC")
c2, _ = licenca.ativar(con, cod, "MESMO-PC")
print("IGUAL_CODIGO=" + str(licenca.emitir(con, 1) == cod))
print("REATIVOU=" + str(bool(c1) and bool(c2)))
`], { encoding: "utf8" })
  checar(saidaIdem.includes("REATIVOU=True"), "reativar na MESMA máquina funciona (reinstalar o jogo)")
  checar(saidaIdem.includes("IGUAL_CODIGO=True"), "emitir duas vezes devolve a MESMA chave")

  // ── §7: o segredo antigo sumiu do código? ──────────────────────────────────
  //
  // O teste que fecha a etapa 6. Não basta ter parado de USAR o segredo: ele não
  // pode mais existir no código, senão o `prebuild` volta a injetá-lo no bundle
  // numa refatoração distraída e o buraco reabre sem ninguém notar.
  const licenseTs = readFileSync(path.join(RAIZ, "lib", "license.ts"), "utf8")
  checar(!licenseTs.includes("NEXT_PUBLIC_ULTRAFOOT_LICENSE_SECRET"),
    "lib/license.ts não lê mais o segredo de emissão")
  // Procura CÓDIGO, não a palavra: o cabeçalho do arquivo cita "HMAC" ao
  // explicar o que saiu e por quê, e essa explicação é justamente o que impede
  // alguém de reintroduzir o esquema por não saber que ele existiu.
  const semComentarios = licenseTs
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").filter(l => !l.trim().startsWith("//")).join("\n")
  checar(!/crypto\.subtle|createHmac|\bhmac\s*\(/i.test(semComentarios),
    "lib/license.ts não tem mais código de assinatura")

  const pkg = readFileSync(path.join(RAIZ, "package.json"), "utf8")
  checar(!pkg.includes("preparar-env-licenca"),
    "o prebuild não injeta mais o segredo")

  for (const morto of ["scripts/preparar-env-licenca.mjs", "scripts/gerar-codigos.mjs"]) {
    checar(!existsSync(path.join(RAIZ, morto)), `${morto} foi removido`)
  }

  const serverPy = readFileSync(path.join(AUTH, "server.py"), "utf8")
  checar(!serverPy.includes('os.environ.get("ULTRAFOOT_LICENSE_SECRET"'),
    "server.py não lê mais ULTRAFOOT_LICENSE_SECRET")

  // O `licencas_migradas` PRECISA continuar existindo: é o histórico de quem
  // tinha chave antiga, matéria-prima da reemissão e rede do suporte.
  checar(serverPy.includes("licencas_migradas"),
    "licencas_migradas preservado (histórico da migração)")

  console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`)
  process.exit(falhas === 0 ? 0 : 1)
}

void rodar()
