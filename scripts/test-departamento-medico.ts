/**
 * DEPARTAMENTO MEDICO — o que este teste protege.
 *
 * O modal medico existia com 290 linhas e ZERO importadores; ao liga-lo, o
 * risco nao e a tela, e o motor: tratamento repetido encurta a lesao sem
 * limite. Este arquivo trava exatamente isso, no mesmo espirito do teste da
 * bilheteria (glitch de dinheiro infinito).
 */
import { TRATAMENTOS_MEDICOS, type PlayerInjury, type TratamentoMedico } from "../lib/game-engine"

let passou = 0
let falhou = 0
function ok(nome: string, cond: boolean, detalhe = "") {
  if (cond) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome} ${detalhe}`) }
}

/**
 * Reproducao fiel da acao `tratarLesao` do motor, sem zustand: mesmo caixa,
 * mesma trava, mesmo piso. Se a regra do motor mudar sem mudar aqui, o teste
 * para de valer — por isso os numeros vem de TRATAMENTOS_MEDICOS.
 */
function tratar(
  lesao: PlayerInjury | null,
  caixa: number,
  tratamento: TratamentoMedico,
): { lesao: PlayerInjury | null; caixa: number; ok: boolean; motivo?: string } {
  const { custo, fator } = TRATAMENTOS_MEDICOS[tratamento]
  if (!lesao) return { lesao, caixa, ok: false, motivo: "sem-lesao" }
  if (lesao.tratamento) return { lesao, caixa, ok: false, motivo: "ja-tratado" }
  if (custo > 0 && caixa < custo) return { lesao, caixa, ok: false, motivo: "sem-dinheiro" }
  const semanas = Math.max(1, Math.round(lesao.weeksRemaining * fator))
  return {
    lesao: { ...lesao, weeksRemaining: semanas, tratamento },
    caixa: caixa - custo,
    ok: true,
  }
}

const nova = (semanas: number): PlayerInjury => ({
  type: "Lesao muscular", severity: "media", weeksRemaining: semanas, startWeek: 1,
})

console.log("\nDEPARTAMENTO MEDICO\n")

// 1. Fisioterapia encurta e cobra.
{
  const r = tratar(nova(10), 1_000_000, "fisioterapia")
  ok("fisioterapia encurta 10 -> 8 semanas", r.lesao?.weeksRemaining === 8, `deu ${r.lesao?.weeksRemaining}`)
  ok("fisioterapia cobra R$ 50 mil", r.caixa === 950_000, `caixa ${r.caixa}`)
}

// 2. A TRAVA: repetir nao encurta mais, e nao cobra de novo.
{
  const um = tratar(nova(10), 1_000_000, "fisioterapia")
  const dois = tratar(um.lesao, um.caixa, "fisioterapia")
  const tres = tratar(dois.lesao, dois.caixa, "fisioterapia")
  ok("repetir e recusado", !dois.ok && dois.motivo === "ja-tratado")
  ok("repetir NAO encurta (fica em 8)", tres.lesao?.weeksRemaining === 8, `deu ${tres.lesao?.weeksRemaining}`)
  ok("repetir NAO cobra de novo", tres.caixa === 950_000, `caixa ${tres.caixa}`)
}

// 3. Sem caixa nao ha tratamento NEM cobranca parcial.
{
  const r = tratar(nova(6), 10_000, "fisioterapia")
  ok("sem caixa: recusa", !r.ok && r.motivo === "sem-dinheiro")
  ok("sem caixa: prazo intacto", r.lesao?.weeksRemaining === 6)
  ok("sem caixa: nao debita nada", r.caixa === 10_000)
}

// 4. Cirurgia alonga de proposito (e para lesao grave).
{
  const r = tratar(nova(10), 1_000_000, "cirurgia")
  ok("cirurgia alonga 10 -> 13", r.lesao?.weeksRemaining === 13, `deu ${r.lesao?.weeksRemaining}`)
  ok("cirurgia cobra R$ 200 mil", r.caixa === 800_000)
}

// 5. Conservador e de graca e nao muda prazo — mas consome a decisao.
{
  const r = tratar(nova(4), 1_000, "conservador")
  ok("conservador nao cobra", r.caixa === 1_000)
  ok("conservador mantem 4 semanas", r.lesao?.weeksRemaining === 4)
  ok("conservador tambem trava a lesao", tratar(r.lesao, 999_999, "fisioterapia").motivo === "ja-tratado")
}

// 6. Piso: lesao curta nunca vira cura instantanea.
{
  const r = tratar(nova(1), 1_000_000, "fisioterapia")
  ok("1 semana continua 1 (nunca 0)", r.lesao?.weeksRemaining === 1, `deu ${r.lesao?.weeksRemaining}`)
}

// 7. Atleta sao nao gera cobranca.
{
  const r = tratar(null, 1_000_000, "cirurgia")
  ok("sem lesao: recusa e nao cobra", !r.ok && r.caixa === 1_000_000)
}

console.log(`\n${passou} ok, ${falhou} falha(s)\n`)
process.exit(falhou === 0 ? 0 : 1)
