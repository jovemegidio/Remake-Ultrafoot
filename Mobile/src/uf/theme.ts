// Tema do Ultrafoot de bolso — escuro com verde neon (identidade do jogo).
export const UF = {
  bg: "#0a0e12",
  bgElev: "#0e141b",
  card: "#121a22",
  cardElev: "#16202a",
  border: "#1f2c37",
  text: "#f2f6f9",
  muted: "#8a97a5",
  primary: "#00ffc8",
  primaryDim: "#00d9aa",
  accent: "#39c0ff",
  gold: "#ffd25a",
  danger: "#ff5b6e",
}

/** Cor por faixa de overall (destaque visual, como no jogo). */
export function ovrColor(ovr: number): string {
  if (ovr >= 85) return UF.primary
  if (ovr >= 78) return UF.accent
  if (ovr >= 70) return UF.gold
  return UF.muted
}
