"use client"

import { useState, useMemo } from "react"
import {
  Mail,
  MailOpen,
  Star,
  Trash2,
  Archive,
  Clock,
  User,
  Building2,
  Trophy,
  ShoppingCart,
  ChevronRight,
  Reply,
  Search,
  Send,
  X,
  ArchiveRestore,
  Inbox,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useUserTeam } from "@/lib/save-system"
import { cn } from "@/lib/utils"

// Message type
interface Message {
  id: number
  from: string
  subject: string
  preview: string
  fullContent: string
  date: string
  read: boolean
  starred: boolean
  archived: boolean
  deleted: boolean
  category: string
  icon: React.ComponentType<{ className?: string }>
}

// Initial messages data
const initialMessages: Message[] = [
  {
    id: 1,
    from: "Diretoria",
    subject: "Bem-vindo a nova temporada!",
    preview: "A diretoria do clube deseja a voce uma excelente temporada 2026. Contamos com seu trabalho...",
    fullContent: "A diretoria do clube deseja a voce uma excelente temporada 2026. Contamos com seu trabalho para levar o time ao topo do futebol brasileiro.\n\nNossas metas para esta temporada sao ambiciosas: queremos conquistar o titulo do Brasileirao e chegar longe na Copa do Brasil. O orcamento foi ajustado para permitir contratacoes estrategicas.\n\nBoa sorte, tecnico!",
    date: "Hoje",
    read: false,
    starred: true,
    archived: false,
    deleted: false,
    category: "diretoria",
    icon: Building2,
  },
  {
    id: 2,
    from: "Comissao Tecnica",
    subject: "Relatorio de pre-temporada",
    preview: "Segue o relatorio completo da pre-temporada. Os jogadores estao em otimas condicoes...",
    fullContent: "Segue o relatorio completo da pre-temporada. Os jogadores estao em otimas condicoes fisicas e prontos para o inicio do campeonato.\n\nDestaques:\n- O departamento medico nao registrou lesoes graves\n- Os testes fisicos mostraram melhoria de 15% no condicionamento geral\n- Os treinos taticos foram bem absorvidos pelo grupo\n\nRecomendamos manter a intensidade dos treinos nas proximas semanas.",
    date: "Ontem",
    read: false,
    starred: false,
    archived: false,
    deleted: false,
    category: "staff",
    icon: User,
  },
  {
    id: 3,
    from: "Departamento de Futebol",
    subject: "Proposta recebida - Jogador X",
    preview: "Recebemos uma proposta do exterior para um de nossos jogadores. Favor analisar...",
    fullContent: "Recebemos uma proposta do exterior para um de nossos jogadores. Favor analisar os termos e nos dar um retorno.\n\nDetalhes da proposta:\n- Clube interessado: AC Milan (Italia)\n- Jogador: Lincoln\n- Valor oferecido: EUR 15.000.000\n- Condicoes: 70% a vista, 30% em bonificacoes\n\nAguardamos sua decisao para prosseguir com as negociacoes.",
    date: "2 dias",
    read: true,
    starred: true,
    archived: false,
    deleted: false,
    category: "mercado",
    icon: ShoppingCart,
  },
  {
    id: 4,
    from: "CBF",
    subject: "Calendario oficial Serie A 2026",
    preview: "Informamos que o calendario oficial da Serie A 2026 foi divulgado. Confira as datas...",
    fullContent: "Informamos que o calendario oficial da Serie A 2026 foi divulgado.\n\nDatas importantes:\n- Inicio: 15 de janeiro de 2026\n- Termino: 8 de dezembro de 2026\n- Pausa para Copa America: 10 de junho a 15 de julho\n\nO calendario completo esta disponivel no site oficial da CBF. Fique atento aos prazos de inscricao de jogadores.",
    date: "3 dias",
    read: true,
    starred: false,
    archived: false,
    deleted: false,
    category: "competicao",
    icon: Trophy,
  },
  {
    id: 5,
    from: "Patrocinador Master",
    subject: "Renovacao de contrato",
    preview: "Gostaramos de discutir a renovacao do contrato de patrocinio para a proxima temporada...",
    fullContent: "Gostaramos de discutir a renovacao do contrato de patrocinio para a proxima temporada.\n\nEstamos satisfeitos com os resultados da parceria e queremos ampliar nosso investimento no clube. Nossa proposta inclui:\n\n- Aumento de 25% no valor do patrocinio\n- Extensao do contrato por 3 anos\n- Bonus por metas de desempenho\n\nPor favor, agende uma reuniao com nosso departamento comercial.",
    date: "5 dias",
    read: true,
    starred: false,
    archived: false,
    deleted: false,
    category: "diretoria",
    icon: Building2,
  },
]

