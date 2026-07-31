"use client"

// BANDEIRAS DOS PAÍSES — em SVG, desenhadas aqui.
//
// POR QUE NÃO SÃO IMAGENS. `public/flags` só tem 11 arquivos (as línguas da
// tela de idioma) e o diretório do editor lista mais de 30 países. E
// `public/escudos/nations` NÃO serve: são os escudos das FEDERAÇÕES (o brasão da
// CBF, não a bandeira do Brasil).
//
// Desenhar resolve sem depender de download, funciona offline no aplicativo
// empacotado e não pesa nada. As bandeiras são SIMPLIFICADAS de propósito: no
// tamanho em que a lista as usa (~18 px de largura) o brasão da Espanha, a
// esfera de Portugal ou a águia do México somem de qualquer jeito — o que
// identifica o país nessa escala são as cores e a disposição delas, e isso está
// fiel. Onde há um emblema central marcante (Brasil, Portugal, Japão, Coreia,
// Uruguai) ele aparece como forma, não como desenho detalhado.
//
// Quem não tem bandeira cadastrada cai no código de três letras — que era o que
// a tela mostrava antes. Nada quebra por falta de bandeira.

import { cn } from "@/lib/utils"

/** Proporção 3:2, a mais comum. Tudo é desenhado neste viewBox. */
const VB = "0 0 3 2"

const r = (x: number, y: number, w: number, h: number, fill: string) => ({ x, y, w, h, fill })

/** Três faixas verticais de larguras iguais. */
function vertical(a: string, b: string, c: string) {
  return [r(0, 0, 1, 2, a), r(1, 0, 1, 2, b), r(2, 0, 1, 2, c)]
}
/** Três faixas horizontais de alturas iguais. */
function horizontal(a: string, b: string, c: string) {
  return [r(0, 0, 3, 2 / 3, a), r(0, 2 / 3, 3, 2 / 3, b), r(0, 4 / 3, 3, 2 / 3, c)]
}

type Faixa = { x: number; y: number; w: number; h: number; fill: string }

interface Bandeira {
  faixas: Faixa[]
  /** Detalhes por cima das faixas (círculos, cruzes, estrelas…). */
  extra?: React.ReactNode
}

/** Cruz escandinava (Dinamarca, Noruega, Suécia…). */
function cruzNordica(cor: string, interna?: string): React.ReactNode {
  return (
    <>
      <path d={`M0 0.8h3v0.4H0z`} fill={cor} />
      <path d={`M0.9 0h0.4v2h-0.4z`} fill={cor} />
      {interna && (
        <>
          <path d={`M0 0.9h3v0.2H0z`} fill={interna} />
          <path d={`M1 0h0.2v2h-0.2z`} fill={interna} />
        </>
      )}
    </>
  )
}

const estrela = (cx: number, cy: number, raio: number, cor: string, chave: string) => {
  const pontos: string[] = []
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2
    const rr = i % 2 === 0 ? raio : raio * 0.42
    pontos.push(`${(cx + Math.cos(ang) * rr).toFixed(3)},${(cy + Math.sin(ang) * rr).toFixed(3)}`)
  }
  return <polygon key={chave} points={pontos.join(" ")} fill={cor} />
}

