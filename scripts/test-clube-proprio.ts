/**
 * CLUBE PRÓPRIO — o que este teste protege.
 *
 * Criar um clube toca a parte mais frágil do jogo: a identidade de clube. Os
 * riscos são todos de sobreposição silenciosa — nada quebra, o jogo só passa a
 * mostrar o clube errado:
 *
 *   1. CÓDIGO CURTO REPETIDO. `curto` é chave de tabela, de resultado e de
 *      escudo. Dois clubes com o mesmo código se sobrepõem na classificação sem
 *      erro nenhum. São ~134 códigos para 3.000 clubes no pool, então a colisão
 *      não é hipótese remota.
 *   2. O CLUBE NÃO ENTRAR NA DIVISÃO. `teams-data` monta as listas na carga do
 *      módulo e o clube próprio vive no store, lido depois. Se a ponte falhar, o
 *      clube aparece na tela de criação e some da nova carreira.
 *   3. PRESTÍGIO ESCOLHIDO PELO JOGADOR. Força move orçamento, mercado e a
 *      força dos rivais. Ele tem de sair da DIVISÃO, nunca do formulário.
 *   4. `file_key` COLIDIR entre dois clubes do próprio jogador.
 */
import {
  chaveDoClubeProprio, ehClubeProprio, prestigioDeClubeNovo,
  validarClubeProprio, PREFIXO_CLUBE_PROPRIO, DIVISOES_PARA_CLUBE_PROPRIO,
} from "../lib/clubes-personalizados"
import { allPoolTeams, allTeams, getTeamsByDivision, getTeamByShort, setClubesPersonalizados, type Team } from "../lib/teams-data"