export default function MensagensPage() {
  const { team: userTeam } = useUserTeam()
  const [filter, setFilter] = useState("all")
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(messages[0])
  const [searchQuery, setSearchQuery] = useState("")
  const [replyModalOpen, setReplyModalOpen] = useState(false)
  const [replyText, setReplyText] = useState("")
  const [replySent, setReplySent] = useState(false)

  // Counts
  const unreadCount = useMemo(() => messages.filter(m => !m.read && !m.archived && !m.deleted).length, [messages])
  const starredCount = useMemo(() => messages.filter(m => m.starred && !m.archived && !m.deleted).length, [messages])
  const archivedCount = useMemo(() => messages.filter(m => m.archived && !m.deleted).length, [messages])

  // Filtered messages
  const filteredMessages = useMemo(() => {
    return messages.filter(m => {
      // Never show deleted messages
      if (m.deleted) return false
      
      // Filter by tab
      const matchesFilter = 
        filter === "all" ? !m.archived :
        filter === "unread" ? !m.read && !m.archived :
        filter === "starred" ? m.starred && !m.archived :
        filter === "archived" ? m.archived :
        filter === "diretoria" ? m.category === "diretoria" && !m.archived :
        !m.archived
      
      // Filter by search
      const matchesSearch = searchQuery === "" || 
        m.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.preview.toLowerCase().includes(searchQuery.toLowerCase())
      
      return matchesFilter && matchesSearch
    })
  }, [messages, filter, searchQuery])

  // Mark as read when selecting
  const handleSelectMessage = (message: Message) => {
    setSelectedMessage(message)
    if (!message.read) {
      setMessages(prev => prev.map(m => 
        m.id === message.id ? { ...m, read: true } : m
      ))
    }
  }

  // Toggle starred
  const handleToggleStar = (messageId: number) => {
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, starred: !m.starred } : m
    ))
    if (selectedMessage?.id === messageId) {
      setSelectedMessage(prev => prev ? { ...prev, starred: !prev.starred } : null)
    }
  }

  // Archive message
  const handleArchive = (messageId: number) => {
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, archived: true } : m
    ))
    // Select next message if current was archived
    if (selectedMessage?.id === messageId) {
      const remaining = filteredMessages.filter(m => m.id !== messageId)
      setSelectedMessage(remaining[0] || null)
    }
  }

  // Unarchive message
  const handleUnarchive = (messageId: number) => {
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, archived: false } : m
    ))
  }

  // Delete message
  const handleDelete = (messageId: number) => {
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, deleted: true } : m
    ))
    // Select next message if current was deleted
    if (selectedMessage?.id === messageId) {
      const remaining = filteredMessages.filter(m => m.id !== messageId)
      setSelectedMessage(remaining[0] || null)
    }
  }

  // Reply to message
  const handleReply = () => {
    setReplyModalOpen(true)
    setReplyText("")
    setReplySent(false)
  }

  const handleSendReply = () => {
    if (!replyText.trim()) return
    setReplySent(true)
    setTimeout(() => {
      setReplyModalOpen(false)
      setReplySent(false)
      setReplyText("")
    }, 1500)
  }

  return (
    <div className="min-h-screen pl-[72px] pb-24 bg-[#0a0a0a]">
      <GameSidebar />
      <GameHeader team={userTeam} />

      <main className="p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Message List */}
          <section className="lg:col-span-1 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-white tracking-tight">Mensagens</h1>
                <p className="text-sm text-white/50 mt-1">{unreadCount} nao lidas</p>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="text"
                placeholder="Buscar mensagens..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-[#1a1a1a] border border-white/10 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filters */}
            <Tabs value={filter} onValueChange={setFilter} className="w-full">
              <TabsList className="bg-[#1a1a1a] border border-white/10 p-1 h-auto grid grid-cols-4">
                <TabsTrigger value="all" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-2 py-1.5">
                  <Inbox className="h-3 w-3 mr-1" />
                  Todas
                </TabsTrigger>
                <TabsTrigger value="unread" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-2 py-1.5">
                  Nao lidas
                  {unreadCount > 0 && (
                    <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#1db954] text-[8px] text-black font-bold">
                      {unreadCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="starred" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-2 py-1.5">
                  <Star className="h-3 w-3 mr-1" />
                  Favoritas
                </TabsTrigger>
                <TabsTrigger value="archived" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-2 py-1.5">
                  <Archive className="h-3 w-3 mr-1" />
                  Arquivo
                  {archivedCount > 0 && (
                    <span className="ml-1 text-[10px] text-white/40">
                      {archivedCount}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Messages List */}
            <div className="space-y-2 max-h-[calc(100vh-340px)] overflow-y-auto">
              {filteredMessages.length === 0 ? (
                <div className="rounded-xl bg-[#141414] border border-white/5 p-8 text-center">
                  <Mail className="h-10 w-10 mx-auto text-white/20 mb-3" />
                  <p className="text-sm text-white/50">
                    {searchQuery ? "Nenhuma mensagem encontrada" : 
                     filter === "archived" ? "Nenhuma mensagem arquivada" :
                     filter === "starred" ? "Nenhuma mensagem favorita" :
                     "Caixa de entrada vazia"}
                  </p>
                </div>
              ) : (
                filteredMessages.map((message) => (
                  <button
                    key={message.id}
                    onClick={() => handleSelectMessage(message)}
                    className={cn(
                      "w-full rounded-xl border p-4 text-left transition-all",
                      selectedMessage?.id === message.id 
                        ? "border-[#1db954] bg-[#1db954]/5" 
                        : "border-white/5 bg-[#141414] hover:border-white/10",
                      !message.read && "bg-[#1db954]/5"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                        message.category === "diretoria" ? "bg-yellow-400/20 text-yellow-400" :
                        message.category === "staff" ? "bg-blue-400/20 text-blue-400" :
                        message.category === "mercado" ? "bg-[#1db954]/20 text-[#1db954]" :
                        "bg-purple-400/20 text-purple-400"
                      )}>
                        <message.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn(
                            "text-sm truncate",
                            !message.read ? "font-semibold text-white" : "text-white/80"
                          )}>
                            {message.from}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {message.starred && <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />}
                            {!message.read && <span className="h-2 w-2 rounded-full bg-[#1db954]" />}
                          </div>
                        </div>
                        <div className={cn(
                          "text-xs mt-0.5 truncate",
                          !message.read ? "text-white/80" : "text-white/50"
                        )}>
                          {message.subject}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-white/40 truncate pr-2">
                            {message.preview.slice(0, 40)}...
                          </span>
                          <span className="text-[10px] text-white/40 shrink-0">
                            {message.date}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          {/* Message Detail */}
          <section className="lg:col-span-2">
            {selectedMessage ? (
              <div className="rounded-xl bg-[#141414] border border-white/5 overflow-hidden h-full">
                {/* Message Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "h-12 w-12 rounded-lg flex items-center justify-center",
                      selectedMessage.category === "diretoria" ? "bg-yellow-400/20 text-yellow-400" :
                      selectedMessage.category === "staff" ? "bg-blue-400/20 text-blue-400" :
                      selectedMessage.category === "mercado" ? "bg-[#1db954]/20 text-[#1db954]" :
                      "bg-purple-400/20 text-purple-400"
                    )}>
                      <selectedMessage.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">{selectedMessage.subject}</h2>
                      <div className="flex items-center gap-2 text-sm text-white/50">
                        <span>De: {selectedMessage.from}</span>
                        <span className="text-white/20">|</span>
                        <Clock className="h-3 w-3" />
                        <span>{selectedMessage.date}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleToggleStar(selectedMessage.id)}
                      className="h-8 w-8 text-white/50 hover:text-yellow-400 hover:bg-white/5"
                    >
                      <Star className={cn("h-4 w-4", selectedMessage.starred && "text-yellow-400 fill-yellow-400")} />
                    </Button>
                    {selectedMessage.archived ? (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleUnarchive(selectedMessage.id)}
                        className="h-8 w-8 text-white/50 hover:text-[#1db954] hover:bg-white/5"
                        title="Desarquivar"
                      >
                        <ArchiveRestore className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleArchive(selectedMessage.id)}
                        className="h-8 w-8 text-white/50 hover:text-white hover:bg-white/5"
                        title="Arquivar"
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDelete(selectedMessage.id)}
                      className="h-8 w-8 text-white/50 hover:text-red-400 hover:bg-white/5"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Message Body */}
                <div className="p-6">
                  <div className="space-y-4 whitespace-pre-line">
                    <p className="text-white/80 leading-relaxed">
                      {selectedMessage.fullContent}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="mt-8 pt-6 border-t border-white/5 flex items-center gap-3">
                    <Button 
                      onClick={handleReply}
                      className="text-xs bg-[#1db954] text-black hover:bg-[#1ed760]"
                    >
                      <Reply className="mr-2 h-4 w-4" />
                      Responder
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => handleArchive(selectedMessage.id)}
                      className="text-xs border-white/10 bg-transparent text-white/70 hover:bg-white/5 hover:text-white"
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      Arquivar
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-[#141414] border border-white/5 p-12 text-center h-full flex flex-col items-center justify-center">
                <MailOpen className="h-16 w-16 text-white/20 mb-4" />
                <h3 className="font-semibold text-white">Nenhuma mensagem selecionada</h3>
                <p className="text-sm text-white/50 mt-2">
                  Selecione uma mensagem para visualizar
                </p>
              </div>
            )}
          </section>
        </div>
      </main>

      <MusicPlayer />

      {/* Reply Modal */}
      <Dialog open={replyModalOpen} onOpenChange={setReplyModalOpen}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">
              {replySent ? "Mensagem Enviada" : `Responder: ${selectedMessage?.from}`}
            </DialogTitle>
          </DialogHeader>
          
          {replySent ? (
            <div className="py-8 text-center">
              <div className="h-16 w-16 mx-auto rounded-full bg-[#1db954]/20 flex items-center justify-center mb-4">
                <Send className="h-8 w-8 text-[#1db954]" />
              </div>
              <p className="text-white/70">Sua resposta foi enviada com sucesso!</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                <div className="text-xs text-white/40 mb-1">Assunto</div>
                <div className="text-sm text-white">RE: {selectedMessage?.subject}</div>
              </div>
              
              <div>
                <label className="text-xs text-white/40 mb-2 block">Sua resposta</label>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Digite sua resposta..."
                  className="w-full h-32 p-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/20 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => setReplyModalOpen(false)}
                  className="border-white/10 text-white/70"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSendReply}
                  disabled={!replyText.trim()}
                  className="bg-[#1db954] text-black hover:bg-[#1ed760] disabled:opacity-50"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Enviar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
