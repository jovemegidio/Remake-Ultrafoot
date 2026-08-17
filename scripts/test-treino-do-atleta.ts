// O GATE DO TREINO DA CARREIRA DE ATLETA (1.0.339).
//
// ⚠️ POR QUE ELE EXISTE. Até a 1.0.338 o modo tinha um seletor de "foco de
// treino" cujo ÚNICO efeito acontecia uma vez por ano, na virada da temporada
// (`evoluirOrganicamente`). Entre uma rodada e outra o atleta não treinava:
// sem sessão, sem custo, sem progresso — e a comissão ainda cobrava "falta
// rotina de treino", uma rotina que o jogo não oferecia. Um seletor assim é
// enfeite, e enfeite é exatamente o defeito que este projeto repete.
//
// O que este gate cobra é que o treino seja um SISTEMA e não um rótulo:
//   1. intensidade diferente produz resultado diferente;
//   2. puxar tem PREÇO — a forma cai, e a forma entra na nota da partida;
//   3. puxar cansado custa o dobro (a escolha tem resposta errada);
//   4. `profissionalismo` decide o quanto a semana rende — é o que dá dentes à
//      frase que o jogo já dizia desde a 1.0.325;
//   5. o foco vira ponto de atributo de verdade, e nunca passa do potencial.
//
// Uso: npx tsx scripts/test-treino-do-atleta.ts

import {
  criarAtletaDaCarreira, criarCarreiraDeJogador, definirIntensidadeDeTreino,
  jogarProximaRodada, type EstadoCarreiraDeJogador,
} from "@/lib/carreira-de-jogador"
import { allTeams } from "@/lib/teams-data"

let falhas = 0
const erro = (m: string) => { console.log("FALHA: " + m); falhas++ }

const clube = allTeams.find(t => t.prestigio >= 80)!

function carreiraNova(profissionalismo?: number): EstadoCarreiraDeJogador {
  const atleta = criarAtletaDaCarreira({
    nome: "Treino Teste", posicao: "ATA", idade: 18, nacionalidade: "Brasil",
    pePreferido: "direito", alturaCm: 180, pesoKg: 74, numero: 19,
  })
  const c = criarCarreiraDeJogador(clube, atleta, "Liga Teste", 2026)
  if (profissionalismo !== undefined) c.atleta.personalidade.profissionalismo = profissionalismo
  return c
}

// ── 1. A semana de treino ACONTECE ──────────────────────────────────────────
const base = jogarProximaRodada(carreiraNova())
if (!base.treinoDaSemana) {
  erro("nenhuma semana de treino foi registrada apos jogar uma rodada")
} else if (base.treinoDaSemana.xp <= 0) {
  erro(`a semana de treino rendeu ${base.treinoDaSemana.xp} de xp`)
}

// ── 2. Intensidade muda o resultado, e puxar cobra forma ────────────────────
const leve = jogarProximaRodada(definirIntensidadeDeTreino(carreiraNova(), "leve"))
const puxada = jogarProximaRodada(definirIntensidadeDeTreino(carreiraNova(), "puxada"))
const xpLeve = leve.treinoDaSemana?.xp ?? 0
const xpPuxada = puxada.treinoDaSemana?.xp ?? 0
if (!(xpPuxada > xpLeve)) erro(`puxada (${xpPuxada}) deveria render mais que leve (${xpLeve})`)
const formaLeve = leve.treinoDaSemana?.deltaForma ?? 0
const formaPuxada = puxada.treinoDaSemana?.deltaForma ?? 0
if (!(formaPuxada < 0)) erro(`puxar deveria custar forma, veio ${formaPuxada}`)
if (!(formaLeve > 0)) erro(`semana leve deveria recuperar forma, veio ${formaLeve}`)
console.log(`intensidade: leve ${xpLeve}xp (${formaLeve} forma) | puxada ${xpPuxada}xp (${formaPuxada} forma)`)

// ── 3. Puxar CANSADO custa o dobro ──────────────────────────────────────────
const cansado = carreiraNova()
cansado.forma = 20
const puxadaCansado = jogarProximaRodada(definirIntensidadeDeTreino(cansado, "puxada"))
const custoCansado = puxadaCansado.treinoDaSemana?.deltaForma ?? 0
if (!(custoCansado < formaPuxada)) {
  erro(`puxar com forma 20 deveria custar mais que com forma normal (${custoCansado} x ${formaPuxada})`)
}
console.log(`puxar cansado custa ${custoCansado} de forma (contra ${formaPuxada} descansado)`)

// ── 4. O profissionalismo decide o rendimento ───────────────────────────────
const relaxado = jogarProximaRodada(definirIntensidadeDeTreino(carreiraNova(3), "normal"))
const dedicado = jogarProximaRodada(definirIntensidadeDeTreino(carreiraNova(19), "normal"))
const xpRelaxado = relaxado.treinoDaSemana?.xp ?? 0
const xpDedicado = dedicado.treinoDaSemana?.xp ?? 0
if (!(xpDedicado > xpRelaxado)) {
  erro(`dedicado (${xpDedicado}) deveria render mais que relaxado (${xpRelaxado}) na mesma semana`)
}
console.log(`profissionalismo: relaxado ${xpRelaxado}xp | dedicado ${xpDedicado}xp`)

// ── 5. O foco vira atributo, e respeita o teto ──────────────────────────────
let comFoco = carreiraNova(19)
comFoco.focoDeTreino = "finalizacao"
comFoco = definirIntensidadeDeTreino(comFoco, "puxada")
const antes = comFoco.atleta.atributos.finalizacao
for (let i = 0; i < 25 && !comFoco.temporadaEncerrada; i++) comFoco = jogarProximaRodada(comFoco)
const depois = comFoco.atleta.atributos.finalizacao
if (!(depois > antes)) erro(`25 semanas de foco em finalizacao nao renderam ponto nenhum (${antes} -> ${depois})`)
if (depois > comFoco.atleta.potencial) {
  erro(`o treino passou do potencial real: ${depois} > ${comFoco.atleta.potencial}`)
}
console.log(`foco em finalizacao: ${antes} -> ${depois} (teto real ${comFoco.atleta.potencial})`)

console.log(falhas === 0
  ? "\nTREINO OK — intensidade, preco, personalidade e foco tem efeito medivel."
  : `\n${falhas} problema(s) no treino do atleta.`)
process.exit(falhas === 0 ? 0 : 1)
