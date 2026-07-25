import { ReactNode } from "react"
import { ScrollView, StyleSheet, Text, View, ViewStyle } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { UF } from "@/uf/theme"

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  )
}

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  )
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.section}>{children}</Text>
}

export function Pill({ text, color = UF.primary }: { text: string; color?: string }) {
  return (
    <View style={[styles.pill, { borderColor: color + "55", backgroundColor: color + "1a" }]}>
      <Text style={[styles.pillText, { color }]}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: UF.bg },
  scroll: { flex: 1, backgroundColor: UF.bg },
  content: { padding: 16, paddingBottom: 32 },
  title: { color: UF.text, fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: UF.muted, fontSize: 13, marginTop: 2 },
  card: {
    backgroundColor: UF.card,
    borderColor: UF.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  section: { color: UF.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, marginTop: 8 },
  pill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: 11, fontWeight: "800" },
})
