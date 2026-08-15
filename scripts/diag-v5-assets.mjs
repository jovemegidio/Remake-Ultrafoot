// Diagnóstico do Pitch Engine V5: reproduz o caminho de assets FORA do navegador.
//
// O 3D quebrou da 1.0.312 à 1.0.314 e a conclusão registrada foi "diagnosticar
// em build de desenvolvimento". Isto é mais barato: GLTFLoader.parse e
// SkeletonUtils.clone não precisam de WebGL, e são exatamente os dois passos que
// o motor faz antes de qualquer render.
import { readFileSync } from "node:fs"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js"
import * as THREE from "three"

const carregar = (caminho) => new Promise((resolve, reject) => {
  const buf = readFileSync(caminho)
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  new GLTFLoader().parse(ab, "", resolve, reject)
})

const player = await carregar("public/assets/futebol/players/player.glb")
const motion = await carregar("public/assets/futebol/animations/football_motion.glb")

console.log("player.glb  -> scene:", Boolean(player.scene), "| animations:", player.animations.length)
let skinned = 0, meshes = 0
player.scene.traverse(o => { if (o.isSkinnedMesh) skinned++; else if (o.isMesh) meshes++ })
console.log("            -> SkinnedMesh:", skinned, "| Mesh comum:", meshes)
console.log("            -> tem 'Chest'?", Boolean(player.scene.getObjectByName("Chest")))
console.log("motion.glb  -> clipes:", motion.animations.map(a => a.name).join(", "))

// 1) O clone que o motor usa para cada um dos 22 jogadores.
try {
  const copia = cloneSkinned(player.scene)
  console.log("\nSkeletonUtils.clone: OK (", copia.children.length, "filhos )")
} catch (e) {
  console.log("\nSkeletonUtils.clone: FALHOU ->", e.constructor.name, e.message)
}

// 2) O mixer com os clipes do OUTRO arquivo — é aqui que a falta de skin importa:
//    os clipes referenciam ossos por nome, e sem binding não há o que animar.
try {
  const copia = cloneSkinned(player.scene)
  const mixer = new THREE.AnimationMixer(copia)
  let acoes = 0, semAlvo = 0
  for (const clip of motion.animations) {
    const acao = mixer.clipAction(clip)
    acao.play()
    acoes++
    // Uma trilha sem alvo no modelo é o sintoma silencioso: o clipe existe,
    // toca, e nada se move.
    for (const track of clip.tracks) {
      const nome = track.name.split(".")[0]
      if (!copia.getObjectByName(nome)) { semAlvo++; break }
    }
  }
  mixer.update(0.016)
  console.log("AnimationMixer:      OK —", acoes, "ações;", semAlvo, "clipes com trilha sem alvo no modelo")
} catch (e) {
  console.log("AnimationMixer:      FALHOU ->", e.constructor.name, e.message)
}

// 3) A normalização de altura que o motor faz logo depois.
try {
  const copia = cloneSkinned(player.scene)
  const box = new THREE.Box3().setFromObject(copia)
  const size = new THREE.Vector3(); box.getSize(size)
  console.log("Box3 do modelo:      altura", size.y.toFixed(3), "m (o motor normaliza para 1,80)")
  if (size.y <= 0.2) console.log("  ⚠️ altura <= 0,2: o motor NAO escala e o jogador fica do tamanho errado")
} catch (e) {
  console.log("Box3:                FALHOU ->", e.constructor.name, e.message)
}
