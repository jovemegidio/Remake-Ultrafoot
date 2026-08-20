// CARREIRA ONLINE — um mundo, vários técnicos humanos, e clubes com mais de uma
// pessoa dentro.
//
// O que o modo promete (lib/modos-online.ts): "um mundo, vários técnicos
// humanos: o mercado e as vagas são compartilhados". Este arquivo é esse mundo,
// e ele mora no servidor porque é a única forma de as duas frases serem
// verdade: uma VAGA só é compartilhada se alguém disser "esse clube já é de
// outra pessoa", e um MERCADO só é compartilhado se o atleta que você comprou
// sumir da lista do vizinho no mesmo instante.
//
// ⚠️ POR QUE ELE PÔDE SER FEITO SEM PORTAR O MOTOR PARA CÁ. O relay não simula
// partida — e simular no cliente sempre deu no mesmo problema: duas máquinas
// jogando o mesmo confronto chegam a placares diferentes, e a tabela passa a
// depender de quem clicou primeiro. A saída é a SEMENTE: o servidor sorteia um
// número por confronto e manda junto com as duas forças; o motor do jogo aceita
// semente (`semearMotorDePartida`) e, com a mesma semente e as mesmas entradas,
// as duas máquinas produzem O MESMO jogo, lance por lance. O servidor continua
// dono da verdade — dele saem as forças, o adversário e a semente — sem precisar
// de uma cópia do motor que iria divergir na primeira calibração.
//
// ⚠️ O CLUBE É A ENTIDADE, NÃO O TÉCNICO. Foi a mudança que abriu a "Carreira
// cooperativa" e a "Diretoria online": um clube tem até QUATRO pessoas, uma por
// papel, e a tabela é do clube. Se cada pessoa fosse uma linha, duas pessoas no
// mesmo clube apareceriam como dois clubes com o mesmo nome — e o modo
// cooperativo seria só um apelido para jogar separado.
//
// ⚠️ CADA PAPEL FAZ UMA COISA QUE OS OUTROS NÃO FAZEM. Papel decorativo é pior
// do que papel nenhum: quem entra como diretor e descobre que só assiste fecha o
// jogo e não volta. Por isso:
//   · técnico    — joga a partida da rodada (só ele envia placar);
//   · diretor    — anuncia e compra no mercado, dentro do teto;
//   · presidente — abre a rodada e define o TETO de gastos do diretor;
//   · olheiro    — espia a força e os reforços do próximo adversário.
//
// ⚠️ O QUE AINDA É PALAVRA DO CLIENTE: a força do clube, informada ao fundar.
// Ela é travada entre 40 e 90 (nenhum clube do jogo sai dessa faixa), e o placar
// enviado é conferido contra o do adversário quando ele chega. Fechar a última
// porta exige a simulação aqui dentro — o mesmo passo anotado em rivals.mjs.

import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

/** Quantos CLUBES cabem no mundo (não quantas pessoas: um clube tem até 4). */
export const VAGAS = 20

/** Caixa inicial, em milhões — a mesma para todo mundo: o mundo é uma disputa. */
const CAIXA_INICIAL = 50

/** Limites do que o cliente informa. Nenhum clube do jogo sai desta faixa. */
const FORCA_MINIMA = 40
const FORCA_MAXIMA = 90

/** Teto do que o mercado pode somar à força de um clube. */
const BONUS_MAXIMO = 6

export const PAPEIS = ["tecnico", "diretor", "presidente", "olheiro"]

function agora() { return Date.now() }

export class CarreiraOnline {
  constructor(dataDir) {
    this.arquivo = path.join(dataDir, "carreira-online.json")
    this.clubes = new Map()      // fileKey -> { fileKey, nome, forcaBase, caixa, reforcos, tetoDeCompra, pontos, j, v, e, d, gp, gc }
    this.membros = new Map()     // managerId -> { id, nome, fileKey, papel }
    this.partidas = new Map()    // matchId -> { matchId, rodada, casa, fora, semente, forcaCasa, forcaFora, placar }
    this.mercado = new Map()     // anuncioId -> { anuncioId, clube, vendedor, atleta, preco, criadoEm }
    this.rodada = 0
    this.divergencias = []
    try {
      const salvo = JSON.parse(fs.readFileSync(this.arquivo, "utf8"))
      for (const c of salvo.clubes ?? []) this.clubes.set(c.fileKey, c)
      for (const m of salvo.membros ?? []) this.membros.set(m.id, m)
      for (const p of salvo.partidas ?? []) this.partidas.set(p.matchId, p)
      for (const a of salvo.mercado ?? []) this.mercado.set(a.anuncioId, a)
      this.rodada = salvo.rodada ?? 0
      this.divergencias = salvo.divergencias ?? []
    } catch { /* primeira execução */ }
  }

