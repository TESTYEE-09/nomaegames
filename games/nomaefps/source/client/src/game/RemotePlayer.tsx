import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PlayerState } from '@shared/types';

interface Props {
  player: PlayerState;
}

export function RemotePlayer({ player }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const targetPos = useRef(new THREE.Vector3(player.position.x, player.position.y, player.position.z));
  const currentPos = useRef(new THREE.Vector3(player.position.x, player.position.y, player.position.z));

  useFrame((_, dt) => {
    if (!groupRef.current) return;

    targetPos.current.set(player.position.x, player.position.y, player.position.z);
    currentPos.current.lerp(targetPos.current, 1 - Math.pow(0.01, dt));

    groupRef.current.position.copy(currentPos.current);

    const q = new THREE.Quaternion(
      player.quaternion.x,
      player.quaternion.y,
      player.quaternion.z,
      player.quaternion.w
    );
    groupRef.current.quaternion.slerp(q, 0.3);
  });

  const teamColor = player.id.charCodeAt(0) % 2 === 0 ? '#e85d4e' : '#4ecde8';

  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <capsuleGeometry args={[0.35, 1.0, 4, 8]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.7} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.65, 0]} castShadow>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color={teamColor} roughness={0.5} />
      </mesh>

      {/* Helmet */}
      <mesh position={[0, 1.72, 0]} castShadow>
        <sphereGeometry args={[0.26, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.6} metalness={0.3} />
      </mesh>

      {/* Arms */}
      <mesh position={[0.45, 1.3, 0.2]} rotation={[0.5, 0, -0.3]} castShadow>
        <capsuleGeometry args={[0.12, 0.5, 4, 8]} />
        <meshStandardMaterial color="#4a4a4a" roughness={0.8} />
      </mesh>
      <mesh position={[-0.45, 1.3, 0.2]} rotation={[0.5, 0, 0.3]} castShadow>
        <capsuleGeometry args={[0.12, 0.5, 4, 8]} />
        <meshStandardMaterial color="#4a4a4a" roughness={0.8} />
      </mesh>

      {/* Gun */}
      <group position={[0.3, 1.1, 0.4]} rotation={[0, 0, -0.1]}>
        <mesh castShadow>
          <boxGeometry args={[0.08, 0.12, 0.5]} />
          <meshStandardMaterial color="#2a2a2a" roughness={0.4} metalness={0.6} />
        </mesh>
        <mesh position={[0, -0.05, 0.15]} castShadow>
          <boxGeometry args={[0.06, 0.15, 0.1]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.02, -0.25]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.2]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.7} />
        </mesh>
      </group>

      {/* Name tag */}
      <mesh position={[0, 2.2, 0]}>
        <planeGeometry args={[1.2, 0.3]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.6} />
      </mesh>
    </group>
  );
}
