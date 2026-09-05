"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Delete, ArrowLeft, Check, Space } from "lucide-react"
import { cn } from "@/lib/utils"

interface VirtualKeyboardProps {
  isOpen: boolean
  initialValue?: string
  title?: string
  subtitle?: string
  maxLength?: number
  onConfirm: (value: string) => void
  onCancel: () => void
}

const KEYBOARD_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
]

const SPECIAL_KEYS = ["SPACE", "BACKSPACE", "CONFIRM"]

export function VirtualKeyboard({
  isOpen,
  initialValue = "",
  title = "Digite seu nome",
  subtitle,
  maxLength = 24,
  onConfirm,
  onCancel,
}: VirtualKeyboardProps) {
  const [value, setValue] = useState(initialValue)
  const [focusedRow, setFocusedRow] = useState(0)
  const [focusedCol, setFocusedCol] = useState(0)
  const [isOnSpecialKeys, setIsOnSpecialKeys] = useState(false)
  const [specialKeyIndex, setSpecialKeyIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue)
      setFocusedRow(0)
      setFocusedCol(0)
      setIsOnSpecialKeys(false)
      setSpecialKeyIndex(0)
    }
  }, [isOpen, initialValue])

  const getCurrentRowLength = () => KEYBOARD_ROWS[focusedRow]?.length || 0

  const handleKeyPress = (key: string) => {
    if (key === "BACKSPACE") {
      setValue(prev => prev.slice(0, -1))
    } else if (key === "SPACE") {
      if (value.length < maxLength) {
        setValue(prev => prev + " ")
      }
    } else if (key === "CONFIRM") {
      if (value.trim().length > 0) {
        onConfirm(value.trim())
      }
    } else {
      if (value.length < maxLength) {
        setValue(prev => prev + key)
      }
    }
  }

  // Gamepad navigation
  useEffect(() => {
    if (!isOpen) return

    const handleGamepadButton = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail

      switch (button) {
        case "B":
          onCancel()
          break
        case "A":
          if (isOnSpecialKeys) {
            handleKeyPress(SPECIAL_KEYS[specialKeyIndex])
          } else {
            const key = KEYBOARD_ROWS[focusedRow]?.[focusedCol]
            if (key) handleKeyPress(key)
          }
          break
        case "DPAD_LEFT":
          if (isOnSpecialKeys) {
            setSpecialKeyIndex(prev => Math.max(0, prev - 1))
          } else {
            setFocusedCol(prev => Math.max(0, prev - 1))
          }
          break
        case "DPAD_RIGHT":
          if (isOnSpecialKeys) {
            setSpecialKeyIndex(prev => Math.min(SPECIAL_KEYS.length - 1, prev + 1))
          } else {
            setFocusedCol(prev => Math.min(getCurrentRowLength() - 1, prev + 1))
          }
          break
        case "DPAD_UP":
          if (isOnSpecialKeys) {
            setIsOnSpecialKeys(false)
            setFocusedRow(KEYBOARD_ROWS.length - 1)
          } else if (focusedRow > 0) {
            setFocusedRow(prev => prev - 1)
            // Ajustar coluna se a nova linha for menor
            const newRowLength = KEYBOARD_ROWS[focusedRow - 1]?.length || 0
            if (focusedCol >= newRowLength) {
              setFocusedCol(Math.max(0, newRowLength - 1))
            }
          }
          break
        case "DPAD_DOWN":
          if (!isOnSpecialKeys && focusedRow < KEYBOARD_ROWS.length - 1) {
            setFocusedRow(prev => prev + 1)
            const newRowLength = KEYBOARD_ROWS[focusedRow + 1]?.length || 0
            if (focusedCol >= newRowLength) {
              setFocusedCol(Math.max(0, newRowLength - 1))
            }
          } else if (!isOnSpecialKeys && focusedRow === KEYBOARD_ROWS.length - 1) {
            setIsOnSpecialKeys(true)
            setSpecialKeyIndex(1) // Focus on SPACE by default
          }
          break
        case "X":
          handleKeyPress("BACKSPACE")
          break
        case "Y":
          handleKeyPress("SPACE")
          break
        case "START":
          if (value.trim().length > 0) {
            onConfirm(value.trim())
          }
          break
      }
    }

    window.addEventListener("gamepad:button", handleGamepadButton)
    return () => window.removeEventListener("gamepad:button", handleGamepadButton)
  }, [isOpen, focusedRow, focusedCol, isOnSpecialKeys, specialKeyIndex, value, onCancel, onConfirm])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onCancel()
          break
        case "Enter":
          if (value.trim().length > 0) {
            onConfirm(value.trim())
          }
          break
        case "Backspace":
          setValue(prev => prev.slice(0, -1))
          break
        default:
          if (e.key.length === 1 && value.length < maxLength) {
            setValue(prev => prev + e.key.toUpperCase())
          }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, value, maxLength, onCancel, onConfirm])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl"
          ref={containerRef}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-2xl mx-4"
          >
            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="uf-heading text-2xl font-bold text-white mb-1">{title}</h2>
              {subtitle && <p className="text-sm text-white/50">{subtitle}</p>}
            </div>

            {/* Input Display */}
            <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-center min-h-[60px]">
                <span className="text-3xl font-bold text-white tracking-wider">
                  {value || <span className="text-white/20">_</span>}
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
                    className="text-emerald-400"
                  >
                    |
                  </motion.span>
                </span>
              </div>
              <div className="text-center mt-2">
                <span className="text-xs text-white/30">{value.length}/{maxLength} caracteres</span>
              </div>
            </div>

            {/* Keyboard */}
            <div className="bg-[#111] border border-white/10 rounded-xl p-4 space-y-2">
              {KEYBOARD_ROWS.map((row, rowIndex) => (
                <div key={rowIndex} className="flex justify-center gap-1.5">
                  {row.map((key, colIndex) => {
                    const isFocused = !isOnSpecialKeys && focusedRow === rowIndex && focusedCol === colIndex
                    return (
                      <button
                        key={key}
                        onClick={() => handleKeyPress(key)}
                        className={cn(
                          "w-12 h-12 rounded-lg font-bold text-lg transition-all",
                          isFocused
                            ? "bg-emerald-500 text-black scale-110 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                            : "bg-white/5 text-white hover:bg-white/10"
                        )}
                      >
                        {key}
                      </button>
                    )
                  })}
                </div>
              ))}

              {/* Special Keys Row */}
              <div className="flex justify-center gap-2 mt-4 pt-4 border-t border-white/10">
                <button
                  onClick={() => handleKeyPress("BACKSPACE")}
                  className={cn(
                    "flex items-center gap-2 px-6 h-12 rounded-lg font-medium transition-all",
                    isOnSpecialKeys && specialKeyIndex === 0
                      ? "bg-red-500 text-white scale-105 shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                      : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  )}
                >
                  <Delete className="w-5 h-5" />
                  <span className="text-xs">X</span>
                </button>

                <button
                  onClick={() => handleKeyPress("SPACE")}
                  className={cn(
                    "flex items-center gap-2 px-12 h-12 rounded-lg font-medium transition-all",
                    isOnSpecialKeys && specialKeyIndex === 1
                      ? "bg-white text-black scale-105 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                      : "bg-white/10 text-white hover:bg-white/20"
                  )}
                >
                  <span>ESPACO</span>
                  <span className="text-xs text-white/50">Y</span>
                </button>

                <button
                  onClick={() => value.trim() && onConfirm(value.trim())}
                  disabled={!value.trim()}
                  className={cn(
                    "flex items-center gap-2 px-6 h-12 rounded-lg font-bold transition-all",
                    !value.trim()
                      ? "bg-white/5 text-white/30 cursor-not-allowed"
                      : isOnSpecialKeys && specialKeyIndex === 2
                        ? "bg-emerald-500 text-black scale-105 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                        : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                  )}
                >
                  <Check className="w-5 h-5" />
                  <span>CONFIRMAR</span>
                </button>
              </div>
            </div>

            {/* Controller Hints */}
            <div className="flex items-center justify-center gap-6 mt-6 text-xs text-white/40">
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[10px] font-bold">A</span>
                <span>Selecionar</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[10px] font-bold">B</span>
                <span>Voltar</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[10px] font-bold">X</span>
                <span>Apagar</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[10px] font-bold">Y</span>
                <span>Espaco</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