  persistir() {
    const temporario = `${this.arquivo}.tmp`
    fs.writeFileSync(temporario, JSON.stringify({
      clubes: [...this.clubes.values()],
      membros: [...this.membros.values()],
      // Só as partidas das três últimas rodadas: o arquivo é reescrito inteiro,
      // e o histórico completo de um mundo que roda meses não cabe nisso.
      partidas: [...this.partidas.values()].filter(p => p.rodada > this.rodada - 3),
      mercado: [...this.mercado.values()],
      rodada: this.rodada,
      divergencias: this.divergencias.slice(-200),
    }))
    fs.renameSync(temporario, this.arquivo)
  }

  /** Quem está em cada papel de um clube. */
  papeisDe(fileKey) {
    const mapa = {}
    for (const m of this.membros.values()) {
      if (m.fileKey === fileKey) mapa[m.papel] = { id: m.id, nome: m.nome }
    }
    return mapa
  }

  /**
   * ENTRAR NO MUNDO — e é aqui que "as vagas são compartilhadas" vira código.
   *
   * Dois clubes iguais não existem: quem chega depois ou pega outro clube, ou
   * entra NO MESMO clube num papel livre (é assim que a carreira cooperativa e a
   * diretoria online acontecem — não são outro mundo, são o mesmo).
   *
   * O primeiro de um clube entra como TÉCNICO: um clube sem técnico não teria
   * quem jogasse a rodada, e ficaria de fora da tabela sem explicação.
   */
  entrar({ id, nome, clube, forca, papel }) {
    if (!id) return { erro: "sem_manager" }
    const jaSou = this.membros.get(id)
    if (jaSou) return { membro: jaSou }

    const fileKey = String(clube?.fileKey || "").slice(0, 64)
    if (!fileKey) return { erro: "sem_clube" }
    const escolhido = PAPEIS.includes(papel) ? papel : "tecnico"

    const existente = this.clubes.get(fileKey)
    if (!existente) {
      if (escolhido !== "tecnico") return { erro: "clube_sem_tecnico" }
      if (this.clubes.size >= VAGAS) return { erro: "mundo_cheio" }
      this.clubes.set(fileKey, {
        fileKey,
        nome: String(clube?.nome || fileKey).slice(0, 48),
        forcaBase: Math.max(FORCA_MINIMA, Math.min(FORCA_MAXIMA, Math.trunc(Number(forca) || 60))),
        caixa: CAIXA_INICIAL,
        reforcos: [],
        // `null` = o diretor gasta o que o clube tiver. Só existe teto quando um
        // presidente entra e define um.
        tetoDeCompra: null,
        pontos: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0,
        fundadoEm: agora(),
      })
    } else {
      const ocupados = this.papeisDe(fileKey)
      if (ocupados[escolhido]) return { erro: "papel_ocupado" }
    }

    const membro = { id, nome: String(nome || "Tecnico").slice(0, 32), fileKey, papel: escolhido, entrouEm: agora() }
    this.membros.set(id, membro)
    return { membro, clube: this.clubes.get(fileKey) }
  }

  sair(id) {
    const membro = this.membros.get(id)
    if (!membro) return
    this.membros.delete(id)
    // Clube sem ninguém sai do mundo: deixá-lo na tabela seria um time fantasma
    // que ninguém joga e que trava a vaga do escudo para outra pessoa.
    const aindaTem = [...this.membros.values()].some(m => m.fileKey === membro.fileKey)
    if (!aindaTem) this.clubes.delete(membro.fileKey)
  }

  /** Força que vai a campo: a do clube mais o que o mercado somou, com teto. */
  forcaDe(clube) {
    const bonus = clube.reforcos.reduce((s, r) => s + Math.max(0, (r.overall - 70) / 4), 0)
    return Math.round(clube.forcaBase + Math.min(BONUS_MAXIMO, bonus))
  }

  /** As partidas de uma rodada que ainda não têm placar. */
  pendentes(rodada) {
    return [...this.partidas.values()].filter(p => p.rodada === rodada && !p.placar)
  }

