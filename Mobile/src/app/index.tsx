import { StyleSheet, Text, View } from "react-native"
import { Card, Screen, SectionTitle } from "@/uf/ui"
import { UF } from "@/uf/theme"
import { CLUB, FIXTURES, NEWS } from "@/uf/data"

function formShort(r: string) {
  return r === "V" ? UF.primary : r === "E" ? UF.gold : UF.danger
}

export default function HomeScreen() {
  const next = FIXTURES.find((f) => f.homeScore === undefined)
  return (
    <Screen>
      {/* Cabeçalho do clube */}
      <View style={styles.brandRow}>
        <View style={styles.crest}>
          <Text style={styles.crestText}>{CLUB.short}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.club}>{CLUB.name}</Text>
          <Text style={styles.league}>{CLUB.league}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.pos}>{CLUB.position}º</Text>
          <Text style={styles.league}>{CLUB.points} pts</Text>
        </View>
      </View>

      {/* Forma recente */}
      <View style={styles.formRow}>
        <Text style={styles.formLabel}>Forma</Text>
        {CLUB.form.map((r, i) => (
          <View key={i} style={[styles.formDot, { backgroundColor: formShort(r) + "22", borderColor: formShort(r) }]}>
            <Text style={[styles.formText, { color: formShort(r) }]}>{r}</Text>
          </View>
        ))}
      </View>

      {/* Próxima partida */}
      <SectionTitle>Próxima partida</SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        {next ? (
          <View style={styles.matchRow}>
            <Text style={styles.team}>{next.home}</Text>
            <View style={styles.vs}>
              <Text style={styles.vsText}>VS</Text>
              <Text style={styles.matchComp}>{next.comp}</Text>
            </View>
            <Text style={[styles.team, { textAlign: "right" }]}>{next.away}</Text>
          </View>
        ) : (
          <Text style={styles.league}>Sem jogos agendados.</Text>
        )}
      </Card>

      {/* Resumo financeiro/temporada */}
      <View style={styles.statsRow}>
        <Card style={styles.stat}>
          <Text style={styles.statValue}>{CLUB.played}</Text>
          <Text style={styles.statLabel}>Jogos</Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={styles.statValue}>{CLUB.budget}</Text>
          <Text style={styles.statLabel}>Orçamento</Text>
        </Card>
      </View>

      {/* Novidades */}
      <SectionTitle>Novidades</SectionTitle>
      {NEWS.map((n) => (
        <Card key={n.id} style={{ marginBottom: 10 }}>
          <Text style={styles.newsTitle}>{n.title}</Text>
          <Text style={styles.newsBody}>{n.body}</Text>
        </Card>
      ))}
    </Screen>
  )
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  crest: {
    width: 56, height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center",
    backgroundColor: UF.primary + "1a", borderWidth: 1, borderColor: UF.primary + "55",
  },
  crestText: { color: UF.primary, fontWeight: "900", fontSize: 18 },
  club: { color: UF.text, fontSize: 20, fontWeight: "800" },
  league: { color: UF.muted, fontSize: 12 },
  pos: { color: UF.primary, fontSize: 22, fontWeight: "900" },
  formRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20 },
  formLabel: { color: UF.muted, fontSize: 12, marginRight: 4 },
  formDot: { width: 26, height: 26, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  formText: { fontSize: 12, fontWeight: "800" },
  matchRow: { flexDirection: "row", alignItems: "center" },
  team: { color: UF.text, fontSize: 15, fontWeight: "700", flex: 1 },
  vs: { alignItems: "center", paddingHorizontal: 12 },
  vsText: { color: UF.primary, fontWeight: "900", fontSize: 14 },
  matchComp: { color: UF.muted, fontSize: 10, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 4 },
  stat: { flex: 1, alignItems: "center" },
  statValue: { color: UF.text, fontSize: 18, fontWeight: "800" },
  statLabel: { color: UF.muted, fontSize: 11, marginTop: 2 },
  newsTitle: { color: UF.text, fontSize: 14, fontWeight: "700", marginBottom: 4 },
  newsBody: { color: UF.muted, fontSize: 12, lineHeight: 18 },
})
