// A SELECAO ENTRA EM CAMPO COM UM TIME DE FUTEBOL?
//
// Relato do jogador (PDF Ultra26, p.18): "na selecao a escalacao esta saindo
// completamente errada, goleiro na linha, como se as selecoes nao estivessem
// licenciadas". Nao era licenciamento.
//
// A convocacao vem ordenada POR SETOR, com as cotas de NATIONAL_SQUAD_QUOTAS
// (3 GOL, 8 DEF, 7 MEI, 5 ATA). A tela da partida marcava titular por INDICE
// (`isStarter: indice < 11`), entao os onze primeiros eram TRES GOLEIROS E OITO
// DEFENSORES. Com o XI ja "declarado", enginePlayersToMatchSquad tomava o ramo
// da escalacao manual e pulava o pickStartingXI — que e justamente quem impede
// o segundo goleiro de jogar. O encaixe nao achava compativel para MEI/PD/PE/ATA
// e caia no "pega quem sobrou": os goleiros reservas iam para a linha.
//
// O gate qa-selecoes-elenco-real ja existia e passava: ele verifica que a
// selecao tem ATLETAS DE VERDADE, nunca a composicao do XI. Verde contra codigo
// errado. Este cobre o buraco.
//
//   npx tsx scripts/qa-selecao-escalada.ts
import assert from "node:assert/strict"
import { NATIONAL_TEAMS, getNationalSquad, nationalSector } from "../lib/national-teams"
import { pickStartingXI, normalizePosition } from "../lib/formations"

const FORMACOES = ["4-3-3", "4-4-2", "3-5-2", "5-3-2"]

let checadas = 0
const falhas: string[] = []

// Uma amostra grande cobre confederacoes e tamanhos de pool diferentes sem
// levar minutos: o defeito era estrutural, aparecia em TODA selecao.
for (const nt of NATIONAL_TEAMS.slice(0, 40)) {
  const convocados = getNationalSquad(nt, { cuts: [], calls: [] })
  if (convocados.length < 11) continue

  for (const formacao of FORMACOES) {
    const { starters } = pickStartingXI(
      convocados,
      j => j.pos,
      j => j.base,
      formacao,
    )
    checadas++

    if (starters.length !== 11) {
      falhas.push(`${nt.name} ${formacao}: ${starters.length} titulares`)
      continue
    }

    const goleiros = starters.filter(j => normalizePosition(j.pos) === "GOL").length
    if (goleiros !== 1) {
      falhas.push(`${nt.name} ${formacao}: ${goleiros} goleiros no XI`)
    }

    // Um time de futebol tem gente nos tres setores. Com o defeito antigo o XI
    // saia com ZERO meias e ZERO atacantes.
    const setores = new Set(starters.map(j => nationalSector(j.pos)))
    for (const setor of ["DEF", "MEI", "ATA"]) {
      if (!setores.has(setor as "DEF" | "MEI" | "ATA")) {
        falhas.push(`${nt.name} ${formacao}: nenhum ${setor} no XI`)
      }
    }
  }
}

if (falhas.length) {
  console.error("XI de selecao invalido:")
  for (const f of falhas.slice(0, 20)) console.error("  " + f)
  if (falhas.length > 20) console.error(`  ... e mais ${falhas.length - 20}`)
}

assert.equal(falhas.length, 0, `${falhas.length} escalacoes de selecao invalidas`)
assert.ok(checadas > 0, "nenhuma selecao foi checada — a amostra ficou vazia")

console.log(`ok: ${checadas} escalacoes de selecao com 1 goleiro e os tres setores em campo`)
