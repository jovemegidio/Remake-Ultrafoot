"use client"

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Trophy, Goal, Zap, TrendingUp, AlertTriangle, Bell, Star, Users, DollarSign, Clock, ChevronRight, Info } from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"

// Types
interface Notification {
  id: string
  type: "goal" | "match_start" | "match_end" | "transfer" | "injury" | "achievement" | "news" | "system"
  title: string
  message: string
  timestamp: Date
  read: boolean
  icon?: string
  teamLogo?: string
  priority?: "low" | "medium" | "high" | "urgent"
  action?: {
    label: string
    onClick: () => void
  }
}

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  addNotification: (notification: Omit<Notification, "id" | "timestamp" | "read">) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  removeNotification: (id: string) => void
  clearAll: () => void
}

const NotificationContext = createContext<NotificationContextType | null>(null)

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error("useNotifications must be used within NotificationsProvider")
  }
  return context
}

// Provider
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  
  const unreadCount = notifications.filter(n => !n.read).length

  const addNotification = useCallback((notification: Omit<Notification, "id" | "timestamp" | "read">) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      read: false
    }
    setNotifications(prev => [newNotification, ...prev].slice(0, 50)) // Keep max 50
  }, [])

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      removeNotification,
      clearAll
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

// Icon component based on notification type
function NotificationIcon({ type, priority }: { type: Notification["type"], priority?: Notification["priority"] }) {
  const iconClass = cn(
    "h-5 w-5",
    priority === "urgent" && "text-red-400",
    priority === "high" && "text-yellow-400"
  )
  
  switch (type) {
    case "goal":
      return <Goal className={cn(iconClass, "text-green-400")} />
    case "match_start":
      return <Clock className={cn(iconClass, "text-blue-400")} />
    case "match_end":
      return <Trophy className={cn(iconClass, "text-yellow-400")} />
    case "transfer":
      return <DollarSign className={cn(iconClass, "text-emerald-400")} />
    case "injury":
      return <AlertTriangle className={cn(iconClass, "text-red-400")} />
    case "achievement":
      return <Star className={cn(iconClass, "text-yellow-400")} />
    case "news":
      return <TrendingUp className={cn(iconClass, "text-purple-400")} />
    case "system":
      return <Info className={cn(iconClass, "text-white/60")} />
    default:
      return <Bell className={iconClass} />
  }
}

