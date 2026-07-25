import { StyleSheet, Text, View } from "react-native"
import { Card, Screen, ScreenTitle } from "@/uf/ui"
import { UF } from "@/uf/theme"
import { CLUB, FIXTURES, type Fixture } from "@/uf/data"

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00")
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
}

function result(f: Fixture): { label: string; color: string } | null {
  if (f.homeScore === undefined || f.awayScore === undefined) return null
  const isHome = f.home === CLUB.name
  const gf = isHome ? f.homeScore : f.awayScore
  const ga = isHome ? f.awayScore : f.homeScore
  if (gf > ga) return { label: "V", color: UF.primary }
  if (gf < ga) return { label: "D", color: UF.danger }
  return { label: "E", color: UF.gold }
}

export default function CalendarioScreen() {
  return (
    <Screen>
      <ScreenTitle title="Calendário" subtitle="Próximos jogos e resultados" />
      {FIXTURES.map((f) => {
        const res = result(f)
        return (
          <Card key={f.id} style={{ marginBottom: 10 }}>
            <View style={styles.top}>
              <Text style={styles.comp}>{f.comp}</Text>
              <Text style={styles.date}>{fmtDate(f.date)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.team, f.home === CLUB.name && styles.mine]} numberOfLines={1}>
                {f.home}
              </Text>
              {res ? (
                <View style={styles.scoreBox}>
                  <Text style={styles.score}>
                    {f.homeScore} - {f.awayScore}
                  </Text>
                  <View style={[styles.resTag, { borderColor: res.color, backgroundColor: res.color + "1a" }]}>
                    <Text style={[styles.resText, { color: res.color }]}>{res.label}</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.vs}>x</Text>
              )}
              <Text style={[styles.team, styles.right, f.away === CLUB.name && styles.mine]} numberOfLines={1}>
                {f.away}
              </Text>
            </View>
          </Card>
        )
      })}
    </Screen>
  )
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  comp: { color: UF.accent, fontSize: 11, fontWeight: "700" },
  date: { color: UF.muted, fontSize: 11 },
  row: { flexDirection: "row", alignItems: "center" },
  team: { color: UF.text, fontSize: 14, fontWeight: "600", flex: 1 },
  right: { textAlign: "right" },
  mine: { color: UF.primary, fontWeight: "800" },
  vs: { color: UF.muted, fontSize: 13, paddingHorizontal: 12 },
  scoreBox: { alignItems: "center", paddingHorizontal: 10, flexDirection: "row", gap: 6 },
  score: { color: UF.text, fontSize: 15, fontWeight: "900" },
  resTag: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 1 },
  resText: { fontSize: 10, fontWeight: "800" },
})