const BANDEIRAS: Record<string, Bandeira> = {
  BRA: {
    faixas: [r(0, 0, 3, 2, "#009c3b")],
    extra: <>
      <polygon points="1.5,0.2 2.78,1 1.5,1.8 0.22,1" fill="#ffdf00" />
      <circle cx="1.5" cy="1" r="0.45" fill="#002776" />
      <path d="M1.08 0.86a0.45 0.45 0 0 0 0.84 0.1" stroke="#fff" strokeWidth="0.1" fill="none" />
    </>,
  },
  ARG: {
    faixas: [r(0, 0, 3, 2 / 3, "#74acdf"), r(0, 2 / 3, 3, 2 / 3, "#fff"), r(0, 4 / 3, 3, 2 / 3, "#74acdf")],
    extra: <circle cx="1.5" cy="1" r="0.22" fill="#f6b40e" />,
  },
  ESP: {
    faixas: [r(0, 0, 3, 0.5, "#aa151b"), r(0, 0.5, 3, 1, "#f1bf00"), r(0, 1.5, 3, 0.5, "#aa151b")],
  },
  POR: {
    faixas: [r(0, 0, 1.2, 2, "#046a38"), r(1.2, 0, 1.8, 2, "#da291c")],
    extra: <circle cx="1.2" cy="1" r="0.34" fill="#ffe900" stroke="#046a38" strokeWidth="0.08" />,
  },
  ITA: { faixas: vertical("#008c45", "#f4f5f0", "#cd212a") },
  FRA: { faixas: vertical("#002395", "#fff", "#ed2939") },
  BEL: { faixas: vertical("#000", "#fae042", "#ed2939") },
  GER: { faixas: horizontal("#000", "#dd0000", "#ffce00") },
  NED: { faixas: horizontal("#ae1c28", "#fff", "#21468b") },
  RUS: { faixas: horizontal("#fff", "#0039a6", "#d52b1e") },
  ENG: {
    faixas: [r(0, 0, 3, 2, "#fff")],
    extra: <>
      <path d="M0 0.8h3v0.4H0z" fill="#ce1124" />
      <path d="M1.3 0h0.4v2h-0.4z" fill="#ce1124" />
    </>,
  },
  SCO: {
    faixas: [r(0, 0, 3, 2, "#0065bf")],
    extra: <>
      <path d="M0 0 L3 2 M3 0 L0 2" stroke="#fff" strokeWidth="0.36" />
    </>,
  },
  TUR: {
    faixas: [r(0, 0, 3, 2, "#e30a17")],
    extra: <>
      <circle cx="1.2" cy="1" r="0.42" fill="#fff" />
      <circle cx="1.36" cy="1" r="0.34" fill="#e30a17" />
      {estrela(1.82, 1, 0.2, "#fff", "tur")}
    </>,
  },
  USA: {
    faixas: [
      r(0, 0, 3, 2, "#fff"),
      ...Array.from({ length: 7 }, (_, i) => r(0, (i * 2) / 6.5, 3, 2 / 13, "#b22234")),
    ],
    extra: <>
      <rect x="0" y="0" width="1.2" height="1.08" fill="#3c3b6e" />
      {Array.from({ length: 6 }, (_, c) =>
        Array.from({ length: 4 }, (_, l) =>
          <circle key={`${c}-${l}`} cx={0.13 + c * 0.19} cy={0.16 + l * 0.26} r="0.045" fill="#fff" />,
        ),
      )}
    </>,
  },
  MEX: {
    faixas: vertical("#006847", "#fff", "#ce1126"),
    extra: <circle cx="1.5" cy="1" r="0.2" fill="#8c6239" />,
  },
  COL: {
    faixas: [r(0, 0, 3, 1, "#fcd116"), r(0, 1, 3, 0.5, "#003893"), r(0, 1.5, 3, 0.5, "#ce1126")],
  },
  EQUADOR: {
    faixas: [r(0, 0, 3, 1, "#ffdd00"), r(0, 1, 3, 0.5, "#034ea2"), r(0, 1.5, 3, 0.5, "#ed1c24")],
    extra: <circle cx="1.5" cy="1" r="0.22" fill="#0f7a3d" stroke="#c8a12a" strokeWidth="0.06" />,
  },
  VENEZUELA: {
    faixas: horizontal("#ffcc00", "#00247d", "#cf142b"),
    extra: <>{Array.from({ length: 5 }, (_, i) =>
      estrela(1.5 + Math.cos(Math.PI * (1.15 + i * 0.175)) * 0.5, 1.0 + Math.sin(Math.PI * (1.15 + i * 0.175)) * 0.5, 0.075, "#fff", `ven${i}`),
    )}</>,
  },
  PERU: { faixas: vertical("#d91023", "#fff", "#d91023") },
  CHI: {
    faixas: [r(0, 0, 3, 1, "#fff"), r(0, 1, 3, 1, "#d52b1e"), r(0, 0, 1, 1, "#0039a6")],
    extra: estrela(0.5, 0.5, 0.3, "#fff", "chi"),
  },
  URU: {
    faixas: [
      r(0, 0, 3, 2, "#fff"),
      ...Array.from({ length: 4 }, (_, i) => r(0, 0.222 + i * 0.444, 3, 0.222, "#0038a8")),
      r(0, 0, 1.11, 1.11, "#fff"),
    ],
    extra: <circle cx="0.55" cy="0.55" r="0.3" fill="#fcd116" />,
  },
  BOLIVIA: { faixas: horizontal("#d52b1e", "#f9e300", "#007934") },
  PARAGUAI: {
    faixas: horizontal("#d52b1e", "#fff", "#0038a8"),
    extra: <circle cx="1.5" cy="1" r="0.2" fill="#fff" stroke="#0038a8" strokeWidth="0.05" />,
  },
  KSA: {
    faixas: [r(0, 0, 3, 2, "#006c35")],
    extra: <>
      <rect x="0.5" y="0.72" width="2" height="0.16" fill="#fff" rx="0.05" />
      <rect x="0.5" y="1.18" width="2" height="0.1" fill="#fff" rx="0.04" />
    </>,
  },
  JPN: {
    faixas: [r(0, 0, 3, 2, "#fff")],
    extra: <circle cx="1.5" cy="1" r="0.52" fill="#bc002d" />,
  },
  KOR: {
    faixas: [r(0, 0, 3, 2, "#fff")],
    extra: <>
      <path d="M1.5 0.55a0.45 0.45 0 0 1 0 0.9a0.225 0.225 0 0 0 0-0.45a0.225 0.225 0 0 1 0-0.45z" fill="#cd2e3a" />
      <path d="M1.5 0.55a0.45 0.45 0 0 0 0 0.9a0.225 0.225 0 0 1 0-0.45a0.225 0.225 0 0 0 0-0.45z" fill="#0047a0" />
      <path d="M1.5 0.55a0.45 0.45 0 0 1 0 0.9" fill="#cd2e3a" opacity="0" />
      <circle cx="1.5" cy="0.775" r="0.225" fill="#cd2e3a" />
      <circle cx="1.5" cy="1.225" r="0.225" fill="#0047a0" />
    </>,
  },
  CHN: {
    faixas: [r(0, 0, 3, 2, "#de2910")],
    extra: <>
      {estrela(0.55, 0.55, 0.28, "#ffde00", "chn0")}
      {estrela(1.05, 0.24, 0.1, "#ffde00", "chn1")}
      {estrela(1.28, 0.5, 0.1, "#ffde00", "chn2")}
      {estrela(1.28, 0.82, 0.1, "#ffde00", "chn3")}
      {estrela(1.05, 1.06, 0.1, "#ffde00", "chn4")}
    </>,
  },
  GRECIA: {
    faixas: [
      r(0, 0, 3, 2, "#fff"),
      ...Array.from({ length: 5 }, (_, i) => r(0, i * 0.444 + 0.222, 3, 0.222, "#0d5eaf")),
      r(0, 0, 1.11, 1.11, "#0d5eaf"),
    ],
    extra: <>
      <path d="M0 0.44h1.11v0.22H0z" fill="#fff" />
      <path d="M0.44 0h0.22v1.11h-0.22z" fill="#fff" />
    </>,
  },
  DINAMARCA: { faixas: [r(0, 0, 3, 2, "#c8102e")], extra: cruzNordica("#fff") },
  NORUEGA: { faixas: [r(0, 0, 3, 2, "#ba0c2f")], extra: cruzNordica("#fff", "#00205b") },
  SUECIA: { faixas: [r(0, 0, 3, 2, "#006aa7")], extra: cruzNordica("#fecc00") },
  TCHEQUIA: {
    faixas: [r(0, 0, 3, 1, "#fff"), r(0, 1, 3, 1, "#d7141a")],
    extra: <polygon points="0,0 1.2,1 0,2" fill="#11457e" />,
  },
  AZERBAIJAO: {
    faixas: horizontal("#0092bc", "#e8112d", "#00af66"),
    extra: <>
      <circle cx="1.4" cy="1" r="0.24" fill="#fff" />
      <circle cx="1.5" cy="1" r="0.19" fill="#e8112d" />
      {estrela(1.78, 1, 0.13, "#fff", "aze")}
    </>,
  },
  CHIPRE: {
    faixas: [r(0, 0, 3, 2, "#fff")],
    extra: <ellipse cx="1.5" cy="0.85" rx="0.55" ry="0.3" fill="#d57800" />,
  },
  CAZAQUISTAO: {
    faixas: [r(0, 0, 3, 2, "#00afca")],
    extra: <circle cx="1.6" cy="0.95" r="0.32" fill="#fec50c" />,
  },
  POLONIA: { faixas: [r(0, 0, 3, 1, "#fff"), r(0, 1, 3, 1, "#dc143c")] },
  AUSTRIA: { faixas: [r(0, 0, 3, 0.667, "#ed2939"), r(0, 0.667, 3, 0.666, "#fff"), r(0, 1.333, 3, 0.667, "#ed2939")] },
  SUICA: {
    faixas: [r(0, 0, 3, 2, "#d52b1e")],
    extra: <>
      <path d="M1.05 0.9h0.9v0.2h-0.9z" fill="#fff" />
      <path d="M1.4 0.55h0.2v0.9h-0.2z" fill="#fff" />
    </>,
  },
  CROACIA: { faixas: horizontal("#ff0000", "#fff", "#171796") },
  SERVIA: { faixas: horizontal("#c6363c", "#0c4076", "#fff") },
  UCRANIA: { faixas: [r(0, 0, 3, 1, "#0057b7"), r(0, 1, 3, 1, "#ffd700")] },
  ROMENIA: { faixas: vertical("#002b7f", "#fcd116", "#ce1126") },
  HUNGRIA: { faixas: horizontal("#ce2939", "#fff", "#477050") },
  IRLANDA: { faixas: vertical("#169b62", "#fff", "#ff883e") },
  MARROCOS: {
    faixas: [r(0, 0, 3, 2, "#c1272d")],
    extra: estrela(1.5, 1, 0.42, "#006233", "mar"),
  },

  // ── Países que aparecem no pool importado ────────────────────────────────
  // A medição sobre os 3.071 clubes do editor mostrou que estes ainda caíam na
  // sigla. Ordenados por quantos clubes cada um traz.
  GEORGIA: {
    faixas: [r(0, 0, 3, 2, "#fff")],
    extra: <>
      <path d="M0 0.85h3v0.3H0z" fill="#ff0000" />
      <path d="M1.35 0h0.3v2h-0.3z" fill="#ff0000" />
    </>,
  },
  ILHASFAROE: { faixas: [r(0, 0, 3, 2, "#fff")], extra: cruzNordica("#0065bd", "#ed2939") },
  LETONIA: { faixas: [r(0, 0, 3, 0.8, "#9e3039"), r(0, 0.8, 3, 0.4, "#fff"), r(0, 1.2, 3, 0.8, "#9e3039")] },
  IRA: {
    faixas: horizontal("#239f40", "#fff", "#da0000"),
    extra: <circle cx="1.5" cy="1" r="0.18" fill="#da0000" />,
  },
  LITUANIA: { faixas: horizontal("#fdb913", "#006a44", "#c1272d") },
  ESTONIA: { faixas: horizontal("#0072ce", "#000", "#fff") },
  CATAR: {
    faixas: [r(0, 0, 3, 2, "#8a1538"), r(0, 0, 0.9, 2, "#fff")],
  },
  BIELORRUSSIA: {
    faixas: [r(0, 0, 3, 1.35, "#c8313e"), r(0, 1.35, 3, 0.65, "#4aa657"), r(0, 0, 0.45, 2, "#fff")],
    extra: <path d="M0.1 0.2h0.25v0.25h-0.25zM0.1 0.9h0.25v0.25h-0.25zM0.1 1.6h0.25v0.25h-0.25z" fill="#c8313e" />,
  },
  BULGARIA: { faixas: horizontal("#fff", "#00966e", "#d62612") },
  EGITO: {
    faixas: horizontal("#ce1126", "#fff", "#000"),
    extra: <circle cx="1.5" cy="1" r="0.16" fill="#c09300" />,
  },
  ISRAEL: {
    faixas: [r(0, 0, 3, 2, "#fff"), r(0, 0.24, 3, 0.24, "#0038b8"), r(0, 1.52, 3, 0.24, "#0038b8")],
    extra: <>
      <polygon points="1.5,0.72 1.74,1.14 1.26,1.14" fill="none" stroke="#0038b8" strokeWidth="0.07" />
      <polygon points="1.5,1.28 1.26,0.86 1.74,0.86" fill="none" stroke="#0038b8" strokeWidth="0.07" />
    </>,
  },
  EMIRADOSARABESUNIDOS: {
    faixas: [r(0, 0, 0.75, 2, "#ce1126"), r(0.75, 0, 2.25, 0.667, "#009e49"), r(0.75, 0.667, 2.25, 0.666, "#fff"), r(0.75, 1.333, 2.25, 0.667, "#000")],
  },
  EMIRADOS: {
    faixas: [r(0, 0, 0.75, 2, "#ce1126"), r(0.75, 0, 2.25, 0.667, "#009e49"), r(0.75, 0.667, 2.25, 0.666, "#fff"), r(0.75, 1.333, 2.25, 0.667, "#000")],
  },
  FINLANDIA: { faixas: [r(0, 0, 3, 2, "#fff")], extra: cruzNordica("#003580") },
  MOLDAVIA: {
    faixas: vertical("#0046ae", "#ffd200", "#cc092f"),
    extra: <circle cx="1.5" cy="1" r="0.2" fill="#c8102e" opacity="0.65" />,
  },
  TUNISIA: {
    faixas: [r(0, 0, 3, 2, "#e70013")],
    extra: <>
      <circle cx="1.5" cy="1" r="0.5" fill="#fff" />
      <circle cx="1.45" cy="1" r="0.32" fill="#e70013" />
      <circle cx="1.58" cy="1" r="0.26" fill="#fff" />
      {estrela(1.62, 1, 0.16, "#e70013", "tun")}
    </>,
  },
  ESLOVAQUIA: {
    faixas: horizontal("#fff", "#0b4ea2", "#ee1c25"),
    extra: <path d="M0.75 0.6h0.5v0.6l-0.25 0.25l-0.25-0.25z" fill="#ee1c25" stroke="#fff" strokeWidth="0.07" />,
  },
  INDIA: {
    faixas: horizontal("#ff9933", "#fff", "#138808"),
    extra: <circle cx="1.5" cy="1" r="0.2" fill="none" stroke="#000080" strokeWidth="0.06" />,
  },
  BOSNIAEHERZEGOVINA: {
    faixas: [r(0, 0, 3, 2, "#002395")],
    extra: <polygon points="0.8,0.1 2.2,0.1 0.8,1.9" fill="#fecb00" />,
  },
  KOSOVO: {
    faixas: [r(0, 0, 3, 2, "#244aa5")],
    extra: <ellipse cx="1.5" cy="1.15" rx="0.5" ry="0.42" fill="#d0a650" />,
  },
  ARGELIA: {
    faixas: [r(0, 0, 1.5, 2, "#006233"), r(1.5, 0, 1.5, 2, "#fff")],
    extra: <>
      <circle cx="1.42" cy="1" r="0.4" fill="#d21034" />
      <circle cx="1.56" cy="1" r="0.33" fill="#fff" />
      {estrela(1.66, 1, 0.2, "#d21034", "arg-dz")}
    </>,
  },
  ARMENIA: { faixas: horizontal("#d90012", "#0033a0", "#f2a800") },
  ALBANIA: {
    faixas: [r(0, 0, 3, 2, "#e41e20")],
    extra: <path d="M1.1 0.7l0.4 0.2l0.4-0.2l-0.15 0.3l0.15 0.3l-0.4-0.2l-0.4 0.2l0.15-0.3z" fill="#000" />,
  },
  ISLANDIA: { faixas: [r(0, 0, 3, 2, "#02529c")], extra: cruzNordica("#fff", "#dc1e35") },
  NICARAGUA: {
    faixas: horizontal("#0067c6", "#fff", "#0067c6"),
    extra: <polygon points="1.5,0.82 1.72,1.2 1.28,1.2" fill="#c8a2c8" />,
  },
  PANAMA: {
    faixas: [r(0, 0, 1.5, 1, "#fff"), r(1.5, 0, 1.5, 1, "#da121a"), r(0, 1, 1.5, 1, "#072357"), r(1.5, 1, 1.5, 1, "#fff")],
    extra: <>{estrela(0.75, 0.5, 0.22, "#072357", "pan1")}{estrela(2.25, 1.5, 0.22, "#da121a", "pan2")}</>,
  },
  ZAMBIA: {
    faixas: [r(0, 0, 3, 2, "#198a00"), r(2.1, 0.7, 0.3, 1.3, "#ef7d00"), r(2.4, 0.7, 0.3, 1.3, "#000"), r(2.7, 0.7, 0.3, 1.3, "#de2010")],
    extra: <circle cx="2.55" cy="0.4" r="0.24" fill="#ef7d00" />,
  },
  UZBEQUISTAO: {
    faixas: [r(0, 0, 3, 0.62, "#0099b5"), r(0, 0.62, 3, 0.76, "#fff"), r(0, 1.38, 3, 0.62, "#1eb53a")],
    extra: <>
      <circle cx="0.5" cy="0.3" r="0.2" fill="#fff" />
      <circle cx="0.58" cy="0.3" r="0.16" fill="#0099b5" />
    </>,
  },
  LIBIA: {
    faixas: [r(0, 0, 3, 0.5, "#e70013"), r(0, 0.5, 3, 1, "#000"), r(0, 1.5, 3, 0.5, "#239e46")],
    extra: <>
      <circle cx="1.45" cy="1" r="0.2" fill="#fff" />
      <circle cx="1.53" cy="1" r="0.16" fill="#000" />
    </>,
  },
  AFRICADOSUL: {
    faixas: [r(0, 0, 3, 1, "#de3831"), r(0, 1, 3, 1, "#002395")],
    extra: <>
      <path d="M0 0.55 L1.1 1 L0 1.45z" fill="#007a4d" stroke="#fff" strokeWidth="0.12" />
      <path d="M0 0.75 L0.55 1 L0 1.25z" fill="#000" stroke="#ffb612" strokeWidth="0.1" />
    </>,
  },
  AUSTRALIA: {
    faixas: [r(0, 0, 3, 2, "#00008b")],
    extra: <>
      <rect x="0" y="0" width="1.5" height="1" fill="#00247d" />
      <path d="M0 0 L1.5 1 M1.5 0 L0 1 M0.75 0v1 M0 0.5h1.5" stroke="#fff" strokeWidth="0.16" />
      {estrela(2.3, 0.65, 0.2, "#fff", "aus1")}
      {estrela(0.75, 1.55, 0.16, "#fff", "aus2")}
    </>,
  },
  SENEGAL: {
    faixas: vertical("#00853f", "#fdef42", "#e31b23"),
    extra: estrela(1.5, 1, 0.24, "#00853f", "sen"),
  },
  MACEDONIADONORTE: {
    faixas: [r(0, 0, 3, 2, "#d20000")],
    extra: <>
      <circle cx="1.5" cy="1" r="0.32" fill="#ffe600" stroke="#d20000" strokeWidth="0.06" />
      <path d="M1.5 1 L0 0 M1.5 1 L3 0 M1.5 1 L0 2 M1.5 1 L3 2 M1.5 1 L1.5 0 M1.5 1 L1.5 2 M1.5 1 L0 1 M1.5 1 L3 1"
        stroke="#ffe600" strokeWidth="0.14" />
      <circle cx="1.5" cy="1" r="0.3" fill="#ffe600" stroke="#d20000" strokeWidth="0.06" />
    </>,
  },
  LUXEMBURGO: { faixas: horizontal("#ed2939", "#fff", "#00a1de") },
  PAISDEGALES: {
    faixas: [r(0, 0, 3, 1, "#fff"), r(0, 1, 3, 1, "#00ad3a")],
    extra: <path d="M0.9 1.15c0.25-0.45 0.7-0.5 1.05-0.25c0.2 0.14 0.35 0.05 0.5-0.05c-0.1 0.35-0.45 0.5-0.8 0.35c-0.28-0.12-0.5-0.05-0.75 0.2z" fill="#c8102e" />,
  },
  NIGERIA: { faixas: vertical("#008751", "#fff", "#008751") },
  GIBRALTAR: {
    faixas: [r(0, 0, 3, 1.35, "#fff"), r(0, 1.35, 3, 0.65, "#da000c")],
    extra: <path d="M1.2 0.4h0.6v0.75h-0.6z M1.1 0.55h0.15v0.6h-0.15z M1.75 0.55h0.15v0.6h-0.15z" fill="#da000c" />,
  },
}

