// MODO LOJA — Steam, Epic, GOG e afins.
//
// ⚠️ FONTE UNICA. Quem precisar saber "esta e uma build de loja?" pergunta
// AQUI.
//
// Isto importa mais do que parece: a checagem ja existia em `lib/updater.ts`
// (`BUILD_DE_LOJA`), escrita como `=== "1"` direto na constante. Bastava o
// build passar um valor diferente — "steam", por exemplo — para aquele arquivo
// achar que NAO estava em loja e voltar a consultar o latest.json pela rede,
// oferecendo "ha versao nova, instale pelo launcher" a quem comprou na Steam.
// Duas leituras paralelas da mesma variavel e como metade do caminho fica
// ligada; `updater.ts` agora le esta.
//
// ⚠️ ASSADO NO BUILD, NAO LIDO DE UM ARQUIVO.
//
// `NEXT_PUBLIC_*` e substituido literalmente pelo Next dentro do bundle: o
// build de loja carrega o valor no JavaScript, e o da venda direta carrega
// `undefined`. A alternativa obvia — um `loja.json` ao lado do executavel —
// seria um arquivo que qualquer pessoa cria para destravar os extras do build
// normal. Aqui nao ha o que copiar: sao dois binarios diferentes.
//
// O Rust recebe o MESMO valor por `option_env!("ULTRAFOOT_LOJA")` (ver
// `em_loja` em src-tauri/src/lib.rs), para os dois lados nunca discordarem.
//
// O QUE MUDA EM MODO LOJA
//   • nada vai a rede procurar versao nova, e o aviso de atualizacao some
//     (lib/updater.ts) — quem atualiza e a loja, pelos depots dela;
//   • o jogo ja nasce registrado (lib/registration.ts) e o item "Registrar"
//     some do menu sozinho;
//   • nada e escrito dentro da pasta de instalacao, que e da loja.
//
// O QUE NAO MUDA: o jogo, inteiro. Nao ha conteudo cortado.

/**
 * Valor cru da variavel de build.
 *
 * "1" e o valor historico (era o unico que existia) e continua valendo como
 * "sim, e loja, sem dizer qual". "0" e vazio valem como venda direta — para
 * `ULTRAFOOT_LOJA=0` no ambiente nao ligar o modo loja por acidente.
 */
const BRUTO: string = (process.env.NEXT_PUBLIC_ULTRAFOOT_LOJA ?? "").trim()

/** Este build foi publicado por uma loja? */
export const EM_LOJA: boolean = BRUTO !== "" && BRUTO !== "0"

/** Qual loja ("steam", "epic", "gog"…). `null` quando nao foi dito qual. */
export const LOJA: string | null = EM_LOJA && BRUTO !== "1" ? BRUTO : null

/** Nome apresentavel, para telas de "sobre" e para o diagnostico do suporte. */
export function nomeDaLoja(): string {
  switch (LOJA) {
    case "steam":
      return "Steam"
    case "epic":
      return "Epic Games Store"
    case "gog":
      return "GOG"
    case "microsoft":
      return "Microsoft Store"
    case "itch":
      return "itch.io"
    case null:
      return EM_LOJA ? "loja" : "Ultrafoot"
    default:
      return LOJA
  }
}