// Toast notifications
export function NotificationToast({ notification, onClose }: { notification: Notification, onClose: () => void }) {
  const priorityStyles = {
    urgent: "border-red-500/50 bg-red-950/80",
    high: "border-yellow-500/50 bg-yellow-950/50",
    medium: "border-white/10 bg-[#1a1a1a]",
    low: "border-white/5 bg-[#1a1a1a]"
  }
  
  useEffect(() => {
    const timeout = setTimeout(onClose, notification.priority === "urgent" ? 8000 : 5000)
    return () => clearTimeout(timeout)
  }, [notification.priority, onClose])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      className={cn(
        "flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl shadow-2xl max-w-sm",
        priorityStyles[notification.priority || "medium"]
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        <NotificationIcon type={notification.type} priority={notification.priority} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-white truncate">{notification.title}</h4>
        <p className="text-xs text-white/60 mt-0.5 line-clamp-2">{notification.message}</p>
        {notification.action && (
          <button 
            onClick={notification.action.onClick}
            className="text-xs text-[#1db954] hover:text-[#1ed760] mt-2 flex items-center gap-1"
          >
            {notification.action.label}
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>
      <button 
        onClick={onClose}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  )
}

// Toast Container - renders at top-right
export function NotificationToastContainer() {
  const [toasts, setToasts] = useState<Notification[]>([])
  const { notifications } = useNotifications()
  
  // Watch for new notifications
  useEffect(() => {
    if (notifications.length > 0) {
      const latest = notifications[0]
      if (latest && !toasts.find(t => t.id === latest.id)) {
        setToasts(prev => [latest, ...prev].slice(0, 3))
      }
    }
  }, [notifications, toasts])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => (
          <NotificationToast 
            key={toast.id} 
            notification={toast} 
            onClose={() => removeToast(toast.id)} 
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

// Notification Center Panel
export function NotificationCenter({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearAll } = useNotifications()

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (mins < 1) return "Agora"
    if (mins < 60) return `${mins}min atras`
    if (hours < 24) return `${hours}h atras`
    return `${days}d atras`
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />
          
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-[#121212] border-l border-white/10 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-white" />
                <h2 className="text-lg font-semibold text-white">Notificacoes</h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#1db954] text-black text-xs font-bold">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="text-xs text-[#1db954] hover:text-[#1ed760] px-2 py-1"
                  >
                    Marcar todas como lidas
                  </button>
                )}
                <button 
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-white/40">
                  <Bell className="h-12 w-12" />
                  <p className="text-sm">Nenhuma notificacao</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {notifications.map(notification => (
                    <motion.div
                      key={notification.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      onClick={() => markAsRead(notification.id)}
                      className={cn(
                        "flex items-start gap-3 p-4 cursor-pointer transition-colors hover:bg-white/5",
                        !notification.read && "bg-white/5"
                      )}
                    >
                      <div className={cn(
                        "flex-shrink-0 p-2 rounded-full",
                        notification.priority === "urgent" && "bg-red-500/20",
                        notification.priority === "high" && "bg-yellow-500/20",
                        !notification.priority || notification.priority === "medium" && "bg-white/10"
                      )}>
                        <NotificationIcon type={notification.type} priority={notification.priority} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className={cn("text-sm font-medium truncate", notification.read ? "text-white/70" : "text-white")}>
                            {notification.title}
                          </h4>
                          {!notification.read && (
                            <span className="h-2 w-2 rounded-full bg-[#1db954] flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{notification.message}</p>
                        <span className="text-[10px] text-white/30 mt-1 block">{formatTime(notification.timestamp)}</span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeNotification(notification.id) }}
                        className="flex-shrink-0 p-1.5 rounded-lg opacity-0 hover:opacity-100 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-5 py-3 border-t border-white/10">
                <button 
                  onClick={clearAll}
                  className="w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/60 hover:text-white transition-colors"
                >
                  Limpar todas
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Bell button with badge
export function NotificationBell({ onClick }: { onClick: () => void }) {
  const { unreadCount } = useNotifications()

  return (
    <button 
      onClick={onClick}
      className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
    >
      <Bell className="h-5 w-5 text-white/70 hover:text-white" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full bg-[#1db954] text-[10px] font-bold text-black">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  )
}

// Demo notifications generator for testing
export function useNotificationDemo(enabled: boolean = false) {
  const { addNotification } = useNotifications()

  useEffect(() => {
    if (!enabled) return

    const demoNotifications = [
      {
        type: "goal" as const,
        title: "GOOOL do Flamengo!",
        message: "Gabigol marca o segundo gol do Flamengo aos 67 minutos!",
        priority: "high" as const
      },
      {
        type: "match_start" as const,
        title: "Partida Iniciada",
        message: "Palmeiras x Sao Paulo - Campeonato Brasileiro",
        priority: "medium" as const
      },
      {
        type: "transfer" as const,
        title: "Nova Contratacao!",
        message: "Seu time anunciou um novo reforco para o meio-campo",
        priority: "medium" as const
      },
      {
        type: "injury" as const,
        title: "Lesao de Jogador",
        message: "Seu atacante principal sofreu uma lesao muscular e ficara fora por 2 semanas",
        priority: "urgent" as const
      },
      {
        type: "achievement" as const,
        title: "Conquista Desbloqueada!",
        message: "Voce completou 10 vitorias consecutivas no modo carreira",
        priority: "high" as const
      }
    ]

    // Add initial notification
    addNotification(demoNotifications[0])

    // Add more over time
    const interval = setInterval(() => {
      const randomNotif = demoNotifications[Math.floor(Math.random() * demoNotifications.length)]
      addNotification(randomNotif)
    }, 15000)

    return () => clearInterval(interval)
  }, [enabled, addNotification])
}
