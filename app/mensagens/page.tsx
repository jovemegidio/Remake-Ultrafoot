"use client"

import { useState } from "react"
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
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getTeamByShort, serieATeams } from "@/lib/teams-data"
import { cn } from "@/lib/utils"

const userTeam = getTeamByShort("RBB") || serieATeams[0]

// Mock messages
const messages = [
  {
    id: 1,
    from: "Diretoria",
    subject: "Bem-vindo a nova temporada!",
    preview: "A diretoria do clube deseja a voce uma excelente temporada 2026. Contamos com seu trabalho...",
    date: "Hoje",
    read: false,
    starred: true,
    category: "diretoria",
    icon: Building2,
  },
  {
    id: 2,
    from: "Comissao Tecnica",
    subject: "Relatorio de pre-temporada",
    preview: "Segue o relatorio completo da pre-temporada. Os jogadores estao em otimas condicoes...",
    date: "Ontem",
    read: false,
    starred: false,
    category: "staff",
    icon: User,
  },
  {
    id: 3,
    from: "Departamento de Futebol",
    subject: "Proposta recebida - Jogador X",
    preview: "Recebemos uma proposta do exterior para um de nossos jogadores. Favor analisar...",
    date: "2 dias",
    read: true,
    starred: true,
    category: "mercado",
    icon: ShoppingCart,
  },
  {
    id: 4,
    from: "CBF",
    subject: "Calendario oficial Serie A 2026",
    preview: "Informamos que o calendario oficial da Serie A 2026 foi divulgado. Confira as datas...",
    date: "3 dias",
    read: true,
    starred: false,
    category: "competicao",
    icon: Trophy,
  },
  {
    id: 5,
    from: "Patrocinador Master",
    subject: "Renovacao de contrato",
    preview: "Gostaramos de discutir a renovacao do contrato de patrocinio para a proxima temporada...",
    date: "5 dias",
    read: true,
    starred: false,
    category: "diretoria",
    icon: Building2,
  },
]

export default function MensagensPage() {
  const [filter, setFilter] = useState("all")
  const [selectedMessage, setSelectedMessage] = useState(messages[0])
  const [searchQuery, setSearchQuery] = useState("")

  const unreadCount = messages.filter(m => !m.read).length
  const starredCount = messages.filter(m => m.starred).length

  const filteredMessages = messages.filter(m => {
    const matchesFilter = filter === "all" ? true :
      filter === "unread" ? !m.read :
      filter === "starred" ? m.starred :
      m.category === filter
    
    const matchesSearch = searchQuery === "" || 
      m.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.from.toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesFilter && matchesSearch
  })

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
            </div>

            {/* Filters */}
            <Tabs value={filter} onValueChange={setFilter} className="w-full">
              <TabsList className="bg-[#1a1a1a] border border-white/10 p-1 h-auto grid grid-cols-4">
                <TabsTrigger value="all" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-2 py-1.5">Todas</TabsTrigger>
                <TabsTrigger value="unread" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-2 py-1.5">
                  Nao lidas
                  {unreadCount > 0 && (
                    <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#1db954] text-[8px] text-black font-bold">
                      {unreadCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="starred" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-2 py-1.5">Favoritas</TabsTrigger>
                <TabsTrigger value="diretoria" className="text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 px-2 py-1.5">Diretoria</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Messages List */}
            <div className="space-y-2 max-h-[calc(100vh-340px)] overflow-y-auto">
              {filteredMessages.map((message) => (
                <button
                  key={message.id}
                  onClick={() => setSelectedMessage(message)}
                  className={cn(
                    "w-full rounded-xl border p-4 text-left transition-all",
                    selectedMessage.id === message.id 
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
              ))}
            </div>
          </section>

          {/* Message Detail */}
          <section className="lg:col-span-2">
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
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white/50 hover:text-yellow-400 hover:bg-white/5">
                    <Star className={cn("h-4 w-4", selectedMessage.starred && "text-yellow-400 fill-yellow-400")} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white/50 hover:text-white hover:bg-white/5">
                    <Archive className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white/50 hover:text-red-400 hover:bg-white/5">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Message Body */}
              <div className="p-6">
                <div className="space-y-4">
                  <p className="text-white/80 leading-relaxed">
                    {selectedMessage.preview}
                  </p>
                  <p className="text-white/80 leading-relaxed">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor 
                    incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud 
                    exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                  </p>
                  <p className="text-white/80 leading-relaxed">
                    Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu 
                    fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in 
                    culpa qui officia deserunt mollit anim id est laborum.
                  </p>
                </div>

                {/* Actions */}
                <div className="mt-8 pt-6 border-t border-white/5 flex items-center gap-3">
                  <Button className="text-xs bg-[#1db954] text-black hover:bg-[#1ed760]">
                    <Reply className="mr-2 h-4 w-4" />
                    Responder
                  </Button>
                  <Button variant="outline" className="text-xs border-white/10 bg-transparent text-white/70 hover:bg-white/5 hover:text-white">
                    <Archive className="mr-2 h-4 w-4" />
                    Arquivar
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <MusicPlayer />
    </div>
  )
}
