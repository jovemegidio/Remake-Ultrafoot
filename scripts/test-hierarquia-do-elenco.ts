/**
 * HIERARQUIA DO ELENCO — o que este teste protege.
 *
 * O capitao era escolhivel e nao fazia nada. Ao dar efeito a ele, os riscos sao:
 *
 *   1. BOLA DE NEVE — moral alta vira forca, forca vira vitoria, vitoria vira
 *      moral mais alta. Por isso o efeito e limitado e o teste checa o limite.
 *   2. SAVE ANTIGO — nada aqui pode exigir campo que carreira velha nao tem
 *      (`moralePoints` e opcional; capitao pode estar vazio).
 *   3. O PONDERADO VIRAR MEDIA — se influencia nao pesasse, o capitao infeliz
 *      valeria o mesmo que o quarto goleiro, e o sistema seria enfeite de novo.
 */
import { climaDoVestiario, LIMITE_LIDERANCA, moralEmPontos } from "../lib/hierarquia-do-elenco"
import type { Player } from "../lib/game-engine"

let passou = 0
let falhou = 0
function ok(nome: string, cond: boolean, detalhe = "") {
  if (cond) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome} ${detalhe}`) }
}

let proximoId = 1
function atleta(p: Partial<Player> = {}): Player {
  return {
    id: proximoId++, name: `Atleta ${proximoId}`, position: "MEI", age: 25,
    overall: 70, potential: 75, nationality: "BRA",
    pace: 70, shooting: 70, passing: 70, dribbling: 70, defending: 70, physical: 70,
    energy: 100, morale: "Normal", form: 70, contract: null, injury: null,
    isStarter: true,
    seasonStats: {} as Player["seasonStats"],
    ...p,
  } as Player
}

console.log("\nHIERARQUIA DO ELENCO\n")

// 1. Elenco vazio nao quebra nem inventa efeito.
{
  const c = climaDoVestiario([])
  ok("elenco vazio: clima neutro, efeito zero", c.clima === 55 && c.efeito === 0 && c.postos.length === 0)
}

// 2. Sem capitao definido, a bracadeira vai para o de maior influencia.
{
  const jovem = atleta({ name: "Jovem", age: 19, overall: 62 })
  const lider = atleta({ name: "Lider", age: 32, overall: 84 })
  const c = climaDoVestiario([jovem, lider])
  const cap = c.postos.find(p => p.papel === "capitao")
  ok("sem capitao definido, o mais influente assume", cap?.nome === "Lider", `foi ${cap?.nome}`)
  ok("existe vice-capitao", c.postos.some(p => p.papel === "vice_capitao"))
}

// 3. O capitao ESCOLHIDO manda, mesmo sendo menos influente.
{
  const jovem = atleta({ name: "Jovem", age: 19, overall: 62 })
  const lider = atleta({ name: "Lider", age: 32, overall: 84 })
  const c = climaDoVestiario([jovem, lider], "Jovem")
  ok("capitao escolhido e respeitado", c.postos.find(p => p.papel === "capitao")?.nome === "Jovem")
  const inflJovem = c.postos.find(p => p.nome === "Jovem")?.influencia ?? 0
  const semFaixa = climaDoVestiario([jovem, lider], "Lider").postos.find(p => p.nome === "Jovem")?.influencia ?? 0
  ok("a bracadeira AUMENTA a influencia", inflJovem > semFaixa, `${inflJovem} x ${semFaixa}`)
}

// 4. O PONDERADO: capitao infeliz pesa mais que reservas felizes.
{
  const capitao = atleta({ name: "Capitao", age: 33, overall: 86, morale: "Infeliz" })
  const reservas = Array.from({ length: 8 }, (_, i) =>
    atleta({ name: `Reserva ${i}`, age: 20, overall: 60, morale: "Feliz", isStarter: false }))
  const c = climaDoVestiario([capitao, ...reservas], "Capitao")
  ok("clima ponderado fica ABAIXO da media simples", c.clima < c.climaSimples,
    `ponderado ${c.clima} x simples ${c.climaSimples}`)
  ok("o capitao infeliz e nomeado", c.vozes.some(v => v.includes("Capitao") && v.includes("insatisfeito")))
  ok("efeito negativo", c.efeito < 0, `${c.efeito}`)
}

// 5. NAO CONTAR MORAL DUAS VEZES: elenco uniforme nao gera efeito de lideranca.
//    A forca do XI ja soma a media de moral; a hierarquia so acrescenta a
//    DIFERENCA entre quem manda e o grupo. Se todos estao iguais, nao ha nada
//    a acrescentar — e este e o teste que garante isso.
{
  const perfeitos = Array.from({ length: 20 }, () =>
    atleta({ age: 31, overall: 92, morale: "Feliz", moralePoints: 100 }))
  const c = climaDoVestiario(perfeitos)
  ok("elenco todo feliz: efeito ZERO (a media ja conta)", c.efeito === 0, `${c.efeito}`)
  ok("elenco todo feliz: clima = media simples", c.clima === c.climaSimples)

  const pessimos = Array.from({ length: 20 }, () =>
    atleta({ age: 31, overall: 92, morale: "Infeliz", moralePoints: 0 }))
  ok("elenco todo revoltado: efeito ZERO tambem", climaDoVestiario(pessimos).efeito === 0)
}

// 5b. NAO VIRAR BOLA DE NEVE: nem o pior desequilibrio passa do limite.
{
  const capitaoRevoltado = atleta({ name: "Cap", age: 34, overall: 95, moralePoints: 0 })
  const restoFeliz = Array.from({ length: 25 }, (_, i) =>
    atleta({ name: `F${i}`, age: 18, overall: 55, moralePoints: 100, isStarter: false }))
  const c = climaDoVestiario([capitaoRevoltado, ...restoFeliz], "Cap")
  ok("pior desequilibrio respeita o limite", c.efeito >= -LIMITE_LIDERANCA, `${c.efeito}`)

  const capitaoFeliz = atleta({ name: "Cap", age: 34, overall: 95, moralePoints: 100 })
  const restoTriste = Array.from({ length: 25 }, (_, i) =>
    atleta({ name: `T${i}`, age: 18, overall: 55, moralePoints: 0, isStarter: false }))
  const cima = climaDoVestiario([capitaoFeliz, ...restoTriste], "Cap")
  ok("melhor desequilibrio respeita o limite", cima.efeito <= LIMITE_LIDERANCA, `${cima.efeito}`)
}

// 6. SAVE ANTIGO: sem `moralePoints`, o rotulo resolve.
{
  const semPontos = atleta({ morale: "Feliz" })
  delete (semPontos as Partial<Player>).moralePoints
  ok("rotulo Feliz vira 80 sem moralePoints", moralEmPontos(semPontos) === 80)
  ok("rotulo antigo Revoltado tambem e entendido", moralEmPontos(atleta({ morale: "Revoltado" as Player["morale"] })) === 20)
  ok("moralePoints tem prioridade sobre o rotulo", moralEmPontos(atleta({ morale: "Feliz", moralePoints: 10 })) === 10)
}

// 7. Lesionado nao vota: quem esta fora nao manda no vestiario da semana.
{
  const sao = atleta({ name: "Sao", morale: "Feliz", age: 30, overall: 80 })
  const machucado = atleta({
    name: "Machucado", morale: "Infeliz", age: 34, overall: 90,
    injury: { type: "x", severity: "grave", weeksRemaining: 8, startWeek: 1 },
  })
  const c = climaDoVestiario([sao, machucado])
  ok("lesionado fica fora da hierarquia", !c.postos.some(p => p.nome === "Machucado"))
  ok("capitao e o atleta disponivel", c.postos.find(p => p.papel === "capitao")?.nome === "Sao")
}

// 8. Elenco INTEIRO lesionado nao zera a conta (cai para o elenco todo).
{
  const todos = Array.from({ length: 3 }, (_, i) => atleta({
    name: `L${i}`, morale: "Normal",
    injury: { type: "x", severity: "leve", weeksRemaining: 1, startWeek: 1 },
  }))
  const c = climaDoVestiario(todos)
  ok("elenco todo lesionado ainda produz hierarquia", c.postos.length === 3)
}

// 9. A diferenca entre grupo e lideranca e dita em palavras.
{
  const lideresFelizes = Array.from({ length: 2 }, (_, i) =>
    atleta({ name: `Lider ${i}`, age: 33, overall: 88, morale: "Feliz" }))
  const baseTriste = Array.from({ length: 10 }, (_, i) =>
    atleta({ name: `Base ${i}`, age: 19, overall: 58, morale: "Infeliz", isStarter: false }))
  const c = climaDoVestiario([...lideresFelizes, ...baseTriste])
  ok("clima ponderado ACIMA da media simples", c.clima > c.climaSimples, `${c.clima} x ${c.climaSimples}`)
  ok("a tela recebe a explicacao", c.vozes.some(v => v.includes("lideranças")))
}

console.log(`\n${passou} ok, ${falhou} falha(s)\n`)
process.exit(falhou === 0 ? 0 : 1)
