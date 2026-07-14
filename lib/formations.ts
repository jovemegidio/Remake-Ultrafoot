// Formacoes e suas coordenadas no campo (sistema 100x133, EA FC style).
//
// Estava declarado DENTRO de app/elenco/gerenciamento/page.tsx, entao nenhuma outra tela
// podia usar — e a Central de Transferencias acabou desenhando um 4-3-3 com 11 <div>
// chumbados no HTML (overalls 81/78/80/84..., rotulos "ZAG"/"MC"), sem relacao com o
// elenco nem com a formacao real do usuario. Compartilhando daqui, cada tela desenha o
// time DE VERDADE.

export interface FormationSlot { pos: string; x: number; y: number }
export const FORMATIONS: Record<string, { name: string; positions: FormationSlot[] }> = {
  "4-3-3": {
    name: "4-3-3",
    positions: [
      { pos: "GOL", x: 50, y: 92 },
      { pos: "LD", x: 85, y: 75 },
      { pos: "ZAG", x: 65, y: 80 },
      { pos: "ZAG", x: 35, y: 80 },
      { pos: "LE", x: 15, y: 75 },
      { pos: "VOL", x: 50, y: 55 },
      { pos: "MEI", x: 75, y: 42 },
      { pos: "MEI", x: 25, y: 42 },
      { pos: "PD", x: 80, y: 22 },
      { pos: "ATA", x: 50, y: 12 },
      { pos: "PE", x: 20, y: 22 },
    ],
  },
  "4-4-2": {
    name: "4-4-2",
    positions: [
      { pos: "GOL", x: 50, y: 92 },
      { pos: "LD", x: 85, y: 75 },
      { pos: "ZAG", x: 65, y: 80 },
      { pos: "ZAG", x: 35, y: 80 },
      { pos: "LE", x: 15, y: 75 },
      { pos: "MD", x: 85, y: 48 },
      { pos: "VOL", x: 60, y: 52 },
      { pos: "VOL", x: 40, y: 52 },
      { pos: "ME", x: 15, y: 48 },
      { pos: "ATA", x: 62, y: 15 },
      { pos: "ATA", x: 38, y: 15 },
    ],
  },
  "4-2-3-1": {
    name: "4-2-3-1",
    positions: [
      { pos: "GOL", x: 50, y: 92 },
      { pos: "LD", x: 85, y: 75 },
      { pos: "ZAG", x: 65, y: 80 },
      { pos: "ZAG", x: 35, y: 80 },
      { pos: "LE", x: 15, y: 75 },
      { pos: "VOL", x: 60, y: 58 },
      { pos: "VOL", x: 40, y: 58 },
      { pos: "PD", x: 82, y: 35 },
      { pos: "MEI", x: 50, y: 32 },
      { pos: "PE", x: 18, y: 35 },
      { pos: "ATA", x: 50, y: 12 },
    ],
  },
  "3-5-2": {
    name: "3-5-2",
    positions: [
      { pos: "GOL", x: 50, y: 92 },
      { pos: "ZAG", x: 75, y: 78 },
      { pos: "ZAG", x: 50, y: 82 },
      { pos: "ZAG", x: 25, y: 78 },
      { pos: "ALD", x: 90, y: 50 },
      { pos: "VOL", x: 65, y: 55 },
      { pos: "MEI", x: 50, y: 42 },
      { pos: "VOL", x: 35, y: 55 },
      { pos: "ALE", x: 10, y: 50 },
      { pos: "ATA", x: 62, y: 15 },
      { pos: "ATA", x: 38, y: 15 },
    ],
  },
  "5-3-2": {
    name: "5-3-2",
    positions: [
      { pos: "GOL", x: 50, y: 92 },
      { pos: "ALD", x: 90, y: 65 },
      { pos: "ZAG", x: 70, y: 78 },
      { pos: "ZAG", x: 50, y: 82 },
      { pos: "ZAG", x: 30, y: 78 },
      { pos: "ALE", x: 10, y: 65 },
      { pos: "MEI", x: 70, y: 45 },
      { pos: "VOL", x: 50, y: 50 },
      { pos: "MEI", x: 30, y: 45 },
      { pos: "ATA", x: 62, y: 15 },
      { pos: "ATA", x: 38, y: 15 },
    ],
  },
}

/** Slots da formacao pedida; cai no 4-3-3 se a formacao nao existir. */
export function getFormationSlots(formation: string | undefined): FormationSlot[] {
  return (FORMATIONS[formation ?? ""] ?? FORMATIONS["4-3-3"]).positions
}
