// Configuração pronta para o motor AAA V5.
// Copie a pasta public/assets/futebol para o seu projeto e passe este objeto em criarMotor().

export const assetsFutebol = {
  baseUrl: "/assets/futebol",
  jogador: {
    modelo: "players/player.glb",
    animacoes: "animations/football_motion.glb",
    alturaBaseM: 1.80,
    escala: 1,
    rotacaoY: 0,
    lod: {
      detalheAte: 28,
      glbAte: 78,
      proxyApos: 78,
    },
    clipes: {
      idle: "Idle",
      walk: "Walk",
      run: "Run",
      sprint: "Sprint",
      kick: "Kick_Right",
      tackle: "Slide_Tackle",
      header: "Header",
      celebrate: "Celebrate",
      dive: "Goalkeeper_Dive",
      control: "Control",
      disappointed: "Disappointed",
      complain: "Complain",
      point: "Point",
      hips: "Hands_Hips"
    }
  },
  estadio: {
    modelo: "stadium/stadium.glb",
    substituirProcedural: true,
    escala: 1,
    rotacaoY: 0,
    posicao: [0, 0, 0] as [number, number, number],
    castShadow: true,
    envMapIntensity: 0.72
  },
  gramadoPBR: {
    normal: "pitch/grass_normal.png",
    roughness: "pitch/grass_roughness.png",
    ao: "pitch/grass_ao.png",
    repeat: 36
  }
}
