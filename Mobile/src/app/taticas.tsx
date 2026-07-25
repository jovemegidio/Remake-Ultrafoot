import { StyleSheet, Text, View } from "react-native"
import { Card, Screen, ScreenTitle, Pill } from "@/uf/ui"
import { UF } from "@/uf/theme"
import { FORMATION_433 } from "@/uf/data"

export default function TaticasScreen() {
  return (
    <Screen>
      <ScreenTitle title="Táticas" subtitle="Escalação e formação" />

      <View style={styles.headerRow}>
        <Pill text="4-3-3" />
        <Pill text="Ataque" color={UF.accent} />
        <Pill text="Pressão alta" color={UF.gold} />
      </View>

      <Card style={styles.pitchCard}>
        <View style={styles.pitch}>
          {/* Linhas do campo */}
          <View style={styles.halfLine} />
          <View style={styles.centerCircle} />
          <View style={[styles.box, styles.boxTop]} />
          <View style={[styles.box, styles.boxBottom]} />

          {FORMATION_433.map((p, i) => (
            <View
              key={i}
              style={[
                styles.player,
                { left: `${p.x}%`, top: `${p.y}%` },
              ]}
            >
              <View style={styles.dot} />
              <Text style={styles.playerLabel}>{p.label}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Text style={styles.hint}>
        Toque nos jogadores para trocar (em breve). Esta é a base do módulo de táticas do Ultrafoot de bolso.
      </Text>
    </Screen>
  )
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  pitchCard: { padding: 10 },
  pitch: {
    width: "100%",
    aspectRatio: 0.72,
    backgroundColor: "#0d2a1d",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: UF.primary + "33",
    overflow: "hidden",
  },
  halfLine: { position: "absolute", top: "50%", left: 0, right: 0, height: 1, backgroundColor: UF.primary + "33" },
  centerCircle: {
    position: "absolute", top: "50%", left: "50%", width: 70, height: 70, borderRadius: 35,
    borderWidth: 1, borderColor: UF.primary + "33", marginLeft: -35, marginTop: -35,
  },
  box: { position: "absolute", left: "50%", width: 120, height: 46, marginLeft: -60, borderWidth: 1, borderColor: UF.primary + "33" },
  boxTop: { top: 0 },
  boxBottom: { bottom: 0 },
  player: { position: "absolute", alignItems: "center", width: 44, marginLeft: -22, marginTop: -16 },
  dot: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: UF.primary,
    borderWidth: 2, borderColor: "#0a1f16",
  },
  playerLabel: { color: UF.text, fontSize: 9, fontWeight: "800", marginTop: 2 },
  hint: { color: UF.muted, fontSize: 12, lineHeight: 18, marginTop: 16, textAlign: "center" },
})
