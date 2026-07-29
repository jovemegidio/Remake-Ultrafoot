"use client"

import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { X, LogIn, UserPlus, Loader2, KeyRound } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  cadastrar, entrar, ativar, gerarPkce, urlDoGoogle, entrarComGoogle, type Sessao,
} from "@/lib/auth"

/**
 * Login e cadastro do launcher.
 *
 * ⚠️ A CONTA E OBRIGATORIA PARA BAIXAR o jogo — instalar, atualizar e reparar
 * passam por aqui. Jogar nao: ha jogadores ativos, muitos com registro por
 * codigo serial, e exigir conta para abrir faria o jogo parar para quem ja
 * pagou. Por isso este dialogo continua FECHAVEL a qualquer momento.
 *
 * O registro existente e migrado sozinho: lib/auth.ts le o codigo da maquina e
 * o envia junto; o servidor vincula a conta e impede que outra pessoa o use.
 */
/** Classe unica dos campos: repetir a string em cada input ja causou divergencia. */
const CAMPO = "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/50"

export function AuthDialog({ onClose, onEntrou, inicial = "entrar" }: {
  onClose: () => void
  onEntrou: (s: Sessao) => void
  /** "ativar" e para quem JA entrou e so quer informar a chave da compra. */
  inicial?: "entrar" | "cadastrar" | "ativar"
}) {
  const [modo, setModo] = useState<"entrar" | "cadastrar" | "ativar">(inicial)
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [nome, setNome] = useState("")
  const [telefone, setTelefone] = useState("")
  const [codigo, setCodigo] = useState("")
  const [ocupado, setOcupado] = useState<"" | "senha" | "google">("")
  const [erro, setErro] = useState("")

  const submeter = async () => {
    if (ocupado) return
    setErro("")
    setOcupado("senha")
    try {
      const s = modo === "ativar"
        ? await ativar(codigo)
        : modo === "entrar"
          ? await entrar(email, senha)
          : await cadastrar(email, senha, nome, telefone, codigo)
      onEntrou(s)
      onClose()
    } catch (e) {
      setErro(e instanceof Error ? e.message : "nao foi possivel concluir")
    } finally {
      setOcupado("")
    }
  }

  const comGoogle = async () => {
    if (ocupado) return
    setErro("")
    setOcupado("google")
    try {
      // O `state` protege contra CSRF: o Rust compara o que volta do Google com
      // este valor antes de aceitar o code.
      const state = crypto.randomUUID()
      const { verifier, challenge } = await gerarPkce()
      // A porta local so e conhecida pelo Rust, entao ele completa o redirect_uri.
      const base = urlDoGoogle(challenge, "__REDIRECT__").replace(/&redirect_uri=__REDIRECT__/, "")
      const retorno = await invoke<string>("google_login", { authUrlBase: base, state })
      const [code, redirectUri] = retorno.split("|")
      const s = await entrarComGoogle(code, verifier, redirectUri)
      onEntrou(s)
      onClose()
    } catch (e) {
      setErro(e instanceof Error ? e.message : "nao foi possivel entrar com o Google")
    } finally {
      setOcupado("")
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-6 backdrop-blur">
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a1414] via-[#091018] to-[#060b0e] p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-lg font-bold text-white">
          {modo === "ativar" ? "Ativar versão completa"
            : modo === "entrar" ? "Entrar na sua conta" : "Criar conta"}
        </h2>
        <p className="mt-1 text-xs text-white/45">
          {modo === "ativar"
            ? "Informe a chave que veio com a sua compra. Ela fica ligada a esta conta e o jogo passa a abrir ativado."
            : "Sua conta guarda compras e progresso. Se você já tem registro nesta máquina, ele é vinculado automaticamente."}
        </p>

        {modo !== "ativar" && <button
          onClick={comGoogle}
          disabled={!!ocupado}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {ocupado === "google"
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <span className="text-base font-bold text-[#4285F4]">G</span>}
          Continuar com o Google
        </button>}

        {modo !== "ativar" && <div className="my-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-[10px] uppercase tracking-wider text-white/30">ou</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>}

        <div className="space-y-2">
          {modo === "cadastrar" && (
            <>
              <input
                value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome"
                className={CAMPO}
              />
              <input
                value={telefone} onChange={e => setTelefone(e.target.value)}
                type="tel" inputMode="tel" placeholder="Telefone (WhatsApp)"
                className={CAMPO}
              />
            </>
          )}
          {modo !== "ativar" && <input
            value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="E-mail"
            className={CAMPO}
          />}
          {modo !== "ativar" && <input
            value={senha} onChange={e => setSenha(e.target.value)} type="password"
            placeholder={modo === "cadastrar" ? "Senha (mínimo 8 caracteres)" : "Senha"}
            onKeyDown={e => { if (e.key === "Enter") void submeter() }}
            className={CAMPO}
          />}

          {/* CHAVE DE ATIVACAO — opcional. Com ela a conta libera a versao
              completa e o jogo passa a abrir ativado sozinho; sem ela a pessoa
              joga a versao simples e pode ativar depois, sem perder a conta. */}
          {modo !== "entrar" && (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-white/70">
                <KeyRound className="h-3.5 w-3.5 text-primary" />
                Código de ativação <span className="font-normal text-white/35">(opcional)</span>
              </label>
              <input
                value={codigo}
                onChange={e => setCodigo(e.target.value.toUpperCase())}
                placeholder="UF26-XXXXX-XXXXX-XXXXX"
                spellCheck={false}
                className={cn(CAMPO, "font-mono tracking-wider")}
              />
              <p className="mt-1 text-[11px] leading-snug text-white/35">
                Tem a chave da compra? Informe aqui e o jogo abre com a versão completa —
                sem pedir registro de novo. Sem a chave você joga a versão simples.
              </p>
            </div>
          )}
        </div>

        {erro && <p className="mt-3 text-xs text-red-400">{erro}</p>}

        <button
          onClick={submeter}
          disabled={!!ocupado || (modo === "ativar" ? codigo.length < 10 : !email || !senha)}
          className={cn(
            "mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all",
            "bg-gradient-to-r from-primary to-[#00c8ff] text-black hover:brightness-110",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          {ocupado === "senha"
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : modo === "ativar" ? <KeyRound className="h-4 w-4" />
              : modo === "entrar" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {modo === "ativar" ? "Ativar" : modo === "entrar" ? "Entrar" : "Criar conta"}
        </button>

        {modo !== "ativar" && <button
          onClick={() => { setModo(modo === "entrar" ? "cadastrar" : "entrar"); setErro("") }}
          className="mt-3 w-full text-center text-xs text-white/40 transition-colors hover:text-white"
        >
          {modo === "entrar" ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
        </button>}

        {/* Saida explicita. Como o dialogo agora abre sozinho, precisa de um
            caminho obvio para quem so quer jogar — senao vira parede. */}
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg py-2 text-center text-xs text-white/40 transition-colors hover:bg-white/[0.04] hover:text-white/70"
        >
          Continuar sem entrar
        </button>
        <p className="mt-1 text-center text-[10px] text-white/25">
          Você pode criar sua conta depois, pelo botão no topo.
        </p>
      </div>
    </div>
  )
}
