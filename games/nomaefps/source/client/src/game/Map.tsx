import { useMemo } from 'react';
import * as THREE from 'three';

const PALETTE = {
  concrete: '#8a8a8a',
  concreteDark: '#6a6a6a',
  sand: '#d4c5a9',
  sandDark: '#b8a88a',
  orange: '#d4845a',
  orangeDark: '#b06840',
  teal: '#4a9e8e',
  blue: '#5a8ab8',
  red: '#b85050',
  white: '#e8e4dc',
  dark: '#2a2a2a',
  yellow: '#d4b850'
};

function Box({ position, size, color, roughness = 0.8, metalness = 0.1 }: any) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    </mesh>
  );
}

function Cylinder({ position, args, color, roughness = 0.8 }: any) {
  return (
    <mesh position={position} castShadow receiveShadow rotation={[0, 0, 0]}>
      <cylinderGeometry args={args} />
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  );
}

export function ArenaMap() {
  const groundTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, 0, 512, 512);

    // Noise
    for (let i = 0; i < 5000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? PALETTE.sandDark : PALETTE.white;
      ctx.globalAlpha = 0.1;
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    ctx.globalAlpha = 1;

    // Grid lines
    ctx.strokeStyle = PALETTE.orange;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.3;
    for (let i = 0; i <= 512; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 10);
    return tex;
  }, []);

  return (
    <group>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial map={groundTexture} roughness={0.9} />
      </mesh>

      {/* Central platform */}
      <Box position={[0, 1, 0]} size={[20, 2, 20]} color={PALETTE.concrete} />
      <Box position={[0, 2.05, 0]} size={[18, 0.1, 18]} color={PALETTE.orange} roughness={0.6} />

      {/* Corner towers */}
      <Box position={[-35, 4, -35]} size={[8, 8, 8]} color={PALETTE.concreteDark} />
      <Box position={[35, 4, -35]} size={[8, 8, 8]} color={PALETTE.concreteDark} />
      <Box position={[-35, 4, 35]} size={[8, 8, 8]} color={PALETTE.concreteDark} />
      <Box position={[35, 4, 35]} size={[8, 8, 8]} color={PALETTE.concreteDark} />

      {/* Tower tops */}
      <Box position={[-35, 8.5, -35]} size={[6, 1, 6]} color={PALETTE.orange} roughness={0.5} />
      <Box position={[35, 8.5, -35]} size={[6, 1, 6]} color={PALETTE.orange} roughness={0.5} />
      <Box position={[-35, 8.5, 35]} size={[6, 1, 6]} color={PALETTE.orange} roughness={0.5} />
      <Box position={[35, 8.5, 35]} size={[6, 1, 6]} color={PALETTE.orange} roughness={0.5} />

      {/* Side walls */}
      <Box position={[-45, 3, 0]} size={[4, 6, 30]} color={PALETTE.concrete} />
      <Box position={[45, 3, 0]} size={[4, 6, 30]} color={PALETTE.concrete} />
      <Box position={[0, 3, -45]} size={[30, 6, 4]} color={PALETTE.concrete} />
      <Box position={[0, 3, 45]} size={[30, 6, 4]} color={PALETTE.concrete} />

      {/* Ramps to center */}
      <group position={[-12, 0, 0]} rotation={[0, 0, Math.PI * 0.15]}>
        <Box position={[0, 1, 0]} size={[12, 2, 4]} color={PALETTE.concreteDark} />
      </group>
      <group position={[12, 0, 0]} rotation={[0, 0, -Math.PI * 0.15]}>
        <Box position={[0, 1, 0]} size={[12, 2, 4]} color={PALETTE.concreteDark} />
      </group>
      <group position={[0, 0, -12]} rotation={[Math.PI * 0.15, 0, 0]}>
        <Box position={[0, 1, 0]} size={[4, 2, 12]} color={PALETTE.concreteDark} />
      </group>
      <group position={[0, 0, 12]} rotation={[-Math.PI * 0.15, 0, 0]}>
        <Box position={[0, 1, 0]} size={[4, 2, 12]} color={PALETTE.concreteDark} />
      </group>

      {/* Cover blocks */}
      <Box position={[-15, 1.5, -15]} size={[3, 3, 3]} color={PALETTE.teal} roughness={0.7} />
      <Box position={[15, 1.5, -15]} size={[3, 3, 3]} color={PALETTE.teal} roughness={0.7} />
      <Box position={[-15, 1.5, 15]} size={[3, 3, 3]} color={PALETTE.teal} roughness={0.7} />
      <Box position={[15, 1.5, 15]} size={[3, 3, 3]} color={PALETTE.teal} roughness={0.7} />

      <Box position={[-8, 1, -8]} size={[2, 2, 2]} color={PALETTE.blue} roughness={0.7} />
      <Box position={[8, 1, -8]} size={[2, 2, 2]} color={PALETTE.blue} roughness={0.7} />
      <Box position={[-8, 1, 8]} size={[2, 2, 2]} color={PALETTE.blue} roughness={0.7} />
      <Box position={[8, 1, 8]} size={[2, 2, 2]} color={PALETTE.blue} roughness={0.7} />

      {/* Barriers */}
      <Box position={[-25, 0.75, 0]} size={[0.5, 1.5, 8]} color={PALETTE.red} roughness={0.6} />
      <Box position={[25, 0.75, 0]} size={[0.5, 1.5, 8]} color={PALETTE.red} roughness={0.6} />
      <Box position={[0, 0.75, -25]} size={[8, 1.5, 0.5]} color={PALETTE.red} roughness={0.6} />
      <Box position={[0, 0.75, 25]} size={[8, 1.5, 0.5]} color={PALETTE.red} roughness={0.6} />

      {/* Crates */}
      <Box position={[-20, 0.75, -10]} size={[2, 1.5, 2]} color={PALETTE.yellow} roughness={0.8} />
      <Box position={[-20, 1.8, -10]} size={[1.8, 0.6, 1.8]} color={PALETTE.orangeDark} roughness={0.8} />
      <Box position={[20, 0.75, 10]} size={[2, 1.5, 2]} color={PALETTE.yellow} roughness={0.8} />
      <Box position={[20, 1.8, 10]} size={[1.8, 0.6, 1.8]} color={PALETTE.orangeDark} roughness={0.8} />

      {/* Background structures */}
      <Box position={[-60, 5, -60]} size={[15, 10, 15]} color={PALETTE.dark} />
      <Box position={[60, 5, -60]} size={[15, 10, 15]} color={PALETTE.dark} />
      <Box position={[-60, 5, 60]} size={[15, 10, 15]} color={PALETTE.dark} />
      <Box position={[60, 5, 60]} size={[15, 10, 15]} color={PALETTE.dark} />

      {/* Pipes */}
      <Cylinder position={[-45, 3, -20]} args={[0.3, 0.3, 6, 8]} color={PALETTE.dark} metalness={0.5} />
      <Cylinder position={[45, 3, 20]} args={[0.3, 0.3, 6, 8]} color={PALETTE.dark} metalness={0.5} />

      {/* Stairs to towers */}
      {[...Array(6)].map((_, i) => (
        <group key={`stair-nw-${i}`}>
          <Box position={[-35, i * 0.5 + 0.25, -28 + i * 1.2]} size={[3, 0.5, 1.2]} color={PALETTE.concrete} />
        </group>
      ))}
      {[...Array(6)].map((_, i) => (
        <group key={`stair-ne-${i}`}>
          <Box position={[35, i * 0.5 + 0.25, -28 + i * 1.2]} size={[3, 0.5, 1.2]} color={PALETTE.concrete} />
        </group>
      ))}
    </group>
  );
}
