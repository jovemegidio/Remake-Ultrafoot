// PROPOSTAS PARA O TECNICO SEM CLUBE PRECISAM REFLETIR A REPUTACAO.
//
// Antes a tela /sem-clube sorteava vagas por hash, ignorando a carreira: um
// campeao que pedia demissao recebia as mesmas ofertas de 2a divisao que um
// tecnico fracassado. Agora a reputacao define o teto de prestigio dos clubes
// que sondam o tecnico.

import { coachStandingScore, prestigeCeilingForStanding, ofertasParaDesempregado, type CoachStanding } from "../lib/coach-market"
import { allTeams } from "../lib/teams-data"

let falhas = 0
function checar(nome: string, ok: boolean, detalhe = "") {
  console.log(`${ok ? "ok" : "FALHOU"}  ${nome}${detalhe ? ` — ${detalhe}` : ""}`)
  if (!ok) falhas++
}

const iniciante: CoachStanding = { reputation: 0, totalTitles: 0, reputationLevel: 0 }
const medio: CoachStanding = { reputation: 45, totalTitles: 1, reputationLevel: 1 }
const campeao: CoachStanding = { reputation: 92, totalTitles: 6, reputationLevel: 4 }

// ── 1. Score ordena os perfis ──────────────────────────────────────────────
{
  const si = coachStandingScore(iniciante)
  const sm = coachStandingScore(medio)
  const sc = coachStandingScore(campeao)
  console.log(`   scores: iniciante=${si} medio=${sm} campeao=${sc}`)
  checar("score cresce com a carreira", si < sm && sm < sc)
  checar("score fica em 0-100", [si, sm, sc].every(s => s >= 0 && s <= 100))
}

// ── 2. Teto de prestigio acompanha o score ─────────────────────────────────
{
  const ti = prestigeCeilingForStanding(coachStandingScore(iniciante))
  const tc = prestigeCeilingForStanding(coachStandingScore(campeao))
  console.log(`   teto de prestigio: iniciante=${ti} campeao=${tc}`)
  checar("iniciante tem teto modesto (<= 70)", ti <= 70, `${ti}`)
  checar("campeao alcanca clubes grandes (>= 85)", tc >= 85, `${tc}`)
}

// ── 3. As ofertas respeitam o teto ─────────────────────────────────────────
{
  const oIni = ofertasParaDesempregado(allTeams, iniciante, 5)
  const oCam = ofertasParaDesempregado(allTeams, campeao, 5)
  checar("iniciante recebe 3 propostas", oIni.length === 3, `${oIni.length}`)
  checar("campeao recebe 3 propostas", oCam.length === 3, `${oCam.length}`)

  const tetoIni = prestigeCeilingForStanding(coachStandingScore(iniciante))
  const tetoCam = prestigeCeilingForStanding(coachStandingScore(campeao))
  checar("nenhuma oferta ao iniciante acima do teto dele", oIni.every(t => t.prestigio <= tetoIni),
    oIni.map(t => `${t.nome}=${t.prestigio}`).join(", "))
  checar("nenhuma oferta ao campeao acima do teto dele", oCam.every(t => t.prestigio <= tetoCam),
    oCam.map(t => `${t.nome}=${t.prestigio}`).join(", "))

  // O CAMPEAO recebe um MIX: ao menos um clube forte E ao menos um modesto.
  const maxCam = Math.max(...oCam.map(t => t.prestigio))
  const minCam = Math.min(...oCam.map(t => t.prestigio))
  console.log(`   campeao: ${oCam.map(t => `${t.nome}=${t.prestigio}`).join(", ")}`)
  checar("campeao recebe ao menos um clube forte (>= 80)", maxCam >= 80, `max=${maxCam}`)
  checar("campeao recebe ao menos um clube modesto (<= 65)", minCam <= 65, `min=${minCam}`)
  checar("campeao tem faixa ampla (forte e pequeno juntos)", maxCam - minCam >= 20, `${minCam}..${maxCam}`)
}

// ── 4. Sempre devolve algo (nunca deixa o tecnico sem proposta) ────────────
{
  for (const rodada of [1, 2, 3, 10, 25, 40]) {
    const o = ofertasParaDesempregado(allTeams, medio, rodada)
    if (o.length < 1) { checar(`rodada ${rodada} tem proposta`, false); break }
  }
  checar("toda rodada gera ao menos uma proposta", true)
}

// ── 5. Determinismo por rodada; muda ao trocar de rodada ───────────────────
{
  const a = ofertasParaDesempregado(allTeams, campeao, 7).map(t => t.curto).join(",")
  const b = ofertasParaDesempregado(allTeams, campeao, 7).map(t => t.curto).join(",")
  const c = ofertasParaDesempregado(allTeams, campeao, 8).map(t => t.curto).join(",")
  checar("mesma rodada = mesmas propostas", a === b)
  checar("outra rodada = lote diferente (recusar e continuar)", a !== c, `${a} vs ${c}`)
}

console.log(falhas === 0 ? "\n== TODOS OS TESTES PASSARAM ==" : `\n== ${falhas} FALHA(S) ==`)
process.exit(falhas === 0 ? 0 : 1)
