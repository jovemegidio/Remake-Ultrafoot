"use client"

import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera, Environment, Text, RoundedBox } from "@react-three/drei"
import { useRef, useMemo, Suspense } from "react"
import * as THREE from "three"

interface Player {
  id: number
  x: number
  y: number
  number: number
  name: string
  rating: number
  position: string
}

interface TacticalPitch3DProps {
  homePlayers: Player[]
  awayPlayers: Player[]
  homeColor?: string
  awayColor?: string
  formation?: string
}

function PitchGround() {
  const grassTexture = useMemo(() => {
    const canvas = document.createElement("canvas")
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext("2d")
    if (ctx) {
      // Base grass color
      ctx.fillStyle = "#2d5a27"
      ctx.fillRect(0, 0, 512, 512)
      
      // Stripe pattern
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 === 0 ? "#2d5a27" : "#326b2c"
        ctx.fillRect(i * 64, 0, 64, 512)
      }
      
      // Add noise for realism
      const imageData = ctx.getImageData(0, 0, 512, 512)
      for (let i = 0; i < imageData.data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 15
        imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise))
        imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise))
        imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise))
      }
      ctx.putImageData(imageData, 0, 0)
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(4, 2)
    return texture
  }, [])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[105, 68]} />
      <meshStandardMaterial map={grassTexture} roughness={0.9} />
    </mesh>
  )
}

function PitchLines() {
  const lineMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ color: "#ffffff", linewidth: 2 }),
    []
  )

  // Field dimensions: 105x68 (standard)
  const halfW = 52.5
  const halfH = 34

  // Create line geometries
  const lines = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = []

    // Outer boundary
    const boundary = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-halfW, 0.02, -halfH),
      new THREE.Vector3(halfW, 0.02, -halfH),
      new THREE.Vector3(halfW, 0.02, halfH),
      new THREE.Vector3(-halfW, 0.02, halfH),
      new THREE.Vector3(-halfW, 0.02, -halfH),
    ])
    geometries.push(boundary)

    // Center line
    const centerLine = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.02, -halfH),
      new THREE.Vector3(0, 0.02, halfH),
    ])
    geometries.push(centerLine)

    // Center circle
    const circlePoints: THREE.Vector3[] = []
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2
      circlePoints.push(new THREE.Vector3(Math.cos(angle) * 9.15, 0.02, Math.sin(angle) * 9.15))
    }
    const centerCircle = new THREE.BufferGeometry().setFromPoints(circlePoints)
    geometries.push(centerCircle)

    // Penalty areas
    const penaltyW = 16.5
    const penaltyH = 40.32 / 2

    // Left penalty area
    const leftPenalty = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-halfW, 0.02, -penaltyH),
      new THREE.Vector3(-halfW + penaltyW, 0.02, -penaltyH),
      new THREE.Vector3(-halfW + penaltyW, 0.02, penaltyH),
      new THREE.Vector3(-halfW, 0.02, penaltyH),
    ])
    geometries.push(leftPenalty)

    // Right penalty area
    const rightPenalty = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(halfW, 0.02, -penaltyH),
      new THREE.Vector3(halfW - penaltyW, 0.02, -penaltyH),
      new THREE.Vector3(halfW - penaltyW, 0.02, penaltyH),
      new THREE.Vector3(halfW, 0.02, penaltyH),
    ])
    geometries.push(rightPenalty)

    // Goal areas (6 yard box)
    const goalW = 5.5
    const goalH = 18.32 / 2

    const leftGoal = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-halfW, 0.02, -goalH),
      new THREE.Vector3(-halfW + goalW, 0.02, -goalH),
      new THREE.Vector3(-halfW + goalW, 0.02, goalH),
      new THREE.Vector3(-halfW, 0.02, goalH),
    ])
    geometries.push(leftGoal)

    const rightGoal = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(halfW, 0.02, -goalH),
      new THREE.Vector3(halfW - goalW, 0.02, -goalH),
      new THREE.Vector3(halfW - goalW, 0.02, goalH),
      new THREE.Vector3(halfW, 0.02, goalH),
    ])
    geometries.push(rightGoal)

    return geometries
  }, [])

  return (
    <group>
      {lines.map((geometry, i) => (
        <line key={i} geometry={geometry}>
          <lineBasicMaterial attach="material" color="#ffffff" opacity={0.9} transparent />
        </line>
      ))}
      {/* Center spot */}
      <mesh position={[0, 0.02, 0]}>
        <circleGeometry args={[0.3, 32]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* Penalty spots */}
      <mesh position={[-41.5, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.25, 32]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[41.5, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.25, 32]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

function GoalPost({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
  const postColor = "#ffffff"
  const netColor = "#cccccc"

  return (
    <group position={position} rotation={rotation}>
      {/* Posts */}
      <mesh position={[-3.66, 1.22, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 2.44, 16]} />
        <meshStandardMaterial color={postColor} metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[3.66, 1.22, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 2.44, 16]} />
        <meshStandardMaterial color={postColor} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Crossbar */}
      <mesh position={[0, 2.44, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 7.32, 16]} />
        <meshStandardMaterial color={postColor} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Net (simplified) */}
      <mesh position={[0, 1.22, -1]}>
        <boxGeometry args={[7.32, 2.44, 0.02]} />
        <meshStandardMaterial color={netColor} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function PlayerMarker({
  player,
  color,
  isHome,
}: {
  player: Player
  color: string
  isHome: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)

  // Convert percentage position to field coordinates
  const x = ((player.x / 100) - 0.5) * 100
  const z = ((player.y / 100) - 0.5) * 64

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = 0.8 + Math.sin(state.clock.elapsedTime * 2 + player.id) * 0.05
    }
    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 3 + player.id) * 0.1)
    }
  })

  return (
    <group position={[x, 0, z]}>
      {/* Glow ring on ground */}
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[1.2, 1.8, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} />
      </mesh>

      {/* Player marker sphere */}
      <mesh ref={meshRef} position={[0, 0.8, 0]} castShadow>
        <sphereGeometry args={[0.7, 32, 32]} />
        <meshStandardMaterial
          color={color}
          metalness={0.3}
          roughness={0.4}
          emissive={color}
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Number on top */}
      <Text
        position={[0, 1.8, 0]}
        fontSize={0.8}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        font="/fonts/Inter-Bold.woff"
        outlineWidth={0.05}
        outlineColor="#000000"
      >
        {player.number}
      </Text>

      {/* Rating badge */}
      <group position={[0, 2.5, 0]}>
        <RoundedBox args={[1.5, 0.6, 0.1]} radius={0.1}>
          <meshStandardMaterial color={isHome ? "#1a1a2e" : "#1a1a2e"} />
        </RoundedBox>
        <Text
          position={[0, 0, 0.06]}
          fontSize={0.35}
          color={player.rating >= 80 ? "#4ade80" : player.rating >= 70 ? "#fbbf24" : "#f87171"}
          anchorX="center"
          anchorY="middle"
        >
          {player.rating}
        </Text>
      </group>
    </group>
  )
}

