import packageJson from "../package.json"
import { GAME_DATA_HASH, GAME_DATA_VERSION, ONLINE_GAME_VERSION } from "../lib/online-multiplayer"

if (ONLINE_GAME_VERSION !== packageJson.version) throw new Error(`Versao de rede ${ONLINE_GAME_VERSION} diverge da build ${packageJson.version}`)
if (!/^\d{4}\.\d{2}\.\d{2}$/.test(GAME_DATA_VERSION)) throw new Error("Versao do banco invalida")
if (!/^[a-f0-9]{16}$/.test(GAME_DATA_HASH)) throw new Error("Hash do banco invalido")
console.log(`OK multiplayer: build ${ONLINE_GAME_VERSION}, dados ${GAME_DATA_VERSION}, hash ${GAME_DATA_HASH}`)
