// Publica a ultima alteracao do jogo no Discord (canal de atualizacoes).
//
// Roda automaticamente pelo hook .git/hooks/post-commit (ver scripts/install-git-hooks.mjs),
// entao toda implementacao/ajuste commitado vira um post no canal em tempo real.
//
// A URL do webhook e uma CREDENCIAL: fica em .env.local (ignorado pelo git), nunca no codigo.
// Uso manual: node scripts/notify-discord.mjs

import { execSync } from "node:child_process"
import { readFileSync, existsSync } from "node:fs"

function loadWebhookUrl() {
  if (process.env.DISCORD_WEBHOOK_URL) return process.env.DISCORD_WEBHOOK_URL
  if (!existsSync(".env.local")) return null
  const line = readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("DISCORD_WEBHOOK_URL="))
  return line ? line.slice("DISCORD_WEBHOOK_URL=".length).trim() : null
}

const webhook = loadWebhookUrl()
if (!webhook) {
  // Sem webhook configurado o commit NAO pode falhar — apenas avisa e sai.
  console.log("[discord] DISCORD_WEBHOOK_URL ausente em .env.local — notificacao pulada.")
  process.exit(0)
}

const git = (cmd) => execSync(`git ${cmd}`, { encoding: "utf8" }).trim()

const subject = git("log -1 --pretty=%s")
const body = git("log -1 --pretty=%b")
const hash = git("log -1 --pretty=%h")
const author = git("log -1 --pretty=%an")
const files = git("show --stat --oneline -1 --name-only --pretty=format:").split(/\r?\n/).filter(Boolean)

// Tipo do commit (conventional commits) -> cor e rotulo do post
const TYPES = {
  feat: { label: "Nova funcionalidade", color: 0x00ffc8 },
  fix: { label: "Correcao", color: 0xff4d4d },
  perf: { label: "Performance", color: 0xffb020 },
  style: { label: "Visual", color: 0xa855f7 },
  refactor: { label: "Refatoracao", color: 0x64748b },
  assets: { label: "Assets", color: 0x38bdf8 },
  chore: { label: "Manutencao", color: 0x64748b },
  docs: { label: "Documentacao", color: 0x64748b },
}

const match = subject.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/)
const type = match?.[1] ?? "chore"
const scope = match?.[2]
const title = match?.[3] ?? subject
const meta = TYPES[type] ?? TYPES.chore

const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s)

const fields = []
if (body) fields.push({ name: "Detalhes", value: truncate(body, 1000) })
if (files.length) {
  fields.push({
    name: `Arquivos (${files.length})`,
    value: truncate(files.slice(0, 12).map((f) => `\`${f}\``).join("\n"), 1000),
  })
}

const payload = {
  username: "Ultrafoot 26",
  embeds: [
    {
      title: truncate(`${meta.label}${scope ? ` · ${scope}` : ""}`, 256),
      description: truncate(`**${title}**`, 4000),
      color: meta.color,
      fields,
      footer: { text: `${hash} · ${author}` },
      timestamp: new Date().toISOString(),
    },
  ],
}

const res = await fetch(webhook, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
})

if (!res.ok) {
  console.log(`[discord] falhou (${res.status}): ${await res.text()}`)
  process.exit(0) // nunca quebra o commit
}
console.log(`[discord] publicado: ${subject}`)
