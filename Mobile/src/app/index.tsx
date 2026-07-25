import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, BackHandler, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { WebView, type WebViewNavigation } from "react-native-webview"
import { UF } from "@/uf/theme"
import { GAME_URL } from "@/uf/config"

export default function GameScreen() {
  const webRef = useRef<WebView>(null)
  const canGoBack = useRef(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Botão físico "voltar" do Android navega dentro do jogo em vez de fechar.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack.current) {
        webRef.current?.goBack()
        return true
      }
      return false
    })
    return () => sub.remove()
  }, [])

  const onNav = (s: WebViewNavigation) => {
    canGoBack.current = s.canGoBack
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <WebView
        ref={webRef}
        source={{ uri: GAME_URL }}
        style={styles.web}
        onLoadStart={() => {
          setLoading(true)
          setError(false)
        }}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false)
          setError(true)
        }}
        onNavigationStateChange={onNav}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsBackForwardNavigationGestures
        cacheEnabled
        setSupportMultipleWindows={false}
      />

      {(loading || error) && (
        <View style={styles.overlay}>
          <Text style={styles.brand}>ULTRAFOOT</Text>
          <Text style={styles.brandSub}>de bolso</Text>
          {error ? (
            <Text style={styles.error}>
              Não consegui carregar o jogo.{"\n"}Verifique sua conexão e a URL configurada.
            </Text>
          ) : (
            <>
              <ActivityIndicator color={UF.primary} size="large" style={{ marginTop: 20 }} />
              <Text style={styles.hint}>Carregando o jogo…</Text>
            </>
          )}
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
})
