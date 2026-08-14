"use client"

import { useEffect, useMemo, useState } from "react"
import { BookOpen, Bookmark, Search, Star, X } from "lucide-react"
import { hardNavigate } from "@/lib/hard-navigation"
import { useGameState } from "@/lib/save-system"

interface EntradaNavegacao26 { id: string; titulo: string; categoria: string; href: string; termos: string }
interface GuiaFMPedia26 { id: string; titulo: string; categoria: string; texto: string; termos: string }

export const NAVEGACAO_FM26: EntradaNavegacao26[] = [
  ["portal", "Portal e escritório", "Clube", "/", "home inicio mensagens tarefas próximos jogos"],
  ["elenco", "Elenco", "Elenco", "/elenco", "jogadores plantel moral hierarquia"],
  ["taticas", "Táticas", "Elenco", "/taticas", "formação com posse sem posse pressão transição"],
  ["treino", "Treinamento", "Elenco", "/treinamento", "carga foco desenvolvimento mentoria"],
  ["base", "Categorias de base", "Elenco", "/base", "juniores promessas academia"],
  ["mercado", "Buscar atletas", "Recrutamento", "/mercado", "transferências observação jogador"],
  ["transferroom", "TransferRoom", "Recrutamento", "/transferroom", "requirements necessidades oportunidades pitch venda empréstimo"],
  ["olheiros", "Olheiros", "Recrutamento", "/olheiros", "scouting região relatório"],
  ["contratos", "Contratos", "Recrutamento", "/contratos", "salário renovação vencimento"],
  ["calendario", "Calendário", "Competição", "/calendario", "jogos datas rodada"],
  ["competicoes", "Competições e classificação", "Competição", "/competicoes", "liga copa tabela regulamento"],
  ["performance", "Performance Center", "Análise", "/performance", "dados xg posse fases risco médico"],
  ["adversarios", "Análise de adversários", "Análise", "/adversarios", "oponente relatório forma"],
  ["financas", "Finanças", "Clube", "/financas", "caixa receita despesa orçamento dívida"],
  ["infra", "Infraestrutura", "Clube", "/infraestrutura", "estádio centro treino gramado"],
  ["central", "Central do clube", "Clube", "/central", "vestiário reuniões disciplina contratos"],
  ["gestao", "Gestão avançada", "Treinador", "/gestao-avancada", "metas princípios mentoria diretoria bolas paradas"],
  ["treinador", "Área do treinador", "Treinador", "/treinador", "perfil reputação carreira histórico propostas"],
  ["selecao", "Gestão de seleção", "Seleções", "/selecao", "convocação data fifa copa mundo"],
  ["mensagens", "Caixa de entrada", "Portal", "/mensagens", "notificações tarefas novas não lidas"],
  ["config", "Configurações", "Sistema", "/configuracoes", "idioma dificuldade controle áudio desempenho"],
].map(([id, titulo, categoria, href, termos]) => ({ id, titulo, categoria, href, termos }))

export const GUIAS_FMPEDIA_26: GuiaFMPedia26[] = [
  { id: "ffp", titulo: "Fair Play Financeiro", categoria: "Finanças", termos: "ffp limite gasto orçamento", texto: "O clube precisa sustentar salários, transferências e custos operacionais com receitas recorrentes. Dívida excessiva reduz a capacidade de contratar e a confiança da diretoria." },
  { id: "posse", titulo: "Formações com e sem posse", categoria: "Táticas", termos: "in possession out formation com sem posse", texto: "A formação com posse define a ocupação quando sua equipe controla a bola; a formação sem posse define pressão e bloco defensivo. As transições ligam os dois comportamentos." },
  { id: "papel", titulo: "Papéis por fase", categoria: "Táticas", termos: "role papel jogador função", texto: "A adequação considera posição e atributos. No recrutamento, um mesmo atleta pode servir como construtor com a bola e marcador sem ela." },
  { id: "requirements", titulo: "TransferRoom: necessidades", categoria: "Recrutamento", termos: "requirement anúncio necessidade", texto: "Publique setor, papéis, idade, tempo esperado e modalidade. Clubes do universo respondem com atletas de seus elencos que combinam com o pedido." },
  { id: "pitch", titulo: "TransferRoom: oportunidades", categoria: "Recrutamento", termos: "pitch opportunity oferecer vender", texto: "As oportunidades refletem carências reais dos clubes da CPU. Ofereça um atleta compatível; orçamento, idade, setor e modalidade influenciam a resposta." },
  { id: "moral", titulo: "Moral e dinâmica", categoria: "Elenco", termos: "moral coesão hierarquia", texto: "Resultados, conversas, metas, disciplina, minutos e personalidade do treinador alteram o ambiente. Moral e coesão influenciam rendimento e desenvolvimento." },
  { id: "base", titulo: "Desenvolvimento de jovens", categoria: "Base", termos: "junior promessa potencial mentoria", texto: "Infraestrutura, unidade de treino, minutos e mentoria determinam quanto um jovem se aproxima do potencial ao longo das temporadas." },
  { id: "dificuldade", titulo: "Níveis de dificuldade", categoria: "Sistema", termos: "dificuldade justo normal desafio", texto: "Justo remove o bônus artificial da CPU. Os demais níveis graduam vantagem e peso do contexto sem alterar os atributos salvos dos jogadores." },
]

const FAVORITOS_PADRAO = ["portal", "elenco", "mercado", "calendario", "competicoes", "performance"]

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR")
}

