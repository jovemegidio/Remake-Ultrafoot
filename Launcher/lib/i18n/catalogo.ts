/**
 * CATÁLOGO DE TEXTOS DO LAUNCHER.
 *
 * O português é a FONTE: as chaves nascem aqui, e o tipo `Chave` sai deste
 * objeto. Um pacote de idioma que esqueça uma chave não quebra nada (cai na
 * cadeia de reserva), mas um pacote que INVENTE uma chave é erro de tipo — que é
 * exatamente onde esse erro precisa aparecer, e não na tela do jogador.
 *
 * Regras que valem para todo pacote novo:
 *   • nada de concatenar frase em pedaços: use `{}` para o valor variável, senão
 *     idiomas com ordem de palavras diferente ficam impossíveis de traduzir;
 *   • texto curto — botão de launcher tem largura fixa, e alemão/finlandês
 *     ocupam bem mais espaço que português;
 *   • "Ultrafoot 26" e "FC Hub" são nomes próprios: não se traduzem.
 */

export const PT_BR = {
  // ── Navegação ──
  "nav.inicio": "Início",
  "nav.loja": "Loja",
  "nav.novidades": "Novidades",
  "nav.hub": "FC Hub",
  "nav.changelog": "Changelog",
  "nav.seguranca": "Segurança",
  "nav.gerenciar": "Gerenciar",
  "nav.subtitulo": "Gerencie, atualize e jogue",
  "nav.centro": "Game Center",

  // ── Conta ──
  "conta.entrar": "Entrar",
  "conta.sair": "Sair da conta",
  "conta.beneficios": "Compras e progresso",

  // ── Estado da conexão ──
  "rede.online": "Online",
  "rede.offline": "Offline",
  "rede.anticheat": "Anti-cheat ativo",
  "rede.edicaoLiberada": "Edição liberada",

  // ── Botões principais ──
  "acao.instalar": "Instalar",
  "acao.entrarParaInstalar": "Entrar para instalar",
  "acao.atualizar": "Atualizar agora",
  "acao.jogarOnline": "Jogar Online",
  "acao.jogarOffline": "Jogar Offline",
  "acao.jogando": "Jogando",
  "acao.parar": "Parar",
  "acao.reparar": "Reparar",
  "acao.verificar": "Verificar arquivos",
  "acao.pausar": "Pausar",
  "acao.retomar": "Retomar",
  "acao.cancelar": "Cancelar",
  "acao.concluido": "Concluído",
  "acao.fechar": "Fechar",

  // ── Download ──
  "baixar.baixando": "Baixando",
  "baixar.atualizando": "Atualizando",
  "baixar.instalando": "Instalando",
  "baixar.conferindo": "Conferindo arquivos",
  "baixar.aplicando": "Aplicando atualização",
  "baixar.pausado": "Pausado",
  "baixar.requisitos": "Verificando requisitos do Windows",
  "baixar.restantes": "{tempo} restantes",
  "baixar.tamanho": "Tamanho: {tamanho}",
  "baixar.semInternet": "Sem internet para baixar",
  "baixar.obrigatoria": "Atualização obrigatória ({tamanho}) — o launcher está baixando sozinho.",
  "baixar.rapida": "Atualização rápida: {baixado} em vez de {completo}",
  "baixar.semEspaco": "Espaço insuficiente no disco",

  // ── Gerenciar ──
  "gerenciar.pasta": "Pasta do jogo",
  "gerenciar.escolherPasta": "Escolher pasta",
  "gerenciar.espacoLivre": "{espaco} livres",
  "gerenciar.limite": "Limite de velocidade",
  "gerenciar.semLimite": "Sem limite",
  "gerenciar.tempoDeJogo": "Tempo de jogo",
  "gerenciar.ultimaVez": "Jogou pela última vez",
  "gerenciar.nunca": "Nunca",
  "gerenciar.sessoes": "{n} sessões",
  "gerenciar.horas": "{h} h {m} min",
  "gerenciar.arquivosOk": "Todos os arquivos estão certos.",
  "gerenciar.arquivosRuins": "{n} arquivos com problema.",
  "gerenciar.desinstalar": "Desinstalar",
  "gerenciar.desinstalarAviso": "O jogo é removido do computador. Seus saves e sua conta continuam.",
  "gerenciar.atalho": "Criar atalho na área de trabalho",
  "gerenciar.canal": "Canal de atualização",
  "gerenciar.estavel": "Estável",
  "gerenciar.beta": "Beta",
  "gerenciar.betaAviso": "O beta recebe as versões antes de todo mundo — e os defeitos delas também.",
  "gerenciar.logs": "Abrir pasta de logs",
  "gerenciar.diagnostico": "Gerar diagnóstico",
  "gerenciar.diagnosticoPronto": "Diagnóstico salvo em {caminho}",

  // ── Configurações ──
  "conf.titulo": "Configurações",
  "conf.geral": "Geral",
  "conf.aparencia": "Aparência",
  "conf.acessibilidade": "Acessibilidade",
  "conf.perfil": "Perfil",
  "conf.idioma": "Idioma",
  "conf.idiomaAjuda": "Muda o launcher. O jogo tem o idioma dele.",
  "conf.iniciarComWindows": "Iniciar com o Windows",
  "conf.bandeja": "Minimizar para a bandeja ao fechar",
  "conf.aoAbrirOJogo": "Ao abrir o jogo",
  "conf.esconder": "Esconder na bandeja",
  "conf.minimizar": "Minimizar",
  "conf.fecharLauncher": "Fechar o launcher",
  "conf.naoFazerNada": "Deixar a janela aberta",
  "conf.tema": "Tema",
  "conf.fonte": "Fonte",
  "conf.tamanhoDoTexto": "Tamanho do texto",
  "conf.altoContraste": "Alto contraste",
  "conf.reduzirAnimacoes": "Reduzir animações",

  // ── Atualização do launcher ──
  "launcher.atualizando": "Atualizando o launcher",
  "launcher.novaVersao": "Nova versão {versao}. O launcher vai reiniciar em instantes.",
  "launcher.semAtualizar": "Jogar sem atualizar agora",
  "launcher.falhou": "Não consegui instalar a atualização do launcher. Você pode continuar jogando normalmente.",

  // ── Sair do launcher ──
  "sair.titulo": "Fechar o launcher?",
  "sair.texto": "Você realmente deseja fechar o Ultrafoot Launcher?",
  "sair.confirmar": "Sim, fechar",
  "sair.bandeja": "Só minimizar para a bandeja",
  "sair.avisoDownload": "O download em andamento vai parar.",
  "sair.avisoJogo": "O jogo continua aberto, mas o launcher para de acompanhar a partida.",

  // ── Avisos ──
  "aviso.jogoCaiu": "O jogo fechou inesperadamente. Verificar os arquivos costuma resolver.",
  "aviso.fecheOJogo": "Feche o jogo antes de continuar.",
} as const

export type Chave = keyof typeof PT_BR
export type Catalogo = Record<Chave, string>
/** Pacote de idioma: pode traduzir tudo ou só parte (o resto cai na reserva). */
export type PacoteDeIdioma = Partial<Catalogo>