/**
 * Nome em português -> chave do desenho.
 *
 * O diretório do editor mistura DOIS jeitos de identificar país: as ligas
 * oficiais usam a sigla de três letras (`DIV_COUNTRY`) e os clubes do pool
 * importado usam o nome (`PAIS_CODE[pais] ?? pais`). Sem estes apelidos, um
 * grupo "Alemanha" não acharia a bandeira que está cadastrada como "GER".
 */
const APELIDOS: Record<string, string> = {
  BRASIL: "BRA", INGLATERRA: "ENG", ESPANHA: "ESP", ITALIA: "ITA",
  ALEMANHA: "GER", FRANCA: "FRA", PORTUGAL: "POR", HOLANDA: "NED",
  PAISESBAIXOS: "NED", ESCOCIA: "SCO", TURQUIA: "TUR", BELGICA: "BEL",
  RUSSIA: "RUS", ESTADOSUNIDOS: "USA", MEXICO: "MEX", ARGENTINA: "ARG",
  COLOMBIA: "COL", CHILE: "CHI", URUGUAI: "URU", ARABIASAUDITA: "KSA",
  JAPAO: "JPN", COREIADOSUL: "KOR", CHINA: "CHN",
}

/** Chave de busca: sem acento, sem espaço, maiúscula. */
function chaveDe(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase()
}