  /**
   * ABRE A PRÓXIMA RODADA.
   *
   * Qualquer membro pode pedir — MENOS quando o clube dele tem presidente: aí é
   * ele quem abre, e essa é a mão do papel. O pedido só vale com a rodada
   * anterior encerrada, para ninguém pular um confronto que não quer jogar.
   *
   * O emparelhamento é o rodízio clássico (round-robin): a lista gira uma casa a
   * cada rodada e quem sobra folga. Sorteio puro repetiria confrontos e deixaria
   * pares que nunca se encontram.
   */
  avancarRodada(managerId) {
    const membro = this.membros.get(String(managerId || ""))
    if (!membro) return { erro: "fora_do_mundo" }
    const papeis = this.papeisDe(membro.fileKey)
    if (papeis.presidente && papeis.presidente.id !== membro.id) return { erro: "so_o_presidente_abre" }

    // Só entram no sorteio os clubes que têm quem jogue.
    const jogaveis = [...this.clubes.keys()].filter(k => this.papeisDe(k).tecnico)
    if (jogaveis.length < 2) return { erro: "poucos_tecnicos" }
    if (this.rodada > 0 && this.pendentes(this.rodada).length > 0) {
      return { erro: "rodada_em_andamento", faltam: this.pendentes(this.rodada).length }
    }

    this.rodada++
    const giro = (this.rodada - 1) % Math.max(1, jogaveis.length - 1)
    const rotacionados = [jogaveis[0], ...jogaveis.slice(1 + giro), ...jogaveis.slice(1, 1 + giro)]

    const criadas = []
    for (let i = 0; i + 1 < rotacionados.length; i += 2) {
      // A cada rodada a casa troca de lado: mandar sempre seria vantagem fixa.
      const par = this.rodada % 2 === 0 ? [rotacionados[i + 1], rotacionados[i]] : [rotacionados[i], rotacionados[i + 1]]
      const casa = this.clubes.get(par[0])
      const fora = this.clubes.get(par[1])
      const partida = {
        matchId: crypto.randomUUID(),
        rodada: this.rodada,
        casa: casa.fileKey,
        fora: fora.fileKey,
        // ⚠️ A SEMENTE É O CORAÇÃO DO MODO: é ela que faz as duas máquinas
        // jogarem a MESMA partida. Sorteada aqui, nunca no cliente.
        semente: crypto.randomInt(1, 2 ** 31 - 1),
        forcaCasa: this.forcaDe(casa),
        forcaFora: this.forcaDe(fora),
        placar: null,
        enviadoPor: null,
        criadaEm: agora(),
      }
      this.partidas.set(partida.matchId, partida)
      criadas.push(partida)
    }
    return { rodada: this.rodada, partidas: criadas }
  }

  /**
   * O placar de um confronto — e só o TÉCNICO do clube manda.
   *
   * Vale o primeiro envio; o segundo serve de CONFERÊNCIA. Com a mesma semente e
   * as mesmas forças, os dois lados chegam ao mesmo placar — divergir significa
   * cliente adulterado ou versão diferente do motor, e os dois casos ficam
   * registrados em vez de derrubar a tabela.
   */
  registrarResultado(matchId, managerId, golsCasa, golsFora) {
    const partida = this.partidas.get(matchId)
    if (!partida) return { erro: "partida_desconhecida" }
    const membro = this.membros.get(String(managerId || ""))
    if (!membro || (membro.fileKey !== partida.casa && membro.fileKey !== partida.fora)) {
      return { erro: "nao_e_sua_partida" }
    }
    if (membro.papel !== "tecnico") return { erro: "so_o_tecnico_joga" }

    const gc = Math.max(0, Math.min(20, Math.trunc(Number(golsCasa) || 0)))
    const gf = Math.max(0, Math.min(20, Math.trunc(Number(golsFora) || 0)))

    if (partida.placar) {
      if (partida.placar.casa !== gc || partida.placar.fora !== gf) {
        this.divergencias.push({ matchId, managerId, quando: agora(), recebido: [gc, gf], valendo: [partida.placar.casa, partida.placar.fora] })
        return { estado: "divergente", placar: partida.placar }
      }
      return { estado: "confirmada", placar: partida.placar }
    }

    partida.placar = { casa: gc, fora: gf }
    partida.enviadoPor = managerId
    const casa = this.clubes.get(partida.casa)
    const fora = this.clubes.get(partida.fora)
    if (casa && fora) {
      casa.j++; fora.j++
      casa.gp += gc; casa.gc += gf
      fora.gp += gf; fora.gc += gc
      if (gc > gf) { casa.pontos += 3; casa.v++; fora.d++ }
      else if (gc < gf) { fora.pontos += 3; fora.v++; casa.d++ }
      else { casa.pontos++; fora.pontos++; casa.e++; fora.e++ }
      // Bilheteria e cotas do mundo: um dinheirinho por rodada jogada, senão o
      // mercado trava depois da primeira janela e o modo vira só tabela.
      casa.caixa += 3
      fora.caixa += 2
    }
    return { estado: "registrada", placar: partida.placar }
  }

