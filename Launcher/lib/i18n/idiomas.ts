/**
 * OS IDIOMAS QUE O LAUNCHER OFERECE.
 *
 * Cada entrada traz o nome NO PRÓPRIO IDIOMA. Quem procura japonês procura por
 * 日本語, não por "Japanese" — uma lista escrita toda em português (ou toda em
 * inglês) é inútil justamente para quem precisa dela.
 *
 * `rtl` marca escrita da direita para a esquerda. Não é detalhe cosmético: sem
 * virar a direção do documento, a interface inteira fica com a barra lateral do
 * lado errado e os ícones apontando ao contrário do texto.
 *
 * Um idioma listado aqui SEMPRE funciona, mesmo sem pacote completo: o que
 * faltar cai na cadeia de reserva (idioma base → inglês → português). É de
 * propósito — vale mais um launcher 60% traduzido do que um idioma ausente.
 */

export interface Idioma {
  /** Código BCP-47. É a chave de tudo: pacote, `lang` do HTML e preferência. */
  codigo: string
  /** Nome no próprio idioma. */
  nativo: string
  /** Nome em português, para o suporte e para a busca do seletor. */
  pt: string
  rtl?: boolean
}

export const IDIOMAS: Idioma[] = [
  // ── Português e vizinhos ──
  { codigo: "pt-BR", nativo: "Português (Brasil)", pt: "Português (Brasil)" },
  { codigo: "pt", nativo: "Português (Portugal)", pt: "Português (Portugal)" },
  { codigo: "gl", nativo: "Galego", pt: "Galego" },

  // ── Inglês e espanhol ──
  { codigo: "en", nativo: "English", pt: "Inglês" },
  { codigo: "en-GB", nativo: "English (UK)", pt: "Inglês (Reino Unido)" },
  { codigo: "es", nativo: "Español", pt: "Espanhol" },
  { codigo: "es-MX", nativo: "Español (México)", pt: "Espanhol (México)" },
  { codigo: "es-AR", nativo: "Español (Argentina)", pt: "Espanhol (Argentina)" },

  // ── Europa ocidental ──
  { codigo: "fr", nativo: "Français", pt: "Francês" },
  { codigo: "de", nativo: "Deutsch", pt: "Alemão" },
  { codigo: "it", nativo: "Italiano", pt: "Italiano" },
  { codigo: "nl", nativo: "Nederlands", pt: "Neerlandês" },
  { codigo: "ca", nativo: "Català", pt: "Catalão" },
  { codigo: "eu", nativo: "Euskara", pt: "Basco" },
  { codigo: "ast", nativo: "Asturianu", pt: "Asturiano" },
  { codigo: "oc", nativo: "Occitan", pt: "Occitano" },
  { codigo: "co", nativo: "Corsu", pt: "Corso" },
  { codigo: "br", nativo: "Brezhoneg", pt: "Bretão" },
  { codigo: "lb", nativo: "Lëtzebuergesch", pt: "Luxemburguês" },
  { codigo: "mt", nativo: "Malti", pt: "Maltês" },
  { codigo: "cy", nativo: "Cymraeg", pt: "Galês" },
  { codigo: "ga", nativo: "Gaeilge", pt: "Irlandês" },
  { codigo: "gd", nativo: "Gàidhlig", pt: "Gaélico escocês" },

  // ── Nórdicos e bálticos ──
  { codigo: "sv", nativo: "Svenska", pt: "Sueco" },
  { codigo: "da", nativo: "Dansk", pt: "Dinamarquês" },
  { codigo: "nb", nativo: "Norsk bokmål", pt: "Norueguês (bokmål)" },
  { codigo: "nn", nativo: "Nynorsk", pt: "Norueguês (nynorsk)" },
  { codigo: "fi", nativo: "Suomi", pt: "Finlandês" },
  { codigo: "is", nativo: "Íslenska", pt: "Islandês" },
  { codigo: "fo", nativo: "Føroyskt", pt: "Feroês" },
  { codigo: "et", nativo: "Eesti", pt: "Estoniano" },
  { codigo: "lv", nativo: "Latviešu", pt: "Letão" },
  { codigo: "lt", nativo: "Lietuvių", pt: "Lituano" },

  // ── Europa central e oriental ──
  { codigo: "pl", nativo: "Polski", pt: "Polonês" },
  { codigo: "cs", nativo: "Čeština", pt: "Tcheco" },
  { codigo: "sk", nativo: "Slovenčina", pt: "Eslovaco" },
  { codigo: "hu", nativo: "Magyar", pt: "Húngaro" },
  { codigo: "ro", nativo: "Română", pt: "Romeno" },
  { codigo: "bg", nativo: "Български", pt: "Búlgaro" },
  { codigo: "sr", nativo: "Српски", pt: "Sérvio" },
  { codigo: "hr", nativo: "Hrvatski", pt: "Croata" },
  { codigo: "bs", nativo: "Bosanski", pt: "Bósnio" },
  { codigo: "sl", nativo: "Slovenščina", pt: "Esloveno" },
  { codigo: "mk", nativo: "Македонски", pt: "Macedônio" },
  { codigo: "sq", nativo: "Shqip", pt: "Albanês" },
  { codigo: "el", nativo: "Ελληνικά", pt: "Grego" },
  { codigo: "ru", nativo: "Русский", pt: "Russo" },
  { codigo: "uk", nativo: "Українська", pt: "Ucraniano" },
  { codigo: "be", nativo: "Беларуская", pt: "Bielorrusso" },

  // ── Cáucaso, Ásia central e Turquia ──
  { codigo: "tr", nativo: "Türkçe", pt: "Turco" },
  { codigo: "az", nativo: "Azərbaycan", pt: "Azerbaijano" },
  { codigo: "ka", nativo: "ქართული", pt: "Georgiano" },
  { codigo: "hy", nativo: "Հայերեն", pt: "Armênio" },
  { codigo: "kk", nativo: "Қазақша", pt: "Cazaque" },
  { codigo: "ky", nativo: "Кыргызча", pt: "Quirguiz" },
  { codigo: "uz", nativo: "Oʻzbekcha", pt: "Uzbeque" },
  { codigo: "tg", nativo: "Тоҷикӣ", pt: "Tadjique" },
  { codigo: "tk", nativo: "Türkmençe", pt: "Turcomano" },
  { codigo: "tt", nativo: "Татарча", pt: "Tártaro" },
  { codigo: "ba", nativo: "Башҡортса", pt: "Basquir" },
  { codigo: "cv", nativo: "Чӑвашла", pt: "Tchuvache" },
  { codigo: "mn", nativo: "Монгол", pt: "Mongol" },

  // ── Escrita da direita para a esquerda ──
  { codigo: "ar", nativo: "العربية", pt: "Árabe", rtl: true },
  { codigo: "he", nativo: "עברית", pt: "Hebraico", rtl: true },
  { codigo: "fa", nativo: "فارسی", pt: "Persa", rtl: true },
  { codigo: "ur", nativo: "اردو", pt: "Urdu", rtl: true },
  { codigo: "ps", nativo: "پښتو", pt: "Pashto", rtl: true },
  { codigo: "ckb", nativo: "کوردیی ناوەندی", pt: "Curdo central", rtl: true },
  { codigo: "sd", nativo: "سنڌي", pt: "Sindi", rtl: true },
  { codigo: "ku", nativo: "Kurdî", pt: "Curdo (kurmanji)" },

  // ── Sul da Ásia ──
  { codigo: "hi", nativo: "हिन्दी", pt: "Híndi" },
  { codigo: "bn", nativo: "বাংলা", pt: "Bengali" },
  { codigo: "pa", nativo: "ਪੰਜਾਬੀ", pt: "Panjabi" },
  { codigo: "gu", nativo: "ગુજરાતી", pt: "Guzerate" },
  { codigo: "mr", nativo: "मराठी", pt: "Marata" },
  { codigo: "ta", nativo: "தமிழ்", pt: "Tâmil" },
  { codigo: "te", nativo: "తెలుగు", pt: "Télugo" },
  { codigo: "kn", nativo: "ಕನ್ನಡ", pt: "Canarim" },
  { codigo: "ml", nativo: "മലയാളം", pt: "Malaiala" },
  { codigo: "or", nativo: "ଓଡ଼ିଆ", pt: "Oriá" },
  { codigo: "as", nativo: "অসমীয়া", pt: "Assamês" },
  { codigo: "ne", nativo: "नेपाली", pt: "Nepalês" },
  { codigo: "si", nativo: "සිංහල", pt: "Cingalês" },

  // ── Sudeste asiático ──
  { codigo: "id", nativo: "Bahasa Indonesia", pt: "Indonésio" },
  { codigo: "ms", nativo: "Bahasa Melayu", pt: "Malaio" },
  { codigo: "jv", nativo: "Basa Jawa", pt: "Javanês" },
  { codigo: "su", nativo: "Basa Sunda", pt: "Sundanês" },
  { codigo: "tl", nativo: "Filipino", pt: "Filipino" },
  { codigo: "ceb", nativo: "Cebuano", pt: "Cebuano" },
  { codigo: "vi", nativo: "Tiếng Việt", pt: "Vietnamita" },
  { codigo: "th", nativo: "ไทย", pt: "Tailandês" },
  { codigo: "lo", nativo: "ລາວ", pt: "Laosiano" },
  { codigo: "km", nativo: "ខ្មែរ", pt: "Khmer" },
  { codigo: "my", nativo: "မြန်မာ", pt: "Birmanês" },

  // ── Leste asiático ──
  { codigo: "zh-CN", nativo: "简体中文", pt: "Chinês simplificado" },
  { codigo: "zh-TW", nativo: "繁體中文", pt: "Chinês tradicional" },
  { codigo: "yue", nativo: "粵語", pt: "Cantonês" },
  { codigo: "ja", nativo: "日本語", pt: "Japonês" },
  { codigo: "ko", nativo: "한국어", pt: "Coreano" },

  // ── África ──
  { codigo: "af", nativo: "Afrikaans", pt: "Africâner" },
  { codigo: "sw", nativo: "Kiswahili", pt: "Suaíli" },
  { codigo: "am", nativo: "አማርኛ", pt: "Amárico" },
  { codigo: "ti", nativo: "ትግርኛ", pt: "Tigrínia" },
  { codigo: "so", nativo: "Soomaali", pt: "Somali" },
  { codigo: "ha", nativo: "Hausa", pt: "Hauçá" },
  { codigo: "yo", nativo: "Yorùbá", pt: "Iorubá" },
  { codigo: "ig", nativo: "Igbo", pt: "Igbo" },
  { codigo: "zu", nativo: "isiZulu", pt: "Zulu" },
  { codigo: "xh", nativo: "isiXhosa", pt: "Xhosa" },
  { codigo: "st", nativo: "Sesotho", pt: "Soto do sul" },
  { codigo: "sn", nativo: "Shona", pt: "Xona" },
  { codigo: "rw", nativo: "Kinyarwanda", pt: "Quiniaruanda" },
  { codigo: "ny", nativo: "Chichewa", pt: "Chicheua" },
  { codigo: "mg", nativo: "Malagasy", pt: "Malgaxe" },
  { codigo: "wo", nativo: "Wolof", pt: "Uolofe" },

  // ── Américas e Pacífico ──
  { codigo: "ht", nativo: "Kreyòl ayisyen", pt: "Crioulo haitiano" },
  { codigo: "qu", nativo: "Runa Simi", pt: "Quíchua" },
  { codigo: "gn", nativo: "Avañe'ẽ", pt: "Guarani" },
  { codigo: "ay", nativo: "Aymar aru", pt: "Aimará" },
  { codigo: "mi", nativo: "Te Reo Māori", pt: "Maori" },
  { codigo: "haw", nativo: "ʻŌlelo Hawaiʻi", pt: "Havaiano" },
  { codigo: "sm", nativo: "Gagana Sāmoa", pt: "Samoano" },
  { codigo: "to", nativo: "Lea faka-Tonga", pt: "Tonganês" },
  { codigo: "fj", nativo: "Na Vosa Vakaviti", pt: "Fijiano" },

  // ── Construídas e clássicas ──
  { codigo: "eo", nativo: "Esperanto", pt: "Esperanto" },
  { codigo: "la", nativo: "Latina", pt: "Latim" },
]

