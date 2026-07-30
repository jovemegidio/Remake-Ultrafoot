import Constants from "expo-constants"
import { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, AppState, BackHandler, Platform, Pressable, StyleSheet, Text, ToastAndroid, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { WebView, type WebViewNavigation } from "react-native-webview"
import { UF } from "@/uf/theme"
import { GAME_URL } from "@/uf/config"

const VERSAO = Constants.expoConfig?.version ?? "?"

/** Janela para o segundo toque em "voltar" fechar o app (ms). */
const JANELA_SAIR = 2000

export default function GameScreen() {
  const webRef = useRef<WebView>(null)
  const canGoBack = useRef(false)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  // Muda a cada tentativa e vai na `key` do WebView: recriar o componente é o
  // único jeito confiável de recomeçar depois de o renderizador morrer — nesse
  // estado o `reload()` do ref não tem em quem mandar o comando.
  const [tentativa, setTentativa] = useState(0)
  // O renderizador morreu enquanto o app estava em segundo plano? Nesse caso a
  // recuperação acontece sozinha ao voltar (ver o efeito de AppState).
  const morreuEmSegundoPlano = useRef(false)

  const tentarDeNovo = useCallback(() => {
    canGoBack.current = false
    morreuEmSegundoPlano.current = false
    setErro(null)
    setLoading(true)
    setTentativa((n) => n + 1)
  }, [])

  // Botão físico "voltar" do Android navega dentro do jogo em vez de fechar.
  //
  // NA RAIZ ELE PEDE CONFIRMAÇÃO: a carreira mora no localStorage da WebView e o
  // Android encerra o app ao sair. Um toque errado no menu principal fechava o
  // jogo na hora, sem aviso — e voltar significa esperar tudo carregar de novo.
  // Dois toques seguidos saem; um toque só avisa e não faz nada.
  useEffect(() => {
    let ultimoToque = 0
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack.current) {
        webRef.current?.goBack()
        return true
      }
      const agora = Date.now()
      if (agora - ultimoToque < JANELA_SAIR) return false // deixa o Android fechar
      ultimoToque = agora
      if (Platform.OS === "android") {
        ToastAndroid.show("Toque em voltar de novo para sair do Ultrafoot", ToastAndroid.SHORT)
      }
      return true
    })
    return () => sub.remove()
  }, [])

  // VOLTAR PARA O APP DEPOIS DE UM TEMPO FORA. O Android encerra o renderizador
  // da WebView para liberar memória — quase sempre com o app em segundo plano.
  // Antes, a pessoa voltava e encontrava a tela de erro esperando um toque em
  // "Tentar de novo". Agora a recuperação é automática ao trazer o app de volta.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado === "active" && morreuEmSegundoPlano.current) tentarDeNovo()
    })
    return () => sub.remove()
  }, [tentarDeNovo])

  const onNav = (s: WebViewNavigation) => {
    canGoBack.current = s.canGoBack
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <WebView
        key={tentativa}
        ref={webRef}
        source={{ uri: GAME_URL }}
        style={styles.web}
        onLoadStart={() => {
          setLoading(true)
          setErro(null)
        }}
        onLoadEnd={() => setLoading(false)}
        onError={({ nativeEvent }) => {
          setLoading(false)
          setErro(nativeEvent.description || "não consegui alcançar o servidor")
        }}
        // Sem isto, servidor fora do ar respondendo 502 — ou endereço errado
        // devolvendo 404 — deixava uma tela branca sem explicação nenhuma.
        // Só o documento principal conta: imagem solta que falha não é o jogo
        // inteiro fora do ar.
        onHttpError={({ nativeEvent }) => {
          if (!nativeEvent.url.startsWith(GAME_URL)) return
          setLoading(false)
          setErro(`o servidor respondeu ${nativeEvent.statusCode}`)
        }}
        // O Android mata o renderizador do WebView quando a memória aperta —
        // tipicamente ao voltar para o app depois de um tempo em segundo plano.
        // O comportamento padrão é a tela ficar branca PARA SEMPRE.
        onRenderProcessGone={() => {
          setLoading(false)
          morreuEmSegundoPlano.current = AppState.currentState !== "active"
          setErro("o Android encerrou o jogo para liberar memória")
        }}
        onNavigationStateChange={onNav}
        originWhitelist={["*"]}
        javaScriptEnabled
        // O save do jogo vive no localStorage da WebView e o jogo é servido em
        // pedaços cacheáveis: sem estes dois, cada abertura recomeça do zero.
        domStorageEnabled
        cacheEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsBackForwardNavigationGestures
        setSupportMultipleWindows={false}
      />

      {(loading || erro) && (
        <View style={styles.overlay}>
          <Text style={styles.brand}>ULTRAFOOT</Text>
          <Text style={styles.brandSub}>de bolso</Text>
          {erro ? (
            <>
              <Text style={styles.error}>
                Não consegui carregar o jogo.{"\n"}
                {erro}
              </Text>
              <Pressable
                onPress={tentarDeNovo}
                accessibilityRole="button"
                style={({ pressed }) => [styles.botao, pressed && styles.botaoPressionado]}
              >
                <Text style={styles.botaoTexto}>Tentar de novo</Text>
              </Pressable>
              <Text style={styles.endereco}>{GAME_URL}</Text>
            </>
          ) : (
            <>
              <ActivityIndicator color={UF.primary} size="large" style={{ marginTop: 20 }} />
              <Text style={styles.hint}>Carregando o jogo…</Text>
            </>
          )}
          {/* A versão do APP (não a do jogo): é o primeiro dado de qualquer
              suporte — "qual versão você instalou?" — e ninguém tinha onde ver. */}
          <Text style={styles.versao}>app {VERSAO}</Text>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UF.bg },
  web: { flex: 1, backgroundColor: UF.bg },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: UF.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  brand: { color: UF.primary, fontSize: 34, fontWeight: "900", letterSpacing: 2 },
  brandSub: { color: UF.muted, fontSize: 14, fontWeight: "700", letterSpacing: 6, marginTop: 2 },
  hint: { color: UF.muted, fontSize: 13, marginTop: 12 },
  error: { color: UF.muted, fontSize: 13, textAlign: "center", marginTop: 20, lineHeight: 20 },
  botao: {
    marginTop: 22,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
    backgroundColor: UF.primary,
  },
  botaoPressionado: { opacity: 0.7 },
  botaoTexto: { color: UF.bg, fontSize: 15, fontWeight: "800" },
  endereco: { color: UF.muted, fontSize: 11, marginTop: 18, opacity: 0.6 },
  versao: { color: UF.muted, fontSize: 10, marginTop: 10, opacity: 0.45 },
})