  /** Quem pode mexer no mercado: o diretor — ou o técnico, se não houver diretor. */
  quemNegocia(membro) {
    if (!membro) return false
    if (membro.papel === "diretor") return true
    const papeis = this.papeisDe(membro.fileKey)
    return membro.papel === "tecnico" && !papeis.diretor
  }

  /** Põe um atleta à venda. O mesmo atleta não pode estar em dois anúncios. */
  anunciar({ managerId, atleta, preco }) {
    const membro = this.membros.get(String(managerId || ""))
    if (!membro) return { erro: "fora_do_mundo" }
    if (!this.quemNegocia(membro)) return { erro: "so_a_diretoria_negocia" }
    const clube = this.clubes.get(membro.fileKey)
    const id = String(atleta?.id || "").slice(0, 64)
    if (!id) return { erro: "sem_atleta" }
    for (const a of this.mercado.values()) {
      if (a.clube === clube.fileKey && a.atleta.id === id) return { erro: "ja_anunciado" }
    }
    const anuncio = {
      anuncioId: crypto.randomUUID(),
      clube: clube.fileKey,
      vendedor: clube.nome,
      porQuem: membro.nome,
      atleta: {
        id,
        nome: String(atleta?.nome || "Atleta").slice(0, 48),
        posicao: String(atleta?.posicao || "MEI").slice(0, 6),
        overall: Math.max(40, Math.min(99, Math.trunc(Number(atleta?.overall) || 65))),
      },
      preco: Math.max(1, Math.min(500, Math.trunc(Number(preco) || 1))),
      criadoEm: agora(),
    }
    this.mercado.set(anuncio.anuncioId, anuncio)
    return { anuncio }
  }

  /**
   * COMPRA — e é aqui que "o mercado é compartilhado" vira código.
   *
   * O anúncio sai da lista no mesmo instante: quem chegar meio segundo depois
   * recebe `ja_vendido`, e não uma segunda cópia do mesmo atleta. Duas cópias
   * seriam pior do que não ter mercado, porque o jogador só descobriria a
   * duplicata quando a força não batesse com o elenco.
   *
   * O TETO do presidente é conferido aqui, e não na tela: teto que mora no
   * cliente é teto que some quando alguém abre o console.
   */
  comprar({ managerId, anuncioId }) {
    const membro = this.membros.get(String(managerId || ""))
    if (!membro) return { erro: "fora_do_mundo" }
    if (!this.quemNegocia(membro)) return { erro: "so_a_diretoria_negocia" }
    const clube = this.clubes.get(membro.fileKey)
    const anuncio = this.mercado.get(anuncioId)
    if (!anuncio) return { erro: "ja_vendido" }
    if (anuncio.clube === clube.fileKey) return { erro: "e_seu" }
    if (clube.caixa < anuncio.preco) return { erro: "sem_caixa" }
    if (clube.tetoDeCompra != null && anuncio.preco > clube.tetoDeCompra) return { erro: "acima_do_teto" }

    this.mercado.delete(anuncioId)
    clube.caixa -= anuncio.preco
    clube.reforcos.push({ ...anuncio.atleta, veioDe: anuncio.vendedor })
    const vendedor = this.clubes.get(anuncio.clube)
    if (vendedor) {
      vendedor.caixa += anuncio.preco
      // Quem vende perde o que o atleta somava, se ele tinha vindo do mercado.
      vendedor.reforcos = vendedor.reforcos.filter(r => r.id !== anuncio.atleta.id)
    }
    return { comprado: anuncio }
  }

  /** O teto de gastos do clube. Mão do presidente, e só dele. */
  definirTeto({ managerId, teto }) {
    const membro = this.membros.get(String(managerId || ""))
    if (!membro) return { erro: "fora_do_mundo" }
    if (membro.papel !== "presidente") return { erro: "so_o_presidente_define" }
    const clube = this.clubes.get(membro.fileKey)
    clube.tetoDeCompra = teto == null || teto === "" ? null : Math.max(0, Math.min(500, Math.trunc(Number(teto) || 0)))
    return { tetoDeCompra: clube.tetoDeCompra }
  }

