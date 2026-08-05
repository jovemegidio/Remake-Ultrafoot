"use client"

import { useRef, useState } from "react"
import { User, Camera, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Foto do tecnico. Exibicao (`ManagerAvatar`) e edicao (`ManagerAvatarPicker`).
 *
 * A imagem e reduzida para 128px e recomprimida antes de entrar no save: um JPEG
 * de camera tem alguns MB e o save vive no armazenamento local do app — guardar
 * o arquivo cru encheria a cota e deixaria toda gravacao de save lenta. 128px e
 * o dobro do maior lugar onde a foto aparece, entao nao ha perda visivel.
 */

const TAMANHO = 128

export function ManagerAvatar({
  src,
  className,
  iconClassName,
}: {
  src?: string
  className?: string
  iconClassName?: string
}) {
  if (src) {
    // <img> e nao next/image: o valor e um data URI que muda em runtime, e o
    // otimizador nao acrescenta nada aqui (o arquivo ja veio reduzido).
    return <img src={src} alt="Foto do tecnico" className={cn("object-cover", className)} />
  }
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <User className={iconClassName} />
    </div>
  )
}

/** Reduz para 128x128 (recorte central) e devolve um data URI JPEG. */
async function prepararImagem(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const lado = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement("canvas")
  canvas.width = TAMANHO
  canvas.height = TAMANHO
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("canvas indisponivel")
  // Recorte central: enquadra o rosto em vez de espremer a foto inteira.
  ctx.drawImage(
    bitmap,
    (bitmap.width - lado) / 2,
    (bitmap.height - lado) / 2,
    lado,
    lado,
    0,
    0,
    TAMANHO,
    TAMANHO,
  )
  bitmap.close()
  return canvas.toDataURL("image/jpeg", 0.82)
}

export function ManagerAvatarPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (dataUrl: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)

  const escolher = async (file?: File) => {
    if (!file) return
    setErro(null)
    try {
      onChange(await prepararImagem(file))
    } catch {
      setErro("Nao consegui ler essa imagem. Tente um PNG ou JPG.")
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-primary/20 ring-1 ring-white/10 transition-all hover:ring-primary/60"
        title="Trocar foto"
      >
        <ManagerAvatar
          src={value}
          className="h-16 w-16"
          iconClassName="h-8 w-8 text-primary"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
          <Camera className="h-5 w-5 text-white" />
        </span>
      </button>

      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition-colors hover:border-white/25 hover:text-white"
          >
            {value ? "Trocar foto" : "Escolher foto"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 transition-colors hover:border-red-500/40 hover:text-red-300"
            >
              <Trash2 className="h-3 w-3" />
              Remover
            </button>
          )}
        </div>
        <span className="text-[11px] text-white/35">PNG ou JPG. A imagem e recortada em quadrado.</span>
        {erro && <span className="text-[11px] text-red-400">{erro}</span>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={e => {
          void escolher(e.target.files?.[0])
          // Zera o input para que escolher o MESMO arquivo de novo dispare o evento.
          e.target.value = ""
        }}
      />
    </div>
  )
}
