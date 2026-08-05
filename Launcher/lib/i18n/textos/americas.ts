// Américas e Pacífico: crioulo haitiano, línguas originárias e polinésias.
import type { PacoteDeIdioma } from "../catalogo"

const ht: PacoteDeIdioma = {
  "nav.inicio": "Akèy", "nav.loja": "Boutik", "nav.novidades": "Nouvèl",
  "nav.gerenciar": "Jere", "nav.subtitulo": "Jere, mete ajou epi jwe",
  "conta.entrar": "Konekte", "conta.sair": "Dekonekte",
  "rede.online": "An liy", "rede.offline": "Deconekte",
  "acao.instalar": "Enstale", "acao.atualizar": "Mete ajou kounye a",
  "acao.jogarOnline": "Jwe an liy", "acao.jogarOffline": "Jwe san entènèt",
  "acao.reparar": "Repare", "acao.verificar": "Verifye fichye yo",
  "acao.pausar": "Kanpe", "acao.retomar": "Kontinye", "acao.cancelar": "Anile",
  "acao.fechar": "Fèmen", "baixar.baixando": "Ap telechaje",
  "gerenciar.desinstalar": "Dezenstale", "conf.titulo": "Paramèt", "conf.idioma": "Lang",
}

const qu: PacoteDeIdioma = {
  "nav.inicio": "Qallariy", "nav.loja": "Qhatu", "nav.novidades": "Musuq willakuy",
  "conta.entrar": "Yaykuy", "conta.sair": "Lloqsiy",
  "acao.instalar": "Churay", "acao.atualizar": "Kunan musuqchay",
  "acao.jogarOnline": "Internetpi pukllay", "acao.jogarOffline": "Mana internetwan pukllay",
  "acao.fechar": "Wichqay", "conf.titulo": "Allichaykuna", "conf.idioma": "Simi",
}

const gn: PacoteDeIdioma = {
  "nav.inicio": "Ñepyrũha", "nav.loja": "Ñemuha", "nav.novidades": "Marandu",
  "conta.entrar": "Eike", "conta.sair": "Ésẽ",
  "acao.instalar": "Emohenda", "acao.atualizar": "Embohekopyahu ko'ág̃a",
  "acao.jogarOnline": "Eñembosarái internet-pe", "acao.fechar": "Emboty",
  "conf.titulo": "Ñemohenda", "conf.idioma": "Ñe'ẽ",
}

const ay: PacoteDeIdioma = {
  "nav.inicio": "Qalltawi", "nav.loja": "Aljasiña uta", "nav.novidades": "Machaq yatiyawi",
  "conta.entrar": "Mantaña", "acao.instalar": "Uchaña",
  "acao.jogarOnline": "Internetan anataña", "acao.fechar": "Jistantaña",
  "conf.titulo": "Wakichawi", "conf.idioma": "Aru",
}

const mi: PacoteDeIdioma = {
  "nav.inicio": "Kāinga", "nav.loja": "Toa", "nav.novidades": "Karere",
  "nav.gerenciar": "Whakahaere", "conta.entrar": "Takiuru", "conta.sair": "Takiputa",
  "rede.online": "Tuihono", "rede.offline": "Tuimotu",
  "acao.instalar": "Tāuta", "acao.atualizar": "Whakahou ināianei",
  "acao.jogarOnline": "Tākaro tuihono", "acao.jogarOffline": "Tākaro tuimotu",
  "acao.fechar": "Katia", "baixar.baixando": "E tikiake ana",
  "gerenciar.desinstalar": "Wetehanga", "conf.titulo": "Tautuhinga", "conf.idioma": "Reo",
}

const haw: PacoteDeIdioma = {
  "nav.inicio": "Home", "nav.loja": "Hale kūʻai", "nav.novidades": "Nūhou",
  "conta.entrar": "E komo", "conta.sair": "E puka",
  "acao.instalar": "Hoʻokomo", "acao.atualizar": "Hoʻohou i kēia manawa",
  "acao.jogarOnline": "Pāʻani pūnaewele", "acao.fechar": "Pani",
  "conf.titulo": "Hoʻonohonoho", "conf.idioma": "ʻŌlelo",
}

const sm: PacoteDeIdioma = {
  "nav.inicio": "Fale", "nav.loja": "Faleoloa", "nav.novidades": "Tala fou",
  "conta.entrar": "Saini i totonu", "conta.sair": "Saini i fafo",
  "acao.instalar": "Faʻapipiʻi", "acao.atualizar": "Faʻafou nei",
  "acao.jogarOnline": "Taʻalo i luga ole laiga", "acao.fechar": "Tapuni",
  "conf.titulo": "Faʻatulagaga", "conf.idioma": "Gagana",
}

const to: PacoteDeIdioma = {
  "nav.inicio": "ʻApi", "nav.loja": "Falekoloa", "nav.novidades": "Ongoongo",
  "conta.entrar": "Hū ki loto", "conta.sair": "Hū ki tuʻa",
  "acao.instalar": "Fokotuʻu", "acao.atualizar": "Fakafoʻou he taimi ni",
  "acao.jogarOnline": "Vaʻinga ʻi he ʻinitaneti", "acao.fechar": "Tāpuni",
  "conf.titulo": "Ngaahi tuʻutuʻuni", "conf.idioma": "Lea",
}

const fj: PacoteDeIdioma = {
  "nav.inicio": "Itabatuba", "nav.loja": "Sitoa", "nav.novidades": "Itukutuku",
  "conta.entrar": "Curu", "conta.sair": "Lako tani",
  "acao.instalar": "Vakayacora", "acao.atualizar": "Vakavoui edaidai",
  "acao.jogarOnline": "Qito ena livaliva", "acao.fechar": "Sogota",
  "conf.titulo": "Ituvatuva", "conf.idioma": "Vosa",
}

const PACOTES: Record<string, PacoteDeIdioma> = { ht, qu, gn, ay, mi, haw, sm, to, fj }

export default PACOTES