  /**
   * ESPIAR O PRÓXIMO ADVERSÁRIO — mão do olheiro.
   *
   * Sem olheiro no clube, ninguém vê: é o que faz o papel valer uma pessoa. O
   * que ele entrega é informação que muda decisão de mercado (a força real do
   * próximo adversário e os reforços que ele comprou).
   */
  espiar(managerId) {
    const membro = this.membros.get(String(managerId || ""))
    if (!membro) return { erro: "fora_do_mundo" }
    const papeis = this.papeisDe(membro.fileKey)
    if (!papeis.olheiro) return { erro: "sem_olheiro" }
    const partida = [...this.partidas.values()].find(
      p => p.rodada === this.rodada && !p.placar && (p.casa === membro.fileKey || p.fora === membro.fileKey),
    )
    if (!partida) return { erro: "sem_partida_aberta" }
    const alvo = this.clubes.get(partida.casa === membro.fileKey ? partida.fora : partida.casa)
    if (!alvo) return { erro: "sem_partida_aberta" }
    return {
      relatorio: {
        clube: alvo.nome,
        forca: this.forcaDe(alvo),
        caixa: alvo.caixa,
        reforcos: alvo.reforcos.map(r => ({ nome: r.nome, posicao: r.posicao, overall: r.overall })),
        papeis: Object.keys(this.papeisDe(alvo.fileKey)),
      },
    }
  }

  /** Tudo o que a tela precisa numa chamada só. */
  estado(managerId) {
    const membro = this.membros.get(String(managerId || "")) ?? null
    const meuClube = membro ? this.clubes.get(membro.fileKey) ?? null : null

    const tabela = [...this.clubes.values()]
      .map(c => ({
        fileKey: c.fileKey, clube: c.nome, forca: this.forcaDe(c), caixa: c.caixa,
        reforcos: c.reforcos.length, papeis: this.papeisDe(c.fileKey),
        pontos: c.pontos, j: c.j, v: c.v, e: c.e, d: c.d, gp: c.gp, gc: c.gc, saldo: c.gp - c.gc,
      }))
      .sort((a, b) => b.pontos - a.pontos || b.saldo - a.saldo || b.gp - a.gp)
      .map((l, i) => ({ posicao: i + 1, ...l }))

    const nomeDoClube = k => this.clubes.get(k)?.nome ?? k
    const minhas = membro
      ? [...this.partidas.values()]
        .filter(p => p.casa === membro.fileKey || p.fora === membro.fileKey)
        .sort((a, b) => b.rodada - a.rodada)
        .slice(0, 6)
        .map(p => ({ ...p, nomeCasa: nomeDoClube(p.casa), nomeFora: nomeDoClube(p.fora) }))
      : []

    const papeis = membro ? this.papeisDe(membro.fileKey) : {}
    return {
      vagas: VAGAS,
      ocupadas: this.clubes.size,
      rodada: this.rodada,
      pendentes: this.pendentes(this.rodada).length,
      sou: membro,
      meuClube,
      papeisDoMeuClube: papeis,
      // As permissões saem daqui de propósito: a tela mostra o botão, mas quem
      // decide é o servidor — e as duas pontas nunca discordam sobre a regra.
      permissoes: membro ? {
        jogar: membro.papel === "tecnico",
        negociar: this.quemNegocia(membro),
        abrirRodada: !papeis.presidente || papeis.presidente.id === membro.id,
        definirTeto: membro.papel === "presidente",
        espiar: Boolean(papeis.olheiro),
      } : null,
      tabela,
      minhasPartidas: minhas,
      mercado: [...this.mercado.values()].sort((a, b) => b.criadoEm - a.criadoEm).slice(0, 40),
      clubesOcupados: [...this.clubes.keys()],
      papeisLivres: membro ? PAPEIS.filter(p => !papeis[p]) : PAPEIS,
    }
  }

  /** Os papéis livres de um clube — para a tela de entrada saber o que oferecer. */
  papeisLivresDe(fileKey) {
    if (!this.clubes.has(fileKey)) return ["tecnico"]
    const ocupados = this.papeisDe(fileKey)
    return PAPEIS.filter(p => !ocupados[p])
  }
}