function Scene({
  homePlayers,
  awayPlayers,
  homeColor = "#ef4444",
  awayColor = "#22d3ee",
}: {
  homePlayers: Player[]
  awayPlayers: Player[]
  homeColor?: string
  awayColor?: string
}) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 60, 50]} fov={45} />
      <OrbitControls
        enablePan={false}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.5}
        minDistance={40}
        maxDistance={100}
        target={[0, 0, 0]}
      />

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[50, 100, 50]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={200}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      <directionalLight position={[-50, 80, -50]} intensity={0.6} />

      {/* Stadium lights effect */}
      <pointLight position={[-60, 30, -40]} intensity={50} color="#ffeedd" distance={100} />
      <pointLight position={[60, 30, -40]} intensity={50} color="#ffeedd" distance={100} />
      <pointLight position={[-60, 30, 40]} intensity={50} color="#ffeedd" distance={100} />
      <pointLight position={[60, 30, 40]} intensity={50} color="#ffeedd" distance={100} />

      {/* Pitch */}
      <PitchGround />
      <PitchLines />

      {/* Goals */}
      <GoalPost position={[-52.5, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      <GoalPost position={[52.5, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />

      {/* Players */}
      {homePlayers.map((player) => (
        <PlayerMarker key={`home-${player.id}`} player={player} color={homeColor} isHome />
      ))}
      {awayPlayers.map((player) => (
        <PlayerMarker key={`away-${player.id}`} player={player} color={awayColor} isHome={false} />
      ))}

      {/* Environment */}
      <Environment preset="night" />

      {/* Fog for atmosphere */}
      <fog attach="fog" args={["#0a0e1a", 80, 150]} />
    </>
  )
}

export function TacticalPitch3D({
  homePlayers,
  awayPlayers,
  homeColor = "#ef4444",
  awayColor = "#22d3ee",
}: TacticalPitch3DProps) {
  return (
    <div className="relative w-full h-full min-h-[400px] rounded-lg overflow-hidden bg-gradient-to-b from-[#0a1628] to-[#071018]">
      {/* EA FC style overlay gradients */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-background/80 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background/80 to-transparent" />
        <div className="absolute top-0 bottom-0 left-0 w-16 bg-gradient-to-r from-background/60 to-transparent" />
        <div className="absolute top-0 bottom-0 right-0 w-16 bg-gradient-to-l from-background/60 to-transparent" />
      </div>

      {/* Corner accents */}
      <div className="absolute top-4 left-4 w-12 h-12 border-l-2 border-t-2 border-primary/50 z-10" />
      <div className="absolute top-4 right-4 w-12 h-12 border-r-2 border-t-2 border-primary/50 z-10" />
      <div className="absolute bottom-4 left-4 w-12 h-12 border-l-2 border-b-2 border-primary/50 z-10" />
      <div className="absolute bottom-4 right-4 w-12 h-12 border-r-2 border-b-2 border-primary/50 z-10" />

      <Suspense
        fallback={
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground font-display tracking-wider">
                CARREGANDO CAMPO 3D
              </span>
            </div>
          </div>
        }
      >
        <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
          <Scene
            homePlayers={homePlayers}
            awayPlayers={awayPlayers}
            homeColor={homeColor}
            awayColor={awayColor}
          />
        </Canvas>
      </Suspense>

      {/* Formation badge */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
        <div className="glass-panel px-6 py-2 rounded-full">
          <span className="font-display tracking-[0.3em] text-xs text-primary">
            FORMACAO 4-3-3
          </span>
        </div>
      </div>

      {/* View controls hint */}
      <div className="absolute bottom-6 right-6 z-20">
        <div className="glass-panel-light px-3 py-1.5 rounded text-[10px] text-muted-foreground">
          Arraste para rotacionar
        </div>
      </div>
    </div>
  )
}

export default TacticalPitch3D