let passou = 0
let falhou = 0
function ok(nome: string, cond: boolean, detalhe = "") {
  if (cond) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome} ${detalhe}`) }
}

console.log("\nCLUBE PRÓPRIO\n")

// 1. Validação: nome, código e capacidade.
{
  const base = { nome: "Cariacica FC", curto: "CRC", estado: "ES", estadioCap: 8000 }
  ok("clube válido passa", validarClubeProprio(base, []).length === 0,
    JSON.stringify(validarClubeProprio(base, [])))
  ok("nome curto demais é barrado",
    validarClubeProprio({ ...base, nome: "AB" }, []).length > 0)
  ok("nome longo demais é barrado",
    validarClubeProprio({ ...base, nome: "A".repeat(29) }, []).length > 0)
  ok("código com espaço é barrado",
    validarClubeProprio({ ...base, curto: "C R" }, []).length > 0)
  ok("código de 1 letra é barrado",
    validarClubeProprio({ ...base, curto: "C" }, []).length > 0)
  ok("sem estado é barrado",
    validarClubeProprio({ ...base, estado: "" }, []).length > 0)
  ok("estádio pequeno demais é barrado",
    validarClubeProprio({ ...base, estadioCap: 100 }, []).length > 0)
  ok("estádio grande demais é barrado",
    validarClubeProprio({ ...base, estadioCap: 200000 }, []).length > 0)
}

// 2. O código curto NÃO pode colidir com nenhum clube que já existe — o defeito
//    mais caro, porque não gera erro.
{
  const base = { nome: "Cariacica FC", curto: "CRC", estado: "ES", estadioCap: 8000 }
  const emUso = ["CRC"]
  const p = validarClubeProprio(base, emUso)
  ok("código já usado é barrado", p.length > 0, JSON.stringify(p))
  ok("a mensagem diz QUAL código colidiu", p.some(m => m.includes("CRC")))
  ok("a comparação ignora caixa",
    validarClubeProprio({ ...base, curto: "crc".toUpperCase() }, ["crc"]).length > 0)

  // E contra o catálogo real, que é onde a colisão de verdade mora.
  const umCuradoQualquer = allTeams[0].curto
  ok(`código de clube real (${umCuradoQualquer}) é barrado`,
    validarClubeProprio({ ...base, curto: umCuradoQualquer }, allTeams.map(t => t.curto)).length > 0)
}

// 3. `file_key` único e reconhecível.
{
  const a = chaveDoClubeProprio("Cariacica FC", [])
  const b = chaveDoClubeProprio("Cariacica FC", [a])
  const c = chaveDoClubeProprio("Cariacica FC", [a, b])
  ok("a chave nasce com o prefixo", a.startsWith(PREFIXO_CLUBE_PROPRIO), a)
  ok("acento e pontuação somem da chave", a === "meuclube_cariacicafc", a)
  ok("o mesmo nome duas vezes gera chaves diferentes", a !== b && b !== c, `${a} ${b} ${c}`)
  ok("clube próprio é reconhecível pela chave", ehClubeProprio(a))
  ok("clube real não é confundido com próprio", !ehClubeProprio("flarj"))
  ok("nome só de símbolos ainda gera chave válida",
    chaveDoClubeProprio("!!!", []).startsWith(PREFIXO_CLUBE_PROPRIO))
}

// 4. A força sai da DIVISÃO, e é sempre o piso dela.
{
  for (const d of DIVISOES_PARA_CLUBE_PROPRIO) {
    const forca = prestigioDeClubeNovo(d.id)
    const naDivisao = getTeamsByDivision(d.id)
    const menor = Math.min(...naDivisao.map(t => t.prestigio ?? 0))
    ok(`${d.id}: o clube novo nasce no piso ou abaixo (${forca} <= ${menor + 2})`,
      forca <= menor + 2)
  }
  ok("divisão desconhecida não devolve força alta", prestigioDeClubeNovo("nao_existe") <= 12)
  ok("acesso é mais fraco que a Série A",
    prestigioDeClubeNovo("divisao_acesso_br") < prestigioDeClubeNovo("serie_a"))
}

// 5. Publicado o clube, ele entra na divisão e é achável pelo código.
{
  const meu: Team = {
    nome: "Cariacica FC", curto: "CRCX", cidade: "Cariacica", estado: "ES",
    cor1: "#00d4ff", cor2: "#0b1220", prestigio: 8, torcida: 9600,
    estadio_cap: 8000, saldo: 250000, file_key: "meuclube_cariacicafc",
    estadio_nome: "Estádio Municipal", patrocinador: "", escudo_url: "",
    divisao: "divisao_acesso_br" as Team["divisao"],
  }
  const antes = getTeamsByDivision("divisao_acesso_br").length
  setClubesPersonalizados([meu])
  const depois = getTeamsByDivision("divisao_acesso_br")

  ok("o clube entra na divisão escolhida", depois.length === antes + 1,
    `(${antes} -> ${depois.length})`)
  ok("...e é o clube certo", depois.some(t => t.file_key === "meuclube_cariacicafc"))
  ok("não vaza para outra divisão",
    !getTeamsByDivision("serie_a").some(t => t.file_key === "meuclube_cariacicafc"))
  ok("é achável pelo código curto", getTeamByShort("CRCX")?.file_key === "meuclube_cariacicafc")
  ok("o clube próprio vence a busca por código",
    getTeamByShort("CRCX")?.nome === "Cariacica FC")

  // Publicar lista vazia tem de desfazer tudo — senão o clube excluído
  // continuaria na tabela até reiniciar o jogo.
  setClubesPersonalizados([])
  ok("excluir o clube o tira da divisão",
    getTeamsByDivision("divisao_acesso_br").length === antes)
  ok("...e da busca por código", getTeamByShort("CRCX") === undefined)
}

// 6. Nenhum clube REAL pode ter o prefixo reservado — se algum tiver, a
//    sentinela deixa de distinguir os dois mundos.
{
  const invasores = [...allTeams, ...allPoolTeams].filter(t => ehClubeProprio(t.file_key))
  ok("nenhum clube real usa o prefixo reservado", invasores.length === 0,
    `(${invasores.slice(0, 3).map(t => t.file_key).join(", ")})`)
}

console.log(`\n${passou} ok, ${falhou} falha(s)\n`)
if (falhou > 0) process.exit(1)