export const IDIOMA_PADRAO = "pt-BR"

export function acharIdioma(codigo: string): Idioma | undefined {
  return IDIOMAS.find((i) => i.codigo.toLowerCase() === codigo.toLowerCase())
}

export function ehRtl(codigo: string): boolean {
  return acharIdioma(codigo)?.rtl === true
}

/**
 * Melhor idioma para quem abre o launcher pela primeira vez.
 *
 * Tenta o código completo do sistema ("pt-BR"), depois só a língua ("pt"), e por
 * último cai no português. `navigator.languages` vem em ordem de preferência —
 * respeitar essa ordem é a diferença entre acertar e chutar.
 */
export function idiomaDoSistema(): string {
  if (typeof navigator === "undefined") return IDIOMA_PADRAO
  const candidatos = [...(navigator.languages ?? []), navigator.language].filter(Boolean)
  for (const bruto of candidatos) {
    const codigo = String(bruto)
    if (acharIdioma(codigo)) return acharIdioma(codigo)!.codigo
    const base = codigo.split("-")[0]
    const porBase = IDIOMAS.find((i) => i.codigo === base) ?? IDIOMAS.find((i) => i.codigo.split("-")[0] === base)
    if (porBase) return porBase.codigo
  }
  return IDIOMA_PADRAO
}