/**
 * Bandeira do país.
 *
 * `codigo` aceita tanto a sigla de três letras usada no editor (BRA, ARG, KSA)
 * quanto o NOME do país em português (Equador, Bolívia, Tchéquia) — o diretório
 * usa os dois, porque país sem sigla no mapa vira grupo pelo próprio nome.
 */
export function BandeiraPais({
  codigo,
  className,
  titulo,
}: {
  codigo: string
  className?: string
  titulo?: string
}) {
  const k = chaveDe(codigo)
  const bandeira = BANDEIRAS[k] ?? BANDEIRAS[APELIDOS[k] ?? ""]

  // SELEÇÕES e INTERNACIONAL não são países: um globo diz mais que uma bandeira.
  if (!bandeira) {
    const globo = k === "SEL" || k === "INT"
    if (globo) {
      return (
        <svg viewBox={VB} className={cn("shrink-0 rounded-[1px]", className)} aria-hidden focusable="false">
          <rect x="0" y="0" width="3" height="2" fill="#12303a" />
          <circle cx="1.5" cy="1" r="0.62" fill="none" stroke="#5fd6c0" strokeWidth="0.12" />
          <ellipse cx="1.5" cy="1" rx="0.3" ry="0.62" fill="none" stroke="#5fd6c0" strokeWidth="0.1" />
          <path d="M0.88 1h1.24" stroke="#5fd6c0" strokeWidth="0.1" />
        </svg>
      )
    }
    // País sem bandeira desenhada: mantém o comportamento antigo (a sigla).
    return (
      <span
        className={cn("shrink-0 text-[8px] font-bold uppercase tracking-wider text-white/30", className)}
        title={titulo}
      >
        {codigo.slice(0, 3)}
      </span>
    )
  }

  return (
    <svg
      viewBox={VB}
      className={cn("shrink-0 rounded-[1px] ring-1 ring-black/40", className)}
      role="img"
      aria-label={titulo ? `Bandeira de ${titulo}` : undefined}
    >
      {bandeira.faixas.map((f, i) => (
        <rect key={i} x={f.x} y={f.y} width={f.w} height={f.h} fill={f.fill} />
      ))}
      {bandeira.extra}
    </svg>
  )
}
