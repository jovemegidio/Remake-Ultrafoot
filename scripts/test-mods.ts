/**
 * MODS: QUEM VENCE QUANDO DOIS PACOTES TOCAM O MESMO CLUBE.
 *
 * ⚠️ O DEFEITO QUE ISTO TRAVA. A camada de mod entra no MESMO funil que o canal
 * de atualização e a edição local do editor:
 *
 *     build  <  canal  <  MOD  <  edição local
 *
 * Duas coisas aqui já quebraram no projeto por outro caminho e são silenciosas:
 *
 *   1. MESCLA QUE APAGA COLUNA. Um lote parcial do canal, aplicado com
 *      substituição em vez de mescla, apagou os uniformes que não vinham no
 *      lote (263 quase perdidos). Um mod que troca só o uniforme 1 não pode
 *      zerar o 2 e o 3.
 *   2. ORDEM NÃO DETERMINÍSTICA. Sem desempate explícito, "qual mod valeu"
 *      passa a depender da ordem em que o sistema de arquivos devolve as
 *      pastas — o mesmo jogo, na mesma máquina, com resultado diferente.
 *
 * Exercita `mesclarMods`, que é pura: nada de `window`, nada de disco.
 */
export {}

import { mesclarMods, type ModCarregado } from "../lib/mods"

let falhas = 0
const ok = (nome: string, condicao: boolean, detalhe = "") => {
  console.log(`${condicao ? "OK  " : "FALHA"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`)
  if (!condicao) falhas++
}

const mod = (
  id: string,
  clubes: ModCarregado["clubes"],
  ordem?: number,
  extras: Partial<ModCarregado> = {},
): ModCarregado => ({
  manifest: { id, name: id, ...(ordem === undefined ? {} : { ordem }) },
  pasta: id,
  clubes,
  atletas: {},
  escudos: {},
  avisos: [],
  ...extras,
})

// ── 1. `ordem` maior vence ──────────────────────────────────────────────────
{
  const a = mod("aaa", { flamengo_bra: { nome: "Do A" } }, 10)
  const b = mod("zzz", { flamengo_bra: { nome: "Do B" } }, 1)
  const { clubes } = mesclarMods([a, b])
  ok(
    "`ordem` maior vence, mesmo vindo antes no alfabeto",
    clubes.flamengo_bra?.nome === "Do A",
    `venceu "${clubes.flamengo_bra?.nome}"`,
  )
}

// ── 2. Empate na ordem: alfabético pelo id ──────────────────────────────────
{
  const a = mod("aaa", { flamengo_bra: { nome: "Do A" } })
  const z = mod("zzz", { flamengo_bra: { nome: "Do Z" } })
  // Entregues nas duas ordens possíveis: o resultado tem de ser o mesmo, senão a
  // ordem do sistema de arquivos estaria decidindo.
  const direto = mesclarMods([a, z]).clubes.flamengo_bra?.nome
  const invertido = mesclarMods([z, a]).clubes.flamengo_bra?.nome
  ok("empate desempata pelo id, e nao pela ordem de leitura", direto === invertido, `${direto} / ${invertido}`)
  ok("no empate vence o id maior no alfabeto", direto === "Do Z", `venceu "${direto}"`)
}

// ── 3. Mescla não apaga o que o outro mod não citou ─────────────────────────
{
  const base = mod("aaa", { flamengo_bra: { nome: "Flamengo", cor1: "#e2000f", prestigio: 92 } })
  const so_cor = mod("bbb", { flamengo_bra: { cor1: "#ff0000" } })
  const { clubes } = mesclarMods([base, so_cor])
  ok("campo trocado pelo mod de cima vale", clubes.flamengo_bra?.cor1 === "#ff0000")
  ok(
    "campo NAO citado sobrevive (nome)",
    clubes.flamengo_bra?.nome === "Flamengo",
    `nome ficou "${clubes.flamengo_bra?.nome}"`,
  )
  ok("campo NAO citado sobrevive (prestigio)", clubes.flamengo_bra?.prestigio === 92)
}

// ── 4. Kits mesclam por VARIANTE (o defeito nº 1 lá de cima) ────────────────
{
  const completo = mod("aaa", {
    flamengo_bra: {
      kits: {
        home: { primary: "#111", secondary: "#eee", pattern: "stripes" },
        away: { primary: "#fff", secondary: "#000", pattern: "solid" },
        third: { primary: "#0f0", secondary: "#000", pattern: "solid" },
      },
    },
  })
  const so_home = mod("bbb", {
    flamengo_bra: { kits: { home: { primary: "#e2000f", secondary: "#000", pattern: "solid" } } },
  })
  const { clubes } = mesclarMods([completo, so_home])
  const kits = clubes.flamengo_bra?.kits
  ok("uniforme 1 foi trocado", kits?.home?.primary === "#e2000f")
  ok("uniforme 2 sobreviveu", kits?.away?.primary === "#fff", `away = ${kits?.away?.primary ?? "SUMIU"}`)
  ok("uniforme 3 sobreviveu", kits?.third?.primary === "#0f0", `third = ${kits?.third?.primary ?? "SUMIU"}`)
}

// ── 5. Clubes diferentes não se atropelam ───────────────────────────────────
{
  const a = mod("aaa", { flamengo_bra: { nome: "Flamengo" } })
  const b = mod("bbb", { palmeiras_bra: { nome: "Palmeiras" } })
  const { clubes } = mesclarMods([a, b])
  ok("os dois clubes coexistem", clubes.flamengo_bra?.nome === "Flamengo" && clubes.palmeiras_bra?.nome === "Palmeiras")
}

// ── 6. Id repetido avisa (pasta copiada sem trocar o manifesto) ─────────────
{
  const a = mod("mesmo-id", { flamengo_bra: { nome: "A" } })
  const b: ModCarregado = { ...mod("mesmo-id", { palmeiras_bra: { nome: "B" } }), pasta: "copia", avisos: [] }
  mesclarMods([a, b])
  ok("id repetido gera aviso", b.avisos.length > 0 || a.avisos.length > 0, [...a.avisos, ...b.avisos].join(" | "))
}

// ── 7. Lista vazia não explode ──────────────────────────────────────────────
{
  const vazio = mesclarMods([])
  ok(
    "sem mod nenhum, os indices saem vazios",
    Object.keys(vazio.clubes).length === 0 && Object.keys(vazio.atletas).length === 0 && Object.keys(vazio.escudos).length === 0,
  )
}

console.log("")
if (falhas) {
  console.error(`RESULTADO: ${falhas} FALHA(S)`)
  process.exit(1)
}
console.log("RESULTADO: TUDO OK")
