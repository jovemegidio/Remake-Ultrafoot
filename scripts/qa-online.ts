import { GAME_DATA_HASH, GAME_DATA_VERSION, ONLINE_GAME_VERSION, ONLINE_PROTOCOL_VERSION } from "../lib/online-multiplayer"

// A versao do protocolo e deliberadamente independente da build: atualizar o
// executavel sem mudar o formato das mensagens nao pode expulsar jogadores de
// salas antigas. ONLINE_GAME_VERSION e apenas o alias legado exibido no FC Hub.
if (ONLINE_GAME_VERSION !== ONLINE_PROTOCOL_VERSION) throw new Error(`Alias de rede ${ONLINE_GAME_VERSION} diverge do protocolo ${ONLINE_PROTOCOL_VERSION}`)
if (!/^\d+\.\d+\.\d+$/.test(ONLINE_PROTOCOL_VERSION)) throw new Error("Versao do protocolo invalida")
if (!/^\d{4}\.\d{2}\.\d{2}$/.test(GAME_DATA_VERSION)) throw new Error("Versao do banco invalida")
if (!/^[a-f0-9]{16}$/.test(GAME_DATA_HASH)) throw new Error("Hash do banco invalido")
console.log(`OK multiplayer: protocolo ${ONLINE_PROTOCOL_VERSION}, dados ${GAME_DATA_VERSION}, hash ${GAME_DATA_HASH}`)
