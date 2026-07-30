// URL do Ultrafoot 26 hospedado (versão web). O app mobile carrega ESTE endereço
// dentro de um WebView — é a "cópia perfeita" do jogo de PC.
//
// ⚠️ ISTO JÁ APONTOU PARA UMA MÁQUINA MORTA. Até 29/07/2026 o valor era
// `ultrafoot.72-61-145-52.sslip.io`, a VPS antiga, desligada em 28/07 — o app
// abria e não carregava nada, sem dizer o porquê. Enquanto não houver domínio
// próprio, trocar a VPS de endereço exige mexer aqui e gerar APK novo.
//
// O SAVE NA NUVEM DEPENDE DESTE ENDEREÇO: o jogo chama `/save/...` relativo, e
// quem responde é o nginx desta mesma origem. Apontar o WebView para um host sem
// o cloud-save-server atrás faz o salvamento parar de funcionar em silêncio.
export const GAME_URL = "https://ultrafoot.179-198-103-30.sslip.io"