export function FM26CommandCenter() {
  const { state, setState } = useGameState()
  const [buscaAberta, setBuscaAberta] = useState(false)
  const [favoritosAbertos, setFavoritosAbertos] = useState(false)
  const [consulta, setConsulta] = useState("")
  const [guiaAberto, setGuiaAberto] = useState<GuiaFMPedia26 | null>(null)
  const favoritos = state.bookmarks26?.length ? state.bookmarks26 : FAVORITOS_PADRAO

  useEffect(() => {
    const teclado = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") { event.preventDefault(); setBuscaAberta(true) }
      if (event.key === "Escape") { setBuscaAberta(false); setFavoritosAbertos(false); setGuiaAberto(null) }
    }
    window.addEventListener("keydown", teclado)
    return () => window.removeEventListener("keydown", teclado)
  }, [])

  const resultados = useMemo(() => {
    const q = normalizar(consulta.trim())
    if (!q) return { paginas: NAVEGACAO_FM26.slice(0, 8), guias: GUIAS_FMPEDIA_26.slice(0, 4) }
    const contem = (texto: string) => normalizar(texto).includes(q)
    return {
      paginas: NAVEGACAO_FM26.filter(item => contem(`${item.titulo} ${item.categoria} ${item.termos}`)).slice(0, 10),
      guias: GUIAS_FMPEDIA_26.filter(item => contem(`${item.titulo} ${item.categoria} ${item.termos} ${item.texto}`)).slice(0, 8),
    }
  }, [consulta])

  const alternarFavorito = (id: string) => {
    const proximo = favoritos.includes(id) ? favoritos.filter(item => item !== id) : [...favoritos, id].slice(-8)
    setState({ bookmarks26: proximo.length ? proximo : ["portal"] })
  }
  const abrir = (href: string) => { setBuscaAberta(false); setFavoritosAbertos(false); hardNavigate(href) }

  return <>
    <button onClick={() => setBuscaAberta(true)} title="Busca universal (Ctrl+K)" aria-label="Busca universal" className="flex h-8 w-8 items-center justify-center rounded-md text-white/45 hover:bg-white/5 hover:text-white"><Search className="h-4 w-4" /></button>
    <button onClick={() => setFavoritosAbertos(true)} title="Favoritos" aria-label="Favoritos" className="flex h-8 w-8 items-center justify-center rounded-md text-white/45 hover:bg-white/5 hover:text-white"><Bookmark className="h-4 w-4" /></button>

    {(buscaAberta || favoritosAbertos || guiaAberto) && <div className="fixed inset-0 z-[100] grid place-items-start bg-black/75 px-4 pt-[8vh] backdrop-blur-sm" onClick={() => { setBuscaAberta(false); setFavoritosAbertos(false); setGuiaAberto(null) }}>
      <section className="mx-auto max-h-[82vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#090d14] shadow-2xl" onClick={event => event.stopPropagation()}>
        <header className="flex items-center gap-3 border-b border-white/10 p-4"><Search className="h-5 w-5 text-cyan-300" />{buscaAberta && <input autoFocus value={consulta} onChange={event => setConsulta(event.target.value)} placeholder="Pesquisar páginas, recursos e guias..." className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/30" />}{favoritosAbertos && <h2 className="flex-1 font-black">Favoritos</h2>}{guiaAberto && <h2 className="flex-1 font-black">FMPedia</h2>}<button onClick={() => { setBuscaAberta(false); setFavoritosAbertos(false); setGuiaAberto(null) }}><X className="h-5 w-5 text-white/45" /></button></header>
        <div className="max-h-[68vh] overflow-y-auto p-4">
          {guiaAberto ? <div className="rounded-xl bg-cyan-400/[.06] p-5"><p className="text-xs font-black uppercase tracking-wider text-cyan-300">{guiaAberto.categoria}</p><h3 className="mt-2 text-xl font-black">{guiaAberto.titulo}</h3><p className="mt-4 leading-7 text-white/65">{guiaAberto.texto}</p></div> : favoritosAbertos ? <div className="grid gap-2 sm:grid-cols-2">{favoritos.map(id => NAVEGACAO_FM26.find(item => item.id === id)).filter(Boolean).map(item => <button key={item!.id} onClick={() => abrir(item!.href)} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[.035] p-4 text-left hover:border-cyan-400/30"><div><b>{item!.titulo}</b><p className="text-xs text-white/40">{item!.categoria}</p></div><Star className="h-4 w-4 fill-amber-300 text-amber-300" /></button>)}</div> : <div className="space-y-5">
            <ResultadoSecao titulo="Navegação">{resultados.paginas.map(item => <div key={item.id} className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[.025] p-2"><button onClick={() => abrir(item.href)} className="min-w-0 flex-1 p-2 text-left"><b>{item.titulo}</b><p className="text-xs text-white/40">{item.categoria}</p></button><button onClick={() => alternarFavorito(item.id)} aria-label="Alternar favorito" className="p-2"><Star className={`h-4 w-4 ${favoritos.includes(item.id) ? "fill-amber-300 text-amber-300" : "text-white/25"}`} /></button></div>)}</ResultadoSecao>
            <ResultadoSecao titulo="FMPedia">{resultados.guias.map(item => <button key={item.id} onClick={() => { setBuscaAberta(false); setGuiaAberto(item) }} className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/[.025] p-4 text-left hover:border-cyan-400/30"><BookOpen className="h-5 w-5 text-cyan-300" /><div><b>{item.titulo}</b><p className="text-xs text-white/40">Guia · {item.categoria}</p></div></button>)}</ResultadoSecao>
            {!resultados.paginas.length && !resultados.guias.length && <p className="py-12 text-center text-sm text-white/35">Nenhum resultado encontrado.</p>}
          </div>}
        </div>
      </section>
    </div>}
  </>
}

function ResultadoSecao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <section><h3 className="mb-2 text-[10px] font-black uppercase tracking-[.2em] text-white/35">{titulo}</h3><div className="grid gap-2 sm:grid-cols-2">{children}</div></section>
}
