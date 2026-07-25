import { StyleSheet, Text, View } from "react-native"
import { Card, Screen, ScreenTitle } from "@/uf/ui"
import { UF, ovrColor } from "@/uf/theme"
import { SQUAD, type Player } from "@/uf/data"

const ORDER: Player["pos"][] = ["GOL", "ZAG", "LAT", "VOL", "MEI", "PON", "ATA"]

export default function ElencoScreen() {
  const sorted = [...SQUAD].sort((a, b) => {
    const pi = ORDER.indexOf(a.pos) - ORDER.indexOf(b.pos)
    return pi !== 0 ? pi : b.ovr - a.ovr
  })
  const avg = Math.round(SQUAD.reduce((s, p) => s + p.ovr, 0) / SQUAD.length)

  return (
    <Screen>
      <ScreenTitle title="Elenco" subtitle={`${SQUAD.length} jogadores · média ${avg}`} />
      <Card style={{ padding: 6 }}>
        {sorted.map((p, i) => (
          <View
            key={p.id}
            style={[styles.row, i < sorted.length - 1 && styles.rowBorder]}
          >
            <Text style={styles.num}>{p.number}</Text>
            <View style={styles.posTag}>
              <Text style={styles.posText}>{p.pos}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.meta}>{p.age} anos</Text>
            </View>
            <View style={[styles.ovr, { borderColor: ovrColor(p.ovr) }]}>
              <Text style={[styles.ovrText, { color: ovrColor(p.ovr) }]}>{p.ovr}</Text>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: UF.border },
  num: { color: UF.muted, fontSize: 13, fontWeight: "700", width: 22, textAlign: "center" },
  posTag: { width: 40, alignItems: "center", backgroundColor: UF.bgElev, borderRadius: 6, paddingVertical: 3 },
  posText: { color: UF.accent, fontSize: 10, fontWeight: "800" },
  name: { color: UF.text, fontSize: 15, fontWeight: "600" },
  meta: { color: UF.muted, fontSize: 11, marginTop: 1 },
  ovr: { width: 40, height: 34, borderRadius: 9, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  ovrText: { fontSize: 16, fontWeight: "900" },
})
