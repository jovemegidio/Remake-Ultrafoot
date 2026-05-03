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
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getTeamByShort, serieATeams } from "@/lib/teams-data"

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

  const unreadCount = messages.filter(m => !m.read).length
  const starredCount = messages.filter(m => m.starred).length

  const filteredMessages = messages.filter(m => {
    if (filter === "all") return true
    if (filter === "unread") return !m.read
    if (filter === "starred") return m.starred
    return m.category === filter
  })

  return (
<<<<<<< HEAD
    <div className="min-h-screen pl-16 pb-20">
=======
    <div className="min-h-screen pl-[72px] pb-24">
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
      <GameSidebar />

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-6">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-display tracking-widest text-primary">ULTRAFOOT</span>
          <span className="text-border">/</span>
          <span className="text-foreground">Mensagens</span>
        </div>
        <div className="flex items-center gap-2">
          <TeamCrest team={userTeam} size="sm" />
          <span className="text-sm font-medium">{userTeam.nome}</span>
        </div>
      </header>

      <main className="p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Message List */}
          <section className="lg:col-span-1 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-display-italic text-3xl tracking-tight">MENSAGENS</h1>
                <p className="text-sm text-muted-foreground">{unreadCount} nao lidas</p>
              </div>
            </div>

            {/* Filters */}
            <Tabs value={filter} onValueChange={setFilter} className="w-full">
              <TabsList className="bg-card border border-border grid grid-cols-4">
                <TabsTrigger value="all" className="text-[10px] font-display">TODAS</TabsTrigger>
                <TabsTrigger value="unread" className="text-[10px] font-display">
                  NAO LIDAS
                  {unreadCount > 0 && (
                    <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground">
                      {unreadCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="starred" className="text-[10px] font-display">FAVORITAS</TabsTrigger>
                <TabsTrigger value="diretoria" className="text-[10px] font-display">DIRETORIA</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Messages List */}
            <div className="space-y-2">
              {filteredMessages.map((message) => (
                <button
                  key={message.id}
                  onClick={() => setSelectedMessage(message)}
                  className={`w-full eafc-card p-4 text-left transition-all ${
                    selectedMessage.id === message.id ? "ring-2 ring-primary" : ""
                  } ${!message.read ? "bg-primary/5" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                      message.category === "diretoria" ? "bg-gold/20 text-gold" :
                      message.category === "staff" ? "bg-primary/20 text-primary" :
                      message.category === "mercado" ? "bg-accent/20 text-accent" :
                      "bg-purple-500/20 text-purple-400"
                    }`}>
                      <message.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm truncate ${!message.read ? "font-semibold" : ""}`}>
                          {message.from}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {message.starred && <Star className="h-3 w-3 text-gold fill-gold" />}
                          {!message.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                        </div>
                      </div>
                      <div className={`text-xs mt-0.5 truncate ${!message.read ? "text-foreground" : "text-muted-foreground"}`}>
                        {message.subject}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-muted-foreground truncate pr-2">
                          {message.preview.slice(0, 50)}...
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
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
            <div className="eafc-card overflow-hidden h-full">
              {/* Message Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50">
                <div className="flex items-center gap-4">
                  <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                    selectedMessage.category === "diretoria" ? "bg-gold/20 text-gold" :
                    selectedMessage.category === "staff" ? "bg-primary/20 text-primary" :
                    selectedMessage.category === "mercado" ? "bg-accent/20 text-accent" :
                    "bg-purple-500/20 text-purple-400"
                  }`}>
                    <selectedMessage.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg">{selectedMessage.subject}</h2>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>De: {selectedMessage.from}</span>
                      <span className="text-border">|</span>
                      <Clock className="h-3 w-3" />
                      <span>{selectedMessage.date}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Star className={`h-4 w-4 ${selectedMessage.starred ? "text-gold fill-gold" : ""}`} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Archive className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Message Body */}
              <div className="p-6">
                <div className="prose prose-invert max-w-none">
                  <p className="text-foreground/90 leading-relaxed">
                    {selectedMessage.preview}
                  </p>
                  <p className="text-foreground/90 leading-relaxed mt-4">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor 
                    incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud 
                    exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                  </p>
                  <p className="text-foreground/90 leading-relaxed mt-4">
                    Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu 
                    fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in 
                    culpa qui officia deserunt mollit anim id est laborum.
                  </p>
                </div>

                {/* Actions */}
                <div className="mt-8 pt-6 border-t border-border flex items-center gap-3">
                  <Button className="font-display text-xs tracking-wider">
                    RESPONDER
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                  <Button variant="outline" className="font-display text-xs tracking-wider border-border">
                    ARQUIVAR
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
